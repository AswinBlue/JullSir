import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { queueRepository } from '../services/storage';
import { generateQrDataUrl } from '../utils/qr';
import { MobileContainer } from '../components/common/MobileContainer';
import { EmailInput, isValidEmail } from '../components/common/EmailInput';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { soundManager } from '../utils/sound';
import { Ticket } from '../types';
import { 
  Users, 
  ArrowLeft, 
  BellRing, 
  CheckCircle2, 
  QrCode, 
  AlertCircle,
  Info
} from 'lucide-react';

export const StoreDisplay: React.FC = () => {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { summary, loading, error } = useQueue(queueId);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);
  const [issuedTicketQrUrl, setIssuedTicketQrUrl] = useState<string>('');
  const [inputError, setInputError] = useState('');

  // Mobile queue issue URL (for QR code)
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const guestIssueUrl = queueId ? `${baseUrl}/q/${queueId}` : '';

  useEffect(() => {
    if (guestIssueUrl) {
      generateQrDataUrl(guestIssueUrl).then(setQrDataUrl).catch(console.error);
    }
  }, [guestIssueUrl]);

  // When a ticket is issued on this tablet, generate its personal tracker QR code
  useEffect(() => {
    if (issuedTicket && queueId) {
      const personalTicketUrl = `${baseUrl}/q/${queueId}/ticket/${issuedTicket.id}`;
      generateQrDataUrl(personalTicketUrl).then(setIssuedTicketQrUrl).catch(console.error);
    }
  }, [issuedTicket, queueId, baseUrl]);

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

  // Handle direct tablet ticket issuance with strict email verification
  const handleDirectIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId) return;

    if (summary?.queue.isClosed) {
      setInputError('현재 대기 접수가 마감되었습니다.');
      return;
    }

    if (!isValidEmail(emailInput)) {
      setInputError('올바른 이메일 주소를 입력해 주세요.');
      return;
    }

    setInputError('');
    setIssuing(true);

    try {
      const ticket = await queueRepository.issueTicket(queueId, emailInput);
      setIssuedTicket(ticket);
      setEmailInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '대기 번호표 발급에 실패했습니다.';
      setInputError(msg);
    } finally {
      setIssuing(false);
    }
  };

  const handleBackToMain = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <MobileContainer theme="dark">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-400 font-medium text-sm">대기열 정보를 불러오는 중...</p>
          </div>
        </div>
      </MobileContainer>
    );
  }

  if (error || !summary) {
    return (
      <MobileContainer theme="dark">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold mb-2">대기열을 찾을 수 없습니다</h2>
          <p className="text-slate-400 text-sm mb-6">{error || '유효하지 않은 대기열 코드입니다.'}</p>
          <Button variant="secondary" onClick={handleBackToMain}>
            메인 페이지로 돌아가기
          </Button>
        </div>
      </MobileContainer>
    );
  }

  const { queue, waitingCount } = summary;
  const isEmailValid = isValidEmail(emailInput);

  // Calculate stats for newly issued ticket
  const myTicketNumber = issuedTicket?.ticketNumber || 0;
  const waitingAhead = issuedTicket ? Math.max(0, myTicketNumber - queue.currentServingNumber - 1) : 0;
  const waitingBehind = issuedTicket ? Math.max(0, waitingCount - waitingAhead - 1) : 0;

  return (
    <MobileContainer theme="dark">
      {/* Top Header: Safe Back Button & Live Status Pill */}
      <header className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md">
        <button
          onClick={handleBackToMain}
          className="p-1.5 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
          title="메인 화면으로 나가기 (관리자 접근 차단)"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>메인으로</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          현장 손님용 화면
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-4 py-5 flex-1 flex flex-col justify-between space-y-5">
        {/* 1. STORE TITLE & DESCRIPTION (Prominently displayed) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 text-center shadow-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-bold mb-2">
            실시간 대기열
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-snug">
            {queue.name}
          </h1>

          {/* Description Section */}
          {queue.description ? (
            <div className="mt-3 p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 leading-relaxed text-left flex items-start gap-2">
              <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <span>{queue.description}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1.5">
              순번이 되면 이메일로 호출 안내를 드립니다.
            </p>
          )}

          {queue.isClosed && (
            <div className="mt-3 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold inline-block">
              현재 대기 접수가 마감되었습니다.
            </div>
          )}
        </div>

        {/* 2. LIVE METRICS (Serving Number & Waiting Count) */}
        <div className="grid grid-cols-2 gap-3 text-center">
          {/* Current Serving Number */}
          <div className="bg-slate-900/90 border-2 border-brand-500/40 rounded-3xl p-4 shadow-lg flex flex-col justify-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              현재 입장 번호
            </span>
            <div className="text-4xl font-black text-white mt-1">
              {queue.currentServingNumber > 0 ? (
                <span className="text-brand-400">#{queue.currentServingNumber}</span>
              ) : (
                <span className="text-slate-500 text-2xl font-bold">대기중</span>
              )}
            </div>
          </div>

          {/* Waiting Count */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col justify-center">
            <div className="flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                현재 대기 인원
              </span>
            </div>
            <div className="text-4xl font-extrabold text-amber-400 mt-1">
              {waitingCount} <span className="text-lg font-bold text-slate-400">팀</span>
            </div>
          </div>
        </div>

        {/* 3. QR CODE SECTION FOR MOBILE PASSENGERS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 text-center shadow-lg flex flex-col items-center">
          <div className="p-3 bg-white rounded-2xl shadow-md inline-block">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="대기열 접수 QR 코드"
                className="w-40 h-40 object-contain"
              />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center text-slate-400">
                <QrCode className="w-10 h-10 animate-pulse" />
              </div>
            )}
          </div>
          <p className="text-xs font-bold text-slate-300 mt-2.5 flex items-center justify-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-brand-400" />
            스마트폰 카메라로 스캔하여 번호표 뽑기
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            스마트폰에서 실시간 순번을 편하게 확인하세요
          </p>
        </div>

        {/* 4. DIRECT ON-SCREEN ISSUANCE FORM */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
          <div className="text-left">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-brand-400" />
              현장에서 바로 번호표 뽑기
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              호출 안내를 받을 이메일을 정확히 입력해 주세요. (필수)
            </p>
          </div>

          <form onSubmit={handleDirectIssue} className="space-y-3">
            <EmailInput
              value={emailInput}
              onChange={setEmailInput}
              disabled={queue.isClosed || issuing}
              placeholder="호출 안내받을 이메일 주소 입력"
              theme="dark"
              errorMessage={inputError}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={queue.isClosed || issuing || !isEmailValid}
              className="gap-2 text-sm font-extrabold shadow-lg shadow-brand-500/20"
            >
              <BellRing className="w-4 h-4" />
              {queue.isClosed 
                ? '접수 마감됨' 
                : issuing 
                ? '발급 처리 중...' 
                : isEmailValid 
                ? '번호표 뽑기' 
                : '이메일을 입력해 주세요'}
            </Button>
          </form>
        </div>
      </main>

      {/* 5. NEWLY ISSUED TICKET MODAL WITH ALL WAIT METRICS */}
      <Modal
        isOpen={Boolean(issuedTicket)}
        onClose={() => setIssuedTicket(null)}
        title="대기표 발급 완료"
      >
        {issuedTicket && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              {issuedTicket.isExisting && (
                <div className="mb-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                  ℹ️ 이미 접수된 대기표가 있어 기존 순번을 불러왔습니다.
                </div>
              )}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                고객님의 대기 번호
              </span>
              <div className="text-5xl font-black text-slate-900 mt-1">
                #{issuedTicket.ticketNumber}번
              </div>
              <p className="text-xs text-slate-500 mt-1">
                등록된 이메일로 호출 시 안내가 전송됩니다.
              </p>
            </div>

            {/* Wait Status 3-box Grid: Current Serving / Ahead / Behind */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">현재 호출</span>
                <span className="text-lg font-black text-slate-800 mt-0.5 block">
                  #{queue.currentServingNumber > 0 ? queue.currentServingNumber : 0}
                </span>
              </div>

              <div className="bg-brand-50 rounded-2xl p-2.5 border border-brand-100">
                <span className="text-[10px] font-bold text-brand-600 uppercase block">내 앞 대기</span>
                <span className="text-lg font-black text-brand-600 mt-0.5 block">
                  {waitingAhead}팀
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">내 뒤 대기</span>
                <span className="text-lg font-black text-slate-700 mt-0.5 block">
                  {waitingBehind}팀
                </span>
              </div>
            </div>

            {/* Expected Wait Time */}
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">예상 대기 시간</span>
              <span className="font-extrabold text-slate-800">
                {waitingAhead === 0 ? (
                  <span className="text-brand-600">곧 입장 차례입니다</span>
                ) : (
                  <span>
                    약 <strong className="text-brand-600 text-sm">{waitingAhead * (summary?.avgWaitTimeMinutes || 3)}분</strong>
                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                      (평균 {summary?.avgWaitTimeMinutes || 3}분/팀)
                    </span>
                  </span>
                )}
              </span>
            </div>

            {/* Smartphone Live Tracking QR */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex items-center gap-3 text-left">
              <div className="p-1.5 bg-white rounded-xl border border-slate-200 shrink-0">
                {issuedTicketQrUrl && (
                  <img
                    src={issuedTicketQrUrl}
                    alt="내 순번 QR"
                    className="w-16 h-16 object-contain"
                  />
                )}
              </div>
              <div className="flex-1 text-xs text-slate-600">
                <p className="font-bold text-slate-900 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-brand-500" />
                  스마트폰으로 실시간 확인
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  카메라로 스캔하시면 이동 중에도 내 순번 변화를 보실 수 있습니다.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              onClick={() => setIssuedTicket(null)}
              className="mt-2 font-bold"
            >
              확인 (닫기)
            </Button>
          </div>
        )}
      </Modal>

      {/* Footer Notice */}
      <footer className="py-3 px-4 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
        JullSir 현장 손님용 디스플레이 • 뒤로가기를 누르면 메인 화면으로 돌아갑니다.
      </footer>
    </MobileContainer>
  );
};
