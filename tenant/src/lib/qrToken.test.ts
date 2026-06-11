import { describe, expect, it } from 'vitest';
import { extractDeviceToken } from './qrToken';

const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // 32 hex chars (uuid4().hex shape)

describe('extractDeviceToken', () => {
  it('pulls the token out of a full https sticker URL', () => {
    expect(extractDeviceToken(`https://app.malika.uz/d/${TOKEN}`)).toBe(TOKEN);
  });

  it('handles a trailing slash after the token', () => {
    expect(extractDeviceToken(`https://app.malika.uz/d/${TOKEN}/`)).toBe(TOKEN);
  });

  it('handles a query string after the token', () => {
    expect(extractDeviceToken(`https://app.malika.uz/d/${TOKEN}?tgWebAppData=x`)).toBe(TOKEN);
  });

  it('accepts a bare 32-hex token (manual paste)', () => {
    expect(extractDeviceToken(TOKEN)).toBe(TOKEN);
  });

  it('trims surrounding whitespace', () => {
    expect(extractDeviceToken(`  ${TOKEN}  `)).toBe(TOKEN);
  });

  it('lowercases an uppercase token', () => {
    expect(extractDeviceToken(TOKEN.toUpperCase())).toBe(TOKEN);
  });

  it('rejects a too-short token', () => {
    expect(extractDeviceToken('deadbeef')).toBeNull();
  });

  it('rejects a too-long (33-char) token', () => {
    expect(extractDeviceToken(`${TOKEN}f`)).toBeNull();
  });

  it('rejects a non-hex string of the right length', () => {
    expect(extractDeviceToken('z'.repeat(32))).toBeNull();
  });

  it('rejects an unrelated URL with no /d/ segment', () => {
    expect(extractDeviceToken('https://app.malika.uz/stock/42')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractDeviceToken('')).toBeNull();
    expect(extractDeviceToken('   ')).toBeNull();
  });
});
