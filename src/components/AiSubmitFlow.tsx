'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { aiExtractSneaker } from '@/lib/actions/ai-extract';
import { submitPairFromAi, mockMarkPaymentPaid } from '@/lib/actions/submit-from-ai';
import { regenerateDescription } from '@/lib/actions/regenerate-description';
import type { Hub, PostCondition } from '@/types/database';
import type { ExtractedSneaker } from '@/lib/ai/extract-sneaker';
import { formatVnd } from '@/lib/utils';

type Step = 'upload' | 'analyzing' | 'preview' | 'paying';

export function AiSubmitFlow({ hubs, userId }: { hubs: Hub[]; userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');

  // Step 1 — upload
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');

  // Step 2 — AI result (editable by user)
  const [aiData, setAiData] = useState<ExtractedSneaker | null>(null);
  const [editedBrand, setEditedBrand] = useState('');
  const [editedModel, setEditedModel] = useState('');
  const [editedColorway, setEditedColorway] = useState('');
  const [editedSize, setEditedSize] = useState<number | null>(null);
  const [editedCondition, setEditedCondition] = useState<PostCondition>('DS');
  const [editedYear, setEditedYear] = useState<string>('');
  const [editedPrice, setEditedPrice] = useState<string>('');
  const [hubId, setHubId] = useState<string>(hubs[0]?.id ?? '');

  // Polished description (user có thể sửa / regenerate)
  const [polishedDesc, setPolishedDesc] = useState('');
  const [polishedEditing, setPolishedEditing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Step 3 — payment
  const [paymentInfo, setPaymentInfo] = useState<{
    lot_id: string;
    order_code: string;
    vietqr_url: string;
    fee_amount: number;
    campaign_name: string | null;
  } | null>(null);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    const valid = selected.filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (valid.length !== selected.length) setError('Chỉ chấp nhận ảnh < 5MB');
    const all = [...files, ...valid].slice(0, 8);
    setFiles(all);
    setPreviews(all.map((f) => URL.createObjectURL(f)));
  }

  function removePhoto(idx: number) {
    const newFiles = files.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  }

  async function handleAnalyze() {
    if (files.length === 0) {
      setError('Cần ít nhất 1 ảnh');
      return;
    }
    setError('');
    setStep('analyzing');

    try {
      // Convert first image to base64
      const file = files[0];
      const buffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      const result = await aiExtractSneaker({
        imageBase64: base64,
        mimeType: file.type,
        caption,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? 'AI không phân tích được');
        setStep('upload');
        return;
      }

      // Pre-fill form với AI result
      setAiData(result.data);
      setEditedBrand(result.data.brand);
      setEditedModel(result.data.model);
      setEditedColorway(result.data.colorway ?? '');
      setEditedSize(result.data.size_us);
      setEditedCondition(result.data.condition_guess ?? 'DS');
      setEditedYear(result.data.release_year_guess ? String(result.data.release_year_guess) : '');
      setEditedPrice(result.data.estimated_price_vnd ? String(result.data.estimated_price_vnd) : '');
      setPolishedDesc(result.data.polished_description);  // pre-fill mô tả chau chuốt
      setPolishedEditing(false);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setStep('upload');
    }
  }

  async function handleRegenerate() {
    if (!aiData) return;
    setRegenerating(true);
    setError('');
    try {
      const result = await regenerateDescription({
        brand: editedBrand,
        model: editedModel,
        colorway: editedColorway || null,
        size_us: editedSize,
        condition: editedCondition,
        release_year: editedYear ? parseInt(editedYear) : null,
        original_caption: caption,
      });
      if (result.success && result.description) {
        setPolishedDesc(result.description);
        setPolishedEditing(false);
      } else {
        setError(result.error ?? 'Không viết lại được');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleConfirm() {
    if (!aiData) return;
    if (!editedBrand || !editedModel || !editedSize || !editedPrice || !hubId) {
      setError('Thiếu thông tin bắt buộc');
      return;
    }
    if (!polishedDesc || polishedDesc.trim().length < 20) {
      setError('Mô tả chau chuốt cần có ít nhất 20 ký tự');
      return;
    }

    setError('');
    setBusy(true);

    try {
      // Upload ảnh
      const supabase = createClient();
      const uploadedPaths: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const path = `${userId}/${filename}`;
        const { error: upErr } = await supabase.storage.from('sneaker-photos').upload(path, file, { contentType: file.type });
        if (upErr) throw new Error(`Upload thất bại: ${upErr.message}`);
        uploadedPaths.push(path);
      }

      // Submit
      const result = await submitPairFromAi({
        brand: editedBrand,
        model: editedModel,
        colorway: editedColorway,
        size_us: editedSize,
        condition: editedCondition,
        release_year: editedYear ? parseInt(editedYear) : null,
        asking_price_vnd: parseInt(editedPrice),
        hub_id: hubId,
        image_paths: uploadedPaths,
        ai_extracted: aiData,
        polished_description: polishedDesc,
        seller_caption: caption,
      });

      if (!result.success) {
        setError(result.error ?? 'Không xác định');
        setBusy(false);
        return;
      }

      setPaymentInfo({
        lot_id: result.lot_id!,
        order_code: result.order_code!,
        vietqr_url: result.vietqr_url!,
        fee_amount: result.fee_amount_vnd!,
        campaign_name: result.campaign_name ?? null,
      });
      setStep('paying');
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setBusy(false);
    }
  }

  async function handleMockPay() {
    if (!paymentInfo) return;
    setBusy(true);
    const result = await mockMarkPaymentPaid(paymentInfo.order_code);
    setBusy(false);
    if (result.success) {
      router.push(`/dashboard?submitted=${paymentInfo.lot_id}&auto=${result.auto_approved ? '1' : '0'}`);
    } else {
      setError(result.error ?? 'Mock payment thất bại');
    }
  }

  // ─── RENDER ─────────────────────────────────────────────────

  if (step === 'analyzing') {
    return (
      <div className="border border-line p-16 text-center bg-ink-2">
        <div className="font-display text-5xl text-rust mb-6 animate-pulse">⚡</div>
        <div className="font-display text-2xl uppercase mb-3">AI đang phân tích...</div>
        <div className="font-mono text-sm text-concrete tracking-[0.1em]">Khoảng 5-10 giây</div>
      </div>
    );
  }

  if (step === 'paying' && paymentInfo) {
    return (
      <div className="border border-line bg-ink-2 p-8">
        <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3">Bước cuối / Thanh toán phí ký gửi</div>
        <h2 className="font-display text-3xl uppercase mb-2">
          Quét VietQR để<br />
          <span className="font-serif italic font-normal text-rust normal-case">hoàn tất</span>
        </h2>
        <div className="font-mono text-sm text-bone-2 mb-8">
          Mã lot: <code className="bg-ink px-2 py-1 text-bone">{paymentInfo.lot_id}</code> · Mã đơn: <code className="bg-ink px-2 py-1 text-bone">{paymentInfo.order_code}</code>
        </div>

        <div className="grid grid-cols-[1fr_1.2fr] gap-8 max-md:grid-cols-1">
          <div className="bg-bone p-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={paymentInfo.vietqr_url} alt="VietQR" className="w-full max-w-[300px]" />
          </div>

          <div>
            <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-2">Số tiền</div>
            <div className="font-display text-4xl text-rust mb-4">
              {formatVnd(paymentInfo.fee_amount)} <span className="text-bone-2 text-lg font-serif italic">VNĐ</span>
            </div>

            {paymentInfo.campaign_name && (
              <div className="bg-rust/10 border border-rust p-3 mb-4">
                <div className="font-mono text-[10px] text-rust tracking-[0.16em] uppercase mb-1">🎁 Khuyến mãi áp dụng</div>
                <div className="font-display text-base">{paymentInfo.campaign_name}</div>
              </div>
            )}

            <div className="text-sm text-bone-2 leading-[1.6] space-y-2">
              <div>1. Mở app ngân hàng (Momo, MBBank, BIDV, ...)</div>
              <div>2. Chọn &quot;Quét QR&quot; / &quot;Pay by QR&quot;</div>
              <div>3. Quét mã bên trái</div>
              <div>4. Nội dung chuyển khoản đã được điền sẵn — KHÔNG sửa</div>
              <div>5. Xác nhận thanh toán</div>
            </div>

            <div className="mt-6 pt-6 border-t border-line">
              <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-3">⚙ Dev mode</div>
              <button
                onClick={handleMockPay}
                disabled={busy}
                className="bg-hazard text-ink py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {busy ? 'Đang xử lý...' : '⚡ MOCK: Đánh dấu đã trả →'}
              </button>
              <div className="mt-2 font-mono text-[10px] text-concrete">
                Trong production sẽ tự động khi PayOS webhook bắn về
              </div>
            </div>

            {error && <div className="mt-3 text-rust font-mono text-[11px]">⚠ {error}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview' && aiData) {
    const confidenceColor = aiData.confidence >= 0.85 ? 'text-[#6ec070]' : aiData.confidence >= 0.7 ? 'text-hazard' : 'text-rust';
    return (
      <div className="space-y-6">
        {/* AI insight panel */}
        <div className="border border-rust bg-rust/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase">⚡ AI đã phân tích</div>
            <div className={`font-mono text-sm font-bold ${confidenceColor}`}>
              Confidence: {(aiData.confidence * 100).toFixed(0)}%
            </div>
          </div>
          <div className="font-display text-xl uppercase mb-3">{aiData.brand} {aiData.model}</div>
          {aiData.strategy_advice && (
            <div className="border-t border-line pt-3 mt-3">
              <div className="font-mono text-[10px] text-rust tracking-[0.16em] uppercase mb-2">💡 Chiến lược</div>
              <p className="text-sm text-bone-2 leading-[1.6]">{aiData.strategy_advice}</p>
            </div>
          )}
          {aiData.risk_flags.length > 0 && (
            <div className="border-t border-line pt-3 mt-3">
              <div className="font-mono text-[10px] text-hazard tracking-[0.16em] uppercase mb-2">⚠ Cảnh báo</div>
              <div className="flex flex-wrap gap-2">
                {aiData.risk_flags.map((f) => (
                  <span key={f} className="font-mono text-[10px] tracking-[0.1em] uppercase bg-hazard/20 text-hazard px-2 py-1 border border-hazard">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Polished Description Panel */}
        <div className="border border-line bg-gradient-to-br from-ink-2 to-ink p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
            <div className="flex items-center gap-3">
              <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase">✨ Mô tả đã chau chuốt</div>
              <div className="font-mono text-[9px] text-concrete tracking-[0.1em] uppercase">AI viết · Bạn chỉnh được</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating || polishedEditing}
                className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2 hover:text-rust transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-line-strong hover:border-rust px-3 py-2"
              >
                {regenerating ? '⟳ Đang viết...' : '↻ Viết lại'}
              </button>
              <button
                type="button"
                onClick={() => setPolishedEditing(!polishedEditing)}
                className={`font-mono text-[10px] tracking-[0.14em] uppercase px-3 py-2 transition-colors ${
                  polishedEditing
                    ? 'bg-rust text-ink border border-rust'
                    : 'text-bone-2 hover:text-rust border border-line-strong hover:border-rust'
                }`}
              >
                {polishedEditing ? '✓ Xong sửa' : '✎ Sửa tay'}
              </button>
            </div>
          </div>

          {polishedEditing ? (
            <textarea
              value={polishedDesc}
              onChange={(e) => setPolishedDesc(e.target.value)}
              rows={10}
              className="w-full bg-ink border border-rust text-bone p-4 font-body text-sm leading-[1.7] focus:outline-none resize-y"
              placeholder="Viết mô tả theo phong cách boutique của riêng bạn..."
            />
          ) : (
            <div className="font-body text-[15px] text-bone leading-[1.75] whitespace-pre-line">
              {polishedDesc || <span className="text-concrete italic">Chưa có mô tả. Click ⟳ Viết lại để AI sinh.</span>}
            </div>
          )}

          <div className="mt-3 flex justify-between font-mono text-[10px] text-concrete tracking-[0.1em] uppercase">
            <span>{polishedDesc.length} ký tự · ~{polishedDesc.split(/\s+/).filter(Boolean).length} từ</span>
            {caption && (
              <span>Caption gốc: "{caption.slice(0, 50)}{caption.length > 50 ? '...' : ''}"</span>
            )}
          </div>
        </div>

        {/* Editable form */}
        <div className="border border-line p-6 bg-ink-2/40">
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-4">Xác nhận & sửa nếu cần</div>

          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <Field label="Brand" required>
              <input value={editedBrand} onChange={(e) => setEditedBrand(e.target.value)} className="form-input" />
            </Field>
            <Field label="Model" required>
              <input value={editedModel} onChange={(e) => setEditedModel(e.target.value)} className="form-input" />
            </Field>
            <Field label="Colorway">
              <input value={editedColorway} onChange={(e) => setEditedColorway(e.target.value)} className="form-input" />
            </Field>
            <Field label="Size US" required>
              <input type="number" step="0.5" min="4" max="15" value={editedSize ?? ''} onChange={(e) => setEditedSize(parseFloat(e.target.value))} className="form-input" />
            </Field>
            <Field label="Năm release">
              <input type="number" min="1985" max="2030" value={editedYear} onChange={(e) => setEditedYear(e.target.value)} className="form-input" />
            </Field>
            <Field label="Tình trạng" required>
              <select value={editedCondition} onChange={(e) => setEditedCondition(e.target.value as PostCondition)} className="form-input">
                <option value="DS">DS — Deadstock</option>
                <option value="VNDS">VNDS — Very Near DS</option>
                <option value="9_5">9.5/10 — Như mới</option>
                <option value="9">9/10 — Đẹp</option>
                <option value="8_5">8.5/10 — Khá</option>
                <option value="8">8/10 — Cũ</option>
              </select>
            </Field>
          </div>

          <div className="mt-4">
            <Field label={`Giá đề xuất (VNĐ) ${aiData.estimated_price_vnd ? `· AI gợi ý: ${formatVnd(aiData.estimated_price_vnd)}` : ''}`} required>
              <input type="number" min="100000" step="50000" value={editedPrice} onChange={(e) => setEditedPrice(e.target.value)} className="form-input font-mono" />
              {editedPrice && <div className="mt-2 font-mono text-sm text-rust">≈ {formatVnd(parseInt(editedPrice))}</div>}
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Hub mang đến" required>
              <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                {hubs.map((h) => (
                  <label key={h.id} className={`block p-3 border cursor-pointer transition-colors ${hubId === h.id ? 'border-rust bg-rust/5' : 'border-line-strong hover:border-bone-2'}`}>
                    <input type="radio" checked={hubId === h.id} onChange={() => setHubId(h.id)} className="hidden" />
                    <div className="font-display text-sm uppercase">{h.name}</div>
                    <div className="font-mono text-[10px] text-concrete">{h.city}</div>
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </div>

        {error && <div className="border border-rust bg-rust/10 text-rust p-4 font-mono text-sm">⚠ {error}</div>}

        <div className="flex gap-3">
          <button onClick={() => { setStep('upload'); setAiData(null); }} className="border border-line-strong text-bone-2 py-3 px-6 font-mono text-[11px] tracking-[0.18em] uppercase hover:border-bone hover:text-bone transition-colors">
            ← Quay lại
          </button>
          <button onClick={handleConfirm} disabled={busy} className="bg-rust text-ink py-3 px-6 font-mono text-[11px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-50">
            {busy ? 'Đang gửi...' : 'Xác nhận & sang thanh toán →'}
          </button>
        </div>

        <style jsx>{`:global(.form-input){width:100%;background:var(--color-ink);border:1px solid var(--line-strong);color:var(--color-bone);padding:0.6rem 0.8rem;font-family:var(--font-body);font-size:0.875rem}:global(.form-input:focus){border-color:var(--color-rust);outline:none}`}</style>
      </div>
    );
  }

  // Step 'upload' (default)
  return (
    <div className="space-y-6">
      <div className="border border-line p-6 bg-ink-2/40">
        <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3">Bước 1 / Ảnh sản phẩm</div>
        <p className="text-sm text-bone-2 mb-4">Tối thiểu 1 ảnh, khuyến nghị 3-5 ảnh (tổng thể, sole, heel, tongue, box). AI sẽ phân tích ảnh đầu tiên.</p>

        <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          {previews.map((src, idx) => (
            <div key={idx} className="aspect-square bg-ink-2 border border-line relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`p-${idx}`} className="w-full h-full object-cover" />
              {idx === 0 && <span className="absolute top-1 left-1 font-mono text-[9px] tracking-[0.14em] uppercase bg-rust text-ink px-2 py-1">⚡ AI</span>}
              <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 bg-ink/90 text-bone w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rust hover:text-ink">×</button>
            </div>
          ))}
          {files.length < 8 && (
            <label className="aspect-square bg-ink-2 border border-dashed border-line-strong flex flex-col items-center justify-center cursor-pointer hover:border-rust transition-colors">
              <span className="text-2xl text-concrete">+</span>
              <span className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mt-1">Thêm ảnh</span>
              <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div className="border border-line p-6 bg-ink-2/40">
        <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-3">Bước 2 / Mô tả ngắn (tuỳ chọn)</div>
        <p className="text-sm text-bone-2 mb-3">Cho AI biết thêm context: ai sở hữu trước, kỷ niệm đặc biệt, trạng thái hiện tại, ...</p>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="VD: AJ4 Bred Reimagined size 9.5, mua 2024 chỉ thử 1 lần, có đủ box và túi"
          rows={3}
          className="w-full bg-ink border border-line-strong text-bone p-3 font-body text-sm focus:border-rust focus:outline-none resize-none"
        />
      </div>

      {error && <div className="border border-rust bg-rust/10 text-rust p-4 font-mono text-sm">⚠ {error}</div>}

      <button onClick={handleAnalyze} disabled={files.length === 0} className="bg-rust text-ink py-4 px-8 font-mono text-xs font-bold tracking-[0.2em] uppercase hover:bg-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3">
        ⚡ Phân tích bằng AI →
      </button>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-bone-2 tracking-[0.14em] uppercase mb-2">
        {label} {required && <span className="text-rust">*</span>}
      </label>
      {children}
    </div>
  );
}
