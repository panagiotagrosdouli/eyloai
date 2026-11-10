import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, Bookmark, MessageCircle, Send, Trash2, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { savePaperSummary } from '@/lib/paper-summary-persistence';
import { useToast } from '@/components/ui/use-toast';
import {
  buildPaperQuestionPrompt,
  buildPaperSummaryPrompt,
  getPaperAbstract,
  PAPER_SUMMARY_MODES,
  verifyPaperEvidenceQuote,
} from '@/lib/paper-summary.mjs';

const summarySchema = {
  type: 'object',
  properties: Object.fromEntries(['objective', 'methodology', 'dataset', 'findings', 'conclusions', 'limitations', 'implications', 'questions'].map((key) => [key, { type: 'string' }])),
};
const answerSchema = {
  type: 'object',
  required: ['answer', 'evidence_quote', 'uncertainty'],
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    evidence_quote: { type: 'string' },
    uncertainty: { type: 'string' },
  },
};

async function retrieveEuropePmcFullText(pmcid) {
  const id = String(pmcid || '').trim().toUpperCase();
  if (!/^PMC\d+$/.test(id)) throw new Error('This paper has no verified Europe PMC identifier.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/${id}/fullTextXML`, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 404 ? 'No accessible full text is available in Europe PMC.' : `Europe PMC returned ${response.status}.`);
    const xml = await response.text();
    if (xml.length > 1_000_000) throw new Error('The accessible full text is too large to process safely.');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Europe PMC returned an unreadable full-text record.');
    const body = doc.querySelector('article > body')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!body) throw new Error('No article body was reported by Europe PMC.');
    return { text: body.slice(0, 24_000), url: `https://europepmc.org/articles/${id}`, evidence_type: 'full-text-based' };
  } finally {
    clearTimeout(timeout);
  }
}

function initialEvidence(paper) {
  return { text: getPaperAbstract(paper), evidence_type: 'abstract-based', url: paper.url || '' };
}

