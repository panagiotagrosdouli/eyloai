import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, FolderOpen, RefreshCw, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCapabilities } from '@/lib/capabilities';
import { buildResearchJourney, researchJourneyLinks, researchJourneyNextAction } from '@/lib/research-journey.mjs';
import { isSafeLiteratureSourceUrl } from '@/lib/literature-review-protocol.mjs';

function StepCard({ item, index }) {
  const badge = item.status === 'recorded' ? 'Recorded in workspace'
    : item.status === 'unknown' ? 'Coverage unavailable'
      : item.status === 'review' ? 'Human review' : 'Next step';
  return (
    <li className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-sm font-semibold text-primary">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{item.title}</h2>
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{badge}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          <p className="mt-3 text-sm font-medium text-foreground">{item.statusText}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.caveat}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link to={item.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {item.action}<ArrowRight size={15} aria-hidden="true" />
            </Link>
            {item.secondary && <Link to={item.secondary.href} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-medium text-foreground">{item.secondary.label}</Link>}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function ResearchJourney() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('project_id') || '';
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [papers, setPapers] = useState(null);
  const [papersLoaded, setPapersLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coverageError, setCoverageError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { data: capabilities, loading: capabilityLoading } = useCapabilities();
  const aiAvailable = !capabilityLoading && Boolean(capabilities?.ai);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      setCoverageError('');
      setPapersLoaded(false);
      setProject(null);
      setPapers(null);
      try {
        const recent = await base44.entities.Project.list('-updated_date', 100);
        if (!active) return;
        const chosen = selectedId
          ? recent.find(item => String(item.id) === selectedId) || await base44.entities.Project.get(selectedId)
          : recent[0] || null;
        if (!active) return;
        if (selectedId && (!chosen || String(chosen.id) !== selectedId)) {
          throw new Error('Requested private project is unavailable. Check access or choose another project.');
        }
        setProjects(chosen && !recent.some(item => item.id === chosen.id) ? [chosen, ...recent] : recent);
        setProject(chosen);
        if (!chosen) return;
        try {
          const linked = await base44.entities.SavedPaper.filter({ project_id: chosen.id }, '-created_date', 100);
          if (!active) return;
          setPapers(linked);
          setPapersLoaded(true);
          if (linked.length >= 100) setCoverageError('Showing a bounded sample of 100 recently saved project papers. Older linked papers may not be included.');
        } catch {
          if (active) setCoverageError('Project papers could not be loaded. No conclusion about evidence availability can be drawn. Retry to check again.');
        }
      } catch (failure) {
        if (active) setError(failure?.message || 'The research workspace could not be loaded. Try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [selectedId, attempt]);

  const steps = buildResearchJourney(project, { linkedPapers: papers?.length ?? null, papersLoaded, paperLimit: 100 });
  const nextAction = researchJourneyNextAction(steps);
  const links = project ? researchJourneyLinks(project.id) : null;
  return (
    <main className="eylo-page mx-auto max-w-5xl pb-20">
      <header className="mb-7">
        <p className="eylo-eyebrow">Research workspace · Your evidence, your decisions</p>
        <h1 className="eylo-page-heading mt-2">Research Journey</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Follow one connected route from an initial research question to a written thesis. Your Library, project, review protocol and saved Notes remain canonical; this page does not generate findings, edit records or mark studies as verified.</p>
      </header>
      <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label htmlFor="journey-project" className="min-w-0 flex-1 text-sm font-medium text-foreground">
            Research project
            <select id="journey-project" disabled={loading || projects.length === 0} value={project?.id || ''}
              onChange={event => setSearchParams({ project_id: event.target.value })}
              className="mt-2 block min-h-11 w-full max-w-xl rounded-xl border border-border bg-background px-3 text-sm">
              {!project && <option value="">Choose a project</option>}
              {projects.map(item => <option key={item.id} value={item.id}>{item.title || 'Untitled research project'}</option>)}
            </select>
          </label>
          <button type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50">
            <RefreshCw size={16} aria-hidden="true" /> Refresh progress
          </button>
        </div>
        {project && <p className="mt-3 text-sm text-muted-foreground">Current goal: {project.goal || 'No research goal recorded yet.'}</p>}
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Step labels reflect recorded workspace fields only, not quality, completion or academic approval. Refresh after saving in another tool.</p>
      </div>
      {loading && <p role="status" aria-live="polite" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading your private research journey…</p>}
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-foreground"><p>{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="mt-3 min-h-11 rounded-lg border border-border px-4 font-semibold">Retry loading</button><Link to="/projects" className="ml-3 inline-flex min-h-11 items-center text-primary underline">Your projects</Link></div>}
      {!loading && !error && !project && <section className="rounded-2xl border border-dashed border-border p-7">
        <FolderOpen size={24} className="text-primary" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold">Start with a research project</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create your first private project to connect sources, methodology and thesis writing.</p>
        <Link to="/projects?new=1" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Create a project</Link>
      </section>}
      {!loading && !error && project && <>
        {coverageError && <p role="status" className="mb-5 rounded-xl border border-border bg-secondary/50 p-4 text-sm text-foreground">{coverageError}</p>}
        {nextAction && <section aria-labelledby="journey-next-action" className="mb-6 rounded-2xl border border-primary/30 bg-card p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Suggested next step · based on saved fields</p>
          <h2 id="journey-next-action" className="mt-2 text-lg font-semibold text-foreground">{nextAction.label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
          {nextAction.href ? <Link to={nextAction.href} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Continue research <ArrowRight size={16} aria-hidden="true" /></Link>
            : <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground"><RefreshCw size={16} aria-hidden="true" /> Retry evidence load</button>}
        </section>}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your five research stages</h2>
          <Link to={links.project} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><FolderOpen size={16} aria-hidden="true" /> Open project</Link>
        </div>
        <ol className="space-y-4">{steps.map((item, index) => <StepCard key={item.id} item={item} index={index} />)}</ol>
        {papersLoaded && papers.length > 0 && <section aria-labelledby="journey-sources" className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="journey-sources" className="text-lg font-semibold">Recently linked research records</h2>
            <Link to={links.library} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">Open Library</Link>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Saved metadata from this project, not independently verified source quality. Inspect the original publication before citing or drawing conclusions.</p>
          <ul className="mt-4 divide-y divide-border">
            {papers.slice(0, 4).map(paper => <li key={paper.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{paper.title || 'Untitled saved paper'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{[paper.authors, paper.year, paper.doi].filter(Boolean).join(' · ') || 'Source metadata incomplete'}</p>
              </div>
              {isSafeLiteratureSourceUrl(paper.url) ? <a href={paper.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-primary"
                aria-label={'Open original source for ' + (paper.title || 'saved paper')}>Open source</a>
                : <span className="text-xs text-muted-foreground">Source link unavailable</span>}
            </li>)}
          </ul>
          {papers.length > 4 && <p className="mt-2 text-xs text-muted-foreground">Showing 4 of {papers.length} recently loaded linked records; open Library for more.</p>}
        </section>}
        <section aria-labelledby="journey-eyra" className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 id="journey-eyra" className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={19} className="text-primary" aria-hidden="true" /> Think with EYRA</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask for help interpreting methodology or planning a next step. Independently verify every scientific statement against an actual source; an AI answer is not a citation or evidence of a research gap.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={!aiAvailable} onClick={() => window.dispatchEvent(new Event('eylo:open-eyra'))}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {aiAvailable ? 'Ask EYRA' : 'EYRA unavailable'}
            </button>
            <Link to={links.study} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-foreground">
              <BookOpen size={16} aria-hidden="true" /> Plan research time
            </Link>
          </div>
        </section>
      </>}
    </main>
  );
}
