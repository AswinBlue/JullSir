import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useTicket } from '../hooks/useTicket';
import { soundManager } from '../utils/sound';
import { MobileContainer } from '../components/common/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { PwaGuideModal } from '../components/common/PwaGuideModal';
import { Ticket } from '../types';
import { 
  detectNotificationMode, 
  requestScreenWakeLock, 
  BuzzerAlertEngine, 
  shouldTriggerBuzzer,
  DeviceNotificationConfig
} from '../services/notificationAlertEngine';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  BellRing,
  Smartphone,
  Store,
  Users
} from 'lucide-react';

export const TicketDetail: React.FC = () => {
  const { queueId, ticketId } = useParams<{ queueId: string; ticketId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTicket = (location.state as { initialTicket?: Ticket } | undefined)?.initialTicket;

  const { 
    ticket, 
    queue, 
    waitingAhead, 
    waitingBehind, 
    avgWaitTimeMinutes,
    expectedWaitMinutes,
    isMyTurn, 
    isBypassed,
    loading, 
    error, 
    cancel, 
    refresh 
  } = useTicket(ticketId, initialTicket);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [deviceConfig, setDeviceConfig] = useState<DeviceNotificationConfig | null>(null);
  const [isBuzzerActive, setIsBuzzerActive] = useState(false);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  const buzzerEngineRef = useRef<BuzzerAlertEngine>(new BuzzerAlertEngine());
  const prevStatusRef = useRef<string | undefined>(initialTicket?.status);
  const hasDismissedRef = useRef<boolean>(false);
  const pendingBuzzerRef = useRef<boolean>(false);

  const startBuzzer = () => {
    if (hasDismissedRef.current) return;
    setIsBuzzerActive(true);
    buzzerEngineRef.current.startBuzzerAlarm(() => {
      setIsBuzzerActive(false);
    });
  };

  const handleDismissBuzzer = () => {
    hasDismissedRef.current = true;
    pendingBuzzerRef.current = false;
    buzzerEngineRef.current.stop();
    setIsBuzzerActive(false);
  };

  // Initialize device detection and WakeLock (Only on Mobile iOS / Android)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    const searchParams = new URLSearchParams(window.location.search);
    const hasPwaQuery = searchParams.get('guide') === 'pwa';
    const permission = typeof Notification !== 'undefined' ? Notification.permission : undefined;

    const config = detectNotificationMode(ua, hasPwaQuery, permission);
    setDeviceConfig(config);

    if (config.autoShowPwaGuide && config.isIos) {
      setIsPwaModalOpen(true);
    }

    // Auto request wake lock on mount for iOS or Android fallback
    if (config.isIos || config.useWakeLockFallback) {
      requestScreenWakeLock();
    }

    // Re-request on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && (config.isIos || config.useWakeLockFallback)) {
        requestScreenWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      buzzerEngineRef.current.stop();
    };
  }, []);

  // Monitor real-time status transitions for buzzer alarm
  useEffect(() => {
    if (!ticket) return;

    const prev = prevStatusRef.current;
    const curr = ticket.status;

    // Transitioning into CALLED
    if (shouldTriggerBuzzer(prev, curr, true) || (curr === 'CALLED' && prev === undefined && !hasDismissedRef.current)) {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        startBuzzer();
      } else {
        pendingBuzzerRef.current = true;
      }
    }

    prevStatusRef.current = curr;
  }, [ticket?.status]);

  // When tab/screen becomes visible, fire pending buzzer
  useEffect(() => {
    const handleVisibilitySync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (pendingBuzzerRef.current || (ticket?.status === 'CALLED' && !hasDismissedRef.current && !isBuzzerActive)) {
          pendingBuzzerRef.current = false;
          startBuzzer();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilitySync);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [ticket?.status, isBuzzerActive]);

  // A-3: Pre-emptively unlock mobile AudioContext on first touch / click
  useEffect(() => {
    const handleUnlock = () => {
      soundManager.unlockAudio();
    };
    window.addEventListener('click', handleUnlock, { once: true });
    window.addEventListener('touchstart', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('click', handleUnlock);
      window.removeEventListener('touchstart', handleUnlock);
    };
  }, []);

  // Trigger confetti when it's user's turn
  useEffect(() => {
    if (isMyTurn && !hasTriggeredConfetti) {
      setHasTriggeredConfetti(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // ignore
      }
    }
  }, [isMyTurn, hasTriggeredConfetti]);

  const handleCancelTicket = async () => {
    setCancelling(true);
    try {
      await cancel();
      setIsCancelModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '취소에 실패했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">내 대기 정보를 확인하는 중...</p>
          </div>
        </div>
      </MobileContainer>
    );
  }

  if (error || !ticket || !queue) {
    return (
      <MobileContainer>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">티켓 정보를 찾을 수 없습니다</h2>
          <p className="text-slate-500 text-sm mb-6">{error || '유효하지 않은 티켓입니다.'}</p>
          <Button onClick={() => navigate(queueId ? `/q/${queueId}` : '/')}>
            다시 접수하기
          </Button>
        </div>
      </MobileContainer>
    );
  }

  return (
    <div className={`min-h-screen transition-all ${isBuzzerActive ? 'ring-8 ring-amber-400 ring-offset-4 animate-pulse' : ''}`}>
      <MobileContainer theme={isMyTurn ? 'dark' : 'light'}>
        {/* Top Header */}
        <Header
          title={queue.name}
          showBack
          backTo={queueId ? `/q/${queueId}` : '/'}
          rightElement={
            <button
              onClick={refresh}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 flex items-center gap-1.5 text-xs font-bold transition-all shadow-sm border border-slate-200"
              title="새로고침"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">새로고침</span>
            </button>
          }
        />

        <main className="px-5 py-6 flex-1 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Buzzer Active Ringing Bar */}
            {isBuzzerActive && (
              <div className="p-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 font-black rounded-3xl text-center shadow-2xl animate-pulse flex flex-col sm:flex-row items-center justify-between gap-3 border-2 border-white">
                <div className="flex items-center gap-2.5 text-base">
                  <BellRing className="w-6 h-6 animate-bounce text-slate-950" />
                  <span className="font-extrabold tracking-tight">진동벨 호출 중! (소리 / 진동)</span>
                </div>
                <button
                  onClick={handleDismissBuzzer}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-950 text-white rounded-2xl text-sm font-black shadow-lg hover:bg-slate-900 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <span>🔔 알림 소리/진동 끄기 (확인)</span>
                </button>
              </div>
            )}

            {/* Wake Lock Screen Alert Banner */}
            {ticket.status === 'WAITING' && (
              <div className="p-3 bg-brand-50 border border-brand-200/70 rounded-2xl flex items-center justify-between text-xs text-brand-900 shadow-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Smartphone className="w-4 h-4 text-brand-600 shrink-0" />
                  이 브라우저 창을 켜두시면 차례가 되었을 때 진동과 벨소리로 알려드립니다 (화면 꺼짐 방지 적용 중)
                </span>
                {deviceConfig?.isIos && (
                  <button
                    onClick={() => setIsPwaModalOpen(true)}
                    className="text-[11px] text-brand-600 underline font-bold shrink-0 ml-2 whitespace-nowrap active:scale-95"
                  >
                    화면 끄고 싶다면?
                  </button>
                )}
              </div>
            )}

            {/* Bypassed Waiting Notice Banner */}
            {isBypassed && ticket.status === 'WAITING' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900 shadow-sm animate-pulse">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold leading-relaxed">
                  인원수에 맞는 좌석이 부족하여 다음 번호가 먼저 호출될 수 있습니다 (현재 순번 유지 중)
                </span>
              </div>
            )}

            {/* Status Alert Banner */}
            {isMyTurn ? (
              <div className="text-center animate-slideUp">
                <div className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xl animate-bounce">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-md">
                  지금 입장해 주세요!
                </h2>
                <p className="text-emerald-100 text-sm mt-1 font-medium">
                  고객님의 순번이 되었습니다. 직원에게 화면을 보여주세요.
                </p>
                {isBuzzerActive ? (
                  <button
                    onClick={handleDismissBuzzer}
                    className="mt-4 px-6 py-3 bg-white text-emerald-800 font-black rounded-2xl text-base shadow-xl hover:bg-emerald-50 active:scale-95 transition flex items-center justify-center gap-2 mx-auto animate-pulse"
                  >
                    <BellRing className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span>🔔 알림 소리/진동 끄기 (확인)</span>
                  </button>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 text-white text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>호출 확인 완료</span>
                  </div>
                )}
              </div>
            ) : ticket.status === 'COMPLETED' ? (
              <div className="text-center p-4 rounded-3xl bg-blue-50 border border-blue-200 text-blue-900">
                <CheckCircle2 className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                <h3 className="text-lg font-bold">입장이 완료되었습니다</h3>
                <p className="text-xs text-blue-600 mt-0.5">즐거운 시간 되세요!</p>
              </div>
            ) : ticket.status === 'SKIPPED' ? (
              <div className="text-center p-4 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900">
                <Clock className="w-8 h-8 text-amber-600 mx-auto mb-1" />
                <h3 className="text-lg font-bold">순번이 지나갔습니다</h3>
                <p className="text-xs text-amber-700 mt-0.5">매장 카운터에 순번 확인을 문의해 주세요.</p>
              </div>
            ) : ticket.status === 'CANCELLED' ? (
              <div className="text-center p-4 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900">
                <XCircle className="w-8 h-8 text-rose-600 mx-auto mb-1" />
                <h3 className="text-lg font-bold">대기가 취소되었습니다</h3>
                <p className="text-xs text-rose-600 mt-0.5">다시 이용을 원하시면 새로 접수해 주세요.</p>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  실시간 대기 현황
                </h2>
                <p className="text-xs text-slate-400 mt-1">창을 닫아도 실시간으로 순번이 업데이트됩니다</p>
              </div>
            )}

            {/* 1. Main Information: Big Number Card */}
            <Card elevated className={`p-8 text-center transition-all ${
              isMyTurn 
                ? 'bg-white text-slate-900 shadow-2xl border-4 border-white/80' 
                : 'bg-white border-2 border-brand-100'
            }`}>
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block mb-1">
                내 대기 번호 (My Ticket)
              </span>
              <div className={`text-7xl sm:text-8xl font-black tracking-tight my-2 ${
                isMyTurn ? 'text-emerald-600 animate-pulseFast' : 'text-slate-900'
              }`}>
                #{ticket.ticketNumber}
              </div>

              <div className="flex items-center justify-center gap-2 mt-3">
                <Badge status={ticket.status} />
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                  <Users className="w-3 h-3 text-slate-500" />
                  {ticket.partySize || 1}명
                </span>
              </div>
            </Card>

            {/* 2. Secondary Information Group */}
            <div className="space-y-3">
              {/* Card A: Realtime Waiting Metrics (when waiting) */}
              {ticket.status === 'WAITING' && !isMyTurn && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-2xl p-2.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">현재 호출</span>
                      <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">
                        #{queue.currentServingNumber > 0 ? queue.currentServingNumber : 0}
                      </span>
                    </div>

                    <div className="bg-brand-50 rounded-2xl p-2.5 border border-brand-100">
                      <span className="text-[10px] font-bold text-brand-600 block uppercase">내 앞 대기</span>
                      <span className="text-xl font-black text-brand-600 mt-0.5 block">
                        {waitingAhead}팀
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-2.5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">내 뒤 대기</span>
                      <span className="text-xl font-extrabold text-slate-700 mt-0.5 block">
                        {waitingBehind}팀
                      </span>
                    </div>
                  </div>

                  {/* Expected Wait Time */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-500" />
                      예상 대기 시간
                    </span>
                    <span className="font-extrabold text-slate-800">
                      {waitingAhead === 0 ? (
                        <span className="text-brand-600">곧 입장 차례입니다</span>
                      ) : (
                        <span>
                          약 <strong className="text-brand-600 text-sm">{expectedWaitMinutes}분</strong>
                          <span className="text-[10px] text-slate-400 font-normal ml-1">
                            (팀당 평균 {avgWaitTimeMinutes}분 소요)
                          </span>
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Card B: Store Description Notice (if provided) */}
              {queue.description && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Store className="w-4 h-4 text-brand-500" />
                    <span>매장 안내</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto pl-5">
                    <p className="text-xs text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
                      {queue.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Card C: Calling Tips / Notification Guide */}
              {ticket.status === 'WAITING' && (
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <BellRing className="w-4 h-4 text-brand-500" />
                    <span>호출 안내</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pl-5">
                    순번이 되면 진동과 알림 소리로 안내해 드립니다. 매장 근처에서 대기해 주시고, 알림이 울리면 직원에게 화면을 보여주세요.
                  </p>
                </div>
              )}
            </div>
          </div>

        {/* Bottom Actions (Cancel Ticket or Back to Queue) */}
        <div className="pt-6">
          {ticket.status === 'WAITING' ? (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className={`w-full py-3 text-xs font-semibold rounded-xl transition-colors ${
                isMyTurn ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-500'
              }`}
            >
              대기 취소하기
            </button>
          ) : (
            <Button
              variant={isMyTurn ? 'secondary' : 'primary'}
              fullWidth
              size="lg"
              onClick={() => navigate(queueId ? `/q/${queueId}` : '/')}
              className={isMyTurn ? 'bg-white text-emerald-800 hover:bg-emerald-50 font-bold shadow-lg' : ''}
            >
              가게 대기열 화면으로 돌아가기
            </Button>
          )}
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="대기 취소 확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            정말로 대기를 취소하시겠습니까?<br />
            취소하시면 순번(<strong>#{ticket.ticketNumber}번</strong>)이 소멸되며 복구할 수 없습니다.
          </p>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setIsCancelModalOpen(false)}
            >
              유지하기
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={cancelling}
              onClick={handleCancelTicket}
            >
              {cancelling ? '취소 중...' : '대기 취소'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* iOS PWA Guide Modal */}
      {deviceConfig?.isIos && (
        <PwaGuideModal
          isOpen={isPwaModalOpen}
          onClose={() => setIsPwaModalOpen(false)}
          isInApp={deviceConfig?.isInApp ?? false}
        />
      )}
    </MobileContainer>
    </div>
  );
};
