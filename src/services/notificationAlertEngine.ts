/**
 * @file notificationAlertEngine.ts
 * @description 0-Cost 디바이스 특화(AOS/iOS) 실시간 알림, 화면 꺼짐 방지(Wake Lock) 및 진동벨 알람 엔진
 * @sds {SDS26110100, SDS26110101, SDS26110102, SDS26110103, SDS26110104, SDS26110105}
 * @prd {PRD26103100, PRD26103101, PRD26103102, PRD26103103, PRD26103104, PRD26110105}
 */

export interface DeviceNotificationConfig {
  isAndroid: boolean;
  isIos: boolean;
  isSafari: boolean;
  isInApp: boolean;
  autoShowPwaGuide: boolean;
  useWakeLockFallback: boolean;
}

/**
 * @func validatePartySize
 * @sds {SDS26110100}
 * @prd {PRD26103100}
 * @seq {SQ1-00}
 * @state {TR-00}
 * @description Zero-PII 익명 발권 시 방문 인원 수(Party Size)의 유효성을 검증한다.
 * @param {number} partySize - 1 이상 99 이하의 정수
 * @returns {boolean} 유효 여부
 */
export function validatePartySize(partySize: number): boolean {
  if (typeof partySize !== 'number' || isNaN(partySize)) return false;
  return Number.isInteger(partySize) && partySize >= 1 && partySize <= 99;
}

/**
 * @func detectNotificationMode
 * @sds {SDS26110101}
 * @prd {PRD26103101, PRD26103102, PRD26103103}
 * @seq {SQ1-02, SQ2-02, SQ3-04}
 * @state {TR-01a, TR-01b, TR-01c, TR-02b}
 * @description User-Agent 및 파라미터를 분석하여 디바이스 알림 모드 및 폴백을 결정한다.
 * @param {string} ua - 브라우저 User-Agent 문자열
 * @param {boolean} hasPwaQuery - ?guide=pwa 쿼리 존재 여부
 * @param {string} [permission] - Notification API 권한 상태 (granted, denied, default)
 * @returns {DeviceNotificationConfig} 감지된 설정 객체
 */
export function detectNotificationMode(
  ua: string,
  hasPwaQuery: boolean,
  permission?: string
): DeviceNotificationConfig {
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isInApp = /KAKAOTALK|NAVER|Line|Instagram|FB_IAB|FBAN/i.test(ua);
  const isSafari = isIos && /Safari/i.test(ua) && !isInApp;
  const autoShowPwaGuide = Boolean(hasPwaQuery);

  // 안드로이드에서 알림 권한이 거부/차단되었거나 미지원인 경우 WakeLock 폴백 가동
  const useWakeLockFallback = isAndroid && permission === 'denied';

  return {
    isAndroid,
    isIos,
    isSafari,
    isInApp,
    autoShowPwaGuide,
    useWakeLockFallback
  };
}

/**
 * @func shouldTriggerBuzzer
 * @sds {SDS26110104}
 * @prd {PRD26103101, PRD26103102}
 * @seq {SQ1-07, SQ2-05}
 * @state {TR-03a, TR-04}
 * @description 실시간 대기 중 호출과 사후 지연 접속을 구분하여 진동벨 발동 여부를 결정한다.
 * @param {string} [prevStatus] - 이전 티켓 상태
 * @param {string} [currentStatus] - 현재 수신된 티켓 상태
 * @param {boolean} [isScreenActive=true] - 현재 브라우저 화면 활성 여부
 * @returns {boolean} 진동벨(소리/진동) 발동 여부
 */
export function shouldTriggerBuzzer(
  prevStatus?: string,
  currentStatus?: string,
  isScreenActive: boolean = true
): boolean {
  if (!isScreenActive) return false;
  // 오직 대기(WAITING) 상태에서 실시간으로 호출(CALLED)로 전이되었을 때만 발동
  return prevStatus === 'WAITING' && currentStatus === 'CALLED';
}

/**
 * @func isBypassedTicket
 * @sds {SDS26110105}
 * @prd {PRD26110105}
 * @seq {SQ4-03}
 * @state {TR-06}
 * @description 뒷 번호가 먼저 호출되어 현재 대기 번호가 건너뛰어진 상태인지 판별한다.
 * @param {string} [status] - 티켓의 현재 상태
 * @param {number} [ticketNumber] - 티켓 번호
 * @param {number} [currentServingNumber] - 대기열의 현재/마지막 호출 번호
 * @returns {boolean} 건너뛰어짐 여부
 */
export function isBypassedTicket(
  status?: string,
  ticketNumber?: number,
  currentServingNumber?: number
): boolean {
  if (status !== 'WAITING') return false;
  if (typeof ticketNumber !== 'number' || typeof currentServingNumber !== 'number') return false;
  return currentServingNumber > ticketNumber;
}

/**
 * @func requestScreenWakeLock
 * @sds {SDS26110102}
 * @prd {PRD26103101, PRD26103102}
 * @seq {SQ1-04b, SQ2-03}
 * @state {TR-01b, TR-02b}
 * @description Screen Wake Lock API를 호출하여 화면 꺼짐 및 절전 모드를 방지한다.
 * @returns {Promise<boolean>} Wake Lock 성공 여부
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      const nav = navigator as unknown as { wakeLock: { request: (type: string) => Promise<unknown> } };
      await nav.wakeLock.request('screen');
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * @class BuzzerAlertEngine
 * @sds {SDS26110103}
 * @prd {PRD26103102}
 * @seq {SQ2-06, SQ2-08}
 * @state {TR-05a, TR-05b}
 * @description 1분 제한 진동벨(Web Audio 경보음 + 진동 루프) 재생 엔진
 */
export class BuzzerAlertEngine {
  private timerId: NodeJS.Timeout | null = null;
  private chimeIntervalId: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private audioCtx: AudioContext | null = null;

  /**
   * 진동벨 알람 가동
   * @param {() => void} [onTimeout] - 60초 만료 시 실행할 콜백
   * @returns {() => void} 즉시 중단 함수 (stop)
   */
  public startBuzzerAlarm(onTimeout?: () => void): () => void {
    if (this.running) return this.stop.bind(this);
    this.running = true;

    this.startChimeLoop();
    this.startVibrationLoop();

    // 최대 60초(1분) 안전 타이머 가동
    this.timerId = setTimeout(() => {
      this.stop();
      if (onTimeout) onTimeout();
    }, 60000);

    return this.stop.bind(this);
  }

  /**
   * 진동벨 즉시 중단
   */
  public stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.chimeIntervalId) {
      clearInterval(this.chimeIntervalId);
      this.chimeIntervalId = null;
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(0);
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }

  /**
   * 현재 진동벨 가동 여부
   */
  public isActive(): boolean {
    return this.running;
  }

  private startChimeLoop(): void {
    this.playTone();
    this.chimeIntervalId = setInterval(() => {
      if (!this.running) return;
      this.playTone();
    }, 1500);
  }

  private playTone(): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, this.audioCtx.currentTime + 0.3); // drop to A4

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.4);
    } catch {
      // Audio not permitted or running in test/mock environment
    }
  }

  private startVibrationLoop(): void {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([500, 250, 500, 250]);
    }
  }
}
