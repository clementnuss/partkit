/**
 * PDF processing utilities using PDF.js
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Load a PDF file from a File object
 */
export async function loadPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
}

/**
 * Extract text from a specific region of a PDF page
 * @param {PDFPageProxy} page - The PDF page
 * @param {Object} region - Region to extract from {x, y, width, height} as percentages (0-1)
 * @returns {Promise<string>} Extracted text
 */
export async function extractTextFromRegion(page, region = { x: 0, y: 0, width: 0.3, height: 0.15 }) {
  const textContent = await page.getTextContent();

  // Find the actual Y coordinate range from text items
  const yCoords = textContent.items.map(item => item.transform[5]);
  const maxY = Math.max(...yCoords);
  const minY = Math.min(...yCoords);
  const yRange = maxY - minY;

  // Look at top of page - use absolute threshold instead of percentage
  // Instrument names are typically within 100 units of the top
  // This handles cases where pages have varying amounts of text
  const topThreshold = maxY - 100;

  // console.log(`Y range: min=${minY.toFixed(1)}, max=${maxY.toFixed(1)}, threshold=${topThreshold.toFixed(1)}`);

  // Filter text items in the top 15% (look across full width)
  const itemsInRegion = textContent.items.filter(item => {
    const y = item.transform[5];
    return y >= topThreshold;
  });

  // Sort by Y position (descending - top first), then by X position (ascending - left first)
  itemsInRegion.sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 5) { // Different lines (tolerance of 5 units)
      return yDiff;
    }
    // Same line, sort by X position (left to right)
    return a.transform[4] - b.transform[4];
  });

  // Take the leftmost text items (first few words on the topmost line)
  // Group items by Y position to find the topmost line
  // Use a tolerance of 5 units to group items on roughly the same line
  const lines = {};
  itemsInRegion.forEach(item => {
    const y = item.transform[5];
    // Find existing line within 5 units
    let foundLine = null;
    for (const lineY in lines) {
      if (Math.abs(parseFloat(lineY) - y) < 5) {
        foundLine = lineY;
        break;
      }
    }
    if (foundLine) {
      lines[foundLine].push(item);
    } else {
      lines[y] = [item];
    }
  });

  // Get the topmost line (highest Y)
  const topLine = Object.keys(lines)
    .map(Number)
    .sort((a, b) => b - a)[0];

  if (topLine && lines[topLine]) {
    // Sort items in the top line by X position (left to right)
    lines[topLine].sort((a, b) => a.transform[4] - b.transform[4]);

    // Debug: log individual text items with positions
    // console.log(`  Top line items (Y=${topLine}):`);
    // lines[topLine].forEach((item, idx) => {
    //   if (idx < 10) { // Only show first 10 items
    //     console.log(`    [${idx}] "${item.str}" at X=${item.transform[4].toFixed(1)}`);
    //   }
    // });

    // Strategy: Look for instrument keywords in the top line
    // Sometimes the instrument name is centered, not left-aligned
    const instrumentKeywords = /cornet|horn|baritone|trombone|euphonium|bass|tuba|percussion|timpani|flugel/i;

    // Find the first item that contains an instrument keyword
    // Remove punctuation from text before testing
    let instrumentStartIdx = -1;
    for (let i = 0; i < lines[topLine].length; i++) {
      const cleanStr = lines[topLine][i].str.replace(/[^\w\s]/g, ''); // Remove punctuation
      if (instrumentKeywords.test(cleanStr)) {
        instrumentStartIdx = i;
        break;
      }
    }

    // If we found an instrument keyword, extract from a few items before it
    if (instrumentStartIdx !== -1) {
      const startIdx = Math.max(0, instrumentStartIdx - 2); // Include up to 2 items before (e.g., "1st", "2nd")
      let instrumentText = '';
      for (let i = startIdx; i < lines[topLine].length && i <= instrumentStartIdx + 2; i++) {
        instrumentText += lines[topLine][i].str + ' ';
        if (instrumentText.length > 50) break;
      }
      const result = instrumentText
        .replace(/\s+/g, ' ')  // Collapse whitespace
        .replace(/[!?=]+/g, '')  // Remove punctuation like !, ?, =
        .trim();
      // console.log(`  → Extracted (instrument keyword found): "${result}"`);
      return result;
    }

    // Fallback: Take the leftmost items (up to first 50 characters)
    let leftmostText = '';
    for (const item of lines[topLine]) {
      leftmostText += item.str + ' ';
      if (leftmostText.length > 50) break;
    }

    // Clean up multiple consecutive whitespaces
    const result = leftmostText.replace(/\s+/g, ' ').trim();
    // console.log(`  → Extracted (leftmost): "${result}"`);
    return result;
  }

  // Fallback: join all text
  const textInRegion = itemsInRegion
    .map(item => item.str)
    .join(' ');

  // Clean up multiple consecutive whitespaces
  return textInRegion.replace(/\s+/g, ' ').trim();
}

/**
 * Extract text from top-left corner of a page (where instrument names typically are)
 */
export async function extractInstrumentNameFromPage(page) {
  // Check top-left region (30% width, 15% height from top)
  return await extractTextFromRegion(page, {
    x: 0,
    y: 0,
    width: 0.3,
    height: 0.15
  });
}

/**
 * Render a page to canvas for OCR (fallback when text extraction fails)
 */
export async function renderPageToCanvas(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return canvas;
}

/**
 * Get thumbnail for a page (for preview)
 */
export async function getPageThumbnail(page, maxWidth = 200) {
  const viewport = page.getViewport({ scale: 1.0 });
  const scale = maxWidth / viewport.width;
  return await renderPageToCanvas(page, scale);
}
