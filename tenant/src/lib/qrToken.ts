/**
 * Parse a device QR token out of whatever the camera scanned.
 *
 * Stickers encode `{BOT_WEBAPP_URL}/d/{token}` where `token` is a 32-char
 * hex string (`uuid4().hex` on the backend). A scan can therefore yield a
 * full URL, a URL with a trailing slash / query string, or — when a user
 * pastes manually — the bare token. Anything that doesn't contain a valid
 * 32-hex token returns `null` so the scan page can show "не распознан".
 */

const TOKEN_RE = /\/d\/([0-9a-fA-F]{32})\b/;
const BARE_TOKEN_RE = /^[0-9a-fA-F]{32}$/;

export function extractDeviceToken(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  const inUrl = s.match(TOKEN_RE);
  if (inUrl) return inUrl[1].toLowerCase();

  if (BARE_TOKEN_RE.test(s)) return s.toLowerCase();

  return null;
}
