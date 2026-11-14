import '@/pages/landing.css';
import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/brand/BrandLogo';
import Careers from './Careers';

export default function PublicCareers() {
  return (
    <div className="eylo-company min-h-screen bg-[var(--company-surface)] text-[var(--company-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--company-border)] bg-[var(--company-surface)] backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-9">
          <Link to="/" aria-label="EYLO company homepage">
            <BrandLogo brand="eylo" size="nav" priority />
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-3 text-sm font-semibold">
            <Link to="/discover" className="hidden text-[var(--company-muted)] hover:underline sm:inline">Research discovery</Link>
            <Link to="/find-researchers" className="hidden text-[var(--company-muted)] hover:underline sm:inline">Researchers</Link>
            <Link to="/login?from=%2Fcareers" className="rounded-lg company-primary px-4 py-2.5 text-white">Log in</Link>
          </nav>
        </div>
      </header>
      <Careers />
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-[var(--company-border)] px-5 py-6 text-xs text-[var(--company-muted)] sm:px-9">
        <span>© {new Date().getFullYear()} EYLO</span>
        <Link to="/" className="hover:underline">About EYLO</Link>
      </footer>
    </div>
  );
}
