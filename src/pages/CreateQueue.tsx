import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileContainer } from '../components/common/MobileContainer';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { queueRepository } from '../services/storage';
import { Queue } from '../types';
import { 
  Store, 
  Monitor, 
  Sliders, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export const CreateQueue: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdQueue, setCreatedQueue] = useState<Queue | null>(null);

  const [copiedDisplay, setCopiedDisplay] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('대기열 이름을 입력해 주세요.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const queue = await queueRepository.createQueue(name, description);
      setCreatedQueue(queue);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '대기열 생성에 실패했습니다.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Base domain & path resolution
  const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '');
  const displayUrl = createdQueue ? `${baseUrl}/display/${createdQueue.id}` : '';
  const adminUrl = createdQueue ? `${baseUrl}/admin/${createdQueue.adminToken}` : '';

  const copyToClipboard = async (text: string, type: 'display' | 'admin') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'display') {
        setCopiedDisplay(true);
        setTimeout(() => setCopiedDisplay(false), 2000);
      } else {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  return (
    <MobileContainer>
      <Header title="새 대기열 만들기" showBack backTo="/" />

      <main className="px-5 py-6 flex-1">
        {!createdQueue ? (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                대기열 만들기
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                매장이나 행사장의 이름을 입력하고 대기열을 바로 시작하세요.
              </p>
            </div>

            <Card elevated>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">
                    대기열 / 매장 이름 <span className="text-brand-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    placeholder="예: 맛있는 돈까스 본점, 팝업스토어"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1.5">
                    손님 안내 사항 (선택)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={200}
                    placeholder="예: 5인 이상 단체는 매장으로 문의해 주세요. 호출 후 5분 내 미입장 시 자동 취소됩니다."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none transition-all"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">최대 200자</p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-600 font-medium">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  disabled={loading || !name.trim()}
                >
                  {loading ? '생성 중...' : '대기열 즉시 생성하기'}
                </Button>
              </form>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 animate-slideUp">
            <div className="text-center">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Store className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                대기열이 생성되었습니다!
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                <span className="font-bold text-slate-800">{createdQueue.name}</span> 대기열 운영 링크입니다.
              </p>
            </div>

            {/* Screen 1: Store Display Screen */}
            <Card className="border-2 border-brand-200 bg-brand-50/20">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-500 text-white flex items-center justify-center">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">가게 디스플레이 손님용 화면</h3>
                    <p className="text-xs text-slate-500">매장 태블릿이나 모니터에 띄워둘 화면</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-2.5 border border-brand-100 flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-mono text-slate-600 truncate flex-1">{displayUrl}</span>
                <button
                  onClick={() => copyToClipboard(displayUrl, 'display')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 shrink-0 transition-colors"
                >
                  {copiedDisplay ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDisplay ? '복사됨' : '복사'}
                </button>
              </div>

              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => window.open(displayUrl, '_blank')}
                className="gap-2"
              >
                <Monitor className="w-4 h-4" />
                손님용 디스플레이 열기
                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
              </Button>
            </Card>

            {/* Screen 2: Admin Dashboard */}
            <Card className="border-2 border-slate-300">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">관리자 화면 (점주 전용)</h3>
                    <p className="text-xs text-slate-500">순번 호출, 스킵, 접수 마감 제어</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-mono text-slate-600 truncate flex-1">{adminUrl}</span>
                <button
                  onClick={() => copyToClipboard(adminUrl, 'admin')}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1 shrink-0 shadow-sm transition-colors"
                >
                  {copiedAdmin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedAdmin ? '복사됨' : '복사'}
                </button>
              </div>

              {/* Warning about admin token */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p>
                  <strong>관리자 링크를 반드시 즐겨찾기(북마크)해 두세요!</strong><br />
                  비밀 토큰으로 보호되므로 링크를 분실하면 관리자 화면에 재접속할 수 없습니다.
                </p>
              </div>

              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/admin/${createdQueue.adminToken}`)}
                className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
              >
                관리자 화면으로 바로 가기
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>
          </div>
        )}
      </main>
    </MobileContainer>
  );
};
