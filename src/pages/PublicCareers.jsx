import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/brand/BrandLogo';
import Careers from './Careers';

export default function PublicCareers() {
  return (
    <div className="min-h-screen bg-white text-[#172A40]">
      <header className="sticky top-0 z-30 border-b border-[#E2EAF1] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-9">
          <Link to="/" aria-label="EYLO company homepage">
            <BrandLogo brand="eylo" size="nav" priority />
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-3 text-sm font-semibold">
            <Link to="/discover" className="hidden text-[#285C7B] hover:underline sm:inline">Research discovery</Link>
            <Link to="/find-researchers" className="hidden text-[#285C7B] hover:underline sm:inline">Researchers</Link>
            <Link to="/login?from=%2Fcareers" className="rounded-lg bg-[#172A40] px-4 py-2.5 text-white">Log in</Link>
          </nav>
        </div>
      </header>
      <Careers />
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-[#E2EAF1] px-5 py-6 text-xs text-[#6B7F8E] sm:px-9">
        <span>© {new Date().getFullYear()} EYLO</span>
        <Link to="/" className="hover:underline">About EYLO</Link>
      </footer>
    </div>
  );
}
