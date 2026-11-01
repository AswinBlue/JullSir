import { SupabaseClient } from '@supabase/supabase-js';
import { Queue, Ticket, QueueSummary, QueueEvent, TicketStatus, PushSubscriptionData } from '../../types';
import { IQueueRepository } from './queueRepository';
import { supabase } from '../supabase/client';
import { notificationService } from '../notification/notificationService';

interface DbQueue {
  id: string;
  admin_token: string;
  name: string;
  description: string | null;
  current_serving_number: number;
  last_issued_number: number;
  is_closed: boolean;
  created_at: string;
  updated_at: string | null;
  last_active_at: string | null;
  expires_at: string | null;
}

interface DbTicket {
  id: string;
  queue_id: string;
  ticket_number: number;
  party_size?: number | null;
  email: string | null;
  push_subscription: PushSubscriptionData | null;
  status: TicketStatus;
  created_at: string;
  called_at: string | null;
}

function mapDbQueue(db: DbQueue): Queue {
  return {
    id: db.id,
    adminToken: db.admin_token,
    name: db.name,
    description: db.description || '',
    currentServingNumber: db.current_serving_number,
    lastIssuedNumber: db.last_issued_number,
    isClosed: db.is_closed,
    createdAt: db.created_at,
    updatedAt: db.updated_at || undefined,
    lastActiveAt: db.last_active_at || undefined,
    expiresAt: db.expires_at || undefined,
  };
}

function mapDbTicket(db: DbTicket, isExisting?: boolean): Ticket {
  const sub = db.push_subscription as any;
  const parsedPartySize = db.party_size || sub?.party_size;
  return {
    id: db.id,
    queueId: db.queue_id,
    ticketNumber: db.ticket_number,
    partySize: typeof parsedPartySize === 'number' && parsedPartySize > 0 ? parsedPartySize : 1,
    email: db.email || undefined,
    pushSubscription: db.push_subscription || undefined,
    status: db.status,
    createdAt: db.created_at,
    calledAt: db.called_at || undefined,
    isExisting,
  };
}

export class SupabaseQueueRepository implements IQueueRepository {
  private client: SupabaseClient;
  private subscribers: Set<(event: QueueEvent) => void> = new Set();
  private channel: ReturnType<SupabaseClient['channel']> | null = null;

  constructor(clientInstance?: SupabaseClient) {
    if (clientInstance) {
      this.client = clientInstance;
    } else if (supabase) {
      this.client = supabase;
    } else {
      throw new Error('Supabase client is not configured.');
    }

    this.initRealtimeSubscription();
  }