export default function PaperSummary({ paper, projectId = '' }) {
  const [summary, setSummary] = useState(paper.eyra_summary || null);
  const [mode, setMode] = useState('standard');
  const [evidence, setEvidence] = useState(() => initialEvidence(paper));
  const [loading, setLoading] = useState(false);
  const [loadingFullText, setLoadingFullText] = useState(false);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const { toast } = useToast();
  const sourceText = evidence.text;
  const paperKey = paper.source_id || paper.id || paper.doi || paper.url || paper.title;
  const activePaperKey = useRef(paperKey);
  const activeRequest = useRef(0);
  activePaperKey.current = paperKey;

  useEffect(() => {
    activeRequest.current += 1;
    setSummary(paper.eyra_summary || null);
    setMode('standard');
    setEvidence(initialEvidence(paper));
    setConversation([]);
    setQuestion('');
    setAsking(false);
    setLoading(false);
    setLoadingFullText(false);
    setSaving(false);
    setShowQuestions(false);
  }, [paperKey, paper.eyra_summary, paper.abstract, paper.summary, paper.url]);

  const loadFullText = async () => {
    setLoadingFullText(true);
    try {
      const fullText = await retrieveEuropePmcFullText(paper.pmcid);
      if (activePaperKey.current !== paperKey) return;
      setEvidence(fullText);
      setSummary(null);
      setConversation([]);
      toast({ title: 'Accessible full text loaded', description: 'Retrieved from Europe PMC using the paper’s verified PMC identifier.' });
    } catch (error) {
      if (activePaperKey.current !== paperKey) return;
      toast({ title: 'Full text unavailable', description: error?.message || 'Try the official source link.', variant: 'destructive' });
    } finally {
      setLoadingFullText(false);
    }
  };

  const generate = async () => {
    if (!sourceText || loading) {
      if (!sourceText) toast({ title: 'Source text unavailable', description: 'EYRA needs an accessible abstract or full text to produce an evidence based summary.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: summarySchema,
        prompt: buildPaperSummaryPrompt(paper, mode, evidence),
      });
      if (activePaperKey.current !== paperKey) return;
      setSummary({
        ...result,
        evidence_type: evidence.evidence_type,
        detail_mode: mode,
        source_url: evidence.url || paper.url || '',
        generated_at: new Date().toISOString(),
      });
    } catch (error) {
      if (activePaperKey.current === paperKey) toast({ title: 'EYRA could not summarize this paper', description: error?.message || 'Please retry.', variant: 'destructive' });
    } finally {
      if (activePaperKey.current === paperKey) setLoading(false);
    }
  };

  const ask = async (value = question) => {
    const cleanQuestion = String(value || '').trim();
    const requestPaperKey = paperKey;
    if (!cleanQuestion || asking) return;
    if (!sourceText) {
      toast({ title: 'Source text unavailable', description: 'EYRA needs an accessible abstract or full text to answer questions about this paper.', variant: 'destructive' });
      return;
    }
    const requestId = ++activeRequest.current;
    setAsking(true);
    setQuestion('');
    setConversation(previous => [...previous, { role: 'user', content: cleanQuestion }]);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        response_json_schema: answerSchema,
        prompt: buildPaperQuestionPrompt(paper, cleanQuestion, conversation, sourceText, evidence.evidence_type, evidence.url),
      });
      if (activePaperKey.current !== requestPaperKey || activeRequest.current !== requestId) return;
      setConversation(previous => [...previous, {
        role: 'assistant',
        content: result.answer || 'The supplied source does not provide enough information to answer.',
        evidenceQuote: verifyPaperEvidenceQuote(sourceText, result.evidence_quote),
        uncertainty: result.uncertainty || `This answer is limited to the supplied ${evidence.evidence_type === 'full-text-based' ? 'full text' : 'abstract'}.`,
      }]);
    } catch (error) {
      if (activePaperKey.current !== requestPaperKey || activeRequest.current !== requestId) return;
      setConversation(previous => [...previous, { role: 'error', content: error?.message || 'EYRA could not answer. Please retry.' }]);
    } finally {
      if (activeRequest.current === requestId) setAsking(false);
    }
  };

  const retryLastQuestion = () => {
    const previousQuestion = [...conversation].reverse().find(message => message.role === 'user')?.content;
    if (!previousQuestion) return;
    setConversation(previous => previous.filter(message => message.role !== 'error'));
    ask(previousQuestion);
  };

  const save = async () => {
    if (!summary || saving) return;
    setSaving(true);
    try {
      await savePaperSummary({ entities: base44.entities, paper, sourceText: getPaperAbstract(paper), summary, projectId });
      toast({ title: projectId ? 'Summary saved to project' : 'Summary saved to Library' });
    } catch (error) {
      toast({ title: 'Could not save summary', description: error?.message || 'Please retry.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sourceLabel = evidence.evidence_type === 'full-text-based' ? 'accessible full text' : 'abstract';
  const inputId = `paper-question-${String(paperKey).replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return <section className="mt-3 border-t border-border/40 pt-3">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {sourceText && <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Summary length
        <select value={mode} onChange={event => setMode(event.target.value)} disabled={loading} aria-label="Summary length" className="min-h-8 rounded-md border border-border bg-background px-2 text-[11px] text-foreground disabled:opacity-60">
          {Object.entries(PAPER_SUMMARY_MODES).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
        </select>
      </label>}
      <button type="button" onClick={generate} disabled={loading || loadingFullText} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-60">
        {loading ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}{summary ? 'Regenerate with EYRA' : 'Summarize with EYRA'}
      </button>
      {paper.open_access && paper.pmcid && evidence.evidence_type !== 'full-text-based' && <button type="button" onClick={loadFullText} disabled={loadingFullText || loading} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60">{loadingFullText ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}{loadingFullText ? 'Checking Europe PMC…' : 'Use accessible full text'}</button>}
      <button type="button" onClick={() => setShowQuestions(value => !value)} disabled={!sourceText} aria-expanded={showQuestions} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"><MessageCircle size={12} />Ask this paper</button>
      {summary && <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60">{saving ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}{saving ? 'Saving…' : projectId ? 'Save summary to Project' : 'Save summary to Library'}</button>}
    </div>
    {!sourceText && !summary && <p className="mt-2 text-[11px] text-muted-foreground">An accessible abstract or full text is not available for this record.</p>}
    {summary && <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-primary">{PAPER_SUMMARY_MODES[summary.detail_mode]?.label || 'Standard'} · {summary.evidence_type === 'full-text-based' ? 'full-text-based' : 'abstract-based'} summary · verify against source</p>
      <div className="grid gap-2 sm:grid-cols-2">{[
        ['Research objective', summary.objective], ['Methodology', summary.methodology], ['Dataset or participants', summary.dataset], ['Principal findings', summary.findings], ['Conclusions', summary.conclusions], ['Limitations', summary.limitations], ['Practical implications', summary.implications], ['Remaining research questions', summary.questions],
      ].map(([label, value]) => <div key={label}><h5 className="text-[11px] font-semibold text-foreground">{label}</h5><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{value || `Not reported in the supplied ${summary.evidence_type === 'full-text-based' ? 'full text' : 'abstract'}.`}</p></div>)}</div>
      {summary.source_url && <a href={summary.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[11px] text-primary underline">Open source paper</a>}
    </div>}
    {showQuestions && <div className="mt-3 rounded-xl border border-border/70 bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><h5 className="text-xs font-semibold text-foreground">Ask EYRA about this paper</h5><p className="mt-1 text-[10px] text-muted-foreground">Answers use the accessible {sourceLabel} and are limited by what it reports. This conversation is temporary and stays on this page.</p>{(evidence.url || paper.url) && <a href={evidence.url || paper.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[10px] text-primary underline">Open source used for answers</a>}</div>
        {conversation.length > 0 && <button type="button" onClick={() => setConversation([])} className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted" aria-label="Clear paper conversation"><Trash2 size={12} />Clear</button>}
      </div>
      {conversation.length > 0 && <div className="mb-3 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {conversation.map((message, index) => <article key={index} className={message.role === 'user' ? 'ml-6 rounded-lg bg-muted p-3' : 'mr-3 rounded-lg border border-primary/10 bg-primary/5 p-3'}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{message.role === 'user' ? 'You' : message.role === 'error' ? 'EYRA error' : `EYRA · ${sourceLabel}-based`}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-foreground">{message.content}</p>
          {message.evidenceQuote && <blockquote className="mt-2 border-l-2 border-primary/40 pl-2 text-[11px] italic leading-5 text-muted-foreground">“{message.evidenceQuote}” <span className="not-italic">— supplied {sourceLabel}</span></blockquote>}
          {message.uncertainty && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Limits: {message.uncertainty}</p>}
          {message.role === 'error' && <button type="button" onClick={retryLastQuestion} className="mt-2 min-h-8 text-[11px] font-semibold text-primary underline">Retry question</button>}
        </article>)}
        {asking && <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Loader2 size={12} className="animate-spin" />EYRA is checking the {sourceLabel}…</div>}
      </div>}
      <form onSubmit={event => { event.preventDefault(); ask(); }} className="flex items-end gap-2">
        <label className="sr-only" htmlFor={inputId}>Question about this paper</label>
        <textarea id={inputId} value={question} onChange={event => setQuestion(event.target.value)} maxLength={2_000} rows={2} placeholder="Ask about the methods, findings, limitations…" disabled={asking} className="min-h-12 flex-1 resize-y rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60" />
        <button type="submit" disabled={asking || !question.trim()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-50">{asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}Ask</button>
      </form>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>Evidence: supplied {sourceLabel}</span><span>{question.length}/2,000</span></div>
    </div>}
  </section>;
}
