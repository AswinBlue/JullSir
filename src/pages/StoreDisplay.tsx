import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { queueRepository } from '../services/storage/mockQueueRepository';
import { generateQrDataUrl } from '../utils/qr';
import { Button } from '../components/common/Button';
import { 
  Users, 
  ArrowLeft, 
  BellRing, 
  CheckCircle2, 
  QrCode, 
  Mail,
  AlertCircle
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

  // Handle direct tablet ticket issuance
  const handleDirectIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId) return;

    if (summary?.queue.isClosed) {
      setInputError('현재 대기 접수가 마감되었습니다.');
      return;
    }

    setInputError('');
    setIssuing(true);

    try {
      const ticket = await queueRepository.issueTicket(queueId, emailInput);
      setIssuedTicketNumber(ticket.ticketNumber);
      setEmailInput('');

      // Auto clear success notice after 6 seconds
      setTimeout(() => {
        setIssuedTicketNumber(null);
      }, 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '대기 번호표 발급에 실패했습니다.';
      setInputError(msg);
    } finally {
      setIssuing(false);
    }
  };

  // Strictly return to Main page without any admin access
  const handleBackToMain = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium">대기열 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">대기열을 찾을 수 없습니다</h2>
        <p className="text-slate-400 text-sm mb-6">{error || '유효하지 않은 대기열 코드입니다.'}</p>
        <Button variant="secondary" onClick={handleBackToMain}>
          메인 페이지로 돌아가기
        </Button>
      </div>
    );
  }

  const { queue, waitingCount } = summary;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Bar for Display (Store Name & Safe Back Button) */}
      <header className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToMain}
            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="메인 화면으로 나가기 (관리자 접근 차단)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">메인으로</span>
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              {queue.name}
              {queue.isClosed && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold">
                  접수 마감
                </span>
              )}
            </h1>
            {queue.description && (
              <p className="text-xs text-slate-400 font-normal line-clamp-1">
                {queue.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          실시간 현장 디스플레이
        </div>
      </header>

      {/* Main Kiosk & Display Board */}
      <main className="max-w-4xl mx-auto w-full px-5 py-6 flex-1 flex flex-col justify-center">
        {/* Success Alert Banner when issued on this tablet */}
        {issuedTicketNumber && (
          <div className="mb-6 p-4 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400/50 text-emerald-200 text-center animate-slideUp">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-base font-bold">
              대기번호 <span className="text-white text-2xl font-black underline underline-offset-4">#{issuedTicketNumber}</span>번 접수 완료!
            </p>
            <p className="text-xs text-emerald-300 mt-1">
              입력하신 이메일로 호출 시 안내 메일이 발송됩니다.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Left Column: Live Status Metrics */}
          <div className="space-y-4">
            {/* Metric 1: Current Serving Number */}
            <div className="bg-slate-900/90 border-2 border-brand-500/40 rounded-3xl p-6 text-center shadow-xl shadow-brand-500/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-500/20 text-brand-300 px-3 py-1 rounded-bl-2xl text-xs font-bold uppercase tracking-wider">
                현재 입장 번호
              </div>
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase block mb-1">
                Now Serving
              </span>
              <div className="text-6xl sm:text-7xl font-black text-white tracking-tight">
                {queue.currentServingNumber > 0 ? (
                  <span className="text-brand-400">#{queue.currentServingNumber}</span>
                ) : (
                  <span className="text-slate-600 font-bold text-4xl">대기중</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                해당 번호의 고객님은 카운터로 와주세요
              </p>
            </div>

            {/* Metric 2: Waiting Count */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 text-center shadow-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  현재 대기 중인 인원
                </span>
              </div>
              <div className="text-5xl font-extrabold text-amber-400">
                {waitingCount} <span className="text-2xl font-bold text-slate-400">팀</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                총 발급: #{queue.lastIssuedNumber}번
              </p>
            </div>
          </div>

          {/* Right Column: QR Code + Direct On-screen Issuance Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center">
            {/* Large QR Code Section */}
            <div className="mb-4">
              <div className="p-3 bg-white rounded-2xl shadow-lg inline-block">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="대기열 접수 QR 코드"
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400">
                    <QrCode className="w-12 h-12 animate-pulse" />
                  </div>
                )}
              </div>
              <p className="text-xs font-bold text-slate-300 mt-2 flex items-center justify-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-brand-400" />
                스마트폰 카메라로 스캔하여 번호표 뽑기
              </p>
              <p className="text-[11px] text-slate-500">
                실시간 내 순번 확인 및 호출 알림 수신
              </p>
            </div>

            <div className="w-full flex items-center gap-3 my-2">
              <div className="h-px bg-slate-800 flex-1" />
              <span className="text-[11px] font-bold text-slate-500 uppercase">또는 현장에서 바로 접수</span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            {/* Direct Issuance Form on Tablet */}
            <form onSubmit={handleDirectIssue} className="w-full mt-2 space-y-2.5">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="호출 알림받을 이메일 주소 (선택)"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={queue.isClosed || issuing}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all disabled:opacity-50"
                />
              </div>

              {inputError && (
                <p className="text-xs text-rose-400 font-medium text-left">{inputError}</p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={queue.isClosed || issuing}
                className="gap-2 text-base font-bold"
              >
                <BellRing className="w-4 h-4" />
                {queue.isClosed ? '접수 마감됨' : issuing ? '발급 중...' : '현장 번호표 뽑기'}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 text-center text-xs text-slate-500 border-t border-slate-800/60">
        JullSir Kiosk Display • 뒤로가기를 누르면 메인 화면으로 돌아가며 관리자 화면은 접근되지 않습니다.
      </footer>
    </div>
  );
};
