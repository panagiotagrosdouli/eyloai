import React, { useState } from 'react';
import { saveScholarlyPaper } from '@/lib/research-gap-literature-save.mjs';
import { motion } from 'framer-motion';
import {
  FileText, Users, Building2, TrendingUp, DollarSign,
  Map, Bookmark, ExternalLink, ChevronRight,
  Award, Target, BookOpen, Sparkles,
  AlertTriangle, CheckCircle2, Plus, ArrowRight,
  ShieldCheck, Info, Lock, Compass, Clock3, Layers3
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { EyraSectionLabel } from '@/components/eyra/EyraBadge';
import { useToast } from '@/components/ui/use-toast';
import PaperSummary from '@/components/eyra/PaperSummary';
import { Link, useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Target },
  { key: 'papers', label: 'Research', icon: FileText },
  { key: 'researchers', label: 'Researchers', icon: Users },
  { key: 'institutions', label: 'Institutions', icon: Building2 },
  { key: 'roadmap', label: 'Roadmap', icon: Map },
  { key: 'funding', label: 'Funding', icon: DollarSign },
];

const CONFIDENCE_CONFIG = {
  HIGH: { color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Broad source coverage' },
  MEDIUM: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Moderate source coverage' },
  LOW: { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Limited source coverage' },
};

function ConfidenceBadge({ level }) {
  const cfg = CONFIDENCE_CONFIG[level] || CONFIDENCE_CONFIG.MEDIUM;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <ShieldCheck size={8} /> {cfg.label}
    </span>
  );
}

function EvidenceNote({ text }) {
  if (!text) return null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground/70 italic">
      <Info size={10} className="flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

export default function DiscoveryResults({ results, onNewSearch }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectCreated, setProjectCreated] = useState(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [searchSaved, setSearchSaved] = useState(Boolean(results.search_saved));
  const { toast } = useToast();
  const navigate = useNavigate();

  const saveOrAttach = async (entityName, matchKey, matchValue, payload, project = null) => {
    if (entityName === 'SavedPaper') {
      try {
        const record = await saveScholarlyPaper({ entities: base44.entities, paper: { ...payload, id: payload.source_id }, project });
        return { record, linked: Boolean(project && record.project_id === project.id), conflict: false };
      } catch (error) {
        if (error?.code === 'PAPER_PROJECT_CONFLICT') return { record: error.record, linked: false, conflict: true };
        throw error;
      }
    }

    const withProject = project
      ? { ...payload, project_id: project.id, project_title: project.title || '' }
      : payload;
    let existing = null;
    try {
      const matches = await base44.entities[entityName].filter({ [matchKey]: matchValue }, '-created_date', 1);
      existing = Array.isArray(matches) ? matches.find(item => item[matchKey] === matchValue) || matches[0] : null;
    } catch {
      // A failed lookup should not prevent saving a source record.
    }
    if (existing) {
      if (!project || existing.project_id === project.id) {
        return { record: existing, linked: Boolean(project && existing.project_id === project.id), conflict: false };
      }
      if (existing.project_id) return { record: existing, linked: false, conflict: true };
      const record = await base44.entities[entityName].update(existing.id, withProject);
      return { record, linked: true, conflict: false };
    }
    const record = await base44.entities[entityName].create(withProject);
    return { record, linked: Boolean(project), conflict: false };
  };

  const savePaper = async (paper) => {
    const sourceId = paper.id || paper.doi || paper.url || paper.title;
    try {
      const saved = await saveOrAttach('SavedPaper', 'source_id', sourceId, {
        source_id: sourceId,
        doi: paper.doi || '',
        title: paper.title,
        authors: paper.authors,
        summary: paper.summary,
        year: paper.year,
        source: paper.source,
        source_index: paper.source_index || paper.source,
        indexed_by: paper.indexed_by || [], source_records: paper.source_records || [], summary_source: paper.summary_source || '', metadata_conflict: Boolean(paper.metadata_conflict),
        cited_by_count: paper.cited_by_count,
        authorships: paper.authorships || [],
        openalex_topics: paper.openalex_topics || [],
        referenced_work_ids: paper.referenced_work_ids || [],
        open_access: paper.open_access,
        url: paper.url,
      }, projectCreated);
      toast({
        title: saved.conflict ? 'Paper is linked to another project' : projectCreated ? 'Paper added to project' : saved.linked ? 'Paper already in this project' : 'Paper saved to library',
        description: saved.conflict ? 'It was left in its current project.' : undefined,
      });
    } catch (error) {
      toast({ title: 'Could not save this paper', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const saveResearcher = async (r) => {
    const openalexId = r.openalex_id || r.id || r.name;
    try {
      const saved = await saveOrAttach('SavedResearcher', 'openalex_id', openalexId, {
        openalex_id: openalexId,
        source: 'OpenAlex',
        name: r.name,
        institution: r.institution,
        country: r.country,
        research_areas: r.research_areas,
        selected_publications: r.selected_publications || [],
        biography: r.biography || '',
        orcid: r.orcid || '',
        profile_photo_url: r.profile_photo_url || '',
        works_count: r.works_count,
        citation_count: r.citation_count,
        profile_url: r.profile_url,
      }, projectCreated);
      toast({
        title: saved.conflict ? 'Researcher is linked to another project' : projectCreated ? 'Researcher added to project' : saved.linked ? 'Researcher already in this project' : 'Researcher saved to library',
        description: saved.conflict ? 'They were left in their current project.' : undefined,
      });
    } catch (error) {
      toast({ title: 'Could not save this researcher', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const saveSearch = async () => {
    if (savingSearch || searchSaved) return;
    setSavingSearch(true);
    const profile = results.discovery_profile || {};
    const payload = {
      query: results.query,
      level: profile.level || 'researcher',
      goal: profile.goal || 'review',
      recency: profile.recency || 'balanced',
      source_indexes: results.source_indexes || [],
      retrieval_status: results.retrieval_status || 'complete',
      results_summary: `${results.papers?.length || 0} papers, ${results.researchers?.length || 0} researchers`,
      saved: true,
      saved_at: new Date().toISOString(),
    };

    try {
      if (results.search_history_id) {
        await base44.entities.SearchHistory.update(results.search_history_id, payload);
      } else {
        await base44.entities.SearchHistory.create(payload);
      }
      setSearchSaved(true);
      toast({ title: 'Search saved', description: 'Run the same research profile again from EYRA Activity.' });
    } catch (error) {
      toast({ title: 'Could not save this search', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingSearch(false);
    }
  };

  const createProject = async () => {
    setCreatingProject(true);
    try {
      const project = await base44.entities.Project.create({
        title: results.query || 'New Research Project',
        goal: results.query,
        eyra_analysis: results.goal_analysis || '',
        status: 'active',
      });
      const uniqueTop = (items, identifier) => [...new globalThis.Map(
        (items || []).filter(item => item?.title || item?.name)
          .map(item => [item[identifier] || item.id || item.doi || item.source_id || item.name || item.title, item]),
      ).values()];
      const papers = uniqueTop(results.papers, 'id').slice(0, 5);
      const researchers = uniqueTop(results.researchers, 'openalex_id').slice(0, 3);
      const opportunities = uniqueTop(results.funding_opportunities, 'source_id').slice(0, 2);
      const seeds = [
        ...papers.map(paper => ({
          kind: 'papers',
          run: () => saveOrAttach('SavedPaper', 'source_id', paper.id || paper.doi || paper.url || paper.title, {
            source_id: paper.id || paper.doi || paper.url || paper.title,
            doi: paper.doi || '',
            title: paper.title,
            authors: paper.authors,
            summary: paper.summary,
            year: paper.year,
            source: paper.source,
            source_index: paper.source_index || paper.source,
            indexed_by: paper.indexed_by || [], source_records: paper.source_records || [], summary_source: paper.summary_source || '', metadata_conflict: Boolean(paper.metadata_conflict),
            cited_by_count: paper.cited_by_count,
            open_access: paper.open_access,
            url: paper.url,
          }, project),
        })),
        ...researchers.map(researcher => {
          const openalexId = researcher.openalex_id || researcher.id || researcher.name;
          return {
            kind: 'researchers',
            run: () => saveOrAttach('SavedResearcher', 'openalex_id', openalexId, {
              openalex_id: openalexId,
              source: 'OpenAlex',
              name: researcher.name,
              institution: researcher.institution,
              country: researcher.country,
              research_areas: researcher.research_areas,
              works_count: researcher.works_count,
              citation_count: researcher.citation_count,
              profile_url: researcher.profile_url,
            }, project),
          };
        }),
        ...opportunities.map(opportunity => {
          const sourceId = opportunity.source_id || opportunity.id || opportunity.source_url || opportunity.url || opportunity.title;
          return {
            kind: 'opportunities',
            run: () => saveOrAttach('SavedOpportunity', 'source_id', sourceId, {
              title: opportunity.title,
              type: opportunity.type,
              description: opportunity.description,
              source: opportunity.source || 'Grants.gov',
              source_id: sourceId,
              url: opportunity.source_url || opportunity.url,
              agency: opportunity.agency,
              eligibility: opportunity.eligibility,
              deadline: opportunity.deadline,
              amount: opportunity.amount,
              status: opportunity.status,
            }, project),
          };
        }),
      ];
      const outcomes = await Promise.allSettled(seeds.map(async seed => ({ kind: seed.kind, ...(await seed.run()) })));
      const linkedCounts = { papers: 0, researchers: 0, opportunities: 0 };
      let linkIssues = 0;
      outcomes.forEach(outcome => {
        if (outcome.status !== 'fulfilled' || !outcome.value.linked) {
          linkIssues += 1;
          return;
        }
        linkedCounts[outcome.value.kind] += 1;
      });
      setProjectCreated({ ...project, linkedCounts, linkIssues });
      const linkedSummary = Object.entries(linkedCounts).filter(([, count]) => count > 0).map(([kind, count]) => `${count} ${kind}`).join(', ');
      toast({
        title: 'Project workspace created',
        description: linkedSummary ? `Added ${linkedSummary} from this search.` : 'Open the project to start organizing your research.',
      });
    } catch {
      toast({ title: 'Could not create project', variant: 'destructive' });
    } finally {
      setCreatingProject(false);
    }
  };

  const evidenceCoverage = results.confidence_overall || (
    (results.papers?.length || 0) >= 8 ? 'HIGH' :
    (results.papers?.length || 0) >= 3 ? 'MEDIUM' : 'LOW'
  );
  const discoveryProfile = results.discovery_profile || { level: 'researcher', goal: 'review', recency: 'balanced' };
  const sourceIndexes = results.source_indexes || [...new Set((results.papers || []).map(paper => paper.source_index || paper.source).filter(Boolean))];
  const startHere = (results.papers || []).filter(paper => paper.discovery_category === 'start_here').slice(0, 3);
  const latestPapers = (results.papers || []).filter(paper => paper.discovery_category === 'latest' && !startHere.includes(paper));
  const foundationalPapers = (results.papers || []).filter(paper => paper.discovery_category === 'foundational' && !startHere.includes(paper));
  const usedPaperIds = new Set([...startHere, ...latestPapers, ...foundationalPapers].map(paper => paper._dedupeKey || paper.id));
  const relevantPapers = (results.papers || []).filter(paper => !usedPaperIds.has(paper._dedupeKey || paper.id));

  return (
    <div className="max-w-5xl mx-auto px-4 pb-20">

      {/* Header */}
      <div className="py-5 mb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <EyraSectionLabel label="EYRA Discovery Report" />
              <ConfidenceBadge level={evidenceCoverage} />
            </div>
            <h2 className="font-heading font-bold text-lg text-foreground">"{results.query}"</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {results.papers?.length || 0} papers · {results.researchers?.length || 0} researchers · {results.institutions?.length || 0} institutions
              <span className="ml-2 text-primary/70">· {sourceIndexes.length} scholarly indexes + official funding records</span>
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={saveSearch}
              disabled={savingSearch || searchSaved}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-default ${searchSaved ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'}`}
            >
              {savingSearch
                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                : searchSaved ? <CheckCircle2 size={15} /> : <Bookmark size={15} />}
              {searchSaved ? 'Search saved' : 'Save search'}
            </button>
            {!projectCreated ? (
              <button
                onClick={createProject}
                disabled={creatingProject}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl eyra-gradient text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
              >
                {creatingProject
                  ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Plus size={15} />}
                Create Project
              </button>
            ) : (
              <Link to={`/projects/${projectCreated.id}`}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm font-bold flex-shrink-0">
                <CheckCircle2 size={15} /> Open Project
              </Link>
            )}
          </div>
        </div>

        {projectCreated && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0">
              <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-2">Project created · {projectCreated.linkedCounts?.papers || 0} papers, {projectCreated.linkedCounts?.researchers || 0} researchers and {projectCreated.linkedCounts?.opportunities || 0} opportunities added.</p>
              {projectCreated.linkIssues > 0 && <p className="mb-2 text-[11px] text-amber-500">{projectCreated.linkIssues} item(s) could not be linked or already belong to another project.</p>}
              <div className="flex flex-wrap gap-2">
                {[{ label: 'Researchers', tab: 'researchers' }, { label: 'Funding', tab: 'funding' }, { label: 'Roadmap', tab: 'roadmap' }].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                    <ArrowRight size={10} /> {item.label}
                  </button>
                ))}
                <Link to={`/projects/${projectCreated.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-medium">
                  <Sparkles size={10} /> Open project →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Data transparency banner */}
      <div className="mb-5 px-4 py-3 rounded-xl border border-border/50 bg-secondary/30 flex items-center gap-3">
        <Lock size={12} className="text-primary flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Retrieved records and AI interpretation are different.</span> Source records come from connected scholarly indexes; funding fields come from Grants.gov. Source coverage does not measure scientific correctness. EYRA's claims require independent source checks; excerpt-based AI review is only a preliminary safeguard.
        </p>
      </div>

      {results.retrieval_warning && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-300">
          {results.retrieval_warning} The verified records that did load remain available below.
        </div>
      )}
      {results.ai_status === 'failed' && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Verified source records are available, but EYRA analysis did not complete: {results.ai_error}
        </div>
      )}
      {results.ai_status === 'skipped' && (
        <div role="status" className="mb-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-5 text-muted-foreground">
          {results.ai_error} No AI synthesis has been fabricated.
        </div>
      )}
      {results.evidence_review_warning && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs leading-5 text-amber-300">
          {results.evidence_review_warning}
        </div>
      )}
      {results.evidence_review?.status === 'model_assessed' && (
        <div role="status" className="mb-4 rounded-xl border border-border bg-secondary/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
          EYRA performed a separate AI review of cited abstract excerpts: {results.evidence_review.claims_retained} of {results.evidence_review.claims_checked} claims passed. This does not establish scientific truth. Confirm findings against original full-text studies.
        </div>
      )}
      {results.funding_error && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Research records loaded. Funding retrieval did not complete: {results.funding_error}
        </div>
      )}

      <section className="relative mb-6 overflow-hidden rounded-[1.75rem] border border-cyan-200/10 bg-slate-950/75 p-5 sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300"><Compass size={10} /> Your research path</span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[9px] text-slate-400">{discoveryProfile.level}</span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[9px] text-slate-400">{discoveryProfile.goal}</span>
              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[9px] text-slate-400">{String(discoveryProfile.recency).replace('_', ' ')}</span>
            </div>
            <h2 className="mt-4 font-heading text-xl font-bold text-white sm:text-2xl">Begin with context, then move to the frontier.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{results.audience_summary || results.goal_analysis || (results.papers?.length ? 'The retrieved evidence is organized for your stated level and goal.' : 'No scholarly paper record was available for an evidence-based synthesis.')}</p>
            <div className="mt-4 flex flex-wrap gap-2">{sourceIndexes.map(source => <span key={source} className="rounded-full border border-white/5 bg-white/[0.025] px-2.5 py-1 text-[9px] text-slate-400">{source}</span>)}</div>
          </div>
          {results.papers?.length > 0 && (
            <button type="button" onClick={() => setActiveTab('papers')} className="inline-flex items-center justify-center gap-2 rounded-xl eyra-gradient px-4 py-2.5 text-xs font-semibold text-white"><BookOpen size={13} /> Open paper path</button>
          )}
        </div>
        {results.recommended_next_questions?.length > 0 && (
          <div className="relative mt-5 border-t border-white/5 pt-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Continue with</p>
            <div className="flex flex-wrap gap-2">{results.recommended_next_questions.map(question => (
              <button key={question} type="button" onClick={() => onNewSearch({ ...discoveryProfile, topic: question })} className="rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2 text-left text-[10px] text-slate-300 hover:border-cyan-300/20 hover:text-cyan-200">{question}</button>
            ))}</div>
          </div>
        )}
      </section>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 border-b border-border/60">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* EYRA Goal Analysis */}
          {results.goal_analysis && (
            <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <EyraSectionLabel label="EYRA Analysis" />
                </div>
                <ConfidenceBadge level={evidenceCoverage} />
              </div>
              <p className="text-sm leading-relaxed text-foreground">{results.goal_analysis}</p>

              {/* Data summary */}
              {results.data_summary && (
                <div className="mt-4 pt-4 border-t border-primary/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Papers analysed', value: results.data_summary.total_papers },
                    { label: 'Researchers found', value: results.data_summary.total_researchers },
                    { label: 'Publication range', value: results.data_summary.date_range },
                    { label: 'Top cited author', value: results.data_summary.top_researcher || '—' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="font-bold text-sm text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Papers Found', value: results.papers?.length || 0, icon: FileText, color: 'text-primary bg-primary/10', tab: 'papers' },
              { label: 'Researchers', value: results.researchers?.length || 0, icon: Users, color: 'text-accent bg-accent/10', tab: 'researchers' },
              { label: 'Institutions', value: results.institutions?.length || 0, icon: Building2, color: 'text-chart-3 bg-chart-3/10', tab: 'institutions' },
              { label: 'Opportunities', value: results.funding_opportunities?.length || 0, icon: Award, color: 'text-chart-4 bg-chart-4/10', tab: 'funding' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <button key={s.label} onClick={() => setActiveTab(s.tab)}
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors text-left">
                  <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                    <Icon size={13} />
                  </div>
                  <div className="text-xl font-bold font-heading">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </button>
              );
            })}
          </div>

          {/* Key Findings from real data */}
          {results.key_findings?.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <ShieldCheck size={13} className="text-primary" />
                Key findings · AI-reviewed abstract excerpts
              </h3>
              <div className="space-y-2">
                {results.key_findings.map((f, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm text-foreground font-medium flex-1">{f.finding}</p>
                      <span className="text-[10px] text-muted-foreground">AI-reviewed excerpt</span>
                    </div>
                    <EvidenceNote text={f.evidence} />
                    {f.source_excerpt && <p className="mt-2 text-xs italic text-muted-foreground">Excerpt: “{f.source_excerpt}”</p>}
                    {f.source_url && <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">Read cited source <ExternalLink size={11} /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 papers */}
          {results.papers?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Start here · selected for your level</h3>
                <button onClick={() => setActiveTab('papers')} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {(startHere.length ? startHere : results.papers.slice(0, 3)).map((p, i) => (
                  <PaperCard key={i} paper={p} onSave={() => savePaper(p)} projectId={projectCreated?.id || ''} rank={i + 1} />
                ))}
              </div>
            </div>
          )}

          {/* Research gaps */}
          {results.research_gaps?.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-400" />
                Potential research gaps to investigate
                <span className="text-[10px] text-muted-foreground font-normal ml-1">AI interpretation of retrieved literature — not established facts</span>
              </h3>
              <div className="space-y-2">
                <p className="mb-3 text-xs leading-5 text-muted-foreground">These directions require checking the original studies and contrary evidence. The available search results cannot prove that a gap exists.</p>
                {(results.papers || []).filter(paper => paper.url && paper.title).length > 0 && (
                  <div className="mb-4 rounded-xl border border-border/80 bg-secondary/20 p-4">
                    <p className="text-xs font-semibold text-foreground">Literature to check before treating any gap as established</p>
                    <p className="mt-1 text-xs text-muted-foreground">These are retrieved records, not automatically verified support for each claim. Read the full studies and look for contradicting evidence.</p>
                    <div className="mt-3 flex flex-col gap-2">
                      {(results.papers || []).filter(paper => paper.url && paper.title).slice(0, 4).map(paper => (
                        <a key={paper._dedupeKey || paper.id || paper.url} href={paper.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-xs text-primary hover:underline">
                          <ExternalLink size={12} className="mt-0.5 shrink-0" /> {paper.title}{paper.year ? ` (${paper.year})` : ''}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {results.research_gaps.map((gap, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card">
                    <div className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {results.keywords?.length > 0 && (
            <div>
              <h3 className="font-semibold text-xs mb-3 text-muted-foreground uppercase tracking-wider">Research Keywords · Extracted from real papers</h3>
              <div className="flex flex-wrap gap-2">
                {results.keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-foreground border border-border/60">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {!projectCreated && (
            <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex-shrink-0">
                <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-foreground mb-1">Turn this into a project workspace</p>
                <p className="text-xs text-muted-foreground mb-3">Save researchers, track progress, get EYRA's ongoing strategic guidance.</p>
                <button onClick={createProject} disabled={creatingProject}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold">
                  <Plus size={12} /> Create Project Workspace
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* PAPERS */}
      {activeTab === 'papers' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-heading font-bold text-lg">Research Papers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Deduplicated and organized by purpose · {sourceIndexes.join(' · ')}</p>
            </div>
            <ConfidenceBadge level={evidenceCoverage} />
          </div>

          {results.papers?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <FileText size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No papers found in the connected indexes for this query.</p>
              <p className="text-xs text-muted-foreground mt-1">Try a more specific topic or a different time range.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {[
                { key: 'start', title: 'Start here', desc: 'An approachable entry path for your level and goal.', icon: Compass, papers: startHere },
                { key: 'latest', title: 'Latest research', desc: 'Recent records kept visible as a distinct frontier scan.', icon: Clock3, papers: latestPapers },
                { key: 'foundation', title: 'Foundational & surveys', desc: 'Context, established methods, and broad synthesis.', icon: Layers3, papers: foundationalPapers },
                { key: 'relevant', title: 'More relevant evidence', desc: 'Additional deduplicated results across the connected indexes.', icon: BookOpen, papers: relevantPapers },
              ].filter(group => group.papers.length).map(group => {
                const GroupIcon = group.icon;
                return (
                  <section key={group.key}>
                    <div className="mb-3 flex items-start gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GroupIcon size={14} /></span>
                      <div><h3 className="text-sm font-semibold">{group.title}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{group.desc}</p></div>
                    </div>
                    <div className="space-y-3">{group.papers.map((paper, index) => <PaperCard key={paper._dedupeKey || paper.id || paper.title} paper={paper} onSave={() => savePaper(paper)} projectId={projectCreated?.id || ''} rank={index + 1} />)}</div>
                  </section>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* RESEARCHERS */}
      {activeTab === 'researchers' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <EyraSectionLabel label="EYRA Researcher Intelligence" className="mb-1" />
              <p className="text-xs text-muted-foreground">{results.researchers?.length || 0} real experts found via OpenAlex · Recommended by EYRA</p>
            </div>
          </div>

          {results.researchers?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Users size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No researchers found for this exact query.</p>
              <Link to="/researchers" className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary font-medium hover:underline">
                <Sparkles size={11} /> Try the Researcher Discovery tool
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.researchers.map((r, i) => (
                <ResearcherCard
                  key={i}
                  researcher={{
                    ...r,
                    selected_publications: (results.papers || [])
                      .filter(paper => (paper.author_ids || []).includes(r.openalex_id || r.id))
                      .slice(0, 3),
                  }}
                  onSave={() => saveResearcher({
                    ...r,
                    selected_publications: (results.papers || [])
                      .filter(paper => (paper.author_ids || []).includes(r.openalex_id || r.id))
                      .slice(0, 3)
                      .map(({ title, year, doi, url }) => ({ title, year, doi, url })),
                  })}
                />
              ))}
            </div>
          )}

          {/* AI-suggested roles — clearly labelled as AI */}
          {results.suggested_roles?.length > 0 && (
            <div className="mt-8">
              <EyraSectionLabel label="EYRA Collaboration Suggestions" className="mb-1" />
              <p className="text-[11px] text-muted-foreground mb-3">Based on gaps identified in the real researcher data above</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.suggested_roles.map((role, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <h4 className="font-semibold text-sm mb-1">{role.role}</h4>
                    <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Expertise:</span> {role.expertise}</p>
                    <p className="text-xs text-muted-foreground mb-2">{role.why_needed}</p>
                    {role.evidence && <EvidenceNote text={role.evidence} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* INSTITUTIONS */}
      {activeTab === 'institutions' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-4">
            <h2 className="font-heading font-bold text-lg">Institutions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Real institutions from OpenAlex database</p>
          </div>
          {results.institutions?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Building2 size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No institutions found for this topic.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.institutions.map((inst, i) => (
                <div key={i} className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{inst.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{inst.type}{inst.country && ` · ${inst.country}`}</p>
                    </div>
                    {inst.url && (
                      <a href={inst.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <ExternalLink size={13} className="text-muted-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span>{(inst.works_count || 0).toLocaleString()} works</span>
                    <span>{(inst.cited_by_count || 0).toLocaleString()} citations</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ROADMAP */}
      {activeTab === 'roadmap' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6">
            <EyraSectionLabel label="EYRA Action Roadmap" className="mb-1" />
            <p className="text-xs text-muted-foreground">Generated by EYRA · Analyzed from {results.papers?.length || 0} real papers</p>
          </div>
          {results.roadmap?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Map size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Create a project to generate a detailed personalized roadmap.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {results.roadmap.map((step, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full eyra-gradient flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{i + 1}</div>
                    {i < results.roadmap.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-8 flex-1">
                    <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">{step.timeframe}</div>
                    <h4 className="font-semibold text-sm mb-2 text-foreground">{step.title}</h4>
                    <ul className="space-y-1.5">
                      {step.tasks?.map((task, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-primary/50 mt-0.5 flex-shrink-0" />
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* FUNDING */}
      {activeTab === 'funding' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <EyraSectionLabel label="EYRA Funding Intelligence" className="mb-1" />
              <p className="text-xs text-muted-foreground">Official funding records retrieved for your research query</p>
            </div>
            <Link to="/radar" className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
              <Sparkles size={11} /> Run full Radar
            </Link>
          </div>

          {/* Trends from real papers */}
          {results.trends?.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Potential trends · AI-reviewed abstract excerpts</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {results.trends.map((t, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 mb-1.5">
                      <TrendingUp size={12} className="text-green-400" />
                      <h4 className="font-semibold text-sm">{t.title}</h4>
                      {t.year_range && <span className="text-[10px] text-muted-foreground ml-auto">{t.year_range}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    {t.evidence && <EvidenceNote text={`Citation: ${t.evidence}`} />}
                    {t.source_excerpt && <p className="mt-2 text-xs italic text-muted-foreground">Excerpt: “{t.source_excerpt}”</p>}
                    {t.source_url && <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">Read cited source <ExternalLink size={11} /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.funding_opportunities?.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center">
              <Award size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No opportunities matched. Try the Opportunity Radar for deeper results.</p>
              <Link to="/radar" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl eyra-gradient text-white text-xs font-semibold">
                <Sparkles size={11} /> Run Opportunity Radar
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {results.funding_opportunities.map((f, i) => {
                const typeColors = {
                  grant: 'bg-primary/15 text-primary',
                  competition: 'bg-amber-500/15 text-amber-400',
                  accelerator: 'bg-green-500/15 text-green-400',
                  scholarship: 'bg-accent/15 text-accent',
                };
                return (
                  <div key={i} className="p-5 rounded-xl border border-border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${typeColors[f.type] || 'bg-secondary text-foreground'}`}>{f.type}</span>
                          {f.source && <span className="text-[10px] text-muted-foreground">via {f.source}</span>}
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{f.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-2">{f.description}</p>
                        {f.match_reason && (
                          <div className="flex items-start gap-1.5">
                            <ShieldCheck size={10} className="text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-primary italic">{f.match_reason}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] text-muted-foreground">
                          {f.amount && <span className="font-semibold text-primary">{f.amount}</span>}
                          {f.deadline && <span>Deadline: {f.deadline}</span>}
                          {f.agency && <span>{f.agency}</span>}
                          {f.url && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary font-medium hover:underline">
                              <ExternalLink size={10} /> Open Grant Page
                            </a>
                          )}
                          {f.source && <span className="text-[10px] text-muted-foreground">Source: {f.source}</span>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          await base44.entities.SavedOpportunity.create({
                            source: f.source,
                            source_id: f.source_id || f.id,
                            title: f.title,
                            type: f.type,
                            description: f.description,
                            url: f.url,
                            deadline: f.deadline,
                            amount: f.amount,
                            agency: f.agency,
                            eligibility: f.eligibility,
                            status: f.status,
                          });
                          toast({ title: 'Opportunity saved' });
                        }}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                      >
                        <Bookmark size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                ⚠ Always verify funding opportunities on official program websites before applying.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function PaperCard({ paper, onSave, projectId, rank }) {
  const navigate = useNavigate();
  const getImpactLevel = (cited) => {
    if (cited > 500) return { label: 'Highly cited', color: 'text-primary bg-primary/10' };
    if (cited > 100) return { label: 'Well cited', color: 'text-green-400 bg-green-500/10' };
    if (cited > 10) return { label: 'Cited', color: 'text-muted-foreground bg-secondary' };
    return null;
  };
  const impact = paper.cited_by_count > 0 ? getImpactLevel(paper.cited_by_count) : null;

  return (
    <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {(paper.source_index || paper.source) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground uppercase">{paper.source_index || paper.source}</span>
            )}
            {paper.discovery_category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{paper.discovery_category.replace('_', ' ')}</span>
            )}
            {paper.year && <span className="text-xs text-muted-foreground">{paper.year}</span>}
            {paper.cited_by_count > 0 && (
              <span className="text-[10px] text-muted-foreground">{paper.cited_by_count.toLocaleString()} citations</span>
            )}
            {impact && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${impact.color}`}>{impact.label}</span>
            )}
            {paper.open_access && (
              <span className="text-[10px] text-green-400">Open Access</span>
            )}
          </div>
          <h4 className="font-semibold text-sm leading-snug mb-1.5 text-foreground">{paper.title}</h4>
          {paper.authors && <p className="text-xs text-muted-foreground mb-2">{paper.authors}</p>}
          {paper.indexed_by?.length > 1 && <p className="mb-1 text-[10px] text-muted-foreground">Indexed by {paper.indexed_by.join(', ')} · one publication, not independent studies.</p>}
          {paper.summary_source && paper.summary_source !== paper.source_index && <p className="mb-1 text-[10px] text-muted-foreground">Abstract metadata from {paper.summary_source}.</p>}
          {paper.metadata_conflict && <p className="mb-1 text-[10px] text-amber-700 dark:text-amber-300">Provider titles conflict for this DOI. Check the original record before relying on it.</p>}
          {paper.summary && <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">{paper.summary}</p>}
          <PaperSummary paper={paper} projectId={projectId} />
          <button type="button" onClick={() => navigate(`/search?q=${encodeURIComponent(paper.title || '')}`)} className="mt-2 text-[11px] font-medium text-muted-foreground hover:text-primary">Find similar papers</button>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onSave} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Save to library">
            <Bookmark size={13} className="text-muted-foreground" />
          </button>
          {paper.url && (
            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ResearcherCard({ researcher, onSave }) {
  return (
    <div className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 transition-colors card-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative mb-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-xs font-semibold text-foreground" aria-label={researcher.profile_photo_verified && researcher.profile_photo_url ? `${researcher.name} profile photograph` : `${researcher.name} initials avatar`}>
            {String(researcher.name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')}
            {researcher.profile_photo_verified && /^https:\/\//i.test(researcher.profile_photo_url || '') && <img src={researcher.profile_photo_url} alt={`${researcher.name} profile`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 h-full w-full object-cover" />}
          </div>
          <h4 className="font-semibold text-sm text-foreground">{researcher.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{researcher.institution}</p>
          {researcher.biography && <p className="mt-2 text-xs leading-5 text-muted-foreground">{researcher.biography}</p>}
          {researcher.orcid && <a href={`https://orcid.org/${encodeURIComponent(researcher.orcid)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-primary underline">ORCID {researcher.orcid}</a>}
          {researcher.country && <p className="text-[10px] text-muted-foreground/70">{researcher.country}</p>}
          {researcher.research_areas && (
            <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{researcher.research_areas}</p>
          )}
          {researcher.selected_publications?.length > 0 && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Selected publications in this topic</p><ul className="mt-1 space-y-1">{researcher.selected_publications.map(paper => <li key={paper.id || paper.doi || paper.url} className="text-[11px] leading-4">{paper.url ? <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{paper.title}</a> : paper.title}{paper.year ? ` · ${paper.year}` : ''}</li>)}</ul></div>}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span><BookOpen size={11} className="inline mr-1" />{(researcher.works_count || 0).toLocaleString()} works</span>
            <span>{(researcher.citation_count || 0).toLocaleString()} citations</span>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-2 flex items-center gap-1">
            <ShieldCheck size={8} /> Source: OpenAlex · Recommended by EYRA
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={onSave} className="p-2 rounded-lg hover:bg-secondary transition-colors" title="Save">
            <Bookmark size={13} className="text-muted-foreground" />
          </button>
          {researcher.profile_url && (
            <a href={researcher.profile_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
