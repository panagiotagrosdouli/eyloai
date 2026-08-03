import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  X, Mic, MicOff, Send, Sparkles, Loader2,
  Volume2, VolumeX, Target, FileText, Users,
  Award, Map, TrendingUp, AlertTriangle, Brain,
  Rocket, BarChart3, BookOpen, Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ─── EYRA modes — each shifts her focus and tone ───────────────────────────
const MODES = [
  { id: 'research',  label: 'Research',  icon: BookOpen,  color: 'text-primary',     prompt: 'You are acting as EYRA in Research Analyst mode. Focus on: paper discovery, research gaps, methodology, academic insights, literature strategy.' },
  { id: 'strategy',  label: 'Strategy',  icon: Brain,     color: 'text-purple-400',  prompt: 'You are acting as EYRA in Strategic Advisor mode. Focus on: roadmaps, competitive positioning, long-term vision, risk assessment, decision frameworks.' },
  { id: 'funding',   label: 'Funding',   icon: Award,     color: 'text-amber-400',   prompt: 'You are acting as EYRA in Funding Advisor mode. Focus on: grants, investors, applications, eligibility, pitch strategy, funding timelines. Only reference real programs.' },
  { id: 'startup',   label: 'Startup',   icon: Rocket,    color: 'text-green-400',   prompt: 'You are acting as EYRA in Startup Co-Founder mode. Focus on: go-to-market, team building, product strategy, investor readiness, traction metrics.' },
  { id: 'team',      label: 'Team',      icon: Users,     color: 'text-cyan-400',    prompt: 'You are acting as EYRA in Team Builder mode. Focus on: identifying skill gaps, finding collaborators, researcher compatibility, team structure.' },
  { id: 'impact',    label: 'Impact',    icon: BarChart3, color: 'text-rose-400',    prompt: 'You are acting as EYRA in Impact Predictor mode. Focus on: scientific impact, social value, commercial potential, scalability, success probability.' },
];

const QUICK_COMMANDS = [
  { label: 'Analyze my project',   icon: Target,        prompt: 'Analyze my current research project. What are the key strengths, gaps, and your top 3 strategic recommendations?' },
  { label: 'Find research gaps',   icon: AlertTriangle, prompt: 'What are the most important unsolved research gaps in my field right now? What novelty score would new research have?' },
  { label: 'Find funding',         icon: Award,         prompt: 'What are the best funding opportunities for my type of research? Include real grant programs and why I qualify.' },
  { label: 'Build my roadmap',     icon: Map,           prompt: 'Generate a dynamic 6-phase research and innovation roadmap for my current project with milestones and timelines.' },
  { label: 'Find collaborators',   icon: Users,         prompt: 'What expertise is missing from my current team? What type of collaborators would have the highest impact?' },
  { label: 'Startup strategy',     icon: Rocket,        prompt: 'Help me build a startup strategy from my research. What is the go-to-market, team, and funding path?' },
  { label: 'Literature review',    icon: FileText,      prompt: 'Guide me through a systematic literature review strategy. What search terms, databases, and selection criteria should I use?' },
  { label: 'Impact analysis',      icon: TrendingUp,    prompt: 'Estimate the research, commercial and social impact potential of my work. Give me a scored analysis with reasoning.' },
];

const BASE_SYSTEM = `You are EYRA — the Autonomous AI Co-Founder, Research Intelligence, and Innovation Partner of the EYLO platform.

You are NOT a chatbot. You are an elite AI system that combines:
- A world-class research analyst
- A startup co-founder
- A strategic advisor  
- A funding expert
- A team builder

CRITICAL RULES:
- Never invent researcher names, paper titles, institutions, or specific grant amounts.
- Only reference REAL funding programs (Horizon Europe, ERC, NSF, NIH, Wellcome Trust, DARPA, Innovate UK, etc.)
- Always state your confidence: [HIGH] [MEDIUM] [LOW]
- Every recommendation must include WHY — your explicit reasoning
- When uncertain, say so — trust is everything
- Be direct, strategic, and precise — never vague

PERSONALITY:
- Speak like a trusted co-founder and elite advisor who genuinely cares about outcomes
- Be confident but intellectually honest
- Use "I" with agency — you have opinions and judgment
- Lead with the most important insight, then supporting detail
- End every response with a clear next action or strategic question

RESPONSE FORMAT (use markdown):
- Use **bold** for key insights
- Use bullet points for lists
- Use ## headers for multi-section answers
- Keep it scannable — quality over length`;

const INITIAL_MESSAGE = {
  role: 'eyra',
  content: "I'm online and ready. Tell me what you're working on — a research idea, project challenge, funding question, or startup goal — and I'll get to work.",
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <div className="w-6 h-6 rounded-full eyra-gradient flex items-center justify-center flex-shrink-0">
        <Sparkles size={10} className="text-white" />
      </div>
      <div className="flex gap-1 ml-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">EYRA is thinking...</span>
    </div>
  );
}

function Message({ msg, mode }) {
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
        <p className="text-[9px] text-muted-foreground mt-1 px-1">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

export default function EyraCommandCenter({ open, onClose }) {
  const [messages, setMessages] = useState(loadConversation);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeMode, setActiveMode] = useState('research');
  const [showModes, setShowModes] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    sessionStorage.setItem('eyra_command_conversation', JSON.stringify(messages.slice(-30)));
  }, [messages]);

  const speak = (text) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*`]/g, '').replace(/\n+/g, ' ').slice(0, 600);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.0; utt.pitch = 0.9; utt.volume = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US') || voices.find(v => v.lang === 'en-US') || voices[0];
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setTimeout(() => sendMessage(t), 300);
    };
    rec.start();
  };

  const stopListening = () => { recognitionRef.current?.stop(); setListening(false); };

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const mode = MODES.find(m => m.id === activeMode);
    const modePrompt = mode?.prompt || '';
    const history = newMessages.slice(-12).map(m => `${m.role === 'user' ? 'User' : 'EYRA'}: ${m.content}`).join('\n\n');

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${BASE_SYSTEM}

${modePrompt}

Conversation history:
${history}

Respond as EYRA. Be strategic, precise, and actionable. Use markdown for structure.`,
      });

      const eyraMsg = { role: 'eyra', content: response, timestamp: Date.now(), mode: activeMode };
      setMessages(prev => [...prev, eyraMsg]);
      speak(response);
    } catch {
      setMessages(prev => [...prev, {
        role: 'eyra',
        content: '**I could not complete that analysis.** Your message is safe. Please try again or choose a different EYRA mode.',
        timestamp: Date.now(),
        mode: activeMode,
      }]);
    } finally {
      setLoading(false);
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
          className="eyra-neural-shell relative w-full sm:w-[520px] h-[90vh] sm:h-[740px] max-h-screen border border-cyan-300/15 rounded-t-3xl sm:rounded-[1.75rem] flex flex-col overflow-hidden"
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
              <p className="mt-0.5 text-[10px] text-slate-400">Research co-founder · Evidence-aware · Live reasoning</p>
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
              <div className="grid grid-cols-2 gap-1.5">
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
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
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
                  onMouseDown={startListening} onMouseUp={stopListening}
                  onTouchStart={startListening} onTouchEnd={stopListening}
                  className={`p-1.5 rounded-lg transition-all ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-secondary text-muted-foreground'}`}>
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg eyra-gradient text-white disabled:opacity-40 hover:opacity-90 transition-opacity">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-1.5">
              Hold <span className="text-primary">mic</span> to speak · <span className="text-primary">Enter</span> to send · <span className="text-primary">Shift+Enter</span> new line
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
