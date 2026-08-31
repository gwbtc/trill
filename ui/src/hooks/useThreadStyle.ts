import { useEffect, useState } from "react";

export type ThreadStyle = "nested" | "linear";

export const THREAD_STYLE_EVENT = "trill-thread-style-change";
const THREAD_STYLE_KEY = "trill-thread-style";

export function normalizeThreadStyle(value: string | null): ThreadStyle {
  return value === "linear" ? "linear" : "nested";
}

function readThreadStyle(): ThreadStyle {
  if (typeof window === "undefined") return "nested";
  return normalizeThreadStyle(window.localStorage.getItem(THREAD_STYLE_KEY));
}

export function persistThreadStyle(value: ThreadStyle) {
  window.localStorage.setItem(THREAD_STYLE_KEY, value);
  window.dispatchEvent(new Event(THREAD_STYLE_EVENT));
}

export function useThreadStyle(): ThreadStyle {
  const [threadStyle, setThreadStyle] = useState<ThreadStyle>(readThreadStyle);

  useEffect(() => {
    function updateThreadStyle() {
      setThreadStyle(readThreadStyle());
    }

    window.addEventListener("storage", updateThreadStyle);
    window.addEventListener(THREAD_STYLE_EVENT, updateThreadStyle);
    return () => {
      window.removeEventListener("storage", updateThreadStyle);
      window.removeEventListener(THREAD_STYLE_EVENT, updateThreadStyle);
    };
  }, []);

  return threadStyle;
}
