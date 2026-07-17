import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { USER_TYPE_OPTIONS } from '@/lib/persona';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';

/**
 * First-time onboarding modal: asks user who they are.
 * Shown once; dismissed by saving user_type to their profile.
 */
export default function UserTypeOnboarding({ onComplete }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!selected || saving) return;
    setSaving(true);
    await base44.auth.updateMe({ user_type: selected });
    setSaving(false);
    onComplete(selected);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="w-full max-w-lg bg-background border border-border/80 rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 0 80px -15px hsla(210,100%,55%,0.3)' }}
        >
          {/* Header */}
          <div className="px-6 py-6 text-center border-b border-border/40">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white mx-auto mb-4 animate-pulse-glow">
              <img src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/33f475246_image.png" alt="EYRA" className="w-full h-full object-contain" />
            </div>
            <h2 className="font-heading font-bold text-xl text-foreground mb-1">Welcome to EYLO</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              To personalize your experience, EYRA needs to know who you are.<br />
              <span className="text-primary font-medium">Who best describes you?</span>
            </p>
          </div>

          {/* Options */}
          <div className="p-4 grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto">
            {USER_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all ${
                  selected === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-secondary/20 hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <p className={`text-sm font-semibold ${selected === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="px-6 py-4 border-t border-border/40">
            <button
              onClick={confirm}
              disabled={!selected || saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl eyra-gradient text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Personalizing EYRA...</>
                : <><Sparkles size={15} /> Start with EYRA <ArrowRight size={14} /></>
              }
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              You can change this anytime in your Profile settings.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
