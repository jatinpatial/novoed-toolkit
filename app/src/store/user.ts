/**
 * Local user profile (Track-H, polish-19a).
 *
 * BCG U Studio runs entirely on the LD's machine — no cloud, no
 * sign-up, no auth backend. The "user" is just a name + a join
 * timestamp the WelcomeModal collects on first visit and persists
 * to localStorage. TopBar reads it for the initials avatar +
 * "Welcome back, <name>" affordance.
 *
 * Privacy contract: the name never leaves the LD's browser. Help
 * drawer copy reinforces this so LDs feel safe naming themselves.
 *
 * Schema versioning (`version` field) is here for future migrations
 * — when we add fields like preferred default brand or saved
 * shortcuts, old records get a defaultable upgrade path. The
 * legacy hasSeenWelcome flag (bcgu_studio_welcome_seen_v1) stays
 * separate; deleting the user clears both.
 */
export interface StudioUser {
  name: string;
  joinedAt: number;
  version: 1;
}

const KEY = "studio.user";

export function getUser(): StudioUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioUser;
    // Defensive: ignore records without a name. A future migration
    // would handle version mismatches; for now v1 is the only shape.
    if (!parsed || typeof parsed.name !== "string" || parsed.name.trim() === "") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveUser(name: string): StudioUser {
  const user: StudioUser = {
    name: name.trim(),
    joinedAt: Date.now(),
    version: 1,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent("studio-user-changed"));
  } catch {
    /* ignore — privacy mode etc. */
  }
  return user;
}

export function clearUser(): void {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("studio-user-changed"));
  } catch {
    /* ignore */
  }
}

export function subscribeUser(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("studio-user-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("studio-user-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

/**
 * Initials helper for the TopBar avatar — first letter of first name +
 * first letter of last name (when present). "Jatin Patial" → "JP";
 * single-name "Jatin" → "J".
 */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
