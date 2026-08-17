import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  User, Palette, Bell, Brain, Mic, Shield, CreditCard,
  Eye, ChevronRight, Check, Sun, Moon, Monitor, Volume2, Languages
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { loadPreferences, savePreferences } from '@/lib/preferences';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'theme', label: 'Theme & Display', icon: Palette },
  { id: 'ai', label: 'AI Preferences', icon: Brain },
  { id: 'voice', label: 'Voice Settings', icon: Mic },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
];

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'el', label: 'Greek / Ελληνικά', flag: '🇬🇷' },
  { code: 'fr', label: 'French / Français', flag: '🇫🇷' },
  { code: 'de', label: 'German / Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Spanish / Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italian / Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Portuguese / Português', flag: '🇵🇹' },
  { code: 'ar', label: 'Arabic / العربية', flag: '🇸🇦' },
  { code: 'zh', label: 'Chinese / 中文', flag: '🇨🇳' },
  { code: 'ja', label: 'Japanese / 日本語', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean / 한국어', flag: '🇰🇷' },
  { code: 'tr', label: 'Turkish / Türkçe', flag: '🇹🇷' },
];

const THEMES = [
  { id: 'dark', label: 'Dark', icon: Moon, desc: 'Premium deep navy — default' },
  { id: 'light', label: 'Light', icon: Sun, desc: 'Clean minimal light' },
  { id: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS setting' },
];

const ACCENT_COLORS = [
  { id: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { id: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { id: 'teal', label: 'Teal', class: 'bg-teal-500' },
  { id: 'green', label: 'Green', class: 'bg-green-500' },
  { id: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { id: 'red', label: 'Red', class: 'bg-red-500' },
];

const VOICE_STYLES = [
  { id: 'professional', label: 'Professional', desc: 'Clear and authoritative' },
  { id: 'academic', label: 'Academic', desc: 'Detailed and precise' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm and conversational' },
  { id: 'executive', label: 'Executive', desc: 'Direct and strategic' },
];

const ACCESSIBILITY_MODES = [
  { id: 'comfort', label: 'Comfort Mode', desc: 'Reduced contrast, softer colors' },
  { id: 'focus', label: 'Focus Mode', desc: 'Hide non-essential UI elements' },
  { id: 'high_contrast', label: 'High Contrast', desc: 'Maximum readability' },
  { id: 'large_text', label: 'Large Text', desc: 'Increase font sizes' },
  { id: 'reading', label: 'Reading Mode', desc: 'Optimized for long reading sessions' },
];

function SectionHeader({ title, desc }) {
  return (
    <div className="mb-6">
      <h2 className="font-heading font-bold text-lg text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

export default function Settings() {
  const [active, setActive] = useState('profile');
  const [prefs, setPrefs] = useState(loadPreferences);
  const [user, setUser] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const savePrefs = (newPrefs) => {
    const updated = savePreferences(newPrefs);
    setPrefs(updated);
    toast({ title: 'Settings applied', description: 'Saved on this device and active now.' });
  };

  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Browser notifications are not supported here.', variant: 'destructive' });
      return;
    }
    if (prefs.notifications_browser) {
      savePrefs({ notifications_browser: false });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      savePrefs({ notifications_browser: true });
      new Notification('EYLO alerts enabled', { body: 'High-priority watchlist findings can now appear on this device.' });
    } else {
      savePrefs({ notifications_browser: false });
      toast({ title: 'Permission was not granted', description: 'You can still see every alert inside EYLO.' });
    }
  };

  const toggleAccessibility = (mode) => {
    const arr = prefs.accessibility || [];
    const updated = arr.includes(mode) ? arr.filter(m => m !== mode) : [...arr, mode];
    savePrefs({ accessibility: updated });
  };

  const renderSection = () => {
    switch (active) {
      case 'profile':
        return (
          <div>
            <SectionHeader title="Profile" desc="Your identity on EYLO. A complete profile helps EYRA personalize everything." />
            <div className="p-5 rounded-xl border border-border bg-card flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-bold">{(user?.full_name || user?.email || 'U')[0].toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">{user?.full_name || 'Researcher'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Link to="/profile" className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-secondary transition-colors">
                Edit Profile <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        );

      case 'language':
        return (
          <div>
            <SectionHeader title="Language" desc="EYRA replies, speech recognition, and voice playback use this language. Interface translation is not claimed here." />
            <div className="grid sm:grid-cols-2 gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => savePrefs({ language: lang.code })}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${prefs.language === lang.code ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-sm font-medium text-foreground">{lang.label}</span>
                  {prefs.language === lang.code && <Check size={13} className="text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 'theme':
        return (
          <div className="space-y-6">
            <div>
              <SectionHeader title="Theme & Display" desc="Customize your visual experience." />
              <div className="grid grid-cols-3 gap-3 mb-6">
                {THEMES.map(t => {
                  const Icon = t.icon;
                  const selected = prefs.theme === t.id;
                  return (
                    <button key={t.id} onClick={() => savePrefs({ theme: t.id })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
                      <Icon size={20} className={selected ? 'text-primary' : 'text-muted-foreground'} />
                      <p className="text-xs font-semibold text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground text-center">{t.desc}</p>
                      {selected && <Check size={11} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Accent Color</p>
              <div className="flex gap-3 flex-wrap">
                {ACCENT_COLORS.map(c => (
                  <button key={c.id} onClick={() => savePrefs({ accent: c.id })}
                    className={`flex flex-col items-center gap-1.5 transition-all`}>
                    <div className={`w-9 h-9 rounded-xl ${c.class} ${prefs.accent === c.id ? 'ring-2 ring-offset-2 ring-offset-background ring-white/40 scale-110' : 'opacity-60 hover:opacity-100'} transition-all`} />
                    <span className="text-[10px] text-muted-foreground">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div>
            <SectionHeader title="AI Preferences" desc="Customize how EYRA thinks, responds, and prioritizes for you." />
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Response Style</p>
              {[
                { id: 'concise', label: 'Concise', desc: 'Short, direct answers with bullet points' },
                { id: 'balanced', label: 'Balanced', desc: 'Detailed with clear structure (default)' },
                { id: 'detailed', label: 'Detailed', desc: 'In-depth analysis with full reasoning' },
              ].map(s => (
                <button key={s.id} onClick={() => savePrefs({ ai_response_style: s.id })}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${prefs.ai_response_style === s.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  {prefs.ai_response_style === s.id && <Check size={13} className="text-primary ml-auto" />}
                </button>
              ))}

              <div className="mt-6 p-4 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Personalization</p>
                    <p className="text-xs text-muted-foreground">Allow EYRA to learn from your activity</p>
                  </div>
                  <button
                    onClick={() => savePrefs({ data_personalization: !prefs.data_personalization })}
                    className={`w-10 h-6 rounded-full transition-all ${prefs.data_personalization ? 'bg-primary' : 'bg-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${prefs.data_personalization ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'voice':
        return (
          <div>
            <SectionHeader title="Voice Settings" desc="Choose how EYRA speaks to you." />
            <div className="space-y-2">
              {VOICE_STYLES.map(v => (
                <button key={v.id} onClick={() => savePrefs({ voice_style: v.id })}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${prefs.voice_style === v.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
                  <Volume2 size={15} className={prefs.voice_style === v.id ? 'text-primary' : 'text-muted-foreground'} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{v.label}</p>
                    <p className="text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                  {prefs.voice_style === v.id && <Check size={13} className="text-primary ml-auto" />}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
              <Mic size={11} /> Hold the mic button in any EYRA input to speak. Voice is processed locally.
            </p>
          </div>
        );

      case 'notifications':
        return (
          <div>
            <SectionHeader title="Notifications" desc="Control verified in-app and browser alerts from your watchlists." />
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">Browser Notifications</p>
                  <p className="text-xs text-muted-foreground">Show high-priority findings while EYLO is open. Your browser controls permission.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs.notifications_browser}
                  onClick={enableBrowserNotifications}
                  className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${prefs.notifications_browser ? 'bg-primary' : 'bg-border'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${prefs.notifications_browser ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="rounded-xl border border-border bg-secondary/20 p-4 text-xs leading-5 text-muted-foreground">
                All monitoring results remain available in the EYLO Notifications page. Email digests are not advertised because no email delivery provider is connected.
              </div>
            </div>
          </div>
        );

      case 'accessibility':
        return (
          <div>
            <SectionHeader title="Accessibility" desc="Reduce eye strain and improve readability." />
            <div className="space-y-2">
              {ACCESSIBILITY_MODES.map(m => {
                const on = prefs.accessibility?.includes(m.id);
                return (
                  <button key={m.id} onClick={() => toggleAccessibility(m.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${on ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
                    <Eye size={14} className={on ? 'text-primary' : 'text-muted-foreground'} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    {on && <Check size={13} className="text-primary ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div>
            <SectionHeader title="Privacy" desc="Control your data and how it's used." />
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="text-sm font-semibold text-foreground mb-1">Your Data</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  EYLO stores the workspace records you save. When you ask EYRA or run discovery, the request may be processed by configured AI, database, and public research-source providers. Personalization can be disabled at any time.
                </p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                <div>
                  <p className="text-sm font-semibold text-foreground">Activity Personalization</p>
                  <p className="text-xs text-muted-foreground">Use my research history to personalize EYRA</p>
                </div>
                <button
                  onClick={() => savePrefs({ data_personalization: !prefs.data_personalization })}
                  className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${prefs.data_personalization ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${prefs.data_personalization ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        );

      case 'subscription':
        return (
          <div>
            <SectionHeader title="Subscription" desc="One source of truth for plans, checkout readiness, limits, and entitlements." />
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard size={19} />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold">Manage your plan</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Pricing and availability are loaded from the authenticated billing service. If Stripe is not configured, premium tools remain clearly marked as early access and checkout stays disabled.
              </p>
              <Link to="/pricing" className="mt-5 inline-flex items-center gap-2 rounded-xl eyra-gradient px-5 py-2.5 text-sm font-semibold text-white">
                Open plans and billing <ChevronRight size={14} />
              </Link>
              <Link to="/institution" className="ml-3 mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground">
                Institution status
              </Link>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading font-bold text-2xl text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your EYLO workspace and preferences.</p>
      </div>

      {/* Mobile section picker */}
      <div className="sm:hidden mb-4">
        <select
          value={active}
          onChange={e => setActive(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none"
        >
          {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop only */}
        <aside className="w-48 flex-shrink-0 hidden sm:block">
          <nav className="space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all ${active === s.id ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}>
                  <Icon size={14} />
                  {s.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
