import type { UserProfile } from "@/types/nostrill";
import type { UrbitContacts } from "@/types/urbit";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AutocompleteList,
  useAutocompleteCandidates,
  type AutoCompleteCandidate,
} from "./Autocomplete";
import ConfirmationDialog from "../modals/ConfirmationDialog";
import useLocalState from "@/state/state";
import toast from "react-hot-toast";
import { uploadToS3 } from "@/logic/s3";

type Props = {
  placeholder: string;
  input: string;
  setInput: (s: string) => void;
  setIsExpanded: (s: boolean) => void;
  contacts: UrbitContacts;
  profiles: Map<string, UserProfile>;
  inputRef: RefObject<HTMLDivElement | null>;
};

export default function ({
  input,
  setInput,
  setIsExpanded,
  contacts,
  profiles,
  placeholder,
  inputRef,
}: Props) {
  // Autocomplete state
  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    type: string;
    start: number;
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const { s3, setModal } = useLocalState((s) => ({
    s3: s.s3,
    setModal: s.setModal,
  }));

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

  const uploadPastedImage = async (file: File) => {
    if (!inputRef.current || !s3) return;

    // 1. Create BLOB URL for immediate preview
    const blobUrl = URL.createObjectURL(file);
    // 2. Insert with opacity (loading state)
    // We use a unique ID to find it later
    const tempId = `upload-${Date.now()}`;
    const imgHtml = `<img id="${tempId}" class="img-thumb opacity-50" src="${blobUrl}"/> &nbsp;`;
    document.execCommand("insertHTML", false, imgHtml);

    try {
      // 3. Upload
      const url = await uploadToS3(file, s3);

      // 4. Swap URL
      const imgEl = inputRef.current.querySelector(`#${tempId}`);
      if (imgEl) {
        imgEl.setAttribute("src", url);
        imgEl.classList.remove("opacity-50");
        imgEl.removeAttribute("id"); // cleanup
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Upload failed: " + e.message);
      // Remove the failed image?
      const imgEl = inputRef.current.querySelector(`#${tempId}`);
      imgEl?.remove();
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith("image/")) {
        if (!s3) {
          toast.error("S3 not configured. Cannot upload image.");
          return;
        }
        const blobUrl = URL.createObjectURL(file);
        setModal(
          <ConfirmationDialog
            message={`Do you want to upload ${file.name} to your S3 bucket?`}
            onConfirm={async () => {
              setModal(null);
              await uploadPastedImage(file);
            }}
            onCancel={() => setModal(null)}
          >
            <img
              style={{
                border: "2px solid var(--text-color)",
                maxWidth: "80%",
                maxHeight: "300px",
                display: "block",
                margin: "1rem auto",
              }}
              src={blobUrl}
            ></img>
          </ConfirmationDialog>,
        );
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
    </>
  );
}
