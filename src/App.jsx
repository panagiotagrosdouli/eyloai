import { lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { environment } from '@/lib/config/env';
import PlanGate from '@/components/billing/PlanGate';
import CapabilityGate from '@/components/system/CapabilityGate';
import { redactAnalyticsEvent } from '@/lib/product-analytics';

import ConfigurationError from '@/pages/ConfigurationError';

// Every route surface is loaded on demand so visitors download only the journey they open.
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));
const Landing = lazy(() => import('@/pages/Landing'));
const PublicDiscovery = lazy(() => import('@/pages/PublicDiscovery'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const Home = lazy(() => import('@/pages/Home'));
const Library = lazy(() => import('@/pages/Library'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Researchers = lazy(() => import('@/pages/Researchers'));
const Opportunities = lazy(() => import('@/pages/Opportunities'));
const History = lazy(() => import('@/pages/History'));
const Profile = lazy(() => import('@/pages/Profile'));
const Challenges = lazy(() => import('@/pages/Challenges'));
const FutureSimulator = lazy(() => import('@/pages/FutureSimulator'));
const FutureMe = lazy(() => import('@/pages/FutureMe'));
const ResearchBattlefield = lazy(() => import('@/pages/ResearchBattlefield'));
const DreamTeam = lazy(() => import('@/pages/DreamTeam'));
const ImpactPredictor = lazy(() => import('@/pages/ImpactPredictor'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const OpportunityRadar = lazy(() => import('@/pages/OpportunityRadar'));
const ExecutiveBriefing = lazy(() => import('@/pages/ExecutiveBriefing'));
const ForYou = lazy(() => import('@/pages/ForYou'));
const IdeaVault = lazy(() => import('@/pages/IdeaVault'));
const Settings = lazy(() => import('@/pages/Settings'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const VoiceAssistant = lazy(() => import('@/pages/VoiceAssistant'));
const PitchDeckBuilder = lazy(() => import('@/pages/PitchDeckBuilder'));
const GrantBuilder = lazy(() => import('@/pages/GrantBuilder'));
const InstitutionAdmin = lazy(() => import('@/pages/InstitutionAdmin'));

const AiTool = ({ minimum, children }) => (
  <CapabilityGate capability="ai">
    {minimum ? <PlanGate minimum={minimum}>{children}</PlanGate> : children}
  </CapabilityGate>
);

const PageLoader = () => (
  <div className="grid min-h-[50vh] place-items-center" role="status" aria-live="polite">
    <div className="text-center">
      <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="mt-3 text-sm text-muted-foreground">Loading your workspace…</p>
    </div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError } = useAuth();

  if (!environment.ok) {
    return <ConfigurationError />;
  }

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold tracking-tight">EYLO AI</div>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <span className="sr-only">Loading authentication</span>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <main className="min-h-screen bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Authentication unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            EYLO AI could not verify your session. Refresh the page or try again shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/researchers" element={<Researchers />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/history" element={<History />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/future" element={<AiTool minimum="pro"><FutureSimulator /></AiTool>} />
          <Route path="/futureme" element={<FutureMe />} />
          <Route path="/battlefield" element={<AiTool minimum="pro"><ResearchBattlefield /></AiTool>} />
          <Route path="/dreamteam" element={<AiTool minimum="founder"><DreamTeam /></AiTool>} />
          <Route path="/impact" element={<AiTool minimum="pro"><ImpactPredictor /></AiTool>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/radar" element={<PlanGate minimum="pro"><OpportunityRadar /></PlanGate>} />
          <Route path="/briefing" element={<AiTool minimum="pro"><ExecutiveBriefing /></AiTool>} />
          <Route path="/foryou" element={<ForYou />} />
          <Route path="/ideas" element={<IdeaVault />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/voice" element={<AiTool minimum="pro"><VoiceAssistant /></AiTool>} />
          <Route path="/pitchdeck" element={<AiTool minimum="founder"><PitchDeckBuilder /></AiTool>} />
          <Route path="/grant-builder" element={<AiTool minimum="founder"><GrantBuilder /></AiTool>} />
          <Route path="/institution" element={<CapabilityGate capability="institution_analytics"><InstitutionAdmin /></CapabilityGate>} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/discover" element={<PublicDiscovery />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Suspense>
        </Router>
        <Analytics beforeSend={redactAnalyticsEvent} />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
