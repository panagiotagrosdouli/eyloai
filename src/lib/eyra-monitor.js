/**
 * EYRA Autonomous Monitor
 * Fetches real data from OpenAlex, arXiv, Europe PMC.
 * No fabricated results — if data doesn't exist, says so.
 */
import { searchOpenAlexWorks, searchOpenAlexAuthors } from '@/lib/eyra-api';
import { base44 } from '@/api/base44Client';

const LAST_VISIT_KEY = 'eyra_last_visit_ts';

export function getLastVisitTimestamp() {
  const stored = localStorage.getItem(LAST_VISIT_KEY);
  return stored ? parseInt(stored) : null;
}

export function markVisit() {
  localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());
}

// Priority levels based on recency + relevance
function assignPriority(item) {
  const year = item.year || 0;
  const now = new Date().getFullYear();
  const age = now - year;
  if (age === 0) return 'HIGH';
  if (age <= 1) return 'MEDIUM';
  return 'LOW';
}

/**
 * Run the full autonomous monitor for a user's active projects.
 * Returns structured discoveries grouped by type, each with source + evidence.
 */
export async function runMonitor(projects, searchHistory = []) {
  const cacheKey = `eyra_monitor_${new Date().toDateString()}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  // Build search queries from projects + recent searches
  const queries = [];
  projects.slice(0, 3).forEach(p => {
    if (p.title) queries.push({ query: `${p.title} ${(p.goal || '').slice(0, 60)}`.trim(), projectId: p.id, projectTitle: p.title });
  });
  searchHistory.slice(0, 3).forEach(s => {
    if (s.query && !queries.find(q => q.query.includes(s.query))) {
      queries.push({ query: s.query, projectId: null, projectTitle: null });
    }
  });

  if (queries.length === 0) {
    return { papers: [], researchers: [], timestamp: Date.now(), noData: true };
  }

  // Fetch from all sources in parallel
  const allPapers = [];
  const allResearchers = [];

  await Promise.all(queries.map(async ({ query, projectId, projectTitle }) => {
    const [papers, researchers] = await Promise.all([
      searchOpenAlexWorks(query, 6),
      searchOpenAlexAuthors(query, 4),
    ]);
    papers.forEach(p => {
      allPapers.push({
        ...p,
        projectId,
        projectTitle,
        priority: assignPriority(p),
        source_label: p.source || 'OpenAlex',
        data_type: 'real_paper',
        why_relevant: projectTitle ? `Matches your project: "${projectTitle}"` : `Matches your search interest: "${query}"`,
      });
    });
    researchers.forEach(r => {
      allResearchers.push({
        ...r,
        projectId,
        projectTitle,
        priority: r.works_count > 50 ? 'HIGH' : 'MEDIUM',
        source_label: 'OpenAlex',
        data_type: 'real_researcher',
        why_relevant: projectTitle ? `Active in the field of "${projectTitle}"` : `Matches your interest: "${query}"`,
      });
    });
  }));

  // Deduplicate papers by title
  const seenTitles = new Set();
  const uniquePapers = allPapers.filter(p => {
    const key = p.title.toLowerCase().slice(0, 60);
    if (seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  });

  // Deduplicate researchers by name
  const seenNames = new Set();
  const uniqueResearchers = allResearchers.filter(r => {
    if (seenNames.has(r.name)) return false;
    seenNames.add(r.name);
    return true;
  });

  // Sort by priority (HIGH first) then recency
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  uniquePapers.sort((a, b) => (priorityOrder[a.priority] - priorityOrder[b.priority]) || (b.year - a.year));
  uniqueResearchers.sort((a, b) => b.works_count - a.works_count);

  const result = {
    papers: uniquePapers.slice(0, 12),
    researchers: uniqueResearchers.slice(0, 8),
    timestamp: Date.now(),
    queriesRun: queries.length,
    noData: uniquePapers.length === 0 && uniqueResearchers.length === 0,
  };

  localStorage.setItem(cacheKey, JSON.stringify(result));
  return result;
}

/**
 * Use LLM to analyze real discoveries and generate ranked intelligence items.
 * Strictly only references real data passed in — no invention allowed in prompt.
 */
export async function analyzeDiscoveries(monitorResult, projects) {
  const cacheKey = `eyra_analysis_${new Date().toDateString()}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) { try { return JSON.parse(cached); } catch {} }

  if (monitorResult.noData || (monitorResult.papers.length === 0 && monitorResult.researchers.length === 0)) {
    return { items: [], trend: null, gap: null };
  }

  const paperCtx = monitorResult.papers.slice(0, 8).map((p, i) =>
    `[P${i + 1}] "${p.title}" — ${p.authors?.slice(0, 60)} (${p.year}) — ${p.cited_by_count} citations — ${p.source_label} — related to: ${p.projectTitle || 'general interest'}`
  ).join('\n');

  const researcherCtx = monitorResult.researchers.slice(0, 5).map((r, i) =>
    `[R${i + 1}] ${r.name} — ${r.institution} — ${r.works_count} works — related to: ${r.projectTitle || 'general interest'}`
  ).join('\n');

  const projectCtx = projects.slice(0, 3).map(p => `"${p.title}": ${p.goal}`).join('; ');

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are EYRA, an autonomous research intelligence agent. Analyze ONLY the real data below. Do not invent anything.

ACTIVE PROJECTS:
${projectCtx || 'None'}

REAL PAPERS FOUND (from OpenAlex/arXiv/Europe PMC):
${paperCtx}

REAL RESEARCHERS FOUND (from OpenAlex):
${researcherCtx}

Based ONLY on this real data, produce:
1. "items": array of up to 6 intelligence items, each referencing specific papers/researchers above. Each item must have:
   - type: "paper"|"researcher"|"gap"|"trend"
   - title: string (specific — use actual paper titles / researcher names from data)
   - description: string (what this means for the user's research)
   - priority: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"
   - why_relevant: string (specific reason referencing the project)
   - action: string (one concrete next step)
   - confidence: "HIGH"|"MEDIUM"|"LOW"
   - source: string (e.g. "OpenAlex", "arXiv")
   - data_ref: string (paper title or researcher name from the real data, verbatim)

2. "trend": string or null — one sentence about the most prominent theme visible in the real papers (must reference actual paper content)
3. "gap": string or null — one sentence about a research gap visible from the papers (only if genuinely evident from the data)

CRITICAL: Only reference [P1]-[P${Math.min(8, monitorResult.papers.length)}] and [R1]-[R${Math.min(5, monitorResult.researchers.length)}] — never invent new papers, authors, or grants.`,
    response_json_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string' },
              why_relevant: { type: 'string' },
              action: { type: 'string' },
              confidence: { type: 'string' },
              source: { type: 'string' },
              data_ref: { type: 'string' },
            }
          }
        },
        trend: { type: 'string' },
        gap: { type: 'string' },
      }
    }
  });

  const analysis = { items: result?.items || [], trend: result?.trend || null, gap: result?.gap || null };
  localStorage.setItem(cacheKey, JSON.stringify(analysis));
  return analysis;
}
