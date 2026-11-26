import { unzipSync } from 'fflate';

export const GRANT_DOCUMENT_LIMITS = Object.freeze({
  documents: 5,
  bytesPerDocument: 15 * 1024 * 1024,
  extractedCharacters: 30_000,
  pdfPages: 120,
  docxXmlBytes: 5 * 1024 * 1024,
  docxExpandedBytes: 12 * 1024 * 1024,
});

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function fail(code, message) { throw Object.assign(new Error(message), { code }); }

function readZipLimits(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset += 1) {
    if (view.getUint32(offset, true) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0) fail('grant_docx_invalid', 'The DOCX package is invalid or unreadable.');
  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (count > 2_000 || centralOffset >= bytes.length) fail('grant_docx_limits', 'The DOCX package contains unsupported archive metadata.');
  let offset = centralOffset;
  let expanded = 0;
  let documentXmlBytes = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) fail('grant_docx_invalid', 'The DOCX package has a malformed directory.');
    const flags = view.getUint16(offset + 8, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (flags & 0x0001 || compressed === 0xffffffff || uncompressed === 0xffffffff) fail('grant_docx_limits', 'Encrypted and ZIP64 DOCX packages are not supported.');
    const nameStart = offset + 46;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    expanded += uncompressed;
    if (expanded > GRANT_DOCUMENT_LIMITS.docxExpandedBytes || (compressed > 0 && uncompressed / compressed > 100)) fail('grant_docx_limits', 'The DOCX package expands beyond the safe processing limit.');
    if (name === 'word/document.xml') documentXmlBytes = uncompressed;
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  if (!documentXmlBytes || documentXmlBytes > GRANT_DOCUMENT_LIMITS.docxXmlBytes) fail('grant_docx_limits', 'The DOCX document body is missing or exceeds the safe processing limit.');
}

function sourceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `grant-doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function extractGrantCallDocument(file, options = {}) {
  const limits = { ...GRANT_DOCUMENT_LIMITS, ...options.limits };
  if (!file || !Number.isFinite(file.size) || file.size <= 0 || file.size > limits.bytesPerDocument) fail('grant_document_size', 'Choose a non-empty call document under 15 MB.');
  const name = String(file.name || 'official-call-document').slice(0, 200);
  const extension = name.toLowerCase().split('.').at(-1);
  if (!['pdf', 'docx', 'txt', 'md'].includes(extension)) fail('grant_document_type', 'Supported call documents are PDF, DOCX, TXT and Markdown.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pages = [];
  if (extension === 'pdf') {
    if (file.type && file.type !== PDF_MIME) fail('grant_document_type', 'The PDF extension and media type do not match.');
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') fail('grant_pdf_invalid', 'The selected file is not a readable PDF document.');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument(/** @type {any} */ ({ data: bytes, isEvalSupported: false, useSystemFonts: false, stopAtErrors: true }));
    const pdf = /** @type {any} */ (await task.promise);
    if (pdf.numPages > limits.pdfPages) { await task.destroy(); fail('grant_pdf_pages', 'The PDF exceeds the 120 page local processing limit.'); }
    try {
      let characterCount = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const rows = new Map();
        for (const item of content.items) {
          if (!('str' in item)) continue;
          if (typeof item.str !== 'string' || !item.str.trim()) continue;
          const x = Number(item.transform?.[4]) || 0;
          const y = Number(item.transform?.[5]) || 0;
          const rowKey = Math.round(y / 2) * 2;
          rows.set(rowKey, [...(rows.get(rowKey) || []), { x, text: item.str }]);
        }
        const pageLines = [...rows.entries()].sort(([a], [b]) => b - a).map(([, items]) => items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
        for (let line = 0; line < pageLines.length; line += 1) {
          const text = pageLines[line];
          characterCount += text.length;
          if (characterCount > limits.extractedCharacters) fail('grant_document_text_limit', 'Extracted call text exceeds the 30,000 character limit.');
          pages.push({ page: pageNumber, line: line + 1, section: '', text });
        }
      }
    } finally { await task.destroy(); }
    if (!pages.some(page => page.text.length >= 20)) fail('grant_pdf_no_text', 'No usable text was found. This may be a scanned PDF; use the official text version or enter verified excerpts manually. No OCR service was contacted.');
  } else if (extension === 'docx') {
    if (file.type && file.type !== DOCX_MIME && file.type !== 'application/zip') fail('grant_document_type', 'The DOCX extension and media type do not match.');
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail('grant_docx_invalid', 'The selected DOCX file is not a valid Office document package.');
    readZipLimits(bytes);
    const archive = unzipSync(bytes);
    const xmlBytes = archive['word/document.xml'];
    if (!xmlBytes || xmlBytes.length > limits.docxXmlBytes) fail('grant_docx_invalid', 'The DOCX document body is missing or exceeds the safe processing limit.');
    const xml = new TextDecoder().decode(xmlBytes);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('grant_docx_invalid', 'DOCX declarations with external entities are not supported.');
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) fail('grant_docx_invalid', 'The DOCX document body is malformed.');
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    let section = '';
    let paragraph = 0;
    const body = document.getElementsByTagNameNS(ns, 'body')[0];
    const lines = [];
    for (const child of Array.from(body?.childNodes || [])) {
      if (child.nodeType !== 1) continue;
      const node = /** @type {Element} */ (child);
      if (!['p', 'tbl'].includes(node.localName)) continue;
      if (node.localName === 'tbl') {
        for (const para of Array.from(node.getElementsByTagNameNS(ns, 'p'))) {
          const text = Array.from(para.getElementsByTagNameNS(ns, 't')).map(item => item.textContent || '').join('').trim();
          if (text) lines.push({ page: null, paragraph: ++paragraph, section, text });
        }
        continue;
      }
      const text = Array.from(node.getElementsByTagNameNS(ns, 't')).map(item => item.textContent || '').join('').trim();
      if (!text) continue;
      const style = node.getElementsByTagNameNS(ns, 'pStyle')[0]?.getAttributeNS(ns, 'val') || '';
      if (/^heading\s*\d*$/i.test(style)) section = text.slice(0, 240);
      lines.push({ page: null, paragraph: ++paragraph, section, text });
    }
    const text = lines.map(line => line.text).join('\n');
    if (!text.trim()) fail('grant_docx_no_text', 'No usable text was found in the DOCX file.');
    if (text.length > limits.extractedCharacters) fail('grant_document_text_limit', 'Extracted call text exceeds the 30,000 character limit.');
    pages = lines;
  } else {
    if (file.type && file.type !== 'text/plain' && file.type !== 'text/markdown') fail('grant_document_type', 'The text extension and media type do not match.');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\0/g, '');
    if (!text.trim()) fail('grant_document_no_text', 'The selected file contains no readable text.');
    if (text.length > limits.extractedCharacters) fail('grant_document_text_limit', 'Extracted call text exceeds the 30,000 character limit.');
    pages = text.split(/\r?\n/).map((line, index) => ({ page: null, paragraph: index + 1, line: index + 1, section: '', text: line.trim() })).filter(line => line.text);
  }
  const text = pages.map(item => item.text).join('\n');
  if (!text.trim()) fail('grant_document_no_text', 'The selected file contains no readable text.');
  const id = sourceId();
  return {
    id, name, media_type: extension === 'pdf' ? PDF_MIME : extension === 'docx' ? DOCX_MIME : extension === 'md' ? 'text/markdown' : 'text/plain',
    size_bytes: bytes.byteLength, extraction_method: extension === 'pdf' ? 'pdfjs-local-text' : extension === 'docx' ? 'docx-xml-local-text' : 'utf8-local-text',
    extraction_status: 'text_extracted', text, lines: pages.map((item, index) => ({ ...item, source_document_id: id, source_document_name: name, line: item.line || item.paragraph || index + 1, extraction_method: extension === 'pdf' ? 'pdfjs-local-text' : extension === 'docx' ? 'docx-xml-local-text' : 'utf8-local-text' })),
    warning: extension === 'pdf' ? 'Text was extracted locally. Scanned pages, visual layout, tables and page-specific interpretation still require researcher inspection.' : 'Text was extracted locally. Pagination and visual layout are not available for DOCX/TXT/Markdown.',
  };
}
