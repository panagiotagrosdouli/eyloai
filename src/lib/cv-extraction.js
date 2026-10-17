// Client-side document extraction. The file bytes are never posted to EYLO,
// OpenAlex, or the script CDN. External libraries are lazy-loaded on demand.
const MAX_CV_BYTES = 5 * 1024 * 1024;
const PDF_MODULE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs';
const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
const MAMMOTH_SCRIPT = 'https://cdn.jsdelivr.net/npm/mammoth@1.11.0/mammoth.browser.min.js';

export function validateCvDocument(file) {
  if (!file) return 'Choose a CV file.';
  if (!/\.(pdf|docx|txt|md)$/i.test(file.name || '')) return 'Choose a PDF, DOCX, TXT or Markdown CV.';
  if (file.size > MAX_CV_BYTES) return 'CV must be under 5 MB.';
  if (file.size === 0) return 'CV is empty.';
  return '';
}

function loadMammoth() {
  if (globalThis.mammoth?.extractRawText) return Promise.resolve(globalThis.mammoth);
  if (!globalThis.document) throw new Error('DOCX extraction needs a web browser.');
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MAMMOTH_SCRIPT;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => globalThis.mammoth?.extractRawText
      ? resolve(globalThis.mammoth)
      : reject(new Error('DOCX parser was not available.'));
    script.onerror = () => reject(new Error('Could not load DOCX parser. Try again online.'));
    document.head.appendChild(script);
  });
}

export async function extractCvText(file) {
  const invalid = validateCvDocument(file);
  if (invalid) throw new Error(invalid);
  const name = file.name.toLowerCase();
  let text;
  if (/\.(txt|md)$/.test(name)) {
    text = await file.text();
  } else if (name.endsWith('.docx')) {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else {
    // Vite must not rewrite the absolute CDN URL as a bundled dependency.
    const pdfjs = await import(/* @vite-ignore */ PDF_MODULE);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    if (pdf.numPages > 40) { await pdf.destroy(); throw new Error('CV PDF exceeds 40 pages.'); }
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str || '').join(' '));
      }
    } finally {
      await pdf.destroy();
    }
    text = pages.join('\n');
  }
  text = String(text || '').replace(/\0/g, '').trim();
  if (text.length < 30) throw new Error('The CV contains too little readable text. Scanned PDFs may require OCR.');
  return text.slice(0, 120_000);
}
