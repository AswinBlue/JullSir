import { describe, it, expect, beforeEach } from 'vitest';
import './setup';
import { MockQueueRepository } from '../src/services/storage/mockQueueRepository';
import { maskEmail } from '../src/utils/mask';

describe('JullSir Queue & Ticket Logic Tests', () => {
  let repo: MockQueueRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new MockQueueRepository();
  });

  it('대기열을 성공적으로 생성하고 6시간 세션 만료 시간이 설정되어야 한다', async () => {
    const queue = await repo.createQueue('테스트 식당', '대기 안내사항');
    expect(queue.id).toBeDefined();
    expect(queue.adminToken).toBeDefined();
    expect(queue.name).toBe('테스트 식당');
    expect(queue.description).toBe('대기 안내사항');
    expect(queue.currentServingNumber).toBe(0);
    expect(queue.lastIssuedNumber).toBe(0);
    expect(queue.isClosed).toBe(false);
    expect(queue.expiresAt).toBeDefined();

    const expiresDiff = new Date(queue.expiresAt!).getTime() - new Date(queue.createdAt).getTime();
    expect(expiresDiff).toBe(6 * 60 * 60 * 1000); // 6시간
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

  it('스킵(Skip) 시에도 호출한 것으로 취급하여 currentServingNumber가 갱신되어야 한다', async () => {
    const queue = await repo.createQueue('스킵 테스트');
    const t1 = await repo.issueTicket(queue.id, 'user1@test.com'); // #1
    await repo.issueTicket(queue.id, 'user2@test.com'); // #2

    // 1번 티켓 스킵
    const skipped = await repo.skipTicket(queue.adminToken, t1.id);
    expect(skipped.status).toBe('SKIPPED');

    // 스킵 시에도 현재 호출 번호가 1번으로 갱신되어야 함
    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.queue.currentServingNumber).toBe(1);
  });

  it('개인정보 보호 이메일 마스킹이 정상 동작해야 한다', () => {
    expect(maskEmail('honggildong@gmail.com')).toBe('ho*****g@gmail.com');
    expect(maskEmail('user@domain.com')).toBe('u**r@domain.com');
    expect(maskEmail('ab@domain.com')).toBe('a*@domain.com');
    expect(maskEmail('')).toBe('');
  });

  it('세션 연장(touchQueueSession) 시 6시간이 다시 연장되어야 한다', async () => {
    const queue = await repo.createQueue('세션 테스트');
    const touched = await repo.touchQueueSession(queue.adminToken);
    expect(touched.expiresAt).toBeDefined();
    expect(new Date(touched.expiresAt!).getTime()).toBeGreaterThan(Date.now());
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

  it('N-1: 동일 이메일 중복 발급 시 신규 번호 채번 없이 기존 대기표를 복원해야 한다', async () => {
    const queue = await repo.createQueue('중복 방지 테스트');
    const firstTicket = await repo.issueTicket(queue.id, 'customer@test.com');
    expect(firstTicket.ticketNumber).toBe(1);
    expect(firstTicket.isExisting).toBeFalsy();

    // 동일 이메일로 다시 발급 시도
    const duplicateTicket = await repo.issueTicket(queue.id, 'customer@test.com');
    expect(duplicateTicket.ticketNumber).toBe(1);
    expect(duplicateTicket.id).toBe(firstTicket.id);
    expect(duplicateTicket.isExisting).toBe(true);

    // 총 발급 번호는 여전히 1이어야 함
    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.queue.lastIssuedNumber).toBe(1);
    expect(summary?.waitingCount).toBe(1);
  });

  it('L-2: 입장 완료(COMPLETED) 및 취소(CANCELLED) 시 고객 이메일 정보가 영구 파기되어야 한다', async () => {
    const queue = await repo.createQueue('개인정보 파기 테스트');
    const t1 = await repo.issueTicket(queue.id, 'user1@test.com');
    const t2 = await repo.issueTicket(queue.id, 'user2@test.com');

    // 1번 호출 후 입장 완료
    await repo.callNextTicket(queue.adminToken);
    const completed = await repo.completeTicket(queue.adminToken, t1.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.email).toBeUndefined();

    // 2번 직접 취소
    const cancelled = await repo.cancelTicket(t2.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.email).toBeUndefined();

    // 저장소에서도 이메일이 지워졌는지 확인
    const savedT1 = await repo.getTicket(t1.id);
    const savedT2 = await repo.getTicket(t2.id);
    expect(savedT1?.email).toBeUndefined();
    expect(savedT2?.email).toBeUndefined();
  });

  it('N-2: 현재 번호 재호출(reCallCurrentTicket)이 정상 동작해야 한다', async () => {
    const queue = await repo.createQueue('재호출 테스트');
    await repo.issueTicket(queue.id, 'user1@test.com');
    await repo.callNextTicket(queue.adminToken);

    const recalled = await repo.reCallCurrentTicket(queue.adminToken);
    expect(recalled).toBeDefined();
    expect(recalled?.ticketNumber).toBe(1);
  });

  it('N-3: 앞서 호출된 티켓들의 소요 시간을 기반으로 avgWaitTimeMinutes를 계산해야 한다', async () => {
    const queue = await repo.createQueue('소요시간 계산 테스트');
    const t1 = await repo.issueTicket(queue.id, 'user1@test.com');
    
    // 강제로 과거 생성 시각 및 호출 시각 주입 (6분 차이)
    const tickets = JSON.parse(localStorage.getItem('jullsir_tickets_v1') || '{}');
    tickets[t1.id].createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    tickets[t1.id].calledAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    localStorage.setItem('jullsir_tickets_v1', JSON.stringify(tickets));

    const summary = await repo.getQueueSummary(queue.id);
    expect(summary?.avgWaitTimeMinutes).toBe(6);
  });

  it('N-4 & L-3: 오늘 영업 종료 및 대기열 즉시 정리(closeAndPurgeQueue) 시 대기열과 티켓이 모두 파기되어야 한다', async () => {
    const queue = await repo.createQueue('영업 종료 테스트');
    await repo.issueTicket(queue.id, 'user1@test.com');

    await repo.closeAndPurgeQueue(queue.adminToken);

    const deletedQueue = await repo.getQueue(queue.id);
    expect(deletedQueue).toBeNull();

    const tickets = JSON.parse(localStorage.getItem('jullsir_tickets_v1') || '{}');
    expect(Object.keys(tickets).length).toBe(0);
  });
});
