import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminQueue } from '../hooks/useQueue';
import { queueRepository } from '../services/storage';
import { generateQrDataUrl, downloadQrImage } from '../utils/qr';
import { MobileContainer } from '../components/common/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  Users, 
  Megaphone, 
  SkipForward, 
  CheckCircle, 
  Lock, 
  Unlock, 
  QrCode, 
  Monitor, 
  Edit3, 
  AlertCircle,
  Clock,
  Download,
  ExternalLink,
  HelpCircle,
  BellRing,
  Trash2,
  RefreshCw
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { adminToken } = useParams<{ adminToken: string }>();
  const navigate = useNavigate();
  const { summary, loading, error, refresh } = useAdminQueue(adminToken);

  // Edit Queue Info Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // QR Code Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Session Info Modal
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [remainingTimeText, setRemainingTimeText] = useState('');
  const [remainingMs, setRemainingMs] = useState<number>(6 * 60 * 60 * 1000);
  const [extendingSession, setExtendingSession] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Host Action State
  const [calling, setCalling] = useState(false);
  const [callingTicketId, setCallingTicketId] = useState<string | null>(null);
  const [recalling, setRecalling] = useState(false);
  const [actionError, setActionError] = useState('');

  // Close & Purge Modal (End of Day)
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  // URLs
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const displayUrl = summary ? `${baseUrl}/display/${summary.queue.id}` : '';
  const guestIssueUrl = summary ? `${baseUrl}/q/${summary.queue.id}` : '';

  useEffect(() => {
    if (summary) {
      setEditName(summary.queue.name);
      setEditDescription(summary.queue.description || '');
      if (guestIssueUrl) {
        generateQrDataUrl(guestIssueUrl).then(setQrDataUrl).catch(console.error);
      }
    }
  }, [summary, guestIssueUrl]);

  // Touch session on mount & calculate remaining session time
  useEffect(() => {
    if (adminToken) {
      queueRepository.touchQueueSession(adminToken).catch(console.error);
    }
  }, [adminToken]);

  // Update remaining session time every 30 seconds
  useEffect(() => {
    if (!summary?.queue.expiresAt) return;

    const updateRemaining = () => {
      const expiresAtMs = new Date(summary.queue.expiresAt!).getTime();
      const diffMs = expiresAtMs - Date.now();
      setRemainingMs(diffMs);

      if (diffMs <= 0) {
        setRemainingTimeText('세션 만료됨 (대기열 자동 정리)');
        refresh();
      } else {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        setRemainingTimeText(`${hours}시간 ${minutes}분 뒤 자동 중지`);
      }
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 30000);
    return () => clearInterval(timer);
  }, [summary?.queue.expiresAt, refresh]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleExtendSession = async () => {
    if (!adminToken || extendingSession) return;
    setExtendingSession(true);
    try {
      await queueRepository.touchQueueSession(adminToken);
      await refresh();
      showToast('세션이 6시간으로 재갱신되었습니다.');
    } catch {
      showToast('세션 갱신에 실패했습니다.');
    } finally {
      setExtendingSession(false);
    }
  };

  // Call Next Ticket
  const handleCallNext = async () => {
    if (!adminToken) return;
    setActionError('');
    setCalling(true);
    try {
      const nextTicket = await queueRepository.callNextTicket(adminToken);
      if (!nextTicket) {
        setActionError('현재 대기 중인 손님이 없습니다.');
      } else {
        await refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '호출 중 오류가 발생했습니다.';
      setActionError(msg);
    } finally {
      setCalling(false);
    }
  };

  // N-2: Recall Current Ticket
  const handleRecallCurrent = async () => {
    if (!adminToken) return;
    setActionError('');
    setRecalling(true);
    try {
      const recalled = await queueRepository.reCallCurrentTicket(adminToken);
      if (!recalled) {
        setActionError('현재 호출 중인 티켓이 없습니다.');
      } else {
        await refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '재호출 중 오류가 발생했습니다.';
      setActionError(msg);
    } finally {
      setRecalling(false);
    }
  };

  // N-4: Close & Purge Queue Permanently (End of day)
  const handleCloseAndPurge = async () => {
    if (!adminToken) return;
    setPurging(true);
    try {
      await queueRepository.closeAndPurgeQueue(adminToken);
      setIsPurgeModalOpen(false);
      navigate('/');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '영업 종료 처리 실패');
      setPurging(false);
    }
  };

  // Call Specific Ticket (Out-of-order)
  const handleCallSpecificTicket = async (ticketId: string) => {
    if (!adminToken) return;
    setCallingTicketId(ticketId);
    setActionError('');
    try {
      await queueRepository.callSpecificTicket(adminToken, ticketId);
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '호출 중 오류가 발생했습니다.';
      setActionError(msg);
    } finally {
      setCallingTicketId(null);
    }
  };

  // Skip Ticket
  const handleSkipTicket = async (ticketId: string) => {
    if (!adminToken) return;
    try {
      await queueRepository.skipTicket(adminToken, ticketId);
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '스킵 처리 실패');
    }
  };

  // Complete Ticket
  const handleCompleteTicket = async (ticketId: string) => {
    if (!adminToken) return;
    try {
      await queueRepository.completeTicket(adminToken, ticketId);
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '완료 처리 실패');
    }
  };

  // Toggle Closed / Open Status
  const handleToggleStatus = async () => {
    if (!adminToken || !summary) return;
    try {
      await queueRepository.toggleQueueStatus(adminToken, !summary.queue.isClosed);
      await refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '상태 변경 실패');
    }
  };

  // Save Title / Description Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !editName.trim()) return;
    if (editName.trim().length > 50) {
      alert('대기열 이름은 50자 이내로 입력해 주세요.');
      return;
    }
    if (editDescription.trim().length > 500) {
      alert('손님 안내 사항은 500자 이내로 입력해 주세요.');
      return;
    }
    setSavingEdit(true);
    try {
      await queueRepository.updateQueueInfo(adminToken, editName, editDescription);
      setIsEditModalOpen(false);
      await refresh();
      showToast('대기열 정보가 수정되었습니다.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '수정 실패');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">관리자 정보를 불러오는 중...</p>
          </div>
        </div>
      </MobileContainer>
    );
  }

  if (error || !summary) {
    return (
      <MobileContainer>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
          <h2 className="text-xl font-bold text-slate-900 mb-1">관리자 접근 실패</h2>
          <p className="text-slate-500 text-sm mb-6">{error || '올바르지 않은 관리자 토큰입니다.'}</p>
          <Button onClick={() => navigate('/')}>메인으로 이동</Button>
        </div>
      </MobileContainer>
    );
  }

  const { queue, waitingCount, recentTickets, nextTicket } = summary;

  return (
    <MobileContainer>
      {/* Top Admin Header */}
      <Header
        title={queue.name}
        showBack
        backTo="/"
        rightElement={
          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0 border border-slate-200"
              title="현장용 QR 코드"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>QR 코드</span>
            </button>
            <button
              onClick={() => window.open(displayUrl, '_blank')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 active:scale-95 transition-all flex items-center gap-1 text-xs font-bold whitespace-nowrap shrink-0 border border-brand-200"
              title="손님용 디스플레이 열기"
            >
              <Monitor className="w-3.5 h-3.5 text-brand-600" />
              <span>손님용 화면</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        }
      />

      <main className="px-4 py-5 space-y-5 flex-1 relative">
        {/* Floating Auto-dismiss Toast */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-2 animate-bounce">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Session Expiration Banner */}
        {remainingTimeText && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{remainingTimeText}</span>
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(true)}
                className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                title="대기열 자동 정리 안내"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
            {remainingMs < 3 * 60 * 60 * 1000 && remainingMs > 0 && (
              <button
                type="button"
                disabled={extendingSession}
                onClick={handleExtendSession}
                className="text-[11px] text-brand-600 hover:text-brand-700 font-bold underline disabled:opacity-50 flex items-center gap-1 active:scale-95 transition-all"
              >
                {extendingSession ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>재갱신 중...</span>
                  </>
                ) : (
                  <span>세션 6시간 재갱신</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Title & Info Card (with Edit Button) */}
        <Card className="p-4 bg-white border border-slate-200 shadow-sm space-y-2.5">
          {/* Top Row: Badges and Action Buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                Admin Host
              </span>
              {queue.isClosed ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <Lock className="w-3 h-3" /> 마감됨
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <Unlock className="w-3 h-3" /> 접수 중
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>수정</span>
              </button>
              <button
                onClick={handleToggleStatus}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                  queue.isClosed 
                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' 
                    : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                }`}
              >
                {queue.isClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{queue.isClosed ? '접수 재개' : '접수 마감'}</span>
              </button>
            </div>
          </div>

          {/* Middle Row: Title with max size limitation & ellipsis */}
          <div className="min-w-0">
            <h2 
              className="text-lg font-black text-slate-900 line-clamp-2 break-all break-keep leading-snug"
              title={queue.name}
            >
              {queue.name}
            </h2>
          </div>

          {/* Bottom Row: Description with max height and scrollable textbox */}
          {queue.description ? (
            <div className="max-h-28 overflow-y-auto p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
              {queue.description}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">등록된 손님 안내사항이 없습니다.</p>
          )}
        </Card>

        {/* Live Metric Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center bg-white border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">대기 중</span>
            <span className="text-2xl sm:text-3xl font-black text-brand-600 mt-0.5 block">
              {waitingCount} <span className="text-xs font-bold text-slate-400">팀</span>
            </span>
          </Card>

          <Card className="p-4 text-center bg-white border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">현재 호출</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 block">
              {queue.currentServingNumber > 0 ? `#${queue.currentServingNumber}` : '-'}
            </span>
          </Card>

          <Card className="p-4 text-center bg-white border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 block uppercase">총 발급</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-700 mt-0.5 block">
              #{queue.lastIssuedNumber}
            </span>
          </Card>
        </div>

        {/* Primary Call Action Panel */}
        <Card elevated className="p-6 bg-gradient-to-br from-white to-slate-50 border-2 border-brand-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold text-brand-600 uppercase tracking-wider block">
                Next In Line
              </span>
              <h3 className="text-lg font-black text-slate-900">
                다음 대기 순번: {nextTicket ? (
                  <span className="text-brand-500 font-black">
                    #{nextTicket.ticketNumber}번
                    <span className="text-sm font-bold text-slate-500 ml-1.5">({nextTicket.partySize || 1}명)</span>
                  </span>
                ) : (
                  <span className="text-slate-400 text-sm font-medium">대기자 없음</span>
                )}
              </h3>
            </div>
          </div>

          {actionError && (
            <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Primary Large Call Button */}
            <Button
              variant="primary"
              size="xl"
              onClick={handleCallNext}
              disabled={calling || waitingCount === 0}
              className="sm:col-span-2 shadow-lg shadow-brand-500/25 gap-2 text-base font-extrabold whitespace-nowrap break-keep"
            >
              <Megaphone className="w-5 h-5 shrink-0 animate-bounce" />
              <span className="whitespace-nowrap break-keep">
                {calling ? '호출 전송 중...' : '다음 번호 호출'}
              </span>
            </Button>

            {/* Skip Button for Current Number */}
            <Button
              variant="outline"
              size="lg"
              disabled={!nextTicket}
              onClick={() => nextTicket && handleSkipTicket(nextTicket.id)}
              className="gap-2 font-bold text-slate-700 hover:text-slate-900 whitespace-nowrap break-keep"
            >
              <SkipForward className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="whitespace-nowrap break-keep">현재 번호 스킵</span>
            </Button>
          </div>

          {/* N-2: 현재 번호 재호출 (다시 알림) */}
          {queue.currentServingNumber > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                현재 호출 중인 번호: <strong className="text-slate-900">#{queue.currentServingNumber}번</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={recalling}
                onClick={handleRecallCurrent}
                className="gap-1.5 font-bold text-brand-600 border-brand-200 hover:bg-brand-50 text-xs whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 text-brand-600 animate-pulse shrink-0" />
                <span className="whitespace-nowrap">{recalling ? '호출 중...' : '재호출 (다시 알림)'}</span>
              </Button>
            </div>
          )}

          <p className="text-[11px] text-slate-400 text-center mt-3">
            호출 시 손님 기기 화면이 실시간 전환되고 차임벨 소리와 진동/알림이 즉시 전송됩니다.
          </p>
        </Card>

        {/* Ticket List & Realtime Attendance Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              최근 대기열 현황 ({recentTickets.length}명)
            </h3>
            <button
              onClick={refresh}
              className="text-xs font-semibold text-brand-600 hover:underline"
            >
              새로고침
            </button>
          </div>

          {recentTickets.length === 0 ? (
            <Card className="p-8 text-center text-slate-400 bg-white">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">아직 발급된 대기표가 없습니다.</p>
              <p className="text-xs mt-1">손님용 디스플레이나 QR 코드를 통해 번호표를 발급해 보세요.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((t) => (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    t.status === 'CALLED'
                      ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                      : t.status === 'WAITING'
                      ? 'border-slate-200'
                      : 'border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-900 text-base shrink-0">
                      #{t.ticketNumber}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge status={t.status} />
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {t.partySize || 1}명
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">
                        접수: {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {t.calledAt && ` • 호출: ${new Date(t.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions per ticket */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto">
                    {t.status === 'CALLED' && (
                      <button
                        onClick={() => handleCompleteTicket(t.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors whitespace-nowrap active:scale-95"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>입장 완료</span>
                      </button>
                    )}
                    {t.status === 'WAITING' && (
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <button
                          type="button"
                          disabled={callingTicketId === t.id}
                          onClick={() => handleCallSpecificTicket(t.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all whitespace-nowrap"
                          title="해당 번호 즉시 호출"
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          <span>{callingTicketId === t.id ? '호출 중...' : '호출하기'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSkipTicket(t.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 active:scale-95 transition-all whitespace-nowrap"
                          title="해당 번호 건너뛰기"
                        >
                          스킵하기
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* N-4: 점주 영업 종료 및 즉시 정리 섹션 */}
        <div className="pt-4 border-t border-slate-100 flex justify-center pb-6">
          <button
            type="button"
            onClick={() => setIsPurgeModalOpen(true)}
            className="text-xs text-slate-400 hover:text-rose-600 font-medium flex items-center gap-1.5 p-2 rounded-xl hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            오늘 영업 종료 및 대기열 즉시 정리
          </button>
        </div>
      </main>

      {/* Edit Title / Description Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="대기열 정보 수정"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                대기열 / 매장 이름 <span className="text-brand-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">{editName.length}/50</span>
            </div>
            <input
              type="text"
              required
              maxLength={50}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                손님 안내 사항 (선택)
              </label>
              <span className="text-[10px] text-slate-400 font-medium">{editDescription.length}/500</span>
            </div>
            <textarea
              rows={4}
              maxLength={500}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="손님용 화면 및 발급 화면에 표시될 공지사항"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 mt-1 text-right">최대 500자 (줄바꿈 지원)</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsEditModalOpen(false)}
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={savingEdit || !editName.trim()}
            >
              {savingEdit ? '저장 중...' : '수정 완료'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Session Expiration Help Modal */}
      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title="대기열 자동 정리 안내"
      >
        <div className="space-y-4 text-xs text-slate-600 leading-relaxed text-left">
          <div className="p-3.5 bg-brand-50 border border-brand-100 rounded-2xl text-slate-800 space-y-1.5">
            <p className="font-bold text-sm text-brand-700">🔒 세션 보존 및 자동 정리 정책</p>
            <p>
              대기열 데이터는 관리자가 <strong>6시간 이상 페이지를 열어두지 않을 경우</strong> 안전하게 자동 정리됩니다.
            </p>
          </div>

          <div className="space-y-2 text-slate-600">
            <p>
              • <strong>입장 완료/취소 즉시 정리:</strong> 손님의 입장이 완료되거나 취소되면 대기열 목록에서 바로 정리됩니다.<br />
              • <strong>활동 시 세션 자동 유지:</strong> 관리자 대시보드 화면을 열어두고 이용하시면 세션이 지속 유지됩니다.<br />
              • <strong>세션 재갱신:</strong> 남은 시간이 3시간 미만일 때 상단의 <code>세션 6시간 재갱신</code> 버튼으로 6시간 재갱신이 가능합니다.<br />
              • <strong>영업 종료 즉시 정리:</strong> 하단의 <code>오늘 영업 종료 및 대기열 즉시 정리</code>를 누르면 즉시 모든 대기열 데이터가 완전히 정리됩니다.
            </p>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={() => setIsSessionModalOpen(false)}
          >
            확인
          </Button>
        </div>
      </Modal>

      {/* N-4: Confirm Purge Modal */}
      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => !purging && setIsPurgeModalOpen(false)}
        title="오늘 영업 종료 및 대기열 정리"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-900">대기열 데이터를 모두 정리할까요?</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              오늘의 대기열과 접수된 모든 손님의 대기 정보가 영구 정리되며, 손님 화면에도 대기열 종료가 즉시 반영됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={purging}
              onClick={() => setIsPurgeModalOpen(false)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              className="flex-1 font-bold"
              disabled={purging}
              onClick={handleCloseAndPurge}
            >
              {purging ? '정리 중...' : '영업 종료 및 데이터 파기'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Printable QR Code Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="매장 비치용 QR 코드"
      >
        <div className="text-center space-y-4">
          <p className="text-xs text-slate-500">
            이 QR 코드를 인쇄하여 매장 입구에 부착하면 손님들이 직접 스마트폰으로 번호표를 뽑을 수 있습니다.
          </p>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 inline-block shadow-sm">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="대기열 QR"
                className="w-48 h-48 mx-auto object-contain"
              />
            )}
            <p className="text-xs font-bold text-slate-800 mt-2">{queue.name}</p>
            <p className="text-[10px] text-slate-400">카메라로 비추면 바로 줄서기</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => qrDataUrl && downloadQrImage(qrDataUrl, `${queue.name}-QR.png`)}
            >
              <Download className="w-4 h-4" />
              이미지 다운로드
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => window.print()}
            >
              인쇄하기
            </Button>
          </div>
        </div>
      </Modal>
    </MobileContainer>
  );
};
