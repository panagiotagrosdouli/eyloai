// EYRA Intelligence Engine — Progressive, Cached, Evidence-Based
// Real data streams in immediately → AI analyzes in background → UI updates progressively

import { base44 } from '@/api/base44Client';
import { searchAllPapers, searchOpenAlexAuthors, searchOpenAlexInstitutions } from './eyra-api';

// ── Simple session cache ─────────────────────────────────────
const CACHE_TTL = 15 * 60 * 1000; // 15 min
const _cache = new Map();

function getCached(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { _cache.set(key, { data, ts: Date.now() }); }

// ── Progressive discovery — calls onProgress as each source returns ──
// onProgress(partial) is called multiple times with growing results
export async function runEyraDiscovery(query, onProgress) {
  const cacheKey = `discovery:${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) {
    onProgress && onProgress({ ...cached, fromCache: true, status: 'complete' });
    return cached;
  }

  const partial = { query, papers: [], researchers: [], institutions: [], status: 'loading' };
  onProgress && onProgress({ ...partial });

  // Fire all real-data fetches in parallel, each updating as it resolves
  const papersPromise = searchAllPapers(query).then(papers => {
    partial.papers = papers || [];
    partial.papersLoaded = true;
    onProgress && onProgress({ ...partial });
    return papers || [];
  }).catch(() => { partial.papersLoaded = true; partial.papersError = true; onProgress && onProgress({ ...partial }); return []; });

  const researchersPromise = searchOpenAlexAuthors(query, 8).then(researchers => {
    partial.researchers = researchers || [];
    partial.researchersLoaded = true;
    onProgress && onProgress({ ...partial });
    return researchers || [];
  }).catch(() => { partial.researchersLoaded = true; onProgress && onProgress({ ...partial }); return []; });

  const institutionsPromise = searchOpenAlexInstitutions(query, 6).then(institutions => {
    partial.institutions = institutions || [];
    partial.institutionsLoaded = true;
    onProgress && onProgress({ ...partial });
    return institutions || [];
  }).catch(() => { partial.institutionsLoaded = true; onProgress && onProgress({ ...partial }); return []; });

  // Wait for all real data
  const [papers, researchers, institutions] = await Promise.all([papersPromise, researchersPromise, institutionsPromise]);

  // Signal AI analysis starting
  partial.status = 'analyzing';
  onProgress && onProgress({ ...partial });

  // AI analyzes the real data
  const aiAnalysis = await generateEvidenceBasedAnalysis(query, papers, researchers, institutions);

  const result = { query, papers, researchers, institutions, ...aiAnalysis, status: 'complete' };
  setCache(cacheKey, result);
  onProgress && onProgress({ ...result });
  return result;
}

async function generateEvidenceBasedAnalysis(query, papers, researchers, institutions) {
  const paperContext = papers.slice(0, 8).map((p, i) =>
    `[Paper ${i+1}] "${p.title}" by ${p.authors || 'Unknown'} (${p.year || 'n/a'}) — ${p.cited_by_count || 0} citations — Source: ${p.source}\nAbstract: ${p.summary?.slice(0, 200) || 'No abstract'}`
  ).join('\n\n');

  const researcherContext = researchers.slice(0, 6).map((r, i) =>
    `[Researcher ${i+1}] ${r.name} — ${r.institution} — ${r.works_count} works, ${r.citation_count} citations — Areas: ${r.research_areas}`
  ).join('\n');

  const institutionContext = institutions.slice(0, 4).map((inst, i) =>
    `[Institution ${i+1}] ${inst.name} (${inst.country}) — ${inst.works_count} works, ${inst.cited_by_count} citations`
  ).join('\n');

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are EYRA, an evidence-based AI Research Analyst. Analyze REAL data only.

CRITICAL RULES:
- Only reference researchers, papers, and institutions from the data below. Never invent names.
- Every insight must cite specific evidence from the data.
- If data is insufficient, state confidence as LOW.
- Funding opportunities must be REAL named programs (Horizon Europe, ERC, NSF, NIH, Wellcome Trust, DARPA, etc.)

USER QUERY: "${query}"

=== REAL DATA ===
PAPERS (${papers.length} total from OpenAlex, arXiv, Europe PMC):
${papers.length > 0 ? paperContext : 'No papers found.'}

RESEARCHERS (${researchers.length} total from OpenAlex):
${researchers.length > 0 ? researcherContext : 'None found.'}

INSTITUTIONS (${institutions.length} total):
${institutionContext || 'None found.'}

=== TASKS ===
Return JSON with:
- goal_analysis: string (3-4 sentences analyzing this area using the real data above)
- data_summary: { total_papers, total_researchers, date_range, top_researcher }
- key_findings: array of 4 objects { finding, evidence (cite real paper/researcher), confidence ("HIGH"/"MEDIUM"/"LOW") }
- research_gaps: array of 3 strings (gaps from what papers DON'T cover)
- trends: array of 4 objects { title, description, evidence (real paper), year_range }
- funding_opportunities: array of 5 objects { title (real program), type, description, match_reason, source, url }
- suggested_roles: array of 4 objects { role, expertise, why_needed, evidence }
- roadmap: array of 5 objects { timeframe, title, tasks (array of 3) }
- keywords: array of 8 strings (from real paper titles/abstracts)
- confidence_overall: "HIGH" (8+ papers) / "MEDIUM" (3-7) / "LOW" (<3)`,
    response_json_schema: {
      type: 'object',
      properties: {
        goal_analysis: { type: 'string' },
        data_summary: { type: 'object', properties: { total_papers: { type: 'number' }, total_researchers: { type: 'number' }, date_range: { type: 'string' }, top_researcher: { type: 'string' } } },
        key_findings: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, evidence: { type: 'string' }, confidence: { type: 'string' } } } },
        research_gaps: { type: 'array', items: { type: 'string' } },
        trends: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, evidence: { type: 'string' }, year_range: { type: 'string' } } } },
        funding_opportunities: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, match_reason: { type: 'string' }, source: { type: 'string' }, url: { type: 'string' } } } },
        suggested_roles: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, expertise: { type: 'string' }, why_needed: { type: 'string' }, evidence: { type: 'string' } } } },
        roadmap: { type: 'array', items: { type: 'object', properties: { timeframe: { type: 'string' }, title: { type: 'string' }, tasks: { type: 'array', items: { type: 'string' } } } } },
        keywords: { type: 'array', items: { type: 'string' } },
        confidence_overall: { type: 'string' },
      },
    },
  });

  return result;
}
