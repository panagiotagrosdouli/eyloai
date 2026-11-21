import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { approveEyraWrite } from '@/lib/eyra-intelligence';
import { buildUserProfile } from '@/lib/second-brain';
import { searchAllPapersWithStatus, searchOpenAlexAuthors, searchOpenAlexInstitutions } from '@/lib/eyra-api';
import { searchFundingOpportunities } from '@/lib/funding-api';
import { getPreferenceLocale, loadPreferences, subscribePreferences } from '@/lib/preferences';
import { getLocalGreeting } from '@/lib/local-greeting';
import { checkEyraCitationIds } from '@/lib/eyra-citation-ids.mjs';
import { buildEyraCommandEvidence, buildEyraCommandPrompt } from '@/lib/eyra-command-evidence.mjs';
import { buildEvidenceOnlyFallback } from '@/lib/eyra-evidence-fallback.mjs';
import {
  X, Volume2, VolumeX, Trash2, History, FileDown
} from 'lucide-react';
import BrandLogo, { EyraOrb } from '@/components/brand/BrandLogo';
import { TypingIndicator, Message } from '@/components/eyra/EyraConversationTimeline';
import { EyraModeSelector, EyraQuickCommands } from '@/components/eyra/EyraResearchControls';
import EyraComposer from '@/components/eyra/EyraComposer';
import EyraWriteIntentReview from '@/components/eyra/EyraWriteIntentReview';
import EyraAgentRunHistory from '@/components/eyra/EyraAgentRunHistory';
import { useAuth } from '@/lib/AuthContext';
import { eyraConversationKey, normalizeEyraConversation } from '@/lib/eyra-conversation.mjs';
import { EYRA_MODES, EYRA_LANGUAGE_NAMES, EYRA_STYLE_INSTRUCTIONS, EYRA_BASE_SYSTEM } from '@/lib/eyra-next-policy.mjs';
import { retrieveEyraEvidence } from '@/lib/eyra-retrieval-service.mjs';

import { listEyraConversations, saveEyraConversation, loadEyraConversation, renameEyraConversation, deleteEyraConversation } from '@/lib/eyra-history';

import { snapshotPayload, snapshotIdentity, conversationExport } from '@/lib/eyra-snapshot.mjs';
import { requestedEyraWrites } from '@/lib/eyra-write-intent.mjs';
import { buildEyraConversationContext } from '@/lib/eyra-conversation-context.mjs';
import { listEyraAgentRuns, loadEyraAgentRun, cancelEyraAgentRun, reviewStaleEyraAgentRun, deleteEyraAgentRun } from '@/lib/eyra-run-history';

// Shared EYRA modes and epistemic rules; visual icons remain a UI concern.
const MODES = EYRA_MODES;
const LANGUAGE_NAMES = EYRA_LANGUAGE_NAMES;
const STYLE_INSTRUCTIONS = EYRA_STYLE_INSTRUCTIONS;
const BASE_SYSTEM = EYRA_BASE_SYSTEM;

async function retrieveEvidence(content, mode, workspaceContext, signal) {
  return retrieveEyraEvidence(content, mode, workspaceContext, signal, {
    searchPapers: searchAllPapersWithStatus,
    searchAuthors: searchOpenAlexAuthors,
    searchInstitutions: searchOpenAlexInstitutions,
    searchFunding: searchFundingOpportunities,
    buildEvidence: buildEyraCommandEvidence,
  });
}

function createWelcomeMessage(name = '') {
  const localGreeting = getLocalGreeting(name);
  return {
    role: 'eyra',
    content: `${localGreeting.greeting} I can help you think through questions, learn, write, plan and explore research. What would you like to do?`,
    timestamp: Date.now(),
    mode: 'general',
    welcome: true,
  };
}

/** @typedef {{role: string, content: string, timestamp: number, mode?: string, welcome?: boolean, sources?: any[], retrievalQuery?: string, retrievalAttempted?: boolean}} EyraMessage */
/** @returns {EyraMessage[]} */
function loadConversation(userId) {
  try {
    const key = eyraConversationKey(userId);
    const saved = key ? sessionStorage.getItem(key) : null;
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? normalizeEyraConversation(parsed) : [createWelcomeMessage()];
  } catch {
    return [createWelcomeMessage()];
  }
}

