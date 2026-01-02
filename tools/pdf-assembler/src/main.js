/**
 * PDF Assembler - Main application logic
 */

import { PDFDocument } from 'pdf-lib';
import { t } from '../../../i18n.js';

// State
let uploadedPDFs = []; // [{name, pdfDoc, pageCount, replicas}]

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const processing = document.getElementById('processing');
const previewSection = document.getElementById('previewSection');
const pdfList = document.getElementById('pdfList');
const assembleBtn = document.getElementById('assembleBtn');
const errorMessage = document.getElementById('errorMessage');
const totalPages = document.getElementById('totalPages');
const outputFilename = document.getElementById('outputFilename');

// Setup event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
assembleBtn.addEventListener('click', assemblePDF);

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

/**
 * Process uploaded files (PDFs or ZIP)
 */
async function processFiles(files) {
  try {
    hideError();
    previewSection.classList.remove('active');
    processing.classList.add('active');

    uploadedPDFs = [];

    for (const file of files) {
      if (file.name.endsWith('.zip')) {
        // Handle ZIP file
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

    // Sort PDFs alphabetically by name
    uploadedPDFs.sort((a, b) => a.name.localeCompare(b.name));

    // Set output filename based on common prefix
    const commonPrefix = findCommonPrefix(uploadedPDFs.map(pdf => pdf.name));
    outputFilename.value = commonPrefix || 'assembled-parts';

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
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  uploadedPDFs.push({
    name: file.name,
    pdfDoc: pdfDoc,
    pageCount: pdfDoc.getPageCount(),
    replicas: 1 // Default to 1 replica
  });
}

/**
 * Find common prefix among filenames
 */
function findCommonPrefix(filenames) {
  if (filenames.length === 0) return '';
  if (filenames.length === 1) {
    // Return the filename without extension and instrument parts
    return filenames[0]
      .replace(/\.pdf$/i, '')
      .replace(/[-_](1st|2nd|3rd|solo|bass|cornet|horn|trombone|euphonium|tuba|percussion|flugelhorn|baritone|soprano|repiano).*$/i, '')
      .trim();
  }

  // Remove .pdf extension from all filenames
  const names = filenames.map(name => name.replace(/\.pdf$/i, ''));

  // Find common prefix
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    while (names[i].indexOf(prefix) !== 0 && prefix.length > 0) {
      prefix = prefix.substring(0, prefix.length - 1);
    }
    if (prefix.length === 0) break;
  }

  // Clean up the prefix - remove trailing dashes, underscores, or spaces
  prefix = prefix.replace(/[-_\s]+$/, '');

  // If prefix is too short or empty, try to find a meaningful word
  if (prefix.length < 3) {
    // Extract first word from first filename
    const firstWord = names[0].split(/[-_\s]/)[0];
    if (firstWord && firstWord.length >= 3) {
      return firstWord;
    }
    return 'assembled-parts';
  }

  return prefix;
}

/**
 * Display preview of all PDFs with replica controls
 */
function displayPreview() {
  pdfList.innerHTML = '';

  uploadedPDFs.forEach((pdf, index) => {
    const pdfItem = document.createElement('div');
    pdfItem.className = 'pdf-item';
    pdfItem.draggable = true;
    pdfItem.dataset.index = index;

    pdfItem.innerHTML = `
      <div class="drag-handle">⋮⋮</div>
      <div class="pdf-info">
        <div class="pdf-name">${pdf.name}</div>
        <div class="pdf-pages">(${pdf.pageCount} page${pdf.pageCount > 1 ? 's' : ''})</div>
      </div>
      <div class="replica-control">
        <label>${t('assembler.copies')}</label>
        <div class="replica-buttons">
          <button class="replica-button" onclick="window.decrementReplicas(${index})" ${pdf.replicas === 0 ? 'disabled' : ''}>−</button>
          <div class="replica-count" id="count-${index}" onclick="window.editReplicas(${index})">${pdf.replicas}</div>
          <button class="replica-button" onclick="window.incrementReplicas(${index})" ${pdf.replicas >= 99 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    `;

    // Add drag event listeners
    pdfItem.addEventListener('dragstart', handleItemDragStart);
    pdfItem.addEventListener('dragover', handleItemDragOver);
    pdfItem.addEventListener('drop', handleItemDrop);
    pdfItem.addEventListener('dragend', handleItemDragEnd);
    pdfItem.addEventListener('dragleave', handleItemDragLeave);

    pdfList.appendChild(pdfItem);
  });

  updateTotalPages();
}

/**
 * Increment replica count for a PDF
 */
window.incrementReplicas = function(index) {
  if (uploadedPDFs[index].replicas < 99) {
    uploadedPDFs[index].replicas++;
    updateReplicaDisplay(index);
  }
};

/**
 * Decrement replica count for a PDF
 */
window.decrementReplicas = function(index) {
  if (uploadedPDFs[index].replicas > 0) {
    uploadedPDFs[index].replicas--;
    updateReplicaDisplay(index);
  }
};

/**
 * Enable direct editing of replica count
 */
window.editReplicas = function(index) {
  const countDisplay = document.getElementById(`count-${index}`);
  const currentValue = uploadedPDFs[index].replicas;

  // Replace the text with an input field
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '99';
  input.value = currentValue;

  // Handle when editing is done
  const finishEdit = () => {
    const newValue = parseInt(input.value) || 0;
    uploadedPDFs[index].replicas = Math.max(0, Math.min(99, newValue));
    updateReplicaDisplay(index);
  };

  // Handle events
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      uploadedPDFs[index].replicas = currentValue; // Restore original
      updateReplicaDisplay(index);
    }
  });

  // Replace content and focus
  countDisplay.innerHTML = '';
  countDisplay.appendChild(input);
  input.focus();
  input.select();
};

