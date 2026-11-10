import React, { useState } from 'react';
import { BookOpen, Loader2, Bookmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const schema = {
  type: 'object',
  properties: Object.fromEntries(['objective', 'methodology', 'dataset', 'findings', 'conclusions', 'limitations', 'implications', 'questions'].map((key) => [key, { type: 'string' }])),
};

export default function PaperSummary({ paper }) {
  const [summary, setSummary] = useState(paper.eyra_summary || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const sourceText = String(paper.abstract || paper.summary || '').trim();

  const generate = async () => {
    if (!sourceText) {
      toast({ title: 'Abstract unavailable', description: 'EYRA needs an accessible abstract or full text to produce an evidence based summary.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: schema,
        prompt: `Summarize this scholarly paper using only the supplied abstract and metadata. Do not infer methods, sample size, findings, limitations, or implications absent from the text; write "Not reported in the abstract" where needed. Keep each field concise. Questions must be explicitly framed as questions for further study, not as established gaps.\n\nTitle: ${paper.title}\nAuthors: ${paper.authors || 'Not provided'}\nYear: ${paper.year || 'Not provided'}\nDOI: ${paper.doi || 'Not provided'}\nSource URL: ${paper.url || 'Not provided'}\nEvidence type: abstract\nAbstract: ${sourceText.slice(0, 12000)}`,
      });
      setSummary({ ...result, evidence_type: 'abstract-based', source_url: paper.url || '', generated_at: new Date().toISOString() });
    } catch (error) {
      toast({ title: 'EYRA could not summarize this paper', description: error?.message || 'Please retry.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!summary || saving) return;
    setSaving(true);
    try {
      const sourceId = paper.source_id || paper.id || paper.doi || paper.url || paper.title;
      const matches = await base44.entities.SavedPaper.filter({ source_id: sourceId }, '-created_date', 1).catch(() => []);
      const existing = matches.find((record) => record.source_id === sourceId);
      if (existing) await base44.entities.SavedPaper.update(existing.id, { eyra_summary: summary });
      else await base44.entities.SavedPaper.create({ source_id: sourceId, title: paper.title, authors: paper.authors || '', doi: paper.doi || '', year: paper.year || null, url: paper.url || '', summary: sourceText, eyra_summary: summary });
      toast({ title: 'Summary saved to Library' });
    } catch (error) { toast({ title: 'Could not save summary', description: error?.message || 'Please retry.', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return <section className="mt-3 border-t border-border/40 pt-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={generate} disabled={loading} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-60">
        {loading ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}{summary ? 'Regenerate with EYRA' : 'Summarize with EYRA'}
      </button>
      {summary && <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60">{saving ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}{saving ? 'Saving…' : 'Save summary to Library'}</button>}
    </div>
    {!sourceText && !summary && <p className="mt-2 text-[11px] text-muted-foreground">An accessible abstract or full text is not available for this record.</p>}
    {summary && <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-primary">Abstract-based summary · verify against source</p>
      <div className="grid gap-2 sm:grid-cols-2">{[
        ['Research objective', summary.objective], ['Methodology', summary.methodology], ['Dataset or participants', summary.dataset], ['Principal findings', summary.findings], ['Conclusions', summary.conclusions], ['Limitations', summary.limitations], ['Practical implications', summary.implications], ['Remaining research questions', summary.questions],
      ].map(([label, value]) => <div key={label}><h5 className="text-[11px] font-semibold text-foreground">{label}</h5><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{value || 'Not reported in the abstract.'}</p></div>)}</div>
      {summary.source_url && <a href={summary.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[11px] text-primary underline">Open source paper</a>}
    </div>}
  </section>;
}