function formatEyraToolActions(actions) {
  if (!Array.isArray(actions) || !actions.length) return '';
  return actions.map(action => {
    if (action.status === 'succeeded' && action.tool === 'project.create') {
      const p = action.result || {};
      return `- Created and verified project **${p.title || 'Untitled'}** (ID: \`${p.id || 'unavailable'}\`).`;
    }
    if (action.status === 'succeeded' && action.tool === 'library.save_paper') {
      const p = action.result || {};
      return `- ${p.already_saved ? 'Already saved' : 'Saved and verified'}: **${p.title || 'Paper'}** (DOI: ${p.doi || 'unavailable'}, record ID: \`${p.id || 'unavailable'}\`).`;
    }
    if (action.status === 'succeeded' && action.tool === 'project.list') {
      return `- Retrieved ${Array.isArray(action.result) ? action.result.length : 0} projects in your workspace.`;
    }
    if (action.status === 'succeeded' && action.tool === 'library.list_papers') {
      return `- Retrieved ${Array.isArray(action.result) ? action.result.length : 0} saved papers in your Library.`;
    }
    if (action.status === 'succeeded' && action.tool === 'project.get') {
      return `- Retrieved project **${action.result?.title || 'Untitled'}** from your workspace.`;
    }
    if (action.status === 'succeeded' && ['notes.list','tasks.list','calendar.list_events'].includes(action.tool)) {
      const label = { 'notes.list': 'notes', 'tasks.list': 'tasks', 'calendar.list_events': 'calendar events' }[action.tool];
      return `- Retrieved ${Array.isArray(action.result) ? action.result.length : 0} private ${label}.`;
    }
    if (action.status === 'succeeded' && [
      'learning.list_flashcard_decks', 'funding.list_saved_opportunities',
      'research.list_saved_researchers',
    ].includes(action.tool)) {
      const label = {
        'learning.list_flashcard_decks': 'flashcard decks',
        'funding.list_saved_opportunities': 'saved funding opportunities',
        'research.list_saved_researchers': 'saved researchers',
      }[action.tool];
      return `- Retrieved ${Array.isArray(action.result) ? action.result.length : 0} private ${label}. Saved records are not live eligibility or affiliation verification.`;
    }
    if (action.status === 'succeeded' && ['learning.list_lessons', 'learning.list_progress'].includes(action.tool)) {
      const label = action.tool === 'learning.list_lessons' ? 'lesson outlines' : 'lesson progress records';
      return `- Retrieved ${action.result?.count || 0} ${label} from an authenticated owned course; no lesson full text or quiz answers were accessed.`;
    }
    if (action.status === 'succeeded' && ['learning.list_courses', 'learning.list_quizzes'].includes(action.tool)) {
      const label = action.tool === 'learning.list_courses' ? 'learning courses' : 'quizzes';
      return `- Retrieved ${action.result?.count || 0} saved ${label} from your own learning workspace; metadata only.`;
    }
    if (action.status === 'succeeded' && ['notes.search', 'library.search_papers'].includes(action.tool)) {
      const label = action.tool === 'notes.search' ? 'private notes' : 'saved paper metadata records';
      return `- Found ${action.result?.count || 0} matching ${label} within ${action.result?.scanned_recent_records || 0} recent records; this was not an exhaustive full-text search.`;
    }
    if (action.status === 'succeeded' && action.tool === 'research.search_publications') {
      return `- Retrieved ${action.result?.count || 0} DOI-validated **bibliographic metadata** records from Crossref; full text was not analyzed.`;
    }
    if (action.status === 'succeeded' && action.tool === 'research.lookup_doi') {
      return `- Crossref DOI metadata verified for **${action.result?.title || 'publication'}** (${action.result?.doi || 'DOI unavailable'}); this is not a full-text review.`;
    }
    if (action.status === 'needs_review') {
      return `- **Outcome uncertain — manual review required:** ${action.tool || 'Workspace action'}. ${action.error || 'Check the actual workspace record before retrying.'}`;
    }
    if (action.status === 'failed') {
      return `- ${action.tool || 'Workspace action'} failed: ${action.error || 'Check the workspace before retrying.'}`;
    }
    return `- ${action.tool || 'Workspace action'} completed.`;
  }).join('\n');
}

