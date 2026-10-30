import { Queue, Ticket, QueueSummary, QueueEvent } from '../../types';

export interface IQueueRepository {
  // Queue operations
  createQueue(name: string, description?: string): Promise<Queue>;
  getQueue(queueId: string): Promise<Queue | null>;
  getQueueByAdminToken(adminToken: string): Promise<Queue | null>;
  updateQueueInfo(adminToken: string, name: string, description?: string): Promise<Queue>;
  toggleQueueStatus(adminToken: string, isClosed: boolean): Promise<Queue>;
  touchQueueSession(adminToken: string): Promise<Queue>;
  purgeQueue(queueId: string): Promise<void>;

  // Ticket operations
  issueTicket(queueId: string, email: string): Promise<Ticket>;
  getTicket(ticketId: string): Promise<Ticket | null>;
  getQueueSummary(queueId: string): Promise<QueueSummary | null>;
  getQueueSummaryByAdminToken(adminToken: string): Promise<QueueSummary | null>;

  // Host ticket actions
  callNextTicket(adminToken: string): Promise<Ticket | null>;
  reCallCurrentTicket(adminToken: string): Promise<Ticket | null>;
  skipTicket(adminToken: string, ticketId: string): Promise<Ticket>;
  completeTicket(adminToken: string, ticketId: string): Promise<Ticket>;
  closeAndPurgeQueue(adminToken: string): Promise<void>;

  // Guest ticket action
  cancelTicket(ticketId: string): Promise<Ticket>;

  // Realtime subscription (탭/창 간 및 WebSocket)
  subscribe(callback: (event: QueueEvent) => void): () => void;
}
