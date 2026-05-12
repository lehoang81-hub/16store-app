'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PosterCanvas } from '@/components/PosterCanvas';
import {
  submitHeritageListing,
  type AssetData,
  type ConceptType,
} from '@/lib/actions/generate-heritage-visual';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  assetId:       string;
  assetData:     AssetData;
  userHlr:       number;
  isFirstAsset?: boolean;
  onClose:       () => void;
}

type Step = 'info' | 'concept' | 'result';

// ─── Constants ────────────────────────────────────────────────────────────────

const HUBS = [
  { code: 'hcm-01',    name: 'Ho Chi Minh Main Hub' },
  { code: 'hanoi-01',  name: 'Hanoi Hub' },
  { code: 'danang-01', name: 'Da Nang Hub' },
];

const CONCEPTS: ConceptType[] = ['archive', 'lifestyle', 'emotional'];

const CONCEPT_META: Record<ConceptType, { label: string; sub: string; color: string }> = {
  archive:   { label: 'Archive',   sub: 'Bảo tàng · Studio light',   color: '#C8531C' },
  lifestyle: { label: 'Lifestyle', sub: 'Đời sống · Cinematic',      color: '#d4af37' },
  emotional: { label: 'Emotional', sub: 'Cảm xúc · Moody macro',    color: '#5DCAA5' },
};

const ELITE_COST = 20;

// ─── Component ────────────────────────────────────────────────────────────────

