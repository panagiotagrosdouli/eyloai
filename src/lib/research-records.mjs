// Project-owned records use the existing projects.data contract and project CAS.
export const RESEARCH_WORKSPACES = {
  journal: { title: 'Research Journal', key: 'research_journal', singular: 'entry', statuses: ['recorded', 'follow_up', 'resolved'], description: 'Keep dated observations, interpretations and next steps together.', fields: [['observation', 'Observation', 6000, true], ['interpretation', 'Interpretation and uncertainty', 4000], ['next_step', 'Next step', 2000]] },
  experiments: { title: 'Experiment Lab', key: 'experiment_records', singular: 'experiment', statuses: ['planned', 'running', 'completed', 'stopped'], description: 'Plan an experiment and record methods, results and limitations. Results are entered by you; EYLO does not execute experiments.', fields: [['hypothesis', 'Hypothesis', 2000, true], ['method', 'Method and analysis plan', 6000, true], ['result', 'Observed result', 6000], ['limitations', 'Limitations and deviations', 4000]] },
  publications: { title: 'Publication Tracker', key: 'publication_records', singular: 'publication', statuses: ['draft', 'submitted', 'revision', 'accepted', 'published', 'withdrawn', 'rejected'], description: 'Track your manuscripts, venues and next deadlines. Statuses are self-reported, not verified publisher decisions.', fields: [['venue', 'Journal or venue', 500, true], ['reference', 'Submission reference or DOI', 500], ['next_step', 'Next action', 2000], ['notes', 'Decision and revision notes', 6000]] },
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const text = value => typeof value === 'string' ? value.trim() : '';
export function createResearchRecord(kind, id = crypto.randomUUID(), today = new Date().toISOString().slice(0, 10)) {
  const config = RESEARCH_WORKSPACES[kind];
  if (!config) throw new Error('Unknown research workspace.');
  return { version: 1, id, title: '', date: today, due_date: '', status: config.statuses[0], source_url: '', ...Object.fromEntries(config.fields.map(([key]) => [key, ''])) };
}
export function validateResearchRecord(kind, record) {
  const config = RESEARCH_WORKSPACES[kind];
  if (!config || !record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Unsupported research record.');
  if (record.version !== 1 || !uuid.test(record.id)) throw new Error('Unsupported record version or identifier.');
  const fields = [['title', 'Title', 160, true], ['source_url', 'Source URL', 1500], ...config.fields];
  for (const [key, label, max, required] of fields) {
    if (typeof record[key] !== 'string' || record[key].length > Number(max) || (required && !text(record[key]))) throw new Error(`${label} is required or exceeds its supported length.`);
  }
  if (!config.statuses.includes(record.status) || !date(record.date) || (record.due_date !== '' && !date(record.due_date))) throw new Error('Choose a supported status and valid calendar dates.');
  if (record.source_url) {
    let url;
    try { url = new URL(record.source_url); } catch { throw new Error('Use a complete HTTPS source URL.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS source URL without embedded credentials.');
  }
  if (kind === 'experiments' && record.status === 'completed' && !text(record.result)) throw new Error('Record the observed result before completing an experiment.');
  if (kind === 'publications' && record.status === 'published' && !text(record.reference) && !text(record.source_url)) throw new Error('Add a DOI, submission reference or source URL for a published record.');
  return record;
}
export function readResearchRecords(kind, project) {
  const config = RESEARCH_WORKSPACES[kind];
  if (!config) throw new Error('Unknown research workspace.');
  const rows = project[config.key] ?? [];
  if (!Array.isArray(rows) || rows.length > 100) throw new Error('Saved research records have an unsupported format or exceed the 100-record limit.');
  const ids = new Set();
  for (const row of rows) {
    validateResearchRecord(kind, row);
    if (ids.has(row.id)) throw new Error('Saved research records contain duplicate identifiers.');
    ids.add(row.id);
  }
  if (new TextEncoder().encode(JSON.stringify(rows)).length > 262144) throw new Error('Saved records exceed the 256 KiB workspace budget.');
  return rows;
}
export function researchRecordPatch(kind, project, record, remove = false) {
  const rows = readResearchRecords(kind, project);
  validateResearchRecord(kind, record);
  const exists = rows.some(row => row.id === record.id);
  if (remove && !exists) throw new Error('This record no longer exists. Reload the project.');
  const next = remove ? rows.filter(row => row.id !== record.id) : exists ? rows.map(row => row.id === record.id ? record : row) : [...rows, record];
  if (next.length > 100) throw new Error('This project supports at most 100 records in each research workspace.');
  readResearchRecords(kind, { [RESEARCH_WORKSPACES[kind].key]: next });
  return { [RESEARCH_WORKSPACES[kind].key]: next };
}
export function exportResearchRecords(kind, project) {
  return { format: 'eylo-project-research-records', version: 1, workspace: kind, project: { id: project.id, title: project.title }, records: readResearchRecords(kind, project), disclosure: 'Private user-entered records. Source links and publication statuses are not independently verified. This is a portable snapshot, not an immutable audit trail or proof of reproducibility.' };
}
