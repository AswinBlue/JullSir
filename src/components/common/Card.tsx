import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevated = false,
  className,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-3xl p-6 transition-all',
          elevated ? 'shadow-xl shadow-slate-200/60 border border-slate-100' : 'border border-slate-200/70 shadow-sm',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
