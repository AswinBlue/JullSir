import { useState, useEffect, useCallback, useRef } from 'react';
import { QueueSummary, QueueEvent } from '../types';
import { queueRepository } from '../services/storage/mockQueueRepository';

export function useQueue(queueId?: string) {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!queueId) {
      setLoading(false);
      return;
    }
    try {
      const data = await queueRepository.getQueueSummary(queueId);
      setSummary(data);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '대기열 정보를 불러올 수 없습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  useEffect(() => {
    fetchSummary();

    // 1. Event subscription
    const unsubscribe = queueRepository.subscribe((event: QueueEvent) => {
      if (queueId && event.queueId === queueId) {
        fetchSummary();
      }
    });

    // 2. Safety 3-second background polling
    const interval = setInterval(() => {
      fetchSummary();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [queueId, fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}

export function useAdminQueue(adminToken?: string) {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queueIdRef = useRef<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!adminToken) {
      setLoading(false);
      return;
    }
    try {
      const data = await queueRepository.getQueueSummaryByAdminToken(adminToken);
      if (!data) {
        setError('존재하지 않거나 만료된 관리자 토큰입니다.');
      } else {
        setSummary(data);
        queueIdRef.current = data.queue.id;
        setError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '대기열 정보를 불러올 수 없습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    fetchSummary();

    // 1. Realtime event-driven sync
    const unsubscribe = queueRepository.subscribe((event: QueueEvent) => {
      if (!queueIdRef.current || event.queueId === queueIdRef.current) {
        fetchSummary();
      }
    });

    // 2. 3-second safety polling for bulletproof synchronization across tabs/windows
    const interval = setInterval(() => {
      fetchSummary();
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [adminToken, fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}
