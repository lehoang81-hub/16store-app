'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { submitPair } from '@/lib/actions/submit-pair';
import type { Hub, PostCondition } from '@/types/database';
import { formatVnd } from '@/lib/utils';

const ASSET_TYPES = [
  { value: 'sneaker',     label: 'Giày',        icon: '👟' },
  { value: 'watch',       label: 'Đồng hồ',     icon: '⌚' },
  { value: 'apparel',     label: 'Trang phục',   icon: '👕' },
  { value: 'gear',        label: 'Gear',         icon: '🎒' },
  { value: 'bag',         label: 'Túi xách',     icon: '👜' },
  { value: 'electronics', label: 'Điện tử',      icon: '📱' },
  { value: 'other',       label: 'Khác',         icon: '📦' },
]

const BRANDS = ['Air Jordan', 'Nike', 'Nike SB', 'Adidas', 'Yeezy', 'New Balance', 'Travis Scott', 'Other'];
const CONDITIONS: { value: PostCondition; label: string }[] = [
  { value: 'DS',   label: 'DS — Deadstock' },
  { value: 'VNDS', label: 'VNDS — Very Near Deadstock' },
  { value: '9_5',  label: '9.5/10 — Như mới' },
  { value: '9',    label: '9/10 — Đẹp' },
  { value: '8_5',  label: '8.5/10 — Khá' },
  { value: '8',    label: '8/10 — Cũ' },
];
const SIZES = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13];

