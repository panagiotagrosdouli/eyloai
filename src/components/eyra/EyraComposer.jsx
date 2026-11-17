import React from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { EYRA_MODE_ICONS } from './EyraResearchControls';

/**
 * Presentation-only research composer. The authenticated Command Center owns
 * turn state, cancellation, write-review consent and voice lifecycle.
 */
export default function EyraComposer({
  activeMode, modeLabel, inputRef, value, onChange, onKeyDown,
  onSend, onStop, onStartListening, onStopListening,
  listening, loading, allowWorkspaceActions,
}) {
  const ModeIcon = EYRA_MODE_ICONS[activeMode] || Send;
  return (
    <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
      <div className="mb-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
        <ModeIcon size={11} aria-hidden="true" />
      </div>
      <textarea
        ref={inputRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-label="Message EYRA"
        maxLength={allowWorkspaceActions ? 1000 : 2000}
        placeholder={`Describe the outcome you need in ${modeLabel || 'Research'} mode…`}
        rows={1}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none max-h-28 py-1.5"
        style={{ minHeight: '34px' }}
      />
      <div className="flex items-center gap-1 flex-shrink-0 pb-1">
        <button type="button" onClick={listening ? onStopListening : onStartListening}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          className={`grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-secondary text-muted-foreground'}`}>
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
        {loading && (
          <button type="button" aria-label="Stop EYRA generation" onClick={onStop}
            className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-secondary">
            Stop
          </button>
        )}
        <button type="button" aria-label="Send message" onClick={onSend}
          disabled={!value.trim() || loading}
          className="grid min-h-11 min-w-11 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
