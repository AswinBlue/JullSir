import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { MockQueueRepository } from '../src/services/storage/mockQueueRepository';

describe('JullSir Queue & Ticket Logic Tests', () => {
  let repo: MockQueueRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new MockQueueRepository();
  });

  it('대기열을 성공적으로 생성하고 초기 상태가 0이어야 한다', async () => {
    const queue = await repo.createQueue('테스트 식당', '대기 안내사항');
    expect(queue.id).toBeDefined();
    expect(queue.adminToken).toBeDefined();
    expect(queue.name).toBe('테스트 식당');
    expect(queue.description).toBe('대기 안내사항');
    expect(queue.currentServingNumber).toBe(0);
    expect(queue.lastIssuedNumber).toBe(0);
    expect(queue.isClosed).toBe(false);
  });

  it('순번표 발급 시 번호가 원자적으로 1씩 증가해야 한다', async () => {
    const queue = await repo.createQueue('원자성 테스트');
    
    const t1 = await repo.issueTicket(queue.id, 'user1@test.com');
    const t2 = await repo.issueTicket(queue.id, 'user2@test.com');
    const t3 = await repo.issueTicket(queue.id, 'user3@test.com');

    expect(t1.ticketNumber).toBe(1);
    expect(t2.ticketNumber).toBe(2);
    expect(t3.ticketNumber).toBe(3);

    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.waitingCount).toBe(3);
    expect(summary?.queue.lastIssuedNumber).toBe(3);
  });

  it('유효하지 않은 이메일이나 빈 이메일 입력 시 발급이 거부되어야 한다', async () => {
    const queue = await repo.createQueue('이메일 검증 테스트');

    // 빈 이메일
    await expect(repo.issueTicket(queue.id, '')).rejects.toThrow('이메일');

    // 잘못된 포맷
    await expect(repo.issueTicket(queue.id, 'not-an-email')).rejects.toThrow('이메일');
    await expect(repo.issueTicket(queue.id, 'test@')).rejects.toThrow('이메일');

    // 올바른 이메일은 성공
    const validTicket = await repo.issueTicket(queue.id, 'valid@example.com');
    expect(validTicket.ticketNumber).toBe(1);
  });

  it('다음 번호 호출(Call Next) 시 순번이 갱신되고 대기 인원이 차감되어야 한다', async () => {
    const queue = await repo.createQueue('호출 테스트');
    await repo.issueTicket(queue.id, 'user1@test.com'); // #1
    await repo.issueTicket(queue.id, 'user2@test.com'); // #2

    const called = await repo.callNextTicket(queue.adminToken);
    expect(called?.ticketNumber).toBe(1);
    expect(called?.status).toBe('CALLED');

    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.queue.currentServingNumber).toBe(1);
    expect(summary?.waitingCount).toBe(1); // 2번만 남음
  });

  it('대기자가 직접 티켓을 취소하면 대기 인원에서 제외되어야 한다', async () => {
    const queue = await repo.createQueue('취소 테스트');
    const t1 = await repo.issueTicket(queue.id, 'user1@test.com');
    const t2 = await repo.issueTicket(queue.id, 'user2@test.com');

    await repo.cancelTicket(t1.id);

    const cancelled = await repo.getTicket(t1.id);
    expect(cancelled?.status).toBe('CANCELLED');

    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.waitingCount).toBe(1); // t2만 대기 중
    expect(summary?.nextTicket?.id).toBe(t2.id);
  });

  it('접수 마감된 대기열에는 신규 발급이 차단되어야 한다', async () => {
    const queue = await repo.createQueue('마감 테스트');
    await repo.toggleQueueStatus(queue.adminToken, true); // 마감

    await expect(repo.issueTicket(queue.id, 'user@test.com')).rejects.toThrow('마감');
  });
});
