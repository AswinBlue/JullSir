export type TicketStatus = 'WAITING' | 'CALLED' | 'SKIPPED' | 'COMPLETED' | 'CANCELLED';

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface Queue {
  id: string;
  adminToken: string;
  name: string;
  description?: string;
  currentServingNumber: number;
  lastIssuedNumber: number;
  isClosed: boolean;
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string; // 6시간 세션 타임아웃 추적
  expiresAt?: string;    // 만료 시각 (lastActiveAt + 6시간)
}

export interface Ticket {
  id: string;
  queueId: string;
  ticketNumber: number;
  email?: string;
  pushSubscription?: PushSubscriptionData;
  status: TicketStatus;
  createdAt: string;
  calledAt?: string;
}

export interface QueueSummary {
  queue: Queue;
  waitingCount: number;
  currentServingTicket?: Ticket;
  nextTicket?: Ticket;
  recentTickets: Ticket[];
}

export type QueueEvent = 
  | { type: 'QUEUE_UPDATED'; queueId: string; queue: Queue }
  | { type: 'TICKET_ISSUED'; queueId: string; ticket: Ticket }
  | { type: 'TICKET_CALLED'; queueId: string; ticket: Ticket }
  | { type: 'TICKET_STATUS_CHANGED'; queueId: string; ticket: Ticket };
