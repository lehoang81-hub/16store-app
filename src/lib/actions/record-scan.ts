'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/telegram/send';

export interface RecordScanInput {
  passport_id: string;
  qr_code: string;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  user_agent: string;
  referrer: string;
}

// ── "The First" Claim Status ──────────────────────────────────
export type ClaimStatus =
  | 'claimed_by_you'        // Bạn đã là "The First"
  | 'already_claimed'       // Người khác đã claim trước
  | 'window_open'           // Cửa sổ mở, chưa ai claim
  | 'window_expired'        // Hết 48h
  | 'not_eligible'          // Không đủ điều kiện (chưa đăng nhập, không phải owner...)
  | 'claimed_just_now';     // Vừa claim thành công ngay lúc này

export interface FirstClaimResult {
  status: ClaimStatus;
  // Chi tiết cho từng trường hợp
  claimed_at?: string;          // Khi đã có người claim
  claimed_by_handle?: string;   // Handle của người đã claim (ẩn nếu không phải owner)
  window_expires_at?: string;   // Khi cửa sổ còn mở
  window_expired_at?: string;   // Khi cửa sổ đã đóng
  message: string;              // Thông báo rõ ràng cho user
  badge?: string;               // Badge hiển thị trên UI
}

export interface RecordScanResult {
  success: boolean;
  error?: string;
  first_claim: FirstClaimResult;
  identity_status?: string;
  fraud_warning?: {
    risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    detail: string;
  } | null;
}

/**
 * Record scan + Identity Engine với "The First" claim protection.
 *
 * Nguyên tắc bảo vệ:
 * 1. Chỉ 1 người duy nhất được là "The First" — không thể tranh giành
 * 2. Phải check atomic (single query) để tránh race condition
 * 3. Thông báo cực kỳ rõ ràng cho mọi trường hợp
 * 4. Log đầy đủ để audit sau này
 */
export async function recordScan(input: RecordScanInput): Promise<RecordScanResult> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();

  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    null;

  const supabase = createServiceClient();

  // ── Lấy asset đầy đủ thông tin ──────────────────────────────
  const { data: asset, error: assetError } = await supabase
    .from('universal_assets')
    .select(`
      id, owner_id, is_lost, post_id, qr_code,
      identity_status, security_tier,
      claim_window_expires_at,
      first_claimant_id, first_claimed_at,
      object_type, attributes
    `)
    .eq('id', input.passport_id)
    .single();

  if (assetError || !asset) {
    return {
      success: false,
      error: 'Không tìm thấy vật phẩm',
      first_claim: {
        status: 'not_eligible',
        message: 'Vật phẩm không tồn tại trong hệ thống.',
        badge: '⚠️ KHÔNG TÌM THẤY',
      },
    };
  }

  // ── Xác định scan type ───────────────────────────────────────
  let scanType = 'public_view';
  let currentUserHandle: string | null = null;

  if (authUser) {
    const { data: userData } = await authClient
      .from('users_view')
      .select('role, handle')
      .eq('auth_id', authUser.id)
      .single();

    currentUserHandle = userData?.handle ?? null;

    if (['hub_admin', 'super_admin'].includes(userData?.role ?? '')) {
      scanType = 'hub_intake';
    } else if (asset.owner_id === authUser.id) {
      scanType = 'owner_check';
    } else if (asset.is_lost === true) {
      scanType = 'lost_found_finder';
    }
  }

  // ── Reverse geocode ──────────────────────────────────────────
  let city: string | null = null;
  if (input.location_lat && input.location_lng) {
    city = await reverseGeocode(input.location_lat, input.location_lng);
  }

  // ── Duplicate scan check ─────────────────────────────────────
  let isMeaningful = true;
  if (input.location_lat && input.location_lng) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentScans } = await supabase
      .from('scan_events')
      .select('location_lat, location_lng')
      .eq('passport_id', input.passport_id)
      .gte('created_at', oneHourAgo)
      .limit(5);

    isMeaningful = !(recentScans ?? []).some((s) => {
      if (!s.location_lat || !s.location_lng) return false;
      return haversineDistance(
        s.location_lat as number, s.location_lng as number,
        input.location_lat!, input.location_lng!
      ) < 0.5;
    });
  }

  // ── Insert scan event ────────────────────────────────────────
  await supabase.from('scan_events').insert({
    passport_id: input.passport_id,
    scanned_by_user_id: authUser?.id ?? null,
    scan_type: scanType,
    location_lat: input.location_lat,
    location_lng: input.location_lng,
    location_accuracy_m: input.location_accuracy_m,
    city,
    country: 'VN',
    user_agent: input.user_agent,
    ip_address: ipAddress,
    referrer: input.referrer,
    is_meaningful: isMeaningful,
  });

  // ── "The First" Claim Logic ──────────────────────────────────
  const firstClaimResult = await processFirstClaim({
    asset,
    authUserId: authUser?.id ?? null,
    currentUserHandle,
    scanType,
    locationLat: input.location_lat,
    locationLng: input.location_lng,
    locationAccuracyM: input.location_accuracy_m,
    supabase,
  });

  // ── Anti-fraud check ─────────────────────────────────────────
  let fraudWarning = null;
  if (input.location_lat && input.location_lng && asset.identity_status !== 'unverified') {
    fraudWarning = await checkFraud({
      asset,
      locationLat: input.location_lat,
      locationLng: input.location_lng,
      currentUserId: authUser?.id ?? null,
      supabase,
    });
  }

  // ── Lost item notification ───────────────────────────────────
  if (asset.is_lost === true && asset.owner_id) {
    const attrs    = (asset.attributes as any) ?? {};
    const itemName = `${asset.brand ?? attrs.brand ?? ''} ${asset.model ?? attrs.model ?? ''}`.trim();

    const locationStr = city
      ? `${city}${input.location_accuracy_m ? ` (±${input.location_accuracy_m}m)` : ''}`
      : input.location_lat
      ? `${input.location_lat.toFixed(4)}°N, ${input.location_lng?.toFixed(4)}°E`
      : 'Không xác định';

    // Scanner info — nếu đã login thì biết họ là ai
    let scannerInfo = '👤 Người scan: <b>Ẩn danh</b>';
    if (currentUserHandle && asset.owner_id !== authUser?.id) {
      scannerInfo = `👤 Người scan: <b>@${currentUserHandle}</b>`;
    }

    const timeStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    await sendNotification({
      user_id: asset.owner_id,
      event: 'shoe_scan_lost' as any,
      payload: {
        qr_code:   asset.qr_code,
        location:  locationStr,
        scanner:   currentUserHandle ?? 'anonymous',
        timestamp: new Date().toISOString(),
      },
      message:
        `🚨 <b>CÓ NGƯỜI SCAN VẬT PHẨM ĐANG BÁO MẤT!</b>\n\n` +
        `📦 <b>${itemName}</b>\n` +
        `🔑 <code>${asset.qr_code}</code>\n\n` +
        `${scannerInfo}\n` +
        `📍 Vị trí: ${locationStr}\n` +
        `🕒 ${timeStr}\n\n` +
        `<i>Nếu đây là người tìm thấy, họ có thể liên hệ bạn qua link bên dưới.</i>\n` +
        `🔗 https://16store.app/p/${asset.qr_code}`,
    });
  }

  return {
    success: true,
    first_claim: firstClaimResult,
    identity_status: asset.identity_status ?? 'unverified',
    fraud_warning: fraudWarning,
  };
}

