import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGrantCallDocument } from '../src/lib/grant-call-document.mjs';

const fileLike = ({ name, type, bytes }) => ({ name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test('local text document extraction enforces type and character limits while retaining exact lines', async () => {
  const text = new TextEncoder().encode('Official call\nApplicants must meet eligibility rules.');
  const document = await extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'text/plain', bytes: text }));
  assert.equal(document.extraction_method, 'utf8-local-text');
  assert.equal(document.extraction_status, 'text_extracted');
  assert.equal(document.lines[1].text, 'Applicants must meet eligibility rules.');
  assert.equal(document.lines[1].source_document_id, document.id);
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.pdf', type: 'application/pdf', bytes: text })), { code: 'grant_pdf_invalid' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'application/pdf', bytes: text })), { code: 'grant_document_type' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.txt', type: 'text/plain', bytes: text }), { limits: { bytesPerDocument: 10 } }), { code: 'grant_document_size' });
});

test('local extraction accepts only bounded supported document suffixes', async () => {
  const text = new TextEncoder().encode('A readable official call excerpt.');
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.exe', type: 'application/octet-stream', bytes: text })), { code: 'grant_document_type' });
  await assert.rejects(extractGrantCallDocument(fileLike({ name: 'call.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: text })), { code: 'grant_docx_invalid' });
});
