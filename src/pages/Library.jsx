import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  FileText, Users, Award, Trash2, ExternalLink, Search,
  BookOpen, Download
} from 'lucide-react';
import EyraResearchCompanion from '@/components/eyra/EyraResearchCompanion';
import PaperSummary from '@/components/eyra/PaperSummary';
import CitationVerification from '@/components/library/CitationVerification';
import { toBibTeX, toRIS } from '@/utils/citation-export';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { loadLibraryView } from '@/lib/library-view.mjs';
import { isSafeLiteratureSourceUrl } from '@/lib/literature-review-protocol.mjs';

function downloadReferences(content, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ProjectLinkControl({ item, projects, projectsLoaded, onLink, label }) {
  if (!projectsLoaded) return <p className="mt-3 text-sm text-muted-foreground">Project links are unavailable.</p>;
  if (!projects.length) {
    return <Link to="/projects" className="mt-3 inline-flex min-h-10 items-center text-sm text-primary hover:underline">Create a project to link this {label}</Link>;
  }
  return (
    <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Project</span>
      <select value={item.project_id || ''} onChange={event => onLink(item, event.target.value)} aria-label={`Link ${label} to a project`}
        className="min-h-10 min-w-44 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
        <option value="">No project</option>
        {item.project_id && !projects.some(project => project.id === item.project_id) && <option value={item.project_id} disabled>Current linked project (not loaded)</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
      {item.project_id && <Link to={`/projects/${item.project_id}`} className="inline-flex min-h-10 items-center text-primary hover:underline">Open project</Link>}
    </label>
  );
}

const TABS = [
  { key: 'papers', label: 'Papers', icon: FileText },
  { key: 'researchers', label: 'Researchers', icon: Users },
  { key: 'opportunities', label: 'Opportunities', icon: Award },
];

export default function Library() {
  const { user } = useAuth();
  const [tab, setTab] = useState('papers');
  const [papers, setPapers] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [fetching, setLoading] = useState(true);
  const [loadedScope, setLoadedScope] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [scopeProject, setScopeProject] = useState(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadNotice, setLoadNotice] = useState('');
  const [failedCollections, setFailedCollections] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || '';
  const focusedPaperId = searchParams.get('focus') || '';
  const scopeKey = JSON.stringify([user?.id, projectId, focusedPaperId]);
  const loading = fetching || loadedScope !== scopeKey;
  const { toast } = useToast();

  const loadAll = () => setAttempt(value => value + 1);
  useEffect(() => {
    let active = true;
    const scope = JSON.stringify([user?.id, projectId, focusedPaperId]);
    setLoading(true);
    setLoadNotice('');
    setFailedCollections([]);
    setProjectsLoaded(false);
    setScopeProject(null);
    setPapers([]); setResearchers([]); setOpportunities([]);
    loadLibraryView({ entities: base44.entities, ownerId: user?.id, projectId, paperId: focusedPaperId }).then(view => {
      if (!active) return;
      setPapers(view.papers); setResearchers(view.researchers); setOpportunities(view.opportunities);
      setProjects(view.projects); setProjectsLoaded(view.projectsLoaded); setScopeProject(view.project);
      setFailedCollections(view.failedCollections); setLoadNotice(view.notice);
    }).catch(() => {
      if (!active) return;
      setProjects([]);
      setFailedCollections(['papers', 'researchers', 'opportunities']);
      setLoadNotice('The requested private Library view could not be loaded. Check access and retry, or explicitly open your entire Library.');
    }).finally(() => {
      if (active) { setLoadedScope(scope); setLoading(false); }
    });
    return () => { active = false; };
  }, [user?.id, projectId, focusedPaperId, attempt]);
  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
    const requestedTab = searchParams.get('tab');
    if (searchParams.get('focus')) setTab('papers');
    else if (TABS.some(candidate => candidate.key === requestedTab)) setTab(requestedTab);
  }, [searchParams]);
  useEffect(() => { setVisibleCount(50); }, [scopeKey, searchTerm, tab]);

  const linkToProject = async (entityName, item, projectId, setItems, label) => {
    const project = projects.find(candidate => candidate.id === projectId);
    try {
      const updated = await base44.entities[entityName].update(item.id, {
        project_id: projectId || null,
        project_title: project?.title || '',
      });
      setItems(current => current.map(record => record.id === item.id ? updated : record));
      toast({ title: project ? `Added to ${project.title}` : 'Removed from project' });
    } catch (error) {
      toast({ title: `Could not link ${label}`, description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const deletePaper = async (id) => {
    try {
      await base44.entities.SavedPaper.delete(id);
      setPapers(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Paper removed' });
    } catch (error) {
      toast({ title: 'Could not remove paper', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };
  const deleteResearcher = async (id) => {
    try {
      await base44.entities.SavedResearcher.delete(id);
      setResearchers(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Researcher removed' });
    } catch (error) {
      toast({ title: 'Could not remove researcher', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };
  const deleteOpportunity = async (id) => {
    try {
      await base44.entities.SavedOpportunity.delete(id);
      setOpportunities(prev => prev.filter(o => o.id !== id));
      toast({ title: 'Opportunity removed' });
    } catch (error) {
      toast({ title: 'Could not remove opportunity', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  const withinProject = items => projectId ? items.filter(item => item.project_id === projectId) : items;
  const filter = (items, fields) => {
    const scoped = withinProject(items);
    if (!searchTerm.trim()) return scoped;
    const q = searchTerm.toLowerCase();
    return scoped.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(q)));
  };

  const filteredPapers = focusedPaperId
    ? filter(papers, ['title', 'authors', 'source']).filter(paper => String(paper.id) === focusedPaperId)
    : filter(papers, ['title', 'authors', 'source']);
  const filteredResearchers = filter(researchers, ['name', 'institution', 'research_areas']);
  const filteredOpportunities = filter(opportunities, ['title', 'description', 'type']);
  const allParams = new URLSearchParams(searchParams);
  allParams.delete('project_id'); allParams.delete('focus');
  const allLibraryHref = '/library' + (allParams.size ? '?' + allParams.toString() : '');
  const exportPaperReferences = format => {
    if (loading || failedCollections.includes('papers') || !filteredPapers.length) return;
    const bib = format === 'bibtex';
    const content = bib ? toBibTeX(filteredPapers) : toRIS(filteredPapers);
    if (!content) return;
    downloadReferences(content, bib ? 'eylo-saved-papers.bib' : 'eylo-saved-papers.ris',
      bib ? 'application/x-bibtex;charset=utf-8' : 'application/x-research-info-systems;charset=utf-8');
    toast({ title: `${filteredPapers.length} saved paper citations exported`,
      description: 'Exported the saved metadata. Verify titles, authors, DOI and publication notices before scholarly use.' });
  };

  const counts = { papers: withinProject(papers).length, researchers: withinProject(researchers).length, opportunities: withinProject(opportunities).length };
  const filteredCount = tab === 'papers' ? filteredPapers.length : tab === 'researchers' ? filteredResearchers.length : filteredOpportunities.length;
  const failedCollectionMessage = 'This collection could not be loaded. Use Retry loading above instead of assuming it is empty.';
  return (
    <div className="eylo-page">
      {/* Header */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Research workspace</p>
        <h1 className="eylo-page-heading">Library</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">Your saved scientific literature, researchers and opportunities — organized for future reference.</p>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <label className="min-w-0 flex-1 text-sm font-medium">Filter Library by project
          <select aria-label="Filter Library by project" value={projectId} disabled={!projectsLoaded}
            onChange={event => setSearchParams(current => {
              const next = new URLSearchParams(current);
              if (event.target.value) next.set('project_id', event.target.value); else next.delete('project_id');
              next.delete('focus');
              if (searchTerm) next.set('q', searchTerm); else next.delete('q');
              return next;
            })}
            className="mt-2 block min-h-11 w-full max-w-xl rounded-lg border border-border bg-card px-3 text-sm">
            <option value="">All projects</option>
            {projectId && !projects.some(project => project.id === projectId) && <option value={projectId}>Selected project</option>}
            {projects.map(project => <option key={project.id} value={project.id}>{project.title || 'Untitled project'}</option>)}
          </select>
        </label>
        {(projectId || focusedPaperId) && <Link to={allLibraryHref} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Show entire Library</Link>}
      </div>
      {scopeProject && <p role="status" className="mb-4 text-sm text-muted-foreground">Showing saved records linked to {scopeProject.title || 'this project'}. <Link to={'/literature-review?project_id=' + encodeURIComponent(scopeProject.id)} className="text-primary underline">Open review protocol</Link></p>}
      {focusedPaperId && <p role="status" className="mb-4 text-sm text-muted-foreground">Publication link selected. Cards and citation exports use this publication only.</p>}

      {(papers.length >= 1000 || researchers.length >= 1000 || opportunities.length >= 1000) && !loading && (
        <p role="status" className="mb-4 text-xs text-muted-foreground">
          Showing up to 1,000 recent records per collection. Older records are not loaded; full pagination is not yet available.
        </p>
      )}
      {projects.length >= 1000 && !loading && <p role="status" className="mb-4 text-xs text-muted-foreground">The project picker includes up to 1,000 recent projects and the project opened by a direct link.</p>}

      {loadNotice && (
        <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          <span>{loadNotice}</span>
          <button type="button" onClick={loadAll} disabled={loading}
            className="min-h-9 rounded-lg border border-amber-400/30 px-3 font-semibold transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Retrying…' : 'Retry loading'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { key: 'papers', label: 'Saved Papers', value: counts.papers, icon: FileText, color: 'text-primary bg-primary/10' },
          { key: 'researchers', label: 'Researchers', value: counts.researchers, icon: Users, color: 'text-accent bg-accent/10' },
          { key: 'opportunities', label: 'Opportunities', value: counts.opportunities, icon: Award, color: 'text-chart-3 bg-chart-3/10' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-xl border border-border bg-card text-center">
              <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center mx-auto mb-2`}>
                <Icon size={14} />
              </div>
              <div className="font-bold text-xl font-heading">{loading || failedCollections.includes(s.key) ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-md">
        <label htmlFor="library-search" className="sr-only">Search saved library items</label>
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id="library-search"
          type="search"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search your library..."
          className="min-h-11 w-full pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex max-w-full items-center gap-1 overflow-x-auto border-b border-border/60">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`flex min-h-11 shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={13} />
              {t.label}
              <span className="text-xs opacity-50">{failedCollections.includes(t.key) ? '—' : counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
          <div aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /> Loading your saved library…
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Papers */}
          {tab === 'papers' && (
            <div className="space-y-3">
              {!failedCollections.includes('papers') && filteredPapers.length > 0 && (
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3" aria-label="Export saved publications">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Export the {filteredPapers.length} currently filtered saved publication{filteredPapers.length === 1 ? '' : 's'}.
                    Metadata are not automatically Crossref-verified; only loaded records are included.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => exportPaperReferences('bibtex')}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary">
                      <Download size={14} aria-hidden="true" /> Export BibTeX
                    </button>
                    <button type="button" onClick={() => exportPaperReferences('ris')}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary">
                      <Download size={14} aria-hidden="true" /> Export RIS
                    </button>
                  </div>
                </section>
              )}
              {failedCollections.includes('papers')
                ? <p role="alert" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{failedCollectionMessage}</p>
                : filteredPapers.length === 0
                ? <EmptyState icon={FileText} label={searchTerm.trim() ? 'No matching papers' : projectId ? 'No papers linked to this project' : 'No saved papers yet'} sub={searchTerm.trim() ? 'Try another search term or clear the search.' : 'Start by exploring trusted sources and save useful results here.'} href="/search" action="Find publications" onClear={searchTerm.trim() ? () => setSearchTerm('') : undefined} />
                : filteredPapers.slice(0, visibleCount).map(p => (
                  <div key={p.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {p.source && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p.source}</span>}
                          {p.year && <span className="text-xs text-muted-foreground">{p.year}</span>}
                          {p.open_access && <span className="text-xs text-emerald-300">Open access</span>}
                        </div>
                        <h4 className="font-semibold text-sm text-foreground">{p.title}</h4>
                        {p.authors && <p className="text-xs text-muted-foreground mt-1">{p.authors}</p>}
                        {p.doi && <p className="mt-1 text-xs text-muted-foreground">DOI: {p.doi}</p>}
                        <CitationVerification paper={p} />
                        {p.summary && <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{p.summary}</p>}
                        <EyraResearchCompanion paper={p} />
                        <PaperSummary paper={p} projectId={p.project_id || ''} />
                        <ProjectLinkControl item={p} projects={projects} projectsLoaded={projectsLoaded} label="paper" onLink={(item, projectId) => linkToProject('SavedPaper', item, projectId, setPapers, 'paper')} />
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {isSafeLiteratureSourceUrl(p.url) && <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${p.title}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-secondary transition-colors"><ExternalLink size={16} className="text-muted-foreground" /></a>}
                        <button onClick={() => deletePaper(p.id)} aria-label={`Remove ${p.title} from library`} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 size={13} className="text-destructive/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Researchers */}
          {tab === 'researchers' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {failedCollections.includes('researchers')
                ? <p role="alert" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{failedCollectionMessage}</p>
                : filteredResearchers.length === 0
                ? <EmptyState icon={Users} label={searchTerm.trim() ? 'No matching researchers' : projectId ? 'No researchers linked to this project' : 'No saved researchers yet'} sub={searchTerm.trim() ? 'Try another search term or clear the search.' : 'Start by exploring trusted sources and save useful results here.'} href="/researchers" action="Find researchers" onClear={searchTerm.trim() ? () => setSearchTerm('') : undefined} />
                : filteredResearchers.slice(0, visibleCount).map(r => (
                  <div key={r.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground">{r.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.institution}</p>
                        {r.research_areas && <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{r.research_areas}</p>}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span><BookOpen size={11} className="inline mr-1" />{(r.works_count || 0).toLocaleString()} works</span>
                          <span>{(r.citation_count || 0).toLocaleString()} citations</span>
                        </div>
                        <ProjectLinkControl item={r} projects={projects} projectsLoaded={projectsLoaded} label="researcher" onLink={(item, projectId) => linkToProject('SavedResearcher', item, projectId, setResearchers, 'researcher')} />
                      </div>
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {isSafeLiteratureSourceUrl(r.profile_url) && <a href={r.profile_url} target="_blank" rel="noopener noreferrer" aria-label={`Open researcher profile for ${r.name}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-secondary transition-colors"><ExternalLink size={16} className="text-muted-foreground" /></a>}
                        <button onClick={() => deleteResearcher(r.id)} aria-label={`Remove ${r.name} from library`} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          <Trash2 size={13} className="text-destructive/60" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Opportunities */}
          {tab === 'opportunities' && (
            <div className="space-y-3">
              {failedCollections.includes('opportunities')
                ? <p role="alert" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">{failedCollectionMessage}</p>
                : filteredOpportunities.length === 0
                ? <EmptyState icon={Award} label={searchTerm.trim() ? 'No matching opportunities' : projectId ? 'No opportunities linked to this project' : 'No saved opportunities yet'} sub={searchTerm.trim() ? 'Try another search term or clear the search.' : 'Start by exploring trusted sources and save useful results here.'} href="/opportunities" action="Find funding" onClear={searchTerm.trim() ? () => setSearchTerm('') : undefined} />
                : filteredOpportunities.slice(0, visibleCount).map(o => (
                  <div key={o.id} className="p-5 rounded-xl border border-border bg-card hover:border-primary/30 card-glow transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {o.type && <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground mb-2 inline-block">{o.type}</span>}
                        <h4 className="font-semibold text-sm text-foreground">{o.title}</h4>
                        {o.agency && <p className="text-sm text-muted-foreground mt-1">{o.agency}</p>}
                        {o.description && <p className="text-xs text-muted-foreground mt-1">{o.description}</p>}
                        {o.deadline && <p className="text-sm text-foreground mt-2">Deadline: {o.deadline}</p>}
                        {o.amount && <p className="text-sm text-muted-foreground mt-1">{o.amount}</p>}
                        {o.eligibility && <p className="text-sm text-muted-foreground mt-1">Eligibility: {o.eligibility}</p>}
                        <p className="mt-2 text-xs text-muted-foreground">Verify eligibility and program terms at the official source.</p>
                        {isSafeLiteratureSourceUrl(o.url) && <a href={o.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-2 text-sm text-primary hover:underline">Open official source <ExternalLink size={14} aria-hidden="true" /></a>}
                        <ProjectLinkControl item={o} projects={projects} projectsLoaded={projectsLoaded} label="opportunity" onLink={(item, projectId) => linkToProject('SavedOpportunity', item, projectId, setOpportunities, 'opportunity')} />
                      </div>
                      <button onClick={() => deleteOpportunity(o.id)} aria-label={`Remove ${o.title} from library`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 size={13} className="text-destructive/60" />
                      </button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </motion.div>
      )}
      {!loading && !failedCollections.includes(tab) && filteredCount > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-muted-foreground">Showing {Math.min(visibleCount, filteredCount)} of {filteredCount} loaded {tab}.</p>
        {filteredCount > visibleCount && <button type="button" onClick={() => setVisibleCount(count => count + 50)} className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold">Show more records</button>}
      </div>}
    </div>
  );
}

function EmptyState({ icon: Icon, label, sub, href, action, onClear }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <p className="font-medium text-sm text-foreground">{label}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{sub}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onClear ? <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground">Clear search</button> : null}
        <Link to={href} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">{action}</Link>
      </div>
    </div>
  );
}
