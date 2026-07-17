import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Trophy, Sparkles, Loader2, Search, ExternalLink, Bookmark,
  Calendar, DollarSign, Globe, RefreshCw, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/ui/use-toast';
import { buildUserProfile } from '@/lib/second-brain';

const TYPE_CONFIG = {
  competition: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Competition' },
  grant: { color: 'text-primary bg-primary/10 border-primary/20', label: 'Grant' },
  accelerator: { color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Accelerator' },
  fellowship: { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Fellowship' },
  challenge: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', label: 'Challenge' },
  prize: { color: 'text-chart-3 bg-chart-3/10 border-chart-3/20', label: 'Prize' },
};

export default function Challenges() {
  const [profile, setProfile] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const p = await buildUserProfile();
    setProfile(p);
  };

  const findChallenges = async (query) => {
    setLoading(true);
    setHasRun(true);

    const context = profile ? `
User Profile:
- Research Interests: ${profile.user?.research_interests || 'Not specified'}
- Skills: ${profile.user?.skills || 'Not specified'}
- Country: ${profile.user?.country || 'Not specified'}
- Career Goal: ${profile.user?.career_goal || 'Not specified'}
- Active Projects: ${profile.activeProjects?.map(p => p.title).join(', ') || 'None'}
` : '';

    const searchFocus = query || profile?.activeProjects?.[0]?.goal || profile?.user?.research_interests || 'research and innovation';

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are EYRA, searching for real innovation challenges, competitions, grants, and prizes for a researcher/innovator.

${context}
Search focus: "${searchFocus}"

Find 12 REAL, currently open or recently announced opportunities. Use your knowledge of real programs:
- Real innovation competitions (XPRIZE, Innovate UK challenges, EIC Accelerator, Hello Tomorrow, MIT Solve, etc.)
- Real EU/national grant calls (Horizon Europe calls, ERC, national innovation agencies)
- Real accelerator programs (EIT, Startupbootcamp, Y Combinator, Entrepreneur First)
- Real fellowships (Marie Skłodowska-Curie, Fulbright, Royal Society)
- Real prize competitions (Wellcome Prize, Newton Prize, etc.)

CRITICAL: Only include REAL programs that actually exist. If you're not confident a specific current deadline is accurate, leave deadline as "Check official website" but the program must be real.

For each, return:
- title: exact real program name
- type: "competition"|"grant"|"accelerator"|"fellowship"|"challenge"|"prize"  
- organizer: real organization name
- description: what it funds/rewards (based on real program knowledge)
- amount: prize/funding amount if known, or "Varies"
- deadline: deadline if known, or "Check official website"
- url_hint: the real website domain (e.g., "xprize.org", "eic.ec.europa.eu")
- match_reason: why this matches the user's profile/focus
- eligibility: key eligibility criteria`,
      response_json_schema: {
        type: 'object',
        properties: {
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string' },
                organizer: { type: 'string' },
                description: { type: 'string' },
                amount: { type: 'string' },
                deadline: { type: 'string' },
                url_hint: { type: 'string' },
                match_reason: { type: 'string' },
                eligibility: { type: 'string' },
              },
            },
          },
        },
      },
      add_context_from_internet: true,
      model: 'gemini_3_flash',
    });

    setChallenges(result.opportunities || []);
    setLoading(false);
    if ((result.opportunities || []).length === 0) {
      toast({ title: 'No results found — try a different search', variant: 'destructive' });
    }
  };

  const saveOpportunity = async (c) => {
    await base44.entities.SavedOpportunity.create({
      title: c.title,
      type: c.type || 'competition',
      description: c.description,
      deadline: c.deadline,
      url: c.url_hint ? `https://${c.url_hint}` : '',
      source: c.organizer,
    });
    toast({ title: 'Saved to your library' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg eyra-gradient flex items-center justify-center">
              <Trophy size={14} className="text-white" />
            </div>
            <h1 className="font-heading font-bold text-2xl">Innovation Challenges</h1>
          </div>
          <p className="text-sm text-muted-foreground">EYRA finds real competitions, grants, and prizes matched to your research profile</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={manualQuery}
              onChange={e => setManualQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && findChallenges(manualQuery)}
              placeholder={`Search by topic, field, or technology...`}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={() => findChallenges(manualQuery)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Searching...' : 'Find Challenges'}
          </button>
        </div>

        {/* Profile-based auto-search */}
        {!hasRun && profile && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.activeProjects?.slice(0, 3).map(p => (
              <button key={p.id} onClick={() => findChallenges(p.goal)}
                className="px-3 py-1.5 rounded-full border border-primary/25 bg-primary/5 text-xs text-primary hover:bg-primary/10 transition-colors">
                Match for: {p.title}
              </button>
            ))}
            {profile.user?.research_interests && (
              <button onClick={() => findChallenges(profile.user.research_interests)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-secondary/40 text-xs text-muted-foreground hover:text-foreground transition-colors">
                My interests: {profile.user.research_interests.slice(0, 40)}…
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty / prompt state */}
      {!hasRun && !loading && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <Trophy size={24} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm mb-2">Find real competitions & grants</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mb-5">
            EYRA searches for real programs — XPRIZE, Horizon Europe, EIC, fellowships, accelerators — matched to your profile.
          </p>
          {profile?.activeProjects?.[0] && (
            <button onClick={() => findChallenges(profile.activeProjects[0].goal)}
              className="px-6 py-2.5 rounded-xl eyra-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Find challenges for my projects →
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center mb-4 animate-pulse-glow">
            <Sparkles size={20} className="text-white" />
          </div>
          <p className="font-semibold text-sm mb-1">Searching for real opportunities...</p>
          <p className="text-xs text-muted-foreground">EYRA is scanning competitions, grants, and fellowships</p>
        </div>
      )}

      {/* Results */}
      {hasRun && !loading && challenges.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{challenges.length} real opportunities found</p>
            <button onClick={() => findChallenges(manualQuery)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
            <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Always verify deadlines and eligibility on the official website before applying. EYRA finds real programs but deadline information may have changed.
            </p>
          </div>

          {challenges.map((c, i) => {
            const cfg = TYPE_CONFIG[c.type] || TYPE_CONFIG.challenge;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-5 rounded-xl border border-border bg-card hover:border-primary/25 card-glow transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${cfg.color}`}>{cfg.label}</span>
                      {c.organizer && <span className="text-[10px] text-muted-foreground">{c.organizer}</span>}
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{c.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2">{c.description}</p>
                    {c.match_reason && (
                      <div className="flex items-start gap-1.5 mb-2 p-2 rounded-lg bg-primary/5 border border-primary/15">
                        <Sparkles size={10} className="text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-primary">{c.match_reason}</p>
                      </div>
                    )}
                    {c.eligibility && (
                      <p className="text-[10px] text-muted-foreground/70 mb-2"><span className="font-medium">Eligibility:</span> {c.eligibility}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {c.amount && c.amount !== 'Varies' && (
                        <span className="flex items-center gap-1 text-primary font-semibold"><DollarSign size={10} />{c.amount}</span>
                      )}
                      {c.deadline && (
                        <span className="flex items-center gap-1"><Calendar size={9} />{c.deadline}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {c.url_hint && (
                      <a href={`https://${c.url_hint}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:border-primary/30 transition-colors">
                        <Globe size={11} /> Visit <ExternalLink size={9} />
                      </a>
                    )}
                    <button onClick={() => saveOpportunity(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors">
                      <Bookmark size={11} /> Save
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
