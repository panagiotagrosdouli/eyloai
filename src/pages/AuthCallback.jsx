import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { requireSupabase } from '@/lib/supabaseClient';
import { getSafeRedirect } from '@/lib/auth/safeRedirect';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const completeAuth = async () => {
      const providerError = searchParams.get('error_description') || searchParams.get('error');
      if (providerError) {
        if (active) setError('Authentication could not be completed. Please return to login and try again.');
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
      <main className="min-h-screen grid place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Sign-in failed</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background">
      <div className="text-center" aria-live="polite">
        <Loader2 className="mx-auto h-7 w-7 animate-spin" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">Completing sign-in…</p>
      </div>
    </main>
  );
}
