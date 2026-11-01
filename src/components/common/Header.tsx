import React from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  backTo?: string;
  onBackClick?: () => void;
  rightElement?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  backTo,
  onBackClick,
  rightElement
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 transition-all">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {showBack ? (
            onBackClick ? (
              <button
                onClick={onBackClick}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 text-slate-700 active:scale-95 transition-all shrink-0"
                aria-label="뒤로가기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <Link
                to={backTo || '/'}
                className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 text-slate-700 active:scale-95 transition-all shrink-0"
                aria-label="뒤로가기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            )
          ) : (
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/30 group-hover:bg-brand-600 transition-colors">
                <Clock className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent whitespace-nowrap">
                JullSir<span className="text-brand-500 font-bold ml-0.5 text-sm">줄서</span>
              </span>
            </Link>
          )}

          {title && showBack && (
            <h1 className="text-base font-bold text-slate-900 truncate min-w-0" title={title}>
              {title}
            </h1>
          )}
        </div>

        {rightElement && (
          <div className="shrink-0 whitespace-nowrap flex items-center gap-1.5">
            {rightElement}
          </div>
        )}
      </div>
    </header>
  );
};
