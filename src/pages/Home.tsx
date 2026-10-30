import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { 
  Users, 
  Store, 
  Smartphone, 
  QrCode, 
  BellRing, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestQueueInput, setGuestQueueInput] = useState('');
  const [guestError, setGuestError] = useState('');

  // Handle Guest direct queue code / URL input
  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError('');
    const input = guestQueueInput.trim();
    if (!input) {
      setGuestError('대기열 코드 또는 링크를 입력해 주세요.');
      return;
    }

    // If input is full URL, extract queueId
    let queueId = input;
    if (input.includes('/q/')) {
      const parts = input.split('/q/');
      queueId = parts[1].split('/')[0].split('?')[0];
    } else if (input.includes('/display/')) {
      const parts = input.split('/display/');
      queueId = parts[1].split('/')[0].split('?')[0];
    }

    if (queueId) {
      navigate(`/q/${queueId}`);
    } else {
      setGuestError('올바른 대기열 코드가 아닙니다.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="px-6 py-5 max-w-md mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Users className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
              JullSir<span className="text-brand-500 text-sm font-bold ml-1">줄서</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">무비용 실시간 대기열</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          100% 무료
        </span>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto w-full px-5 py-4 flex-1 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-600 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            앱 설치 없이 웹 브라우저에서 바로
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            줄 서는 사람도,<br />
            맞이하는 사람도 <span className="text-brand-500">편리하게</span>
          </h2>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            비싼 태블릿 키오스크나 월 이용료 없이,<br />
            스마트폰과 브라우저만으로 실시간 대기열을 운영하세요.
          </p>
        </div>

        {/* Primary Role Selection Buttons */}
        <div className="space-y-4 mb-8">
          {/* Host Card / Button */}
          <Card 
            className="p-5 border-2 border-brand-100 hover:border-brand-500/40 bg-gradient-to-br from-white to-brand-50/30 cursor-pointer shadow-md shadow-brand-500/5 group transition-all"
            onClick={() => navigate('/create')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-md shadow-brand-500/30 group-hover:scale-105 transition-transform">
                  <Store className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Host / 매장 관리자</span>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                    대기열 생성하기
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">손님용 디스플레이와 관리자 화면 생성</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
            </div>
          </Card>

          {/* Guest Card / Button */}
          <Card 
            className="p-5 border-2 border-slate-200/80 hover:border-slate-400 bg-white cursor-pointer shadow-sm group transition-all"
            onClick={() => setIsGuestModalOpen(true)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-md shadow-slate-900/20 group-hover:scale-105 transition-transform">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guest / 대기 손님</span>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
                    대기열 번호표 뽑기
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">대기 코드 또는 링크를 입력하여 접수</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
            </div>
          </Card>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
            <QrCode className="w-5 h-5 text-brand-500 mx-auto mb-1.5" />
            <span className="text-[11px] font-bold text-slate-700 block">QR 간편 접수</span>
            <span className="text-[10px] text-slate-400">카메라 즉시인식</span>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
            <BellRing className="w-5 h-5 text-brand-500 mx-auto mb-1.5" />
            <span className="text-[11px] font-bold text-slate-700 block">실시간 알림</span>
            <span className="text-[10px] text-slate-400">웹푸시 & 사운드</span>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-brand-500 mx-auto mb-1.5" />
            <span className="text-[11px] font-bold text-slate-700 block">원자적 동시성</span>
            <span className="text-[10px] text-slate-400">번호 중복 방지</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        <p>JullSir (줄서) • Zero-Cost Cloud Queueing Solution</p>
      </footer>

      {/* Guest Entry Modal */}
      <Modal
        isOpen={isGuestModalOpen}
        onClose={() => {
          setIsGuestModalOpen(false);
          setGuestError('');
        }}
        title="대기열 입장하기"
      >
        <form onSubmit={handleGuestSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            매장 안내판이나 모니터에 표시된 대기열 코드 또는 링크 URL을 입력해 주세요.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              대기열 코드 또는 링크
            </label>
            <input
              type="text"
              placeholder="예: q_abc123 또는 전체 URL"
              value={guestQueueInput}
              onChange={(e) => setGuestQueueInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              autoFocus
            />
            {guestError && (
              <p className="text-xs text-rose-500 font-medium mt-1.5">{guestError}</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
            <QrCode className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
            <span>매장 입구에 비치된 QR 코드가 있다면 스마트폰 기본 카메라 앱으로 바로 스캔하셔도 됩니다.</span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsGuestModalOpen(false)}
            >
              닫기
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
            >
              대기열 열기
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
