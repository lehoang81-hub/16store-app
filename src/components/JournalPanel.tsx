'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ActionBtn } from '@/components/ActionBtn';
import {
  getJournalEntries,
  createJournalEntry,
  deleteJournalEntry,
  unlockPremiumImages,
  type JournalEntry,
  type JournalEntryType,
} from '@/lib/actions/journal-actions';
import {
  FREE_IMAGE_LIMIT,
  PREMIUM_IMAGE_LIMIT,
  PREMIUM_HLR_COST,
} from '@/lib/journal-constants';

// ── Compress image before upload (93% rule) ─────────────────
async function compressImage(file: File, maxSize: number, quality: number): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg', quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Upload ảnh lên Cloudinary ─────────────────────────────────
const CLOUD_NAME    = 'donkfupjv';
const UPLOAD_PRESET = '16store_identify';

async function uploadJournalImage(file: File, passportId: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    // Chỉ dùng folder — unsigned preset không cho phép custom public_id
    formData.append('folder', `16store/journal/${passportId}`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error('[Cloudinary upload FAILED]', JSON.stringify(err));
      return null;
    }

    const data = await res.json();
    console.log('[Cloudinary upload OK]', data.secure_url);
    const url = data.secure_url as string;
    // CDN optimized
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_800/');
  } catch (err) {
    console.error('[uploadJournalImage] error:', err);
    return null;
  }
}

// ── Entry type config ─────────────────────────────────────────

const ENTRY_TYPES: { id: JournalEntryType; label: string; icon: string; color: string }[] = [
  { id: 'experience', label: 'Trải nghiệm', icon: '⭐', color: '#d4af37' },
  { id: 'repair',     label: 'Sửa chữa',    icon: '🔧', color: '#6ec070' },
  { id: 'memory',     label: 'Kỷ niệm',     icon: '💭', color: '#c8531c' },
  { id: 'location',   label: 'Địa điểm',    icon: '📍', color: '#5DCAA5' },
  { id: 'other',      label: 'Khác',         icon: '📌', color: '#888' },
];

// ── Props ─────────────────────────────────────────────────────

interface Props {
  passportId:      string;
  objectType:      string;
  objectLabel:     string;
  isOwner:         boolean;
  userHlr?:        number;
  isBorrower?:     boolean;   // Đang mượn → được ghi nhật ký
  borrowerHandle?: string;    // Handle của người mượn
}

// ── Component ─────────────────────────────────────────────────

