/**
 * Text sanitizer for proper UTF-8 and emoji handling
 * Removes problematic characters, ensures proper encoding
 */

/** Sanitize text input - remove null bytes, control chars, keep emoji & Thai */
export const sanitizeText = (text: string | undefined | null): string => {
  if (!text) return '';
  
  // Remove null bytes and control characters (except newlines/tabs)
  return text
    .replace(/\0/g, '')  // Null bytes
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Control chars
    .trim();
};

/** Keep emoji but remove surrogates and invalid sequences */
export const sanitizeReason = (reason: string): string => {
  if (!reason) return '';
  
  // Remove surrogates but keep valid emoji
  const sanitized = reason
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '') // Unpaired high surrogates
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') // Unpaired low surrogates
    .replace(/\uFFFD/g, '')  // Replacement char
    .trim();
  
  return sanitized.slice(0, 500); // Max 500 chars
};

/** Encode text for safe database storage */
export const encodeForDB = (text: string): string => {
  return sanitizeText(text).replace(/'/g, "''"); // Escape single quotes for SQL
};

/** Decode from database (if needed) */
export const decodeFromDB = (text: string): string => {
  return text?.replace(/''/g, "'") || '';
};
