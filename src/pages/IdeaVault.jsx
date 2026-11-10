import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { searchAllPapers } from '@/lib/eyra-api';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { monitoringStore } from '@/lib/monitoring-service';
import { Lightbulb, Plus, X, Sparkles, Loader2, Trash2, Tag, Pencil } from 'lucide-react';
import { EyraSectionLabel } from '@/components/eyra/EyraBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import { promiseWithTimeout } from '@/lib/promise-timeout';

const CATEGORIES = ['research', 'startup', 'collaboration', 'funding', 'technology', 'other'];
const IDEAS_LOAD_TIMEOUT_MS = 12_000;
const CAT_COLORS = {
  research: 'bg-primary/10 text-primary',
  startup: 'bg-green-500/10 text-green-400',
  collaboration: 'bg-accent/10 text-accent',
  funding: 'bg-amber-500/10 text-amber-400',
  technology: 'bg-chart-3/10 text-chart-3',
  other: 'bg-secondary text-muted-foreground',
};

export default function IdeaVault() {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'research', tags: '' });
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    promiseWithTimeout(
      base44.entities.Idea.list('-created_date'),
      IDEAS_LOAD_TIMEOUT_MS,
      'Ideas took too long to load. Check your connection and retry.',
    )
      .then(data => { if (active) setIdeas(data); })
      .catch(error => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Ideas could not be loaded. Please retry.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setShowNew(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadIdeas = () => setLoadAttempt(attempt => attempt + 1);

  const closeForm = () => {
    setShowNew(false);
    setEditingId(null);
    setFormError('');
    setForm({ title: '', description: '', category: 'research', tags: '' });
  };

  const startEditing = (idea) => {
    setEditingId(idea.id);
    setForm({
      title: idea.title || '',
      description: idea.description || '',
      category: CATEGORIES.includes(idea.category) ? idea.category : 'research',
      tags: idea.tags || '',
    });
    setFormError('');
    setShowNew(true);
  };

  const createIdea = async () => {
    const title = form.title.trim();
    if (!title || saving) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title,
        description: form.description.trim(),
        category: form.category,
        tags: form.tags.trim(),
      };
      if (editingId) {
        await base44.entities.Idea.update(editingId, payload);
        toast({ title: 'Idea updated' });
      } else {
        await base44.entities.Idea.create({ ...payload, status: 'active' });
        const watchQuery = [payload.title, payload.description, payload.tags].filter(Boolean).join(' ');
        let watchlistsReady = true;
        try {
          monitoringStore.addWatchlist({ query: watchQuery, type: 'topic' });
          monitoringStore.addWatchlist({ query: watchQuery, type: 'funding program' });
        } catch {
          watchlistsReady = false;
        }
        toast({
          title: 'Idea saved to vault',
          ...(watchlistsReady ? {} : { description: 'The idea was saved, but research watchlists could not be created.' }),
        });
      }
      closeForm();
      loadIdeas();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      setFormError(message);
      toast({
        title: editingId ? 'Idea could not be updated' : 'Idea could not be saved',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteIdea = async (id) => {
    if (deletingId) return;
    const idea = ideas.find(item => item.id === id);
    if (!window.confirm(`Delete “${idea?.title || 'this idea'}”? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await base44.entities.Idea.delete(id);
      setIdeas(prev => prev.filter(i => i.id !== id));
      toast({ title: 'Idea removed' });
    } catch (error) {
      toast({
        title: 'Idea could not be deleted',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const analyzeIdea = async (idea) => {
    setAnalyzing(idea.id);
    try {
      let user;
      try { user = await base44.auth.me(); } catch { user = {}; }

      const evidenceQuery = [idea.title, idea.description, idea.tags].filter(Boolean).join(' ');
      const [papers, fundingResult] = await Promise.all([
        searchAllPapers(evidenceQuery),
        searchFundingOpportunities(evidenceQuery, 5).catch(() => ({ items: [] })),
      ]);

      const paperContext = papers.slice(0, 6).map((paper, index) =>
        `[P${index + 1}] "${paper.title}" — ${paper.authors || 'Unknown'} (${paper.year || 'n/a'}) — ${paper.url}`
      ).join('\n');
      const fundingContext = fundingResult.items.slice(0, 5).map((item, index) =>
        `[F${index + 1}] "${item.title}" — ${item.agency} — deadline ${item.deadline || 'not supplied'} — ${item.source_url}`
      ).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are EYRA, an evidence-based research AI. Analyze this idea using the retrieved records below.

IDEA: "${idea.title}"
DESCRIPTION: "${idea.description || 'Not provided'}"
CATEGORY: ${idea.category}
USER CONTEXT: Research interests: ${user.research_interests || 'unspecified'}, Goal: ${user.career_goal || 'unspecified'}

VERIFIED PAPERS:
${paperContext || 'No matching scholarly records were retrieved.'}

VERIFIED FUNDING RECORDS:
${fundingContext || 'No matching official funding records were retrieved.'}

Provide a concise markdown analysis:

## Evidence Assessment
Assess the idea using only [P] records. Separate evidence from inference.

## Key Actions
Three specific next steps.

## Funding Records
Reference only supplied [F] records. If none were supplied, say that no official match was retrieved.

## Risks & Uncertainties
Main scientific, execution, and evidence gaps.

Never invent papers, programs, deadlines, statistics, or URLs.`,
      });

      await base44.entities.Idea.update(idea.id, { eyra_notes: result });
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, eyra_notes: result } : i));
      toast({ title: 'EYRA evidence analysis complete' });
    } catch (error) {
      toast({
        title: 'EYRA analysis did not complete',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(null);
    }
  };

  return (
    <div className="eylo-page max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="eylo-page-heading">Ideas</h1>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ title: '', description: '', category: 'research', tags: '' });
            setFormError('');
            setShowNew(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* New Idea Form */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 p-6 rounded-2xl border border-primary/20 bg-primary/5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Lightbulb size={14} className="text-primary" /> {editingId ? 'Edit your idea' : 'Capture your idea'}
              </h3>
              <button type="button" onClick={closeForm} aria-label="Close idea form" disabled={saving} className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50">
                <X size={14} className="text-muted-foreground" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              <label htmlFor="idea-title" className="sr-only">Idea title</label>
              <input
                id="idea-title"
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What's your idea?"
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <label htmlFor="idea-description" className="sr-only">Idea description</label>
              <textarea
                id="idea-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe it briefly. EYLO will create research and official-funding watchlists for this idea."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
              />
              <div className="flex items-center gap-3">
                <label htmlFor="idea-category" className="sr-only">Idea category</label>
                <select
                  id="idea-category"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex-1 h-10 px-3 rounded-xl border border-border bg-secondary/60 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <label htmlFor="idea-tags" className="sr-only">Idea tags</label>
                <input
                  id="idea-tags"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="Tags (comma separated)"
                  className="flex-1 h-10 px-4 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={createIdea} disabled={!form.title.trim() || saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
                  {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  {saving ? 'Saving…' : editingId ? 'Update idea' : 'Save Idea'}
                </button>
                <button type="button" onClick={closeForm} disabled={saving} className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ideas */}
      {loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" /> Loading ideas…
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-foreground">Ideas could not be loaded.</p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
          <button type="button" onClick={loadIdeas} className="mt-3 min-h-9 text-xs font-semibold text-primary hover:underline">Try again</button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
            <Lightbulb size={22} className="text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-sm text-foreground mb-2">Your Idea Vault is empty</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
            Capture an idea and EYLO will create research and official-funding watchlists. Run a watchlist check whenever you want fresh records.
          </p>
          <button onClick={() => setShowNew(true)} className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Add your first idea
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {ideas.map(idea => (
            <div key={idea.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${CAT_COLORS[idea.category] || CAT_COLORS.other}`}>
                        {idea.category}
                      </span>
                      {idea.tags && idea.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-1">
                          <Tag size={8} />{tag}
                        </span>
                      ))}
                    </div>
                    <h4 className="font-semibold text-sm text-foreground">{idea.title}</h4>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{idea.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => analyzeIdea(idea)}
                      disabled={analyzing === idea.id}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60"
                    >
                      {analyzing === idea.id ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      {analyzing === idea.id ? 'Analyzing...' : idea.eyra_notes ? 'Re-analyze' : 'Analyze'}
                    </button>
                    <button type="button" onClick={() => startEditing(idea)} aria-label={`Edit ${idea.title || 'idea'}`} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                      <Pencil size={12} className="text-muted-foreground" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => deleteIdea(idea.id)} aria-label={`Delete ${idea.title || 'idea'}`} disabled={deletingId === idea.id} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50">
                      {deletingId === idea.id ? <Loader2 size={12} className="animate-spin text-destructive" aria-hidden="true" /> : <Trash2 size={12} className="text-destructive/50" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* EYRA Analysis */}
              {idea.eyra_notes && (
                <div className="px-5 pb-5 border-t border-border/50 pt-4">
                  <EyraSectionLabel label="EYRA Analysis" className="mb-2" />
                  <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:text-xs prose-headings:font-semibold prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 text-xs">
                    <ReactMarkdown>{idea.eyra_notes}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
