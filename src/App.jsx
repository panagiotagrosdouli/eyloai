import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';

// App pages
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Library from '@/pages/Library';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Researchers from '@/pages/Researchers';
import Opportunities from '@/pages/Opportunities';
import History from '@/pages/History';
import Profile from '@/pages/Profile';
import Challenges from '@/pages/Challenges';
import FutureSimulator from '@/pages/FutureSimulator';
import FutureMe from '@/pages/FutureMe';
import ResearchBattlefield from '@/pages/ResearchBattlefield';
import DreamTeam from '@/pages/DreamTeam';
import ImpactPredictor from '@/pages/ImpactPredictor';
import Pricing from '@/pages/Pricing';
import Meetings from '@/pages/Meetings';
import OpportunityRadar from '@/pages/OpportunityRadar';
import ExecutiveBriefing from '@/pages/ExecutiveBriefing';
import ForYou from '@/pages/ForYou';
import IdeaVault from '@/pages/IdeaVault';
import Settings from '@/pages/Settings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-3">
            <img
              src="https://media.base44.com/images/public/6a3b660e73254d1b4bf55bcb/a8ecbf98b_ChatGPTImage21202609_26_48.png"
              alt="EYLO"
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="w-6 h-6 border-2 border-border border-t-[hsl(252,85%,60%)] rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<Library />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/researchers" element={<Researchers />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/history" element={<History />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/future" element={<FutureSimulator />} />
          <Route path="/futureme" element={<FutureMe />} />
          <Route path="/battlefield" element={<ResearchBattlefield />} />
          <Route path="/dreamteam" element={<DreamTeam />} />
          <Route path="/impact" element={<ImpactPredictor />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/radar" element={<OpportunityRadar />} />
          <Route path="/briefing" element={<ExecutiveBriefing />} />
          <Route path="/foryou" element={<ForYou />} />
          <Route path="/ideas" element={<IdeaVault />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
