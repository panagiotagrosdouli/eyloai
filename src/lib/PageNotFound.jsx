import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.split('/').filter(Boolean).join('/');

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12 text-foreground">
      <section className="w-full max-w-lg text-center">
        <p className="text-7xl font-light tracking-tight text-muted-foreground">404</p>
        <div className="mx-auto mt-4 h-px w-16 bg-border" />
        <h1 className="mt-7 text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {pageName ? <>The page <span className="font-medium text-foreground">“{pageName}”</span> could not be found.</> : 'This page could not be found.'}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Go to EYLO
          </Link>
          <Link
            to="/discover"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-secondary"
          >
            Explore research
          </Link>
        </div>
      </section>
    </main>
  );
}
