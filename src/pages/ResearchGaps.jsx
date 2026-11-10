import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Search, FolderKanban, ExternalLink, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const gapSchema = { type: 'object', properties: { gaps: { type: 'array', items: { type: 'object', properties: {
  question: { type: 'string' }, explanation: { type: 'string' }, supporting_papers: { type: 'array', items: { type: 'string' } }, counterevidence: { type: 'string' }, limitations: { type: 'string' }, uncertainty: { type: 'string' }, proposed_question: { type: 'string' }, methodology: { type: 'string' },
} } } } };

export default function ResearchGaps() {
  const [papers, setPapers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [gaps, setGaps] = useState([]);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const load = async () => {
    setLoading(true); setError('');
    const [paperResult, projectResult] = await Promise.allSettled([
      base44.entities.SavedPaper.list('-created_date', 100), base44.entities.Project.list('-updated_date', 100),
    ]);
    if (paperResult.status === 'fulfilled') setPapers(paperResult.value);
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value);
    if (paperResult.status === 'rejected' || projectResult.status === 'rejected') setError('Some saved research could not be loaded. Retry after your connection recovers.');
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sourcePapers = projectId ? papers.filter((paper) => paper.project_id === projectId) : papers;
  const toggle = (paperId) => setSelected((current) => current.includes(paperId) ? current.filter((id) => id !== paperId) : [...current, paperId]);
  const analyze = async () => {
    const selectedPapers = sourcePapers.filter((paper) => selected.includes(paper.id));
    if (selectedPapers.length < 2) { setError('Select at least two saved papers to compare evidence.'); return; }
    setAnalyzing(true); setError(''); setGaps([]);
    try {
      const report = await base44.integrations.Core.InvokeLLM({ response_json_schema: gapSchema, prompt: `Analyze the following evidence for candidate research gaps. Treat the supplied papers as a limited sample, never proof that a gap is absent from the wider literature. Report possible understudied questions, contradictions, methodological limitations, missing comparisons, and underrepresented datasets or populations only when evidence supports them. Each proposed gap must cite supporting paper IDs from this list, describe relevant counterevidence or state that none is apparent in this sample, explain search/sample limitations, state scientific uncertainty, propose a research question, and suggest a feasible method. Do not cite papers by title unless included below.\n\n${selectedPapers.map((paper, index) => JSON.stringify({ id: `P${index + 1}`, title: paper.title, authors: paper.authors, year: paper.year, abstract: paper.summary || '', doi: paper.doi, url: paper.url })).join('\n')}` });
      setGaps(Array.isArray(report.gaps) ? report.gaps.map((gap) => ({ ...gap, supporting_papers: (gap.supporting_papers || []).filter((id) => /^P[0-9]+$/.test(id)) })) : []);
    } catch (failure) { setError(failure?.message || 'EYRA could not complete this analysis.'); }
    finally { setAnalyzing(false); }
  };

  const createProject = async (gap) => {
    try {
      const linkedPapers = sourcePapers.filter((paper) => selected.includes(paper.id));
      const project = await base44.entities.Project.create({ title: gap.proposed_question.slice(0, 100) || 'Research project from evidence gap', goal: gap.proposed_question, status: 'active', eyra_analysis: `Candidate research gap (uncertain, based on a selected evidence sample)\n\n${JSON.stringify(gap, null, 2)}` });
      await Promise.all(linkedPapers.map((paper) => base44.entities.SavedPaper.create({
        source_id: paper.source_id || paper.doi || paper.url || paper.title,
        title: paper.title, authors: paper.authors || '', doi: paper.doi || '', year: paper.year || null,
        source: paper.source || '', url: paper.url || '', summary: paper.summary || '',
        open_access: paper.open_access ?? null, cited_by_count: paper.cited_by_count ?? null,
        eyra_summary: paper.eyra_summary || null, project_id: project.id, project_title: project.title,
      })));
      toast({ title: 'Research project created', description: 'Copies of the selected source papers were linked to the new project; existing project links were preserved.' });
      await load();
    } catch (failure) { toast({ title: 'Could not create research project', description: failure?.message || 'Please retry.', variant: 'destructive' }); }
  };

  return <main className="eylo-page">
    <header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">EYRA evidence synthesis</p><h1 className="mt-2 eylo-page-heading">Research Gap Finder</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Compare selected saved papers or focus on a project. Candidate gaps are hypotheses from this evidence sample, not proof that the wider literature has no answer.</p></header>
    <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3"><FolderKanban size={15} className="text-primary"/><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelected([]); setGaps([]); }} aria-label="Choose a project" className="min-h-11 flex-1 bg-transparent text-sm"><option value="">All saved papers</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <button type="button" disabled={analyzing || selected.length < 2} onClick={analyze} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{analyzing ? <Loader2 size={15} className="animate-spin"/> : <Search size={15}/>}Analyze {selected.length} papers</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-foreground">{error} <button className="ml-2 underline" onClick={load}>Retry</button></p>}
    {loading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading your research library…</div> : sourcePapers.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center"><p className="text-sm text-muted-foreground">No saved papers are linked to this view yet.</p><Link to="/library" className="mt-3 inline-block text-sm text-primary underline">Open your Library</Link></div> : <section className="mb-8 space-y-2">{sourcePapers.map((paper) => <label key={paper.id} className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-4"><input type="checkbox" checked={selected.includes(paper.id)} onChange={() => toggle(paper.id)} className="mt-1"/><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{paper.title}</span><span className="mt-1 block text-xs text-muted-foreground">{[paper.authors, paper.year, paper.doi].filter(Boolean).join(' · ')}</span>{paper.summary && <span className="mt-2 block line-clamp-2 text-xs leading-5 text-muted-foreground">{paper.summary}</span>}</span>{paper.url && <a href={paper.url} target="_blank" rel="noopener noreferrer" aria-label="Open paper source" className="text-primary" onClick={(event) => event.stopPropagation()}><ExternalLink size={15}/></a>}</label>)}</section>}
    {analyzing && <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles size={15} className="text-primary"/>EYRA is comparing the supplied evidence and limitations…</p>}
    {gaps.map((gap, index) => <article key={`${gap.question}-${index}`} className="mb-4 rounded-2xl border border-primary/20 bg-card p-5"><h2 className="font-semibold">Candidate gap: {gap.question}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{gap.explanation}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{[['Supporting papers', gap.supporting_papers.join(', ') || 'No specific support identified'], ['Counterevidence', gap.counterevidence], ['Search limitations', gap.limitations], ['Scientific uncertainty', gap.uncertainty], ['Proposed research question', gap.proposed_question], ['Suggested methodology', gap.methodology]].map(([label, value]) => <div key={label}><h3 className="text-xs font-semibold text-foreground">{label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{value || 'Not specified.'}</p></div>)}</div><button type="button" onClick={() => createProject(gap)} className="mt-4 min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">Create Research Project from Gap</button></article>)}
  </main>;
}
