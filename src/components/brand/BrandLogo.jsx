import React, { useId } from 'react';

/**
 * Accessible, resolution-independent brand marks drawn in code.
 * No dark photo background, no fixed pixel bitmap, and no remote assets.
 */
const SIZE_CLASSES = {
  eylo: {
    compact: 'h-9 w-[7.5rem]',
    nav: 'h-11 w-[8.5rem] sm:w-[9.5rem]',
    panel: 'h-16 w-[11rem]',
    hero: 'h-24 w-[17rem] max-w-full',
  },
  eyra: {
    compact: 'h-10 w-[8.75rem]',
    nav: 'h-12 w-[10.5rem]',
    panel: 'h-14 w-[12rem]',
    hero: 'h-20 w-[18rem] max-w-full',
  },
};

function ResearchMark({ id, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id + '-halo'} x1="7" y1="6" x2="44" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2F7BFF" />
          <stop offset=".52" stopColor="#7C51EA" />
          <stop offset="1" stopColor="#12B6C7" />
        </linearGradient>
        <radialGradient id={id + '-core'} cx="0" cy="0" r="1" gradientTransform="translate(25 24) rotate(90) scale(24)">
          <stop stopColor="#F6FAFF" />
          <stop offset=".25" stopColor="#D9E8FF" />
          <stop offset=".64" stopColor="#91B9FF" stopOpacity=".65" />
          <stop offset="1" stopColor="#91B9FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="26" cy="26" r="23" fill={`url(#${id}-core)`} opacity=".62" />
      <circle cx="26" cy="26" r="20" stroke={`url(#${id}-halo)`} strokeWidth="2.4" />
      <ellipse cx="26" cy="26" rx="12.5" ry="20" transform="rotate(43 26 26)" stroke={`url(#${id}-halo)`} strokeWidth="1.7" opacity=".8" />
      <ellipse cx="26" cy="26" rx="17.5" ry="10" transform="rotate(-35 26 26)" stroke={`url(#${id}-halo)`} strokeWidth="1.4" opacity=".65" />
      <circle cx="26" cy="26" r="5" fill="#FFFFFF" />
      <circle cx="26" cy="26" r="2.8" fill="#3568C8" />
      <circle cx="42" cy="11" r="2.4" fill="#12B6C7" />
      <circle cx="8" cy="37" r="1.7" fill="#8868EF" />
    </svg>
  );
}

export default function BrandLogo({
  brand = 'eylo',
  size = 'nav',
  className = '',
  decorative = false,
  priority = false,
}) {
  const uid = useId().replace(/:/g, '');
  const normalizedBrand = brand === 'eyra' ? 'eyra' : 'eylo';
  const isEyra = normalizedBrand === 'eyra';
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : isEyra ? 'EYRA research assistant' : 'EYLO research workspace'}
      aria-hidden={decorative ? 'true' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl bg-transparent ${SIZE_CLASSES[normalizedBrand][size] || SIZE_CLASSES[normalizedBrand].nav} ${className}`}
      data-brand={normalizedBrand}
      data-brand-priority={priority ? 'high' : undefined}
    >
      <ResearchMark id={uid} size={isEyra ? 38 : 36} />
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span className="font-heading text-[17px] font-extrabold tracking-[0.12em] text-foreground sm:text-[19px]">
          {isEyra ? 'EYRA' : 'EYLO'}
        </span>
        <span className="mt-1 whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {isEyra ? 'RESEARCH AI' : 'RESEARCH SPACE'}
        </span>
      </span>
    </span>
  );
}

export function EyraOrb({ className = '', decorative = true }) {
  const uid = useId().replace(/:/g, '');
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'EYRA'}
      aria-hidden={decorative ? 'true' : undefined}
      className={`inline-grid shrink-0 place-items-center rounded-2xl bg-primary/5 ring-1 ring-primary/15 ${className}`}
    >
      <ResearchMark id={uid} size={32} />
    </span>
  );
}
