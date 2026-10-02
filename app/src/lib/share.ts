/**
 * Helpers for getting a second reader into a room. A Rashomon room is only
 * useful when two people read the same thing, so every path in here exists to
 * shorten "I found an article" to "my friend is reading it with me".
 */

/** Only same-site paths are allowed after login, so `next` can't become an open redirect. */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

/** Reads `?url=` from a dashboard query string and returns it only if it is an http(s) URL. */
export function parseDeepLinkUrl(search: string): string | null {
  const raw = new URLSearchParams(search).get('url');
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** The link someone sends a friend so they land in the same reading room. */
export function inviteUrl(origin: string, contentId: string): string {
  return `${origin.replace(/\/$/, '')}/reading/${encodeURIComponent(contentId)}`;
}

/** A bookmarklet that opens the current page in Rashomon's import flow. */
export function bookmarkletHref(origin: string): string {
  const target = `${origin.replace(/\/$/, '')}/dashboard?url=`;
  return `javascript:(()=>{location.href=${JSON.stringify(target)}+encodeURIComponent(location.href)})()`;
}
