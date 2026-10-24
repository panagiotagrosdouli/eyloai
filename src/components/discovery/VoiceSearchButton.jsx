import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

// Uses browser speech recognition only. No audio is uploaded by EYLO.
export default function VoiceSearchButton({ onTranscript, disabled = false, language = '' }) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
  }, []);

  const toggle = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window['webkitSpeechRecognition'];
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Type your search instead.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = language || navigator.language || 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = event => {
      if (event.error !== 'aborted') setError(event.error === 'not-allowed'
        ? 'Microphone access was denied. Enable microphone permission or type your question.'
        : 'Could not recognize speech. Please try again or type your question.');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    try {
      setError('');
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError('Could not start the microphone. Type your question instead.');
    }
  };

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button type="button" onClick={toggle} disabled={disabled}
        aria-label={listening ? 'Stop listening' : 'Search by voice'}
        aria-pressed={listening} title={listening ? 'Stop listening' : 'Search by voice'}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40">
        {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
      </button>
      {error && <span role="status" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-popover p-2 text-xs text-foreground shadow-lg">{error}</span>}
    </span>
  );
}
