import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/components/AuthLayout';
import { requireSupabase } from '@/lib/supabaseClient';
import { getSafeRedirect } from '@/lib/auth/safeRedirect';
import { OAUTH_COMPLETE_MESSAGE } from '@/lib/auth/oauthPopup';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const completeAuth = async () => {
      const providerError = searchParams.get('error_description') || searchParams.get('error');
      if (providerError) {
        if (active) setError('Authentication could not be completed. Please return to sign in and try again.');
        return;
      }

      try {
        const client = requireSupabase();
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) {
          if (active) setError('No active session was found. Please sign in again.');
          return;
        }

        const destination = getSafeRedirect(searchParams.get('from'));
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: OAUTH_COMPLETE_MESSAGE }, window.location.origin);
          window.opener.location.assign(destination);
          window.close();
          return;
        }
        if (active) navigate(destination, { replace: true });
      } catch {
        if (active) setError('Authentication could not be completed. Please sign in again.');
      }
    };

    completeAuth();
    return () => {
      active = false;
    };
  }, [navigate, searchParams]);

  if (error) {
    return (
      <AuthLayout icon={ShieldCheck} title="Sign-in was not completed" subtitle="Your workspace was not opened and no research data was changed.">
        <div role="alert" className="rounded-xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm leading-6 text-red-100">
          {error}
        </div>
        <Button type="button" className="mt-5 h-12 w-full font-semibold" onClick={() => navigate('/login', { replace: true })}>
          Return to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={ShieldCheck} title="Opening your workspace" subtitle="Verifying the secure session and restoring your original destination.">
      <div className="flex items-center gap-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4 text-sm text-slate-300" aria-live="polite">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" aria-hidden="true" />
        <p>Completing sign-in…</p>
      </div>
    </AuthLayout>
  );
}
