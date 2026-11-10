const NOTE_FIELDS = [
  ['study_design', 'Study design'],
  ['dataset', 'Dataset'],
  ['findings', 'Findings'],
  ['limitations', 'Limitations'],
];

export { NOTE_FIELDS };

export function getEvidenceMatrixRows(papers, selectedPaperIds, annotations = {}) {
  if (!Array.isArray(papers) || !Array.isArray(selectedPaperIds)) return [];
  const selected = new Set(selectedPaperIds.map(String));
  return papers
    .filter((paper) => paper?.id != null && selected.has(String(paper.id)))
    .map((paper) => ({
      paper,
      notes: Object.fromEntries(NOTE_FIELDS.map(([field]) => [
        field,
        typeof annotations?.[paper.id]?.[field] === 'string' ? annotations[paper.id][field] : '',
      ])),
    }));
}

function csvCell(value) {
  let text = value == null || value === '' ? 'Not recorded' : String(value);
  // Protect CSV exports opened in spreadsheet software from formula execution.
  if (/^[\t ]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportEvidenceMatrixCsv(rows) {
  const headers = ['Title', 'Authors', 'Year', 'Source', ...NOTE_FIELDS.map(([, label]) => `${label} (researcher note)`)];
  const records = (Array.isArray(rows) ? rows : []).map(({ paper, notes = {} }) => [
    paper?.title,
    paper?.authors,
    paper?.year,
    paper?.url,
    ...NOTE_FIELDS.map(([field]) => notes[field]),
  ]);
  return [headers, ...records].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
