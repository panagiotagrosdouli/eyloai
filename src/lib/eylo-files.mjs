export const EYLO_FILE_BUCKET = 'eylo-files';
export const EYLO_FILE_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/rtf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet', 'application/octet-stream',
  'image/png', 'image/jpeg', 'image/webp',
]);

export function validateEyloFile(file) {
  if (!file || typeof file.name !== 'string' || !file.name.trim()) throw new Error('Choose a file with a name.');
  if (!Number.isFinite(file.size) || file.size < 0) throw new Error('The selected file has an invalid size.');
  if (file.size > EYLO_FILE_MAX_BYTES) throw new Error('Files must be 25 MB or smaller.');
  const type = String(file.type || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_TYPES.has(type)) throw new Error('This file type is not supported. Use a document, spreadsheet, presentation, PDF, image, CSV, or plain-text file.');
  return { name: file.name.trim().slice(0, 240), mimeType: type, sizeBytes: file.size };
}

export function safeStorageFilename(name) {
  const cleaned = String(name || 'file').normalize('NFKC')
    .replace(/[\\/\u0000-\u001f\u007f]/g, '-')
    .replace(/\.\./g, '-')
    .replace(/[^\p{L}\p{N}._() -]/gu, '-')
    .trim()
    .slice(0, 180);
  return cleaned || 'file';
}

export function filterEyloFiles(files, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase();
  if (!normalized) return files;
  return files.filter(file => [file.name, file.description, file.project_title]
    .some(value => String(value || '').toLocaleLowerCase().includes(normalized)));
}
