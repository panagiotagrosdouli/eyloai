import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Account access unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your authenticated account is not registered for this EYLO workspace yet.
        </p>
        <a
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Return to login
        </a>
      </section>
    </main>
  );
}
