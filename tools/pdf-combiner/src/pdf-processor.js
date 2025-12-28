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
 * Get thumbnail for a page (for preview)
 */
export async function getPageThumbnail(page, maxWidth = 150) {
  const viewport = page.getViewport({ scale: 1.0 });

  // Render at 3x resolution for sharp display and zoom
  const devicePixelRatio = 3;
  const scale = (maxWidth * devicePixelRatio) / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  // Set CSS size to display at 1x
  canvas.style.width = `${maxWidth}px`;
  canvas.style.height = `${(scaledViewport.height / devicePixelRatio)}px`;

  await page.render({
    canvasContext: context,
    viewport: scaledViewport
  }).promise;

  return canvas;
}