export function JournalPanel({ passportId, objectType, objectLabel, isOwner, userHlr = 0, isBorrower = false, borrowerHandle = '' }: Props) {
  const [entries, setEntries]     = useState<JournalEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<JournalEntryType | 'all'>('all');
  const [adding, setAdding]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Form state
  const [newType, setNewType]       = useState<JournalEntryType>('experience');
  const [newTitle, setNewTitle]     = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate]       = useState(new Date().toISOString().split('T')[0]);
  const [newImages, setNewImages]   = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Premium
  const [isPremium, setIsPremium]   = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgrading, setUpgrading]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset file input value so same file can be re-selected
  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    const data = await getJournalEntries(passportId);
    setEntries(data);
    // Check premium + image count
    const total = data.reduce((s, e) => s + (e.image_urls?.length ?? 0), 0);
    setTotalImages(total);
    setIsPremium(data.some(e => e.is_premium));
    setLoading(false);
  }, [passportId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const imageLimit = isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
  const imagesLeft = Math.max(0, imageLimit - totalImages);

  // Filter + search
  const filtered = entries.filter(e => {
    if (e.title === '✦ Nâng cấp gói ảnh Premium') return false;
    // Borrower chỉ thấy entries của mình + system entries
    if (isBorrower && !isOwner) {
      if (!(e as any).is_system && (e as any).written_by_role !== 'borrower') return false;
    }
    const matchFilter = filter === 'all' || e.entry_type === filter;
    const matchSearch = !search || [e.title, e.content].some(t =>
      t.toLowerCase().includes(search.toLowerCase())
    );
    return matchFilter && matchSearch;
  });

  // Upload image
  const handleImageUpload = useCallback(async (files: FileList) => {
    if (!files.length) return;
    const remaining = imagesLeft - newImages.length;
    if (remaining <= 0) {
      setError(`Đã đạt giới hạn ảnh cho entry này. ${imagesLeft} ảnh còn lại.`);
      return;
    }

    setUploadingImg(true);
    setError(null);
    const toUpload = Array.from(files).slice(0, remaining);
    const uploaded: string[] = [];

    for (const file of toUpload) {
      // Compress before upload
      const compressed = await compressImage(file, 1080, 0.75);
      const url = await uploadJournalImage(compressed, passportId);
      if (url) uploaded.push(url);
    }

    if (uploaded.length === 0) {
      setError('Upload ảnh thất bại. Xem Console để biết chi tiết lỗi.');
    } else if (uploaded.length < toUpload.length) {
      setError(`Chỉ upload được ${uploaded.length}/${toUpload.length} ảnh.`);
    }

    setNewImages(prev => [...prev, ...uploaded]);
    resetFileInput(); // ← Reset để có thể chọn lại cùng file
    setUploadingImg(false);
  }, [imagesLeft, newImages.length, passportId]);

  // Submit entry
  const handleSubmit = useCallback(async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSubmitting(true);
    setError(null);

    const result = await createJournalEntry({
      passportId,
      entryType:      newType,
      title:          newTitle.trim(),
      content:        newContent.trim(),
      entryDate:      newDate,
      imageUrls:      newImages,
      isPublic:       true,
      writtenByRole:  isBorrower ? 'borrower' : 'owner',
    });

    setSubmitting(false);
    console.log('[handleSubmit] result:', JSON.stringify(result));
    if (result.success) {
      setAdding(false);
      setNewTitle('');
      setNewContent('');
      setNewImages([]);
      setNewType('experience');
      setNewDate(new Date().toISOString().split('T')[0]);
      resetFileInput();
      showSuccess('✓ Đã lưu nhật ký thành công!');
      await loadEntries();
    } else {
      setError(result.error ?? 'Lỗi không xác định — xem Console');
      console.error('[handleSubmit] error:', result.error);
    }
  }, [passportId, newType, newTitle, newContent, newDate, newImages, loadEntries]);

  // Delete entry
  const handleDelete = useCallback(async (entryId: string) => {
    if (!window.confirm('Xoá nhật ký này?')) return;
    await deleteJournalEntry(entryId);
    await loadEntries();
  }, [loadEntries]);

  // Upgrade premium
  const handleUpgrade = useCallback(async () => {
    setUpgrading(true);
    const result = await unlockPremiumImages(passportId);
    setUpgrading(false);
    if (result.success) {
      setIsPremium(true);
      setShowUpgrade(false);
      await loadEntries();
    } else {
      setError(result.error ?? 'Lỗi nâng cấp');
    }
  }, [passportId, loadEntries]);

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] text-rust tracking-[0.2em] uppercase flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
          Nhật ký {objectLabel}
        </div>
        <div className="font-mono text-[9px] text-concrete">
          {entries.filter(e => e.title !== '✦ Nâng cấp gói ảnh Premium').length} sự kiện
        </div>
      </div>

      {/* Image quota bar */}
      <div className="border border-line p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[9px] text-concrete tracking-[0.12em] uppercase">
            Kho ảnh nhật ký
            {isPremium && (
              <span className="ml-2 text-[#d4af37]">✦ Premium</span>
            )}
          </div>
          <div className="font-mono text-[9px] text-bone">
            {totalImages}/{imageLimit} ảnh
          </div>
        </div>
        <div className="h-1 bg-line w-full rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (totalImages / imageLimit) * 100)}%`,
              background: totalImages >= imageLimit ? '#ef4444' : totalImages >= imageLimit * 0.8 ? '#d4af37' : '#6ec070',
            }}
          />
        </div>
        {!isPremium && totalImages >= FREE_IMAGE_LIMIT * 0.6 && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="font-mono text-[9px] text-[#d4af37] tracking-[0.1em] uppercase hover:underline"
          >
            ✦ Nâng cấp {PREMIUM_IMAGE_LIMIT} ảnh · {PREMIUM_HLR_COST} HLR →
          </button>
        )}
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <div className="border border-[#d4af37]/40 bg-[#d4af37]/5 p-4 space-y-3">
          <div className="font-mono text-[10px] text-[#d4af37] tracking-[0.15em] uppercase">
            ✦ Gói ảnh Premium
          </div>
          <div className="space-y-1 font-mono text-[11px] text-bone-2">
            <div>· Tăng từ {FREE_IMAGE_LIMIT} → {PREMIUM_IMAGE_LIMIT} ảnh nhật ký</div>
            <div>· Ảnh lưu vĩnh viễn trên Cloudinary CDN</div>
            <div>· Tốc độ tải nhanh toàn cầu</div>
            <div>· Chi phí: <span className="text-[#d4af37] font-bold">{PREMIUM_HLR_COST} HLR</span></div>
          </div>
          <div className="font-mono text-[9px] text-concrete">HLR hiện có: {userHlr}</div>
          {error && <div className="font-mono text-[10px] text-rust">{error}</div>}
          <div className="flex gap-3">
            <button
              onClick={handleUpgrade}
              disabled={upgrading || userHlr < PREMIUM_HLR_COST}
              className="flex-1 bg-[#d4af37] text-ink py-2 font-mono text-[10px] font-bold tracking-[0.15em] uppercase disabled:opacity-40"
            >
              {upgrading ? 'Đang nâng cấp...' : `Nâng cấp · ${PREMIUM_HLR_COST} HLR`}
            </button>
            <button onClick={() => setShowUpgrade(false)} className="border border-line text-concrete px-4 py-2 font-mono text-[9px] uppercase">
              Huỷ
            </button>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="border border-[#6ec070] bg-[#6ec070]/10 px-4 py-3 font-mono text-[11px] text-[#6ec070] flex items-center gap-2 animate-pulse">
          {successMsg}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 max-sm:flex-col">
        <input
          type="text"
          placeholder={`🔍 Tìm trong nhật ký ${objectLabel}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2"
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none"
        >
          <option value="all">Tất cả</option>
          {ENTRY_TYPES.map(t => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-8 font-mono text-[11px] text-concrete">
            Đang tải nhật ký...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 font-mono text-[11px] text-concrete">
            {search
              ? `Không tìm thấy "${search}" trong nhật ký`
              : `Chưa có nhật ký nào cho ${objectLabel} này`}
          </div>
        ) : (
          filtered.map(entry => {
            const typeMeta = ENTRY_TYPES.find(t => t.id === entry.entry_type)!;
            return (
              <div key={entry.id} className={`p-4 space-y-2 border ${
                (entry as any).is_system
                  ? 'border-rust/20 bg-rust/[0.03]'
                  : 'border-line'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span style={{ fontSize: 16, color: typeMeta.color, flexShrink: 0 }}>
                      {typeMeta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="font-mono text-[11px] font-bold text-bone truncate">
                          {entry.title}
                        </div>
                        {(entry as any).is_system && (
                          <span className="font-mono text-[7px] tracking-[0.1em] uppercase px-1.5 py-0.5 bg-rust/10 text-rust border border-rust/20 flex-shrink-0">
                            AUTO
                          </span>
                        )}
                        {(entry as any).written_by_role === 'borrower' && (
                          <span className="font-mono text-[7px] tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[#5DCAA5]/10 text-[#5DCAA5] border border-[#5DCAA5]/20 flex-shrink-0">
                            ✍️ Người mượn
                          </span>
                        )}
                      </div>
                      <div className="font-body text-sm text-bone-2 leading-[1.5] whitespace-pre-line">
                        {entry.content}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono text-[9px] text-concrete tracking-[0.1em]">
                          {new Date(entry.entry_date).toLocaleDateString('vi-VN')}
                        </span>
                        {!(entry as any).is_system && (
                          <span
                            className="font-mono text-[8px] tracking-[0.08em] uppercase px-1.5 py-0.5"
                            style={{ color: typeMeta.color, border: `0.5px solid ${typeMeta.color}40`, background: `${typeMeta.color}10` }}
                          >
                            {typeMeta.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isOwner && !(entry as any).is_system && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="font-mono text-[9px] text-concrete hover:text-rust transition-colors flex-shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Images */}
                {entry.image_urls && entry.image_urls.length > 0 && (
                  <div className={`grid gap-2 mt-2 ${
                    entry.image_urls.length === 1 ? 'grid-cols-1' :
                    entry.image_urls.length === 2 ? 'grid-cols-2' :
                    'grid-cols-3'
                  }`}>
                    {entry.image_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Ảnh ${i + 1}`}
                          className="w-full border border-line hover:opacity-80 transition-opacity"
                          style={{ aspectRatio: '1', objectFit: 'cover' }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add entry form — owner only */}
      {(isOwner || isBorrower) && (
        adding ? (
          <div className="border border-rust/30 bg-rust/5 p-4 space-y-3">
            <div className="font-mono text-[9px] text-rust tracking-[0.15em] uppercase">
              Thêm nhật ký mới
            </div>

            {/* Type selector — ActionBtn cinematic */}
            <div className="flex gap-2 flex-wrap">
              {ENTRY_TYPES.map(t => (
                <ActionBtn
                  key={t.id}
                  icon={t.icon}
                  label={t.label}
                  active={newType === t.id}
                  accentColor={t.color}
                  onClick={() => setNewType(t.id)}
                />
              ))}
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder="Tiêu đề..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              maxLength={100}
              className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none focus:border-bone-2"
            />

            {/* Content */}
            <textarea
              placeholder={`Kể câu chuyện của bạn với ${objectLabel} này...`}
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full bg-ink border border-line text-bone text-sm p-2 font-mono resize-none focus:outline-none focus:border-bone-2"
            />
            <div className="font-mono text-[8px] text-concrete text-right">{newContent.length}/500</div>

            {/* Date */}
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="bg-ink border border-line text-bone text-sm p-2 font-mono focus:outline-none"
            />

            {/* Image upload */}
            <div>
              <div className="font-mono text-[9px] text-concrete tracking-[0.12em] uppercase mb-2 flex items-center justify-between">
                <span>Ảnh đính kèm ({newImages.length} ảnh)</span>
                <span className={`font-bold text-[11px] tracking-[0.08em] ${
                  imagesLeft === 0 ? 'text-rust' :
                  imagesLeft <= 2 ? 'text-hazard' :
                  'text-[#6ec070]'
                }`}>
                  📦 Còn {imagesLeft}/{imageLimit} ảnh
                </span>
              </div>

              {/* Image previews */}
              {newImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {newImages.map((url, i) => (
                    <div key={i} className="relative">
                      <img
                        src={url}
                        alt={`Ảnh ${i + 1}`}
                        className="w-full border border-line"
                        style={{ aspectRatio: '1', objectFit: 'cover' }}
                      />
                      <button
                        onClick={() => setNewImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 bg-ink/80 text-rust w-4 h-4 flex items-center justify-center font-mono text-[8px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              {imagesLeft > 0 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => e.target.files && handleImageUpload(e.target.files)}
                  />
                  <ActionBtn
                    icon="📷"
                    label={uploadingImg ? 'Đang upload...' : 'Thêm ảnh'}
                    loading={uploadingImg}
                    onClick={() => fileInputRef.current?.click()}
                  />
                </>
              )}

              {/* Upgrade prompt */}
              {imagesLeft <= 0 && !isPremium && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="w-full border border-[#d4af37]/30 text-[#d4af37] py-2 font-mono text-[9px] tracking-[0.12em] uppercase hover:border-[#d4af37] transition-colors"
                >
                  ✦ Đã dùng hết {FREE_IMAGE_LIMIT} ảnh miễn phí · Nâng cấp {PREMIUM_HLR_COST} HLR →
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="font-mono text-[10px] text-rust border border-rust/30 bg-rust/5 p-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <ActionBtn
                  icon={submitting ? '⟳' : '✦'}
                  label={submitting ? 'Đang lưu...' : 'Lưu nhật ký'}
                  loading={submitting}
                  disabled={!newTitle.trim() || !newContent.trim()}
                  active={!!(newTitle.trim() && newContent.trim()) && !submitting}
                  fullWidth
                  onClick={handleSubmit}
                />
              </div>
              <ActionBtn
                icon="✕"
                label="Huỷ"
                onClick={() => { setAdding(false); setError(null); setNewImages([]); resetFileInput(); }}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <ActionBtn
              icon="📝"
              label="Thêm nhật ký mới"
              onClick={() => setAdding(true)}
            />
          </div>
        )
      )}
    </div>
  );
}
