const MAX_ITEMS = 10;

function text(value, maxLength = 1200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function items(value, limit = MAX_ITEMS) {
  return Array.isArray(value) ? value.slice(0, limit).filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
}

function indexedSource(sourceId, prefix, sourceList) {
  if (typeof sourceId !== 'string') return null;
  const match = sourceId.match(new RegExp(`^${prefix}([1-9][0-9]?)$`));
  if (!match) return null;
  return sourceList[Number(match[1]) - 1] || null;
}

/** Keep only bounded AI fields and exact IDs from the retrieved source lists. */
export function normalizeExecutiveBriefing(result, { papers = [], funding = [], projects = [], generatedAt = new Date().toISOString() } = {}) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The briefing provider returned an invalid result.');
  const livePapers = Array.isArray(papers) ? papers.slice(0, MAX_ITEMS) : [];
  const liveFunding = Array.isArray(funding) ? funding.slice(0, MAX_ITEMS) : [];
  const liveProjects = Array.isArray(projects) ? projects.slice(0, MAX_ITEMS) : [];
  const projectSignals = items(result.project_health).flatMap(signal => {
    const project = indexedSource(signal.source_id, 'J', liveProjects);
    const status = ['green', 'yellow', 'red'].includes(signal.status) ? signal.status : null;
    if (!project || !status) return [];
    return [{ project: text(project.title, 200), status, note: text(signal.note, 600) }];
  });
  const discoveries = items(result.paper_signals).flatMap(signal => {
    const paper = indexedSource(signal.source_id, 'P', livePapers);
    if (!paper) return [];
    return [{
      item: text(paper.title, 400),
      significance: text(signal.significance, 800),
      source_url: safeSourceUrl(paper.url),
      source: text(paper.source, 100),
    }];
  });
  const fundingAlerts = items(result.funding_matches).flatMap(match => {
    const opportunity = indexedSource(match.source_id, 'F', liveFunding);
    if (!opportunity) return [];
    return [{
      alert: text(opportunity.title, 400),
      action: text(match.action, 800),
      source_url: safeSourceUrl(opportunity.source_url),
      deadline: text(opportunity.deadline, 100),
    }];
  });
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) throw new Error('The briefing date is invalid.');

  return {
    generated_at: date.toISOString(),
    strategic_summary: text(result.strategic_summary),
    weekly_focus: text(result.weekly_focus, 500),
    top_opportunities: items(result.top_opportunities).map(item => ({
      title: text(item.title, 240), reason: text(item.reason, 800), urgency: text(item.urgency, 100),
    })).filter(item => item.title && item.reason),
    critical_risks: items(result.critical_risks).map(item => ({
      risk: text(item.risk, 500), mitigation: text(item.mitigation, 800),
    })).filter(item => item.risk && item.mitigation),
    project_health: projectSignals,
    priority_actions: items(result.priority_actions).map(item => ({
      action: text(item.action, 500), deadline: text(item.deadline, 100), impact: text(item.impact, 300),
    })).filter(item => item.action),
    new_discoveries: discoveries.filter(item => item.item && item.source_url),
    funding_alerts: fundingAlerts.filter(item => item.alert && item.source_url),
    _source_counts: { papers: livePapers.length, funding: liveFunding.length },
  };
}

/** Revalidate a user-owned briefing snapshot before restoring it from Notes. */
export function normalizeStoredExecutiveBriefing(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The saved briefing is malformed.');
  const date = new Date(value.generated_at);
  if (!Number.isFinite(date.getTime())) throw new Error('The saved briefing date is invalid.');
  return {
    generated_at: date.toISOString(),
    strategic_summary: text(value.strategic_summary),
    weekly_focus: text(value.weekly_focus, 500),
    top_opportunities: items(value.top_opportunities).map(item => ({ title: text(item.title, 240), reason: text(item.reason, 800), urgency: text(item.urgency, 100) })).filter(item => item.title && item.reason),
    critical_risks: items(value.critical_risks).map(item => ({ risk: text(item.risk, 500), mitigation: text(item.mitigation, 800) })).filter(item => item.risk && item.mitigation),
    project_health: items(value.project_health).flatMap(item => ['green', 'yellow', 'red'].includes(item.status)
      ? [{ project: text(item.project, 200), status: item.status, note: text(item.note, 600) }].filter(entry => entry.project)
      : []),
    priority_actions: items(value.priority_actions).map(item => ({ action: text(item.action, 500), deadline: text(item.deadline, 100), impact: text(item.impact, 300) })).filter(item => item.action),
    new_discoveries: items(value.new_discoveries).map(item => ({
      item: text(item.item, 400), significance: text(item.significance, 800), source_url: safeSourceUrl(item.source_url), source: text(item.source, 100),
    })).filter(item => item.item && item.source_url),
    funding_alerts: items(value.funding_alerts).map(item => ({
      alert: text(item.alert, 400), action: text(item.action, 800), source_url: safeSourceUrl(item.source_url), deadline: text(item.deadline, 100),
    })).filter(item => item.alert && item.source_url),
    _source_counts: {
      papers: Number.isSafeInteger(value._source_counts?.papers) ? Math.max(0, Math.min(value._source_counts.papers, 10_000)) : 0,
      funding: Number.isSafeInteger(value._source_counts?.funding) ? Math.max(0, Math.min(value._source_counts.funding, 10_000)) : 0,
    },
  };
}

export function executiveBriefingNoteContent(briefing) {
  const lines = [
    '# Weekly research briefing',
    `Generated: ${briefing.generated_at}`,
    '',
    'AI planning suggestions are conditional judgments, not verified outcomes.',
    '',
    '## Weekly focus',
    briefing.weekly_focus || 'Not provided.',
    '',
    '## Strategic summary',
    briefing.strategic_summary || 'Not provided.',
    '',
    '## Opportunities',
    ...(briefing.top_opportunities || []).map(item => `- ${item.title}: ${item.reason}${item.urgency ? ` (${item.urgency})` : ''}`),
    ...(briefing.top_opportunities?.length ? [] : ['No opportunities were returned.']),
    '',
    '## Critical risks',
    ...(briefing.critical_risks || []).map(item => `- ${item.risk}: ${item.mitigation}`),
    ...(briefing.critical_risks?.length ? [] : ['No critical risks were returned.']),
    '',
    '## Project health',
    ...(briefing.project_health || []).map(item => `- ${item.project}: ${item.status} — ${item.note}`),
    ...(briefing.project_health?.length ? [] : ['No verified project assessments were returned.']),
    '',
    '## Research signals',
    ...(briefing.new_discoveries || []).map(item => `- ${item.item}: ${item.significance} ${item.source_url}`),
    ...(briefing.new_discoveries?.length ? [] : ['No verified paper signals were selected.']),
    '',
    '## Funding alerts',
    ...(briefing.funding_alerts || []).map(item => `- ${item.alert}${item.deadline ? ` — deadline ${item.deadline}` : ''}: ${item.action} ${item.source_url}`),
    ...(briefing.funding_alerts?.length ? [] : ['No verified funding records were selected.']),
    '',
    '## Priority actions',
    ...(briefing.priority_actions || []).map(item => `- ${item.action}${item.deadline ? ` — ${item.deadline}` : ''}`),
    ...(briefing.priority_actions?.length ? [] : ['No priority actions were returned.']),
  ];
  return lines.join('\n').slice(0, 90_000);
}
