import { useState, useEffect, useCallback, useRef } from 'react';
import { Ticket, Queue, QueueEvent } from '../types';
import { queueRepository } from '../services/storage';
import { notificationService } from '../services/notification/notificationService';
import { isBypassedTicket } from '../services/notificationAlertEngine';

export function useTicket(ticketId?: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [avgWaitTimeMinutes, setAvgWaitTimeMinutes] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const fetchTicketAndQueue = useCallback(async () => {
    if (!ticketId) {
      setLoading(false);
      return;
    }
    try {
      const t = await queueRepository.getTicket(ticketId);
      if (!t) {
        setError('존재하지 않는 티켓입니다.');
        setLoading(false);
        return;
      }

      setTicket(t);

      // Check if newly called
      if (prevStatusRef.current === 'WAITING' && t.status === 'CALLED') {
        const q = await queueRepository.getQueue(t.queueId);
        notificationService.notifyTicketCalled(t.ticketNumber, q?.name || '줄서');
      }
      prevStatusRef.current = t.status;

      const summary = await queueRepository.getQueueSummary(t.queueId);
      if (summary) {
        setQueue(summary.queue);
        setWaitingCount(summary.waitingCount);
        if (summary.avgWaitTimeMinutes) {
          setAvgWaitTimeMinutes(summary.avgWaitTimeMinutes);
        }
      } else {
        const q = await queueRepository.getQueue(t.queueId);
        setQueue(q);
      }
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '티켓 정보를 불러올 수 없습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicketAndQueue();

    const unsubscribe = queueRepository.subscribe((event: QueueEvent) => {
      if (event.type === 'QUEUE_EXPIRED') {
        if (ticket && event.queueId === ticket.queueId) {
          setError('대기열이 종료되었습니다.');
          setTicket(null);
        }
      } else if (
        (event.type === 'TICKET_CALLED' || event.type === 'TICKET_STATUS_CHANGED') &&
        event.ticket.id === ticketId
      ) {
        fetchTicketAndQueue();
      } else if (event.type === 'QUEUE_UPDATED') {
        fetchTicketAndQueue();
      }
    });

    const interval = setInterval(() => {
      fetchTicketAndQueue();
    }, 3000);

    // A-1 & A-2: Re-sync on visibility change, focus, and network recovery
    const handleSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchTicketAndQueue();
      }
    };
    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);
    window.addEventListener('online', handleSync);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('online', handleSync);
    };
  }, [ticketId, fetchTicketAndQueue, ticket]);

  const cancel = async () => {
    if (!ticketId) return;
    try {
      const updated = await queueRepository.cancelTicket(ticketId);
      setTicket(updated);
      prevStatusRef.current = updated.status;
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '취소 중 오류가 발생했습니다.';
      throw new Error(msg);
    }
  };

  // Calculate remaining people ahead and behind
  let waitingAhead = 0;
  let waitingBehind = 0;
  if (ticket && queue && ticket.status === 'WAITING') {
    waitingAhead = Math.max(0, ticket.ticketNumber - queue.currentServingNumber - 1);
    waitingBehind = Math.max(0, waitingCount - waitingAhead - 1);
  }

  // N-3: 예상 대기 시간 (분) = (평균 소요시간) * (내 번호 앞 대기인원)
  const expectedWaitMinutes = waitingAhead > 0 ? avgWaitTimeMinutes * waitingAhead : 0;

  const isMyTurn = ticket?.status === 'CALLED' || 
    (ticket?.status === 'WAITING' && queue?.currentServingNumber === ticket.ticketNumber);

  const isBypassed = isBypassedTicket(ticket?.status, ticket?.ticketNumber, queue?.currentServingNumber);

  return { 
    ticket, 
    queue, 
    waitingAhead, 
    waitingBehind, 
    waitingCount,
    avgWaitTimeMinutes,
    expectedWaitMinutes,
    isMyTurn, 
    isBypassed,
    loading, 
    error, 
    cancel, 
    refresh: fetchTicketAndQueue 
  };
}
