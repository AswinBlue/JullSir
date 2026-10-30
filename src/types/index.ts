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
  isExisting?: boolean; // 중복 발급 시 기존 티켓 복원 여부
}

export interface QueueSummary {
  queue: Queue;
  waitingCount: number;
  currentServingTicket?: Ticket;
  nextTicket?: Ticket;
  recentTickets: Ticket[];
  avgWaitTimeMinutes?: number; // 앞서 호출된 티켓들의 (calledAt - createdAt) 평균 소요 시간(분)
}

export type QueueEvent = 
  | { type: 'QUEUE_UPDATED'; queueId: string; queue: Queue }
  | { type: 'QUEUE_EXPIRED'; queueId: string }
  | { type: 'TICKET_ISSUED'; queueId: string; ticket: Ticket }
  | { type: 'TICKET_CALLED'; queueId: string; ticket: Ticket }
  | { type: 'TICKET_STATUS_CHANGED'; queueId: string; ticket: Ticket };
