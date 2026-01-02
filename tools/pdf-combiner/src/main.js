/**
 * PDF Page Combiner - Main application logic
 */

import { loadPDF, getPageThumbnail } from './pdf-processor.js';
import { combinePDFPages, calculatePairings } from './pdf-combiner.js';
import { t } from '../../../i18n.js';

// State
let uploadedPDFs = []; // {name, pdfDoc, file, firstPageAlone, pairings, combinedPDF}
let globalCropMargins = false;
let globalCropPercent = 5;
let thumbnailCache = {}; // Cache thumbnails by "pdfIndex-pageNumber" key

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const processing = document.getElementById('processing');
const previewSection = document.getElementById('previewSection');
const pdfsList = document.getElementById('pdfsList');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const errorMessage = document.getElementById('errorMessage');

// Setup event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
downloadAllBtn.addEventListener('click', downloadAll);
downloadZipBtn.addEventListener('click', downloadAllAsZip);

/**
 * Handle file selection
 */
async function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  await processFiles(files);
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
async function handleDrop(event) {
  event.preventDefault();
  uploadArea.classList.remove('dragover');

  const files = Array.from(event.dataTransfer.files);
  await processFiles(files);
}

// Store original ZIP filename (without extension)
let originalZipFilename = null;

/**
 * Process uploaded files (PDFs or ZIP)
 */
async function processFiles(files) {
  try {
    hideError();
    previewSection.classList.remove('active');
    processing.classList.add('active');

    uploadedPDFs = [];
    originalZipFilename = null;
    thumbnailCache = {}; // Clear thumbnail cache for new files

    for (const file of files) {
      if (file.name.endsWith('.zip')) {
        // Handle ZIP file - store its name for later
        if (!originalZipFilename) {
          originalZipFilename = file.name.replace(/\.zip$/i, '');
        }
        const pdfFiles = await extractPDFsFromZip(file);
        for (const pdfFile of pdfFiles) {
          await processPDF(pdfFile);
        }
      } else if (file.type === 'application/pdf') {
        // Handle PDF file
        await processPDF(file);
      }
    }

    if (uploadedPDFs.length === 0) {
      throw new Error('No PDF files found');
    }

    // Set ZIP filename input to original ZIP name if available
    const zipFilenameInput = document.getElementById('zipFilename');
    if (originalZipFilename) {
      zipFilenameInput.value = originalZipFilename;
    }

    // Generate combined PDFs for all
    for (let i = 0; i < uploadedPDFs.length; i++) {
      await generateCombinedPDF(i);
    }

    displayPreview();

    processing.classList.remove('active');
    previewSection.classList.add('active');

  } catch (error) {
    console.error('Error processing files:', error);
    processing.classList.remove('active');
    showError('Failed to process files: ' + error.message);
  }
}

/**
 * Extract PDF files from ZIP
 */
async function extractPDFsFromZip(zipFile) {
  const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;

  const zip = await JSZip.loadAsync(zipFile);
  const pdfFiles = [];

  for (const [filename, file] of Object.entries(zip.files)) {
    if (!file.dir && filename.endsWith('.pdf')) {
      const blob = await file.async('blob');
      const pdfFile = new File([blob], filename, { type: 'application/pdf' });
      pdfFiles.push(pdfFile);
    }
  }

  return pdfFiles;
}

/**
 * Process a single PDF file
 */
async function processPDF(file) {
  const pdfDoc = await loadPDF(file);

  const pdfData = {
    name: file.name,
    pdfDoc,
    file,
    firstPageAlone: false,
    pairings: calculatePairings(pdfDoc.numPages, false),
    combinedPDF: null
  };

  uploadedPDFs.push(pdfData);
}

/**
 * Display preview of all PDFs and their pairings
 */
function displayPreview() {
  pdfsList.innerHTML = '';

  uploadedPDFs.forEach((pdf, index) => {
    const pdfItem = document.createElement('div');
    pdfItem.className = 'pdf-item';

    const toggleClass = pdf.firstPageAlone ? 'active' : '';
    const toggleText = pdf.firstPageAlone ? '✓ ' + t('combiner.first.alone') : t('combiner.first.alone');

    pdfItem.innerHTML = `
      <div class="pdf-header">
        <div class="pdf-name">${pdf.name}</div>
        <div class="pdf-controls">
          <button
            class="btn-small btn-toggle ${toggleClass}"
            onclick="window.toggleFirstPageAlone(${index})"
          >
            ${toggleText}
          </button>
          <button
            class="btn-small"
            onclick="window.downloadSingle(${index})"
          >
            ${t('common.download')}
          </button>
        </div>
      </div>
      <div class="page-pairs" id="pairs-${index}"></div>
    `;

    pdfsList.appendChild(pdfItem);

    // Generate thumbnails for each pairing
    renderPairings(pdf, index);
  });
}

/**
 * Render page pairings with thumbnails
 */
