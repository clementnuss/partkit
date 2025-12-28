/**
 * Instrument name detection with fuzzy matching
 */

import Fuse from 'fuse.js';
import { BRASS_BAND_INSTRUMENTS, normalizeInstrumentName } from './instruments.js';

// Configure fuzzy search
const fuse = new Fuse(BRASS_BAND_INSTRUMENTS, {
  threshold: 0.3, // 0 = perfect match, 1 = match anything
  distance: 100,
  ignoreLocation: true,
  keys: ['name'],
  getFn: (obj) => normalizeInstrumentName(obj)
});

/**
 * Detect instrument name from extracted text
 * @param {string} text - Text extracted from page
 * @returns {string|null} Detected instrument name or null
 */
export function detectInstrument(text) {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Fix common OCR errors where digits are read as letters
  let cleanText = text.trim()
    .replace(/\bist\b/gi, '1st')   // "ist Trombone" → "1st Trombone"
    .replace(/\blst\b/gi, '1st')   // "lst Baritone" → "1st Baritone"
    .replace(/\bznd\b/gi, '2nd')   // "znd Horn" → "2nd Horn"
    .replace(/\bIst\b/g, '1st')    // "Ist" → "1st"
    .replace(/\bLst\b/g, '1st');   // "Lst" → "1st"

  // Look for instrument name - can be at start OR after "Written for..." etc.
  const firstPart = cleanText.substring(0, 100);

  // Pattern 1: Instrument name at the start (most common)
  // "1st Euphonium Written for..."
  let instrumentPattern = /^([\d\w]+(?:st|nd|rd|th)?\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(?:\d+|I{1,4}|IV)?\s*(?:Written|for|Funk|$)/i;
  let match = firstPart.match(instrumentPattern);

  // Pattern 2: Instrument name after "Written for..." or "Championships"
  // "Written for Hammonds Band for the 43rd Brass In Concert Championships 2nd Cornet Better"
  if (!match) {
    instrumentPattern = /(?:Championships|Concert)\s+([\d\w]+(?:st|nd|rd|th)?\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(?:\d+|I{1,4}|IV)?\s+(?:Better|Written|Liam)/i;
    match = firstPart.match(instrumentPattern);
  }

  if (match) {
    // Extract the matched instrument name
    let extracted = match[0]
      .replace(/\s*(Written|for|Funk|Better|Championships|Concert|Liam).*/, '')
      .replace(/^(Championships|Concert)\s+/, '')
      .trim();

    // Clean up the extracted text
    if (extracted.length > 2 && extracted.length < 30) {
      // First try exact match
      const normalizedExtracted = normalizeInstrumentName(extracted);
      const exactMatch = BRASS_BAND_INSTRUMENTS.find(
        instrument => normalizeInstrumentName(instrument) === normalizedExtracted
      );

      if (exactMatch) {
        return exactMatch;
      }

      // Check if it contains instrument keywords (including flugel)
      const instrumentKeywords = /cornet|horn|baritone|trombone|euphonium|bass|tuba|percussion|timpani|flugel/i;
      if (instrumentKeywords.test(extracted)) {
        // Clean up multiple whitespaces before returning
        return extracted.replace(/\s+/g, ' ').trim();
      }
    }
  }

  return null;
}

/**
 * Clean up detected instrument name for use in filename
 */
export function sanitizeInstrumentName(instrument) {
  return instrument
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
