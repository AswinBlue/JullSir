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
  const [partySize, setPartySize] = useState<number>(2);

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
    soundManager.unlockAudio();
    if (!queueId) return;

    if (summary?.queue.isClosed) {
      setIssueError('현재 대기열 접수가 마감되었습니다.');
      return;
    }

    setIssueError('');
    setIssuing(true);

    try {
      const ticket = await queueRepository.issueTicket(queueId, partySize);

      // Save ticket id to local storage for quick access
      localStorage.setItem(`jullsir_my_ticket_${queueId}`, ticket.id);

      navigate(`/q/${queueId}/ticket/${ticket.id}`, { state: { initialTicket: ticket } });
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
                <div className="max-h-32 overflow-y-auto flex-1 whitespace-pre-wrap break-words">
                  {queue.description}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">순번이 되면 화면과 알림으로 안내해 드립니다.</p>
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
                <h3 className="text-base font-extrabold text-slate-900">
                  대기 번호표 발급
                </h3>
                <p className="text-xs text-slate-500">
                  인원수를 선택하고 버튼을 누르면 순번표가 발급됩니다.
                </p>
              </div>

              {issueError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">
                  {issueError}
                </div>
              )}

              <form onSubmit={handleIssueTicket} className="space-y-4">
                {/* Party Size Selector */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-brand-600" />
                      방문 / 대기 인원
                    </span>
                    <span className="text-sm font-black text-brand-600">{partySize}명</span>
                  </div>

                  {/* Stepper */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.unlockAudio();
                        setPartySize(prev => Math.max(1, prev - 1));
                      }}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-lg flex items-center justify-center hover:bg-slate-100 active:scale-95 transition shadow-sm"
                    >
                      -
                    </button>
                    <div className="px-6 py-2 bg-white rounded-xl border border-brand-200 text-xl font-black text-slate-900 min-w-[80px] text-center shadow-inner">
                      {partySize}명
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.unlockAudio();
                        setPartySize(prev => Math.min(99, prev + 1));
                      }}
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-lg flex items-center justify-center hover:bg-slate-100 active:scale-95 transition shadow-sm"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Select Presets */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          soundManager.unlockAudio();
                          setPartySize(num);
                        }}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                          partySize === num
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {`${num}명`}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  fullWidth
                  disabled={issuing}
                  className="font-extrabold text-base shadow-lg shadow-brand-500/25 mt-2 gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  {issuing ? '순번표 발급 중...' : `${partySize}명 대기 번호표 뽑기`}
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
