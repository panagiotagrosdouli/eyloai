import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep logs useful while avoiding route, query, or user data in diagnostics.
    console.error('A page failed to render.', { errorName: error?.name || 'Error' });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        role="alert"
        aria-live="assertive"
        aria-labelledby="route-error-title"
        className="grid min-h-[70vh] place-items-center bg-background px-6 py-12 text-foreground"
      >
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">EYLO</p>
          <h1 id="route-error-title" className="mt-3 text-2xl font-semibold tracking-tight">
            This page could not load.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The rest of EYLO is still available. Retry the page, or return to the home page.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Try again
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
            >
              Return to EYLO
            </Link>
          </div>
          <Link to="/start" onClick={() => this.setState({ hasError: false })}
            className="mt-5 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary hover:underline">
            Not sure where to go? Start here
          </Link>
        </div>
      </main>
    );
  }
}
