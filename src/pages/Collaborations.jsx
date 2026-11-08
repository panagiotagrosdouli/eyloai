import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { requireSupabase } from '@/lib/supabaseClient';
import { ExternalLink, Plus, Search, Users, X } from 'lucide-react';

const TYPES = [
  ['research', 'Research collaboration'],
  ['phd', 'PhD / supervision'],
  ['job', 'Research job'],
  ['paper', 'Co-author / paper'],
  ['grant', 'Grant consortium'],
  ['other', 'Other'],
];
const PAGE_SIZE = 50;
const EMPTY = { title: '', field: '', description: '', skills: '', opportunity_type: 'research', work_mode: 'flexible', institution: '', location: '', contact_email: '', compensation: 'unspecified', expires_at: '' };
const clean = value => String(value || '').trim();
const typeLabel = type => TYPES.find(([key]) => key === type)?.[1] || type;
const errorText = error => error?.code === '42P01'
  ? 'Collaboration board setup is pending. The database migration must be applied first.'
  : error?.message || 'Please retry.';

export default function Collaborations() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async ({ append = false, offset = 0 } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { data, error: requestError } = await requireSupabase()
        .from('collaboration_posts').select('*')
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (requestError) throw requestError;
      const rows = data || [];
      setPosts(current => {
        if (!append) return rows;
        const knownIds = new Set(current.map(post => post.id));
        return [...current, ...rows.filter(post => !knownIds.has(post.id))];
      });
      setHasMore(rows.length === PAGE_SIZE);
    } catch (err) {
      setError(errorText(err));
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const terms = clean(query).toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return posts.filter(post => {
      if (type !== 'all' && post.opportunity_type !== type) return false;
      const haystack = [post.title, post.field, post.description, post.institution, post.location, ...(post.skills || [])]
        .join(' ').toLocaleLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }, [posts, query, type]);

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      if (!user?.id) throw new Error('Sign in again before publishing.');
      const payload = {
        owner_id: user.id,
        title: clean(form.title), field: clean(form.field), description: clean(form.description),
        opportunity_type: form.opportunity_type, work_mode: form.work_mode,
        institution: clean(form.institution), location: clean(form.location),
        contact_email: clean(form.contact_email), compensation: form.compensation,
        skills: [...new Set(form.skills.split(',').map(clean).filter(Boolean))].slice(0, 12),
        expires_at: form.expires_at || null,
      };
      const { error: insertError } = await requireSupabase().from('collaboration_posts').insert(payload);
      if (insertError) throw insertError;
      setShowForm(false);
      setForm(EMPTY);
      setNotice('Your listing is published to signed-in EYLO members.');
      await load();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const closePost = async post => {
    if (!window.confirm('Close this listing? It will no longer appear to other members.')) return;
    setNotice('');
    try {
      const { error: updateError } = await requireSupabase().from('collaboration_posts')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', post.id).eq('owner_id', user.id);
      if (updateError) throw updateError;
      setNotice('Listing closed.');
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <main className="eylo-page max-w-6xl">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">EYLO Network</p>
          <h1 className="eylo-page-heading">Research collaborations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Find specific research projects, co-authors, PhD opportunities and calls for collaborators. Listings are member-submitted, not independently verified by EYLO.</p>
        </div>
        <button type="button" onClick={() => { setFormError(''); setShowForm(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"><Plus size={17} /> Post an opportunity</button>
      </div>

      {notice && <p role="status" className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">{notice}</p>}
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 p-4 text-sm">{error} <button type="button" onClick={load} className="ml-2 font-semibold underline">Retry</button></div>}
      <div className="mb-7 grid gap-3 sm:grid-cols-[1fr_230px]">
        <label className="relative block">
          <span className="sr-only">Search collaborations by subject, skill or location</span>
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by topic, skill or location…" className="min-h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
        </label>
        <label className="block">
          <span className="sr-only">Filter by collaboration type</span>
          <select value={type} onChange={e => setType(e.target.value)} className="min-h-12 w-full rounded-xl border border-border bg-card px-4 text-sm"><option value="all">All types</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </div>

      {loading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading opportunities…</p>
        : filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><Users className="mx-auto mb-3 text-primary" size={26} /><h2 className="font-semibold">No matching listings yet</h2><p className="mt-2 text-sm text-muted-foreground">Try another scientific term or publish a genuine opportunity.</p></div>
          : <div className="grid gap-4 lg:grid-cols-2">{filtered.map(post => (
            <article key={post.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{typeLabel(post.opportunity_type)}</span><span className="rounded-full bg-secondary px-3 py-1 text-xs">{post.work_mode}</span><span className="rounded-full bg-secondary px-3 py-1 text-xs">{post.compensation === 'paid' ? 'Paid' : post.compensation === 'unpaid' ? 'Unpaid' : 'Compensation not specified'}</span>{post.status === 'closed' && <span className="rounded-full bg-secondary px-3 py-1 text-xs">Closed</span>}</div>
              <h2 className="text-lg font-semibold leading-snug">{post.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{post.field}{post.institution ? ' · ' + post.institution : ''}{post.location ? ' · ' + post.location : ''}</p>
              <p className="mt-4 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/85">{post.description}</p>
              {post.skills?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{post.skills.map(skill => <span key={skill} className="rounded-lg border border-border px-2 py-1 text-xs">{skill}</span>)}</div>}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">Posted {new Date(post.created_at).toLocaleDateString()}{post.expires_at ? ' · Ends ' + post.expires_at : ''}</span>
                {post.owner_id === user?.id ? (post.status === 'open' && <button type="button" onClick={() => closePost(post)} className="text-sm font-semibold text-primary underline">Close listing</button>) : <a href={`mailto:${encodeURIComponent(post.contact_email)}?subject=${encodeURIComponent('EYLO collaboration: ' + post.title)}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Contact publisher <ExternalLink size={15} /></a>}
              </div>
            </article>
          ))}</div>}

      {!loading && hasMore && <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-muted-foreground">Search covers loaded listings. Load older listings to include them in your search.</p>
        <button type="button" onClick={() => load({ append: true, offset: posts.length })} disabled={loadingMore} className="min-h-11 rounded-xl border border-border bg-card px-5 text-sm font-semibold disabled:opacity-50">
          {loadingMore ? 'Loading older listings…' : 'Load older listings'}
        </button>
      </div>}

      {showForm && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 sm:p-8" role="presentation">
        <div role="dialog" aria-modal="true" aria-labelledby="collaboration-form-title" className="mx-auto max-w-2xl rounded-2xl bg-background p-5 shadow-2xl sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="collaboration-form-title" className="text-xl font-semibold">Publish a collaboration opportunity</h2><p className="mt-2 text-sm text-muted-foreground">Only publish genuine opportunities you are authorized to share. Your contact email is visible to signed-in members.</p></div><button aria-label="Close form" type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-secondary"><X size={20} /></button></div>
          <form onSubmit={save} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">Opportunity title<input required minLength={8} maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Co-author for qualitative study of..." className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
            <label className="grid gap-1.5 text-sm font-medium">Scientific field<input required minLength={2} maxLength={120} value={form.field} onChange={e => setForm({ ...form, field: e.target.value })} placeholder="e.g. Computational neuroscience" className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
            <label className="grid gap-1.5 text-sm font-medium">Project details and expectations<textarea required minLength={30} maxLength={3000} rows={5} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Explain the research question, methodology, expected contribution and who can apply." className="rounded-xl border border-border bg-card p-3" /></label>
            <label className="grid gap-1.5 text-sm font-medium">Required skills (comma-separated)<input value={form.skills} maxLength={500} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="Python, systematic review, EEG" className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">Opportunity type<select value={form.opportunity_type} onChange={e => setForm({ ...form, opportunity_type: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3">{TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-medium">Working arrangement<select value={form.work_mode} onChange={e => setForm({ ...form, work_mode: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3">{['flexible','remote','onsite','hybrid'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="grid gap-1.5 text-sm font-medium">Institution (optional)<input maxLength={140} value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Location (optional)<input maxLength={140} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Compensation<select value={form.compensation} onChange={e => setForm({ ...form, compensation: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3"><option value="unspecified">Not specified</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label>
              <label className="grid gap-1.5 text-sm font-medium">Closing date (optional)<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">Public contact email<input required type="email" maxLength={254} value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="Use a professional contact email" className="min-h-11 rounded-xl border border-border bg-card px-3" /></label>
            <p className="text-xs text-muted-foreground">EYLO does not verify vacancy claims, guarantee compensation, or send applications on your behalf. Contact is initiated in your email app.</p>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <button disabled={saving} type="submit" className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">{saving ? 'Publishing…' : 'Publish opportunity'}</button>
          </form>
        </div>
      </div>}
    </main>
  );
}
