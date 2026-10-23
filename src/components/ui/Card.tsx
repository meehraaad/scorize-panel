import type { ComponentProps } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={`overflow-hidden rounded-card-sm bg-surface shadow-panel lg:rounded-card ${className}`}
      {...props}
    />
  );
}
