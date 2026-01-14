/**
 * Main application logic
 */

import { loadPDF } from './pdf-processor.js';
import { analyzePDF, generateSplitPDFs } from './pdf-splitter.js';
import { t } from '../../../i18n.js';

// State
let currentPDF = null;
let currentFile = null;
let detectedSplits = [];
let generatedPDFs = [];
let thumbnailCache = {}; // Cache thumbnails by page number

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const processing = document.getElementById('processing');
const previewSection = document.getElementById('previewSection');
const splitsList = document.getElementById('splitsList');
const stats = document.getElementById('stats');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const errorMessage = document.getElementById('errorMessage');
const baseFilenameInput = document.getElementById('baseFilename');
const ensembleTypeSelect = document.getElementById('ensembleType');

// Setup event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
downloadAllBtn.addEventListener('click', downloadAll);
downloadZipBtn.addEventListener('click', downloadAllAsZip);
baseFilenameInput.addEventListener('change', handleFilenameChange);

/**
 * Handle file selection
 */
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    await processPDF(file);
  }
}

/**
 * Handle drag over
 */
function handleDragOver(event) {
  event.preventDefault();
  uploadArea.classList.add('dragover');
}

/**
 * Handle drag leave
 */
function handleDragLeave(event) {
  event.preventDefault();
  uploadArea.classList.remove('dragover');
}

/**
 * Handle file drop
 */
function handleDrop(event) {
  event.preventDefault();
  uploadArea.classList.remove('dragover');

  const file = event.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    fileInput.files = event.dataTransfer.files;
    processPDF(file);
  }
}

/**
 * Process the uploaded PDF
 */
async function processPDF(file) {
  try {
    // Reset state
    hideError();
    previewSection.classList.remove('active');
    processing.classList.add('active');
    thumbnailCache = {}; // Clear thumbnail cache for new PDF

    currentFile = file;

    // Load PDF
    currentPDF = await loadPDF(file);

    // Analyze and detect instruments with progress callback
    const progressCallback = ({ useOCR, currentPage, total }) => {
      const processingEl = document.querySelector('#processing p');
      if (useOCR && currentPage) {
        processingEl.textContent = `Using OCR to detect instruments... Page ${currentPage} of ${total}`;
      } else if (useOCR) {
        processingEl.textContent = `No text layer detected. Preparing OCR...`;
      } else {
        processingEl.textContent = 'Processing PDF and detecting instruments...';
      }
    };

    // Get selected ensemble type
    const instrumentSetKey = ensembleTypeSelect.value || 'brass-band';

    detectedSplits = await analyzePDF(currentPDF, progressCallback, instrumentSetKey);

    // Update message for PDF generation
    document.querySelector('#processing p').textContent = 'Generating split PDFs...';

    // Generate split PDFs
    generatedPDFs = await generateSplitPDFs(file, detectedSplits);

    // Set default base filename (from original file)
    const defaultFilename = file.name.replace(/\.pdf$/i, '');
    baseFilenameInput.value = defaultFilename;

    // Show preview
    displayPreview();

    processing.classList.remove('active');
    previewSection.classList.add('active');

  } catch (error) {
    console.error('Error processing PDF:', error);
    processing.classList.remove('active');
    showError('Failed to process PDF: ' + error.message);
  }
}

/**
 * Display preview of detected splits
 */
function displayPreview() {
  // Update stats
  stats.innerHTML = `
    Found <strong>${detectedSplits.length}</strong> instrument parts in
    <strong>${currentPDF.numPages}</strong> pages
  `;

  // Clear previous splits
  splitsList.innerHTML = '';

  // Display each split
  detectedSplits.forEach(async (split, index) => {
    const splitItem = document.createElement('div');
    splitItem.className = 'split-item';

    const pageRange = split.startPage === split.endPage
      ? `Page ${split.startPage}`
      : `Pages ${split.startPage}-${split.endPage}`;

    const pageCount = split.pages.length;
    const pageLabel = pageCount === 1 ? 'page' : 'pages';

    const isFirst = index === 0;
    const isLast = index === detectedSplits.length - 1;
    const canSplit = pageCount > 1;

    splitItem.innerHTML = `
      <div class="split-thumbnail" id="thumbnail-${index}">
        <div style="padding: 4rem 2rem; text-align: center; color: #999;">Loading...</div>
      </div>
      <div class="split-info">
        <div class="split-header">
          <input
            type="text"
            value="${split.instrument}"
            data-split-index="${index}"
            placeholder="Instrument name"
          />
          <button class="btn-small btn-secondary btn-download-single" onclick="window.downloadSingle(${index})" title="${t('common.download')}">
            ${t('common.download')}
          </button>
        </div>
        <div class="split-pages">${pageRange} (${pageCount} ${pageLabel})</div>
      </div>
      <div class="split-actions">
        <button
          class="btn-small btn-merge"
          onclick="window.mergeWithPrevious(${index})"
          ${isFirst ? 'disabled' : ''}
          title="${t('splitter.merge.up')}"
        >
          ↑ ${t('splitter.merge.up')}
        </button>
        <button
          class="btn-small btn-merge"
          onclick="window.mergeWithNext(${index})"
          ${isLast ? 'disabled' : ''}
          title="${t('splitter.merge.down')}"
        >
          ↓ ${t('splitter.merge.down')}
        </button>
        <button
          class="btn-small btn-split"
          onclick="window.splitPages(${index})"
          ${!canSplit ? 'disabled' : ''}
          title="${t('splitter.split.pages')}"
        >
          ✂ ${t('splitter.split.pages')}
        </button>
        <button
          class="btn-small btn-delete"
          onclick="window.deleteSplit(${index})"
          title="${t('splitter.delete')}"
        >
          🗑 ${t('splitter.delete')}
        </button>
      </div>
    `;

    splitsList.appendChild(splitItem);

    // Generate thumbnail asynchronously
    generateThumbnail(split, index);
  });

  // Add event listeners for input changes
  const inputs = splitsList.querySelectorAll('input[data-split-index]');
  inputs.forEach(input => {
    input.addEventListener('change', handleInstrumentNameChange);
  });
}

