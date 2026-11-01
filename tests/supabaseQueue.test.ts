import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';
import { SupabaseQueueRepository } from '../src/services/storage/supabaseQueueRepository';
import { SupabaseClient } from '@supabase/supabase-js';

describe('SupabaseQueueRepository Tests', () => {
  let mockSupabase: any;
  let repo: SupabaseQueueRepository;

  beforeEach(() => {
    // Setup Mock Supabase client
    mockSupabase = {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      from: vi.fn(),
      rpc: vi.fn(),
    };

    repo = new SupabaseQueueRepository(mockSupabase as unknown as SupabaseClient);
  });

  it('createQueue: queues 테이블에 정상 삽입되고 camelCase로 변환되어야 한다', async () => {
    const dbQueue = {
      id: 'q_123',
      admin_token: 'adm_abc',
      name: '맛있는 식당',
      description: '대기 안내',
      current_serving_number: 0,
      last_issued_number: 0,
      is_closed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    };

    mockSupabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: dbQueue, error: null }),
        }),
      }),
    });

    const queue = await repo.createQueue('맛있는 식당', '대기 안내');
    expect(queue.id).toBe('q_123');
    expect(queue.adminToken).toBe('adm_abc');
    expect(queue.name).toBe('맛있는 식당');
    expect(queue.currentServingNumber).toBe(0);
    expect(queue.expiresAt).toBeDefined();
  });

  it('issueTicket: atomic RPC issue_ticket_atomic을 호출하고 중복 복원 플래그(isExisting)를 반환해야 한다', async () => {
    // 1. RPC 호출 결과 (중복 발견으로 기존 번호 복원)
    mockSupabase.rpc.mockResolvedValue({
      data: [{ new_ticket_id: 't_existing', new_ticket_number: 5, is_existing: true }],
      error: null,
    });

    // 2. getTicket 호출 결과
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 't_existing',
              queue_id: 'q_123',
              ticket_number: 5,
              email: 'guest@test.com',
              status: 'WAITING',
              created_at: new Date().toISOString(),
              called_at: null,
            },
            error: null,
          }),
        }),
      }),
    });

    const ticket = await repo.issueTicket('q_123', 'guest@test.com', 6);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('issue_ticket_atomic', {
      p_queue_id: 'q_123',
      p_email: 'guest@test.com',
      p_subscription: { party_size: 6 },
    });
    expect(ticket.id).toBe('t_existing');
    expect(ticket.ticketNumber).toBe(5);
    expect(ticket.partySize).toBe(6);
    expect(ticket.isExisting).toBe(true);
  });

  it('completeTicket: 개인정보 보호를 위해 email을 null로 파기해야 한다', async () => {
    // 1. getQueueByAdminToken
    const dbQueue = {
      id: 'q_123',
      admin_token: 'adm_token',
      name: '식당',
      current_serving_number: 1,
      last_issued_number: 1,
      is_closed: false,
      created_at: new Date().toISOString(),
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 't_1',
                queue_id: 'q_123',
                ticket_number: 1,
                email: null,
                status: 'COMPLETED',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'queues') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: dbQueue, error: null }),
            }),
          }),
        };
      }
      if (table === 'tickets') {
        return {
          update: updateMock,
        };
      }
      return {};
    });

    const completed = await repo.completeTicket('adm_token', 't_1');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.email).toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith({
      status: 'COMPLETED',
      email: null,
    });
  });

  it('cancelTicket: 대기 취소 시 email을 null로 파기해야 한다', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 't_2',
              queue_id: 'q_123',
              ticket_number: 2,
              email: null,
              status: 'CANCELLED',
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });

    mockSupabase.from.mockReturnValue({
      update: updateMock,
    });

    const cancelled = await repo.cancelTicket('t_2');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.email).toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith({
      status: 'CANCELLED',
      email: null,
    });
  });
});
