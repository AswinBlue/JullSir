import React from 'react';
import { TicketStatus } from '../../types';
import { clsx } from 'clsx';

interface BadgeProps {
  status: TicketStatus;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  const configs: Record<TicketStatus, { label: string; className: string }> = {
    WAITING: { label: '대기 중', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    CALLED: { label: '호출 완료', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold animate-pulse' },
    SKIPPED: { label: '넘김(스킵)', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    COMPLETED: { label: '입장 완료', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    CANCELLED: { label: '취소됨', className: 'bg-rose-50 text-rose-600 border-rose-200' },
  };

  const current = configs[status] || { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border',
        current.className
      )}
    >
      {current.label}
    </span>
  );
};
