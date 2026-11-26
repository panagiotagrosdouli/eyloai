import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { extractGrantCallDocument } from '../src/lib/grant-call-document.mjs';

const fileLike = ({ name, type, bytes }) => ({ name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test('PDF text extraction reads an actual generated PDF and retains page provenance', async () => {
  const pdf = new jsPDF();
  pdf.text('Eligibility: Applicants must meet the official call criteria.', 12, 18);
  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  const document = await extractGrantCallDocument(fileLike({ name: 'official-call.pdf', type: 'application/pdf', bytes }));
  assert.equal(document.extraction_method, 'pdfjs-local-text');
  assert.equal(document.lines[0].page, 1);
  assert.match(document.lines[0].text, /Applicants must meet the official call criteria/);
  assert.equal(document.lines[0].source_document_id, document.id);
});

test('local text document extraction enforces type and character limits while retaining exact lines', async () => {
  const text = new TextEncoder().encode('Official call\nApplicants must meet eligibility rules.');
  const document = await extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'text/plain', bytes: text }));
  assert.equal(document.extraction_method, 'utf8-local-text');
  assert.equal(document.extraction_status, 'text_extracted');
  assert.equal(document.lines[1].text, 'Applicants must meet eligibility rules.');
  assert.equal(document.lines[1].source_document_id, document.id);

  assert.equal(document.lines[1].source_document_name, 'call.txt');
  const markdownBytes = new TextEncoder().encode('# Official call\nApplicants must submit a research plan.');
  const markdown = await extractGrantCallDocument(fileLike({ name: 'call.md', type: 'text/markdown', bytes: markdownBytes }));
  assert.equal(markdown.media_type, 'text/markdown');
  assert.equal(markdown.lines[0].text, '# Official call');
  assert.equal(markdown.lines[1].text, 'Applicants must submit a research plan.');
  assert.equal(markdown.lines[1].source_document_id, markdown.id);
  assert.equal(markdown.lines[1].source_document_name, 'call.md');
  assert.equal(markdown.lines[1].paragraph, 2);
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.pdf', type: 'application/pdf', bytes: text })), { code: 'grant_pdf_invalid' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'application/pdf', bytes: text })), { code: 'grant_document_type' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'text/plain', bytes: text }), { limits: { bytesPerDocument: 10 } }), { code: 'grant_document_size' });
});

test('local extraction accepts only bounded supported document suffixes', async () => {
  const text = new TextEncoder().encode('A readable official call excerpt.');
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.exe', type: 'application/octet-stream', bytes: text })), { code: 'grant_document_type' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: text })), { code: 'grant_docx_invalid' });
});
