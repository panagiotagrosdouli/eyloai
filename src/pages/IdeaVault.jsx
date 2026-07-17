import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Lightbulb, Plus, X, Sparkles, Loader2, Trash2, ArrowRight, Tag } from 'lucide-react';
import { EyraSectionLabel, EyraPoweredBy } from '@/components/eyra/EyraBadge';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';

const CATEGORIES = ['research', 'startup', 'collaboration', 'funding', 'technology', 'other'];
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
  const [showNew, setShowNew] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'research', tags: '' });
  const { toast } = useToast();

  useEffect(() => { loadIdeas(); }, []);

  const loadIdeas = async () => {
    setLoading(true);
    const data = await base44.entities.Idea.list('-created_date');
    setIdeas(data);
    setLoading(false);
  };

  const createIdea = async () => {
    if (!form.title.trim()) return;
    await base44.entities.Idea.create({ ...form, status: 'active' });
    setForm({ title: '', description: '', category: 'research', tags: '' });
    setShowNew(false);
    loadIdeas();
    toast({ title: 'Idea saved to vault' });
  };

  const deleteIdea = async (id) => {
    await base44.entities.Idea.delete(id);
    setIdeas(prev => prev.filter(i => i.id !== id));
    toast({ title: 'Idea removed' });
  };

  const analyzeIdea = async (idea) => {
    setAnalyzing(idea.id);
    let user;
    try { user = await base44.auth.me(); } catch { user = {}; }
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, an evidence-based research AI. Analyze this idea and provide strategic intelligence.

IDEA: "${idea.title}"
DESCRIPTION: "${idea.description || 'Not provided'}"
CATEGORY: ${idea.category}
USER CONTEXT: Research interests: ${user.research_interests || 'unspecified'}, Goal: ${user.career_goal || 'unspecified'}

Provide a concise markdown analysis (max 200 words):

## Opportunity Assessment
Is this a strong idea? What's the potential?

## Key Actions
3 specific steps to develop this idea further.

## Real Funding to Explore
1-2 real funding programs that could support this (Horizon Europe, ERC, NSF, etc.)

## Risks & Uncertainties
What are the main challenges?

RULES: Only reference real programs and verifiable information. State any uncertainty clearly.`,
    });
    try {
      await base44.entities.Idea.update(idea.id, { eyra_notes: result });
      setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, eyra_notes: result } : i));
      toast({ title: 'EYRA analysis complete' });
    } catch {
      toast({ title: 'Could not save analysis', variant: 'destructive' });
    }
    setAnalyzing(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={18} className="text-primary" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Idea Vault</h1>
          </div>
          <p className="text-muted-foreground text-sm">Store ideas. EYRA monitors them and alerts you when new opportunities match.</p>
          <EyraPoweredBy label="Monitored by EYRA" className="justify-start mt-1" />
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <Plus size={14} /> New Idea
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
                <Lightbulb size={14} className="text-primary" /> Capture your idea
              </h3>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What's your idea?"
                autoFocus
                className="w-full h-11 px-4 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe it briefly. EYRA will monitor opportunities matching this idea."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
              />
              <div className="flex items-center gap-3">
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex-1 h-10 px-3 rounded-xl border border-border bg-secondary/60 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="Tags (comma separated)"
                  className="flex-1 h-10 px-4 rounded-xl border border-border bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={createIdea} disabled={!form.title.trim()}
                  className="px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold disabled:opacity-40">
                  Save Idea
                </button>
                <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ideas */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
            <Lightbulb size={22} className="text-muted-foreground/50" />
          </div>
          <p className="font-semibold text-sm text-foreground mb-2">Your Idea Vault is empty</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed mb-4">
            Capture research ideas, startup concepts, or collaboration opportunities. EYRA will monitor new papers, funding, and researchers that match each idea.
          </p>
          <button onClick={() => setShowNew(true)} className="px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold">
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg eyra-gradient text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {analyzing === idea.id ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      {analyzing === idea.id ? 'Analyzing...' : idea.eyra_notes ? 'Re-analyze' : 'Analyze'}
                    </button>
                    <button onClick={() => deleteIdea(idea.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                      <Trash2 size={12} className="text-destructive/50" />
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