async function renderPairings(pdf, pdfIndex) {
  const pairsContainer = document.getElementById(`pairs-${pdfIndex}`);
  pairsContainer.innerHTML = '';

  for (let i = 0; i < pdf.pairings.length; i++) {
    const pairing = pdf.pairings[i];

    const pairDiv = document.createElement('div');
    pairDiv.className = 'page-pair';

    const label = pairing.length === 1
      ? `Page ${pairing[0]}`
      : `Pages ${pairing[0]} + ${pairing[1]}`;

    pairDiv.innerHTML = `
      <div class="pair-label">${label}</div>
      <div class="pair-thumbnails" id="thumbnails-${pdfIndex}-${i}"></div>
    `;

    pairsContainer.appendChild(pairDiv);

    // Generate thumbnails
    const thumbnailsDiv = document.getElementById(`thumbnails-${pdfIndex}-${i}`);
    for (const pageNum of pairing) {
      const cacheKey = `${pdfIndex}-${pageNum}`;
      let canvas;

      // Check if thumbnail is already cached
      if (thumbnailCache[cacheKey]) {
        // Reuse cached canvas by copying the image data
        const cached = thumbnailCache[cacheKey];
        canvas = document.createElement('canvas');
        canvas.width = cached.width;
        canvas.height = cached.height;
        canvas.style.width = '150px';
        canvas.style.height = 'auto';

        const context = canvas.getContext('2d');
        context.drawImage(cached, 0, 0);
      } else {
        // Generate new thumbnail
        const page = await pdf.pdfDoc.getPage(pageNum);
        canvas = await getPageThumbnail(page, 150);

        // Cache the canvas
        thumbnailCache[cacheKey] = canvas;
      }

      const container = document.createElement('div');
      container.className = 'thumbnail-container';
      container.appendChild(canvas);

      // Add crop overlay if cropping is enabled
      if (globalCropMargins) {
        const overlay = document.createElement('div');
        overlay.className = 'crop-overlay';

        // Crop all 4 edges
        overlay.style.top = `${globalCropPercent}%`;
        overlay.style.left = `${globalCropPercent}%`;
        overlay.style.right = `${globalCropPercent}%`;
        overlay.style.bottom = `${globalCropPercent}%`;

        container.appendChild(overlay);
      }

      // Add smart zoom origin adjustment
      container.addEventListener('mouseenter', function() {
        const rect = canvas.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const scaledWidth = rect.width * 3;
        const leftEdge = rect.left - (scaledWidth - rect.width) / 2;
        const rightEdge = rect.right + (scaledWidth - rect.width) / 2;

        if (leftEdge < 0) {
          canvas.style.transformOrigin = 'left center';
        } else if (rightEdge > viewportWidth) {
          canvas.style.transformOrigin = 'right center';
        } else {
          canvas.style.transformOrigin = 'center';
        }
      });

      thumbnailsDiv.appendChild(container);
    }
  }
}

/**
 * Toggle first page alone mode
 */
window.toggleFirstPageAlone = async function(index) {
  const pdf = uploadedPDFs[index];
  pdf.firstPageAlone = !pdf.firstPageAlone;
  pdf.pairings = calculatePairings(pdf.pdfDoc.numPages, pdf.firstPageAlone);

  // Regenerate combined PDF
  await generateCombinedPDF(index);

  // Refresh display
  displayPreview();
};

/**
 * Toggle global crop margins mode
 */
window.toggleGlobalCropMargins = async function() {
  globalCropMargins = !globalCropMargins;

  // Enable/disable crop percentage input
  document.getElementById('globalCropPercent').disabled = !globalCropMargins;

  // Regenerate all PDFs
  for (let i = 0; i < uploadedPDFs.length; i++) {
    await generateCombinedPDF(i);
  }

  // Refresh display to show/hide crop overlays
  displayPreview();
};

/**
 * Update global crop percentage
 */
window.updateGlobalCropPercent = async function(value) {
  globalCropPercent = parseFloat(value) || 5;

  // Regenerate all PDFs
  for (let i = 0; i < uploadedPDFs.length; i++) {
    await generateCombinedPDF(i);
  }

  // Refresh display to update crop overlays
  displayPreview();
};

/**
 * Generate combined PDF for a single PDF
 */
async function generateCombinedPDF(index) {
  const pdf = uploadedPDFs[index];
  const cropAmount = globalCropMargins ? globalCropPercent / 100 : 0;
  pdf.combinedPDF = await combinePDFPages(pdf.file, pdf.pairings, cropAmount);
}

/**
 * Download a single combined PDF
 */
window.downloadSingle = function(index) {
  const pdf = uploadedPDFs[index];
  const filename = pdf.name.replace(/\.pdf$/i, '-combined.pdf');
  downloadFile(pdf.combinedPDF, filename);
};

/**
 * Download all combined PDFs
 */
async function downloadAll() {
  for (const pdf of uploadedPDFs) {
    const filename = pdf.name.replace(/\.pdf$/i, '-combined.pdf');
    downloadFile(pdf.combinedPDF, filename);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Download all combined PDFs as ZIP
 */
async function downloadAllAsZip() {
  try {
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = new JSZip();

    for (const pdf of uploadedPDFs) {
      const filename = pdf.name.replace(/\.pdf$/i, '-combined.pdf');
      zip.file(filename, pdf.combinedPDF);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Get ZIP filename from input, default to 'combined-pdfs'
    const zipFilenameInput = document.getElementById('zipFilename');
    const zipFilename = (zipFilenameInput.value.trim() || 'combined-pdfs') + '.zip';

    downloadFile(zipBlob, zipFilename);
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
