import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Copy, ExternalLink, Loader2, Mail, Search, Users } from 'lucide-react';
import { searchOpenAlexAuthors, searchResearchPeopleByPublications } from '@/lib/eyra-api';
import BrandLogo from '@/components/brand/BrandLogo';

const examples = ['Robotics and machine learning', 'Public health', 'Climate adaptation'];
const OUTREACH_KEY = 'eylo-outreach-drafts-v1';
const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const readOutreach = () => {
  try { const stored = JSON.parse(window.localStorage.getItem(OUTREACH_KEY) || '[]'); return Array.isArray(stored) ? stored.slice(0, 50) : []; }
  catch { return []; }
};
const persistOutreach = records => {
  try { window.localStorage.setItem(OUTREACH_KEY, JSON.stringify(records)); return true; }
  catch { return false; }
};

export default function PublicResearchers() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [researchers, setResearchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);
  const [institutionalEmail, setInstitutionalEmail] = useState('');
  const [outreachRecords, setOutreachRecords] = useState(readOutreach);
  const [outreachMessage, setOutreachMessage] = useState('');
  const topic = params.get('q') || '';

  useEffect(() => { setQuery(topic); }, [topic]);

  useEffect(() => {
    if (!topic.trim()) { setResearchers([]); setSearched(false); return; }
    let active = true;
    setLoading(true);
    setSearched(true);
    setError('');
    Promise.allSettled([
      searchOpenAlexAuthors(topic, 20, { throwOnError: true }),
      searchResearchPeopleByPublications(topic, 20),
    ]).then(outcomes => {
      if (!active) return;
      if (outcomes.every(outcome => outcome.status === 'rejected')) {
        setError('Researcher indexes are unavailable right now. Please try again.');
        setResearchers([]);
        return;
      }
      const combined = outcomes.flatMap(outcome => outcome.status === 'fulfilled' && Array.isArray(outcome.value) ? outcome.value : []);
      const seen = new Set();
      const unique = combined.filter(person => {
        const key = String(person.id || person.profile_url || person.name || '').toLowerCase();
        if (!person.name || !key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setResearchers(unique.slice(0, 30));
    }).catch(() => { if (active) setError('Could not load public scholarly profiles.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [topic]);

  const createDraft = researcher => {
    setCopied(false);
    setInstitutionalEmail('');
    setOutreachMessage('');
    setSelected({
      name: researcher.name,
      draft: `Subject: Research collaboration or supervision inquiry — ${topic}

Dear Professor / Dr. ${researcher.name},

I am interested in ${topic} and found your public scholarly profile while exploring related work through EYLO and OpenAlex.

I would be grateful to learn whether you are accepting research inquiries, doctoral candidates or collaborations in this area, or whether you could direct me to the appropriate university application process.

I understand your availability is not confirmed by EYLO. I can share a brief research summary and CV if helpful.

Best regards,
[Your name]
[Your affiliation]`,
    });
  };

  const copyDraft = async () => {
    try { await navigator.clipboard.writeText(selected.draft); setCopied(true); }
    catch { setCopied(false); }
  };
  const upsertOutreach = (status = 'draft') => {
    if (!selected) return;
    const email = institutionalEmail.trim().toLowerCase();
    const key = selected.name + '|' + topic;
    const entry = {
      key, name: selected.name, topic, email: EMAIL_PATTERN.test(email) ? email : '',
      draft: selected.draft, status, updatedAt: new Date().toISOString(),
    };
    const updated = [entry, ...outreachRecords.filter(item => item.key !== key)].slice(0, 50);
    if (!persistOutreach(updated)) { setOutreachMessage('Browser storage is unavailable; copy your draft before leaving.'); return; }
    setOutreachRecords(updated);
    setOutreachMessage(status === 'draft' ? 'Draft saved on this device.' : 'Email app opened. The message has not been confirmed sent.');
  };

  const openEmailDraft = () => {
    if (!selected || !EMAIL_PATTERN.test(institutionalEmail.trim())) {
      setOutreachMessage('Enter a verified institutional email address before preparing an email.');
      return;
    }
    const lines = selected.draft.split('\\n');
    const title = lines[0]?.startsWith('Subject:') ? lines[0].slice(8).trim() : 'Research inquiry';
    const body = lines[0]?.startsWith('Subject:') ? lines.slice(2).join('\\n') : selected.draft;
    const url = 'mailto:' + encodeURIComponent(institutionalEmail.trim()) + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    upsertOutreach('email_app_opened');
    window.location.href = url;
  };

  const updateRecordStatus = (key, status) => {
    const updated = outreachRecords.map(item => item.key === key ? { ...item, status, updatedAt: new Date().toISOString() } : item);
    if (persistOutreach(updated)) setOutreachRecords(updated);
  };

  return (
    <main className="min-h-screen bg-white text-[#172A40]">
      <header className="sticky top-0 z-30 border-b border-[#E2EAF1] bg-white/95 backdrop-blur-xl"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-9"><Link to="/" aria-label="EYLO company homepage"><BrandLogo brand="eylo" size="nav" priority /></Link><Link to="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-[#285C7B]"><ArrowLeft size={16}/> EYLO AI Discovery</Link></div></header>
      <div className="mx-auto max-w-7xl px-5 pb-24 pt-12 sm:px-9 sm:pt-16">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#3B80AA]">PUBLIC SCHOLARLY PROFILES</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-.06em] sm:text-6xl">Find researchers.</h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[#62788A]">Discover researchers through published work. Review verified source profiles and prepare a respectful inquiry. EYLO cannot confirm supervision availability or book a meeting on someone's behalf.</p>
        <form onSubmit={event => { event.preventDefault(); if(query.trim().length > 1) setParams({q:query.trim().slice(0,180)}); }} role="search" className="mt-8 flex max-w-3xl items-center gap-2 rounded-2xl border border-[#D9E5ED] bg-[#FAFCFE] p-2 shadow-sm"><Search size={18} className="ml-3 shrink-0 text-[#5D879D]"/><label htmlFor="faculty-query" className="sr-only">Research field or researcher</label><input id="faculty-query" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Research field, supervisor or topic" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"/><button type="submit" disabled={loading || query.trim().length<2} className="min-h-11 rounded-xl bg-[#172A40] px-5 text-sm font-semibold text-white disabled:opacity-50">Search</button></form>
        <div className="mt-4 flex flex-wrap gap-2">{examples.map(term=><button key={term} type="button" onClick={()=>setParams({q:term})} className="rounded-full border border-[#DFE7ED] px-3 py-2 text-xs text-[#577588] hover:bg-[#ECF5FB]">{term}</button>)}</div>
        {loading && <div role="status" className="mt-12 flex items-center gap-3 text-[#55748A]"><Loader2 className="animate-spin" size={20}/> Looking up researcher records…</div>}
        {error && <div role="alert" className="mt-9 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</div>}
        {searched && !loading && !error && <p className="mt-9 text-sm text-[#6B7F8E]">{researchers.length ? `${researchers.length} relevant public profiles found` : "No public profiles matched this query. Try another topic or researcher name."}</p>}
        {!loading && <div className="mt-7 grid gap-4 md:grid-cols-2">{researchers.map(person=><article key={person.id || person.profile_url || person.name} className="rounded-2xl border border-[#DCE7EF] bg-white p-6 shadow-[0_12px_25px_-24px_rgba(24,54,76,.3)]"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EFF6FB] text-[#2A739B]"><Users size={21}/></span><div className="min-w-0"><h2 className="text-lg font-bold tracking-tight">{person.name}</h2><p className="mt-1 text-xs leading-5 text-[#667D8D]">{person.institution || 'Institution not listed'}</p><p className="mt-2 text-xs text-[#718898]">{typeof person.works_count==='number'?person.works_count+' indexed works · ':''}Scholarly directory data</p></div></div><div className="mt-6 flex flex-wrap gap-3">{person.profile_url && <a href={person.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#D7E5EF] px-4 py-2.5 text-xs font-semibold text-[#28698F]">View source profile <ExternalLink size={14}/></a>}<button type="button" onClick={()=>createDraft(person)} className="inline-flex items-center gap-2 rounded-xl bg-[#172A40] px-4 py-2.5 text-xs font-semibold text-white">Prepare inquiry <ArrowRight size={14}/></button></div></article>)}</div>}
        {selected && <section aria-label="Research outreach draft" className="mt-10 max-w-4xl rounded-2xl border border-[#BCD9EB] bg-[#F5FAFD] p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#4E89AC]">Editable outreach draft</p><h2 className="mt-2 text-2xl font-bold">Contact {selected.name}</h2></div><button onClick={copyDraft} type="button" className="inline-flex items-center gap-2 rounded-xl bg-[#172A40] px-4 py-2.5 text-sm font-semibold text-white"><Copy size={15}/>{copied?'Copied':'Copy draft'}</button></div><textarea value={selected.draft} onChange={event=>setSelected({...selected,draft:event.target.value})} rows={13} aria-label="Edit your outreach message" className="mt-5 w-full resize-y rounded-xl border border-[#D6E5EE] bg-white p-4 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#8FBAD3]"/><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><div><label htmlFor="official-email" className="text-xs font-semibold text-[#3B5971]">Verified institutional email (enter manually)</label><input id="official-email" type="email" value={institutionalEmail} onChange={event=>{setInstitutionalEmail(event.target.value);setOutreachMessage('');}} placeholder="researcher@university.edu" className="mt-2 min-h-11 w-full rounded-xl border border-[#D6E5EE] bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#8FBAD3]"/></div><button type="button" onClick={openEmailDraft} disabled={!EMAIL_PATTERN.test(institutionalEmail.trim())} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#172A40] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Mail size={16}/> Open email app</button></div>
        <button type="button" onClick={()=>upsertOutreach('draft')} className="mt-3 rounded-xl border border-[#C9DCE8] bg-white px-4 py-2.5 text-xs font-semibold text-[#285E83]">Save draft on this device</button>
        {outreachMessage && <p role="status" className="mt-3 text-xs font-medium text-[#326B87]">{outreachMessage}</p>}
        <p className="mt-3 text-xs leading-6 text-[#6E8494]">Only enter an address you independently verified on an official university website. Opening your email app does not send the message. A meeting is confirmed only when the researcher agrees.</p></section>}
        {outreachRecords.length > 0 && <section aria-label="Your outreach tracker" className="mt-12 max-w-5xl rounded-2xl border border-[#DAE6EE] bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#4A86AA]">Stored on this browser only</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Your research inquiries</h2><p className="mt-3 text-sm leading-7 text-[#607789]">Track drafts and responses manually. EYLO does not monitor email replies or confirm professor availability.</p><div className="mt-6 divide-y divide-[#E6EEF3]">{outreachRecords.map(item=><article key={item.key} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-[#6E8291]">{item.topic} · {item.status === 'email_app_opened' ? 'Email app opened (not confirmed sent)' : item.status === 'sent' ? 'Marked sent by you' : item.status === 'accepted' ? 'Acceptance reported by you' : 'Draft'}</p></div><div className="flex flex-wrap items-center gap-2">{item.status !== 'sent' && item.status !== 'accepted' && <button type="button" onClick={()=>updateRecordStatus(item.key,'sent')} className="rounded-lg border border-[#D5E3EC] px-3 py-2 text-xs font-semibold text-[#376985]">I sent this email</button>}{item.status === 'sent' && <button type="button" onClick={()=>updateRecordStatus(item.key,'accepted')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5E3EC] px-3 py-2 text-xs font-semibold text-[#376985]"><CheckCircle2 size={14}/> Professor accepted</button>}<button type="button" onClick={()=>{const updated=outreachRecords.filter(record=>record.key!==item.key);if(persistOutreach(updated))setOutreachRecords(updated);}} className="rounded-lg border border-[#E6E6E6] px-3 py-2 text-xs text-[#74818B]">Remove</button></div></article>)}</div></section>}
        <div className="mt-14 flex items-center gap-3 rounded-2xl bg-[#F1F6FA] p-6 text-sm text-[#4B6478]"><BookOpen className="shrink-0 text-[#377A9F]" size={21}/><span>Search results are derived from public research indexes. A matching profile does not imply endorsement, availability or agreement to supervise.</span></div>
      </div>
    </main>
  );
}
