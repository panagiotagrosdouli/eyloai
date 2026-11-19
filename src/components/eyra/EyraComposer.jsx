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
    <div className="flex items-end gap-3 rounded-2xl border border-border bg-background p-2.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 sm:p-3">
      <div className="mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <ModeIcon size={17} aria-hidden="true" />
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
        className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40 sm:text-[15px]"
        style={{ minHeight: '44px' }}
      />
      <div className="flex items-center gap-1 flex-shrink-0 pb-1">
        <button type="button" onClick={listening ? onStopListening : onStartListening}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          className={`grid min-h-11 min-w-11 place-items-center rounded-xl transition-colors ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'hover:bg-secondary text-muted-foreground'}`}>
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
          className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
