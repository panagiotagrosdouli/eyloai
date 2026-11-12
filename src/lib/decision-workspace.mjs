export const DECISION_STATUSES = ['planning', 'decided', 'monitoring', 'closed'];

const LIMITS = {
  title: 160,
  question: 1200,
  rationale: 6000,
  decision: 3000,
  alternatives: 12,
  criteria: 16,
  evidence: 40,
};

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function createDecisionDraft(id = globalThis.crypto?.randomUUID?.() || ('decision-' + Date.now())) {
  const now = new Date().toISOString();
  return {
    id,
    title: '',
    question: '',
    status: 'planning',
    review_date: '',
    alternatives: [],
    criteria: [],
    evidence: [],
    decision: '',
    rationale: '',
    outcome: '',
    created_date: now,
    updated_date: now,
  };
}

export function validateDecision(value) {
  const errors = [];
  const decision = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (!cleanText(decision.id, 80)) errors.push('Decision identifier is required.');
  if (!cleanText(decision.title, LIMITS.title)) errors.push('Add a decision title (up to 160 characters).');
  if (String(decision.title || '').trim().length > LIMITS.title) errors.push('Decision title must be 160 characters or fewer.');
  if (!cleanText(decision.question, LIMITS.question)) errors.push('Describe the question this decision addresses.');
  if (String(decision.question || '').trim().length > LIMITS.question) errors.push('Question must be 1,200 characters or fewer.');
  if (!DECISION_STATUSES.includes(decision.status)) errors.push('Choose a supported decision status.');
  if (String(decision.decision || '').trim().length > LIMITS.decision) errors.push('Recorded choice must be 3,000 characters or fewer.');
  if (String(decision.outcome || '').trim().length > 3000) errors.push('Outcome must be 3,000 characters or fewer.');
  if (decision.review_date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(decision.review_date);
    const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) {
      errors.push('Review date must be a real calendar date in YYYY-MM-DD format.');
    }
  }
  /** @type {Array<[string, string, number]>} */
  const listLimits = [
    ['alternatives', 'Alternatives', LIMITS.alternatives],
    ['criteria', 'Criteria', LIMITS.criteria],
    ['evidence', 'Evidence items', LIMITS.evidence],
  ];
  for (const [field, label, max] of listLimits) {
    if (!Array.isArray(decision[field])) errors.push(label + ' must be a list.');
    else if (decision[field].length > max) errors.push('Keep ' + label.toLowerCase() + ' to ' + max + ' or fewer.');
  }
  for (const item of Array.isArray(decision.alternatives) ? decision.alternatives : []) {
    if (String(item?.text || '').trim().length > 500) errors.push('Each alternative must be 500 characters or fewer.');
  }
  for (const item of Array.isArray(decision.criteria) ? decision.criteria : []) {
    if (String(item?.text || '').trim().length > 300) errors.push('Each criterion must be 300 characters or fewer.');
  }
  if (String(decision.rationale || '').trim().length > LIMITS.rationale) {
    errors.push('Rationale must be ' + LIMITS.rationale + ' characters or fewer.');
  }
  for (const item of Array.isArray(decision.evidence) ? decision.evidence : []) {
    if (!cleanText(item?.claim, 1000) || !cleanText(item?.source_label, 200)) {
      errors.push('Each evidence item needs a claim and source label.');
      break;
    }
    if (String(item?.claim || '').trim().length > 1000 || String(item?.source_label || '').trim().length > 200 || String(item?.source_url || '').trim().length > 1000) {
      errors.push('Evidence fields exceed their supported length.');
      break;
    }
    const url = cleanText(item?.source_url, 1000);
    if (url) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      } catch {
        errors.push('Evidence links must use a valid HTTP or HTTPS URL.');
        break;
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeDecision(value) {
  return {
    id: cleanText(value?.id, 80),
    created_date: cleanText(value?.created_date, 40),
    updated_date: cleanText(value?.updated_date, 40),
    title: cleanText(value?.title, LIMITS.title),
    question: cleanText(value?.question, LIMITS.question),
    status: DECISION_STATUSES.includes(value?.status) ? value.status : 'planning',
    review_date: cleanText(value?.review_date, 10),
    alternatives: (Array.isArray(value?.alternatives) ? value.alternatives : [])
      .slice(0, LIMITS.alternatives)
      .map((item) => ({ id: cleanText(item?.id, 80), text: cleanText(item?.text, 500) }))
      .filter((item) => item.text),
    criteria: (Array.isArray(value?.criteria) ? value.criteria : [])
      .slice(0, LIMITS.criteria)
      .map((item) => ({ id: cleanText(item?.id, 80), text: cleanText(item?.text, 300) }))
      .filter((item) => item.text),
    evidence: (Array.isArray(value?.evidence) ? value.evidence : [])
      .slice(0, LIMITS.evidence)
      .map((item) => ({
        id: cleanText(item?.id, 80),
        claim: cleanText(item?.claim, 1000),
        source_label: cleanText(item?.source_label, 200),
        source_url: cleanText(item?.source_url, 1000),
      }))
      .filter((item) => item.claim || item.source_label || item.source_url),
    decision: cleanText(value?.decision, LIMITS.decision),
    rationale: cleanText(value?.rationale, LIMITS.rationale),
    outcome: cleanText(value?.outcome, 3000),
  };
}

export function normalizeDecisionList(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map(normalizeDecision);
}
