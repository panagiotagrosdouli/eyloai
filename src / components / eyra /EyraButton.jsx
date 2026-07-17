import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import EyraCommandCenter from './EyraCommandCenter';

export default function EyraButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl eyra-gradient text-white text-sm font-semibold shadow-lg transition-all hover:opacity-90 hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 0 30px -5px hsla(199,100%,55%,0.5), 0 0 60px -15px hsla(252,85%,65%,0.3)' }}
      >
        <div className="relative">
          <Sparkles size={16} className="text-white" />
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />
        </div>
        <span>Ask EYRA</span>
      </button>

      <EyraCommandCenter open={open} onClose={() => setOpen(false)} />
    </>
  );
}
