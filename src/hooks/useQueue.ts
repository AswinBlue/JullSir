import { useState, useEffect, useCallback } from 'react';
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

    const unsubscribe = queueRepository.subscribe((event: QueueEvent) => {
      if (queueId && event.queueId === queueId) {
        fetchSummary();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queueId, fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}

export function useAdminQueue(adminToken?: string) {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const unsubscribe = queueRepository.subscribe((event: QueueEvent) => {
      if (summary?.queue.id && event.queueId === summary.queue.id) {
        fetchSummary();
      } else if (!summary) {
        fetchSummary();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [adminToken, summary?.queue.id, fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}
