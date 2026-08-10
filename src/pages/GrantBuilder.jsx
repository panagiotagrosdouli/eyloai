import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Download, ExternalLink, FileText, Loader2, Save, Sparkles,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    fit_summary: { type: 'string' },
    eligibility_check: {
      type: 'array',
      items: { type: 'object', properties: { requirement: { type: 'string' }, evidence: { type: 'string' }, status: { type: 'string', enum: ['supported', 'unclear', 'risk'] } } },
    },
    project_summary: { type: 'string' },
    need_statement: { type: 'string' },
    objectives: { type: 'array', items: { type: 'string' } },
    work_packages: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' }, activities: { type: 'array', items: { type: 'string' } }, deliverables: { type: 'array', items: { type: 'string' } } } },
    },
    impact_and_evaluation: { type: 'string' },
    budget_assumptions: { type: 'array', items: { type: 'string' } },
    missing_information: { type: 'array', items: { type: 'string' } },
    next_actions: { type: 'array', items: { type: 'string' } },
  },
};

export default function GrantBuilder() {
  const [opportunities, setOpportunities] = useState([]);
  const [projects, setProjects] = useState([]);
  const [opportunityId, setOpportunityId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState('researching');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      base44.entities.SavedOpportunity.list('-created_date', 100),
      base44.entities.Project.list('-updated_date', 100),
    ]).then(([saved, projectRows]) => {
      setOpportunities(saved);
      setProjects(projectRows);
      if (saved[0]) setOpportunityId(saved[0].id);
      if (projectRows[0]) setProjectId(projectRows[0].id);
    }).catch(loadError => setError(loadError?.message || 'Could not load workspace records.')).finally(() => setLoading(false));
  }, []);

  const opportunity = useMemo(() => opportunities.find(item => item.id === opportunityId), [opportunities, opportunityId]);
  const project = useMemo(() => projects.find(item => item.id === projectId), [projects, projectId]);

  useEffect(() => {
    if (!opportunity) return;
    setStatus(opportunity.application_status || 'researching');
    setNotes(opportunity.application_notes || '');
    if (opportunity.application_draft) {
      try { setDraft(typeof opportunity.application_draft === 'string' ? JSON.parse(opportunity.application_draft) : opportunity.application_draft); } catch { setDraft(null); }
    } else {
      setDraft(null);
    }
  }, [opportunityId]);

  const generate = async () => {
    if (!opportunity || !project) return;
    setGenerating(true);
    setError('');

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA Grant Application Builder.

VERIFIED SAVED OPPORTUNITY:
Title: ${opportunity.title}
Agency: ${opportunity.agency || 'Not recorded'}
Type: ${opportunity.type || 'grant'}
Description: ${opportunity.description || 'Not recorded'}
Eligibility text: ${opportunity.eligibility || 'Not recorded'}
Deadline: ${opportunity.deadline || 'Not recorded'}
Amount: ${opportunity.amount || 'Not recorded'}
Official URL: ${opportunity.source_url || 'Not recorded'}

USER PROJECT:
Title: ${project.title}
Goal: ${project.goal || 'Not recorded'}
Description: ${project.description || 'Not recorded'}
Milestones: ${project.milestones || 'Not recorded'}
Notes: ${project.notes || 'Not recorded'}

Create an application working draft based only on these records.
Rules:
- Never claim eligibility when the notice text does not prove it; mark unclear or risk.
- Never invent partners, results, budgets, institutional capacity or compliance.
- Put every absent fact in missing_information.
- Budget items must be assumptions to price, not fabricated numbers.
- This is a drafting workspace, not a submitted application or legal determination.
- End with concrete actions tied to the official notice.`,
        response_json_schema: DRAFT_SCHEMA,
      });
      setDraft(result);
      await base44.entities.SavedOpportunity.update(opportunity.id, {
        application_draft: JSON.stringify(result),
        application_status: status,
        application_notes: notes,
        tracked_at: new Date().toISOString(),
      });
      toast({ title: 'Grant draft generated and saved' });
    } catch (generationError) {
      setError(generationError?.message || 'The grant draft could not be generated.');
    } finally {
      setGenerating(false);
    }
  };

  const saveTracker = async () => {
    if (!opportunity) return;
    await base44.entities.SavedOpportunity.update(opportunity.id, {
      application_status: status,
      application_notes: notes,
      application_draft: draft ? JSON.stringify(draft) : opportunity.application_draft || '',
      tracked_at: new Date().toISOString(),
    });
    setOpportunities(items => items.map(item => item.id === opportunity.id ? { ...item, application_status: status, application_notes: notes, application_draft: draft ? JSON.stringify(draft) : item.application_draft } : item));
    toast({ title: 'Application tracker saved' });
  };

  const exportDraft = () => {
    if (!draft || !opportunity) return;
    const text = [
      opportunity.title,
      opportunity.source_url || '',
      '',
      'FIT SUMMARY',
      draft.fit_summary,
      '',
      'PROJECT SUMMARY',
      draft.project_summary,
      '',
      'NEED STATEMENT',
      draft.need_statement,
      '',
      'OBJECTIVES',
      ...draft.objectives.map(item => `- ${item}`),
      '',
      'WORK PACKAGES',
      ...draft.work_packages.flatMap(item => [item.title, ...item.activities.map(activity => `- ${activity}`), ...item.deliverables.map(deliverable => `  Deliverable: ${deliverable}`)]),
      '',
      'IMPACT AND EVALUATION',
      draft.impact_and_evaluation,
      '',
      'MISSING INFORMATION',
      ...draft.missing_information.map(item => `- ${item}`),
      '',
      'NEXT ACTIONS',
      ...draft.next_actions.map(item => `- ${item}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eylo-grant-working-draft.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-7">
        <div className="mb-2 flex items-center gap-2 text-primary"><FileText size={15} /><span className="text-[10px] font-bold uppercase tracking-widest">Grant Builder & Tracker</span></div>
        <h1 className="font-heading text-3xl font-black">Turn a saved official notice into a working application.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Select a saved funding record and project. EYRA drafts only from those records, flags missing information and keeps application status with the opportunity.</p>
      </header>

      {opportunities.length === 0 || projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">You need at least one saved official opportunity and one project.</p>
          <div className="mt-4 flex justify-center gap-2"><a href="/opportunities" className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Find funding</a><a href="/projects" className="rounded-xl border border-border px-4 py-2 text-xs font-semibold">Create project</a></div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
            <div><label className="mb-2 block text-xs font-semibold">Official opportunity</label><select value={opportunityId} onChange={event => setOpportunityId(event.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm">{opportunities.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
            <div><label className="mb-2 block text-xs font-semibold">Project</label><select value={projectId} onChange={event => setProjectId(event.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm">{projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
            <div><label className="mb-2 block text-xs font-semibold">Application status</label><select value={status} onChange={event => setStatus(event.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-3 text-sm"><option value="researching">Researching</option><option value="go_no_go">Go / no-go review</option><option value="drafting">Drafting</option><option value="internal_review">Internal review</option><option value="submitted">Submitted</option><option value="declined">Declined</option><option value="awarded">Awarded</option></select></div>
            <div><label className="mb-2 block text-xs font-semibold">Tracker notes</label><input value={notes} onChange={event => setNotes(event.target.value)} className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm" placeholder="Owner, internal deadline, partner dependency…" /></div>
            {opportunity?.source_url && <a href={opportunity.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-primary">Open official notice <ExternalLink size={11} /></a>}
            <div className="flex flex-wrap justify-end gap-2 md:col-start-2"><button onClick={saveTracker} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold"><Save size={13} />Save tracker</button><button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-xl eyra-gradient px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">{generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{generating ? 'Drafting…' : 'Generate working draft'}</button></div>
          </section>

          {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}

          {draft && (
            <section className="mt-7 space-y-4">
              <div className="flex items-center justify-between gap-3"><h2 className="font-heading text-xl font-bold">Application working draft</h2><button onClick={exportDraft} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background"><Download size={13} />Export draft</button></div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Fit assessment</p><p className="mt-2 text-sm leading-6">{draft.fit_summary}</p></div>
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Project summary</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{draft.project_summary}</p><h3 className="mt-5 font-semibold">Need statement</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{draft.need_statement}</p></article>
                <article className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Eligibility checks</h3><div className="mt-3 space-y-2">{draft.eligibility_check.map((item, index) => <div key={index} className="rounded-xl bg-secondary/40 p-3"><p className="text-xs font-semibold">{item.requirement}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.evidence}</p><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${item.status === 'supported' ? 'bg-green-500/10 text-green-400' : item.status === 'risk' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{item.status}</span></div>)}</div></article>
              </div>
              <article className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Objectives</h3><ul className="mt-3 space-y-2">{draft.objectives.map((item, index) => <li key={index} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 size={13} className="mt-1 shrink-0 text-primary" />{item}</li>)}</ul></article>
              <div className="grid gap-4 lg:grid-cols-2">{draft.work_packages.map((item, index) => <article key={index} className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">{item.title}</h3><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Activities</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{item.activities.map((activity, i) => <li key={i}>• {activity}</li>)}</ul><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deliverables</p><ul className="mt-2 space-y-1 text-xs text-muted-foreground">{item.deliverables.map((deliverable, i) => <li key={i}>• {deliverable}</li>)}</ul></article>)}</div>
              <article className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"><h3 className="font-semibold text-amber-200">Missing information before submission</h3><ul className="mt-3 space-y-2 text-sm text-amber-100/80">{draft.missing_information.map((item, index) => <li key={index}>• {item}</li>)}</ul></article>
            </section>
          )}
        </>
      )}
    </div>
  );
}
