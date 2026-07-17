import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { buildUserProfile } from '@/lib/second-brain';
import FutureMeDashboard from '@/components/futureme/FutureMeDashboard';
import FutureMeSetup from '@/components/futureme/FutureMeSetup';
import { Loader2, Sparkles } from 'lucide-react';

export default function FutureMe() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState(null);

  useEffect(() => {
    // Load saved goal from localStorage
    const savedGoal = localStorage.getItem('eyra_future_me_goal');
    if (savedGoal) {
      try { setGoal(JSON.parse(savedGoal)); } catch {}
    }
    buildUserProfile().then(p => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const handleGoalSet = (newGoal) => {
    localStorage.setItem('eyra_future_me_goal', JSON.stringify(newGoal));
    setGoal(newGoal);
  };

  const handleResetGoal = () => {
    localStorage.removeItem('eyra_future_me_goal');
    localStorage.removeItem('eyra_future_me_analysis');
    setGoal(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl eyra-gradient flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
            <Sparkles size={22} className="text-white" />
          </div>
          <p className="text-sm font-semibold text-foreground">Loading your profile...</p>
          <p className="text-xs text-muted-foreground mt-1">Building your research intelligence context</p>
        </div>
      </div>
    );
  }

  if (!goal) {
    return <FutureMeSetup profile={profile} onGoalSet={handleGoalSet} />;
  }

  return <FutureMeDashboard profile={profile} goal={goal} onResetGoal={handleResetGoal} />;
}
