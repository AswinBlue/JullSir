import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { queueRepository } from '../services/storage/mockQueueRepository';
import { generateQrDataUrl } from '../utils/qr';
import { MobileContainer } from '../components/common/MobileContainer';
import { EmailInput, isValidEmail } from '../components/common/EmailInput';
import { Button } from '../components/common/Button';
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
  const [issuedTicketNumber, setIssuedTicketNumber] = useState<number | null>(null);
  const [inputError, setInputError] = useState('');

  // Mobile queue issue URL (for QR code)
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const guestIssueUrl = queueId ? `${baseUrl}/q/${queueId}` : '';

  useEffect(() => {
    if (guestIssueUrl) {
      generateQrDataUrl(guestIssueUrl).then(setQrDataUrl).catch(console.error);
    }
  }, [guestIssueUrl]);

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
      setIssuedTicketNumber(ticket.ticketNumber);
      setEmailInput('');

      // Auto clear success notice after 7 seconds
      setTimeout(() => {
        setIssuedTicketNumber(null);
      }, 7000);
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
        {/* Success Alert Banner when issued on this tablet */}
        {issuedTicketNumber && (
          <div className="p-4 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400/50 text-emerald-200 text-center animate-slideUp">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-base font-bold">
              대기번호 <span className="text-white text-2xl font-black underline underline-offset-4">#{issuedTicketNumber}</span>번 접수 완료!
            </p>
            <p className="text-xs text-emerald-300 mt-1">
              입력하신 이메일로 호출 시 안내 메일이 발송됩니다.
            </p>
          </div>
        )}

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

        {/* 3. QR CODE SECTION */}
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

        {/* 4. DIRECT ON-SCREEN ISSUANCE FORM (Requires valid email) */}
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

      {/* Footer Notice */}
      <footer className="py-3 px-4 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
        JullSir 현장 손님용 디스플레이 • 뒤로가기를 누르면 메인 화면으로 돌아갑니다.
      </footer>
    </MobileContainer>
  );
};
