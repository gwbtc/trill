// Images are attachments, never contenteditable nodes. Keep their markup after
// the text so display order and publication order agree.
export function serializeComposerContent(
  editor: HTMLElement | null,
  fallback: string,
  images: string[] = [],
) {
  const text = editor?.innerText ?? fallback;
  return [text.trimEnd(), ...images.map(url => `![](${url})`)].filter(Boolean).join("\n\n");
}

export function insertComposerText(text: string, editor?: HTMLElement | null) {
  // execCommand inserts at the current selection; if focus was
  // elsewhere (e.g. the emoji search input), put the caret at the
  // end of the editor first
  if (editor) {
    const sel = window.getSelection();
    const inEditor =
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.getRangeAt(0).startContainer);
    if (!inEditor) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
  document.execCommand("insertText", false, text);
}

// the caret, if it's inside `editor`; a dialog that takes focus loses it,
// so save it first and restore it before inserting
export function saveComposerCaret(editor: HTMLElement | null): Range | null {
  const sel = window.getSelection();
  if (!editor || !sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  return editor.contains(range.startContainer) ? range.cloneRange() : null;
}

// focus `editor` with `range` selected, or the caret at its end
export function restoreComposerCaret(editor: HTMLElement, range: Range | null) {
  editor.focus();
  const sel = window.getSelection();
  if (!sel) return;
  let target = range;
  if (!target || !editor.contains(target.startContainer)) {
    target = document.createRange();
    target.selectNodeContents(editor);
    target.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(target);
}
