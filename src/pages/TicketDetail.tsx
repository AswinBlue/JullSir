import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useTicket } from '../hooks/useTicket';
import { MobileContainer } from '../components/common/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  BellRing
} from 'lucide-react';

export const TicketDetail: React.FC = () => {
  const { queueId, ticketId } = useParams<{ queueId: string; ticketId: string }>();
  const navigate = useNavigate();
  const { ticket, queue, waitingAhead, isMyTurn, loading, error, cancel, refresh } = useTicket(ticketId);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

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
    <MobileContainer theme={isMyTurn ? 'dark' : 'light'}>
      {/* Top Header */}
      <Header
        title={queue.name}
        showBack
        backTo={queueId ? `/q/${queueId}` : '/'}
        rightElement={
          <button
            onClick={refresh}
            className={`p-2 rounded-xl transition-all active:scale-95 flex items-center gap-1 text-xs font-bold ${
              isMyTurn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        }
      />

      <main className="px-5 py-6 flex-1 flex flex-col justify-between">
        <div className="space-y-6">
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
              <span className="text-xs font-bold text-brand-600 uppercase tracking-wider block">
                {queue.name}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
                실시간 대기 현황
              </h2>
              <p className="text-xs text-slate-400 mt-1">창을 닫아도 실시간으로 순번이 업데이트됩니다</p>
            </div>
          )}

          {/* Big Number Card */}
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
              {ticket.email && (
                <span className="text-xs text-slate-400 truncate max-w-[150px]">
                  {ticket.email}
                </span>
              )}
            </div>

            {/* Waiting Ahead Stats */}
            {ticket.status === 'WAITING' && !isMyTurn && (
              <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">현재 호출 번호</span>
                  <span className="text-2xl font-extrabold text-slate-800 mt-0.5 block">
                    #{queue.currentServingNumber > 0 ? queue.currentServingNumber : 0}
                  </span>
                </div>

                <div className="bg-brand-50 rounded-2xl p-3 text-center">
                  <span className="text-[11px] font-bold text-brand-600 block uppercase">내 앞 대기 팀</span>
                  <span className="text-2xl font-black text-brand-600 mt-0.5 block">
                    {waitingAhead} <span className="text-xs font-bold">팀</span>
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Helpful Tips / Notification Test */}
          {ticket.status === 'WAITING' && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <BellRing className="w-4 h-4 text-brand-500" />
                호출 시 진동과 소리로 안내됩니다
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                매장 근처에서 대기해 주시고, 화면이 초록색으로 바뀌며 진동이 울리면 즉시 매장으로 입장해 주세요.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions (Cancel Ticket) */}
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
              className={isMyTurn ? 'bg-white text-emerald-800 hover:bg-emerald-50 font-bold' : ''}
            >
              새로 번호표 뽑기
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
    </MobileContainer>
  );
};
