import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { environment } from '@/lib/config/env';

export default function ConfigurationError() {
  const isDevelopment = import.meta.env.DEV;
  const variableNames = [...environment.missing, ...environment.invalid];

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle aria-hidden="true" className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">
          {isDevelopment ? 'Supabase configuration required' : 'Service temporarily unavailable'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isDevelopment
            ? 'EYLO AI cannot start authentication until the required environment variables are configured.'
            : 'Authentication is not available right now. Please try again after the deployment configuration has been repaired.'}
        </p>

        {isDevelopment && variableNames.length > 0 && (
          <div className="mt-6 rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">Check these variable names:</p>
            <ul className="mt-2 space-y-1 font-mono text-sm" aria-label="Missing or invalid environment variables">
              {variableNames.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Secret values are never displayed in this page.
        </p>
      </div>
    </main>
  );
}