  private initRealtimeSubscription(): void {
    if (typeof window === 'undefined' || this.channel) return;

    this.channel = this.client
      .channel('jullsir_supabase_realtime')
      // Listen to queues table changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queues' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<DbQueue>;
            if (oldRow?.id) {
              this.notifyLocalSubscribers({ type: 'QUEUE_EXPIRED', queueId: oldRow.id });
            }
          } else if (payload.new) {
            const queue = mapDbQueue(payload.new as DbQueue);
            this.notifyLocalSubscribers({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
          }
        }
      )
      // Listen to tickets table changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const ticket = mapDbTicket(payload.new as DbTicket);
            this.notifyLocalSubscribers({ type: 'TICKET_ISSUED', queueId: ticket.queueId, ticket });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const ticket = mapDbTicket(payload.new as DbTicket);
            if (ticket.status === 'CALLED') {
              this.notifyLocalSubscribers({ type: 'TICKET_CALLED', queueId: ticket.queueId, ticket });
            } else {
              this.notifyLocalSubscribers({ type: 'TICKET_STATUS_CHANGED', queueId: ticket.queueId, ticket });
            }
          }
        }
      )
      .subscribe();
  }

  private notifyLocalSubscribers(event: QueueEvent): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Subscriber callback error:', err);
      }
    });
  }

  public subscribe(callback: (event: QueueEvent) => void): () => void {
    if (!this.channel) {
      this.initRealtimeSubscription();
    }
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // --- Queue Operations ---

  public async createQueue(name: string, description?: string): Promise<Queue> {
    const { data, error } = await this.client
      .from('queues')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        current_serving_number: 0,
        last_issued_number: 0,
        is_closed: false,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || '대기열 생성에 실패했습니다.');
    }

    const queue = mapDbQueue(data as DbQueue);
    this.notifyLocalSubscribers({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    return queue;
  }

  public async getQueue(queueId: string): Promise<Queue | null> {
    const { data, error } = await this.client
      .from('queues')
      .select('*')
      .eq('id', queueId)
      .maybeSingle();

    if (error || !data) return null;

    const queue = mapDbQueue(data as DbQueue);

    // 6-hour expiration check
    if (queue.expiresAt && new Date(queue.expiresAt).getTime() <= Date.now()) {
      await this.purgeQueue(queueId);
      return null;
    }

    return queue;
  }

  public async getQueueByAdminToken(adminToken: string): Promise<Queue | null> {
    const { data, error } = await this.client
      .from('queues')
      .select('*')
      .eq('admin_token', adminToken)
      .maybeSingle();

    if (error || !data) return null;

    const queue = mapDbQueue(data as DbQueue);

    // 6-hour expiration check
    if (queue.expiresAt && new Date(queue.expiresAt).getTime() <= Date.now()) {
      await this.purgeQueue(queue.id);
      return null;
    }

    return queue;
  }

  public async updateQueueInfo(adminToken: string, name: string, description?: string): Promise<Queue> {
    const { data, error } = await this.client
      .from('queues')
      .update({
        name: name.trim(),
        description: description !== undefined ? description.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('admin_token', adminToken)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || '대기열 정보 수정에 실패했습니다.');
    }

    const queue = mapDbQueue(data as DbQueue);
    this.notifyLocalSubscribers({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    return queue;
  }

  public async toggleQueueStatus(adminToken: string, isClosed: boolean): Promise<Queue> {
    const { data, error } = await this.client
      .from('queues')
      .update({
        is_closed: isClosed,
        updated_at: new Date().toISOString(),
      })
      .eq('admin_token', adminToken)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || '대기열 상태 변경에 실패했습니다.');
    }

    const queue = mapDbQueue(data as DbQueue);
    this.notifyLocalSubscribers({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    return queue;
  }

  public async touchQueueSession(adminToken: string): Promise<Queue> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.client
      .from('queues')
      .update({
        last_active_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('admin_token', adminToken)
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || '세션 연장에 실패했습니다.');
    }

    const queue = mapDbQueue(data as DbQueue);
    this.notifyLocalSubscribers({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    return queue;
  }

  public async purgeQueue(queueId: string): Promise<void> {
    await this.client.from('queues').delete().eq('id', queueId);
    this.notifyLocalSubscribers({ type: 'QUEUE_EXPIRED', queueId });
  }

  public async closeAndPurgeQueue(adminToken: string): Promise<void> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');
    await this.purgeQueue(queue.id);
  }

  // --- Ticket Operations ---

  public async issueTicket(queueId: string, partySizeOrEmail?: number | string, partySizeParam?: number): Promise<Ticket> {
    let partySize = 2;
    let email: string | undefined = undefined;

    if (typeof partySizeOrEmail === 'number') {
      partySize = partySizeOrEmail;
    } else if (typeof partySizeOrEmail === 'string') {
      email = partySizeOrEmail;
      if (typeof partySizeParam === 'number') {
        partySize = partySizeParam;
      }
    }

    if (partySize < 1 || partySize > 99 || !Number.isInteger(partySize)) {
      partySize = Math.min(Math.max(1, Math.round(partySize) || 1), 99);
    }

    const trimmedEmail = email?.trim() || '';
    if (trimmedEmail) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('올바른 이메일 주소를 입력해 주세요.');
      }
    }
    const finalEmail = trimmedEmail || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@anonymous.local`;

    // Call atomic RPC function in PostgreSQL
    const subscriptionPayload = { party_size: partySize };
    const { data, error } = await this.client.rpc('issue_ticket_atomic', {
      p_queue_id: queueId,
      p_email: finalEmail,
      p_subscription: subscriptionPayload,
    });

    if (error || !data || data.length === 0) {
      throw new Error(error?.message || '대기 번호표 발급에 실패했습니다.');
    }

    const rpcResult = data[0];
    const ticketId = rpcResult.new_ticket_id;
    const isExisting = rpcResult.is_existing;

    // Ensure push_subscription metadata is persisted with party_size
    try {
      await this.client
        .from('tickets')
        .update({ push_subscription: subscriptionPayload })
        .eq('id', ticketId);
    } catch {
      // ignore
    }

    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error('발급된 티켓 조회에 실패했습니다.');
    }

    ticket.partySize = partySize;
    ticket.isExisting = isExisting;
    return ticket;
  }

  public async getTicket(ticketId: string): Promise<Ticket | null> {
    const { data, error } = await this.client
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (error || !data) return null;
    return mapDbTicket(data as DbTicket);
  }

  public async getQueueSummary(queueId: string): Promise<QueueSummary | null> {
    const queue = await this.getQueue(queueId);
    if (!queue) return null;

    const { data, error } = await this.client
      .from('tickets')
      .select('*')
      .eq('queue_id', queueId);

    if (error || !data) return null;

    const tickets = (data as DbTicket[]).map(t => mapDbTicket(t));
    const waitingTickets = tickets
      .filter(t => t.status === 'WAITING')
      .sort((a, b) => a.ticketNumber - b.ticketNumber);

    const currentServingTicket = tickets.find(
      t => t.ticketNumber === queue.currentServingNumber && (t.status === 'CALLED' || t.status === 'COMPLETED')
    );

    const recentTickets = [...tickets]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    // N-3: 앞서 호출된 티켓들의 (calledAt - createdAt) 평균 소요 시간(분) 계산
    const calledTickets = tickets.filter(t => t.calledAt && t.createdAt);
    let avgWaitTimeMinutes = 3;
    if (calledTickets.length > 0) {
      const totalDiffMs = calledTickets.reduce((acc, t) => {
        const diff = new Date(t.calledAt!).getTime() - new Date(t.createdAt).getTime();
        return acc + Math.max(0, diff);
      }, 0);
      const avgMinutes = Math.round((totalDiffMs / calledTickets.length) / (1000 * 60));
      avgWaitTimeMinutes = Math.max(1, avgMinutes);
    }

    return {
      queue,
      waitingCount: waitingTickets.length,
      waitingTicketNumbers: waitingTickets.map(t => t.ticketNumber),
      currentServingTicket,
      nextTicket: waitingTickets[0] || undefined,
      recentTickets,
      avgWaitTimeMinutes,
    };
  }

  public async getQueueSummaryByAdminToken(adminToken: string): Promise<QueueSummary | null> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) return null;
    return this.getQueueSummary(queue.id);
  }

  // --- Host Actions ---

  public async callNextTicket(adminToken: string): Promise<Ticket | null> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    // Find first WAITING ticket
    const { data: ticketData, error: ticketError } = await this.client
      .from('tickets')
      .select('*')
      .eq('queue_id', queue.id)
      .eq('status', 'WAITING')
      .order('ticket_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ticketError || !ticketData) {
      return null;
    }

    const calledAt = new Date().toISOString();

    // 1. Update ticket to CALLED
    const { data: updatedTicketData, error: updateError } = await this.client
      .from('tickets')
      .update({
        status: 'CALLED',
        called_at: calledAt,
      })
      .eq('id', ticketData.id)
      .select()
      .single();

    if (updateError || !updatedTicketData) {
      throw new Error('티켓 호출 상태 갱신 실패');
    }

    // 2. Update queue serving number
    await this.client
      .from('queues')
      .update({
        current_serving_number: ticketData.ticket_number,
        updated_at: calledAt,
      })
      .eq('id', queue.id);

    const nextTicket = mapDbTicket(updatedTicketData as DbTicket);

    // 3. Trigger notification
    notificationService.notifyTicketCalled(nextTicket.ticketNumber, queue.name, {
      queueId: queue.id,
      email: nextTicket.email,
    });

    return nextTicket;
  }

  /**
   * @func callSpecificTicket
   * @sds {SDS26110105}
   * @prd {PRD26110105}
   * @seq {SQ4-01, SQ4-03}
   * @state {TR-06}
   * @description 점주가 대기열 목록에서 특정 티켓을 지정하여 비순차적으로 호출한다.
   * @param {string} adminToken - 점주 관리자 토큰
   * @param {string} ticketId - 호출할 티켓 식별자
   * @returns {Promise<Ticket>} 호출된 티켓 정보
   * @throws {Error} 관리자 권한 없거나 티켓이 존재하지 않는 경우
   */
  public async callSpecificTicket(adminToken: string, ticketId: string): Promise<Ticket> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    const calledAt = new Date().toISOString();

    const { data: ticketData, error: ticketError } = await this.client
      .from('tickets')
      .update({
        status: 'CALLED',
        called_at: calledAt,
      })
      .eq('id', ticketId)
      .eq('queue_id', queue.id)
      .select()
      .single();

    if (ticketError || !ticketData) {
      throw new Error('티켓 호출에 실패했습니다.');
    }

    // 2. Update queue serving number
    await this.client
      .from('queues')
      .update({
        current_serving_number: ticketData.ticket_number,
        updated_at: calledAt,
      })
      .eq('id', queue.id);

    const calledTicket = mapDbTicket(ticketData as DbTicket);

    // 3. Trigger notification
    notificationService.notifyTicketCalled(calledTicket.ticketNumber, queue.name, {
      queueId: queue.id,
      email: calledTicket.email,
    });

    return calledTicket;
  }

  public async reCallCurrentTicket(adminToken: string): Promise<Ticket | null> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');
    if (!queue.currentServingNumber) return null;

    const { data, error } = await this.client
      .from('tickets')
      .select('*')
      .eq('queue_id', queue.id)
      .eq('ticket_number', queue.currentServingNumber)
      .maybeSingle();

    if (error || !data) return null;

    const currentTicket = mapDbTicket(data as DbTicket);

    // Trigger notification
    notificationService.notifyTicketCalled(currentTicket.ticketNumber, queue.name, {
      queueId: queue.id,
      email: currentTicket.email,
    });

    return currentTicket;
  }

  public async skipTicket(adminToken: string, ticketId: string): Promise<Ticket> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    const { data: ticketData, error: ticketError } = await this.client
      .from('tickets')
      .update({ status: 'SKIPPED' })
      .eq('id', ticketId)
      .eq('queue_id', queue.id)
      .select()
      .single();

    if (ticketError || !ticketData) {
      throw new Error('티켓 스킵 처리에 실패했습니다.');
    }

    // 스킵 시에도 호출한 것으로 취급하여 현재 호출/입장 번호 갱신
    await this.client
      .from('queues')
      .update({
        current_serving_number: ticketData.ticket_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', queue.id);

    return mapDbTicket(ticketData as DbTicket);
  }

  public async completeTicket(adminToken: string, ticketId: string): Promise<Ticket> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    // L-2: 개인정보 최소수집 - 완료 처리 즉시 이메일 영구 파기 (email: null)
    const { data, error } = await this.client
      .from('tickets')
      .update({
        status: 'COMPLETED',
        email: null,
      })
      .eq('id', ticketId)
      .eq('queue_id', queue.id)
      .select()
      .single();

    if (error || !data) {
      throw new Error('입장 완료 처리에 실패했습니다.');
    }

    return mapDbTicket(data as DbTicket);
  }

  public async cancelTicket(ticketId: string): Promise<Ticket> {
    // L-2: 개인정보 최소수집 - 취소 즉시 이메일 영구 파기 (email: null)
    const { data, error } = await this.client
      .from('tickets')
      .update({
        status: 'CANCELLED',
        email: null,
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('티켓 취소 처리에 실패했습니다.');
    }

    return mapDbTicket(data as DbTicket);
  }
}
