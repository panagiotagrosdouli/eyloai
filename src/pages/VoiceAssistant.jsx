import { downloadResearchReport } from '@/lib/research-report-export.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, BookOpen, ExternalLink, Mic, MicOff, Search,
  Sparkles, Square, Volume2,
} from 'lucide-react';
import { runEyraDiscovery } from '@/lib/eyra-engine';
import { getPreferenceLocale, loadPreferences } from '@/lib/preferences';

export default function VoiceAssistant() {
  const recognitionRef = useRef(null);
  const mountedRef = useRef(true);
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const preferences = loadPreferences();
  const voiceLocale = getPreferenceLocale(preferences);
  const voiceRate = { professional: 0.96, academic: 0.9, friendly: 1.02, executive: 1.06 }[preferences.voice_style] || 0.96;

  const Recognition = typeof window !== 'undefined'
    ? /** @type {any} */ (window).SpeechRecognition || /** @type {any} */ (window).webkitSpeechRecognition
    : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try { recognition.abort(); } catch { /* Browser may already have stopped recording. */ }
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startListening = () => {
    if (!Recognition) {
      setError('Speech recognition is not supported in this browser. Type your question instead.');
      return;
    }

    if (recognitionRef.current) return;
    setError('');
    let recognition;
    try {
      recognition = new Recognition();
    } catch {
      setError('Could not initialize microphone recognition. Type your question instead.');
      return;
    }
    recognition.lang = voiceLocale;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map(item => item[0].transcript).join(' ');
      if (mountedRef.current && recognitionRef.current === recognition) setTranscript(text);
    };
    recognition.onerror = (event) => {
      if (!mountedRef.current || recognitionRef.current !== recognition) return;
      if (event.error !== 'aborted') {
        setError(event.error === 'not-allowed'
          ? 'Microphone permission was denied. Enable microphone access or type your question.'
          : 'Microphone recognition failed. Type your question or try again.');
      }
      setListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (mountedRef.current) setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('Could not start microphone recognition. Check browser permissions or type your question.');
    }
  };

  const stopListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try { recognition.stop(); }
    catch {
      recognitionRef.current = null;
      setError('Could not stop microphone recognition. You can still type your question.');
    }
    setListening(false);
  };

  const ask = async (event) => {
    event?.preventDefault();
    const query = transcript.trim();
    if (!query) return;
    setRunning(true);
    setError('');
    setResult(null);
    window.speechSynthesis?.cancel();

    try {
      const discovery = await runEyraDiscovery(query);
      if (!mountedRef.current) return;
      setResult(discovery);
      const spoken = discovery.goal_analysis
        || (discovery.ai_error
          ? `I found ${discovery.papers.length} papers and ${discovery.researchers.length} researchers, but the AI synthesis was unavailable.`
          : `I found ${discovery.papers.length} papers, ${discovery.researchers.length} researchers, and ${discovery.funding_opportunities.length} funding records.`);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = voiceLocale;
        utterance.rate = voiceRate;
        window.speechSynthesis.speak(utterance);
      }
    } catch (askError) {
      if (mountedRef.current) setError(askError?.message || 'EYRA Voice could not complete the search.');
    } finally {
      if (mountedRef.current) setRunning(false);
    }
  };

  const stopSpeaking = () => window.speechSynthesis?.cancel();

  return (
    <div className="eylo-page">
      <header className="mb-7">
        <h1 className="eylo-page-heading">Voice</h1>
        {result && <button type="button" onClick={() => downloadResearchReport({ tool: 'voice-workspace', query: transcript, analysis: { goal_analysis: result.goal_analysis || '', ai_error: result.ai_error || '', source_status: result.source_status || '' }, sources: [...(result.papers || []), ...(result.researchers || []), ...(result.funding_opportunities || [])], caveat: 'Browser microphone input is optional; text query and retrieved records are the basis of this analysis.' })} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-xs font-semibold text-primary">Export spoken research (JSON)</button>}
      </header>

      <section className="rounded-3xl border border-primary/20 bg-card p-5 sm:p-8">
        <form onSubmit={ask}>
          <textarea
            aria-label="Voice research question"
            value={transcript}
            onChange={event => setTranscript(event.target.value)}
            rows={4}
            placeholder="Ask about a research field, method, collaborator profile or funding direction…"
            className="w-full resize-none rounded-2xl border border-border bg-secondary/40 p-4 text-base outline-none focus:border-primary/40"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${listening ? 'bg-red-500 text-white' : 'border border-border bg-secondary'}`}
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
              {listening ? 'Stop listening' : 'Use microphone'}
            </button>
            <button
              type="submit"
              disabled={!transcript.trim() || running}
              className="inline-flex items-center gap-2 rounded-xl eyra-gradient px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {running ? <Sparkles size={15} className="animate-pulse" /> : <Search size={15} />}
              {running ? 'Searching sources…' : 'Ask EYRA'}
            </button>
            <button type="button" onClick={stopSpeaking} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm">
              <Square size={13} /> Stop voice
            </button>
          </div>
        </form>
        {!Recognition && (
          <p className="mt-3 flex items-center gap-2 text-xs text-amber-300">
            <AlertCircle size={12} /> This browser has no SpeechRecognition API; typed questions and spoken answers still work.
          </p>
        )}
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}

      {result && (
        <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Spoken synthesis</p>
              <button
                onClick={() => {
                  const text = result.goal_analysis || 'No AI synthesis was returned.';
                  const utterance = new SpeechSynthesisUtterance(text);
                  utterance.lang = voiceLocale;
                  utterance.rate = voiceRate;
                  window.speechSynthesis?.speak(utterance);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-primary"
              >
                <Volume2 size={12} /> Replay
              </button>
            </div>
            <p className="text-sm leading-7 text-foreground/90">
              {result.goal_analysis || result.ai_error || 'Source records loaded without a synthesis.'}
            </p>
            <p className="mt-3 text-[10px] text-muted-foreground">
              {result.papers.length} papers · {result.researchers.length} researchers · {result.institutions.length} institutions · {result.funding_opportunities.length} official funding records
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {result.papers.slice(0, 4).map(paper => (
              <a key={paper.id} href={paper.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-border bg-card p-4 hover:border-primary/30">
                <div className="flex items-start gap-3">
                  <BookOpen size={14} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-semibold">{paper.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{paper.source} · {paper.year || 'n/a'} · {paper.cited_by_count || 0} citations</p>
                  </div>
                  <ExternalLink size={11} className="shrink-0 text-muted-foreground" />
                </div>
              </a>
            ))}
          </div>
          <Link to="/library" className="inline-flex items-center gap-2 text-xs font-semibold text-primary">Open evidence library <ExternalLink size={11} /></Link>
        </section>
      )}
    </div>
  );
}
