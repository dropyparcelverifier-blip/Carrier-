import { getRequestEvent } from "$app/server";

/**
 * The hostname of the request being served, or null outside one.
 *
 * Its own module so the session check can learn which host it is on
 * without every guard and route changing signature, and so tests can
 * mock it.
 */
export function currentHost(): string | null {
  try {
    return getRequestEvent().url.hostname || null;
  } catch {
    return null;
  }
}
