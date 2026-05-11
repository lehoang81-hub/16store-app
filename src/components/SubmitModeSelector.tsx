'use client';

import { useState } from 'react';
import { SubmitPairForm } from './SubmitPairForm';
import { AiSubmitFlow } from './AiSubmitFlow';
import type { Hub } from '@/types/database';

export function SubmitModeSelector({ hubs, userId, aiEnabled }: { hubs: Hub[]; userId: string; aiEnabled: boolean }) {
  const [mode, setMode] = useState<'ai' | 'manual'>(aiEnabled ? 'ai' : 'manual');

  return (
    <>
      {/* Mode tabs */}
      <div className="grid grid-cols-2 border border-line mb-10 max-sm:grid-cols-1">
        <button
          onClick={() => setMode('ai')}
          disabled={!aiEnabled}
          className={`p-6 text-left transition-colors border-r border-line max-sm:border-r-0 max-sm:border-b ${
            mode === 'ai' ? 'bg-rust/10 border-l-[3px] border-l-rust pl-[21px]' : 'hover:bg-ink-2'
          } ${!aiEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase">⚡ Khuyến nghị</div>
            {!aiEnabled && <div className="font-mono text-[9px] text-concrete tracking-[0.14em] uppercase">CHƯA SẴN SÀNG</div>}
          </div>
          <div className="font-display text-xl uppercase tracking-[-0.01em] mb-2">
            Ký gửi qua <span className="text-rust italic font-serif">AI</span>
          </div>
          <p className="text-sm text-bone-2 leading-[1.5]">
            Chụp 1 ảnh + caption ngắn. AI tự nhận diện brand, model, đoán size + giá. ~30 giây.
          </p>
          {!aiEnabled && (
            <div className="mt-3 font-mono text-[10px] text-concrete">
              Cần GEMINI_API_KEY trong .env.local
            </div>
          )}
        </button>

        <button
          onClick={() => setMode('manual')}
          className={`p-6 text-left transition-colors ${
            mode === 'manual' ? 'bg-rust/10 border-l-[3px] border-l-rust pl-[21px]' : 'hover:bg-ink-2'
          } cursor-pointer`}
        >
          <div className="font-mono text-[10px] text-bone-2 tracking-[0.2em] uppercase mb-2">Thủ công</div>
          <div className="font-display text-xl uppercase tracking-[-0.01em] mb-2">Ký gửi đầy đủ</div>
          <p className="text-sm text-bone-2 leading-[1.5]">
            Điền form chi tiết từng field. Phù hợp khi bạn biết rõ thông tin pair. ~3 phút.
          </p>
        </button>
      </div>

      {/* Active form */}
      {mode === 'ai' ? (
        <AiSubmitFlow hubs={hubs} userId={userId} />
      ) : (
        <SubmitPairForm hubs={hubs} userId={userId} />
      )}
    </>
  );
}
