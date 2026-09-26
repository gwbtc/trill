import type { Result } from "@/types/ui";

// IO methods never throw: they resolve to { ok } or { error }, and both
// are truthy, so `if (res)` can't detect a failure. Use this inside a
// try/catch to turn an { error } into a thrown Error.
export function unwrap<T>(res: Result<T>): T {
  if ("error" in res) throw new Error(res.error);
  return res.ok;
}
