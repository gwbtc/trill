import "@/styles/Composer.css";
import useLocalState, { useStore } from "@/state/state";
import spinner from "@/assets/triangles.svg";
import Sigil from "@/components/Sigil";
import { useCallback, useState, useEffect, useRef, type FormEvent } from "react";
import Snippets, { ReplySnippet } from "./Snippets";
import toast from "react-hot-toast";
import Icon from "@/components/Icon";
import { wait } from "@/logic/utils";
import { shortRelayUrl } from "@/logic/relayDisplay";
import type { UserType } from "@/types/nostrill";
import { patpToFallbackUID } from "@/logic/gw";
import InputBox from "./InputBox";
import {
  AtSign,
  Check,
  ChevronDown,
  Globe2,
  ImageIcon,
  Smile,
  Users,
} from "lucide-react";
import S3Browser from "./S3Browser";
import ComposerLayer from "./ComposerLayer";
import EmojiPicker from "./EmojiPicker";
import { UrbitAvatar } from "../Avatar";
import {
  insertComposerImage,
  insertComposerText,
  restoreComposerCaret,
  saveComposerCaret,
  serializeComposerContent,
} from "./composerDom";

function Composer({
  isAnon,
  isModal,
  relayTargets = [],
}: {
  isAnon?: boolean;
  isModal?: boolean;
  // relay urls to cross-post to after a successful top-level post
  relayTargets?: string[];
}) {
  const {
    api,
    our,
    composerData,
    setComposerData,
    contacts,
    profiles,
    s3,
    setModal,
  } = useLocalState((s) => ({
    api: s.api,
    our: s.our,
    composerData: s.composerData,
    setComposerData: s.setComposerData,
    contacts: s.contacts,
    profiles: s.profiles,
    s3: s.s3,
    setModal: s.setModal,
  }));
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [relayStatus, setRelayStatus] = useState<string | null>(null);
  const [replyMenuOpen, setReplyMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"everyone" | "following" | "mentioned">("everyone");

  const [isGlobal, setGlobal] = useState(true);
  function toggleGlobal() {
    setGlobal((s) => !s);
  }

  const inputRef = useRef<HTMLDivElement>(null);

  // Input
  useEffect(() => {
    if (composerData) {
      setIsExpanded(true);
      if (
        composerData.type === "reply" &&
        composerData.post &&
        "trill" in composerData.post
      ) {
      }
      // Auto-focus input when composer opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100); // Small delay to ensure the composer is rendered
    }
  }, [composerData]);

  async function addSimple(content: string) {
    if (!api) return;
    return await api.addPost(content.trim(), isGlobal, isAnon || false, replyMode);
  }

  async function addComplex(content: string) {
    if (!api) return;
    if (!composerData) return;
    const host: UserType =
      "trill" in composerData.post
        ? { urbit: composerData.post.trill.authorFull.author }
        : "nostr" in composerData.post
          ? { nostr: composerData.post.nostr.pubkey }
          : { urbit: patpToFallbackUID(api.airlock.our!) };
    const id =
      "trill" in composerData.post
        ? composerData.post.trill.id
        : "nostr" in composerData.post
          ? composerData.post.nostr.eventId
          : "";
    const thread =
      "trill" in composerData.post
        ? composerData.post.trill.thread || composerData.post.trill.id
        : "nostr" in composerData.post
          ? composerData.post.nostr.eventId
          : "";

    if (composerData.type === "reply")
      return await api.addReply(content, host, id, thread);
    if (composerData.type === "quote")
      return await api.addQuote(content, host, id);
    return { error: "unknown composer type" };
  }

  const newestOwnPostId = () => {
    const feed = useStore.getState().myFeed.feed;
    const ids = Object.keys(feed);
    if (ids.length === 0) return null;
    return ids.sort((a, b) => Number(BigInt(b) - BigInt(a)))[0];
  };

  // the post id is minted backend-side; it reaches us through the
  // %post %add fact, which the store files into myFeed
  async function resolveNewPostId(prev: string | null) {
    for (let i = 0; i < 15; i++) {
      const newest = newestOwnPostId();
      if (newest && newest !== prev) return newest;
      await wait(200);
    }
    return null;
  }

  // resolves with the relay urls from the %sent-post fact, or null
  // on timeout: poke-acks only mean "queued", the fact is the
  // actual confirmation that the event went out
  function waitForSentPost(id: string, timeout = 8000) {
    return new Promise<string[] | null>((resolve) => {
      const unsub = useStore.subscribe((s) => {
        const f = s.lastFact;
        if (!f || !("nostr" in f) || !("sent-post" in f.nostr)) return;
        const sp = (f.nostr as any)["sent-post"];
        if (String(sp.id) !== String(id)) return;
        cleanup();
        resolve(sp.relays ?? []);
      });
      const timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeout);
      function cleanup() {
        unsub();
        clearTimeout(timer);
      }
    });
  }

  async function crossPost(prevNewest: string | null, urls: string[]) {
    setRelayStatus("confirming post...");
    const id = await resolveNewPostId(prevNewest);
    if (!id) {
      toast.error("Posted, but couldn't resolve the post for relay send");
      return;
    }
    // urls -> live wids at send time (sockets may have churned)
    const relays = useStore.getState().relays;
    const wids = urls
      .map((u) => relays[u]?.wid)
      .filter((w): w is number => w != null);
    if (wids.length === 0) {
      toast.error("Posted, but none of the selected relays are connected");
      return;
    }
    setRelayStatus(`sending to ${wids.length} relay${wids.length > 1 ? "s" : ""}...`);
    const res = await api!.relayPost(api!.airlock.our!, id, wids);
    if ("error" in res) {
      toast.error("Posted, but the relay send failed");
      return;
    }
    const sent = await waitForSentPost(id);
    if (sent && sent.length > 0) {
      toast.success(`Sent to ${sent.map(shortRelayUrl).join(", ")}`);
    } else {
      toast.error("Posted, but relay delivery was not confirmed");
    }
  }

  async function poast(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!api) return;

    const content = serializeComposerContent(inputRef.current, input);
    if (!content.trim()) return;
    // Ctrl+Enter submits via requestSubmit, which skips the disabled button
    if (remaining < 0) {
      toast.error(`Posts are limited to ${charMax} characters`);
      return;
    }

    setLoading(true);
    const isTopLevel = !composerData;
    const prevNewest = isTopLevel ? newestOwnPostId() : null;
    const res = await (isTopLevel ? addSimple(content) : addComplex(content));
    if (!res || "error" in res) {
      // keep the draft so the user can retry
      toast.error("Failed to post");
      setLoading(false);
      return;
    }
    // cross-post to the chosen relays; replies/quotes are
    // excluded (send-post emits no e-tags yet, which would
    // break nostr threading)
    if (isModal && isTopLevel && relayTargets.length > 0) {
      await crossPost(prevNewest, relayTargets);
    }
    setInput("");
    setComposerData(null); // Clear composer data after successful post
    toast.success(isModal ? "post sent" : "Posted to your relays");
    setLoading(false);
    setRelayStatus(null);
    setIsExpanded(false);
    if (isModal) setModal(null);
    if (inputRef.current) inputRef.current.innerText = "";
  }
  const placeholder =
    composerData?.type === "reply"
      ? "Write your reply..."
      : composerData?.type === "quote"
        ? "Add your thoughts..."
        : isModal
          ? "Broadcast to the fleet..."
          : isAnon
            ? "> be me"
            : "What's happening on the network?";

  const clearComposer = (e: React.MouseEvent) => {
    e.preventDefault();
    setComposerData(null);
    setInput("");
    setIsExpanded(false);
  };

  const [s3Open, setS3Open] = useState(false);
  const caretRef = useRef<Range | null>(null);
  const closeS3Browser = useCallback(() => setS3Open(false), []);

  const handleS3Select = (url: string) => {
    setS3Open(false);
    if (!inputRef.current) return;
    restoreComposerCaret(inputRef.current, caretRef.current);
    setInput((s) => s + ` ![](${url}) `);
    insertComposerImage(url);
  };

  const openS3Browser = () => {
    if (!s3) {
      toast.error("S3 media is not configured");
      return;
    }
    caretRef.current = saveComposerCaret(inputRef.current);
    setS3Open(true);
  };

  const focusAndInsert = (text: string) => {
    inputRef.current?.focus();
    insertComposerText(text, inputRef.current);
    setInput(inputRef.current?.innerText || "");
  };

  const replyOptions = [
    { key: "everyone" as const, label: "Everyone", icon: Globe2 },
    { key: "following" as const, label: "People you follow", icon: Users },
    { key: "mentioned" as const, label: "Mentioned only", icon: AtSign },
  ];
  const activeReplyOption = replyOptions.find((option) => option.key === replyMode)!;
  const ReplyIcon = activeReplyOption.icon;
  const charMax = 280;
  const remaining = charMax - input.length;
  const progress = Math.min(1, Math.max(0, input.length / charMax));
  const circumference = 75.4;
  const ringOffset = circumference * (1 - progress);
  const ringColor =
    remaining < 0
      ? "var(--color-error, #ef4444)"
      : remaining < 28
        ? "var(--color-warning, #f59e0b)"
        : "var(--color-primary, #5b46e5)";

  return (
    <form
      id="composer"
      className={`${isExpanded ? "expanded" : ""} ${composerData ? "has-context" : ""} ${isModal ? "composer-modal-body" : ""}`}
      onSubmit={poast}
    >
      <div className="sigil avatar">
        {our ? (
          <UrbitAvatar uid={our} size={46} />
        ) : (
          <Sigil patp={api?.airlock.our || ""} size={46} />
        )}
      </div>

      <div className="composer-content">
        {/* Reply snippets appear above input */}
        {composerData && composerData.type === "reply" && (
          <div className="composer-context reply-context">
            <div className="context-header">
              <span className="context-type">
                <Icon name="reply" size={14} /> Replying to
              </span>
              <button
                className="clear-context"
                onClick={clearComposer}
                title="Clear"
                type="button"
              >
                ×
              </button>
            </div>
            <ReplySnippet post={composerData.post} />
          </div>
        )}

        {/* Quote context header above input (without snippet) */}
        {composerData && composerData.type === "quote" && (
          <div className="quote-header">
            <div className="context-header">
              <span className="context-type">
                <Icon name="quote" size={14} /> Quote posting
              </span>
              <button
                className="clear-context"
                onClick={clearComposer}
                title="Clear"
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="composer-input-row">
          <InputBox
            input={input}
            setInput={setInput}
            setIsExpanded={setIsExpanded}
            contacts={contacts}
            profiles={profiles}
            placeholder={placeholder}
            inputRef={inputRef}
          />
          {!isModal &&
            (isLoading ? (
              <img width="40" src={spinner} />
            ) : (
              <button type="submit" disabled={!input.trim()} className="post-btn">
                Post
              </button>
            ))}
        </div>
        {/* reply policy applies to new top-level posts only */}
        {isModal && !composerData && (
          <div className="compose-reply-restriction">
            <button type="button" onClick={() => setReplyMenuOpen((open) => !open)}>
              <ReplyIcon size={16} />
              {activeReplyOption.label}
              <ChevronDown size={13} />
            </button>
            {replyMenuOpen && (
              <div className="compose-popover compose-reply-menu">
                <div className="compose-popover-label">Who can reply?</div>
                {replyOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => {
                        setReplyMode(option.key);
                        setReplyMenuOpen(false);
                      }}
                    >
                      <OptionIcon size={16} />
                      <span>{option.label}</span>
                      {replyMode === option.key && <Check size={15} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="composer-controls">
          <div className="composer-tool-group">
            <button
              type="button"
              onClick={openS3Browser}
              className="icon-btn"
              title="Add image"
            >
              <ImageIcon size={20} />
            </button>
            {isModal && (
              <>
                {/* polls are not implemented yet
                <button type="button" className="icon-btn" title="Poll">
                  <BarChart3 size={20} />
                </button>
                */}
                <div className="compose-emoji-anchor">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Emoji"
                    onClick={() => setEmojiOpen((open) => !open)}
                  >
                    <Smile size={20} />
                  </button>
                  {emojiOpen && (
                    <EmojiPicker
                      onPick={(emoji) => {
                        focusAndInsert(emoji);
                        setEmojiOpen(false);
                      }}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Mention ~ship"
                  onClick={() => focusAndInsert("@")}
                >
                  <AtSign size={20} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleGlobal}
              className="icon-btn"
              title="global"
            >
              <Icon
                size={20}
                name="planet"
                filter={isGlobal ? undefined : "opacity(0.3)"}
              />
            </button>
          </div>

          {isModal && (
            <div className="compose-submit-group">
              <div className="compose-char-ring" aria-label={`${remaining} characters remaining`}>
                <svg width="30" height="30" viewBox="0 0 30 30">
                  <circle cx="15" cy="15" r="12" />
                  <circle
                    className="progress"
                    cx="15"
                    cy="15"
                    r="12"
                    style={{
                      stroke: ringColor,
                      strokeDashoffset: ringOffset,
                    }}
                  />
                </svg>
                {(remaining <= 28 || remaining < 0) && (
                  <span className="mono" style={{ color: ringColor }}>
                    {remaining}
                  </span>
                )}
              </div>
              <div className="compose-footer-rule" />
              {relayStatus && (
                <span className="compose-relay-status mono">{relayStatus}</span>
              )}
              {isLoading ? (
                <img width="34" src={spinner} />
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || remaining < 0}
                  className="post-btn"
                >
                  Broadcast
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quote snippets appear below input */}
        {composerData && composerData.type === "quote" && (
          <div className="composer-context quote-context">
            <Snippets post={composerData.post} />
          </div>
        )}
      </div>
      {s3Open && (
        <ComposerLayer onClose={closeS3Browser}>
          <S3Browser onSelect={handleS3Select} onClose={closeS3Browser} />
        </ComposerLayer>
      )}
    </form>
  );
}

export default Composer;
