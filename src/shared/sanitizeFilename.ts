/**
 * Strips control characters, non-ASCII, quotes and backslashes from a filename
 * to prevent HTTP header injection via Content-Disposition.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\x20-\x7E]/g, '')  // strip non-printable-ASCII and control chars
    .replace(/["\\]/g, '_')         // replace quotes and backslashes
    .trim() || 'download'           // fallback if empty after sanitisation
}
