import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { buildUserProfile } from '@/lib/second-brain';
import { searchAllPapers, searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { getPreferenceLocale, loadPreferences, subscribePreferences } from '@/lib/preferences';
import {
  X, Mic, MicOff, Send, Sparkles, Loader2,
  Volume2, VolumeX, Target, FileText, Users,
  Award, Map, TrendingUp, AlertTriangle, Brain,
  Rocket, BarChart3, BookOpen, Trash2, BookmarkPlus,
  Check, Copy, Database, ExternalLink, ShieldCheck
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// EYRA modes change the analysis lens; evidence rules stay identical.
const MODES = [
  { id: 'research', label: 'Research', icon: BookOpen, color: 'text-primary', prompt: 'Research analyst: synthesize retrieved literature, methods, limitations, and defensible gaps.' },
  { id: 'strategy', label: 'Strategy', icon: Brain, color: 'text-purple-400', prompt: 'Strategic advisor: build decision options, assumptions, risks, and testable milestones.' },
  { id: 'funding', label: 'Funding', icon: Award, color: 'text-amber-400', prompt: 'Funding advisor: use only retrieved official opportunity records and separate eligibility from relevance.' },
  { id: 'startup', label: 'Startup', icon: Rocket, color: 'text-green-400', prompt: 'Research commercialization advisor: distinguish evidence, hypotheses, validation work, and go-to-market decisions.' },
  { id: 'team', label: 'Team', icon: Users, color: 'text-cyan-400', prompt: 'Team builder: use retrieved researcher and institution records; assess expertise fit without inferring availability.' },
  { id: 'impact', label: 'Impact', icon: BarChart3, color: 'text-rose-400', prompt: 'Impact analyst: assess scientific, social, and commercial pathways without inventing success probabilities.' },
];

const QUICK_COMMANDS = [
  { label: 'Analyze my project', icon: Target, prompt: 'Analyze my current project. Separate evidence, assumptions, risks, and the top three next actions.' },
  { label: 'Find research gaps', icon: AlertTriangle, prompt: 'Retrieve recent papers in my field and identify defensible research gaps, with citations and limitations.' },
  { label: 'Find funding', icon: Award, prompt: 'Search current official funding records relevant to my work. Explain relevance and what eligibility I still need to verify.' },
  { label: 'Build my roadmap', icon: Map, prompt: 'Build a six-phase research and innovation roadmap with milestones, dependencies, decision gates, and evidence needs.' },
  { label: 'Find collaborators', icon: Users, prompt: 'Retrieve researchers and institutions relevant to my project, then map expertise fit and the evidence I should review before outreach.' },
  { label: 'Startup strategy', icon: Rocket, prompt: 'Turn my research into a testable commercialization strategy. Separate sourced signals from market hypotheses.' },
  { label: 'Literature review', icon: FileText, prompt: 'Retrieve literature for my topic and propose a reproducible review protocol, search strings, and inclusion criteria.' },
  { label: 'Impact analysis', icon: TrendingUp, prompt: 'Assess scientific, commercial, and social impact pathways using retrieved evidence. Do not invent a probability of success.' },
];

const LANGUAGE_NAMES = {
  en: 'English', el: 'Greek', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', tr: 'Turkish',
};

const STYLE_INSTRUCTIONS = {
  concise: 'Keep the answer concise: lead with the conclusion and use no more than five bullets unless essential.',
  balanced: 'Give a structured, decision-ready answer with enough reasoning to evaluate each recommendation.',
  detailed: 'Give a rigorous, in-depth answer with methods, limitations, alternatives, and concrete next steps.',
};

const BASE_SYSTEM = `You are EYRA, the evidence-aware research and innovation partner inside EYLO.

NON-NEGOTIABLE INTEGRITY RULES:
- Retrieved evidence is the only authority for named papers, researchers, institutions, funding programs, dates, amounts, metrics, or eligibility.
- Cite supplied records inline as [P1], [R1], [I1], or [F1]. Never create a citation identifier.
- Saved workspace context is user-provided context, not externally verified evidence.
- If evidence is empty or insufficient, say exactly what could not be verified and propose a better query.
- Never present relevance, novelty, impact, team fit, or funding fit as a probability of success.
- Distinguish observed evidence, inference, and recommendation.
- Do not expose private workspace details unless they are relevant to the user's request.
- End with a concrete next action.

Use clear markdown. Be direct, helpful, scientifically careful, and transparent about limitations.`;

function shouldRetrieve(content, mode) {
  const text = content.toLowerCase();
  const funding = mode === 'funding' || /(grant|funding|call for|opportunit|χρηματοδ|επιχορήγ|πρόσκλησ)/i.test(text);
  const people = mode === 'team' || /(collaborat|researcher|author|institution|university|team|consortium|συνεργά|ερευνητ|πανεπιστήμ|ομάδα)/i.test(text);
  const papers = ['research', 'impact'].includes(mode)
    || /(paper|literature|evidence|study|studies|research gap|method|citation|δημοσίευ|βιβλιογραφ|έρευν|μελέτ|μεθοδολογ)/i.test(text);
  return { funding, people, papers };
}

function compactQuery(content, workspaceContext) {
  const generic = /\b(my|current|project|work|research|μου|έργο|έρευνα)\b/gi;
  const cleaned = content.replace(generic, ' ').replace(/\s+/g, ' ').trim();
  const contextHint = workspaceContext
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 4)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
  return (cleaned.length >= 12 ? cleaned : `${cleaned} ${contextHint}`).trim().slice(0, 280) || content.slice(0, 280);
}

async function retrieveEvidence(content, mode, workspaceContext) {
  const intent = shouldRetrieve(content, mode);
  const query = compactQuery(content, workspaceContext);
  const tasks = [];

  if (intent.papers) tasks.push(searchAllPapers(query).then(items => ({ kind: 'papers', items })));
  if (intent.people) {
    tasks.push(searchOpenAlexAuthors(query, 6).then(items => ({ kind: 'researchers', items })));
    tasks.push(searchOpenAlexInstitutions(query, 4).then(items => ({ kind: 'institutions', items })));
  }
  if (intent.funding) tasks.push(searchFundingOpportunities(query, 10).then(result => ({ kind: 'funding', items: result.items || [] })));

  if (!tasks.length) return { query, blocks: [], sources: [], attempted: false };

  const settled = await Promise.allSettled(tasks);
  const groups = Object.fromEntries(
    settled.filter(result => result.status === 'fulfilled').map(result => [result.value.kind, result.value.items]),
  );
  const failed = settled.filter(result => result.status === 'rejected').map(result => result.reason?.message || 'source unavailable');

  const papers = (groups.papers || []).slice(0, 8);
  const researchers = (groups.researchers || []).slice(0, 6);
  const institutions = (groups.institutions || []).slice(0, 4);
  const funding = (groups.funding || []).slice(0, 8);
  const sources = [
    ...papers.map((item, index) => ({ id: `P${index + 1}`, type: 'Paper', title: item.title, url: item.url, meta: [item.authors, item.year, item.source].filter(Boolean).join(' · ') })),
    ...researchers.map((item, index) => ({ id: `R${index + 1}`, type: 'Researcher', title: item.name, url: item.profile_url, meta: [item.institution, `${item.works_count || 0} works`].filter(Boolean).join(' · ') })),
    ...institutions.map((item, index) => ({ id: `I${index + 1}`, type: 'Institution', title: item.name, url: item.url, meta: [item.country, `${item.works_count || 0} works`].filter(Boolean).join(' · ') })),
    ...funding.map((item, index) => ({ id: `F${index + 1}`, type: 'Funding', title: item.title, url: item.source_url, meta: [item.agency, item.deadline].filter(Boolean).join(' · ') })),
  ].filter(item => item.url);

  const blocks = [
    ...papers.map((item, index) => `[P${index + 1}] PAPER | ${item.title} | ${item.authors || 'authors unavailable'} | ${item.year || 'year unavailable'} | ${item.source || 'source unavailable'} | citations ${item.cited_by_count || 0} | ${item.summary || 'abstract unavailable'} | URL ${item.url}`),
    ...researchers.map((item, index) => `[R${index + 1}] RESEARCHER | ${item.name} | ${item.institution || 'institution unavailable'} | ${item.research_areas || 'areas unavailable'} | ${item.works_count || 0} works | ${item.citation_count || 0} citations | URL ${item.profile_url}`),
    ...institutions.map((item, index) => `[I${index + 1}] INSTITUTION | ${item.name} | ${item.type || 'type unavailable'} | ${item.country || 'country unavailable'} | ${item.works_count || 0} works | URL ${item.url}`),
    ...funding.map((item, index) => `[F${index + 1}] FUNDING | ${item.title} | ${item.agency || 'agency unavailable'} | deadline ${item.deadline || 'not supplied'} | amount ${item.amount || 'not supplied'} | eligibility ${item.eligibility || 'open official record'} | ${item.description || ''} | URL ${item.source_url}`),
  ];

  if (failed.length) blocks.push(`SOURCE STATUS | ${failed.length} retrieval source(s) unavailable: ${failed.join('; ')}`);
  return { query, blocks, sources, attempted: true };
}

const INITIAL_MESSAGE = {
  role: 'eyra',
  content: "I'm online and ready. I can work with your projects, saved evidence, researchers, opportunities, and ideas. Tell me what outcome you want next.",
  timestamp: Date.now(),
  mode: 'research',
};

function loadConversation() {
  try {
    const saved = sessionStorage.getItem('eyra_command_conversation');
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [INITIAL_MESSAGE];
  } catch {
    return [INITIAL_MESSAGE];
  }
}

function TypingIndicator({ stage }) {
  return (
    <div className="flex items-center gap-2 px-1 py-2" role="status" aria-live="polite">
      <div className="w-6 h-6 rounded-full eyra-gradient flex items-center justify-center flex-shrink-0">
        <Sparkles size={10} className="text-white" />
      </div>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{stage === 'retrieving' ? 'Retrieving live evidence…' : 'Synthesizing a cited answer…'}</span>
    </div>
  );
}

function Message({ msg, onSave, onCopy, saved, copied, saving }) {
  const isEyra = msg.role === 'eyra';
  const modeColor = MODES.find(m => m.id === msg.mode)?.color || 'text-primary';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${isEyra ? '' : 'flex-row-reverse'}`}
    >
      {isEyra ? (
        <div className="w-7 h-7 rounded-full overflow-hidden bg-white flex-shrink-0 mt-0.5 shadow-sm">
          <img src="/brand/eyra.png" alt="EYRA" className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-muted-foreground">You</span>
        </div>
      )}
      <div className={`max-w-[86%] ${isEyra ? '' : 'items-end flex flex-col'}`}>
        {isEyra && (
          <div className="flex items-center gap-1.5 mb-1">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${modeColor}`}>EYRA</p>
            {msg.mode && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase">{msg.mode}</span>
            )}
          </div>
        )}
        <div className={`px-3.5 py-3 rounded-2xl text-sm leading-relaxed ${
          isEyra
            ? 'bg-card border border-border/60 text-foreground'
            : 'eyra-gradient text-white'
        }`}>
          {isEyra ? (
            <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-p:text-foreground prose-li:text-foreground prose-strong:text-primary prose-p:my-1 prose-ul:my-2 prose-h2:text-sm prose-h2:mb-1">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
        {isEyra && msg.sources?.length > 0 && (
          <div className="mt-2 flex max-w-full flex-wrap gap-1.5" aria-label="Sources used in this answer">
            {msg.sources.slice(0, 8).map(source => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${source.title}${source.meta ? ` — ${source.meta}` : ''}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[9px] font-medium text-emerald-300 hover:border-emerald-400/50"
              >
                <ShieldCheck size={9} aria-hidden="true" />
                <span>{source.id}</span>
                <span className="max-w-36 truncate text-muted-foreground">{source.title}</span>
                <ExternalLink size={8} aria-hidden="true" />
              </a>
            ))}
            {msg.sources.length > 8 && <span className="px-2 py-1 text-[9px] text-muted-foreground">+{msg.sources.length - 8} more</span>}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1 px-1">
          <p className="mr-auto text-[9px] text-muted-foreground">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isEyra && (
            <>
              <button
                type="button"
                onClick={() => onCopy(msg)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Copy EYRA response"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => onSave(msg)}
                disabled={saved || saving}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-70"
                aria-label="Save EYRA response to Idea Vault"
              >
                {saved ? <Check size={10} /> : <BookmarkPlus size={10} />}
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save insight'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function EyraCommandCenter({ open, onClose }) {
  const [messages, setMessages] = useState(loadConversation);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('retrieving');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeMode, setActiveMode] = useState('research');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [workspaceContext, setWorkspaceContext] = useState('');
  const [contextStatus, setContextStatus] = useState('idle');
  const [savedMessageIds, setSavedMessageIds] = useState(() => new Set());
  const [savingMessageId, setSavingMessageId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [actionError, setActionError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => subscribePreferences(setPreferences), []);

  useEffect(() => {
    if (!open || contextStatus !== 'idle') return;
    setContextStatus('loading');
    buildUserProfile()
      .then((profile) => {
        setWorkspaceContext(profile.contextString.slice(0, 12_000));
        setContextStatus('ready');
      })
      .catch(() => {
        setWorkspaceContext('');
        setContextStatus('unavailable');
      });
  }, [open, contextStatus]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    sessionStorage.setItem('eyra_command_conversation', JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const speak = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*`]/g, '').replace(/\[[PRIF]\d+\]/g, '').replace(/\n+/g, ' ').slice(0, 900);
    const utterance = new SpeechSynthesisUtterance(clean);
    const voiceConfig = {
      academic: { rate: 0.92, pitch: 0.9 },
      friendly: { rate: 1.02, pitch: 1.02 },
      executive: { rate: 1.08, pitch: 0.88 },
      professional: { rate: 1, pitch: 0.94 },
    }[preferences.voice_style] || { rate: 1, pitch: 0.94 };
    utterance.lang = getPreferenceLocale(preferences);
    utterance.rate = voiceConfig.rate;
    utterance.pitch = voiceConfig.pitch;
    utterance.volume = 0.95;
    const language = utterance.lang.split('-')[0];
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(voice => voice.lang === utterance.lang)
      || voices.find(voice => voice.lang?.startsWith(language))
      || voices[0];
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setActionError('Speech recognition is not supported by this browser. You can still type your question.');
      return;
    }
    setActionError('');
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false; rec.interimResults = false; rec.lang = getPreferenceLocale(preferences);
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setActionError('I could not hear that clearly. Try again or type your question.');
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    rec.start();
  };

  const stopListening = () => { recognitionRef.current?.stop(); setListening(false); };

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setActionError('');

    const userMsg = { role: 'user', content, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    setLoadingStage('retrieving');

    const mode = MODES.find(item => item.id === activeMode);
    const history = newMessages.slice(-10).map(message =>
      `${message.role === 'user' ? 'User' : 'EYRA'}: ${message.content}`
    ).join('\n\n');

    try {
      const evidence = await retrieveEvidence(content, activeMode, workspaceContext);
      setLoadingStage('reasoning');
      const language = LANGUAGE_NAMES[preferences.language] || 'the language used by the user';
      const style = STYLE_INSTRUCTIONS[preferences.ai_response_style] || STYLE_INSTRUCTIONS.balanced;
      const evidenceText = evidence.blocks.length
        ? evidence.blocks.join('\n')
        : evidence.attempted
          ? 'Retrieval completed but returned no usable records.'
          : 'No external retrieval was necessary for this planning request. Do not introduce external factual claims.';

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${BASE_SYSTEM}

ANALYSIS MODE:
${mode?.prompt || MODES[0].prompt}

USER PREFERENCES:
- Respond in ${language}.
- ${style}

SAVED WORKSPACE CONTEXT (user-provided; not independently verified):
${preferences.data_personalization
  ? (workspaceContext || 'Workspace context is unavailable.')
  : 'Personalization is disabled. Do not use workspace activity.'}

LIVE RETRIEVAL QUERY:
${evidence.query}

RETRIEVED EVIDENCE:
${evidenceText}

RECENT CONVERSATION:
${history}

Answer the user's latest request. Cite every externally verifiable claim with the supplied identifier. If no record supports a named claim, omit it or label it as an unverified hypothesis. Explain why each recommendation follows from evidence or workspace context. Never claim that a person is available, that a user is eligible, or that a grant is open unless the supplied record states it.`,
      });

      const eyraMsg = {
        role: 'eyra',
        content: typeof response === 'string' ? response : String(response || ''),
        timestamp: Date.now(),
        mode: activeMode,
        sources: evidence.sources,
        retrievalQuery: evidence.query,
      };
      setMessages(previous => [...previous, eyraMsg]);
      speak(eyraMsg.content);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The live AI service did not complete the request.';
      setMessages(previous => [...previous, {
        role: 'eyra',
        content: `**I could not complete that live analysis.** ${reason}\n\nNo evidence or recommendation has been fabricated. Please retry with a focused topic or switch EYRA mode.`,
        timestamp: Date.now(),
        mode: activeMode,
        sources: [],
      }]);
    } finally {
      setLoading(false);
    }
  };

  const saveInsight = async (msg) => {
    if (!msg?.content || savedMessageIds.has(msg.timestamp)) return;
    setActionError('');
    setSavingMessageId(msg.timestamp);
    const plainText = msg.content.replace(/[#*\x60]/g, '').replace(/\s+/g, ' ').trim();
    try {
      await base44.entities.Idea.create({
        title: `EYRA · ${plainText.slice(0, 72) || 'Saved insight'}`,
        description: msg.content,
        status: 'saved',
        source: 'eyra',
        category: msg.mode || activeMode,
      });
      setSavedMessageIds((previous) => new Set([...previous, msg.timestamp]));
    } catch {
      setActionError('This insight could not be saved. Check your connection and try again.');
    } finally {
      setSavingMessageId(null);
    }
  };

  const copyInsight = async (msg) => {
    if (!msg?.content) return;
    setActionError('');
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedMessageId(msg.timestamp);
      window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      setActionError('Copy was blocked by the browser. Select the response text and copy it manually.');
    }
  };

  const clearConversation = () => {
    window.speechSynthesis?.cancel();
    setMessages([{ ...INITIAL_MESSAGE, timestamp: Date.now(), mode: activeMode }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const currentMode = MODES.find(m => m.id === activeMode);
  const ModeIcon = currentMode?.icon || Sparkles;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="eyra-neural-shell relative h-[92vh] max-h-screen w-full overflow-hidden rounded-t-3xl border border-cyan-300/15 sm:h-[780px] sm:w-[720px] sm:max-w-[calc(100vw-2rem)] sm:rounded-[1.75rem] flex flex-col"
          style={{ boxShadow: '0 0 80px -15px hsla(210,100%,55%,0.35), 0 0 0 1px hsl(var(--border))' }}
        >
          {/* Header */}
          <div className="relative z-10 flex items-center gap-3 px-4 py-3.5 border-b border-cyan-200/10 bg-slate-950/45 backdrop-blur-xl flex-shrink-0">
            <div className="eyra-intelligence-core flex-shrink-0" aria-hidden="true">
              <img src="/brand/eyra.png" alt="" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold tracking-[0.16em] text-white">EYRA</p>
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-cyan-200">OpenAI Intelligence</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                <Database size={10} className={contextStatus === 'ready' ? 'text-emerald-400' : 'text-slate-500'} />
                <span>{contextStatus === 'ready' ? 'Workspace context active' : contextStatus === 'loading' ? 'Connecting workspace…' : 'Evidence-aware research co-founder'}</span>
              </div>
            </div>
            <button onClick={() => setVoiceEnabled(!voiceEnabled)}
              type="button"
              aria-label={voiceEnabled ? 'Disable EYRA voice' : 'Enable EYRA voice'}
              className={`p-2 rounded-lg transition-colors ${voiceEnabled ? 'bg-primary/15 text-primary' : 'hover:bg-secondary text-muted-foreground'}`}>
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button type="button" onClick={clearConversation} aria-label="Clear EYRA conversation" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <Trash2 size={14} />
            </button>
            <button type="button" onClick={onClose} aria-label="Close Ask EYRA" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Mode selector */}
          <div className="relative z-10 flex-shrink-0 px-3 py-2 border-b border-cyan-200/10 bg-slate-950/30 backdrop-blur-md">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mr-1 whitespace-nowrap flex-shrink-0">Mode</span>
              {MODES.map(m => {
                const Icon = m.icon;
                const active = activeMode === m.id;
                return (
                  <button key={m.id} onClick={() => setActiveMode(m.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      active ? 'bg-primary/15 text-primary border border-primary/25' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}>
                    <Icon size={11} className={active ? 'text-primary' : ''} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick commands — only on first message */}
          {messages.length <= 1 && (
            <div className="relative z-10 flex-shrink-0 px-3 pt-3 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2 px-1">Quick Start</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {QUICK_COMMANDS.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button key={cmd.label} onClick={() => sendMessage(cmd.prompt)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-border/60 bg-secondary/30 hover:border-primary/30 hover:bg-primary/5 text-left transition-all group">
                      <Icon size={11} className="text-primary flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.map((msg) => (
              <Message
                key={msg.timestamp}
                msg={msg}
                onSave={saveInsight}
                onCopy={copyInsight}
                saved={savedMessageIds.has(msg.timestamp)}
                saving={savingMessageId === msg.timestamp}
                copied={copiedMessageId === msg.timestamp}
              />
            ))}
            {loading && <TypingIndicator stage={loadingStage} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="relative z-10 flex-shrink-0 px-4 py-3 border-t border-cyan-200/10 bg-slate-950/50 backdrop-blur-xl">
            <div className="flex items-end gap-2 p-2 rounded-2xl border border-cyan-200/15 bg-slate-900/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] focus-within:border-cyan-300/40 focus-within:shadow-[0_0_28px_rgba(34,211,238,0.08)] transition-all">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mb-1.5 ${currentMode?.color?.replace('text-', 'bg-').replace('400', '500/10') || 'bg-primary/10'}`}>
                <ModeIcon size={11} className={currentMode?.color || 'text-primary'} />
              </div>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask EYRA anything in ${currentMode?.label || 'Research'} mode...`}
                rows={1}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-28 py-1.5"
                style={{ minHeight: '34px' }}
              />
              <div className="flex items-center gap-1 flex-shrink-0 pb-1">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  className={`p-1.5 rounded-lg transition-all ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-secondary text-muted-foreground'}`}>
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button type="button" aria-label="Send message" onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg eyra-gradient text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
            {actionError && (
              <p role="alert" className="mt-2 text-center text-[10px] text-amber-300">{actionError}</p>
            )}
            <p className="text-[9px] text-muted-foreground text-center mt-1.5">
              Tap <span className="text-primary">mic</span> to dictate · <span className="text-primary">Enter</span> to send · <span className="text-primary">Shift+Enter</span> new line
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
