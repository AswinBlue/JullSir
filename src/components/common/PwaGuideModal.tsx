import React, { useState } from 'react';
import { Modal } from './Modal';
import { Share, PlusSquare, Smartphone, ExternalLink, Check, Copy } from 'lucide-react';

interface PwaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInApp: boolean;
}

export const PwaGuideModal: React.FC<PwaGuideModalProps> = ({ isOpen, onClose, isInApp }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('guide', 'pwa');
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="아이폰 백그라운드 알림 설정 가이드">
      <div className="space-y-4 text-slate-700 text-sm">
        {isInApp ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2">
            <p className="font-bold text-amber-900 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-amber-600" />
              현재 카카오톡/네이버 인앱 브라우저로 접속 중입니다
            </p>
            <p className="text-amber-700">
              인앱 브라우저에서는 홈 화면 추가가 지원되지 않습니다. 아래 순서대로 <strong>Safari(사파리)</strong>로 이동해 주세요.
            </p>
            <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
              <span className="text-[11px] text-amber-800">1. 우측 상단/하단 <strong>더보기(···)</strong> → <strong>Safari로 열기</strong></span>
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? '복사됨!' : '링크 복사'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 pt-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            사파리(Safari)에서 홈 화면 추가 3단계
          </p>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">
              <Share className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">1단계: 사파리 공유 버튼 터치</p>
              <p className="text-[11px] text-slate-500 mt-0.5">화면 하단 메뉴바 중앙의 네모 화살표(↑) 아이콘을 누릅니다.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">2단계: '홈 화면에 추가' 선택</p>
              <p className="text-[11px] text-slate-500 mt-0.5">메뉴를 아래로 스크롤하여 [+] 홈 화면에 추가를 누르고 우측 상단 [추가]를 완료합니다.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">3단계: 홈 화면 아이콘 실행 후 알림 허용</p>
              <p className="text-[11px] text-slate-500 mt-0.5">바탕화면에 생성된 '줄서' 아이콘을 터치하여 열고 알림 허용을 누르면 화면을 꺼도 알림이 옵니다.</p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 text-white font-bold rounded-2xl text-xs hover:bg-slate-800 transition active:scale-95"
        >
          확인했습니다 (가이드 닫기)
        </button>
      </div>
    </Modal>
  );
};