/**
 * Generate thumbnail for a split
 */
async function generateThumbnail(split, index) {
  try {
    const pageNumber = split.startPage;
    const thumbnailDiv = document.getElementById(`thumbnail-${index}`);
    if (!thumbnailDiv) return;

    // Check if thumbnail is already cached
    if (thumbnailCache[pageNumber]) {
      // Reuse cached canvas by copying the image data
      const cached = thumbnailCache[pageNumber];
      const canvas = document.createElement('canvas');
      canvas.width = cached.width;
      canvas.height = cached.height;
      canvas.style.width = '100%';
      canvas.style.height = 'auto';

      const context = canvas.getContext('2d');
      context.drawImage(cached, 0, 0);

      thumbnailDiv.innerHTML = '';
      thumbnailDiv.appendChild(canvas);

      // Re-add zoom event listener
      addZoomListener(thumbnailDiv, canvas);
      return;
    }

    // Generate new thumbnail
    const page = await currentPDF.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });

    // Calculate scale to fit width - use larger size for better quality
    // Render at 3x resolution for sharp display and zoom
    const displayWidth = 500;  // CSS display width
    const devicePixelRatio = 3;
    const scale = (displayWidth * devicePixelRatio) / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Set CSS size to display at 1x
    canvas.style.width = '100%';
    canvas.style.height = 'auto';

    await page.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise;

    // Cache the canvas
    thumbnailCache[pageNumber] = canvas;

    // Replace loading text with canvas
    thumbnailDiv.innerHTML = '';
    thumbnailDiv.appendChild(canvas);

    // Add smart zoom origin adjustment
    addZoomListener(thumbnailDiv, canvas);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    const thumbnailDiv = document.getElementById(`thumbnail-${index}`);
    if (thumbnailDiv) {
      thumbnailDiv.innerHTML = '<div style="padding: 4rem 2rem; text-align: center; color: #999;">Error</div>';
    }
  }
}

/**
 * Add zoom listener to thumbnail
 */
function addZoomListener(thumbnailDiv, canvas) {
  thumbnailDiv.addEventListener('mouseenter', function() {
    const rect = canvas.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scaledWidth = rect.width * 3;
    const scaledHeight = rect.height * 3;
    const leftEdge = rect.left - (scaledWidth - rect.width) / 2;
    const rightEdge = rect.right + (scaledWidth - rect.width) / 2;
    const topEdge = rect.top - (scaledHeight - rect.height) / 2;
    const bottomEdge = rect.bottom + (scaledHeight - rect.height) / 2;

    let xOrigin = 'center';
    let yOrigin = 'center';

    if (leftEdge < 0) {
      xOrigin = 'left';
    } else if (rightEdge > viewportWidth) {
      xOrigin = 'right';
    }

    if (topEdge < 0) {
      yOrigin = 'top';
    } else if (bottomEdge > viewportHeight) {
      yOrigin = 'bottom';
    }

    canvas.style.transformOrigin = `${xOrigin} ${yOrigin}`;
  });
}

/**
 * Handle instrument name change
 */
function handleInstrumentNameChange(event) {
  const index = parseInt(event.target.dataset.splitIndex);
  const newName = event.target.value.trim();

  if (newName) {
    // Update the split
    detectedSplits[index].instrument = newName;

    // Regenerate the PDF with new name (no need to refresh display)
    regeneratePDFForSplit(index);
  }
}

/**
 * Handle base filename change
 */
async function handleFilenameChange() {
  // Regenerate all PDFs with new base filename
  for (let i = 0; i < detectedSplits.length; i++) {
    await regeneratePDFForSplit(i);
  }
}