// ── "The First" Core Logic ────────────────────────────────────
async function processFirstClaim({
  asset,
  authUserId,
  currentUserHandle,
  scanType,
  locationLat,
  locationLng,
  locationAccuracyM,
  supabase,
}: {
  asset: any;
  authUserId: string | null;
  currentUserHandle: string | null;
  scanType: string;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyM: number | null;
  supabase: any;
}): Promise<FirstClaimResult> {

  const now = new Date();
  const windowExpiry = asset.claim_window_expires_at
    ? new Date(asset.claim_window_expires_at)
    : null;

  // ── CASE 1: Đã có người claim trước ────────────────────────
  if (asset.first_claimant_id) {

    // Sub-case: Chính bạn là The First
    if (authUserId && asset.first_claimant_id === authUserId) {
      return {
        status: 'claimed_by_you',
        claimed_at: asset.first_claimed_at,
        message:
          `✨ Bạn chính là "THE FIRST" của vật phẩm này!\n` +
          `Định danh lúc: ${new Date(asset.first_claimed_at).toLocaleString('vi-VN')}\n` +
          `Danh hiệu này được lưu vĩnh viễn — không ai thay đổi được.`,
        badge: '⭐ THE FIRST · BẠN LÀ NGƯỜI ĐẦU TIÊN',
      };
    }

    // Sub-case: Người khác đã claim — thông báo cực kỳ rõ ràng
    // Chỉ show handle nếu là owner hiện tại hoặc admin
    const showHandle = scanType === 'owner_check' || scanType === 'hub_intake';
    let claimedByInfo = 'Một người dùng khác';

    if (showHandle && asset.first_claimant_id) {
      const { data: firstOwner } = await supabase
        .from('users_view')
        .select('handle, display_name')
        .eq('id', asset.first_claimant_id)
        .single();
      claimedByInfo = firstOwner?.handle
        ? `@${firstOwner.handle}`
        : 'Người dùng ẩn danh';
    }

    return {
      status: 'already_claimed',
      claimed_at: asset.first_claimed_at,
      claimed_by_handle: showHandle ? claimedByInfo : undefined,
      message:
        `🔒 Vật phẩm này đã được định danh "THE FIRST" bởi ${claimedByInfo}.\n` +
        `Thời điểm: ${new Date(asset.first_claimed_at).toLocaleString('vi-VN')}\n\n` +
        `Quyền "THE FIRST" là bất biến — không thể tranh giành hay thu hồi.\n` +
        `Bạn chỉ có thể thêm trải nghiệm của riêng mình vào lịch sử vật phẩm.`,
      badge: '🔒 ĐÃ ĐƯỢC ĐỊNH DANH',
    };
  }

  // ── CASE 2: Chưa ai claim, check window ────────────────────

  // Window đã hết hạn
  if (windowExpiry && now > windowExpiry) {
    return {
      status: 'window_expired',
      window_expired_at: asset.claim_window_expires_at,
      message:
        `⏰ Cửa sổ "THE FIRST" đã đóng lúc ${windowExpiry.toLocaleString('vi-VN')}.\n` +
        `Không ai định danh trong 48h đầu tiên.\n\n` +
        `Vật phẩm này không có chủ sở hữu "THE FIRST" chính thức.`,
      badge: '⏰ CỬA SỔ ĐÃ ĐÓNG',
    };
  }

  // Không đủ điều kiện claim (chưa đăng nhập hoặc không phải owner)
  if (!authUserId || scanType !== 'owner_check') {
    const timeLeft = windowExpiry
      ? Math.max(0, Math.floor((windowExpiry.getTime() - now.getTime()) / 3600000))
      : 0;

    return {
      status: 'not_eligible',
      window_expires_at: asset.claim_window_expires_at,
      message:
        `🕐 Cửa sổ "THE FIRST" đang mở — còn ${timeLeft}h.\n` +
        `Chỉ chủ sở hữu đã đăng nhập mới có thể định danh.\n\n` +
        `Nếu đây là giày của bạn, hãy đăng nhập và scan để trở thành "THE FIRST".`,
      badge: `🕐 CỬA SỔ MỞ · CÒN ${timeLeft}H`,
    };
  }

  // ── CASE 3: Đủ điều kiện — Thực hiện claim ─────────────────
  // Dùng UPDATE với WHERE first_claimant_id IS NULL để tránh race condition
  const { data: updateResult, error: updateError } = await supabase
    .from('universal_assets')
    .update({
      first_claimant_id: authUserId,
      first_claimed_at: now.toISOString(),
      identity_status: 'verified',
    })
    .eq('id', asset.id)
    .is('first_claimant_id', null)  // ← Atomic check: chỉ update nếu chưa có ai claim
    .select('first_claimant_id')
    .single();

  // Race condition: Ai đó vừa claim cùng lúc
  if (updateError || !updateResult || updateResult.first_claimant_id !== authUserId) {
    // Lấy lại thông tin người vừa claim
    const { data: latestAsset } = await supabase
      .from('universal_assets')
      .select('first_claimant_id, first_claimed_at')
      .eq('id', asset.id)
      .single();

    console.warn(`[recordScan] Race condition detected: passport ${asset.id}`);

    return {
      status: 'already_claimed',
      claimed_at: latestAsset?.first_claimed_at,
      message:
        `⚡ Rất tiếc! Có người vừa định danh vật phẩm này cùng lúc với bạn.\n\n` +
        `Quyền "THE FIRST" đã thuộc về người scan trước đó vài giây.\n` +
        `Lịch sử của bạn với vật phẩm này vẫn được ghi nhận.`,
      badge: '⚡ VỪA ĐƯỢC ĐỊNH DANH',
    };
  }

  // ── CLAIM THÀNH CÔNG ────────────────────────────────────────

  // Ghi spatial_identity_claims
  const spatialHash = locationLat && locationLng
    ? generateSpatialHash(locationLat, locationLng, asset.id)
    : `no-location:${asset.id.substring(0, 8)}`;

  await supabase.from('spatial_identity_claims').insert({
    passport_id: asset.id,
    claimant_id: authUserId,
    location_lat: locationLat,
    location_lng: locationLng,
    location_accuracy_m: locationAccuracyM,
    spatial_hash: spatialHash,
    qr_type: 'temp',
    is_first_claim: true,
    first_claim_window_expires_at: asset.claim_window_expires_at,
    status: 'pending',  // Chờ AI verify (Sprint B)
    ai_model: 'gemini-2.5-flash',
  });

  // Notify owner (chính là người claim)
  await sendNotification({
    user_id: authUserId,
    event: 'post_verified' as any,
    payload: { passport_id: asset.id, qr_code: asset.qr_code },
    message:
      `⭐ <b>Chúc mừng! Bạn là "THE FIRST"!</b>\n\n` +
      `Bạn vừa định danh vật phẩm này đầu tiên trong lịch sử.\n\n` +
      `Vật phẩm: ${(asset.attributes as any)?.brand ?? ''} ${(asset.attributes as any)?.model ?? ''}\n` +
      `QR: <code>${asset.qr_code}</code>\n\n` +
      `Danh hiệu này được ghi vĩnh viễn — không ai thay đổi được.\n` +
      `🔗 16store.app/passport/${asset.qr_code}`,
  });

  console.log(`[recordScan] THE FIRST claimed: ${asset.id} by ${authUserId} (@${currentUserHandle})`);

  const timeLeft = windowExpiry
    ? Math.max(0, Math.floor((windowExpiry.getTime() - now.getTime()) / 3600000))
    : 0;

  return {
    status: 'claimed_just_now',
    claimed_at: now.toISOString(),
    message:
      `⭐ CHÚC MỪNG! Bạn vừa trở thành "THE FIRST"!\n\n` +
      `Bạn là người đầu tiên định danh vật phẩm này.\n` +
      `Khoảnh khắc này được ghi vĩnh viễn:\n` +
      `📍 ${locationLat ? await reverseGeocodeSimple(locationLat, locationLng!) : 'Vị trí không xác định'}\n` +
      `🕒 ${now.toLocaleString('vi-VN')}\n\n` +
      `Không ai có thể lấy đi danh hiệu này của bạn.`,
    badge: '⭐ THE FIRST · VỪA ĐỊNH DANH',
  };
}

