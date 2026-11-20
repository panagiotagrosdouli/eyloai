import { isSafeEyraSourceUrl } from './eyra-citation-ids.mjs';
import { describeEyraFailure } from './eyra-failure-guidance.mjs';

// Retrieved provider metadata is not an independently authenticated publication
// or verification of the scientific claims in its abstract.
const safeMarkdownText = value => String(value ?? '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/[\\`*_{}\[\]()#+.!|>~-]/g, '\\$&')
  .slice(0, 420);

export function buildEvidenceOnlyFallback(evidence, error) {
  const records = Array.isArray(evidence?.sources) ? evidence.sources : [];
  const sources = records.filter(source => source && isSafeEyraSourceUrl(source.url));
  const authIssue = error?.status === 401 || /auth|session|sign in/i.test(error?.message || '');
  // Do not claim that evidence was retrieved for a greeting or failed search.
  if (!sources.length) {
    return [
      '## EYRA response unavailable',
      'AI synthesis did not finish. No completed answer is available.',
      '',
      '### Why the analysis stopped',
      describeEyraFailure(error),
      '',
      evidence?.attempted
        ? 'No usable source records were returned. Retrieval failure and absence of results must not be confused; retry or inspect a provider directly.'
        : 'No external retrieval was requested. Retry after the service is available; no evidence-based answer is available.',
      ...(authIssue ? ['Refresh your secure session before requesting a new AI synthesis.'] : []),
    ].join('\n');
  }

  const lines = [
    '## Retrieved source records (not independently verified)',
    authIssue
      ? 'The AI session needs renewal, so no AI synthesis was produced. The source records below are provider metadata and require inspection of their originals.'
      : 'AI synthesis did not finish. The source records below are provider metadata, not a checked interpretation of the underlying research.',
    '',
    '### Why the analysis stopped',
    describeEyraFailure(error),
  ];

  const grouped = sources.reduce((groups, source) => {
    const type = ['Paper', 'Funding', 'Researcher', 'Institution'].includes(source.type) ? source.type : 'Other';
    (groups[type] ||= []).push(source);
    return groups;
  }, {});

  for (const [type, items] of Object.entries(grouped)) {
    lines.push('', '### ' + type + ' metadata');
    for (const source of items.slice(0, 6)) {
      const identifier = /^(?:P|R|I|F)[1-9]\d*$/.test(source.id || '') ? source.id : 'Record';
      const title = safeMarkdownText(source.title || 'Untitled record');
      const metadata = source.meta ? ' — ' + safeMarkdownText(source.meta) : '';
      // A safe protocol/host is checked above. Markdown metacharacters in
      // both provider title and URL are escaped to prevent link injection.
      const url = String(source.url).replace(/[()\\]/g, char => '\\' + char);
      lines.push('- [' + identifier + '] [' + title + '](' + url + ')' + metadata);
    }
  }

  lines.push('', '### Next verification step');
  if (grouped.Paper?.length) {
    lines.push('Open the original publications and inspect their methods, evidence and limitations before citing or comparing them.');
  } else if (grouped.Funding?.length) {
    lines.push('Open the official opportunity page to check eligibility, deadline, and current status.');
  } else if (grouped.Researcher?.length || grouped.Institution?.length) {
    lines.push('Inspect original institutional and publication profiles. Indexed metadata do not establish researcher availability or consent.');
  } else {
    lines.push('Inspect the original provider records before drawing conclusions.');
  }
  if (authIssue) lines.push('Refresh your secure session before requesting a new AI synthesis.');
  return lines.join('\n');
}
