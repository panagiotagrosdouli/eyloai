const MAX_EXPORT_BYTES = 1_000_000;
const MAX_SOURCE_RECORDS = 40;
const MAX_TEXT = 2500;

function boundedString(value) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, MAX_TEXT);
}

function cleanSource(record, index) {
  const item = record && typeof record === 'object' ? record : {};
  const candidateUrl = item.source_url || item.url || item.profile_url || item.id_url;
  let url = null;
  if (typeof candidateUrl === 'string') {
    try {
      const parsed = new URL(candidateUrl);
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && !Array.from(candidateUrl).some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) url = parsed.href;
    } catch { /* Do not export unsafe external links. */ }
  }
  return {
    reference: boundedString(item.source_id || item.id || 'source-' + (index + 1)),
    title: boundedString(item.title || item.name),
    publisher: boundedString(item.source || item.agency || item.institution),
    year: boundedString(item.year),
    url,
  };
}

/** A local download of model analysis, not an external verification or permanent cloud save. */
export function buildResearchReport({ tool, query, analysis, sources = [], caveat = '' }) {
  if (!tool || typeof tool !== 'string') throw new TypeError('Tool name required');
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw new TypeError('Completed analysis required');
  if (!Array.isArray(sources) || sources.length > MAX_SOURCE_RECORDS) throw new RangeError('Too many source records to export');
  const report = {
    format: 'eylo-research-report-v1',
    tool: boundedString(tool),
    query: boundedString(query),
    exported_at: new Date().toISOString(),
    provenance: {
      assessment: 'AI-generated analysis or decision-support, not independently validated',
      retrieved_records: 'Source metadata only; original full-text and claims require human verification',
      note: boundedString(caveat),
    },
    sources: sources.map(cleanSource),
    analysis,
  };
  const json = JSON.stringify(report, null, 2);
  if (new TextEncoder().encode(json).length > MAX_EXPORT_BYTES) throw new RangeError('Report exceeds 1 MB; reduce the requested scope');
  return json;
}

export function downloadResearchReport(args) {
  const json = buildResearchReport(args);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = 'eylo-' + args.tool.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 45) + '-report.json';
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
