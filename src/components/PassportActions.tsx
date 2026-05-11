'use client';

import { useState, useRef, useCallback } from 'react';
import { ActionBtn } from '@/components/ActionBtn';
import { JournalPanel } from '@/components/JournalPanel';
import { useRouter } from 'next/navigation';
import { HeritageListing } from '@/components/HeritageListing';
import type { AssetData } from '@/lib/actions/generate-heritage-visual';
import { executeTransfer, lookupTransferRecipient, type TransferType } from '@/lib/actions/transfer-actions';
import {
  initiateLoan,
  confirmLoan,
  returnLoan,
  escalateLoan,
} from '@/lib/actions/loan-actions';

interface Props {
  defaultPanel?: string; 
  passportId: string;
  qrCode: string;
  assetId: string;
  objectType: string;
  brand: string;
  model: string;
  colorway?: string;
  isOwner: boolean;
  isLost: boolean;
  isBorrowing?: boolean;
  activeLoanId?: string;
  identityStatus: string;
  securityTier: string;
  userHlr?: number;
  isFirstAsset?: boolean;
  serialNumber?: string;
  cities?: number;
  scans?: number;
  owners?: number;
  firstClaimant?: string;
  createdAt?: string;
}

type Panel = 'none' | 'loan' | 'transfer' | 'journal' | 'listing';

