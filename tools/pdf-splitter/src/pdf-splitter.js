/**
 * PDF splitting logic
 */

import { PDFDocument } from 'pdf-lib';
import { extractInstrumentNameFromPage } from './pdf-processor.js';
import { detectInstrument, sanitizeInstrumentName } from './instrument-detector.js';

/**
 * Analyze a PDF and detect instrument splits
 * @param {PDFDocumentProxy} pdfDoc - PDF.js document
 * @returns {Promise<Array>} Array of splits: [{instrument, startPage, endPage, pages: []}]
 */
export async function analyzePDF(pdfDoc) {
  const splits = [];
  let currentInstrument = null;
  let currentSplit = null;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const text = await extractInstrumentNameFromPage(page);
    const detectedInstrument = detectInstrument(text);

    // Debug logging - show all pages
    // if (detectedInstrument) {
    //   console.log(`📄 Page ${pageNum}: ✓ "${detectedInstrument}"`);
    // } else {
    //   console.log(`📄 Page ${pageNum}: ✗ No instrument (extracted: "${text}")`);
    // }

    // Decision logic:
    // 1. If we detect an instrument name, ALWAYS start a new split (even if same as current)
    // 2. If no instrument detected, continue current split
    // 3. If no instrument detected and no current split, create "Unknown" split

    if (detectedInstrument) {
      // Detected an instrument name on this page

      // Check if this is actually a NEW split (different instrument or first occurrence)
      const isNewSplit = !currentInstrument || detectedInstrument !== currentInstrument;

      if (isNewSplit) {
        // Save previous split if exists
        if (currentSplit) {
          currentSplit.endPage = pageNum - 1;
          splits.push(currentSplit);
        }

        // Start new split
        currentInstrument = detectedInstrument;
        currentSplit = {
          instrument: detectedInstrument,
          startPage: pageNum,
          endPage: pageNum,
          pages: [pageNum]
        };
      } else {
        // Same instrument detected - this means the instrument name repeats
        // (e.g., "1st Euphonium" appears on multiple consecutive pages)
        // Continue the current split
        currentSplit.pages.push(pageNum);
        currentSplit.endPage = pageNum;
      }
    } else {
      // No instrument detected on this page
      if (currentSplit) {
        // Continue current split
        currentSplit.pages.push(pageNum);
        currentSplit.endPage = pageNum;
      } else {
        // No instrument detected and no current split - create "Unknown" split
        currentInstrument = 'Unknown';
        currentSplit = {
          instrument: 'Unknown',
          startPage: pageNum,
          endPage: pageNum,
          pages: [pageNum]
        };
      }
    }
  }

  // Don't forget the last split
  if (currentSplit) {
    splits.push(currentSplit);
  }

  // Summary
  console.log('\n📊 Split Summary:');
  splits.forEach((split, idx) => {
    const pageCount = split.pages.length;
    const pageRange = split.startPage === split.endPage
      ? `page ${split.startPage}`
      : `pages ${split.startPage}-${split.endPage}`;
    console.log(`  ${idx + 1}. ${split.instrument} (${pageRange}, ${pageCount} page${pageCount > 1 ? 's' : ''})`);
  });

  return splits;
}

/**
 * Generate split PDFs from the original PDF
 * @param {File} originalFile - Original PDF file
 * @param {Array} splits - Array of splits from analyzePDF
 * @returns {Promise<Array>} Array of {filename, blob} objects
 */
export async function generateSplitPDFs(originalFile, splits) {
  const arrayBuffer = await originalFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  const results = [];
  const baseFilename = originalFile.name.replace(/\.pdf$/i, '');

  for (const split of splits) {
    const newPdf = await PDFDocument.create();

    // Copy pages for this split
    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      split.pages.map(p => p - 1) // pdf-lib uses 0-based indexing
    );

    copiedPages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    // Generate filename preserving capitalization
    const sanitizedInstrument = split.instrument
      .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-');     // Collapse multiple hyphens

    const filename = `${baseFilename}-${sanitizedInstrument}.pdf`;

    results.push({
      filename,
      blob,
      split
    });
  }

  return results;
}
