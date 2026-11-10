import { lazy, Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { redactAnalyticsEvent } from '@/lib/product-analytics';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';

// Auth routes are eager so login and recovery render without waiting for a route chunk. Workspace surfaces remain lazy.
const Landing = lazy(() => import('@/pages/Landing'));
const Contact = lazy(() => import('@/pages/Contact'));
const CompanyPage = lazy(() => import('@/pages/CompanyPage'));
const PublicDiscovery = lazy(() => import('@/pages/PublicDiscovery'));
const PublicResearchers = lazy(() => import('@/pages/PublicResearchers'));
const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const PlanGate = lazy(() => import('@/components/billing/PlanGate'));
const CapabilityGate = lazy(() => import('@/components/system/CapabilityGate'));
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const Home = lazy(() => import('@/pages/Home'));
const Library = lazy(() => import('@/pages/Library'));
const ResearchGaps = lazy(() => import('@/pages/ResearchGaps'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Researchers = lazy(() => import('@/pages/Researchers'));
const PublicCareers = lazy(() => import('@/pages/PublicCareers'));
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
          <Route path="/search" element={<Home searchOnly />} />
          <Route path="/library" element={<Library />} />
          <Route path="/research-gaps" element={<ResearchGaps />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/researchers" element={<Researchers />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/history" element={<History />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/labs/scenario" element={<AiTool minimum="pro"><FutureSimulator /></AiTool>} />
          <Route path="/labs/professional-path" element={<FutureMe />} />
          <Route path="/labs/research-landscape" element={<AiTool minimum="pro"><ResearchBattlefield /></AiTool>} />
          <Route path="/labs/team" element={<AiTool minimum="founder"><DreamTeam /></AiTool>} />
          <Route path="/labs/impact" element={<AiTool minimum="pro"><ImpactPredictor /></AiTool>} />
          <Route path="/future" element={<Navigate to="/labs/scenario" replace />} />
          <Route path="/futureme" element={<Navigate to="/labs/professional-path" replace />} />
          <Route path="/battlefield" element={<Navigate to="/labs/research-landscape" replace />} />
          <Route path="/dreamteam" element={<Navigate to="/labs/team" replace />} />
          <Route path="/impact" element={<Navigate to="/labs/impact" replace />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/radar" element={<PlanGate minimum="pro"><OpportunityRadar /></PlanGate>} />
          <Route path="/briefing" element={<AiTool minimum="pro"><ExecutiveBriefing /></AiTool>} />
          <Route path="/foryou" element={<ForYou />} />
          <Route path="/ideas" element={<IdeaVault />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/labs/voice" element={<AiTool minimum="pro"><VoiceAssistant /></AiTool>} />
          <Route path="/voice" element={<Navigate to="/labs/voice" replace />} />
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
        <Router basename={import.meta.env.BASE_URL === '/eyloai/' ? '/eyloai' : '/'}>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/company" element={<CompanyPage />} />
              <Route path="/company/:section" element={<CompanyPage />} />
              <Route path="/discover" element={<PublicDiscovery />} />
              <Route path="/find-researchers" element={<PublicResearchers />} />
              <Route path="/careers" element={<PublicCareers />} />
              {/* Authentication pages stay reachable even if session bootstrap fails. */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
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