/**
 * Regenerate a single split PDF with updated instrument name
 */
async function regeneratePDFForSplit(index) {
  try {
    const split = detectedSplits[index];
    const arrayBuffer = await currentFile.arrayBuffer();
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(
      pdfDoc,
      split.pages.map(p => p - 1)
    );

    copiedPages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    const baseFilename = baseFilenameInput.value.trim() || currentFile.name.replace(/\.pdf$/i, '');
    const filename = generateFilename(baseFilename, split.instrument);

    // Update the generated PDF
    generatedPDFs[index] = {
      filename,
      blob,
      split
    };
  } catch (error) {
    console.error('Error regenerating PDF:', error);
  }
}

/**
 * Generate filename from base and instrument name
 */
function generateFilename(base, instrument) {
  // Sanitize but preserve some capitalization
  const sanitized = instrument
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-');     // Collapse multiple hyphens

  return `${base}-${sanitized}.pdf`;
}

/**
 * Merge split with previous split
 */
window.mergeWithPrevious = async function(index) {
  if (index === 0) return;

  const currentSplit = detectedSplits[index];
  const previousSplit = detectedSplits[index - 1];

  // Combine pages - keep the previous split's name (the upper one)
  previousSplit.pages = [...previousSplit.pages, ...currentSplit.pages];
  previousSplit.endPage = currentSplit.endPage;

  // Remove current split
  detectedSplits.splice(index, 1);
  generatedPDFs.splice(index, 1);

  // Regenerate the merged PDF
  await regeneratePDFForSplit(index - 1);

  // Refresh display
  displayPreview();
};

/**
 * Merge split with next split
 */
window.mergeWithNext = async function(index) {
  if (index === detectedSplits.length - 1) return;

  const currentSplit = detectedSplits[index];
  const nextSplit = detectedSplits[index + 1];

  // Combine pages - keep the next split's name (the lower one)
  currentSplit.pages = [...currentSplit.pages, ...nextSplit.pages];
  currentSplit.endPage = nextSplit.endPage;
  currentSplit.instrument = nextSplit.instrument;

  // Remove next split
  detectedSplits.splice(index + 1, 1);
  generatedPDFs.splice(index + 1, 1);

  // Regenerate the merged PDF
  await regeneratePDFForSplit(index);

  // Refresh display
  displayPreview();
};

/**
 * Split a multi-page split into individual page splits
 */
window.splitPages = async function(index) {
  const split = detectedSplits[index];

  if (split.pages.length <= 1) return;

  // Create individual splits for each page
  const newSplits = split.pages.map(pageNum => ({
    instrument: split.instrument,
    startPage: pageNum,
    endPage: pageNum,
    pages: [pageNum]
  }));

  // Remove the original split and insert new ones
  detectedSplits.splice(index, 1, ...newSplits);

  // Remove the original PDF and add placeholders for new ones
  generatedPDFs.splice(index, 1, ...new Array(newSplits.length).fill(null));

  // Generate PDFs for each new split
  for (let i = 0; i < newSplits.length; i++) {
    await regeneratePDFForSplit(index + i);
  }

  // Refresh display
  displayPreview();
};

/**
 * Delete a split
 */
window.deleteSplit = function(index) {
  // Remove the split and its PDF
  detectedSplits.splice(index, 1);
  generatedPDFs.splice(index, 1);

  // Refresh display
  displayPreview();
};

/**
 * Download a single split PDF
 */
window.downloadSingle = function(index) {
  const pdf = generatedPDFs[index];
  downloadFile(pdf.blob, pdf.filename);
};

/**
 * Download all split PDFs
 */
async function downloadAll() {
  for (const pdf of generatedPDFs) {
    downloadFile(pdf.blob, pdf.filename);
    // Small delay to avoid browser blocking multiple downloads
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Download all split PDFs as a ZIP file
 */
async function downloadAllAsZip() {
  try {
    // Dynamically import JSZip
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;

    const zip = new JSZip();

    // Get current base filename from input
    const baseFilename = baseFilenameInput.value.trim() || currentFile.name.replace(/\.pdf$/i, '');

    // Add each PDF to the zip with current instrument names
    for (let i = 0; i < generatedPDFs.length; i++) {
      const pdf = generatedPDFs[i];
      const split = detectedSplits[i];

      // Generate filename with current instrument name (from input field)
      const filename = generateFilename(baseFilename, split.instrument);
      zip.file(filename, pdf.blob);
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Download the zip
    downloadFile(zipBlob, `${baseFilename}-all-parts.zip`);
  } catch (error) {
    console.error('Error creating ZIP:', error);
    showError('Failed to create ZIP file: ' + error.message);
  }
}

/**
 * Trigger file download
 */
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('active');
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.remove('active');
}