export default function EyraCommandCenter({ open, onClose, resourceContext = null }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState(() => loadConversation(user?.id));
  const [conversationOwner, setConversationOwner] = useState(user?.id);
  const [allowWorkspaceActions, setAllowWorkspaceActions] = useState(false);
  const [pendingWriteReview, setPendingWriteReview] = useState(null);
  const [writePreview, setWritePreview] = useState(null);
  const [liveDraft, setLiveDraft] = useState('');
  const [savedConversations, setSavedConversations] = useState([]);
  const [remoteConversation, setRemoteConversation] = useState(null);
  const [renameTitle, setRenameTitle] = useState(null);
  const [savingConversation, setSavingConversation] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [cloudHistoryState, setCloudHistoryState] = useState({ ownerId: null, status: 'checking' });
  const [cloudHistoryCheck, setCloudHistoryCheck] = useState(0);
  const [showAgentRuns, setShowAgentRuns] = useState(false);
  const [agentRuns, setAgentRuns] = useState([]);
  const [selectedAgentRun, setSelectedAgentRun] = useState(null);
  const [agentRunsBusy, setAgentRunsBusy] = useState(false);
  const [agentRunsError, setAgentRunsError] = useState('');
  const historyEpochRef = useRef(0);
  const snapshotRequestRef = useRef(null);
  const historyWriteLockRef = useRef(false);
  const ownerRef = useRef(user?.id);
  ownerRef.current = user?.id;
  const cloudHistoryStatus = cloudHistoryState.ownerId === (user?.id ?? null)
    ? cloudHistoryState.status : 'checking';
  const cloudHistoryReady = cloudHistoryStatus === 'available';
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('retrieving');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeMode, setActiveMode] = useState('general');
  const [preferences, setPreferences] = useState(loadPreferences);
  const [workspaceContext, setWorkspaceContext] = useState('');
  const [contextStatus, setContextStatus] = useState('idle');
  const [userName, setUserName] = useState('');
  const [savedMessageIds, setSavedMessageIds] = useState(() => new Set());
  const [savingMessageId, setSavingMessageId] = useState(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [actionError, setActionError] = useState('');
  const messagesEndRef = useRef(null);
  const conversationScrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dialogRef = useRef(null);
  const activeRequestRef = useRef(null);
  // The home composer can pass an unsent draft into EYRA. This never starts
  // an AI request: the user must review the prompt and press Send.
  useEffect(() => {
    const receiveHomePrompt = event => {
      const prompt = typeof event.detail?.prompt === 'string' ? event.detail.prompt.trim() : '';
      if (prompt) setInput(prompt);
    };
    window.addEventListener('eylo:open-eyra', receiveHomePrompt);
    return () => window.removeEventListener('eylo:open-eyra', receiveHomePrompt);
  }, []);
  useEffect(() => () => { activeRequestRef.current?.abort(); }, []);

  useEffect(() => {
    activeRequestRef.current?.abort(); activeRequestRef.current = null;
    setMessages(loadConversation(user?.id)); setConversationOwner(user?.id);
    setWorkspaceContext(''); setContextStatus('idle'); setLiveDraft(''); setLoading(false);
    setRemoteConversation(null); setSavedConversations([]); setAllowWorkspaceActions(false);
    setPendingWriteReview(null); setWritePreview(null);
    historyEpochRef.current += 1; snapshotRequestRef.current = null; historyWriteLockRef.current = false; setHistoryBusy(false);
    setSavingConversation(false); setSavedMessageIds(new Set()); setUserName(''); setActionError('');
    setCloudHistoryState({ ownerId: user?.id ?? null, status: 'checking' });
    setShowAgentRuns(false); setAgentRuns([]); setSelectedAgentRun(null);
    setAgentRunsBusy(false); setAgentRunsError('');
  }, [user?.id]);

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    let live = true;
    const ownerId = user.id, epoch = historyEpochRef.current;
    setCloudHistoryState({ ownerId, status: 'checking' });
    listEyraConversations()
      .then(rows => {
        if (!live || ownerRef.current !== ownerId || epoch !== historyEpochRef.current) return;
        setSavedConversations(rows);
        setCloudHistoryState({ ownerId, status: 'available' });
      })
      .catch(error => {
        if (!live || ownerRef.current !== ownerId || epoch !== historyEpochRef.current) return;
        setSavedConversations([]);
        setCloudHistoryState({
          ownerId, status: error?.code === 'EYRA_CLOUD_HISTORY_UNAVAILABLE' ? 'unavailable' : 'error',
        });
      });
    return () => { live = false; };
  }, [open, user?.id, cloudHistoryCheck]);

  useEffect(() => {
    if (!open) return undefined;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = /** @type {HTMLElement | null} */ (document.activeElement);
    const closeWithEscape = event => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = /** @type {HTMLElement} */ (focusable[0]);
      const last = /** @type {HTMLElement} */ (focusable[focusable.length - 1]);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeWithEscape);
      recognitionRef.current?.stop?.();
      previousFocus?.focus?.();
    };
  }, [onClose, open]);

  useEffect(() => subscribePreferences(setPreferences), []);

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    let live = true;
    setContextStatus('loading');
    buildUserProfile()
      .then((profile) => {
        if (!live) return;
        const nextName = profile.user?.full_name || '';
        setUserName(nextName);
        setWorkspaceContext(profile.contextString.slice(0, 12_000));
        setContextStatus('ready');
        setMessages(previous => (
          previous.length === 1 && previous[0]?.welcome
            ? [{ ...createWelcomeMessage(nextName), timestamp: previous[0].timestamp }]
            : previous
        ));
      })
      .catch(() => {
        if (!live) return;
        setWorkspaceContext('');
        setContextStatus('unavailable');
      });
    return () => { live = false; };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open) return;
    if (messages.length === 1 && messages[0]?.welcome) {
      // The welcome card can exceed the mobile transcript height. Start at
      // its heading; only active conversations should follow the last message.
      conversationScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    const key = eyraConversationKey(user?.id);
    if (!key || conversationOwner !== user?.id) return;
    try { sessionStorage.setItem(key, JSON.stringify(normalizeEyraConversation(messages))); } catch { /* Chat works when optional tab storage is unavailable. */ }
  }, [messages, user?.id, conversationOwner]);

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
    const browserWindow = /** @type {any} */ (window);
    const SR = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
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

  const stopGeneration = () => {
    if (!activeRequestRef.current) return;
    activeRequestRef.current.abort();
    activeRequestRef.current = null;
    setLoading(false);
    setLiveDraft('');
    setActionError(allowWorkspaceActions
      ? 'Display stopped. A server-side workspace action may still finish. Check the relevant record and agent run status before retrying.'
      : 'Generation stopped. No new EYRA response was added to this conversation.');
  };

  const sendMessage = async (text, { writeConfirmed = false } = {}) => {
    const content = (text || input).trim();
    if (!content || loading || historyBusy || historyWriteLockRef.current || activeRequestRef.current) return;
    if (content.length > (allowWorkspaceActions ? 1000 : 2000)) {
      setActionError(allowWorkspaceActions ? 'Keep a workspace action request to 1,000 characters so its full authorization can be checked.' : 'Keep a message to 2,000 characters. Split longer material into focused questions.');
      return;
    }
    const writeIntent = requestedEyraWrites(content);
    if (allowWorkspaceActions && (writeIntent.project || writeIntent.paper) && !writeConfirmed) {
      // This is a review of the user's request, not a preview of model-selected
      // database fields. Actual writes still require explicit API confirmation.
      setPendingWriteReview({ content, writeIntent });
      setWritePreview(null);
      setActionError('');
      return;
    }
    setPendingWriteReview(null);
    setWritePreview(null);
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setInput('');
    setActionError('');
    setLiveDraft('');

    const userMsg = { role: 'user', content, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    setLoadingStage('retrieving');

    const mode = MODES.find(item => item.id === activeMode);
    const history = buildEyraConversationContext(newMessages.slice(0, -1));

    let evidence = { query: content, blocks: [], sources: [], attempted: false };
    try {
      evidence = await retrieveEvidence(
        content,
        activeMode,
        preferences.data_personalization ? workspaceContext : '',
        controller.signal,
      );
      controller.signal.throwIfAborted();
      setLoadingStage('reasoning');
      const language = LANGUAGE_NAMES[preferences.language] || 'the language used by the user';
      const style = STYLE_INSTRUCTIONS[preferences.ai_response_style] || STYLE_INSTRUCTIONS.balanced;
      const prompt = buildEyraCommandPrompt({
        baseSystem: BASE_SYSTEM,
        modePrompt: mode?.prompt || MODES[0].prompt,
        language,
        style,
        personalized: preferences.data_personalization,
        workspaceContext,
        query: evidence.query,
        evidenceBlocks: evidence.blocks,
        history,
        userRequest: content,
      });

      const response = await base44.integrations.Core.InvokeLLM({
        enable_project_tools: allowWorkspaceActions,
        stream: !allowWorkspaceActions,
        on_delta: delta => { if (!controller.signal.aborted) setLiveDraft(previous => previous + delta); },
        tool_intent: content,
        latest_user_request: content,
        write_confirmed: allowWorkspaceActions && writeConfirmed,
        ...(preferences.data_personalization && resourceContext ? { resource_context: resourceContext } : {}),
        prompt,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();

      const baseAnswer = typeof response === 'string' ? response.trim() : String(response?.text || '').trim();
      if (!baseAnswer) throw Object.assign(
        new Error('EYRA returned an empty response.'),
        { actions: response?.actions || [] },
      );
      const citations = checkEyraCitationIds(baseAnswer, evidence.sources);
      if (!citations.valid) throw Object.assign(
        new Error('EYRA cited an identifier outside the retrieved source records.'),
        { code: 'EYRA_UNSUPPORTED_CITATION', actions: response?.actions || [] },
      );
      const toolActions = formatEyraToolActions(response?.actions);
      const runReference = typeof response?.run_id === 'string'
        ? `Execution ID: \`${response.run_id.slice(0, 36)}\` · Status: ${response.run_status || 'unknown'}`
        : '';
      const answer = [baseAnswer, toolActions ? `### Workspace action results\n${toolActions}` : '', runReference]
        .filter(Boolean).join('\n\n');
      const eyraMsg = {
        role: 'eyra',
        content: answer,
        timestamp: Date.now(),
        mode: activeMode,
        sources: citations.citedSources,
        retrievalQuery: evidence.query,
        retrievalAttempted: evidence.attempted,
      };
      setMessages(previous => [...previous, eyraMsg]);
      speak(eyraMsg.content);
    } catch (error) {
      if (controller.signal.aborted) return;
      const fallbackContent = buildEvidenceOnlyFallback(evidence, error);
      const toolActions = formatEyraToolActions(error?.actions);
      const runReference = typeof error?.runId === 'string'
        ? `Execution ID: \`${error.runId.slice(0, 36)}\`. Inspect the run before retrying.`
        : '';
      setMessages(previous => [...previous, {
        role: 'eyra',
        content: [fallbackContent, toolActions ? `### Workspace action status\n${toolActions}` : '', runReference].filter(Boolean).join('\n\n'),
        timestamp: Date.now(),
        mode: activeMode,
        sources: evidence.sources || [],
        retrievalQuery: evidence.query,
        retrievalAttempted: evidence.attempted,
      }]);
      if (!allowWorkspaceActions) {
        // A failed read-only request must never be silently retried or charged
        // a second time. Restore the full user question for an explicit edit
        // and submit, without clobbering text entered during the failed run.
        setInput(previous => previous.trim() ? previous : content);
        setActionError('Your question is available in the composer for an explicit retry. No automatic AI request was sent.');
      }
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
        setLiveDraft('');
        setAllowWorkspaceActions(false);
      }
    }
  };

  const previewPendingWrite = async () => {
    const review = pendingWriteReview;
    const owner = ownerRef.current;
    if (!review || !owner || !allowWorkspaceActions || loading || activeRequestRef.current) return;
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setWritePreview({ ownerId: owner, content: review.content, status: 'loading', proposals: [], error: '' });
    try {
      // This uses an authenticated API preview that does NOT execute model tool
      // calls. It is not an approval token for the generated fields.
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: review.content,
        latest_user_request: review.content,
        tool_intent: review.content,
        enable_project_tools: true,
        preview_write_actions: true,
        stream: false,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (ownerRef.current !== owner) return;
      if (result?.preview_only !== true || !Array.isArray(result.write_proposals)) {
        throw new Error('EYRA did not confirm a preview-only result.');
      }
      setWritePreview({
        ownerId: owner, content: review.content, status: 'ready',
        proposals: result.write_proposals,
        approvalToken: typeof result.write_approval_token === 'string' ? result.write_approval_token : null,
        error: '',
      });
    } catch (error) {
      if (controller.signal.aborted || ownerRef.current !== owner) return;
      setWritePreview({
        ownerId: owner, content: review.content, status: 'error', proposals: [],
        error: 'The proposed fields could not be prepared. No workspace record was changed.',
      });
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const approvePendingExactFields = async () => {
    const review = pendingWriteReview;
    const preview = writePreview;
    const owner = ownerRef.current;
    if (!review || !owner || loading || activeRequestRef.current
      || preview?.status !== 'ready' || preview.ownerId !== owner
      || preview.content !== review.content || preview.proposals?.length !== 1
      || typeof preview.approvalToken !== 'string' || !preview.approvalToken) return;
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    setActionError('');
    // Token is single-attempt from the browser's perspective; the durable
    // server ledger prevents a second write even after an ambiguous response.
    setWritePreview({ ...preview, status: 'committing', approvalToken: null });
    try {
      const result = await approveEyraWrite({
        request: review.content, approvalToken: preview.approvalToken, signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (ownerRef.current !== owner) return;
      setPendingWriteReview(null);
      setWritePreview(null);
      setAllowWorkspaceActions(false);
      setMessages(previous => [...previous,
        { role: 'user', content: review.content, timestamp: Date.now() },
        {
          role: 'eyra', content: `Approved exact-field action completed. Execution ID: \`${result.run_id}\`.
The saved record was returned by the server. Check the workspace for the final record.`,
          timestamp: Date.now() + 1, mode: activeMode, sources: [],
        },
      ]);
    } catch (error) {
      if (ownerRef.current !== owner) return;
      setWritePreview({
        ...preview, status: 'error', approvalToken: null,
        error: 'Exact-field execution was not confirmed. Inspect the workspace and run history before attempting a new approval.',
      });
      setActionError(error?.message || 'The approved action could not be verified.');
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  };

  const refreshAgentRuns = async () => {
    const owner = user?.id;
    if (!owner || agentRunsBusy) return;
    setAgentRunsBusy(true); setAgentRunsError('');
    try {
      const rows = await listEyraAgentRuns();
      if (ownerRef.current !== owner) return;
      setAgentRuns(rows);
      setShowAgentRuns(true);
      setSelectedAgentRun(null);
    } catch (error) {
      if (ownerRef.current === owner) {
        setAgentRunsError(error?.message || 'Agent runs could not be loaded.');
        setShowAgentRuns(true);
      }
    } finally {
      if (ownerRef.current === owner) setAgentRunsBusy(false);
    }
  };

  const inspectAgentRun = async id => {
    const owner = user?.id;
    if (!owner || agentRunsBusy) return;
    setAgentRunsBusy(true); setAgentRunsError('');
    try {
      const result = await loadEyraAgentRun(id);
      if (ownerRef.current === owner) setSelectedAgentRun(result);
    } catch (error) {
      if (ownerRef.current === owner) {
        setAgentRunsError(error?.message || 'Agent run details could not be loaded.');
      }
    } finally {
      if (ownerRef.current === owner) setAgentRunsBusy(false);
    }
  };

  const cancelAgentRun = async id => {
    const owner = user?.id;
    if (!owner || agentRunsBusy) return;
    if (!window.confirm('Request cancellation of this agent run? A write already in progress might still finish.')) return;
    setAgentRunsBusy(true); setAgentRunsError('');
    try {
      await cancelEyraAgentRun(id);
      if (ownerRef.current !== owner) return;
      setAgentRuns(items => items.map(item => item.id === id
        ? { ...item, status: 'cancelled' } : item));
      setSelectedAgentRun(previous => previous?.run?.id === id
        ? { ...previous, run: { ...previous.run, status: 'cancelled' } } : previous);
    } catch (error) {
      if (ownerRef.current === owner) setAgentRunsError(error?.message || 'Cancellation was not confirmed.');
    } finally {
      if (ownerRef.current === owner) setAgentRunsBusy(false);
    }
  };

  const markAgentRunForReview = async id => {
    const owner = user?.id;
    if (!owner || agentRunsBusy) return;
    if (!window.confirm('Mark this stale execution for manual review? This never retries or reverses a previously started write.')) return;
    setAgentRunsBusy(true); setAgentRunsError('');
    try {
      await reviewStaleEyraAgentRun(id);
      if (ownerRef.current !== owner) return;
      setAgentRuns(items => items.map(item => item.id === id
        ? { ...item, status: 'needs_review' } : item));
      setSelectedAgentRun(previous => previous?.run?.id === id
        ? { ...previous, run: { ...previous.run, status: 'needs_review' } }
        : previous);
    } catch (error) {
      if (ownerRef.current === owner) setAgentRunsError(error?.message || 'Stale run review was not confirmed.');
    } finally {
      if (ownerRef.current === owner) setAgentRunsBusy(false);
    }
  };

  const removeAgentRun = async id => {
    const owner = user?.id;
    if (!owner || agentRunsBusy) return;
    if (!window.confirm('Permanently delete this completed agent run and its action history? This cannot be undone.')) return;
    setAgentRunsBusy(true); setAgentRunsError('');
    try {
      await deleteEyraAgentRun(id);
      if (ownerRef.current !== owner) return;
      setAgentRuns(items => items.filter(item => item.id !== id));
      setSelectedAgentRun(previous => previous?.run?.id === id ? null : previous);
    } catch (error) {
      if (ownerRef.current === owner) setAgentRunsError(error?.message || 'Deletion was not confirmed.');
    } finally {
      if (ownerRef.current === owner) setAgentRunsBusy(false);
    }
  };

  const saveConversation = async () => {
    const owner = user?.id;
    if (!owner || !cloudHistoryReady || loading || savingConversation || historyBusy || historyWriteLockRef.current) return;
    historyWriteLockRef.current = true; const epoch = ++historyEpochRef.current;
    setSavingConversation(true); setActionError('');
    try {
      const conversationMessages = normalizeEyraConversation(messages);
      const firstQuestion = conversationMessages.find(message => message.role === 'user')?.content;
      if (!firstQuestion) throw new Error('Send a message before saving a conversation.');
      const title = `EYRA · ${firstQuestion.slice(0, 100)}`;
      const retryKey = `${eyraConversationKey(owner)}:snapshot-request`;
      let previous = snapshotRequestRef.current;
      try { previous ||= JSON.parse(sessionStorage.getItem(retryKey) || 'null'); } catch { /* Optional retry recovery. */ }
      const identity = await snapshotIdentity(snapshotPayload(title, conversationMessages), previous);
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      snapshotRequestRef.current = identity;
      try { sessionStorage.setItem(retryKey, JSON.stringify(identity)); } catch { /* Same-tab retries still reuse identity. */ }
      const saved = await saveEyraConversation(title, conversationMessages, identity.id);
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      setRemoteConversation(saved); setSavedConversations(items => [saved, ...items.filter(item => item.id !== saved.id)].slice(0, 20));
    } catch (error) {
      if (ownerRef.current === owner && historyEpochRef.current === epoch) {
        if (error?.code === 'EYRA_CLOUD_HISTORY_UNAVAILABLE') {
          setCloudHistoryState({ ownerId: owner, status: 'unavailable' });
        }
        setActionError(error?.message || 'Conversation was not saved.');
      }
    }
    finally { if (ownerRef.current === owner && historyEpochRef.current === epoch) { setSavingConversation(false); historyWriteLockRef.current = false; } }
  };

  const restoreConversation = async id => {
    const owner = user?.id;
    if (!id || !cloudHistoryReady || loading || historyWriteLockRef.current) return;
    const epoch = ++historyEpochRef.current; setHistoryBusy(true);
    try {
      const saved = await loadEyraConversation(id);
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      // Commit a completed history restore synchronously. Otherwise React can
      // defer the update until *after* a subsequent user Clear, resurrecting
      // the old transcript even when the response passed the epoch guard.
      // The owner/epoch check above rejects responses arriving after Clear.
      flushSync(() => {
        if (ownerRef.current === owner && historyEpochRef.current === epoch) {
          setMessages(saved.messages);
        }
      });
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      setRemoteConversation(saved); setRenameTitle(null); setActionError('');
    } catch (error) { if (ownerRef.current === owner && historyEpochRef.current === epoch) setActionError(error?.message || 'Conversation could not be opened.'); }
    finally { if (ownerRef.current === owner && historyEpochRef.current === epoch) setHistoryBusy(false); }
  };

  const saveRenamedConversation = async () => {
    const owner = user?.id, snapshot = remoteConversation;
    if (!owner || !snapshot || renameTitle === null || loading
      || historyBusy || savingConversation || historyWriteLockRef.current) return;
    historyWriteLockRef.current = true;
    setHistoryBusy(true); setActionError('');
    const epoch = ++historyEpochRef.current;
    try {
      const renamed = await renameEyraConversation(snapshot.id, snapshot.version, renameTitle);
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      setRemoteConversation(previous => previous?.id === renamed.id
        ? { ...previous, ...renamed } : previous);
      setSavedConversations(previous => previous.map(item => item.id === renamed.id
        ? { ...item, ...renamed } : item));
      setRenameTitle(null);
    } catch (error) {
      if (ownerRef.current === owner && historyEpochRef.current === epoch) {
        setActionError(error?.message || 'Conversation title was not changed.');
      }
    } finally {
      if (ownerRef.current === owner && historyEpochRef.current === epoch) {
        historyWriteLockRef.current = false;
        setHistoryBusy(false);
      }
    }
  };

  const exportConversation = () => {
    if (conversationOwner !== user?.id || loading || historyBusy) return;
    try {
      const payload = conversationExport(remoteConversation?.title, messages);
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'eyra-conversation.json';
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (error) { setActionError(error?.message || 'Conversation could not be exported.'); }
  };
  const deleteSnapshot = async () => {
    const owner = user?.id; const snapshot = remoteConversation;
    if (!owner || !snapshot || loading || historyBusy || historyWriteLockRef.current) return;
    if (!window.confirm('Permanently delete this saved snapshot and its messages? This tab will clear. Other saved snapshots and downloaded exports remain.')) return;
    historyWriteLockRef.current = true; setHistoryBusy(true); setActionError('');
    const epoch = ++historyEpochRef.current;
    try {
      await deleteEyraConversation(snapshot.id, snapshot.version);
      if (ownerRef.current !== owner || historyEpochRef.current !== epoch) return;
      setSavedConversations(items => items.filter(item => item.id !== snapshot.id));
      setRemoteConversation(null); setRenameTitle(null); setMessages([createWelcomeMessage(userName)]); setLiveDraft('');
      snapshotRequestRef.current = null;
      try { sessionStorage.removeItem(`${eyraConversationKey(owner)}:snapshot-request`); } catch { /* Optional tab storage. */ }
    } catch (error) { if (ownerRef.current === owner) setActionError(error?.message || 'Snapshot could not be deleted.'); }
    finally { if (ownerRef.current === owner) { historyWriteLockRef.current = false; setHistoryBusy(false); } }
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
    if (historyWriteLockRef.current) return;
    if (!window.confirm('Clear the conversation in this tab? Conversations you explicitly saved remain available.')) return;
    // Invalidate any in-flight cloud restore before committing the clear.
    historyEpochRef.current += 1;
    activeRequestRef.current?.abort(); activeRequestRef.current = null;
    // Clear is an explicit destructive *local* user action. Commit the empty
    // transcript synchronously so an in-flight history load cannot leave the
    // old answer visible while React schedules unrelated async updates.
    flushSync(() => {
      setHistoryBusy(false);
      setLoading(false); setLiveDraft(''); setRemoteConversation(null); setRenameTitle(null);
      setMessages([{ ...createWelcomeMessage(userName), mode: activeMode }]);
      setInput('');
    });
    window.speechSynthesis?.cancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const currentMode = MODES.find(m => m.id === activeMode);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
        style={{ background: 'rgba(15, 23, 42, 0.48)', backdropFilter: 'blur(10px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="eyra-dialog-title"
          className="relative isolate flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden rounded-none border border-border/60 bg-background shadow-[0_35px_100px_-30px_rgba(16,31,66,0.55)] sm:h-[min(900px,calc(100dvh-2rem))] sm:w-[min(1060px,calc(100vw-2rem))] sm:rounded-[32px]"
        >
          {/* Calm conversation header: history and tools live below, not above the transcript. */}
          <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border/50 bg-card/70 px-4 py-3.5 backdrop-blur-xl sm:px-8 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-card to-cyan-400/10 px-2 py-1 ring-1 ring-primary/10 sm:block"><BrandLogo brand="eyra" size="compact" /></span>
              <span className="sm:hidden"><EyraOrb className="h-10 w-10 shadow-sm shadow-primary/20" /></span>
              <div className="min-w-0">
                <h2 id="eyra-dialog-title" className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-lg">Your research copilot</h2>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
                  {contextStatus === 'ready' ? 'Workspace context available' : contextStatus === 'loading' ? 'Preparing workspace context…' : 'Sources are linked when retrieved'}
                </p>
              </div>
            </div>
            <button onClick={() => setVoiceEnabled(!voiceEnabled)}
              type="button" aria-label={voiceEnabled ? 'Disable EYRA voice' : 'Enable EYRA voice'}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button type="button" onClick={clearConversation} aria-label="Clear EYRA conversation"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Trash2 size={18} />
            </button>
            <button type="button" onClick={onClose} aria-label="Close Ask EYRA"
              className="grid min-h-11 min-w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <X size={19} />
            </button>
          </div>

          <EyraModeSelector activeMode={activeMode} onChange={setActiveMode} disabled={loading} />

          {/* Messages */}
          <div ref={conversationScrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 py-5 sm:px-8 sm:py-7" aria-label="EYRA conversation">
            <div className={`mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 ${messages.length === 1 ? 'justify-center' : ''}`}>
              {messages.map((msg, index) => msg.welcome ? (messages.length === 1 ? (
                <section key={`${msg.timestamp}-${index}`} aria-label="Start a conversation with EYRA" className="relative mx-auto w-full max-w-[740px] px-1 py-3 sm:px-5 sm:py-5">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary" aria-hidden="true">✦</div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">EYRA / RESEARCH INTELLIGENCE</p>
                  <h3 className="mt-2 max-w-2xl text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
                    Where should we begin?
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                    Ask a question, create a plan, explore an idea or review evidence.
                  </p>
                  {messages.length === 1 && <EyraQuickCommands activeMode={activeMode} onSelect={prompt => void sendMessage(prompt)} disabled={loading} />}
                </section>
              ) : null) : (
                <Message key={`${msg.timestamp}-${index}`} msg={msg}
                  onSave={saveInsight} onCopy={copyInsight}
                  saved={savedMessageIds.has(msg.timestamp)}
                  saving={savingMessageId === msg.timestamp}
                  copied={copiedMessageId === msg.timestamp}
                />
              ))}
            {loading && <TypingIndicator stage={loadingStage} />}
            {loading && liveDraft && <section aria-label="EYRA draft response" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><p className="mb-2 text-xs text-muted-foreground">Draft — sources are checked when the response finishes.</p><p className="whitespace-pre-wrap">{liveDraft}</p></section>}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer stays visible; optional controls are accessible on demand. */}
          <div className="relative z-10 shrink-0 border-t border-border/50 bg-card/90 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-8 sm:py-4">
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <details className="group min-w-0 max-w-full flex-1 rounded-xl border border-border/50 bg-secondary/30 text-xs text-muted-foreground">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                    <History size={16} aria-hidden="true" />
                    <span className="truncate">History &amp; tools</span>
                    <span className="ml-auto hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                      {cloudHistoryReady ? 'Cloud available' : cloudHistoryStatus === 'checking' ? 'Checking cloud…' : 'Local export available'}
                    </span>
                  </summary>
                  <div className="max-h-[min(38dvh,290px)] space-y-3 overflow-y-auto border-t border-border p-3">
                    {cloudHistoryStatus !== 'available' && (
                      <section role="status" aria-label="Cloud conversation history" className="rounded-xl border border-border bg-secondary/30 p-3 text-xs leading-5 text-muted-foreground">
                        <p>{cloudHistoryStatus === 'checking'
                          ? 'Checking whether cloud conversation history is available…'
                          : cloudHistoryStatus === 'unavailable'
                            ? 'Cloud conversation saving is not activated here. You can keep chatting and use Export conversation to keep a file.'
                            : 'Cloud conversation history could not be checked. No saved conversations were assumed; use Export conversation to keep a file.'}</p>
                        {(cloudHistoryStatus === 'error' || cloudHistoryStatus === 'unavailable') && (
                          <button type="button" className="mt-2 min-h-11 rounded-md px-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            onClick={() => setCloudHistoryCheck(value => value + 1)}>
                            Re-check cloud history
                          </button>
                        )}
                      </section>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void saveConversation()} disabled={!cloudHistoryReady || loading || savingConversation || historyBusy} className="min-h-11 rounded-xl border border-border px-3 disabled:cursor-not-allowed disabled:opacity-40">{savingConversation ? 'Saving…' : 'Save conversation snapshot'}</button>
                      <select aria-label="Saved EYRA conversation" value={remoteConversation?.id || ''} disabled={!cloudHistoryReady || loading || savingConversation || historyBusy} onChange={event => void restoreConversation(event.target.value)} className="min-h-11 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 disabled:opacity-40"><option value="">Open a saved conversation</option>{savedConversations.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                      <button type="button" onClick={() => { if (showAgentRuns) { setShowAgentRuns(false); setSelectedAgentRun(null); } else void refreshAgentRuns(); }}
                        disabled={agentRunsBusy} aria-expanded={showAgentRuns} className="min-h-11 rounded-xl border border-border px-3">
                        {agentRunsBusy ? 'Loading runs…' : showAgentRuns ? 'Hide agent runs' : 'Agent runs'}
                      </button>
                      {remoteConversation && <button type="button" onClick={() => setRenameTitle(remoteConversation.title || '')} disabled={loading || savingConversation || historyBusy} className="min-h-11 rounded-xl border border-border px-3">Rename saved conversation</button>}
                      {remoteConversation && <button type="button" onClick={() => void deleteSnapshot()} disabled={loading || savingConversation || historyBusy} className="min-h-11 rounded-xl border border-border px-3">Delete saved snapshot</button>}
                    </div>
                    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-xs leading-5 text-foreground">
                      <input type="checkbox" checked={allowWorkspaceActions} disabled={loading}
                        onChange={event => { setAllowWorkspaceActions(event.target.checked); setPendingWriteReview(null); setWritePreview(null); }}
                        className="h-4 w-4 shrink-0 accent-primary" />
                      <span><span className="font-semibold">Allow authorized workspace and research tools for this request</span><span className="block text-muted-foreground">Optional · private workspace actions require authorization and review.</span></span>
                    </label>
                    <EyraAgentRunHistory
                      open={showAgentRuns} runs={agentRuns} selected={selectedAgentRun}
                      busy={agentRunsBusy} error={agentRunsError}
                      onRefresh={() => void refreshAgentRuns()}
                      onInspect={id => void inspectAgentRun(id)}
                      onCancel={id => void cancelAgentRun(id)}
                      onReviewStale={id => void markAgentRunForReview(id)}
                      onDelete={id => void removeAgentRun(id)}
                    />
                    {renameTitle !== null && remoteConversation && (
                      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"
                        onSubmit={event => { event.preventDefault(); void saveRenamedConversation(); }}>
                        <label className="text-xs" htmlFor="eyra-conversation-title">Conversation title</label>
                        <input id="eyra-conversation-title" type="text" maxLength={180}
                          value={renameTitle} onChange={event => setRenameTitle(event.target.value)}
                          disabled={historyBusy} required
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
                        <button type="submit" disabled={historyBusy || !renameTitle.trim()}
                          className="min-h-11 rounded-xl bg-primary px-4 text-xs text-primary-foreground">Save title</button>
                        <button type="button" disabled={historyBusy} onClick={() => setRenameTitle(null)}
                          className="min-h-11 rounded-xl border border-border px-3 text-xs">Cancel rename</button>
                      </form>
                    )}
                  </div>
                </details>
                <button type="button" onClick={exportConversation} disabled={loading || historyBusy}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-transparent bg-secondary/60 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
                  <FileDown size={16} aria-hidden="true" /> Export conversation
                </button>
              </div>
            <EyraWriteIntentReview
              review={pendingWriteReview}
              preview={writePreview?.ownerId === user?.id
                && writePreview?.content === pendingWriteReview?.content ? writePreview : null}
              onPreview={() => void previewPendingWrite()}
              onApprove={() => void approvePendingExactFields()}
              onCancel={() => { setPendingWriteReview(null); setWritePreview(null); }}
              onEdit={() => {
                setInput(pendingWriteReview.content);
                setPendingWriteReview(null);
                setWritePreview(null);
                inputRef.current?.focus();
              }}
              onConfirm={() => void sendMessage(pendingWriteReview.content, { writeConfirmed: true })}
            />
            <EyraComposer
              activeMode={activeMode} modeLabel={currentMode?.label}
              inputRef={inputRef} value={input} onChange={setInput}
              onKeyDown={handleKeyDown} onSend={() => void sendMessage()}
              onStop={stopGeneration}
              onStartListening={startListening} onStopListening={stopListening}
              listening={listening} loading={loading}
              allowWorkspaceActions={allowWorkspaceActions}
            />
            {actionError && (
              <p role="alert" className="mt-2 text-center text-[10px] text-amber-300">{actionError}</p>
            )}
            <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground/80">
              Check original sources before relying on research claims · Enter to send · Shift+Enter for a new line
            </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
