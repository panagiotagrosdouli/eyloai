const STOP_WORDS = new Set([
  'about', 'and', 'for', 'from', 'into', 'with', 'the', 'this', 'that', 'your',
  'research', 'researcher', 'researchers', 'scientist', 'scientists', 'expert', 'expertise',
  'engineer', 'engineering', 'clinical', 'business', 'senior', 'junior', 'role', 'team',
  'project', 'experience', 'skills', 'skill', 'work', 'works', 'study', 'studies',
]);

function terms(value) {
  return [...new Set(String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .match(/[a-zα-ωάέήίόύώϊϋΐΰ0-9]{3,}/giu) || [])]
    .filter((term) => !STOP_WORDS.has(term));
}

/**
 * Compare proposed role text with OpenAlex's publication-derived topic labels.
 * This is an explainable metadata overlap only, never verification of expertise.
 */
export function rankResearchersForRoles(candidates = [], roles = []) {
  const normalizedRoles = (Array.isArray(roles) ? roles : []).map((role) => {
    const roleTerms = terms([role?.role, ...(Array.isArray(role?.key_skills) ? role.key_skills : [])].join(' '));
    return { label: String(role?.role || 'Proposed role'), terms: roleTerms };
  }).filter((role) => role.terms.length);

  return (Array.isArray(candidates) ? candidates : []).map((researcher, index) => {
    const indexedTopics = terms(researcher?.research_areas || '');
    const roleMatches = normalizedRoles.flatMap((role) => {
      const matchedTerms = role.terms.filter((term) => indexedTopics.includes(term));
      return matchedTerms.length
        ? [{ role: role.label, terms: matchedTerms.slice(0, 5), coverage: Number((matchedTerms.length / role.terms.length).toFixed(2)) }]
        : [];
    });
    return {
      researcher,
      index,
      roleMatches,
      matchedTerms: [...new Set(roleMatches.flatMap((match) => match.terms))],
      score: roleMatches.reduce((maximum, match) => Math.max(maximum, match.coverage), 0),
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index);
}

/** A deterministic form-completion measure, not a score of team quality. */
export function calculateDraftCompleteness(plan = {}) {
  const checks = [
    Boolean(String(plan.project_summary || '').trim()),
    Array.isArray(plan.current_gaps) && plan.current_gaps.some((item) => String(item || '').trim()),
    Array.isArray(plan.hiring_sequence) && plan.hiring_sequence.some((item) => String(item || '').trim()),
    Array.isArray(plan.consortium_partners) && plan.consortium_partners.some((item) => String(item?.role || item?.type || '').trim()),
    Boolean(String(plan.eyra_team_insight || '').trim()),
    Boolean(String(plan.first_hire_advice || '').trim()),
  ];
  const roles = Array.isArray(plan.dream_team) ? plan.dream_team : [];
  for (const role of roles) {
    checks.push(
      Boolean(String(role?.role || '').trim()),
      Boolean(String(role?.why_needed || '').trim()),
      Array.isArray(role?.key_skills) && role.key_skills.some((item) => String(item || '').trim()),
      Boolean(String(role?.ideal_background || '').trim()),
      Boolean(String(role?.where_to_find || '').trim()),
      Boolean(String(role?.outreach_hook || '').trim()),
    );
  }
  if (!roles.length) checks.push(false);
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
