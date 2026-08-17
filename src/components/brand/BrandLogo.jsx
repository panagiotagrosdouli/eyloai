import React from 'react';

const BRAND_ASSETS = {
  eylo: '/brand/eylo.png',
  eyra: '/brand/eyra.png',
};

const SIZE_CLASSES = {
  eylo: {
    compact: 'h-12 w-[4.5rem]',
    nav: 'h-14 w-[5.25rem] sm:h-16 sm:w-24',
    panel: 'h-24 w-36 sm:h-28 sm:w-44',
    hero: 'h-40 w-60 max-w-full sm:h-48 sm:w-72',
  },
  eyra: {
    compact: 'h-9 w-[8.5rem]',
    nav: 'h-12 w-[10.5rem] sm:h-14 sm:w-[12.5rem]',
    panel: 'h-14 w-[12.5rem] sm:h-16 sm:w-[14.5rem]',
    hero: 'h-24 w-[20rem] max-w-full sm:h-28 sm:w-[24rem]',
  },
};

export default function BrandLogo({
  brand = 'eylo',
  size = 'nav',
  className = '',
  decorative = false,
  priority = false,
}) {
  const normalizedBrand = BRAND_ASSETS[brand] ? brand : 'eylo';
  const label = normalizedBrand.toUpperCase();

  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#050712] shadow-[0_12px_32px_-20px_rgba(56,189,248,0.8)] ${SIZE_CLASSES[normalizedBrand][size] || SIZE_CLASSES[normalizedBrand].nav} ${className}`}
    >
      <img
        src={BRAND_ASSETS[normalizedBrand]}
        alt={decorative ? '' : label}
        aria-hidden={decorative ? 'true' : undefined}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`absolute inset-0 h-full w-full object-center ${normalizedBrand === 'eyra' ? 'object-cover' : 'object-contain'}`}
      />
    </span>
  );
}

export function EyraOrb({ className = '', decorative = true }) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'EYRA'}
      aria-hidden={decorative ? 'true' : undefined}
      className={`block shrink-0 rounded-xl border border-white/10 bg-[#050712] bg-[url('/brand/eyra.png')] bg-[length:auto_220%] bg-[position:13%_50%] bg-no-repeat shadow-[0_8px_24px_-16px_rgba(56,189,248,0.9)] ${className}`}
    />
  );
}