export function PassportActions({
  passportId, qrCode, assetId, objectType,
  brand, model, colorway, isOwner, isLost,
  isBorrowing, activeLoanId, defaultPanel,
  identityStatus, securityTier,
  userHlr = 0, isFirstAsset = false,
  serialNumber = 'STD #000001',
  cities = 0, scans = 0, owners = 1,
  firstClaimant, createdAt,
}: Props) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>((defaultPanel as Panel) ?? 'none');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: string; title: string; message: string } | null>(null);

  // Loan form state — Step machine
  const [loanStep, setLoanStep]             = useState<'search'|'terms'|'preview'|'done'>('search');
  const [borrowerHandle, setBorrowerHandle] = useState('');
  const [borrowerInfo, setBorrowerInfo]     = useState<{handle:string;name:string;hlr:number;trust:number}|null>(null);
  const [borrowerLoading, setBorrowerLoading] = useState(false);
  const [borrowerError, setBorrowerError]   = useState<string|null>(null);
  const [weeks, setWeeks]                   = useState(4);
  const [weeklyRate, setWeeklyRate]         = useState(15);
  const [loanNote, setLoanNote]             = useState('');
  const [loanContext, setLoanContext]        = useState('');  // Hoàn cảnh cho mượn
  const [loanLocation, setLoanLocation]     = useState(''); // Địa điểm bàn giao
  const [handoverImages, setHandoverImages] = useState<string[]>([]); // Max 2 ảnh
  const [termsAgreed, setTermsAgreed]       = useState(false);
  const [showTerms, setShowTerms]           = useState(false);
  const [imgUploading, setImgUploading]     = useState(false);
  const loanImgRef = useRef<HTMLInputElement>(null);

  // Transfer state
  const [transferStep, setTransferStep]         = useState<'search'|'terms'|'preview'|'done'>('search');
  const [recipientHandle, setRecipientHandle]   = useState('');
  const [recipientInfo, setRecipientInfo]       = useState<{id:string;handle:string;name:string;trust:number;totalAssets:number}|null>(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError]     = useState<string|null>(null);
  const [transferType, setTransferType]         = useState<TransferType>('gift');
  const [transferPrice, setTransferPrice]       = useState('');
  const [transferNote, setTransferNote]         = useState('');
  const [transferContext, setTransferContext]   = useState('');
  const [transferLocation, setTransferLocation] = useState('');
  const [transferImages, setTransferImages]     = useState<string[]>([]);
  const [transferTermsAgreed, setTransferTermsAgreed] = useState(false);
  const [transferImgUploading, setTransferImgUploading] = useState(false);
  const [showTransferTerms, setShowTransferTerms] = useState(false);
  const transferImgRef = useRef<HTMLInputElement>(null);

  const objectLabel = objectType === 'sneaker' ? 'giày' : objectType === 'watch' ? 'đồng hồ' : objectType === 'bag' ? 'túi' : 'vật phẩm';

  function showToast(t: typeof toast) {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }

  // ── Transfer handlers ────────────────────────────────────────

  const lookupRecipient = useCallback(async (handle: string) => {
    if (!handle.trim() || handle.length < 2) { setRecipientInfo(null); return; }
    setRecipientLoading(true);
    setRecipientError(null);
    const result = await lookupTransferRecipient(handle);
    if (result.success && result.user) {
      setRecipientInfo(result.user);
    } else {
      setRecipientError(result.error ?? 'Không tìm thấy');
      setRecipientInfo(null);
    }
    setRecipientLoading(false);
  }, []);

  const uploadTransferImage = useCallback(async (file: File) => {
    if (transferImages.length >= 2) return;
    setTransferImgUploading(true);
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', '16store_identify');
    form.append('folder', `16store/transfers/${assetId}`);
    const res = await fetch('https://api.cloudinary.com/v1_1/donkfupjv/image/upload', { method:'POST', body:form });
    if (res.ok) {
      const data = await res.json();
      const url = (data.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto,w_800/');
      setTransferImages(prev => [...prev, url]);
    }
    setTransferImgUploading(false);
  }, [transferImages, assetId]);

  async function handleExecuteTransfer() {
    setLoading(true);
    let lat: number | undefined, lng: number | undefined, acc: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      acc = Math.round(pos.coords.accuracy);
    } catch {}

    const result = await executeTransfer({
      assetId,
      recipientHandle,
      transferType,
      priceVnd:          transferType === 'sale' && transferPrice ? Number(transferPrice.replace(/\D/g,'')) : undefined,
      note:              transferNote || undefined,
      handoverContext:   transferContext || undefined,
      handoverLocation:  transferLocation || undefined,
      handoverImageUrls: transferImages,
      lat, lng, accuracyM: acc,
    });
    setLoading(false);
    showToast(result.toast);
    if (result.success) setTransferStep('done');
  }

  // Auto-show pending state when opening loan panel
  const handleOpenLoanPanel = () => {
    if (panel === 'loan') {
      setPanel('none');
      return;
    }
    // Nếu đang có loan pending → hiện DONE state
    if (activeLoanId) {
      setLoanStep('done');
    } else {
      setLoanStep('search');
    }
    setPanel('loan');
  };

  // ── Loan handlers ─────────────────────────────────────────

  const lookupBorrower = useCallback(async (handle: string) => {
    if (!handle.trim() || handle.length < 2) { setBorrowerInfo(null); return; }
    setBorrowerLoading(true);
    setBorrowerError(null);
    try {
      const res = await fetch(`/api/users/lookup?handle=${encodeURIComponent(handle.replace('@',''))}`);
      if (!res.ok) { setBorrowerError('Không tìm thấy người dùng này'); setBorrowerInfo(null); return; }
      const data = await res.json();
      setBorrowerInfo(data);
    } catch { setBorrowerError('Lỗi kết nối'); }
    finally { setBorrowerLoading(false); }
  }, []);

  const uploadHandoverImage = useCallback(async (file: File) => {
    if (handoverImages.length >= 2) return;
    setImgUploading(true);
    const loanTempId = crypto.randomUUID();
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', '16store_identify');
    form.append('folder', `16store/loans/${loanTempId}/handover`);
    const res = await fetch('https://api.cloudinary.com/v1_1/donkfupjv/image/upload', { method:'POST', body:form });
    if (res.ok) {
      const data = await res.json();
      const url = (data.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto,w_800/');
      setHandoverImages(prev => [...prev, url]);
    }
    setImgUploading(false);
  }, [handoverImages]);

  async function handleInitiateLoan() {
    if (!borrowerHandle.trim()) return;
    setLoading(true);
    const result = await initiateLoan({
      assetId,
      borrowerHandle,
      weeks,
      weeklyHlrRate: weeklyRate,
      loanNote: loanNote || undefined,
      handoverContext: loanContext || undefined,
      handoverLocation: loanLocation || undefined,
      handoverImageUrls: handoverImages,
    });
    setLoading(false);
    showToast(result.toast);
    if (result.success) {
      setLoanStep('done');
      // Không router.refresh() ở đây — sẽ reset state
    }
  }

  async function handleConfirmLoan() {
    if (!activeLoanId) return;
    setLoading(true);
    let lat: number | undefined, lng: number | undefined, acc: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      acc = Math.round(pos.coords.accuracy);
    } catch {}
    const result = await confirmLoan({ loanId: activeLoanId, lat, lng, accuracyM: acc });
    setLoading(false);
    showToast(result.toast);
    if (result.success) router.refresh();
  }

  async function handleReturnLoan() {
    if (!activeLoanId) return;
    setLoading(true);
    let lat: number | undefined, lng: number | undefined, acc: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      acc = Math.round(pos.coords.accuracy);
    } catch {}
    const result = await returnLoan({ loanId: activeLoanId, lat, lng, accuracyM: acc });
    setLoading(false);
    showToast(result.toast);
    if (result.success) router.refresh();
  }

  async function handleEscalate(action: 'extend' | 'report_lost' | 'freeze') {
    if (!activeLoanId) return;
    const confirm = window.confirm(
      action === 'freeze' ? '⚠️ Bạn chắc chắn muốn đóng băng tài khoản người mượn?' :
      action === 'report_lost' ? '🚨 Báo mất sẽ trừ 20 điểm uy tín của người mượn. Tiếp tục?' :
      'Gia hạn thêm 1 tuần?'
    );
    if (!confirm) return;
    setLoading(true);
    const result = await escalateLoan({ loanId: activeLoanId, action });
    setLoading(false);
    showToast(result.toast);
    if (result.success) router.refresh();
  }

  return (
    <div className="border border-line mb-10">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 border font-mono text-sm
          ${toast.type === 'success' ? 'border-[#6ec070] bg-[#6ec070]/10 text-[#6ec070]' :
            toast.type === 'warning' ? 'border-hazard bg-hazard/10 text-hazard' :
            'border-rust bg-rust/10 text-rust'}`}
        >
          <div className="font-bold text-[11px] tracking-[0.14em] uppercase mb-1">{toast.title}</div>
          <div className="text-[11px] leading-[1.5] whitespace-pre-line">{toast.message}</div>
        </div>
      )}

      {/* Action buttons — prominent styling */}
      <div className="flex flex-col bg-ink-2">

        {/* Lock notice when loan active */}
        {isOwner && !!activeLoanId && (
          <div className="px-4 py-2 border-b border-[#d4af37]/20 bg-[#d4af37]/5 font-mono text-[9px] text-[#d4af37] tracking-[0.1em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse inline-block" />
            Đang có hợp đồng cho mượn · Chuyển nhượng và Ký gửi tạm khoá cho đến khi trả đồ
          </div>
        )}

        <div className="p-4 flex flex-wrap gap-2">

        {/* Owner actions */}
        {isOwner && !isLost && !isBorrowing && (
          <>
            <ActionBtn
              label="Cho mượn"
              icon="🤝"
              active={panel === 'loan'}
              onClick={handleOpenLoanPanel}
            />
            <ActionBtn
              label="Chuyển nhượng"
              icon="🔄"
              active={panel === 'transfer'}
              disabled={!!activeLoanId}
              onClick={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')}
            />
            <ActionBtn
              label="Ký gửi bán"
              icon="🏷️"
              active={panel === 'listing'}
              disabled={!!activeLoanId}
              onClick={() => setPanel(panel === 'listing' ? 'none' : 'listing')}
            />

          </>
        )}

        {/* Owner + active loan */}
        {isOwner && activeLoanId && (
          <>
            <ActionBtn label="Gia hạn" icon="📅" onClick={() => handleEscalate('extend')} loading={loading} />
            <ActionBtn label="Báo mất" icon="🚨" danger onClick={() => handleEscalate('report_lost')} loading={loading} />
            <ActionBtn label="Đóng băng" icon="🔒" danger onClick={() => handleEscalate('freeze')} loading={loading} />
          </>
        )}

        {/* Borrower actions */}
        {isBorrowing && activeLoanId && (
          <ActionBtn
            label="Xác nhận trả đồ"
            icon="✅"
            onClick={handleReturnLoan}
            loading={loading}
          />
        )}

        {/* Pending loan — borrower chưa confirm */}
        {!isOwner && activeLoanId && !isBorrowing && (
          <ActionBtn
            label="Xác nhận nhận đồ"
            icon="📦"
            onClick={handleConfirmLoan}
            loading={loading}
          />
        )}

        {/* Nhật ký — always */}
        <ActionBtn
          label="Nhật ký"
          icon="📝"
          active={panel === 'journal'}
          onClick={() => setPanel(panel === 'journal' ? 'none' : 'journal')}
        />
        </div>
      </div>

      {/* ── Panel: Cho mượn ──────────────────────────────────── */}
      {panel === 'loan' && (
        <div className="border-t border-line p-5 space-y-4">
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Cho mượn {objectLabel}
            <span className="ml-auto font-mono text-[8px] text-concrete">
              {loanStep === 'search' ? '1/3 Tìm người mượn' : loanStep === 'terms' ? '2/3 Điều khoản' : '3/3 Xác nhận'}
            </span>
          </div>

          {/* ── STEP A: Tìm người mượn ──────────────────── */}
          {loanStep === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  @Handle người mượn *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="@tranngoc"
                    value={borrowerHandle}
                    onChange={e => { setBorrowerHandle(e.target.value); setBorrowerInfo(null); setBorrowerError(null); }}
                    onKeyDown={e => e.key === 'Enter' && lookupBorrower(borrowerHandle)}
                    className="flex-1 bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2"
                  />
                  <ActionBtn
                    icon="🔍"
                    label="Tìm"
                    loading={borrowerLoading}
                    active={!!borrowerInfo}
                    onClick={() => lookupBorrower(borrowerHandle)}
                  />
                </div>
                {borrowerError && !borrowerLoading && (
                  <div className="font-mono text-[10px] text-rust mt-1">{borrowerError}</div>
                )}
              </div>

              {/* Borrower profile card */}
              {borrowerInfo && (
                <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#6ec070]/20 border border-[#6ec070]/40 flex items-center justify-center font-mono text-[12px] text-[#6ec070] font-bold flex-shrink-0">
                    {borrowerInfo.handle.substring(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold text-bone">{borrowerInfo.name}</div>
                    <div className="font-mono text-[9px] text-concrete">@{borrowerInfo.handle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-[10px] text-[#d4af37]">{borrowerInfo.hlr} HLR</div>
                    <div className="font-mono text-[9px] text-concrete">Trust: {borrowerInfo.trust}</div>
                  </div>
                  {borrowerInfo.hlr < weeklyRate && (
                    <div className="font-mono text-[9px] text-rust mt-1 w-full">
                      ⚠️ Không đủ HLR tuần đầu ({weeklyRate} cần, có {borrowerInfo.hlr})
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Số tuần *</label>
                <div className="flex gap-2">
                  {[1,2,4,8,12].map(w => (
                    <ActionBtn key={w} icon="" label={`${w}W`} active={weeks===w} onClick={() => setWeeks(w)} />
                  ))}
                </div>
              </div>

              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  HLR Rate / tuần * <span className="text-concrete/50">(tham số động)</span>
                </label>
                <div className="flex items-center gap-4">
                  <input type="range" min="1" max="100" value={weeklyRate}
                    onChange={e => setWeeklyRate(Number(e.target.value))} className="flex-1" />
                  <div className="font-display text-2xl text-rust min-w-[80px] text-right">{weeklyRate} HLR</div>
                </div>
                <div className="font-mono text-[9px] text-concrete mt-1">
                  Bạn nhận: <span className="text-[#6ec070]">{Math.round(weeklyRate*0.53)} HLR/tuần</span> ·
                  Platform: <span className="text-concrete/70">{weeklyRate-Math.round(weeklyRate*0.53)} HLR/tuần</span> ·
                  Tổng ước tính: <span className="text-bone font-bold">{weeklyRate*weeks} HLR</span>
                </div>
              </div>

              <div className="flex gap-3">
                <div style={{flex:1}}>
                  <ActionBtn icon="→" label="Tiếp theo: Điều khoản"
                    active={!!borrowerInfo && borrowerInfo.hlr >= weeklyRate}
                    disabled={!borrowerInfo || borrowerInfo.hlr < weeklyRate}
                    fullWidth
                    onClick={() => setLoanStep('terms')} />
                </div>
                <ActionBtn icon="✕" label="Huỷ" onClick={() => { setPanel('none'); setLoanStep('search'); setBorrowerInfo(null); }} />
              </div>
            </div>
          )}

          {/* ── STEP B+C: Điều khoản + Chi tiết ─────────── */}
          {loanStep === 'terms' && (
            <div className="space-y-4">

              {/* Dropdown quy định */}
              <div className="border border-line">
                <button
                  onClick={() => setShowTerms(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2 hover:text-bone transition-colors"
                >
                  <span>📋 Quy định cho mượn qua 16Store</span>
                  <span>{showTerms ? '▲' : '▼'}</span>
                </button>
                {showTerms && (
                  <div className="border-t border-line px-4 py-3 space-y-2">
                    {[
                      `💰 Người mượn trả ${weeklyRate} HLR/tuần · Bạn nhận ${Math.round(weeklyRate*0.53)} HLR/tuần`,
                      '📅 Charge tự động mỗi tuần — không cần làm gì thêm',
                      '⚠️ Trả đúng hạn → người mượn nhận +5 HLR bonus',
                      '🚨 Quá hạn 2 tuần → tự động escalate, trừ reputation',
                      '🔒 Nếu làm mất → báo mất → trừ tối đa 20 điểm uy tín người mượn',
                      '❌ HLR phí cho mượn KHÔNG hoàn lại nếu huỷ',
                      '📸 Ảnh bàn giao là bằng chứng trạng thái — lưu vĩnh viễn',
                    ].map((rule, i) => (
                      <div key={i} className="font-mono text-[10px] text-bone-2 leading-[1.6]">{rule}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Điều kiện bảo quản */}
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Điều kiện bảo quản</label>
                <textarea value={loanNote} onChange={e => setLoanNote(e.target.value)}
                  placeholder={`VD: Không mang ${objectLabel} đi xa quá 50km, bảo quản trong hộp...`}
                  rows={2} className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono resize-none focus:outline-none focus:border-bone-2" />
              </div>

              {/* Hoàn cảnh + Địa điểm */}
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <div>
                  <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Hoàn cảnh cho mượn</label>
                  <input type="text" value={loanContext} onChange={e => setLoanContext(e.target.value)}
                    placeholder="VD: Bạn bè lâu năm, tin tưởng..."
                    className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2" />
                </div>
                <div>
                  <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Địa điểm bàn giao</label>
                  <input type="text" value={loanLocation} onChange={e => setLoanLocation(e.target.value)}
                    placeholder="VD: Quán cafe ABC, Hà Nội..."
                    className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2" />
                </div>
              </div>

              {/* Ảnh bàn giao (tối đa 2) */}
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  Ảnh bàn giao · Tối đa 2 ảnh <span className="text-concrete/50">(bằng chứng trạng thái)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {handoverImages.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={url} className="w-full h-full object-cover border border-line" />
                      <button onClick={() => setHandoverImages(p => p.filter((_,j) => j!==i))}
                        className="absolute top-0 right-0 bg-ink/80 text-rust w-5 h-5 flex items-center justify-center font-mono text-[9px]">✕</button>
                    </div>
                  ))}
                  {handoverImages.length < 2 && (
                    <>
                      <input ref={loanImgRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && uploadHandoverImage(e.target.files[0])} />
                      <button onClick={() => loanImgRef.current?.click()} disabled={imgUploading}
                        className="w-20 h-20 border border-dashed border-line text-concrete flex flex-col items-center justify-center gap-1 hover:border-rust hover:text-rust transition-colors disabled:opacity-40">
                        <span style={{fontSize:18}}>📷</span>
                        <span className="font-mono text-[7px] uppercase">{imgUploading ? '...' : 'Thêm ảnh'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Checkbox đồng ý */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={termsAgreed} onChange={e => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 flex-shrink-0" />
                <span className="font-mono text-[10px] text-bone-2 leading-[1.6]">
                  Tôi đã đọc quy định và đồng ý cho mượn theo hợp đồng số 16Store. Hiểu rằng HLR phí sẽ không được hoàn lại.
                </span>
              </label>

              <div className="flex gap-3">
                <ActionBtn icon="←" label="Quay lại" onClick={() => setLoanStep('search')} />
                <div style={{flex:1}}>
                  <ActionBtn icon="→" label="Xem hợp đồng số"
                    active={termsAgreed} disabled={!termsAgreed} fullWidth
                    onClick={() => setLoanStep('preview')} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP D: Preview Hợp đồng số ─────────────── */}
          {loanStep === 'preview' && (
            <div className="space-y-4">
              <div className="border border-rust/30 bg-rust/5 p-4 space-y-3">
                <div className="font-mono text-[9px] text-rust tracking-[0.2em] uppercase text-center">
                  ✦ HỢP ĐỒNG SỐ · DIGITAL HANDSHAKE
                </div>

                {/* Asset */}
                <div className="border-t border-line/40 pt-3">
                  <div className="font-mono text-[8px] text-concrete uppercase mb-1">Vật phẩm</div>
                  <div className="font-mono text-[11px] font-bold text-bone">{brand} {model}</div>
                  <div className="font-mono text-[9px] text-concrete">{qrCode}</div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-3">
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Người cho</div>
                    <div className="font-mono text-[10px] text-bone font-bold">@{qrCode.split('-')[0]}</div>
                  </div>
                  {borrowerInfo && (
                    <div>
                      <div className="font-mono text-[8px] text-concrete uppercase mb-1">Người mượn</div>
                      <div className="font-mono text-[10px] text-bone font-bold">@{borrowerInfo.handle}</div>
                      <div className="font-mono text-[9px] text-concrete">Trust: {borrowerInfo.trust} · {borrowerInfo.hlr} HLR</div>
                    </div>
                  )}
                </div>

                {/* Time + HLR */}
                <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-3">
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Thời gian</div>
                    <div className="font-mono text-[10px] text-bone">{weeks} tuần</div>
                    <div className="font-mono text-[9px] text-concrete">
                      Đến: {new Date(Date.now() + weeks*7*86400000).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">HLR</div>
                    <div className="font-mono text-[10px] text-rust font-bold">{weeklyRate} HLR/tuần</div>
                    <div className="font-mono text-[9px] text-concrete">Tổng: {weeklyRate*weeks} HLR</div>
                  </div>
                </div>

                {/* Context + Location */}
                {(loanContext || loanLocation) && (
                  <div className="border-t border-line/40 pt-3 space-y-1">
                    {loanContext && <div className="font-mono text-[9px] text-bone-2">💬 {loanContext}</div>}
                    {loanLocation && <div className="font-mono text-[9px] text-bone-2">📍 {loanLocation}</div>}
                  </div>
                )}

                {/* Handover images */}
                {handoverImages.length > 0 && (
                  <div className="border-t border-line/40 pt-3">
                    <div className="font-mono text-[8px] text-concrete uppercase mb-2">Ảnh bàn giao ({handoverImages.length}/2)</div>
                    <div className="flex gap-2">
                      {handoverImages.map((url, i) => (
                        <img key={i} src={url} className="w-16 h-16 object-cover border border-line" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Note */}
                {loanNote && (
                  <div className="border-t border-line/40 pt-3">
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Điều kiện</div>
                    <div className="font-mono text-[9px] text-bone-2 italic">"{loanNote}"</div>
                  </div>
                )}

                <div className="font-mono text-[8px] text-concrete italic text-center border-t border-line/40 pt-3">
                  GPS + thời gian sẽ được ghi nhận khi người mượn xác nhận nhận đồ
                </div>
              </div>

              <div className="flex gap-3">
                <ActionBtn icon="←" label="Sửa lại" onClick={() => setLoanStep('terms')} />
                <div style={{flex:1}}>
                  <ActionBtn
                    icon="✦" label={loading ? 'Đang gửi...' : 'Gửi gắm — Khởi động Kindness'}
                    active loading={loading} fullWidth
                    onClick={handleInitiateLoan}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP DONE: Chờ borrower confirm ─────────── */}
          {loanStep === 'done' && (
            <div className="space-y-4">
              <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-4 space-y-3">
                <div className="font-mono text-[10px] text-[#6ec070] font-bold tracking-[0.15em] uppercase">
                  ✓ Yêu cầu đã gửi thành công!
                </div>
                <div className="font-mono text-[10px] text-bone-2 leading-[1.6]">
                  @{borrowerHandle.replace('@','')} đã nhận thông báo qua Telegram.<br/>
                  Hợp đồng sẽ có hiệu lực sau khi người mượn xác nhận nhận đồ bằng cách scan QR vật phẩm.
                </div>
                <div className="border border-line/40 p-3 space-y-1.5">
                  <div className="font-mono text-[9px] text-concrete uppercase mb-1">Trạng thái hợp đồng</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse inline-block"/>
                    <span className="font-mono text-[10px] text-[#d4af37]">Đang chờ borrower xác nhận</span>
                  </div>
                  <div className="font-mono text-[9px] text-concrete leading-[1.6]">
                    Khi @{borrowerHandle.replace('@','')} scan QR và bấm "Xác nhận nhận đồ" →<br/>
                    GPS + thời gian được ghi nhận → HLR tuần đầu bị trừ → Hợp đồng active.
                  </div>
                </div>
              </div>
              <ActionBtn
                icon="✕" label="Đóng"
                onClick={() => { setPanel('none'); setLoanStep('search'); setBorrowerInfo(null); setBorrowerHandle(''); router.refresh(); }}
              />
            </div>
          )}
        </div>
      )}



      {/* ── Panel: Chuyển nhượng ────────────────────────────── */}
      {panel === 'transfer' && (
        <div className="border-t border-line p-5 space-y-4">
          <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
            Chuyển nhượng {objectLabel}
            <span className="ml-auto font-mono text-[8px] text-concrete">
              {transferStep === 'search' ? '1/3 Người nhận' : transferStep === 'terms' ? '2/3 Điều khoản' : transferStep === 'preview' ? '3/3 Hợp đồng số' : 'Hoàn tất'}
            </span>
          </div>

          {/* ── STEP 1: Tìm người nhận ──────────────────────── */}
          {transferStep === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  @Handle người nhận *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="@nguoinhan"
                    value={recipientHandle}
                    onChange={e => { setRecipientHandle(e.target.value); setRecipientInfo(null); setRecipientError(null); }}
                    onKeyDown={e => e.key === 'Enter' && lookupRecipient(recipientHandle)}
                    className="flex-1 bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2"
                  />
                  <ActionBtn icon="🔍" label="Tìm" loading={recipientLoading}
                    active={!!recipientInfo} onClick={() => lookupRecipient(recipientHandle)} />
                </div>
                {recipientError && !recipientLoading && (
                  <div className="font-mono text-[10px] text-rust mt-1">{recipientError}</div>
                )}
              </div>

              {/* Recipient card */}
              {recipientInfo && (
                <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#6ec070]/20 border border-[#6ec070]/40 flex items-center justify-center font-mono text-[12px] text-[#6ec070] font-bold flex-shrink-0">
                    {recipientInfo.handle.substring(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[11px] font-bold text-bone">{recipientInfo.name}</div>
                    <div className="font-mono text-[9px] text-concrete">@{recipientInfo.handle}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-mono text-[10px] text-[#d4af37]">Trust: {recipientInfo.trust}</div>
                    <div className="font-mono text-[9px] text-concrete">{recipientInfo.totalAssets} vật phẩm</div>
                  </div>
                </div>
              )}

              {/* Transfer type */}
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-2">
                  Hình thức chuyển nhượng *
                </label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: 'gift',        label: '🎁 Tặng',      color: '#6ec070' },
                    { id: 'sale',        label: '💰 Mua bán',   color: '#d4af37' },
                    { id: 'trade',       label: '🔄 Trao đổi',  color: '#5DCAA5' },
                    { id: 'inheritance', label: '👑 Thừa kế',   color: '#C8531C' },
                  ] as const).map(t => (
                    <button key={t.id} onClick={() => setTransferType(t.id)}
                      className="px-3 py-2 font-mono text-[9px] tracking-[0.1em] uppercase border transition-all"
                      style={{
                        borderColor: transferType === t.id ? t.color : 'rgba(255,255,255,0.1)',
                        background:  transferType === t.id ? `${t.color}15` : 'transparent',
                        color:       transferType === t.id ? t.color : 'rgba(255,255,255,0.4)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price if sale */}
              {transferType === 'sale' && (
                <div>
                  <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                    Giá trị giao dịch (VNĐ)
                  </label>
                  <input type="text" value={transferPrice}
                    onChange={e => setTransferPrice(e.target.value)}
                    placeholder="VD: 5000000"
                    className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2" />
                  {transferPrice && (
                    <div className="font-mono text-[9px] text-[#d4af37] mt-1">
                      ≈ {new Intl.NumberFormat('vi-VN').format(Number(transferPrice.replace(/\D/g,'')))} VNĐ
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <div style={{flex:1}}>
                  <ActionBtn icon="→" label="Tiếp theo: Điều khoản"
                    active={!!recipientInfo} disabled={!recipientInfo}
                    fullWidth onClick={() => setTransferStep('terms')} />
                </div>
                <ActionBtn icon="✕" label="Huỷ"
                  onClick={() => { setPanel('none'); setTransferStep('search'); setRecipientInfo(null); }} />
              </div>
            </div>
          )}

          {/* ── STEP 2: Điều khoản + Chi tiết ──────────────── */}
          {transferStep === 'terms' && (
            <div className="space-y-4">

              {/* Quy định dropdown */}
              <div className="border border-line">
                <button onClick={() => setShowTransferTerms(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 font-mono text-[10px] tracking-[0.14em] uppercase text-bone-2 hover:text-bone transition-colors">
                  <span>📋 Quy định chuyển nhượng 16Store</span>
                  <span>{showTransferTerms ? '▲' : '▼'}</span>
                </button>
                {showTransferTerms && (
                  <div className="border-t border-line px-4 py-3 space-y-2">
                    {[
                      '🔒 Chuyển nhượng là VĨNH VIỄN — không thể hoàn tác sau khi xác nhận',
                      '📜 Lịch sử ownership được ghi vĩnh viễn vào blockchain-style journal',
                      '🤝 Cả hai bên đều nhận thông báo Telegram xác nhận',
                      '⚠️ Vật phẩm đang cho mượn hoặc báo mất không thể chuyển nhượng',
                      '📸 Ảnh bàn giao là bằng chứng trạng thái — lưu Cloudinary vĩnh viễn',
                      '🏆 Soul Score +30 điểm sau mỗi lần chuyển nhượng thành công',
                      '💰 Nếu là giao dịch mua bán: hệ thống chỉ ghi nhận, không xử lý tiền mặt',
                    ].map((rule, i) => (
                      <div key={i} className="font-mono text-[10px] text-bone-2 leading-[1.6]">{rule}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ghi chú cho người nhận */}
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  Ghi chú cho @{recipientInfo?.handle}
                </label>
                <textarea value={transferNote} onChange={e => setTransferNote(e.target.value)}
                  placeholder="VD: Chăm sóc cẩn thận nhé, đây là kỷ niệm..."
                  rows={2} className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono resize-none focus:outline-none focus:border-bone-2" />
              </div>

              {/* Hoàn cảnh + Địa điểm */}
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <div>
                  <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Hoàn cảnh</label>
                  <input type="text" value={transferContext} onChange={e => setTransferContext(e.target.value)}
                    placeholder="VD: Sinh nhật bạn thân, kỷ niệm..."
                    className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2" />
                </div>
                <div>
                  <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">Địa điểm bàn giao</label>
                  <input type="text" value={transferLocation} onChange={e => setTransferLocation(e.target.value)}
                    placeholder="VD: Hà Nội, Hoàn Kiếm..."
                    className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2" />
                </div>
              </div>

              {/* Ảnh bàn giao (max 2) */}
              <div>
                <label className="font-mono text-[9px] text-concrete tracking-[0.15em] uppercase block mb-1">
                  Ảnh bàn giao · Tối đa 2 ảnh <span className="text-concrete/50">(bằng chứng trạng thái)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {transferImages.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img src={url} className="w-full h-full object-cover border border-line" />
                      <button onClick={() => setTransferImages(p => p.filter((_,j) => j!==i))}
                        className="absolute top-0 right-0 bg-ink/80 text-rust w-5 h-5 flex items-center justify-center font-mono text-[9px]">✕</button>
                    </div>
                  ))}
                  {transferImages.length < 2 && (
                    <>
                      <input ref={transferImgRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && uploadTransferImage(e.target.files[0])} />
                      <button onClick={() => transferImgRef.current?.click()} disabled={transferImgUploading}
                        className="w-20 h-20 border border-dashed border-line text-concrete flex flex-col items-center justify-center gap-1 hover:border-rust hover:text-rust transition-colors disabled:opacity-40">
                        <span style={{fontSize:18}}>📷</span>
                        <span className="font-mono text-[7px] uppercase">{transferImgUploading ? '...' : 'Thêm ảnh'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Checkbox đồng ý */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={transferTermsAgreed} onChange={e => setTransferTermsAgreed(e.target.checked)} className="mt-0.5 flex-shrink-0" />
                <span className="font-mono text-[10px] text-bone-2 leading-[1.6]">
                  Tôi hiểu rằng chuyển nhượng là vĩnh viễn và không thể hoàn tác. Đồng ý tiếp tục.
                </span>
              </label>

              <div className="flex gap-3">
                <ActionBtn icon="←" label="Quay lại" onClick={() => setTransferStep('search')} />
                <div style={{flex:1}}>
                  <ActionBtn icon="→" label="Xem hợp đồng số"
                    active={transferTermsAgreed} disabled={!transferTermsAgreed}
                    fullWidth onClick={() => setTransferStep('preview')} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Hợp đồng số ─────────────────────────── */}
          {transferStep === 'preview' && (
            <div className="space-y-4">
              <div className="border border-rust/30 bg-rust/5 p-4 space-y-3">
                <div className="font-mono text-[9px] text-rust tracking-[0.2em] uppercase text-center">
                  ✦ HỢP ĐỒNG CHUYỂN NHƯỢNG · DIGITAL TRANSFER
                </div>

                {/* Asset */}
                <div className="border-t border-line/40 pt-3">
                  <div className="font-mono text-[8px] text-concrete uppercase mb-1">Vật phẩm</div>
                  <div className="font-mono text-[11px] font-bold text-bone">{brand} {model}</div>
                  <div className="font-mono text-[9px] text-concrete">{qrCode}</div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-3">
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Người chuyển</div>
                    <div className="font-mono text-[10px] text-rust font-bold">Bạn (chủ hiện tại)</div>
                  </div>
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Người nhận</div>
                    <div className="font-mono text-[10px] text-[#6ec070] font-bold">@{recipientInfo?.handle}</div>
                    <div className="font-mono text-[9px] text-concrete">{recipientInfo?.name}</div>
                  </div>
                </div>

                {/* Transfer details */}
                <div className="grid grid-cols-2 gap-3 border-t border-line/40 pt-3">
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Hình thức</div>
                    <div className="font-mono text-[10px] text-bone capitalize">{transferType}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Thời điểm</div>
                    <div className="font-mono text-[10px] text-bone">
                      {new Date().toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>

                {/* Price */}
                {transferType === 'sale' && transferPrice && (
                  <div className="border-t border-line/40 pt-3">
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Giá trị</div>
                    <div className="font-mono text-[11px] text-[#d4af37] font-bold">
                      {new Intl.NumberFormat('vi-VN').format(Number(transferPrice.replace(/\D/g,'')))} VNĐ
                    </div>
                  </div>
                )}

                {/* Context + Location */}
                {(transferContext || transferLocation) && (
                  <div className="border-t border-line/40 pt-3 space-y-1">
                    {transferContext && <div className="font-mono text-[9px] text-bone-2">💬 {transferContext}</div>}
                    {transferLocation && <div className="font-mono text-[9px] text-bone-2">📍 {transferLocation}</div>}
                  </div>
                )}

                {/* Handover images */}
                {transferImages.length > 0 && (
                  <div className="border-t border-line/40 pt-3">
                    <div className="font-mono text-[8px] text-concrete uppercase mb-2">Ảnh bàn giao ({transferImages.length}/2)</div>
                    <div className="flex gap-2">
                      {transferImages.map((url, i) => (
                        <img key={i} src={url} className="w-16 h-16 object-cover border border-line" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Note */}
                {transferNote && (
                  <div className="border-t border-line/40 pt-3">
                    <div className="font-mono text-[8px] text-concrete uppercase mb-1">Ghi chú</div>
                    <div className="font-mono text-[9px] text-bone-2 italic">"{transferNote}"</div>
                  </div>
                )}

                {/* Warning */}
                <div className="border border-rust/20 bg-rust/5 p-2 font-mono text-[9px] text-rust text-center">
                  ⚠️ Sau khi xác nhận, quyền sở hữu chuyển VĨNH VIỄN sang @{recipientInfo?.handle}
                </div>
              </div>

              <div className="flex gap-3">
                <ActionBtn icon="←" label="Sửa lại" onClick={() => setTransferStep('terms')} />
                <div style={{flex:1}}>
                  <ActionBtn icon="✦"
                    label={loading ? 'Đang xử lý...' : 'Xác nhận chuyển nhượng'}
                    active loading={loading} fullWidth
                    onClick={handleExecuteTransfer} />
                </div>
              </div>
            </div>
          )}

          {/* ── DONE ─────────────────────────────────────────── */}
          {transferStep === 'done' && (
            <div className="space-y-4">
              <div className="border border-[#6ec070]/30 bg-[#6ec070]/5 p-4 space-y-3">
                <div className="font-mono text-[10px] text-[#6ec070] font-bold tracking-[0.15em] uppercase">
                  ✅ Chuyển nhượng hoàn tất!
                </div>
                <div className="font-mono text-[10px] text-bone-2 leading-[1.6]">
                  {brand} {model} đã thuộc về <span className="text-[#6ec070] font-bold">@{recipientInfo?.handle}</span>.<br/>
                  Cả hai bên đã nhận thông báo Telegram. Lịch sử sở hữu đã được cập nhật.
                </div>
                <div className="font-mono text-[9px] text-concrete">
                  🏆 Soul Score +30 · 📜 Journal đã ghi nhận · 🔗 Ownership chain updated
                </div>
              </div>
              <ActionBtn icon="✕" label="Đóng"
                onClick={() => { setPanel('none'); setTransferStep('search'); setRecipientInfo(null); setRecipientHandle(''); router.refresh(); }} />
            </div>
          )}
        </div>
      )}


      {panel === 'journal' && (
        <div className="border-t border-line p-5">
          <JournalPanel
            passportId={passportId}
            objectType={objectType}
            objectLabel={objectLabel}
            isOwner={isOwner}
            isBorrower={isBorrowing}
            userHlr={userHlr}
          />
        </div>
      )}

      {/* ── Panel: Ký gửi bán di sản ─────────────────────────── */}
      {panel === 'listing' && (
        <div className="border-t border-line">
          <HeritageListing
            assetId={assetId}
            assetData={{
              id: assetId,
              qrCode: qrCode,
              brand: brand,
              model: model,
              colorway: colorway,
              objectType: objectType,
              serialNumber: serialNumber,
              securityTier: securityTier,
              identityStatus: identityStatus,
              cities: cities,
              scans: scans,
              owners: owners,
              firstClaimant: firstClaimant,
              createdAt: createdAt ?? new Date().toISOString(),
            }}
            userHlr={userHlr}
            isFirstAsset={isFirstAsset}
            onClose={() => setPanel('none')}
          />
        </div>
      )}

    </div>
  );
}

