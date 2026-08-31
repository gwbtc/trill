export function getFocusWrapTarget(
  currentIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number | null {
  if (focusableCount <= 0) return null;
  if (shiftKey && currentIndex <= 0) return focusableCount - 1;
  if (!shiftKey && currentIndex >= focusableCount - 1) return 0;
  return null;
}
