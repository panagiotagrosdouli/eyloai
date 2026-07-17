import React from 'react';

export default function GoogleIcon({ className, ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M21.35 11.1H12v3.8h5.38c-.23 1.22-.93 2.25-1.98 2.94v2.45h3.2c1.87-1.72 2.95-4.25 2.95-7.22 0-.67-.06-1.32-.2-1.97Z" />
      <path fill="currentColor" d="M12 21.5c2.7 0 4.97-.9 6.62-2.43l-3.2-2.45c-.9.6-2.05.96-3.42.96-2.62 0-4.84-1.77-5.63-4.15H3.06v2.54A10 10 0 0 0 12 21.5Z" />
      <path fill="currentColor" d="M6.37 13.43A6 6 0 0 1 6.05 12c0-.5.1-.98.32-1.43V8.03H3.06A10 10 0 0 0 2 12c0 1.43.37 2.8 1.06 3.97l3.31-2.54Z" />
      <path fill="currentColor" d="M12 6.42c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.97 3.39 14.7 2.5 12 2.5a10 10 0 0 0-8.94 5.53l3.31 2.54C7.16 8.19 9.38 6.42 12 6.42Z" />
    </svg>
  );
}
