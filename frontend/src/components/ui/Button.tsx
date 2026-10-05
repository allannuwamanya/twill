import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cc785c]/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  const variants = {
    primary: 'bg-[#cc785c] text-[#121212] hover:bg-[#d97757] active:bg-[#e28466] font-semibold shadow-xs',
    secondary: 'bg-[#1e1e1e] text-zinc-200 hover:bg-[#262626] border border-[#2c2c2c]',
    outline: 'border border-[#282828] text-zinc-300 hover:bg-[#1a1a1a] hover:text-zinc-100 hover:border-[#383838]',
    ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1a1a]',
    danger: 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 shadow-xs',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2 text-sm',
  };

  return (
    <button
      className={twMerge(clsx(base, variants[variant], sizes[size], className))}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
