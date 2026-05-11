/**
 * CLOUDINARY UPLOAD INTEGRATION
 * Cloud: donkfupjv
 * Preset: 16store_identify (unsigned)
 * Folder: 16store/identify
 */

const CLOUD_NAME   = 'donkfupjv';
const UPLOAD_PRESET = '16store_identify';
const UPLOAD_URL   = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;        // Secure URL (raw)
  cdnUrl?: string;     // URL với f_auto,q_auto
  publicId?: string;   // Public ID để dùng transforms
  error?: string;
}

export interface AngleUploadResults {
  front?:  CloudinaryUploadResult;
  back?:   CloudinaryUploadResult;
  top?:    CloudinaryUploadResult;
  bottom?: CloudinaryUploadResult;
  left?:   CloudinaryUploadResult;
  right?:  CloudinaryUploadResult;
  hero?:   CloudinaryUploadResult;
}

// ── Upload single image ───────────────────────────────────────

export async function uploadToCloudinary(
  base64DataUrl: string,
  passportId: string,
  angleId: string,
  onProgress?: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', base64DataUrl);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('public_id', `${passportId}/${angleId}`);
    formData.append('folder', `16store/identify`);

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          const rawUrl    = data.secure_url as string;
          const publicId  = data.public_id as string;

          // CDN URL với auto optimization
          const cdnUrl = rawUrl.replace(
            '/upload/',
            '/upload/f_auto,q_auto,w_1080/'
          );

          resolve({ success: true, url: rawUrl, cdnUrl, publicId });
        } else {
          const err = JSON.parse(xhr.responseText);
          resolve({ success: false, error: err.error?.message ?? 'Upload failed' });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error during upload' });
      });

      xhr.open('POST', UPLOAD_URL);
      xhr.send(formData);
    });
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Upload all 7 angles in parallel ──────────────────────────

export async function uploadAllAngles(
  capturedAngles: Record<string, string>,  // { front: base64, back: base64, ... }
  heroImage: string,
  passportId: string,
  onProgress?: (done: number, total: number, currentAngle: string) => void
): Promise<{
  results: AngleUploadResults;
  allUrls: string[];
  coverUrl: string | null;
  imageAngles: Record<string, string>;
  successCount: number;
}> {
  const angleEntries = [
    ...Object.entries(capturedAngles).filter(([id]) =>
      ['front','back','top','bottom','left','right'].includes(id)
    ),
    ['hero', heroImage],
  ] as [string, string][];

  const total   = angleEntries.length;
  let   done    = 0;
  const results: AngleUploadResults = {};
  const imageAngles: Record<string, string> = {};

  // Parallel upload
  await Promise.all(
    angleEntries.map(async ([angleId, base64]) => {
      if (!base64) return;

      const result = await uploadToCloudinary(
        base64,
        passportId,
        angleId,
        (pct) => {
          // Per-file progress (optional)
        }
      );

      results[angleId as keyof AngleUploadResults] = result;

      if (result.success && result.url) {
        imageAngles[angleId] = result.cdnUrl ?? result.url;
      }

      done++;
      onProgress?.(done, total, angleId);
    })
  );

  const allUrls    = Object.values(imageAngles);
  const coverUrl   = imageAngles.hero ?? imageAngles.front ?? allUrls[0] ?? null;
  const successCount = allUrls.length;

  return { results, allUrls, coverUrl, imageAngles, successCount };
}

// ── Build Cloudinary transform URLs ──────────────────────────

export function buildCloudinaryUrl(
  publicId: string,
  transforms: string = 'f_auto,q_auto'
): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`;
}

// ── Build poster background URL (dùng cho Gemini prompt) ─────
// Không tách nền tại Cloudinary (chi phí cao)
// Thay vào đó pass URL raw cho Gemini để xử lý

export function buildHeroUrlForGemini(heroPublicId: string): string {
  // Gemini nhận URL trực tiếp → tự xử lý background removal
  return buildCloudinaryUrl(heroPublicId, 'f_jpg,q_90,w_1080,h_1080,c_fill');
}

// ── Validate upload results ───────────────────────────────────

export function validateUploadResults(results: AngleUploadResults): {
  isValid: boolean;
  missingAngles: string[];
  message: string;
} {
  const required = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  const missing  = required.filter(a => !results[a as keyof AngleUploadResults]?.success);

  if (missing.length > 2) {
    return {
      isValid: false,
      missingAngles: missing,
      message: `Upload thất bại cho ${missing.length} góc: ${missing.join(', ')}. Vui lòng thử lại.`,
    };
  }

  if (!results.hero?.success && !results.front?.success) {
    return {
      isValid: false,
      missingAngles: ['hero'],
      message: 'Ảnh hero không upload được. Cần ít nhất 1 ảnh làm bìa passport.',
    };
  }

  return {
    isValid: true,
    missingAngles: missing,
    message: missing.length > 0
      ? `Upload thành công ${6 - missing.length}/6 góc. Thiếu: ${missing.join(', ')}.`
      : 'Upload đầy đủ 7 ảnh thành công!',
  };
}
