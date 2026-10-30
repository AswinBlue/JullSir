import { useState, useEffect, useCallback, useRef } from 'react';
import { Ticket, Queue, QueueEvent } from '../types';
import { queueRepository } from '../services/storage/mockQueueRepository';
import { notificationService } from '../services/notification/notificationService';

export function useTicket(ticketId?: string) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
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

      const q = await queueRepository.getQueue(t.queueId);
      setQueue(q);
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
      if (
        (event.type === 'TICKET_CALLED' || event.type === 'TICKET_STATUS_CHANGED') &&
        event.ticket.id === ticketId
      ) {
        fetchTicketAndQueue();
      } else if (event.type === 'QUEUE_UPDATED') {
        fetchTicketAndQueue();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ticketId, fetchTicketAndQueue]);

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

  // Calculate remaining people ahead
  let waitingAhead = 0;
  if (ticket && queue && ticket.status === 'WAITING') {
    waitingAhead = Math.max(0, ticket.ticketNumber - queue.currentServingNumber - 1);
  }

  const isMyTurn = ticket?.status === 'CALLED' || 
    (ticket?.status === 'WAITING' && queue?.currentServingNumber === ticket.ticketNumber);

  return { ticket, queue, waitingAhead, isMyTurn, loading, error, cancel, refresh: fetchTicketAndQueue };
}
