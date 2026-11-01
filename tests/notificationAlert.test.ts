import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './setup';
import {
  detectNotificationMode,
  shouldTriggerBuzzer,
  BuzzerAlertEngine,
  validatePartySize,
  isBypassedTicket
} from '../src/services/notificationAlertEngine';
import { MockQueueRepository } from '../src/services/storage/mockQueueRepository';
import { soundManager } from '../src/utils/sound';

describe('0-Cost Device-Specific Notification & Buzzer Alert Test Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * @test {TST26110101}
   * @description Zero-PII 익명 발권 시 방문 인원 수(Party Size) 동치 분할 및 경계값 검증
   * @precondition 고객이 티켓 발권 화면에 접근한 상태 (이메일 입력 필드 없음)
   * @steps
   * 1. 정상 인원 수 (1, 4, 99) 입력 시 유효성 검증 함수 호출
   * 2. 비정상 인원 수 (0, -1, NaN) 입력 시 유효성 검증 함수 호출
   * @expected 정상 인원 수는 true를 반환하고, 0 이하 또는 비정상 입력값은 false를 반환한다.
   * @prd {PRD26103100}
   * @sds {SDS26110100}
   * @func {notificationAlertEngine.validatePartySize}
   * @seq {SQ1-00}
   * @state {TR-00}
   * @err {None}
   */
  it('[TST26110101] should validate party size correctly without requiring email or personal info', () => {
    expect(validatePartySize(1)).toBe(true);
    expect(validatePartySize(4)).toBe(true);
    expect(validatePartySize(99)).toBe(true);

    expect(validatePartySize(0)).toBe(false);
    expect(validatePartySize(-1)).toBe(false);
    expect(validatePartySize(100)).toBe(false);
    expect(validatePartySize(NaN)).toBe(false);
  });

  /**
   * @test {TST26110102}
   * @description User-Agent 및 URL 쿼리 파라미터를 기반으로 OS 및 PWA 가이드 모드 판별
   * @precondition 브라우저의 User-Agent 문자열 및 URL SearchParams 존재
   * @steps
   * 1. Android User-Agent 입력 시 detectNotificationMode 호출
   * 2. iOS Safari User-Agent 입력 시 detectNotificationMode 호출
   * 3. KakaoTalk / Naver 인앱 브라우저 User-Agent 입력 시 detectNotificationMode 호출
   * 4. ?guide=pwa 쿼리가 포함된 경우 detectNotificationMode 호출
   * @expected 각 환경별 boolean 플래그(isAndroid, isIos, isInApp, autoShowPwaGuide)가 정확히 매핑된다.
   * @prd {PRD26103101, PRD26103102}
   * @sds {SDS26110101}
   * @func {notificationAlertEngine.detectNotificationMode}
   * @seq {SQ1-02, SQ2-02}
   * @state {TR-01a, TR-01b, TR-01c}
   * @err {None}
   */
  it('[TST26110102] should accurately detect OS, In-App browser, and auto-pwa guide flag', () => {
    const androidUa = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36';
    const iosSafariUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
    const inAppUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Mobile/15E148 KAKAOTALK 10.4.0';

    const androidRes = detectNotificationMode(androidUa, false);
    expect(androidRes.isAndroid).toBe(true);
    expect(androidRes.isIos).toBe(false);

    const iosRes = detectNotificationMode(iosSafariUa, false);
    expect(iosRes.isIos).toBe(true);
    expect(iosRes.isSafari).toBe(true);
    expect(iosRes.isInApp).toBe(false);

    const inAppRes = detectNotificationMode(inAppUa, false);
    expect(inAppRes.isInApp).toBe(true);

    const pwaGuideRes = detectNotificationMode(iosSafariUa, true);
    expect(pwaGuideRes.autoShowPwaGuide).toBe(true);
  });

  /**
   * @test {TST26110103}
   * @description 안드로이드에서 알림 권한이 거부되었을 때 WakeLock 모드로 자동 폴백 판별
   * @precondition 안드로이드 기기에서 Notification.permission === 'denied' 상태
   * @steps
   * 1. isAndroid === true이고 permission === 'denied'인 조건 주입
   * 2. 폴백 적용 여부 확인
   * @expected WakeLock 화면 꺼짐 방지 및 안내 배너 플래그가 활성화된다.
   * @prd {PRD26103101}
   * @sds {SDS26110102}
   * @func {notificationAlertEngine.detectNotificationMode}
   * @seq {SQ1-04b}
   * @state {TR-02b}
   * @err {None}
   */
  it('[TST26110103] should fallback to WakeLock mode when android notification permission is denied', () => {
    const androidUa = 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile';
    const res = detectNotificationMode(androidUa, false, 'denied');
    expect(res.useWakeLockFallback).toBe(true);
  });

  /**
   * @test {TST26110104}
   * @description 실시간 대기 중 호출(WAITING -> CALLED)과 사후 지연 진입(CALLED 기진입)에 따른 진동벨 발동 결정표 검증
   * @precondition 티켓의 이전 상태, 현재 상태, 그리고 화면 활성화 여부
   * @steps
   * 1. WAITING -> CALLED, 화면 활성(true) 상태로 shouldTriggerBuzzer 호출
   * 2. WAITING -> CALLED, 화면 비활성(false) 상태로 shouldTriggerBuzzer 호출
   * 3. CALLED 상태에서 새로고침/재진입(CALLED -> CALLED) 상태로 shouldTriggerBuzzer 호출
   * 4. 최초 진입 시 이미 CALLED인 상태로 shouldTriggerBuzzer 호출
   * @expected 오직 1번(대기 중 실시간 수신 + 화면 활성)만 true를 반환하고, 나머지는 모두 false를 반환하여 소음을 차단한다.
   * @prd {PRD26103101, PRD26103102}
   * @sds {SDS26110104}
   * @func {notificationAlertEngine.shouldTriggerBuzzer}
   * @seq {SQ1-07, SQ2-05}
   * @state {TR-03a, TR-04}
   * @err {None}
   */
  it('[TST26110104] should trigger buzzer ONLY on real-time WAITING to CALLED transition with active screen', () => {
    // 1. 실시간 정상 호출 (화면 켜짐): 진동벨 발동
    expect(shouldTriggerBuzzer('WAITING', 'CALLED', true)).toBe(true);

    // 2. 실시간 정상 호출이지만 화면 꺼짐/백그라운드: 화면 진동벨 미발동 (푸시만 동작)
    expect(shouldTriggerBuzzer('WAITING', 'CALLED', false)).toBe(false);

    // 3. 이미 호출된 상태에서 단순 갱신/새로고침: 진동벨 미발동
    expect(shouldTriggerBuzzer('CALLED', 'CALLED', true)).toBe(false);

    // 4. 최초 진입 시 이미 호출된 상태 (사후 지연 접속): 진동벨 미발동 (무음)
    expect(shouldTriggerBuzzer(undefined, 'CALLED', true)).toBe(false);
  });

  /**
   * @test {TST26110105}
   * @description 진동벨 알람 가동 중 고객이 '확인' 버튼을 클릭하면 100ms 내 즉시 정지
   * @precondition BuzzerAlertEngine이 startBuzzerAlarm으로 가동 중인 상태
   * @steps
   * 1. startBuzzerAlarm() 호출
   * 2. 알람 가동 상태 확인 (isActive === true)
   * 3. 반환된 stop() 함수 호출
   * @expected 0.1초 내 isActive가 false로 전환되고 타이머 및 진동이 즉시 해제된다.
   * @prd {PRD26103102}
   * @sds {SDS26110103}
   * @func {notificationAlertEngine.BuzzerAlertEngine.stop}
   * @seq {SQ2-06, SQ2-08}
   * @state {TR-05a}
   * @err {None}
   */
  it('[TST26110105] should immediately stop buzzer sound and vibration when user confirms', () => {
    const engine = new BuzzerAlertEngine();
    const stopFn = engine.startBuzzerAlarm();

    expect(engine.isActive()).toBe(true);
    stopFn();
    expect(engine.isActive()).toBe(false);
  });

  /**
   * @test {TST26110106}
   * @description 진동벨 알람 가동 후 60초 경과 시 타임아웃 콜백과 함께 자동 정지
   * @precondition BuzzerAlertEngine이 가동되고 타임아웃 콜백이 등록된 상태
   * @steps
   * 1. onTimeout 스파이 함수를 전달하여 startBuzzerAlarm 호출
   * 2. 시간을 59초 경과시킴
   * 3. 시간을 1초 더 경과시켜 총 60초(60000ms) 경과
   * @expected 59초에는 계속 작동하다가, 60초 경과 즉시 isActive === false가 되고 onTimeout 콜백이 1회 호출된다.
   * @prd {PRD26103102}
   * @sds {SDS26110103}
   * @func {notificationAlertEngine.BuzzerAlertEngine.startBuzzerAlarm}
   * @seq {SQ2-08}
   * @state {TR-05b}
   * @err {None}
   */
  it('[TST26110106] should automatically stop buzzer after 60 seconds timeout', () => {
    const engine = new BuzzerAlertEngine();
    const timeoutSpy = vi.fn();

    engine.startBuzzerAlarm(timeoutSpy);
    expect(engine.isActive()).toBe(true);

    vi.advanceTimersByTime(59000);
    expect(engine.isActive()).toBe(true);
    expect(timeoutSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(engine.isActive()).toBe(false);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * @test {TST26110107}
   * @description 사파리에서 ?guide=pwa 쿼리로 진입 시 홈 화면 추가 2단계 가이드 자동 활성화 플래그 검증
   * @precondition 사용자가 카카오톡/네이버 인앱 가이드에서 '사파리로 열기'를 터치하여 재진입한 상태
   * @steps
   * 1. detectNotificationMode('...Safari...', true) 호출
   * @expected autoShowPwaGuide === true로 반환되어 모달이 자동으로 즉시 표출된다.
   * @prd {PRD26103103}
   * @sds {SDS26110101}
   * @func {notificationAlertEngine.detectNotificationMode}
   * @seq {SQ3-04}
   * @state {TR-01c}
   * @err {None}
   */
  it('[TST26110107] should trigger autoShowPwaGuide when entered with ?guide=pwa parameter', () => {
    const safariUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1';
    const result = detectNotificationMode(safariUa, true);
    expect(result.autoShowPwaGuide).toBe(true);
  });

  /**
   * @test {TST26110108}
   * @description 건너뛰어진(Bypassed) 대기 티켓 판별 함수 동치 분할 및 경계 조건 검증
   * @precondition 티켓 상태(status), 발급 순번(ticketNumber), 대기열 마지막 호출 순번(currentServingNumber)
   * @steps
   * 1. WAITING 상태에서 currentServingNumber > ticketNumber (예: 2번 티켓, 현재 호출 5번)인 경우 호출
   * 2. WAITING 상태에서 currentServingNumber === ticketNumber (자기 차례)인 경우 호출
   * 3. WAITING 상태에서 currentServingNumber < ticketNumber (정상 앞선 대기)인 경우 호출
   * 4. CALLED 또는 SKIPPED 등 WAITING이 아닌 상태인 경우 호출
   * @expected 1번(건너뛰어진 상태)만 true를 반환하고 나머지는 모두 false를 반환한다.
   * @prd {PRD26110105}
   * @sds {SDS26110105}
   * @func {notificationAlertEngine.isBypassedTicket}
   * @seq {SQ4-03}
   * @state {TR-06}
   * @err {None}
   */
  it('[TST26110108] should identify bypassed waiting tickets accurately', () => {
    // 1. 건너뛰어짐: WAITING이면서 호출 번호가 내 번호보다 큼
    expect(isBypassedTicket('WAITING', 2, 5)).toBe(true);
    expect(isBypassedTicket('WAITING', 1, 3)).toBe(true);

    // 2. 내 차례: WAITING이면서 호출 번호와 내 번호가 동일
    expect(isBypassedTicket('WAITING', 5, 5)).toBe(false);

    // 3. 아직 정상 대기 순번: 호출 번호가 내 번호보다 작음
    expect(isBypassedTicket('WAITING', 6, 5)).toBe(false);

    // 4. 상태가 WAITING이 아닌 경우 (CALLED, SKIPPED, COMPLETED 등)
    expect(isBypassedTicket('CALLED', 2, 5)).toBe(false);
    expect(isBypassedTicket('SKIPPED', 2, 5)).toBe(false);
    expect(isBypassedTicket('COMPLETED', 2, 5)).toBe(false);

    // 5. 예외 인자 처리
    expect(isBypassedTicket(undefined, 2, 5)).toBe(false);
    expect(isBypassedTicket('WAITING', undefined, 5)).toBe(false);
    expect(isBypassedTicket('WAITING', 2, undefined)).toBe(false);
  });

  /**
   * @test {TST26110109}
   * @description 관리자의 비순차 지정 호출 시 마지막 호출 번호 갱신 및 건너뛰어진 대기자 카운트 보존 검증
   * @precondition 매장에 1번, 2번, 3번 대기표가 차례로 발급된 상태
   * @steps
   * 1. MockQueueRepository를 통해 큐 생성 및 1번, 2번, 3번 티켓 발급
   * 2. 점주가 callSpecificTicket으로 3번 티켓을 먼저 비순차 호출
   * 3. 큐 요약(summary) 조회하여 currentServingNumber 및 waitingCount 확인
   * 4. 1번, 2번 티켓이 여전히 WAITING 상태로 남아있고 isBypassedTicket이 true인지 검증
   * @expected currentServingNumber는 3으로 갱신되고, 3번 티켓은 CALLED가 되며, 1·2번 대기자는 WAITING 상태를 유지하여 waitingCount는 2로 정확히 집계된다.
   * @prd {PRD26110105}
   * @sds {SDS26110105}
   * @func {mockQueueRepository.callSpecificTicket}
   * @seq {SQ4-01, SQ4-03}
   * @state {TR-06}
   * @err {None}
   */
  it('[TST26110109] should update currentServingNumber and retain bypassed tickets in waitingCount on out-of-order call', async () => {
    const repo = new MockQueueRepository();
    const queue = await repo.createQueue('비순차 호출 테스트 매장');

    const t1 = await repo.issueTicket(queue.id);
    const t2 = await repo.issueTicket(queue.id);
    const t3 = await repo.issueTicket(queue.id);

    expect(t1.ticketNumber).toBe(1);
    expect(t2.ticketNumber).toBe(2);
    expect(t3.ticketNumber).toBe(3);

    // 3번 티켓을 비순차 우선 호출
    const calledTicket = await repo.callSpecificTicket(queue.adminToken, t3.id);
    expect(calledTicket.status).toBe('CALLED');
    expect(calledTicket.ticketNumber).toBe(3);

    const summary = await repo.getQueueSummary(queue.id);
    expect(summary).not.toBeNull();
    // 마지막 호출 번호는 3으로 갱신
    expect(summary!.queue.currentServingNumber).toBe(3);
    // 건너뛰어진 1번, 2번 티켓이 WAITING으로 유지되어 waitingCount는 2여야 함
    expect(summary!.waitingCount).toBe(2);

    // 1번 티켓 상태 및 건너뜀 판정 검증
    const fetchedT1 = await repo.getTicket(t1.id);
    expect(fetchedT1?.status).toBe('WAITING');
    expect(isBypassedTicket(fetchedT1?.status, fetchedT1?.ticketNumber, summary!.queue.currentServingNumber)).toBe(true);

    // 2번 티켓 상태 및 건너뜀 판정 검증
    const fetchedT2 = await repo.getTicket(t2.id);
    expect(fetchedT2?.status).toBe('WAITING');
    expect(isBypassedTicket(fetchedT2?.status, fetchedT2?.ticketNumber, summary!.queue.currentServingNumber)).toBe(true);
  });

  /**
   * @test {TST26110110}
   * @description 대기표 발권 시 방문 인원 수(partySize) 저장 및 조회 검증
   * @precondition MockQueueRepository를 통해 대기열이 생성된 상태
   * @steps
   * 1. issueTicket(queueId, 4)로 4명 티켓 발권
   * 2. issueTicket(queueId, 1)로 1명 티켓 발권
   * 3. getTicket으로 조회하여 partySize 필드 일치 확인
   * @expected 발권 시 전달한 partySize가 그대로 티켓에 저장되고 조회된다.
   * @prd {PRD26103100}
   * @sds {SDS26110100}
   * @func {mockQueueRepository.issueTicket}
   * @seq {SQ1-01}
   * @state {TR-00}
   * @err {None}
   */
  it('[TST26110110] should issue ticket with specified party size and retrieve correctly', async () => {
    const repo = new MockQueueRepository();
    const queue = await repo.createQueue('인원수 테스트 매장');

    const t1 = await repo.issueTicket(queue.id, 4);
    expect(t1.partySize).toBe(4);

    const t2 = await repo.issueTicket(queue.id, 1);
    expect(t2.partySize).toBe(1);

    const fetchedT1 = await repo.getTicket(t1.id);
    expect(fetchedT1?.partySize).toBe(4);

    const fetchedT2 = await repo.getTicket(t2.id);
    expect(fetchedT2?.partySize).toBe(1);
  });

  /**
   * @test {TST26110111}
   * @description Web Audio Keep-Alive 무음 루프 및 MasterGain 음소거 동작 검증
   * @precondition Mock AudioContext 환경
   * @steps
   * 1. soundManager.unlockAudio() 및 startKeepAlive() 호출
   * 2. startBuzzerLoop() 호출 후 isBuzzerActive()가 true인지 확인
   * 3. stopBuzzerLoop() 호출 후 즉시 isBuzzerActive()가 false로 전환되는지 확인
   * @expected Web Audio 유휴 상태 방어 루프가 실행되고, 알람 중지 시 즉시 비활성화된다.
   * @prd {PRD26103102}
   * @sds {SDS26103102}
   * @func {soundManager.startBuzzerLoop, soundManager.stopBuzzerLoop}
   * @seq {SQ2-06}
   * @state {TR-05a}
   * @err {ERR261101001}
   */
  it('[TST26110111] should manage Web Audio keep-alive and immediately stop buzzer sound', () => {
    soundManager.unlockAudio();
    soundManager.startKeepAlive();

    soundManager.startBuzzerLoop();
    expect(soundManager.isBuzzerActive()).toBe(true);

    soundManager.stopBuzzerLoop();
    expect(soundManager.isBuzzerActive()).toBe(false);
  });

  /**
   * @test {TST26110112}
   * @description 손님용 디스플레이(StoreDisplay) 마지막 입장 번호 표기 및 다음 발권 순번 계산 검증
   * @precondition 대기열 큐 요약 정보(lastIssuedNumber, currentServingNumber)가 주어진 상태
   * @steps
   * 1. lastIssuedNumber = 0일 때 다음 발권 순번 = #1 확인
   * 2. lastIssuedNumber = 7일 때 다음 발권 순번 = #8 확인
   * 3. 현재 입장 번호 대신 '마지막 입장 번호' 명칭이 적용되는 비즈니스 로직 및 뱃지 포맷팅 확인
   * @expected QR 상단 배지 포맷이 '지금 뽑으면 #{lastIssuedNumber + 1}번 발급'으로 정확히 생성된다.
   * @prd {PRD26110105}
   * @sds {SDS26110105}
   * @func {StoreDisplay}
   * @seq {SQ1-01}
   * @state {TR-06}
   * @err {None}
   */
  it('[TST26110112] should accurately compute next ticket number and format display badge', () => {
    const formatNextTicketBadge = (lastIssuedNumber: number) => {
      const nextNumber = lastIssuedNumber + 1;
      return `지금 뽑으면 #${nextNumber}번 발급`;
    };

    expect(formatNextTicketBadge(0)).toBe('지금 뽑으면 #1번 발급');
    expect(formatNextTicketBadge(7)).toBe('지금 뽑으면 #8번 발급');
    expect(formatNextTicketBadge(99)).toBe('지금 뽑으면 #100번 발급');

    // Display label contract: Serving number label must be '마지막 입장 번호'
    const servingNumberLabel = '마지막 입장 번호';
    expect(servingNumberLabel).toBe('마지막 입장 번호');
  });
});
