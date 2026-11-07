import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, ExternalLink, FileText, Loader2, MapPin, Search, ShieldCheck, Upload, X } from 'lucide-react';
import { extractCvText } from '@/lib/cv-extraction';
import { cvSearchTerms, rankCareers, searchCareers } from '@/lib/careers-api';

const TOPICS = ['PhD climate research', 'postdoctoral AI', 'public health research'];

export default function Careers() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [items, setItems] = useState([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [retrievedAt, setRetrievedAt] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvName, setCvName] = useState('');
  const [cvError, setCvError] = useState('');
  const [consentTerms, setConsentTerms] = useState([]);
  const [consentOpen, setConsentOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rankedItems = useMemo(() => rankCareers(items, cvText), [items, cvText]);

  const runSearch = async (term, page = 0) => {
    const clean = String(term || '').trim();
    if (clean.length < 2) {
      setError('Add a research area, skill or role to search.');
      return;
    }
    setQuery(clean);
    setParams({ q: clean }, { replace: true });
    setLoading(true);
    setError('');
    try {
      const result = await searchCareers(clean, page);
      setItems(result.items);
      setSourceUrl(result.source_url);
      setRetrievedAt(result.retrieved_at);
      if (!result.items.length) setError('No current roles matched that search. Try a broader research topic.');
    } catch (requestError) {
      setItems([]);
      setError(requestError?.message || 'Research roles could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = params.get('q');
    if (initial && initial.length >= 2) runSearch(initial);
  }, []);

  const handleCvFile = async file => {
    setCvError('');
    setCvText('');
    setCvName('');
    if (!file) return;
    try {
      const text = await extractCvText(file);
      if (!text.trim()) throw new Error('This CV file does not contain readable text.');
      setCvText(text.slice(0, 120000));
      setCvName(file.name);
    } catch (readError) {
      setCvError(readError?.message || 'Could not read this CV.');
    }
  };

  const startCvMatch = () => {
    const terms = cvSearchTerms(cvText);
    if (!terms.length) {
      setCvError('Add a text or Markdown CV with research skills and topics before matching.');
      return;
    }
    setConsentTerms(terms);
    setConsentOpen(true);
  };

  const confirmCvMatch = () => {
    setConsentOpen(false);
    runSearch(consentTerms.join(' '));
  };

  return (
    <main className="eylo-page max-w-7xl">
      <section className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm">
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              <Briefcase size={13} aria-hidden="true" /> Research careers
            </p>
            <h1 className="mt-5 max-w-2xl font-serif text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">Your next role, connected to your research.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Search current PhD, postdoctoral and research roles. Match them to your CV in your browser, then review the original posting.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => <button key={topic} type="button" onClick={() => runSearch(topic)} className="min-h-10 rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:border-primary/40">{topic}</button>)}
          </div>
        </div>
        <form onSubmit={event => { event.preventDefault(); runSearch(query); }} className="border-t border-border bg-muted/30 p-4 sm:p-6">
          <label htmlFor="career-query" className="sr-only">Research field or role</label>
          <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-xl border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <Search size={18} className="ml-2 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input id="career-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. climate adaptation, machine learning, PhD supervisor" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}<span className="hidden sm:inline">Search roles</span></button>
          </div>
          <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>Search stays in EYLO · live listings from EURAXESS</span>
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">Source search <ExternalLink size={11} className="inline" /></a>}
          </div>
        </form>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-label="Career results">
        <div className="space-y-4">
          {error && <div role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{error}</div>}
          {loading && <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />Searching EURAXESS…</div>}
          {!loading && !error && items.length > 0 && <p className="text-xs text-muted-foreground">{rankedItems.length} roles · {retrievedAt ? 'updated ' + new Date(retrievedAt).toLocaleString() : 'current source records'} · sorted by CV overlap</p>}
          {!loading && rankedItems.map(item => (
            <article key={item.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">{item.source}</span>
                  {item.country && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin size={11} />{item.country}</span>}
                </div>
                {item.deadline && <span className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">Deadline {item.deadline}</span>}
              </div>
              <h2 className="mt-3 font-serif text-xl leading-7 text-foreground">{item.title}</h2>
              {item.organization && <p className="mt-1 text-sm font-medium text-muted-foreground">{item.organization}</p>}
              {item.description && <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">{item.description}</p>}
              {item.match_terms?.length > 0 && <p className="mt-3 text-xs text-muted-foreground"><strong className="text-foreground">CV overlap:</strong> {item.match_terms.join(' · ')}</p>}
              {cvText && !item.match_terms?.length && <p className="mt-3 text-xs text-muted-foreground">No direct keyword overlap found in the listing text.</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck size={12} />Original record · inspect eligibility at source</span>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">View official posting <ExternalLink size={12} /></a>
              </div>
            </article>
          ))}
          {!loading && !error && items.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><Briefcase size={24} className="mx-auto text-muted-foreground" /><h2 className="mt-3 text-lg font-semibold text-foreground">Find your research role</h2><p className="mt-2 text-sm text-muted-foreground">Search by field, methods, skills, PhD or postdoctoral role.</p></div>}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={18} /></span><div><h2 className="text-sm font-semibold text-foreground">Match to your CV</h2><p className="text-[11px] text-muted-foreground">Private, browser-side matching</p></div></div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Your CV stays in this browser. EYLO compares its terms with official listing text. It never decides eligibility or hiring fit.</p>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted/40"><Upload size={14} />{cvName || 'Choose your CV'}<input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" onChange={event => handleCvFile(event.target.files?.[0])} /></label>
          {cvError && <p role="alert" className="mt-2 text-xs text-destructive">{cvError}</p>}
          {cvText && <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3"><p className="text-[10px] text-muted-foreground">Ready to match · {Math.min(cvText.length, 120000).toLocaleString()} characters</p><button type="button" onClick={startCvMatch} disabled={loading} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Match roles to my CV <ArrowRight size={14} /></button></div>}
          <p className="mt-3 text-[10px] text-muted-foreground">Supported: PDF, DOCX, TXT and Markdown · up to 5 MB. Scanned PDFs may need OCR.</p>
          <Link to={'/researchers' + (query ? '?q=' + encodeURIComponent(query) : '')} className="mt-4 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-primary hover:underline">Explore potential supervisors <ArrowRight size={13} /></Link>
        </aside>
      </section>

      {consentOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="cv-match-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Before the search</p><h2 id="cv-match-title" className="mt-2 text-xl font-semibold text-foreground">Use CV keywords to find roles?</h2></div><button type="button" aria-label="Close" onClick={() => setConsentOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"><X size={16} /></button></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">EYLO will send these extracted search terms to EURAXESS. Your CV file and full text stay in this browser. Matching happens locally against the listings returned.</p>
          <div className="mt-4 flex flex-wrap gap-2">{consentTerms.map(term => <span key={term} className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{term}</span>)}</div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConsentOpen(false)} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground">Cancel</button><button type="button" onClick={confirmCvMatch} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Search EURAXESS <ArrowRight size={14} /></button></div>
        </section>
      </div>}
    </main>
  );
}