export function SubmitPairForm({ hubs, userId }: { hubs: Hub[]; userId: string }) {
  // Asset type
  const [assetType, setAssetType] = useState<string>('sneaker')

  // Sneaker fields
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [colorway, setColorway] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [condition, setCondition] = useState<PostCondition>('DS');
  const [year, setYear] = useState<string>('');

  // Common fields
  const [price, setPrice] = useState<string>('');
  const [hubId, setHubId] = useState<string>(hubs[0]?.id ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // AI attributes
  const [aiAttributes, setAiAttributes] = useState<Record<string, any>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [showAiAttributes, setShowAiAttributes] = useState(false)

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  // AI suggest attributes
  async function handleAiSuggest() {
    setAiLoading(true)
    setError('')
    try {
      let image_base64 = null
      let image_mime = null

      // Convert ảnh đầu tiên sang base64 nếu có
      if (files.length > 0) {
        const file = files[0]
        image_mime = file.type
        image_base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // chỉ lấy base64 data
          }
          reader.readAsDataURL(file)
        })
      }

      const res = await fetch('/api/assets/suggest-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_type: assetType,
          image_base64,
          image_mime,
          description: aiDescription,
        })
      })

      const data = await res.json()
      if (data.attributes) {
        setAiAttributes(data.attributes)
        setShowAiAttributes(true)

        // Auto-fill sneaker fields nếu AI trả về
        if (assetType === 'sneaker') {
          if (data.attributes.brand) setBrand(data.attributes.brand)
          if (data.attributes.model) setModel(data.attributes.model)
          if (data.attributes.colorway) setColorway(data.attributes.colorway)
          if (data.attributes.size_us) setSize(parseFloat(data.attributes.size_us))
          if (data.attributes.release_year) setYear(String(data.attributes.release_year))
        }
      }
    } catch (err) {
      setError('AI không phân tích được. Vui lòng điền thủ công.')
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate theo asset type
    if (assetType === 'sneaker') {
      if (!brand || !model || !size || !price || !hubId || files.length === 0) {
        setError('Vui lòng điền đầy đủ thông tin và upload ít nhất 1 ảnh');
        return;
      }
    } else {
      if (!price || !hubId || files.length === 0) {
        setError('Vui lòng upload ít nhất 1 ảnh và nhập giá');
        return;
      }
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const uploadedPaths: string[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const path = `${userId}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('sneaker-photos')
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw new Error(`Upload thất bại: ${uploadError.message}`);
        uploadedPaths.push(path);
      }

      const result = await submitPair({
        asset_type: assetType,
        asset_attributes: Object.keys(aiAttributes).length > 0 ? aiAttributes : null,
        brand: assetType === 'sneaker' ? brand : (aiAttributes.brand ?? assetType),
        model: assetType === 'sneaker' ? model : (aiAttributes.model ?? 'Unknown'),
        colorway: assetType === 'sneaker' ? colorway : (aiAttributes.colorway ?? ''),
        size_us: assetType === 'sneaker' ? (size ?? 0) : 0,
        condition,
        release_year: year ? parseInt(year) : null,
        asking_price_vnd: parseInt(price),
        hub_id: hubId,
        image_paths: uploadedPaths,
      });

      if (!result.success) {
        setError(result.error ?? 'Không xác định');
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
      setSubmitting(false);
    }
  }

  const isSneaker = assetType === 'sneaker'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_360px] gap-8 max-lg:grid-cols-1">
      <div className="space-y-8">

        {/* Section 0 — Loại vật phẩm */}
        <FormSection number="00" title="Loại vật phẩm">
          <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
            {ASSET_TYPES.map((at) => (
              <button
                key={at.value}
                type="button"
                onClick={() => { setAssetType(at.value); setAiAttributes({}); setShowAiAttributes(false) }}
                className={`p-3 border text-center transition-colors ${
                  assetType === at.value
                    ? 'border-rust bg-rust/10'
                    : 'border-line hover:border-bone-2'
                }`}
              >
                <div className="text-2xl mb-1">{at.icon}</div>
                <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2">{at.label}</div>
              </button>
            ))}
          </div>
        </FormSection>

        {/* Section 1 — Thông tin sản phẩm */}
        <FormSection number="01" title={isSneaker ? "Thông tin giày" : "Thông tin vật phẩm"}>

          {/* AI Suggest cho non-sneaker */}
          {!isSneaker && (
            <div className="border border-rust/30 bg-rust/5 p-4 space-y-3">
              <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase">⚡ AI nhận diện tự động</div>
              <p className="font-mono text-[11px] text-bone-2">
                Upload ảnh bên dưới rồi nhấn nút để AI tự điền thông tin.
              </p>
              <input
                type="text"
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="Mô tả thêm (không bắt buộc): VD: Garmin Fenix 7 Solar, còn bảo hành..."
                className="form-input text-sm"
              />
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiLoading || files.length === 0}
                className="border border-rust text-rust px-4 py-2 font-mono text-[11px] tracking-[0.14em] uppercase hover:bg-rust hover:text-ink transition-colors disabled:opacity-50"
              >
                {aiLoading ? 'Đang phân tích...' : '⚡ AI phân tích ngay'}
              </button>
              {files.length === 0 && (
                <p className="font-mono text-[10px] text-concrete">Upload ảnh trước để AI phân tích</p>
              )}
            </div>
          )}

          {/* AI Attributes result */}
          {showAiAttributes && Object.keys(aiAttributes).length > 0 && (
            <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-4">
              <div className="font-mono text-[10px] text-[#6ec070] tracking-[0.2em] uppercase mb-3">
                ✓ AI đã nhận diện — Chỉnh sửa nếu cần
              </div>
              <div className="space-y-2">
                {Object.entries(aiAttributes).map(([key, value]) => (
                  <div key={key} className="flex gap-3 items-center">
                    <span className="font-mono text-[10px] text-concrete tracking-[0.1em] uppercase w-24 shrink-0">{key}</span>
                    <input
                      type="text"
                      value={String(value ?? '')}
                      onChange={(e) => setAiAttributes(prev => ({ ...prev, [key]: e.target.value }))}
                      className="form-input text-sm flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sneaker-specific fields */}
          {isSneaker && (
            <>
              <Field label="Brand" required>
                <select value={brand} onChange={(e) => setBrand(e.target.value)} required className="form-input">
                  <option value="">— Chọn brand —</option>
                  {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Model" required hint="VD: AJ4 Bred Reimagined, SB Dunk Low Panda">
                <input type="text" value={model} onChange={(e) => setModel(e.target.value)} required className="form-input" placeholder="Tên đầy đủ của model" />
              </Field>
              <Field label="Colorway" hint="VD: Bred, Panda, Mocha">
                <input type="text" value={colorway} onChange={(e) => setColorway(e.target.value)} className="form-input" placeholder="Tên màu/phối màu" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Size US" required>
                  <select value={size ?? ''} onChange={(e) => setSize(parseFloat(e.target.value))} required className="form-input">
                    <option value="">— Chọn size —</option>
                    {SIZES.map((s) => <option key={s} value={s}>{s} US</option>)}
                  </select>
                </Field>
                <Field label="Năm phát hành">
                  <input type="number" min="1985" max="2026" value={year} onChange={(e) => setYear(e.target.value)} className="form-input" placeholder="2024" />
                </Field>
              </div>
            </>
          )}

          {/* Condition — dùng chung */}
          <Field label="Tình trạng" required>
            <select value={condition} onChange={(e) => setCondition(e.target.value as PostCondition)} required className="form-input">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </FormSection>

        {/* Section 2 — Ảnh */}
        <FormSection number="02" title="Ảnh sản phẩm" subtitle="Tối đa 8 ảnh, mỗi ảnh < 5MB.">
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            {previews.map((src, idx) => (
              <div key={idx} className="aspect-square bg-ink-2 border border-line relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-ink/90 text-bone w-7 h-7 flex items-center justify-center text-sm font-mono opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rust hover:text-ink"
                >×</button>
              </div>
            ))}
            {files.length < 8 && (
              <label className="aspect-square bg-ink-2 border border-dashed border-line-strong flex flex-col items-center justify-center cursor-pointer hover:border-rust transition-colors group">
                <span className="text-2xl text-concrete group-hover:text-rust transition-colors">+</span>
                <span className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase mt-1">Thêm ảnh</span>
                <input type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
              </label>
            )}
          </div>
        </FormSection>

        {/* Section 3 — Giá + Hub */}
        <FormSection number="03" title="Giá và hub">
          <Field label="Giá đề xuất (VNĐ)" required hint="Nhập số nguyên. VD: 6800000 = 6.8M">
            <input type="number" min="100000" step="50000" value={price} onChange={(e) => setPrice(e.target.value)} required className="form-input font-mono" placeholder="6800000" />
            {price && <div className="mt-2 font-mono text-sm text-rust">≈ {formatVnd(parseInt(price))}</div>}
          </Field>
          <Field label="Hub mang đến" required>
            <div className="space-y-2">
              {hubs.map((h) => (
                <label key={h.id} className={`block p-4 border cursor-pointer transition-colors ${hubId === h.id ? 'border-rust bg-rust/5' : 'border-line-strong hover:border-bone-2'}`}>
                  <input type="radio" name="hub" value={h.id} checked={hubId === h.id} onChange={(e) => setHubId(e.target.value)} className="hidden" />
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-display text-base uppercase tracking-[-0.01em]">{h.name}</div>
                      <div className="font-mono text-[11px] text-concrete tracking-[0.06em] uppercase mt-1">{h.address}</div>
                    </div>
                    <div className="font-mono text-[10px] text-bone-2 tracking-[0.14em] uppercase text-right">
                      {h.status.toUpperCase()}<br />
                      <span className="text-concrete">{h.active_lots}/{h.capacity} lots</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </FormSection>

        {error && (
          <div className="border border-rust bg-rust/10 text-rust p-4 font-mono text-sm">⚠ {error}</div>
        )}

        <button type="submit" disabled={submitting} className="bg-rust text-ink py-4 px-8 font-mono text-xs font-bold tracking-[0.2em] uppercase hover:bg-bone transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3">
          {submitting ? 'Đang gửi...' : 'Gửi để được verify →'}
        </button>
      </div>

      {/* Sidebar */}
      <aside className="border border-line p-6 bg-ink-2 h-fit sticky top-24 max-lg:static">
        <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase mb-4 pb-3 border-b border-line">Tổng quan</div>
        <Summary label="Loại" value={ASSET_TYPES.find(a => a.value === assetType)?.label ?? assetType} />
        {isSneaker && (
          <>
            <Summary label="Brand" value={brand || '—'} />
            <Summary label="Model" value={model || '—'} />
            <Summary label="Size" value={size ? `${size} US` : '—'} />
          </>
        )}
        <Summary label="Tình trạng" value={CONDITIONS.find(c => c.value === condition)?.label.split(' — ')[0] ?? '—'} />
        <Summary label="Hub" value={hubs.find(h => h.id === hubId)?.name ?? '—'} />
        <Summary label="Số ảnh" value={`${files.length}/8`} />
        <div className="mt-4 pt-4 border-t border-line">
          <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-2">Giá đề xuất</div>
          <div className="font-display text-3xl text-bone">
            {price ? formatVnd(parseInt(price)) : '—'}
            <span className="text-rust text-base font-serif italic ml-1">VNĐ</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-line">
          <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mb-2">Phí ký gửi (12%)</div>
          <div className="font-mono text-base text-bone-2">
            {price ? `−${formatVnd(Math.round(parseInt(price) * 0.12))}` : '—'}
          </div>
          <div className="font-mono text-[10px] text-concrete tracking-[0.16em] uppercase mt-3 mb-2">Bạn nhận</div>
          <div className="font-mono text-lg text-rust font-bold">
            {price ? formatVnd(Math.round(parseInt(price) * 0.88)) : '—'}
          </div>
        </div>
      </aside>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          background: var(--color-ink);
          border: 1px solid var(--line-strong);
          color: var(--color-bone);
          padding: 0.75rem 1rem;
          font-family: var(--font-body);
          font-size: 0.875rem;
          transition: border-color 0.15s;
        }
        :global(.form-input:focus) {
          border-color: var(--color-rust);
          outline: none;
        }
      `}</style>
    </form>
  );
}

function FormSection({ number, title, subtitle, children }: { number: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border border-line p-6 bg-ink-2/40">
      <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-line">
        <span className="font-display text-2xl text-rust">{number}</span>
        <h2 className="font-display text-lg uppercase tracking-[-0.01em]">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-concrete mb-4 leading-[1.5]">{subtitle}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-bone-2 tracking-[0.14em] uppercase mb-2">
        {label} {required && <span className="text-rust">*</span>}
      </label>
      {children}
      {hint && <div className="mt-1 font-mono text-[10px] text-concrete tracking-[0.06em]">{hint}</div>}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-dotted border-line text-sm">
      <span className="font-mono text-[10px] text-concrete tracking-[0.14em] uppercase">{label}</span>
      <span className="text-bone-2 truncate ml-3 max-w-[180px] text-right">{value}</span>
    </div>
  );
}
