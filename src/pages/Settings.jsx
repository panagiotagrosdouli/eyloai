import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  User, Globe, Palette, Bell, Brain, Mic, Layout,
  Shield, CreditCard, Zap, Eye, ChevronRight, Check,
  Sun, Moon, Monitor, Volume2, Languages, Sliders
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { applyTheme } from '@/lib/theme';

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

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '€0',
    features: ['Basic discovery', '3 projects', 'Limited AI calls', 'Knowledge Library'],
    color: 'border-border',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '€29/mo',
    badge: 'Most Popular',
    features: ['Unlimited discoveries', 'Unlimited projects', 'Advanced AI', 'Project Twin', 'Voice EYRA', 'Advanced reports', 'Opportunity Radar'],
    color: 'border-primary',
    highlight: true,
  },
  {
    id: 'founder',
    name: 'Founder',
    price: '€79/mo',
    features: ['Everything in Pro', 'Startup Builder', 'Grant Builder', 'Dream Team Builder', 'Future Simulator', 'Investor Intelligence', 'Priority AI'],
    color: 'border-accent',
  },
  {
    id: 'institution',
    name: 'Institution',
    price: 'Custom',
    features: ['Multi-user workspaces', 'Admin controls', 'Analytics dashboard', 'Custom integrations', 'Dedicated support', 'SSO / SAML'],
    color: 'border-amber-500/50',
  },
];

function SectionHeader({ title, desc }) {
  return (
    <div className="mb-6">
      <h2 className="font-heading font-bold text-lg text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function OptionCard({ selected, onClick, children, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left p-4 rounded-xl border transition-all ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 bg-card'} ${className}`}
    >
      {children}
      {selected && <Check size={12} className="text-primary absolute top-3 right-3" />}
    </button>
  );
}

export default function Settings() {
  const [active, setActive] = useState('profile');
  const [prefs, setPrefs] = useState({
    language: 'en',
    theme: 'dark',
    accent: 'blue',
    voice_style: 'professional',
    accessibility: [],
    ai_response_style: 'balanced',
    notifications_email: true,
    notifications_browser: true,
    data_personalization: true,
  });
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      const stored = localStorage.getItem('eylo_prefs');
      if (stored) try { setPrefs(p => ({ ...p, ...JSON.parse(stored) })); } catch {}
    });
  }, []);

  const savePrefs = async (newPrefs) => {
    const updated = { ...prefs, ...newPrefs };
    setPrefs(updated);
    localStorage.setItem('eylo_prefs', JSON.stringify(updated));
    // Apply theme immediately if it changed
    if (newPrefs.theme) applyTheme(newPrefs.theme);
    setSaving(true);
    setTimeout(() => { setSaving(false); toast({ title: 'Settings saved' }); }, 400);
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
            <SectionHeader title="Language" desc="EYRA responds in your preferred language. All content adapts automatically." />
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
            <SectionHeader title="Notifications" desc="Control when and how EYRA updates you." />
            <div className="space-y-3">
              {[
                { key: 'notifications_email', label: 'Email Notifications', desc: 'Weekly digest of new opportunities and insights' },
                { key: 'notifications_browser', label: 'Browser Notifications', desc: 'Real-time alerts for urgent opportunities' },
              ].map(n => (
                <div key={n.key} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => savePrefs({ [n.key]: !prefs[n.key] })}
                    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${prefs[n.key] ? 'bg-primary' : 'bg-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${prefs[n.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
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
                  EYLO stores only what you save: projects, papers, researchers, opportunities, and ideas. 
                  We never share your data with third parties. EYRA uses your activity to personalize recommendations — this stays within your account.
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
            <SectionHeader title="Subscription" desc="Choose the plan that fits your research ambitions." />
            <div className="grid sm:grid-cols-2 gap-4">
              {PLANS.map(plan => (
                <div key={plan.id} className={`relative p-5 rounded-2xl border ${plan.color} ${plan.highlight ? 'bg-primary/5' : 'bg-card'}`}>
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="font-bold text-base text-foreground">{plan.name}</h3>
                    <span className="font-bold text-lg text-primary">{plan.price}</span>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check size={11} className="text-green-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.id === 'institution' ? (
                    <a
                      href="mailto:hello@eylo.io"
                      className="block w-full py-2 rounded-xl text-xs font-semibold text-center transition-colors border border-border hover:bg-secondary text-foreground"
                    >
                      Contact Us
                    </a>
                  ) : (
                    <Link
                      to="/pricing"
                      className={`block w-full py-2 rounded-xl text-xs font-semibold text-center transition-colors ${plan.highlight ? 'eyra-gradient text-white' : 'border border-border hover:bg-secondary text-foreground'}`}
                    >
                      {plan.id === 'free' ? 'Current Plan' : 'See Plans →'}
                    </Link>
                  )}
                </div>
              ))}
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