/**
 * Update the display for a single replica control
 */
function updateReplicaDisplay(index) {
  const countDisplay = document.getElementById(`count-${index}`);
  const decrementBtn = document.querySelector(`.pdf-item:nth-child(${index + 1}) .replica-button:first-child`);
  const incrementBtn = document.querySelector(`.pdf-item:nth-child(${index + 1}) .replica-button:last-child`);

  const replicas = uploadedPDFs[index].replicas;

  countDisplay.textContent = replicas;
  decrementBtn.disabled = replicas === 0;
  incrementBtn.disabled = replicas >= 99;

  updateTotalPages();
}

/**
 * Update total page count display
 */
function updateTotalPages() {
  const total = uploadedPDFs.reduce((sum, pdf) => {
    return sum + (pdf.pageCount * pdf.replicas);
  }, 0);

  const pageLabel = total !== 1 ? t('assembler.pages') : t('assembler.page');
  totalPages.textContent = `${t('assembler.total')} ${total} ${pageLabel}`;
}

/**
 * Assemble all PDFs into one master PDF
 */
async function assemblePDF() {
  try {
    processing.classList.add('active');
    document.querySelector('#processing p').textContent = 'Assembling PDFs...';

    // Create new PDF document
    const masterPdf = await PDFDocument.create();

    // Add each PDF the specified number of times
    for (const pdf of uploadedPDFs) {
      for (let i = 0; i < pdf.replicas; i++) {
        // Copy all pages from this PDF
        const pages = await masterPdf.copyPages(pdf.pdfDoc, pdf.pdfDoc.getPageIndices());
        pages.forEach(page => masterPdf.addPage(page));
      }
    }

    // Save the master PDF
    const pdfBytes = await masterPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    // Download the file
    const baseFilename = outputFilename.value.trim() || 'assembled-parts';
    const filename = `${baseFilename}.pdf`;
    downloadFile(blob, filename);

    processing.classList.remove('active');

  } catch (error) {
    console.error('Error assembling PDF:', error);
    processing.classList.remove('active');
    showError('Failed to assemble PDF: ' + error.message);
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

/**
 * Drag and drop handlers for PDF items
 */
let draggedIndex = null;

function handleItemDragStart(e) {
  draggedIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleItemDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';

  const target = e.currentTarget;
  if (!target.classList.contains('dragging')) {
    target.classList.add('drag-over');
  }

  return false;
}

function handleItemDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleItemDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  const dropIndex = parseInt(e.currentTarget.dataset.index);

  if (draggedIndex !== null && draggedIndex !== dropIndex) {
    // Reorder the array
    const draggedItem = uploadedPDFs[draggedIndex];
    uploadedPDFs.splice(draggedIndex, 1);
    uploadedPDFs.splice(dropIndex, 0, draggedItem);

    // Refresh the display
    displayPreview();
  }

  return false;
}

function handleItemDragEnd(e) {
  e.currentTarget.classList.remove('dragging');

  // Remove all drag-over classes
  document.querySelectorAll('.pdf-item').forEach(item => {
    item.classList.remove('drag-over');
  });

  draggedIndex = null;
}
