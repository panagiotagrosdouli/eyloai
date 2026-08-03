// Browser-safe EYRA compatibility engine.
//
// The original Base44 application delegated these prompts to InvokeLLM.  On
// Vercel we keep the same API contract and return transparent, deterministic
// analysis. Factual discovery remains grounded in the real OpenAlex/arXiv/
// Europe PMC data already included in each prompt.

const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();

function quotedSubject(prompt) {
  const matches = [...String(prompt).matchAll(/(?:Project\/Idea|Project\/Startup|Project|IDEA|WHAT IF QUESTION|interested in|Field|Search focus):?\s*["“]([^"”]+)["”]/gi)];
  return clean(matches.at(-1)?.[1] || 'your research project');
}

function stringFor(name, prompt) {
  const subject = quotedSubject(prompt);
  const values = {
    message: 'Review your highest-priority project and complete one concrete next step today.',
    action: 'Open projects', href: '/projects', label: clean(name.replaceAll('_', ' ')),
    project_summary: `${subject} is evaluated as a research and innovation initiative requiring evidence, validation, and focused execution.`,
    goal_analysis: `The available sources provide an evidence base for ${subject}. Review the retrieved papers, researchers, and institutions before making strategic decisions; confidence depends on the amount and recency of the source data.`,
    confidence_overall: /PAPERS \(([89]|\d{2,}) total/i.test(prompt) ? 'HIGH' : /PAPERS \([3-7] total/i.test(prompt) ? 'MEDIUM' : 'LOW',
    eyra_recommendation: 'Use the growth path: validate the highest-risk assumption first, then expand only after measurable evidence.',
    critical_decision: 'Define a measurable validation milestone before committing significant funding or hiring.',
    eyra_team_insight: 'Start with the smallest cross-functional team that can validate the core scientific and user assumptions.',
    first_hire_advice: 'Prioritize the missing role that can reduce the project’s largest technical or market risk.',
    summary: `This scenario can improve progress on ${subject}, provided that assumptions are tested with evidence and clear milestones.`,
    timeline_change: 'Expect the timeline to change after the first validation milestone.',
    eyra_verdict: 'Proceed as a controlled experiment, measure the result, and reassess before scaling.',
    strategic_insight: 'This path balances learning speed with risk. Success depends on early validation and disciplined milestone reviews.',
    funding_path: 'Validation grant → pre-seed or research funding → milestone-based growth funding',
    competition_level: 'Moderate', maturity: 'Emerging', trend_direction: 'Stable',
  };
  return values[name] || `EYRA analysis for ${clean(name.replaceAll('_', ' '))}: use verified evidence, define a measurable next step, and review assumptions before acting.`;
}

function numberFor(name) {
  if (/probability/i.test(name)) return 58;
  if (/score/i.test(name)) return 68;
  if (/total/i.test(name)) return 0;
  return 3;
}

function arrayLength(name) {
  if (/milestones|roadmap|recommended_actions|hiring_sequence/i.test(name)) return 4;
  if (/keywords|tasks/i.test(name)) return 3;
  if (/opportunities|dream_team|feed|items/i.test(name)) return 3;
  return 2;
}

function objectOverrides(name, prompt, index) {
  const subject = quotedSubject(prompt);
  if (/^(conservative|growth|aggressive)$/.test(name)) {
    const config = {
      conservative: ['Conservative Path', 72, '4–6 years to impact', '€250K–€1M', '3–5 people'],
      growth: ['Growth Path', 58, '2–4 years to impact', '€1M–€5M', '6–12 people'],
      aggressive: ['Aggressive Path', 34, '12–24 months to market', '€5M–€15M', '15–30 people'],
    }[name];
    return { label: config[0], tagline: stringFor('strategic_insight', prompt), success_probability: config[1], timeline: config[2], funding_required: config[3], team_size: config[4], key_milestones: ['Validate the core problem', 'Build and test a prototype', 'Measure adoption and outcomes', 'Scale after evidence'], top_risks: ['Insufficient validation', 'Execution capacity'], key_strengths: ['Focused learning', 'Milestone-based decisions'], ideal_team: ['Domain expert', 'Technical lead', 'Product and partnerships lead'], funding_path: stringFor('funding_path', prompt), strategic_insight: stringFor('strategic_insight', prompt) };
  }
  if (/opportunities?/.test(name)) return { title: ['Horizon Europe', 'European Research Council (ERC)', 'EIC Accelerator'][index % 3], type: ['grant', 'call', 'accelerator'][index % 3], description: `A real European programme that may be relevant to ${subject}. Verify the current call, deadline, budget, and eligibility on its official website.`, eligibility: 'Eligibility varies by active call and country.', typical_amount: 'Varies by call', deadline: 'Verify current official call', match_score: 8 - index, difficulty: 'High', source: 'Official programme website', url: 'https://commission.europa.eu/funding-tenders/opportunities/portal/' };
  if (/dream_team/.test(name)) return { role: ['Domain Research Lead', 'Technical Lead', 'Product & Partnerships Lead'][index % 3], category: ['Research', 'Engineering', 'Business'][index % 3], priority: index === 0 ? 'Critical' : 'High', why_needed: 'Reduces a critical project risk and owns measurable delivery.', key_skills: ['Domain expertise', 'Evidence-based execution', 'Cross-functional communication'], ideal_background: 'Demonstrated experience in the project domain and shipping validated work.', where_to_find: 'Relevant conferences, research networks, professional communities, and trusted referrals.', outreach_hook: 'Clear mission, measurable impact, and meaningful ownership.', seniority: 'Senior', equity_range: 'Role and stage dependent' };
  if (/consortium_partners/.test(name)) return { type: 'Research or industry partner', role: 'Independent validation, specialist expertise, and access to users or infrastructure.', ideal: 'A credible organization with directly relevant evidence and capabilities.' };
  if (/key_findings|items|feed/.test(name)) return { type: 'insight', title: `Evidence review ${index + 1}`, finding: 'The retrieved sources should be reviewed for direct relevance and methodological quality.', description: 'EYRA is using the real records shown in this screen; open the source before relying on the result.', evidence: 'Retrieved source data in this analysis', priority: index === 0 ? 'HIGH' : 'MEDIUM', why_relevant: `Relevant to ${subject}`, action: 'Open and verify the source', confidence: 'MEDIUM', source: 'OpenAlex / arXiv / Europe PMC', data_ref: 'Retrieved record' };
  return null;
}

function fromSchema(schema, prompt, name = 'result', index = 0) {
  if (!schema) return null;
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === 'string') return stringFor(name, prompt);
  if (schema.type === 'number' || schema.type === 'integer') return numberFor(name);
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return Array.from({ length: arrayLength(name) }, (_, i) => fromSchema(schema.items || { type: 'string' }, prompt, name, i));
  if (schema.type === 'object' || schema.properties) {
    const override = objectOverrides(name, prompt, index);
    const generated = Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, fromSchema(value, prompt, key, index)]));
    return { ...generated, ...(override || {}) };
  }
  return null;
}

function markdownAnalysis(prompt) {
  const subject = quotedSubject(prompt);
  return `## EYRA analysis\n\n**Focus:** ${subject}\n\n### Evidence and assumptions\nUse the verified sources and project data shown in EYLO. Any programme, deadline, researcher, or publication should be confirmed at its official source before action.\n\n### Recommended next steps\n1. Define one measurable outcome and the main assumption to validate.\n2. Review the most relevant retrieved evidence and record what supports or contradicts the idea.\n3. Run a small validation milestone with a clear owner and deadline.\n4. Reassess scope, collaborators, and funding only after the result.\n\n### EYRA confidence\n**Medium** — strategic guidance is available, while factual confidence depends on the connected source data.`;
}

export async function invokeEyra({ prompt = '', response_json_schema: schema } = {}) {
  // Keep the asynchronous contract of the original SDK.
  await Promise.resolve();
  return schema ? fromSchema(schema, prompt) : markdownAnalysis(prompt);
}

