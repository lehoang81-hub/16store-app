'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CaptureData, IdentifyTier } from './IdentifyFlow';
import { OBJECT_TYPES } from '@/lib/capture-guides';

// ── Types ─────────────────────────────────────────────────────

export interface AngleUrls {
  hero?:  string;   // Ảnh chính (bắt buộc)
  extra?: string;   // Ảnh phụ (tuỳ chọn)
}

interface Props {
  tier:      IdentifyTier;
  onCapture: (data: CaptureData & { uploadedUrls: AngleUrls }) => void;
  onBack:    () => void;
}

// ── Cloudinary config ─────────────────────────────────────────
const CLOUD_NAME    = 'donkfupjv';
const UPLOAD_PRESET = '16store_identify';

// ── Client-side image compression ────────────────────────────
async function compressImage(file: File, maxPx = 1080, quality = 0.75): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(URL.createObjectURL(file)); };
    img.src = url;
  });
}

// ── Upload single image to Cloudinary ────────────────────────
async function uploadToCloudinary(base64: string, folder: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('file',          base64);
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder',        folder);

    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST', body: form,
    });
    if (!res.ok) { console.error('[upload]', await res.text()); return null; }
    const data = await res.json();
    return (data.secure_url as string).replace('/upload/', '/upload/f_auto,q_auto,w_1080/');
  } catch (err) {
    console.error('[upload]', err);
    return null;
  }
}

// ── Main Component ────────────────────────────────────────────

