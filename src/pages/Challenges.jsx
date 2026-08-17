import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { searchFundingOpportunities } from '@/lib/funding-api';
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
  call: { color: 'text-chart-3 bg-chart-3/10 border-chart-3/20', label: 'Open Call' },
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
  const [sourceMeta, setSourceMeta] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [rankingError, setRankingError] = useState('');
  const { toast } = useToast();

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const p = await buildUserProfile();
    setProfile(p);
  };

  const findChallenges = async (query) => {
    setLoading(true);
    setHasRun(true);
    setSearchError('');
    setRankingError('');
    setSourceMeta(null);
    setChallenges([]);

    const searchFocus = query || profile?.activeProjects?.[0]?.goal || profile?.user?.research_interests || 'research and innovation';

    try {
      const sourceResult = await searchFundingOpportunities(searchFocus, 12);
      setSourceMeta(sourceResult);

      const verified = sourceResult.items.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        organizer: item.agency,
        description: item.description,
        amount: item.amount,
        deadline: item.deadline,
        url_hint: item.source_url,
        match_reason: '',
        eligibility: item.eligibility,
        source: item.source,
        source_id: item.source_id,
      }));
      setChallenges(verified);

      if (verified.length > 0) {
        try {
          const ranking = await base44.integrations.Core.InvokeLLM({
            prompt: `You are EYRA. Explain the relevance of ONLY the verified official funding records below.

USER PROFILE:
- Interests: ${profile?.user?.research_interests || 'Not specified'}
- Skills: ${profile?.user?.skills || 'Not specified'}
- Country: ${profile?.user?.country || 'Not specified'}
- Career goal: ${profile?.user?.career_goal || 'Not specified'}
- Projects: ${profile?.activeProjects?.map((project) => project.title).join(', ') || 'None'}
SEARCH FOCUS: "${searchFocus}"

VERIFIED RECORDS:
${verified.map((item) => JSON.stringify({
  id: item.id,
  title: item.title,
  organizer: item.organizer,
  description: item.description,
  eligibility: item.eligibility,
  deadline: item.deadline,
  amount: item.amount,
})).join('\n')}

Return one result for every supplied id. Do not add programs or change factual fields.`,
            response_json_schema: {
              type: 'object',
              properties: {
                ranked: {
                  type: 'array',
                  minItems: verified.length,
                  maxItems: verified.length,
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', enum: verified.map((item) => item.id) },
                      match_reason: { type: 'string' },
                    },
                  },
                },
              },
            },
          });
          const byId = new Map((ranking.ranked || []).map((item) => [item.id, item]));
          setChallenges(verified.map((item) => ({ ...item, ...(byId.get(item.id) || {}) })));
        } catch (error) {
          setRankingError(
            `Verified calls loaded, but EYRA analysis is unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
        }
      }

      if (verified.length === 0) {
        toast({ title: 'No official records matched — try a broader search', variant: 'destructive' });
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Official call search failed.');
    } finally {
      setLoading(false);
    }
  };

  const saveOpportunity = async (c) => {
    await base44.entities.SavedOpportunity.create({
      title: c.title,
      type: c.type || 'competition',
      description: c.description,
      deadline: c.deadline,
      url: c.url_hint || '',
      source: c.source || c.organizer,
      amount: c.amount,
      agency: c.organizer,
      source_id: c.source_id,
    });
    toast({ title: 'Saved to your library' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading font-bold text-2xl">Challenges</h1>
        </div>
      </div>

      {searchError && (
        <div role="alert" className="mb-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {searchError}
        </div>
      )}
      {rankingError && (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          {rankingError}
        </div>
      )}
      {sourceMeta && !loading && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="rounded-full border border-green-500/20 bg-green-500/5 px-2 py-1 text-green-300">
            {challenges.length} verified records
          </span>
          <span>{sourceMeta.source}</span>
          <span>Retrieved {new Date(sourceMeta.retrieved_at).toLocaleString()}</span>
        </div>
      )}

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
          <h3 className="font-semibold text-sm mb-2">Find verified open calls</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mb-5">
            EYRA retrieves posted and forecasted records from an official funding database, then analyzes their fit without inventing programs or deadlines.
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
          <p className="font-semibold text-sm mb-1">Retrieving official open calls...</p>
          <p className="text-xs text-muted-foreground">Official records first; EYRA relevance analysis second</p>
        </div>
      )}

      {/* Results */}
      {hasRun && !loading && challenges.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">{challenges.length} verified official records found</p>
            <button onClick={() => findChallenges(manualQuery)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 mb-4">
            <AlertCircle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Deadlines, agencies and eligibility text come from the official record. Open the source record before applying; EYRA only explains relevance.
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
                      <a href={c.url_hint} target="_blank" rel="noopener noreferrer"
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
