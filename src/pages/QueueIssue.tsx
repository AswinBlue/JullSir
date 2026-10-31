import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueue } from '../hooks/useQueue';
import { queueRepository } from '../services/storage';
import { MobileContainer } from '../components/common/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { soundManager } from '../utils/sound';
import { 
  Users, 
  AlertCircle, 
  Info,
  Ticket
} from 'lucide-react';

export const QueueIssue: React.FC = () => {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { summary, loading, error } = useQueue(queueId);

  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');

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

  const handleIssueTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueId) return;

    if (summary?.queue.isClosed) {
      setIssueError('현재 대기열 접수가 마감되었습니다.');
      return;
    }

    setIssueError('');
    setIssuing(true);

    try {
      const ticket = await queueRepository.issueTicket(queueId);

      // Save ticket id to local storage for quick access
      localStorage.setItem(`jullsir_my_ticket_${queueId}`, ticket.id);

      navigate(`/q/${queueId}/ticket/${ticket.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '순번표 발급에 실패했습니다.';
      setIssueError(msg);
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm font-medium">대기열 정보를 불러오는 중...</p>
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
          <h2 className="text-xl font-bold text-slate-900 mb-1">대기열을 찾을 수 없습니다</h2>
          <p className="text-slate-500 text-sm mb-6">{error || '유효하지 않은 대기열 코드입니다.'}</p>
          <Button onClick={() => navigate('/')}>메인으로 이동</Button>
        </div>
      </MobileContainer>
    );
  }

  const { queue, waitingCount } = summary;

  return (
    <MobileContainer>
      <Header title={queue.name} showBack backTo="/" />

      <main className="px-5 py-6 flex-1 flex flex-col justify-between space-y-5">
        <div className="space-y-5">
          {/* 1. Store Title & Description Banner */}
          <div className="text-center bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block mb-1">
              실시간 온라인 대기표
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {queue.name}
            </h2>

            {queue.description ? (
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 text-left flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                <span>{queue.description}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">순번이 되면 이메일로 호출 안내를 드립니다.</p>
            )}
          </div>

          {/* 2. Current Wait Metric Card */}
          <Card className="p-5 text-center bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/20 border-0">
            <span className="text-xs font-semibold text-brand-100 uppercase tracking-wider block">
              현재 내 앞 대기 인원
            </span>
            <div className="text-5xl font-black mt-1 tracking-tight">
              {waitingCount} <span className="text-2xl font-bold text-brand-100">팀</span>
            </div>
            <p className="text-xs text-brand-100 mt-2 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" />
              현재 호출 번호: #{queue.currentServingNumber > 0 ? queue.currentServingNumber : 0}번
            </p>
          </Card>

          {/* 3. Closed Notice or Ticket Issuance Form */}
          {queue.isClosed ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-center text-rose-800 space-y-1">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-1" />
              <h3 className="text-sm font-bold">대기 접수가 마감되었습니다</h3>
              <p className="text-xs text-rose-600">
                금일 대기열 접수가 종료되었거나 매장 사정으로 일시 중단되었습니다.
              </p>
            </div>
          ) : (
            <Card elevated className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-bold">
                  개인정보 수집 0건 (익명 발권)
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  원클릭 대기표 발권
                </h3>
                <p className="text-xs text-slate-500">
                  이메일이나 전화번호 입력 없이 바로 번호표를 뽑을 수 있습니다.
                </p>
              </div>

              {issueError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
                  {issueError}
                </div>
              )}

              <form onSubmit={handleIssueTicket} className="space-y-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  fullWidth
                  disabled={issuing}
                  className="font-extrabold text-base shadow-lg shadow-brand-500/25 mt-2 gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  {issuing ? '순번표 발급 중...' : '대기 번호표 뽑기'}
                </Button>
              </form>
            </Card>
          )}
        </div>

        {/* Bottom Notice */}
        <div className="mt-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <Info className="w-3.5 h-3.5" />
          발급 후 창을 닫아도 URL을 통해 언제든 순번 조회가 가능합니다.
        </div>
      </main>
    </MobileContainer>
  );
};
