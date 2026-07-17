import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Sparkles, Loader2, FileText, Users, Lightbulb,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Zap
} from 'lucide-react';
import { searchOpenAlexWorks, searchOpenAlexAuthors } from '@/lib/eyra-api';

/**
 * EyraDigitalTwin — shows REAL data EYRA found for this project.
 * Uses OpenAlex to fetch actual papers and researchers.
 */
export default function EyraDigitalTwin({ project }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!project?.id) return;
    const cacheKey = `eyra_twin_v2_${project.id}_${new Date().toDateString()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { try { setReport(JSON.parse(cached)); return; } catch {} }
    generate(cacheKey);
  }, [project?.id]);

  const generate = async (cacheKey) => {
    if (!project) return;
    setLoading(true);
    const key = cacheKey || `eyra_twin_v2_${project.id}_${new Date().toDateString()}`;

    // Use real search query from project title + goal
    const searchQuery = `${project.title} ${(project.goal || '').slice(0, 80)}`.trim();

    // Fetch REAL data from OpenAlex
    const [papers, researchers] = await Promise.all([
      searchOpenAlexWorks(searchQuery, 5),
      searchOpenAlexAuthors(searchQuery, 4),
    ]);

    const hasPapers = papers.length > 0;
    const hasResearchers = researchers.length > 0;

    if (!hasPapers && !hasResearchers) {
      // No real data found — show honest empty state
      const emptyReport = {
        papers,
        researchers,
        highlights: [],
        next_recommendation: `Try running a full EYRA Analysis on this project to get research insights. Make sure the project title and goal are descriptive enough for EYRA to search.`,
        health_score: null,
        no_data: true,
      };
      setReport(emptyReport);
      localStorage.setItem(key, JSON.stringify(emptyReport));
      setLoading(false);
      return;
    }

    // AI analyzes REAL data only
    const paperContext = papers.map((p, i) =>
      `[Paper ${i + 1}] "${p.title}" by ${p.authors || 'Unknown'} (${p.year}) — ${p.cited_by_count} citations — ${p.source}`
    ).join('\n');

    const researcherContext = researchers.map((r, i) =>
      `[Researcher ${i + 1}] ${r.name} — ${r.institution} — ${r.works_count} works, ${r.citation_count} citations`
    ).join('\n');

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA. Analyze ONLY the real data below for this project and produce a brief intelligence summary.

Project: "${project.title}"
Goal: "${project.goal || ''}"

REAL PAPERS FOUND (from OpenAlex):
${paperContext || 'None found'}

REAL RESEARCHERS FOUND (from OpenAlex):
${researcherContext || 'None found'}

Based ONLY on this real data, provide:
1. highlights: array of 2-3 specific, honest observations about what was found (reference actual paper titles and researcher names from the data)
2. next_recommendation: one specific, actionable next step for this project based on the gaps or opportunities visible in the real data

Do NOT invent papers, researcher names, or statistics not in the data above.`,
      response_json_schema: {
        type: 'object',
        properties: {
          highlights: { type: 'array', items: { type: 'string' } },
          next_recommendation: { type: 'string' },
        },
      },
    });

    const result = {
      papers,
      researchers,
      highlights: analysis.highlights || [],
      next_recommendation: analysis.next_recommendation || '',
      no_data: false,
    };

    setReport(result);
    localStorage.setItem(key, JSON.stringify(result));
    setLoading(false);
  };

  const refresh = () => {
    const key = `eyra_twin_v2_${project.id}_${new Date().toDateString()}`;
    localStorage.removeItem(key);
    setReport(null);
    generate(key);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white">
            <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-background" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Project Intelligence</p>
          <p className="text-sm font-semibold text-foreground">
            {loading ? 'EYRA is scanning OpenAlex...' :
             report?.no_data ? 'No data found — refine your project description' :
             report ? `Found ${report.papers.length} papers · ${report.researchers.length} researchers` :
             'EYRA is ready to scan'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {report && !loading && (
            <button onClick={(e) => { e.stopPropagation(); refresh(); }}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <RefreshCw size={12} />
            </button>
          )}
          {collapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5">
          {loading && (
            <div className="flex items-center gap-2 py-4">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Fetching real papers and researchers from OpenAlex...</span>
            </div>
          )}

          {report && !loading && !report.no_data && (
            <div className="space-y-4">
              {/* Real stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-3 rounded-xl bg-secondary/30">
                  <FileText size={13} className="text-primary mx-auto mb-1" />
                  <p className="font-bold text-lg font-heading text-primary">{report.papers.length}</p>
                  <p className="text-[9px] text-muted-foreground">Real Papers Found</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-secondary/30">
                  <Users size={13} className="text-cyan-400 mx-auto mb-1" />
                  <p className="font-bold text-lg font-heading text-cyan-400">{report.researchers.length}</p>
                  <p className="text-[9px] text-muted-foreground">Real Researchers</p>
                </div>
              </div>

              {/* Real papers list */}
              {report.papers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Recent Papers (OpenAlex)</p>
                  {report.papers.slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/30 border border-border/40">
                      <FileText size={11} className="text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-tight mb-0.5 line-clamp-2">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.authors?.slice(0, 50)} · {p.year} · {p.cited_by_count} citations</p>
                      </div>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0">
                          <ExternalLink size={10} className="text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* AI highlights based on real data */}
              {report.highlights?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">EYRA Analysis</p>
                  {report.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <Sparkles size={11} className="text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{h}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* EYRA recommendation */}
              {report.next_recommendation && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                  <Zap size={13} className="text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">EYRA Recommends</p>
                    <p className="text-xs text-foreground leading-relaxed">{report.next_recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {report?.no_data && (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                No papers or researchers found in OpenAlex for this project's topic. Make sure your project title and goal clearly describe the research area.
              </p>
              <p className="text-xs text-primary">{report.next_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