export function ScreenGhostFrame({ tier, onCapture, onBack }: Props) {
  const [phase, setPhase] = useState<'setup' | 'capture'>('setup');

  // Setup form
  const [objectType, setObjectType] = useState('sneaker');
  const [brand,      setBrand]      = useState('');
  const [model,      setModel]      = useState('');
  const [colorway,   setColorway]   = useState('');

  // Photos
  const [heroFile,  setHeroFile]  = useState<File | null>(null);
  const [extraFile, setExtraFile] = useState<File | null>(null);
  const [heroPreview,  setHeroPreview]  = useState<string | null>(null);
  const [extraPreview, setExtraPreview] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading]   = useState(false);
  const [progress,  setProgress]    = useState(0);
  const [error,     setError]       = useState<string | null>(null);

  // GPS
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  const heroInputRef  = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const ACCENT = tier === 'elite' ? '#d4af37' : tier === 'heritage' ? '#b8eaff' : '#C8531C';

  // GPS
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  // Handle file select + preview
  const handleFileSelect = useCallback(async (
    file: File,
    setFile: (f: File) => void,
    setPreview: (s: string) => void
  ) => {
    setFile(file);
    const compressed = await compressImage(file, 1080, 0.75);
    setPreview(compressed);
  }, []);

  // Upload + proceed
  const handleUpload = useCallback(async () => {
    if (!heroFile) { setError('Cần ít nhất 1 ảnh chính của vật phẩm'); return; }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const tempId = crypto.randomUUID();
      const folder = `16store/identify/${tempId}`;

      // Compress both images
      setProgress(15);
      const heroBase64  = await compressImage(heroFile,  1080, 0.75);
      const extraBase64 = extraFile ? await compressImage(extraFile, 1080, 0.75) : null;
      setProgress(35);

      // Upload in parallel
      const [heroUrl, extraUrl] = await Promise.all([
        uploadToCloudinary(heroBase64, folder),
        extraBase64 ? uploadToCloudinary(extraBase64, folder) : Promise.resolve(null),
      ]);
      setProgress(90);

      if (!heroUrl) { setError('Upload ảnh thất bại. Kiểm tra kết nối mạng.'); setUploading(false); return; }

      const uploadedUrls: AngleUrls = {
        hero:  heroUrl,
        extra: extraUrl ?? undefined,
      };

      setProgress(100);

      onCapture({
        imageDataUrl: heroUrl,
        lat:          gps?.lat ?? null,
        lng:          gps?.lng ?? null,
        altitude:     null,
        bearing:      null,
        accuracy:     null,
        tier, brand, model, colorway, objectType,
        uploadedUrls,
      } as any);

    } catch (err) {
      setError('Lỗi: ' + String(err));
    } finally {
      setUploading(false);
    }
  }, [heroFile, extraFile, gps, tier, brand, model, colorway, objectType, onCapture]);

  // ── PHASE: SETUP ─────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minHeight: '100vh', padding: '90px 24px 40px',
        position: 'relative', zIndex: 10, gap: 20,
      }}>
        <button onClick={onBack} style={backBtn}>← Quay lại</button>

        {/* Object type */}
        <div style={sectionLabel}>Loại vật phẩm</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, width: '100%', maxWidth: 400 }}>
          {OBJECT_TYPES.map(ot => (
            <button key={ot.id} onClick={() => setObjectType(ot.id)} style={{
              background: objectType === ot.id ? `${ACCENT}15` : 'rgba(255,255,255,0.02)',
              border:     `1px solid ${objectType === ot.id ? ACCENT : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 4, padding: '12px 8px', cursor: 'pointer',
              textAlign: 'center', transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{ot.icon}</div>
              <div style={{
                fontSize: 8, letterSpacing: '0.12em',
                color: objectType === ot.id ? ACCENT : 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase', fontFamily: "'Space Mono',monospace",
              }}>{ot.label}</div>
            </button>
          ))}
        </div>

        {/* Item info */}
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={sectionLabel}>Thông tin vật phẩm</div>
          {[
            { ph: 'Brand (VD: Nike, Rolex...)',       val: brand,    set: setBrand },
            { ph: 'Model (VD: Air Jordan 4...)',       val: model,    set: setModel },
            { ph: 'Colorway / Version (tuỳ chọn)',    val: colorway, set: setColorway },
          ].map((inp, i) => (
            <input key={i} type="text" placeholder={inp.ph} value={inp.val}
              onChange={e => inp.set(e.target.value)}
              style={{
                background:  'rgba(255,255,255,0.05)',
                border:      `0.5px solid ${inp.val.length >= 2 ? ACCENT + '80' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 2, padding: '9px 12px', color: '#fff', fontSize: 11,
                outline: 'none', fontFamily: "'Space Mono',monospace", letterSpacing: '0.08em',
              }}
            />
          ))}
        </div>

        <button
          onClick={() => setPhase('capture')}
          disabled={brand.length < 2 || model.length < 2}
          style={{
            padding: '14px 40px',
            background:   brand.length >= 2 && model.length >= 2 ? ACCENT : 'transparent',
            color:        brand.length >= 2 && model.length >= 2 ? '#fff' : 'rgba(255,255,255,0.2)',
            border:       `1px solid ${brand.length >= 2 && model.length >= 2 ? ACCENT : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 2, fontFamily: "'Space Mono',monospace",
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            cursor:     brand.length >= 2 && model.length >= 2 ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s', width: '100%', maxWidth: 400,
          }}
        >
          Tiếp theo: Chụp ảnh →
        </button>
      </div>
    );
  }

  // ── PHASE: CAPTURE ───────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', padding: '90px 24px 40px',
      position: 'relative', zIndex: 10, gap: 16,
    }}>
      <button onClick={() => setPhase('setup')} style={backBtn}>← Thông tin</button>

      {/* Header */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400 }}>
        <div style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: 10, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: ACCENT, marginBottom: 4,
        }}>
          {brand} · {model}
        </div>
        <div style={{
          fontFamily: "'Space Mono',monospace",
          fontSize: 8, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.15em',
        }}>
          Chụp ảnh vật phẩm — nén tự động trước khi upload
        </div>
      </div>

      {/* Photo slots */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Hero photo (required) */}
        <div>
          <div style={{
            fontFamily: "'Space Mono',monospace", fontSize: 9,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: ACCENT, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              background: ACCENT, color: '#fff', borderRadius: 2,
              padding: '1px 5px', fontSize: 7, fontWeight: 700,
            }}>BẮT BUỘC</span>
            Ảnh chính · Toàn bộ vật phẩm
          </div>

          <input ref={heroInputRef} type="file" accept="image/*"
            capture="environment" className="hidden" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], setHeroFile, setHeroPreview)}
          />

          {heroPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={heroPreview} alt="Hero" style={{
                width: '100%', borderRadius: 4, border: `1px solid ${ACCENT}`,
                maxHeight: 280, objectFit: 'cover',
              }} />
              <button
                onClick={() => { setHeroFile(null); setHeroPreview(null); if (heroInputRef.current) heroInputRef.current.value = ''; }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(10,10,20,0.8)', border: `1px solid ${ACCENT}`,
                  borderRadius: 2, color: ACCENT, cursor: 'pointer',
                  fontFamily: "'Space Mono',monospace", fontSize: 9,
                  padding: '3px 8px', letterSpacing: '0.1em',
                }}
              >
                ✕ Chụp lại
              </button>
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                background: 'rgba(10,10,20,0.8)',
                fontFamily: "'Space Mono',monospace", fontSize: 8,
                color: '#6ec070', padding: '3px 8px', letterSpacing: '0.1em',
              }}>
                ✓ Đã nén · Sẵn sàng upload
              </div>
            </div>
          ) : (
            <button
              onClick={() => heroInputRef.current?.click()}
              style={{
                width: '100%', height: 200,
                border: `2px dashed ${ACCENT}`,
                borderRadius: 4, background: `${ACCENT}08`,
                cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 32 }}>📷</span>
              <span style={{
                fontFamily: "'Space Mono',monospace", fontSize: 9,
                letterSpacing: '0.15em', textTransform: 'uppercase', color: ACCENT,
              }}>
                Chọn hoặc chụp ảnh
              </span>
              <span style={{
                fontFamily: "'Space Mono',monospace", fontSize: 8,
                color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
              }}>
                Tự động nén · max 1080px · JPEG 75%
              </span>
            </button>
          )}
        </div>

        {/* Extra photo (optional) */}
        <div>
          <div style={{
            fontFamily: "'Space Mono',monospace", fontSize: 9,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
              borderRadius: 2, padding: '1px 5px', fontSize: 7,
            }}>TUỲ CHỌN</span>
            Ảnh phụ · Chi tiết / góc khác
          </div>

          <input ref={extraInputRef} type="file" accept="image/*"
            capture="environment" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], setExtraFile, setExtraPreview)}
          />

          {extraPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={extraPreview} alt="Extra" style={{
                width: '100%', borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.15)',
                maxHeight: 160, objectFit: 'cover',
              }} />
              <button
                onClick={() => { setExtraFile(null); setExtraPreview(null); if (extraInputRef.current) extraInputRef.current.value = ''; }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 2, color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  fontFamily: "'Space Mono',monospace", fontSize: 9,
                  padding: '3px 8px',
                }}
              >
                ✕ Xoá
              </button>
            </div>
          ) : (
            <button
              onClick={() => extraInputRef.current?.click()}
              style={{
                width: '100%', height: 100,
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 4, background: 'rgba(255,255,255,0.02)',
                cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 20 }}>📷</span>
              <span style={{
                fontFamily: "'Space Mono',monospace", fontSize: 8,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
              }}>
                + Thêm ảnh phụ (tuỳ chọn)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ width: '100%', maxWidth: 400, gap: 6 }}>
          <div style={{
            fontFamily: "'Space Mono',monospace", fontSize: 9,
            color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 6,
          }}>
            {progress < 35 ? 'Đang nén ảnh...' : progress < 90 ? 'Đang upload lên Cloudinary...' : 'Hoàn tất...'}
            {' '}{progress}%
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
            <div style={{
              height: '100%', background: ACCENT, borderRadius: 1,
              width: `${progress}%`, transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'rgba(226,75,74,0.1)', border: '0.5px solid rgba(226,75,74,0.4)',
          borderRadius: 4, padding: '10px 16px',
          color: '#f09595', fontFamily: "'Space Mono',monospace",
          fontSize: 10, letterSpacing: '0.1em',
        }}>
          {error}
        </div>
      )}

      {/* GPS indicator */}
      <div style={{
        fontFamily: "'Space Mono',monospace", fontSize: 8,
        color: gps ? '#6ec070' : 'rgba(255,255,255,0.2)',
        letterSpacing: '0.1em',
      }}>
        {gps
          ? `✓ GPS: ${gps.lat.toFixed(4)}°N ${gps.lng.toFixed(4)}°E`
          : '○ Đang lấy GPS...'}
      </div>

      {/* CTA */}
      <button
        onClick={handleUpload}
        disabled={!heroPreview || uploading}
        style={{
          padding: '14px 40px', width: '100%', maxWidth: 400,
          background:   heroPreview && !uploading ? ACCENT : 'transparent',
          color:        heroPreview && !uploading ? '#fff' : 'rgba(255,255,255,0.2)',
          border:       `1px solid ${heroPreview && !uploading ? ACCENT : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 2, fontFamily: "'Space Mono',monospace",
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          cursor:     heroPreview && !uploading ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s',
        }}
      >
        {uploading ? `Đang xử lý ${progress}%...` : !heroPreview ? 'Cần ít nhất 1 ảnh' : '✦ Định danh & Khai sinh Passport'}
      </button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────

const backBtn: React.CSSProperties = {
  position: 'absolute', top: 80, left: 24,
  background: 'none', border: 'none',
  color: 'rgba(255,255,255,0.3)',
  fontFamily: "'Space Mono',monospace",
  fontSize: 9, letterSpacing: '0.15em',
  cursor: 'pointer', textTransform: 'uppercase',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 8, letterSpacing: '0.25em',
  color: 'rgba(255,255,255,0.3)',
  textTransform: 'uppercase',
  fontFamily: "'Space Mono',monospace",
  alignSelf: 'flex-start', width: '100%', maxWidth: 400,
};
