import { Queue, Ticket, QueueSummary, QueueEvent } from '../../types';
import { IQueueRepository } from './queueRepository';
import { notificationService } from '../notification/notificationService';

const QUEUES_KEY = 'jullsir_queues_v1';
const TICKETS_KEY = 'jullsir_tickets_v1';
const CHANNEL_NAME = 'jullsir_broadcast_channel';
const SYNC_EVENT_KEY = 'jullsir_sync_event_v1';
export const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6시간 세션 유효 기간

export class MockQueueRepository implements IQueueRepository {
  private channel: BroadcastChannel | null = null;
  private subscribers: Set<(event: QueueEvent) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. BroadcastChannel for modern browsers
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<QueueEvent>) => {
          this.notifyLocalSubscribers(event.data);
        };
      }

      // 2. Window Storage Event for cross-window / cross-tab bulletproof sync
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === SYNC_EVENT_KEY && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed && parsed.event) {
              this.notifyLocalSubscribers(parsed.event);
            }
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
    return null;
  }

  private getQueues(): Record<string, Queue> {
    const storage = this.getStorage();
    if (!storage) return {};
    const raw = storage.getItem(QUEUES_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  private saveQueues(queues: Record<string, Queue>): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(QUEUES_KEY, JSON.stringify(queues));
  }

  private getTickets(): Record<string, Ticket> {
    const storage = this.getStorage();
    if (!storage) return {};
    const raw = storage.getItem(TICKETS_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  private saveTickets(tickets: Record<string, Ticket>): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  }

  private broadcast(event: QueueEvent): void {
    this.notifyLocalSubscribers(event);

    // 1. Post to BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    // 2. Trigger native storage event for other windows/tabs
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(SYNC_EVENT_KEY, JSON.stringify({ event, timestamp: Date.now() }));
      } catch {
        // ignore
      }
    }
  }

  private notifyLocalSubscribers(event: QueueEvent): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error('Subscriber callback error', e);
      }
    });
  }

  public subscribe(callback: (event: QueueEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // --- Queue Operations ---

  public async createQueue(name: string, description?: string): Promise<Queue> {
    const queues = this.getQueues();
    const id = crypto.randomUUID ? crypto.randomUUID() : 'q_' + Math.random().toString(36).substring(2, 9);
    const adminToken = crypto.randomUUID ? crypto.randomUUID() : 'adm_' + Math.random().toString(36).substring(2, 11);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

    const newQueue: Queue = {
      id,
      adminToken,
      name: name.trim(),
      description: description?.trim() || '',
      currentServingNumber: 0,
      lastIssuedNumber: 0,
      isClosed: false,
      createdAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt
    };

    queues[id] = newQueue;
    this.saveQueues(queues);
    this.broadcast({ type: 'QUEUE_UPDATED', queueId: id, queue: newQueue });
    return newQueue;
  }

  // Touch queue session to extend expiration by 6 hours
  public async touchQueueSession(adminToken: string): Promise<Queue> {
    const queues = this.getQueues();
    let targetQueue: Queue | null = null;

    for (const q of Object.values(queues)) {
      if (q.adminToken === adminToken) {
        targetQueue = q;
        break;
      }
    }

    if (!targetQueue) {
      throw new Error('유효하지 않은 관리자 토큰입니다.');
    }

    const now = new Date();
    targetQueue.lastActiveAt = now.toISOString();
    targetQueue.expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

    queues[targetQueue.id] = targetQueue;
    this.saveQueues(queues);
    this.broadcast({ type: 'QUEUE_UPDATED', queueId: targetQueue.id, queue: targetQueue });
    return targetQueue;
  }

  // Purge queue and all associated tickets permanently
  public async purgeQueue(queueId: string): Promise<void> {
    const queues = this.getQueues();
    delete queues[queueId];
    this.saveQueues(queues);

    const tickets = this.getTickets();
    let ticketsChanged = false;
    for (const [tId, t] of Object.entries(tickets)) {
      if (t.queueId === queueId) {
        delete tickets[tId];
        ticketsChanged = true;
      }
    }
    if (ticketsChanged) {
      this.saveTickets(tickets);
    }
  }

  // Auto check and purge expired queues
  private checkAndPurgeExpiredQueues(): void {
    const queues = this.getQueues();
    const now = Date.now();

    for (const [qId, q] of Object.entries(queues)) {
      if (q.expiresAt && new Date(q.expiresAt).getTime() <= now) {
        this.purgeQueue(qId);
      }
    }
  }

  public async getQueue(queueId: string): Promise<Queue | null> {
    this.checkAndPurgeExpiredQueues();
    const queues = this.getQueues();
    return queues[queueId] || null;
  }

  public async getQueueByAdminToken(adminToken: string): Promise<Queue | null> {
    this.checkAndPurgeExpiredQueues();
    const queues = this.getQueues();
    for (const q of Object.values(queues)) {
      if (q.adminToken === adminToken) {
        return q;
      }
    }
    return null;
  }

  public async updateQueueInfo(adminToken: string, name: string, description?: string): Promise<Queue> {
    const queues = this.getQueues();
    let targetQueue: Queue | null = null;

    for (const q of Object.values(queues)) {
      if (q.adminToken === adminToken) {
        targetQueue = q;
        break;
      }
    }

    if (!targetQueue) {
      throw new Error('유효하지 않은 관리자 토큰입니다.');
    }

    targetQueue.name = name.trim();
    if (description !== undefined) {
      targetQueue.description = description.trim();
    }
    targetQueue.updatedAt = new Date().toISOString();

    queues[targetQueue.id] = targetQueue;
    this.saveQueues(queues);
    this.broadcast({ type: 'QUEUE_UPDATED', queueId: targetQueue.id, queue: targetQueue });
    return targetQueue;
  }

  public async toggleQueueStatus(adminToken: string, isClosed: boolean): Promise<Queue> {
    const queues = this.getQueues();
    let targetQueue: Queue | null = null;

    for (const q of Object.values(queues)) {
      if (q.adminToken === adminToken) {
        targetQueue = q;
        break;
      }
    }

    if (!targetQueue) {
      throw new Error('유효하지 않은 관리자 토큰입니다.');
    }

    targetQueue.isClosed = isClosed;
    targetQueue.updatedAt = new Date().toISOString();

    queues[targetQueue.id] = targetQueue;
    this.saveQueues(queues);
    this.broadcast({ type: 'QUEUE_UPDATED', queueId: targetQueue.id, queue: targetQueue });
    return targetQueue;
  }

  // --- Ticket Operations ---

  public async issueTicket(queueId: string, email: string): Promise<Ticket> {
    const queues = this.getQueues();
    const queue = queues[queueId];

    if (!queue) {
      throw new Error('존재하지 않는 대기열입니다.');
    }

    if (queue.isClosed) {
      throw new Error('현재 대기열 접수가 마감되었습니다.');
    }

    // Email validation
    const trimmedEmail = email?.trim() || '';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      throw new Error('올바른 이메일 주소를 입력해 주세요.');
    }

    // Atomic increment
    queue.lastIssuedNumber += 1;
    const nextTicketNumber = queue.lastIssuedNumber;
    queues[queueId] = queue;
    this.saveQueues(queues);

    const ticketId = crypto.randomUUID ? crypto.randomUUID() : 't_' + Math.random().toString(36).substring(2, 9);
    const newTicket: Ticket = {
      id: ticketId,
      queueId,
      ticketNumber: nextTicketNumber,
      email: trimmedEmail,
      status: 'WAITING',
      createdAt: new Date().toISOString()
    };

    const tickets = this.getTickets();
    tickets[ticketId] = newTicket;
    this.saveTickets(tickets);

    this.broadcast({ type: 'QUEUE_UPDATED', queueId, queue });
    this.broadcast({ type: 'TICKET_ISSUED', queueId, ticket: newTicket });

    return newTicket;
  }

  public async getTicket(ticketId: string): Promise<Ticket | null> {
    const tickets = this.getTickets();
    return tickets[ticketId] || null;
  }

  public async getQueueSummary(queueId: string): Promise<QueueSummary | null> {
    const queue = await this.getQueue(queueId);
    if (!queue) return null;

    const tickets = Object.values(this.getTickets()).filter(t => t.queueId === queueId);
    const waitingTickets = tickets
      .filter(t => t.status === 'WAITING')
      .sort((a, b) => a.ticketNumber - b.ticketNumber);

    const currentServingTicket = tickets.find(
      t => t.ticketNumber === queue.currentServingNumber && (t.status === 'CALLED' || t.status === 'COMPLETED')
    );

    const recentTickets = tickets
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      queue,
      waitingCount: waitingTickets.length,
      currentServingTicket,
      nextTicket: waitingTickets[0] || undefined,
      recentTickets
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

    const tickets = this.getTickets();
    const queueTickets = Object.values(tickets)
      .filter(t => t.queueId === queue.id && t.status === 'WAITING')
      .sort((a, b) => a.ticketNumber - b.ticketNumber);

    if (queueTickets.length === 0) {
      return null;
    }

    const nextTicket = queueTickets[0];
    nextTicket.status = 'CALLED';
    nextTicket.calledAt = new Date().toISOString();
    tickets[nextTicket.id] = nextTicket;
    this.saveTickets(tickets);

    // Update current serving number
    const queues = this.getQueues();
    queue.currentServingNumber = nextTicket.ticketNumber;
    queues[queue.id] = queue;
    this.saveQueues(queues);

    // Trigger notification
    notificationService.notifyTicketCalled(nextTicket.ticketNumber, queue.name);

    this.broadcast({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    this.broadcast({ type: 'TICKET_CALLED', queueId: queue.id, ticket: nextTicket });

    return nextTicket;
  }

  public async skipTicket(adminToken: string, ticketId: string): Promise<Ticket> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    const tickets = this.getTickets();
    const ticket = tickets[ticketId];
    if (!ticket || ticket.queueId !== queue.id) {
      throw new Error('티켓을 찾을 수 없습니다.');
    }

    ticket.status = 'SKIPPED';
    tickets[ticketId] = ticket;
    this.saveTickets(tickets);

    // 스킵 시에도 호출한 것으로 취급하여 현재 호출/입장 번호 갱신
    const queues = this.getQueues();
    queue.currentServingNumber = ticket.ticketNumber;
    queues[queue.id] = queue;
    this.saveQueues(queues);

    this.broadcast({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    this.broadcast({ type: 'TICKET_STATUS_CHANGED', queueId: queue.id, ticket });
    return ticket;
  }

  public async completeTicket(adminToken: string, ticketId: string): Promise<Ticket> {
    const queue = await this.getQueueByAdminToken(adminToken);
    if (!queue) throw new Error('관리자 권한이 없습니다.');

    const tickets = this.getTickets();
    const ticket = tickets[ticketId];
    if (!ticket || ticket.queueId !== queue.id) {
      throw new Error('티켓을 찾을 수 없습니다.');
    }

    ticket.status = 'COMPLETED';
    tickets[ticketId] = ticket;
    this.saveTickets(tickets);

    this.broadcast({ type: 'TICKET_STATUS_CHANGED', queueId: queue.id, ticket });
    return ticket;
  }

  // --- Guest Action ---

  public async cancelTicket(ticketId: string): Promise<Ticket> {
    const tickets = this.getTickets();
    const ticket = tickets[ticketId];
    if (!ticket) {
      throw new Error('티켓을 찾을 수 없습니다.');
    }

    if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') {
      return ticket;
    }

    ticket.status = 'CANCELLED';
    tickets[ticketId] = ticket;
    this.saveTickets(tickets);

    const queues = this.getQueues();
    const queue = queues[ticket.queueId];

    if (queue) {
      this.broadcast({ type: 'QUEUE_UPDATED', queueId: queue.id, queue });
    }
    this.broadcast({ type: 'TICKET_STATUS_CHANGED', queueId: ticket.queueId, ticket });

    return ticket;
  }
}

export const queueRepository = new MockQueueRepository();
