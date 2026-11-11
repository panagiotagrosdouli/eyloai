import { parseProjectTasks } from './project-tasks.js';

/**
 * Transparent task template from the researcher's own milestones.
 * No AI generation, deadlines, dependencies, or evidence claims are inferred.
 */
const STEPS = Object.freeze([
  'Define research question, deliverables and success criteria',
  'Document search strategy and review relevant evidence',
  'Specify methodology, data sources and ethics requirements',
  'Prepare analysis and reproducibility documentation',
  'Review results, limitations and contradictory evidence',
  'Prepare reporting, dissemination and next steps',
]);

const cleanLine = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
const key = value => cleanLine(value).toLocaleLowerCase('en-US').replace(/^[*-]\s*/, '');

export function buildProjectPlanDraft(milestones = '', existingTasks = '') {
  const rawMilestones = String(milestones || '').split(/\r?\n/).slice(0, 30)
    .map(line => cleanLine(line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')))
    .filter(Boolean);
  const candidates = [...STEPS, ...rawMilestones.map(line => `Milestone: ${line}`)];
  const existing = new Set(parseProjectTasks(existingTasks).map(item => key(item.text)));
  const seen = new Set(existing);
  return candidates.filter(item => {
    const k = key(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 30).map(item => `- [ ] ${item}`).join('\n');
}

export function acceptProjectPlanDraft(currentTasks = '', reviewedDraft = '') {
  const existingLines = String(currentTasks || '').split(/\r?\n/).filter(Boolean);
  const existing = new Set(parseProjectTasks(currentTasks).map(item => key(item.text)));
  const accepted = [];
  for (const item of parseProjectTasks(reviewedDraft)) {
    const text = cleanLine(item.text);
    const k = key(text);
    if (!k || existing.has(k)) continue;
    existing.add(k);
    accepted.push(`- [ ] ${text}`);
    if (accepted.length >= 30) break;
  }
  if (!accepted.length) return existingLines.join('\n');
  return [...existingLines, ...accepted].join('\n');
}
