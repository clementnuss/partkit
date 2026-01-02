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
    .replace(/\bLst\b/g, '1st')    // "Lst" → "1st"
    .replace(/ü/g, 'u')            // "Flügelhorn" → "Flugelhorn"
    .replace(/ö/g, 'o')            // Handle other umlauts
    .replace(/ä/g, 'a');           // Handle other umlauts

  // Look for instrument name anywhere in the text
  const firstPart = cleanText.substring(0, 200);

  // Strategy: Search for instrument keywords anywhere in the text
  const instrumentKeywords = /soprano|cornet|horn|baritone|trombone|euphonium|bass|tuba|percussion|timpani|flugel|repiano/i;

  // Split into lines and search each line
  const lines = firstPart.split('\n').map(l => l.trim());

  for (const line of lines) {
    if (instrumentKeywords.test(line)) {
      // Found a line with an instrument keyword
      // Extract the instrument part from this line

      // Try to extract instrument name with optional prefix (Eb, Bb, 1st, etc.)
      const patterns = [
        // "Eb Soprano" or "Bb Solo Cornets"
        /([A-Z]b\s+)?(\d+(?:st|nd|rd|th)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
        // Just the instrument
        /(\d+(?:st|nd|rd|th)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match && instrumentKeywords.test(match[0])) {
          // Extract the full match and clean it up
          let extracted = match[0]
            .replace(/\s*(Written|for|Funk|Better|Championships|Concert|Liam|Arranged|Pat|Metheny).*/, '')
            .trim();

          if (extracted.length > 2 && extracted.length < 40) {
            // First try exact match
            const normalizedExtracted = normalizeInstrumentName(extracted);
            const exactMatch = BRASS_BAND_INSTRUMENTS.find(
              instrument => normalizeInstrumentName(instrument) === normalizedExtracted
            );

            if (exactMatch) {
              return exactMatch;
            }

            // Return the extracted name if it contains an instrument keyword
            if (instrumentKeywords.test(extracted)) {
              return extracted.replace(/\s+/g, ' ').trim();
            }
          }
        }
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
