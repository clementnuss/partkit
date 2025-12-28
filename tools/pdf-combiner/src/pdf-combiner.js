/**
 * PDF page combining logic
 */

import { PDFDocument } from 'pdf-lib';

/**
 * Calculate page pairings based on mode
 * @param {number} totalPages - Total number of pages in PDF
 * @param {boolean} firstPageAlone - Whether first page should be alone
 * @returns {Array<Array<number>>} Array of pairings, e.g. [[1,2], [3,4], [5]]
 */
export function calculatePairings(totalPages, firstPageAlone) {
  const pairings = [];

  if (firstPageAlone) {
    // First page alone: [1], [2,3], [4,5], [6,7]...
    pairings.push([1]);

    for (let i = 2; i <= totalPages; i += 2) {
      if (i + 1 <= totalPages) {
        pairings.push([i, i + 1]);
      } else {
        pairings.push([i]);
      }
    }
  } else {
    // Default pairing: [1,2], [3,4], [5,6]...
    for (let i = 1; i <= totalPages; i += 2) {
      if (i + 1 <= totalPages) {
        pairings.push([i, i + 1]);
      } else {
        pairings.push([i]);
      }
    }
  }

  return pairings;
}

/**
 * Combine PDF pages according to pairings
 * @param {File} originalFile - Original PDF file
 * @param {Array<Array<number>>} pairings - Array of page pairings
 * @param {number} cropPercent - Percentage to crop from each edge (0-1, e.g., 0.05 for 5%)
 * @returns {Promise<Blob>} Combined PDF as blob
 */
export async function combinePDFPages(originalFile, pairings, cropPercent = 0) {
  const arrayBuffer = await originalFile.arrayBuffer();
  const sourcePdf = await PDFDocument.load(arrayBuffer);

  const combinedPdf = await PDFDocument.create();

  for (const pairing of pairings) {
    if (pairing.length === 1) {
      // Single page - create landscape with page on the right
      const sourcePage = sourcePdf.getPage(pairing[0] - 1);
      const pageSize = sourcePage.getSize();

      // Calculate crop amounts
      const pageCropX = pageSize.width * cropPercent;
      const pageCropY = pageSize.height * cropPercent;
      const pageWidth = pageSize.width * (1 - 2 * cropPercent);
      const pageHeight = pageSize.height * (1 - 2 * cropPercent);

      // Create a landscape page (double width)
      const combinedWidth = pageWidth * 2;
      const combinedHeight = pageHeight;

      const combinedPage = combinedPdf.addPage([combinedWidth, combinedHeight]);

      // Embed the page
      const embeddedPage = await combinedPdf.embedPage(sourcePage);

      // Draw the page on the right side
      combinedPage.drawPage(embeddedPage, {
        x: pageWidth - pageCropX,
        y: -pageCropY,
        width: pageSize.width,
        height: pageSize.height
      });
    } else {
      // Two pages - combine side by side
      // Get original pages from source
      const sourcePage1 = sourcePdf.getPage(pairing[0] - 1);
      const sourcePage2 = sourcePdf.getPage(pairing[1] - 1);

      const page1Size = sourcePage1.getSize();
      const page2Size = sourcePage2.getSize();

      // Calculate crop amounts
      const cropX = page1Size.width * cropPercent;
      const cropY = page1Size.height * cropPercent;

      // Crop all 4 edges using z-order trick:
      // - Right page drawn first (underneath)
      // - Left page drawn second (on top) - its right edge will overlap and hide right page's left margin

      const page1CroppedWidth = page1Size.width - 2 * cropX;
      const page2CroppedWidth = page2Size.width - 2 * cropX;
      const croppedHeight = page1Size.height - 2 * cropY;

      const combinedWidth = page1CroppedWidth + page2CroppedWidth;
      const combinedHeight = croppedHeight;

      const combinedPage = combinedPdf.addPage([combinedWidth, combinedHeight]);

      // Embed the pages
      const embeddedPage1 = await combinedPdf.embedPage(sourcePage1);
      const embeddedPage2 = await combinedPdf.embedPage(sourcePage2);

      // Draw RIGHT page FIRST (underneath everything)
      combinedPage.drawPage(embeddedPage2, {
        x: page1CroppedWidth - cropX,
        y: -cropY,
        width: page2Size.width,
        height: page2Size.height
      });

      // Draw white rectangle SECOND (covers right page's left margin)
      combinedPage.drawRectangle({
        x: page1CroppedWidth - cropX,
        y: 0,
        width: cropX,
        height: combinedHeight,
        color: { type: 'RGB', red: 1, green: 1, blue: 1 },
        opacity: 1
      });

      // Draw LEFT page THIRD
      combinedPage.drawPage(embeddedPage1, {
        x: -cropX,
        y: -cropY,
        width: page1Size.width,
        height: page1Size.height
      });

      // NOTE: Layer 4 white rectangle (to crop left page's right edge) is not needed
      // The left page extends beyond page1CroppedWidth, but at 5% crop it's acceptable

      // DEBUG: Uncomment to visualize layers
      // // Blue line: where layer 2 white rectangle is (right page's left margin)
      // combinedPage.drawRectangle({
      //   x: page1CroppedWidth - cropX,
      //   y: 0,
      //   width: 3,
      //   height: combinedHeight,
      //   color: { type: 'RGB', red: 0, green: 0, blue: 1 },
      //   opacity: 1
      // });
      //
      // // Yellow line: where layer 4 white rectangle would be (left page's right edge)
      // combinedPage.drawRectangle({
      //   x: page1CroppedWidth,
      //   y: 0,
      //   width: 3,
      //   height: combinedHeight,
      //   color: { type: 'RGB', red: 1, green: 1, blue: 0 },
      //   opacity: 1
      // });
      //
      // // Green line: where left page content should end
      // combinedPage.drawRectangle({
      //   x: page1CroppedWidth - 3,
      //   y: 0,
      //   width: 3,
      //   height: combinedHeight,
      //   color: { type: 'RGB', red: 0, green: 1, blue: 0 },
      //   opacity: 1
      // });

    }
  }

  const pdfBytes = await combinedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
