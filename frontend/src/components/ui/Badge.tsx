import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info' | 'danger';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
}) => {
  const base =
    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide';

  const variants = {
    default: 'bg-[#181818] text-zinc-400 border border-[#262626]',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    warning: 'bg-[#cc785c]/15 text-[#e28466] border border-[#cc785c]/30',
    info: 'bg-sky-500/10 text-sky-400 border border-sky-500/25',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/25',
  };

  return (
    <span className={twMerge(clsx(base, variants[variant], className))}>
      {children}
    </span>
  );
};