// ── Anti-fraud check ──────────────────────────────────────────
async function checkFraud({
  asset,
  locationLat,
  locationLng,
  currentUserId,
  supabase,
}: {
  asset: any;
  locationLat: number;
  locationLng: number;
  currentUserId: string | null;
  supabase: any;
}): Promise<RecordScanResult['fraud_warning']> {

  const { data: existingClaims } = await supabase
    .from('spatial_identity_claims')
    .select('spatial_hash, location_lat, location_lng, claimant_id, is_first_claim, created_at')
    .eq('passport_id', asset.id)
    .eq('status', 'approved')
    .limit(5);

  if (!existingClaims || existingClaims.length === 0) return null;

  for (const claim of existingClaims) {
    if (!claim.location_lat || !claim.location_lng) continue;
    if (claim.claimant_id === currentUserId) continue;  // Chính chủ thì OK

    const dist = haversineDistance(
      claim.location_lat, claim.location_lng,
      locationLat, locationLng
    );

    if (dist > 500) {
      return {
        risk_level: 'HIGH',
        message: '⚠️ CẢNH BÁO: Vật phẩm này có thể là hàng gian!',
        detail:
          `Vật phẩm đã được định danh tại địa điểm cách đây ${Math.round(dist)}km.\n` +
          `Không thể là cùng 1 vật phẩm xuất hiện ở 2 nơi cách xa như vậy.\n` +
          `Thời điểm định danh gốc: ${new Date(claim.created_at).toLocaleString('vi-VN')}`,
      };
    }

    if (dist > 50) {
      return {
        risk_level: 'MEDIUM',
        message: '⚠️ Lưu ý: Vị trí scan khác xa so với lần định danh ban đầu',
        detail:
          `Khoảng cách: ${Math.round(dist)}km so với lần định danh đầu tiên.\n` +
          `Có thể bình thường nếu vật phẩm đã được chuyển nhượng.`,
      };
    }
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────

function generateSpatialHash(lat: number, lng: number, assetId: string): string {
  const latR = Math.round(lat * 10000) / 10000;
  const lngR = Math.round(lng * 10000) / 10000;
  return `${latR}:${lngR}:${assetId.substring(0, 8)}`;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const cities = [
    { name: 'Hà Nội', lat: 21.0285, lng: 105.8542, radius: 30 },
    { name: 'HCM', lat: 10.7626, lng: 106.6602, radius: 50 },
    { name: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, radius: 25 },
    { name: 'Hải Phòng', lat: 20.8449, lng: 106.6881, radius: 25 },
    { name: 'Cần Thơ', lat: 10.0452, lng: 105.7469, radius: 20 },
    { name: 'Nha Trang', lat: 12.2388, lng: 109.1967, radius: 15 },
    { name: 'Đà Lạt', lat: 11.9404, lng: 108.4583, radius: 10 },
    { name: 'Huế', lat: 16.4637, lng: 107.5909, radius: 15 },
  ];
  for (const city of cities) {
    if (haversineDistance(lat, lng, city.lat, city.lng) <= city.radius) return city.name;
  }
  return null;
}

async function reverseGeocodeSimple(lat: number, lng: number): Promise<string> {
  const city = await reverseGeocode(lat, lng);
  return city ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