export function HeritageListing({ assetId, assetData, userHlr, isFirstAsset, onClose }: Props) {
  const router = useRouter();

  const [step,            setStep]            = useState<Step>('info');
  const [price,           setPrice]           = useState('');
  const [description,     setDescription]     = useState('');
  const [hubCode,         setHubCode]         = useState('hcm-01');
  const [tier,            setTier]            = useState<'standard' | 'elite'>('standard');
  const [selectedConcept, setSelectedConcept] = useState<ConceptType>('archive');
  const [posterDataUrl,   setPosterDataUrl]   = useState<string | null>(
    (assetData as any).posterUrl ?? null  // Dùng poster đã lưu nếu có
  );
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const canAffordElite = userHlr >= ELITE_COST || !!isFirstAsset;
  const priceNum       = parseInt(price.replace(/\D/g, '')) || 0;

  // Các concept có thể chọn tuỳ theo tier
  const availableConcepts = tier === 'standard'
    ? (['archive'] as ConceptType[])
    : CONCEPTS;

  // ── Step 1: Thông tin listing ──────────────────────────────────────────────

  if (step === 'info') {
    return (
      <div className="p-6 space-y-5">
        {/* Title */}
        <div>
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust mb-1">
            Ký gửi bán di sản
          </div>
          <div className="font-display text-lg uppercase">{assetData.brand} {assetData.model}</div>
          <div className="font-mono text-[10px] text-concrete mt-0.5">
            {assetData.serialNumber} · {assetData.objectType}
          </div>
        </div>

        {/* Ảnh định danh gốc */}
        {assetData.existingImageUrl && (
          <div>
            <div className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase mb-2">
              Ảnh định danh gốc
            </div>
            <img
              src={assetData.existingImageUrl}
              alt="Ảnh định danh"
              className="w-full max-w-[200px] border border-line"
              style={{ aspectRatio: '1', objectFit: 'cover' }}
            />
          </div>
        )}

        <div className="space-y-3">
          {/* Giá bán */}
          <div>
            <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
              Giá bán (VNĐ) *
            </label>
            <input
              type="text"
              placeholder="VD: 5,000,000"
              value={price}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                setPrice(raw ? new Intl.NumberFormat('vi-VN').format(parseInt(raw)) : '');
              }}
              className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2"
            />
            {priceNum > 0 && (
              <div className="font-mono text-[9px] text-concrete mt-1">
                = {new Intl.NumberFormat('vi-VN').format(priceNum)} VNĐ
              </div>
            )}
          </div>

          {/* Mô tả */}
          <div>
            <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
              Mô tả vật phẩm *
            </label>
            <textarea
              rows={3}
              placeholder={`Câu chuyện của ${assetData.brand} ${assetData.model}. Tình trạng, lý do bán, kỷ niệm...`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono resize-none focus:outline-none focus:border-bone-2"
            />
            <div className="font-mono text-[8px] text-concrete mt-1">
              {description.length}/500 · Mô tả hay → bán nhanh hơn
            </div>
          </div>

          {/* Hub */}
          <div>
            <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
              Hub nhận hàng *
            </label>
            <select
              value={hubCode}
              onChange={e => setHubCode(e.target.value)}
              className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none"
            >
              {HUBS.map(h => (
                <option key={h.code} value={h.code}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="border border-rust bg-rust/10 p-3 font-mono text-[11px] text-rust">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              if (!priceNum || priceNum < 100000) {
                setError('Giá tối thiểu 100,000 VNĐ'); return;
              }
              if (!description.trim() || description.length < 10) {
                setError('Vui lòng nhập mô tả (tối thiểu 10 ký tự)'); return;
              }
              setError(null);
              setStep('concept');
            }}
            disabled={!priceNum || !description.trim()}
            className="flex-1 bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40"
          >
            Tiếp theo: Chọn kiểu poster →
          </button>
          <button
            onClick={onClose}
            className="border border-line text-concrete px-4 py-3 font-mono text-[10px] uppercase hover:text-bone"
          >
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Chọn concept (tier + theme) ───────────────────────────────────

  if (step === 'concept') {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('info')}
            className="font-mono text-[9px] text-concrete tracking-[0.12em] uppercase hover:text-bone"
          >
            ← Quay lại
          </button>
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase">
            Chọn kiểu poster
          </div>
        </div>

        {/* Tier: Standard vs Elite */}
        <div className="space-y-2">
          <div className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase mb-2">
            Gói poster
          </div>

          {isFirstAsset && (
            <div className="border border-[#d4af37] bg-[#d4af37]/10 p-3 flex gap-3 items-start mb-3">
              <span style={{ fontSize: 16 }}>🎁</span>
              <div className="font-mono text-[10px] text-[#d4af37]">
                Vật phẩm đầu tiên — Elite miễn phí!
              </div>
            </div>
          )}

          {/* Standard */}
          <button
            onClick={() => { setTier('standard'); setSelectedConcept('archive'); }}
            className={`w-full text-left p-4 border transition-all ${
              tier === 'standard'
                ? 'border-rust bg-rust/10'
                : 'border-line hover:border-bone-2'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-mono text-[11px] font-bold text-bone tracking-[0.1em] uppercase">
                  Standard
                </div>
                <div className="font-mono text-[9px] text-concrete mt-1">
                  1 theme Archive · Miễn phí HLR
                </div>
              </div>
              {tier === 'standard' && (
                <span className="font-mono text-[10px] text-rust">✓</span>
              )}
            </div>
          </button>

          {/* Elite */}
          <button
            onClick={() => canAffordElite && setTier('elite')}
            disabled={!canAffordElite}
            className={`w-full text-left p-4 border transition-all ${
              tier === 'elite'
                ? 'border-[#d4af37] bg-[#d4af37]/10'
                : canAffordElite
                  ? 'border-line hover:border-[#d4af37]/50'
                  : 'border-line opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-mono text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: '#d4af37' }}>
                  ✦ Elite
                </div>
                <div className="font-mono text-[9px] text-concrete mt-1">
                  3 themes · {isFirstAsset ? 'Miễn phí (first asset)' : `${ELITE_COST} HLR`}
                </div>
              </div>
              {tier === 'elite' && (
                <span className="font-mono text-[10px]" style={{ color: '#d4af37' }}>✓</span>
              )}
            </div>
          </button>
        </div>

        {/* Concept selector (chỉ hiện khi elite) */}
        {tier === 'elite' && (
          <div className="space-y-2">
            <div className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase">
              Chọn theme
            </div>
            {CONCEPTS.map(c => (
              <button
                key={c}
                onClick={() => setSelectedConcept(c)}
                className={`w-full text-left p-3 border transition-all flex items-center gap-3 ${
                  selectedConcept === c ? 'border-opacity-100' : 'border-line hover:border-opacity-50'
                }`}
                style={{
                  borderColor: selectedConcept === c ? CONCEPT_META[c].color : undefined,
                  background:  selectedConcept === c ? CONCEPT_META[c].color + '15' : undefined,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: CONCEPT_META[c].color }}
                />
                <div>
                  <div className="font-mono text-[11px] font-bold tracking-[0.1em] uppercase"
                    style={{ color: CONCEPT_META[c].color }}>
                    {CONCEPT_META[c].label}
                  </div>
                  <div className="font-mono text-[9px] text-concrete">
                    {CONCEPT_META[c].sub}
                  </div>
                </div>
                {selectedConcept === c && (
                  <span className="ml-auto font-mono text-[10px]"
                    style={{ color: CONCEPT_META[c].color }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setStep('result')}
          className="w-full bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors"
        >
          Xem poster →
        </button>
      </div>
    );
  }

  // ── Step 3: Result — PosterCanvas render + submit ─────────────────────────

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('concept')}
            className="font-mono text-[9px] text-concrete tracking-[0.12em] uppercase hover:text-bone"
          >
            ← Đổi theme
          </button>
          <div className="font-mono text-[10px] text-[#6ec070] tracking-[0.15em] uppercase">
            Preview poster
          </div>
        </div>
        {tier === 'elite' && (
          <span className="font-mono text-[8px] bg-[#d4af37]/20 text-[#d4af37] px-2 py-1 tracking-[0.1em] uppercase">
            ✦ Elite
          </span>
        )}
      </div>

      {/* Concept tabs (elite only) */}
      {tier === 'elite' && (
        <div className="flex gap-2">
          {availableConcepts.map(c => (
            <button
              key={c}
              onClick={() => { setSelectedConcept(c); setPosterDataUrl(null); }}
              className={`flex-1 py-2 border font-mono text-[9px] tracking-[0.1em] uppercase transition-all ${
                selectedConcept === c
                  ? 'border-rust bg-rust/10 text-rust'
                  : 'border-line text-concrete hover:border-bone-2'
              }`}
            >
              {CONCEPT_META[c].label}
            </button>
          ))}
        </div>
      )}

      {/* Poster — dùng ảnh đã lưu hoặc render canvas */}
      {(assetData as any).posterUrl ? (
        <div style={{ position: 'relative' }}>
          <img
            src={(assetData as any).posterUrl}
            alt="Poster định danh"
            style={{ width: '100%', display: 'block', border: '1px solid rgba(200,83,28,0.2)' }}
          />
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            fontFamily: 'monospace', fontSize: 9,
            color: '#C8531C', background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
          }}>
            ✓ Poster đã lưu
          </div>
        </div>
      ) : (
        <PosterCanvas
          concept={selectedConcept}
          data={{
            brand:       assetData.brand,
            model:       assetData.model,
            colorway:    assetData.colorway,
            qrCode:      assetData.qrCode,
            price:       priceNum,
            heroUrl:     assetData.existingImageUrl ?? (assetData as any).cover_image_url ?? '',
            description: description || undefined,
            ownerCount:  assetData.owners,
          }}
          onReady={setPosterDataUrl}
        />
      )}

      {/* Listing info */}
      <div className="border border-line p-3 space-y-1">
        <div className="font-mono text-[11px] text-concrete tracking-[0.12em] uppercase mb-2">
          Thông tin listing
        </div>
        <div className="flex justify-between font-mono text-[13px]">
          <span className="text-concrete">Giá</span>
          <span className="text-bone font-bold">
            {new Intl.NumberFormat('vi-VN').format(priceNum)} VNĐ
          </span>
        </div>
        <div className="flex justify-between font-mono text-[13px]">
          <span className="text-concrete">Hub</span>
          <span className="text-bone">{HUBS.find(h => h.code === hubCode)?.name}</span>
        </div>
        <div className="font-mono text-[10px] text-concrete mt-1 italic">
          "{description.substring(0, 60)}{description.length > 60 ? '...' : ''}"
        </div>
      </div>

      {error && (
        <div className="border border-rust bg-rust/10 p-3 font-mono text-[11px] text-rust">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Save / Share / Regenerate */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!posterDataUrl) return;
              const a = document.createElement('a');
              a.href     = posterDataUrl;
              a.download = `16store-${assetData.brand}-${assetData.model}-${selectedConcept}.png`
                .replace(/\s+/g, '-');
              a.click();
            }}
            disabled={!posterDataUrl}
            className="flex-1 border border-line text-bone-2 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase hover:border-rust hover:text-rust transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <span>↓</span> Lưu ảnh
          </button>

          <button
            onClick={async () => {
              if (!posterDataUrl) return;
              try {
                if (navigator.share && navigator.canShare) {
                  const res  = await fetch(posterDataUrl);
                  const blob = await res.blob();
                  const file = new File([blob], '16store-poster.png', { type: 'image/png' });
                  if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                      title: `${assetData.brand} ${assetData.model} · 16Store`,
                      text:  `Hộ chiếu vật phẩm: ${assetData.qrCode}`,
                      files: [file],
                    });
                    return;
                  }
                }
                await navigator.clipboard.writeText(`https://16store.app/p/${assetData.qrCode}`);
                alert('Đã copy link passport vào clipboard!');
              } catch {
                await navigator.clipboard.writeText(`https://16store.app/p/${assetData.qrCode}`);
                alert('Đã copy link!');
              }
            }}
            disabled={!posterDataUrl}
            className="flex-1 border border-line text-bone-2 py-2.5 font-mono text-[10px] tracking-[0.14em] uppercase hover:border-rust hover:text-rust transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <span>↗</span> Chia sẻ
          </button>

          <button
            onClick={() => { setPosterDataUrl(null); setStep('concept'); }}
            className="border border-line text-concrete px-3 py-2.5 font-mono text-[10px] uppercase hover:border-bone-2 hover:text-bone transition-colors"
            title="Đổi theme"
          >
            ↺
          </button>
        </div>

        {/* Đăng bán */}
        <button
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            const result = await submitHeritageListing({
              assetId,
              price:            priceNum,
              description,
              hubCode,
              concept:          selectedConcept,
              tier,
              affiliateHandle:  'unknown',
            });
            setSubmitting(false);
            if (result.success) {
              router.push(`/dashboard?submitted=${result.lotId}`);
            } else {
              setError(result.error ?? 'Không thể đăng bán');
            }
          }}
          disabled={submitting || !posterDataUrl}
          className="w-full bg-rust text-ink py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40"
        >
          {submitting
            ? 'Đang đăng...'
            : `✦ Đăng bán · ${new Intl.NumberFormat('vi-VN').format(priceNum)} VNĐ`}
        </button>

        <div className="font-mono text-[9px] text-concrete text-center">
          Nút đăng bán chỉ active sau khi poster render xong
        </div>
      </div>
    </div>
  );
}
