import type { UserProfile } from "@/types/nostrill";
import type { UrbitContacts } from "@/types/urbit";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  AutocompleteList,
  useAutocompleteCandidates,
  type AutoCompleteCandidate,
} from "./Autocomplete";
import ConfirmationDialog from "../modals/ConfirmationDialog";
import ComposerLayer from "./ComposerLayer";
import { restoreComposerCaret, saveComposerCaret } from "./composerDom";
import useLocalState from "@/state/state";
import toast from "react-hot-toast";

type Props = {
  placeholder: string;
  input: string;
  setInput: (s: string) => void;
  setIsExpanded: (s: boolean) => void;
  contacts: UrbitContacts;
  profiles: Map<string, UserProfile>;
  inputRef: RefObject<HTMLDivElement | null>;
  onUploadImage: (file: File) => Promise<void>;
};

export default function ({
  input,
  setInput,
  setIsExpanded,
  contacts,
  profiles,
  placeholder,
  inputRef,
  onUploadImage,
}: Props) {
  // Autocomplete state
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    type: string;
    start: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const { s3 } = useLocalState((s) => ({ s3: s.s3 }));
  // a pasted image waiting for upload confirmation
  const [pendingPaste, setPendingPaste] = useState<{
    file: File;
    previewUrl: string;
    caret: Range | null;
  } | null>(null);
  useEffect(() => () => {
    if (pendingPaste) URL.revokeObjectURL(pendingPaste.previewUrl);
  }, [pendingPaste]);
  const cancelPaste = useCallback(() => setPendingPaste(null), []);
  async function confirmPaste() {
    if (!pendingPaste) return;
    const { file, caret } = pendingPaste;
    setPendingPaste(null);
    if (!inputRef.current) return;
    restoreComposerCaret(inputRef.current, caret);
    await onUploadImage(file);
  }

  // Track last known cursor index to restore if needed, though mostly we rely on live selection
  const cursorRef = useRef<number>(0);

  // Sync external input prop changes (mainly for clearing)
  useEffect(() => {
    if (inputRef.current && input !== inputRef.current.innerText) {
      // Only update if significantly different (e.g. clear) to avoid cursor jumps
      if (input === "") {
        inputRef.current.innerText = "";
      }
    }
  }, [input]);

  // Helper to get caret position relative to text content
  const getCaretIndex = (element: HTMLElement) => {
    let position = 0;
    const isSupported = typeof window.getSelection !== "undefined";
    if (isSupported) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount !== 0) {
        const range = window.getSelection()?.getRangeAt(0);
        const preCaretRange = range?.cloneRange();
        preCaretRange?.selectNodeContents(element);
        preCaretRange?.setEnd(range!.endContainer, range!.endOffset);
        position = preCaretRange?.toString().length || 0;
      }
    }
    return position;
  };

  // Use the extracted hook for candidates
  const mentionCandidates = useAutocompleteCandidates(
    contacts,
    profiles,
    mentionState?.query || null,
  );

  // Mention detection
  function checkMention(text: string, cursor: number) {
    const textBefore = text.slice(0, cursor);
    // Match @... or ~... at the end of the string, preceded by start or whitespace
    const match = textBefore.match(/(?:^|\s)([@~])([a-z0-9-]*)$/i);

    if (match) {
      // Adjust start index if there was a leading space
      const offset =
        match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0;
      setMentionState({
        active: true,
        type: match[1],
        query: match[2],
        start: match.index! + offset,
      });
      setMentionIndex(0);
    } else {
      setMentionState(null);
    }
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const text = el.innerText;
    setInput(text);

    const cursor = getCaretIndex(el);
    cursorRef.current = cursor;
    checkMention(text, cursor);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith("image/")) {
        if (!s3) {
          toast.error("Media storage is unavailable. Open the media picker to retry.");
          return;
        }
        setPendingPaste({
          file,
          previewUrl: URL.createObjectURL(file),
          caret: saveComposerCaret(inputRef.current),
        });
        return;
      }
    }
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const selectUser = (user: AutoCompleteCandidate) => {
    if (!mentionState || !inputRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // We need to delete the typed query (e.g. @zod) and replace it with a chip
    const deleteLength = mentionState.query.length + 1; // +1 for @ or ~

    // Delete the text
    for (let i = 0; i < deleteLength; i++) {
      document.execCommand("delete");
    }

    // Insert the chip
    const chipHtml = `<span contenteditable="false" class="mention-chip" data-id="${user.id}">${user.id}</span>&nbsp;`;
    document.execCommand("insertHTML", false, chipHtml);

    setMentionState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      const form = inputRef.current?.closest("form");
      form?.requestSubmit();
    } else if (mentionState && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (prev) =>
            (prev - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectUser(mentionCandidates[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionState(null);
      }
    }
  };

  return (
    <>
      <div
        ref={inputRef}
        contentEditable
        className="input-editor"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsExpanded(true)}
        role="textbox"
        tabIndex={0}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {mentionState && (
        <AutocompleteList
          candidates={mentionCandidates}
          selectedIndex={mentionIndex}
          onSelect={selectUser}
        />
      )}

      {pendingPaste && (
        <ComposerLayer onClose={cancelPaste}>
          <ConfirmationDialog
            message={`Upload ${pendingPaste.file.name} to your ship’s media storage?`}
            onConfirm={confirmPaste}
            onCancel={cancelPaste}
          >
            <img
              style={{
                border: "2px solid var(--text-color)",
                maxWidth: "80%",
                maxHeight: "300px",
                display: "block",
                margin: "1rem auto",
              }}
              src={pendingPaste.previewUrl}
            ></img>
          </ConfirmationDialog>
        </ComposerLayer>
      )}
    </>
  );
}
