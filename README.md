# Music PDF Toolkit

A browser-based toolkit for processing brass band sheet music PDFs. All processing happens client-side - your PDFs never leave your device!

## 🚀 Live Demo

**https://clementnuss.github.io/music-pdf-toolkit/**

Or with custom domain: **https://music.n8r.ch** (if DNS configured)

## 🛠️ Tools

### PDF Splitter
Automatically split brass band PDFs by instrument using OCR and text detection.
- Auto-detects instrument names
- OCR fallback for scanned PDFs
- Edit instrument names
- Merge/split pages
- Download individually or as ZIP

### PDF Combiner
Combine 2 pages into 1 for A5 printing.
- Process multiple PDFs at once
- Optional margin cropping
- First page alone mode
- Batch download as ZIP

### PDF Merger
Merge common pages (lyrics, etc.) with all parts.
- Two-step upload process
- Adds common PDF to beginning of each part
- Batch processing

### PDF Assembler
Combine all parts into one master PDF with configurable replicas.
- Set number of copies per part (e.g., 2 euphoniums)
- Drag-and-drop reordering
- Smart filename detection
- Total page count

## 💻 Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build
```

## 🚢 Deployment

This project uses GitHub Actions to automatically deploy to GitHub Pages on every push to `main`.

### Setup GitHub Pages

1. Go to your repository **Settings**
2. Navigate to **Pages** (under Code and automation)
3. Under **Source**, select **"GitHub Actions"**
4. Push to main branch - the site deploys automatically!

### Custom Domain (Optional)

To use a custom domain like `music.n8r.ch`:

1. In repository settings → Pages → Custom domain: `music.n8r.ch`
2. In your DNS provider, add a CNAME record:
   ```
   music.n8r.ch  →  clementnuss.github.io
   ```
3. Wait for DNS propagation (5-30 minutes)
4. GitHub automatically provisions SSL certificate ✨

## 🔧 Tech Stack

- **Vite** - Build tool and dev server
- **PDF.js** - PDF rendering and text extraction
- **pdf-lib** - PDF manipulation
- **Tesseract.js** - Browser-based OCR
- **JSZip** - ZIP file creation
- **Fuse.js** - Fuzzy string matching

## 🔒 Privacy

All PDF processing happens **entirely in your browser** using WebAssembly and JavaScript. No data is sent to any server. Your PDFs stay on your device!

## License

MIT
