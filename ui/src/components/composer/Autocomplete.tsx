import { useMemo } from "react";
import { isValidPatp, isValidPatq } from "urbit-ob";
import type { UserProfile } from "@/types/nostrill";
import type { UrbitContacts } from "@/types/urbit";
import Avatar from "@/components/Avatar";
import { patpToFallbackUID } from "@/logic/gw";

// Feels overengineered to me but hey it works rather beautifully

export type AutoCompleteCandidate = {
  id: string;
  display: string;
  pic: string;
};

export function useAutocompleteCandidates(
  contacts: UrbitContacts,
  profiles: Map<string, UserProfile>,
  query: string | null,
) {
  // Pre-calculate all possible candidates to avoid doing this on every render/keystroke
  // This only runs when contacts or profiles change
  const allCandidates = useMemo(() => {
    const candidates: AutoCompleteCandidate[] = [];
    const seen = new Set<string>();

    // Search contacts
    if (contacts) {
      Object.entries(contacts).forEach(([ship, data]) => {
        if (data && !seen.has(ship)) {
          candidates.push({
            id: ship,
            display: data.nickname || ship,
            pic: data.avatar || "",
          });
          seen.add(ship);
        }
      });
    }

    // Search profiles
    if (profiles) {
      profiles.forEach((prof, key) => {
        if (!seen.has(key)) {
          candidates.push({
            id: key,
            display: prof.name || key,
            pic: prof.picture,
          });
          seen.add(key);
        }
      });
    }
    return candidates;
  }, [contacts, profiles]);

  // Filter candidates based on query
  const mentionCandidates = useMemo(() => {
    if (!query) return [];

    // Buckets for sorting
    let exactIdMatch: AutoCompleteCandidate | null = null;
    const exactDisplayMatches: AutoCompleteCandidate[] = [];
    const partialMatches: AutoCompleteCandidate[] = [];

    const MAX_CANDIDATES = 20;

    // Normalize query for ID matching (ensure ~)
    const qRaw = query.toLowerCase().trim();
    if (!qRaw) return [];

    const qPatp = qRaw.startsWith("~") ? qRaw : "~" + qRaw;

    for (const candidate of allCandidates) {
      const cId = candidate.id.toLowerCase();
      const cDisp = candidate.display.toLowerCase();

      // 1. Exact ID Match (Top Priority)
      if (cId === qPatp || cId === qRaw) {
        exactIdMatch = candidate;
        continue;
      }

      // 2. Exact Display Match (High Priority)
      if (cDisp === qRaw) {
        exactDisplayMatches.push(candidate);
        continue;
      }

      // 3. Partials
      // We only gather partials if we haven't exceeded a safe buffer for sorting
      if (partialMatches.length < 50) {
        const matchId = cId.includes(qRaw);
        const matchDisplay = cDisp.includes(qRaw);

        if (matchId || matchDisplay) {
          partialMatches.push(candidate);
        }
      }
    }

    // Sort partials: Shorter matches first (closeness), then alphabetical
    partialMatches.sort((a, b) => {
      // Preference 1: Starts with query (prefix match)
      const aStarts =
        a.id.toLowerCase().startsWith(qRaw) ||
        a.display.toLowerCase().startsWith(qRaw);
      const bStarts =
        b.id.toLowerCase().startsWith(qRaw) ||
        b.display.toLowerCase().startsWith(qRaw);
      if (aStarts && !bStarts) return -1;
      if (!bStarts && aStarts) return 1;

      // Preference 2: Shorter ID length (closest match)
      // e.g. ~docteg (7) vs ~hostyr-docteg (14)
      if (a.id.length !== b.id.length) return a.id.length - b.id.length;

      // Preference 3: Alphabetical
      return a.id.localeCompare(b.id);
    });

    // Construct final list
    const result: AutoCompleteCandidate[] = [];
    if (exactIdMatch) result.push(exactIdMatch);
    result.push(...exactDisplayMatches);
    result.push(...partialMatches);

    // Cap result
    const cappedResult = result.slice(0, MAX_CANDIDATES);

    // Final check: if exactIdMatch wasn't found in candidates, but q is valid patp, append/prepend logic?
    // User wants exact match on top. If it wasn't in candidates, we should inject it at TOP.
    if (!exactIdMatch) {
      try {
        // Check explicit qRaw (e.g. ~zod)
        if (isValidPatq(qRaw) || isValidPatp(qRaw)) {
          // Ensure we don't duplicate if it was a display match or partial
          if (!cappedResult.find((c) => c.id === qRaw)) {
            cappedResult.unshift({ id: qRaw, display: qRaw, pic: "" });
          }
        }
        // Check qPatp (e.g. zod -> ~zod)
        else if (qRaw !== qPatp && (isValidPatp(qPatp) || isValidPatq(qPatp))) {
          if (!cappedResult.find((c) => c.id === qPatp)) {
            cappedResult.unshift({ id: qPatp, display: qPatp, pic: "" });
          }
        }
      } catch (e) {
        // urbit-ob functions might throw on invalid input
      }
    }

    return cappedResult;
  }, [query, allCandidates]);

  return mentionCandidates;
}

type AutocompleteListProps = {
  candidates: AutoCompleteCandidate[];
  selectedIndex: number;
  onSelect: (user: AutoCompleteCandidate) => void;
};

export function AutocompleteList({
  candidates,
  selectedIndex,
  onSelect,
}: AutocompleteListProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="mention-autocomplete">
      {candidates.map((user, i) => (
        <div
          key={user.id}
          ref={
            i === selectedIndex
              ? (el) => el?.scrollIntoView({ block: "nearest" })
              : undefined
          }
          onClick={() => onSelect(user)}
          className={`mention-item ${i === selectedIndex ? "selected" : ""}`}
          style={{
            background:
              i === selectedIndex ? "var(--color-accent)" : "transparent",
            color: i === selectedIndex ? "white" : "var(--color-text)",
          }}
        >
          {!user.pic && user.id && user.id[0] === "~" ? (
            <Avatar
              user={{ urbit: patpToFallbackUID(user.id) }}
              size={24}
              customClass="flex-avatar"
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 500, fontSize: "0.9em" }}>
                {user.display}
              </span>
              {user.id !== user.display && (
                <span style={{ fontSize: "0.75em", opacity: 0.8 }}>
                  {user.id}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
