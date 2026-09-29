// AI model providers, kept by %trill-ai-client (backend/app/trill-ai-client.hoon):
// a name we choose, a base url, and a key the agent never sends back

// evalUrl: where evaluations (Jev) go; null: <baseUrl>/systemone
export type AiProvider = { name: string; baseUrl: string; evalUrl: string | null; hasKey: boolean };
export type AiSuggestion = { name: string; baseUrl: string; evalUrl: string | null };

export function parseProviders(x: unknown): AiProvider[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter(
      (p): p is AiProvider =>
        typeof p?.name === "string" && typeof p?.baseUrl === "string",
    )
    .map((p) => ({
      name: p.name,
      baseUrl: p.baseUrl,
      evalUrl: typeof p.evalUrl === "string" ? p.evalUrl : null,
      hasKey: p.hasKey === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function parseSuggestions(x: unknown): AiSuggestion[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((s) => typeof s?.name === "string" && typeof s?.baseUrl === "string")
    .map((s) => ({
      name: s.name,
      baseUrl: s.baseUrl,
      evalUrl: typeof s.evalUrl === "string" ? s.evalUrl : null,
    }));
}

// the same rules the agent applies: a name is a @tas, a url is http(s)
export function providerNameProblem(name: string): string | null {
  if (!name) return "Give it a name";
  if (!/^[a-z][a-z0-9-]*$/.test(name))
    return "Lowercase letters, digits and dashes, starting with a letter";
  return null;
}

export function baseUrlProblem(url: string, what = "base url"): string | null {
  const u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^/\s]/.test(u)) return `The ${what} must start with http:// or https://`;
  if (/\s/.test(u)) return `The ${what} can't contain spaces`;
  return null;
}
