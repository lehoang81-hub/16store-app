'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type PosterTier = 'standard' | 'elite';
export type ConceptType = 'archive' | 'lifestyle' | 'emotional';
export type PersonaType = 'dynamic' | 'static' | 'precision';

export interface AssetData {
  id: string;
  qrCode: string;
  brand: string;
  model: string;
  colorway?: string;
  objectType: string;
  serialNumber: string;
  securityTier: string;
  identityStatus: string;
  cities: number;
  scans: number;
  owners: number;
  firstClaimant?: string;
  createdAt: string;
  existingImageUrl?: string;  // Ảnh đã chụp lúc định danh
}

export interface PosterCriteria {
  label: string;
  value: string;
}

export interface ListingInput {
  assetId: string;
  price: number;
  description: string;
  hubCode: string;
  concept: ConceptType;
  tier: PosterTier;
  affiliateHandle: string;
}

export interface GenerateVisualResult {
  success: boolean;
  imageBase64?: string;
  concept?: ConceptType;
  error?: string;
}

export interface GenerateAllResult {
  success: boolean;
  results?: Record<ConceptType, GenerateVisualResult>;
  hlrCharged?: number;
  error?: string;
}

// ── HLR config (tham số động) ─────────────────────────────────
const STANDARD_HLR_COST = 0;
const ELITE_HLR_COST = 20;

// ── Generate poster via Gemini 2.5 ───────────────────────────

export async function generatePoster(input: {
  assetData: AssetData;
  concept: ConceptType;
  listingInfo: { price: number; description: string };
  tier: PosterTier;
  affiliateHandle: string;
}): Promise<GenerateVisualResult> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return { success: false, error: 'GEMINI_API_KEY chưa được cấu hình' };
  }

  const { assetData, concept, listingInfo, affiliateHandle } = input;
  const persona = detectPersona(assetData.objectType);
  const criteria = buildCriteria(persona, assetData);

  // Build prompt theo concept + tier
  const prompt = buildPrompt({
    assetData, concept, criteria,
    listingInfo, affiliateHandle,
    isElite: input.tier === 'elite',
  });

  try {
    // Model hỗ trợ IMAGE output
    const tryGenerate = async (model: string) => {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
      if (!img?.inlineData?.data) return null;
      return `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`;
    };

    // Try models in order
    const imageB64 =
      await tryGenerate('gemini-2.5-flash-image') ??
      await tryGenerate('gemini-2.0-flash-exp-image-generation');

    if (imageB64) {
      return { success: true, imageBase64: imageB64, concept };
    }

    console.warn('[generatePoster] No image from Gemini, using SVG fallback');
    return generateSVGFallback(assetData, concept, criteria, affiliateHandle, listingInfo);

  } catch (err) {
    console.error('[generatePoster] Error:', err);
    return generateSVGFallback(assetData, concept, criteria, affiliateHandle, listingInfo);
  }
}

// ── Generate all 3 concepts (Elite) ──────────────────────────

export async function generateAllPosters(
  assetId: string,
  listingInfo: { price: number; description: string }
): Promise<GenerateAllResult> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

  const { data: userProfile } = await authClient
    .from('users_view')
    .select('id, handle, reward_points')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) return { success: false, error: 'Không tìm thấy hồ sơ' };

  const balance = userProfile.reward_points ?? 0;
  if (balance < ELITE_HLR_COST) {
    return {
      success: false,
      error: `Không đủ HLR. Cần ${ELITE_HLR_COST} HLR, hiện có ${balance} HLR.`,
    };
  }

  const supabase = createServiceClient();

  // Lấy asset data
  const assetData = await fetchAssetData(assetId, userProfile.handle ?? 'unknown', supabase);
  if (!assetData) return { success: false, error: 'Không tìm thấy vật phẩm' };

  // Trừ HLR trước
  await supabase
    .from('users')
    .update({ reward_points: balance - ELITE_HLR_COST })
    .eq('user_id', userProfile.id);

  const concepts: ConceptType[] = ['archive', 'lifestyle', 'emotional'];
  const results: Record<ConceptType, GenerateVisualResult> = {
    archive: { success: false },
    lifestyle: { success: false },
    emotional: { success: false },
  };

  let successCount = 0;
  for (const concept of concepts) {
    const r = await generatePoster({
      assetData,
      concept,
      listingInfo,
      tier: 'elite',
      affiliateHandle: userProfile.handle ?? 'unknown',
    });
    results[concept] = r;
    if (r.success) successCount++;
  }

  // Hoàn HLR theo tỷ lệ nếu có lỗi
  const actualCost = Math.round(ELITE_HLR_COST * successCount / 3);
  if (actualCost < ELITE_HLR_COST) {
    await supabase
      .from('users')
      .update({ reward_points: balance - actualCost })
      .eq('user_id', userProfile.id);
  }

  return { success: true, results, hlrCharged: actualCost };
}

// ── Submit listing (thay vì redirect /submit) ─────────────────

export async function submitHeritageListing(input: ListingInput): Promise<{
  success: boolean;
  lotId?: string;
  error?: string;
}> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

  const { data: userProfile } = await authClient
    .from('users_view')
    .select('id, hub_id')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) return { success: false, error: 'Không tìm thấy hồ sơ' };

  const supabase = createServiceClient();

  // Lấy asset để fill thông tin
  const { data: asset } = await supabase
    .from('universal_assets')
    .select('*')
    .eq('id', input.assetId)
    .single();

  if (!asset) return { success: false, error: 'Không tìm thấy vật phẩm' };

  // Lấy hub_id từ code
  const { data: hub } = await supabase
    .from('hubs')
    .select('id')
    .eq('code', input.hubCode)
    .single();

  const hubId = hub?.id ?? userProfile.hub_id;
  if (!hubId) return { success: false, error: 'Không tìm thấy hub' };

  const attrs = (asset.attributes as any) ?? {};

  // Generate lot_id
  const { data: lotId } = await supabase.rpc('generate_lot_id', {
    p_brand: asset.brand ?? attrs.brand ?? 'Unknown',
    p_release_year: attrs.year ?? new Date().getFullYear(),
  });

  if (!lotId) return { success: false, error: 'Không tạo được mã lot' };

  // Insert post liên kết với universal_asset đã có
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      lot_id: lotId,
      seller_id: userProfile.id,
      hub_id: hubId,
      brand: asset.brand ?? attrs.brand ?? 'Unknown',
      model: asset.model ?? attrs.model ?? 'Item',
      colorway: asset.colorway ?? attrs.colorway ?? null,
      size_us: asset.size_us ?? attrs.size_us ?? null,
      condition: asset.condition ?? attrs.condition ?? 'VNDS',
      release_year: attrs.year ?? null,
      asking_price_vnd: input.price,
      reserve_price_vnd: Math.round(input.price * 0.95),
      market_avg_vnd: input.price,
      description: input.description,
      status: 'draft',
      image_urls: [],
      verify_stitching: false,
      verify_sole: false,
      verify_materials: false,
      verify_box: false,
      view_count: 0,
      is_featured: false,
    } as never)
    .select()
    .single();

  if (postError || !post) {
    return { success: false, error: postError?.message ?? 'Không tạo được post' };
  }

  // Link post với universal_asset
  await supabase
    .from('universal_assets')
    .update({ post_id: post.id })
    .eq('id', input.assetId)
    .is('post_id', null); // Chỉ update nếu chưa có post

  return { success: true, lotId };
}

// ── Helpers ───────────────────────────────────────────────────

async function fetchAssetData(
  assetId: string,
  ownerHandle: string,
  supabase: any
): Promise<AssetData | null> {
  const { data: asset } = await supabase
    .from('universal_assets')
    .select('*')
    .eq('id', assetId)
    .single();

  if (!asset) return null;

  const { count: scanCount } = await supabase
    .from('scan_events')
    .select('*', { count: 'exact', head: true })
    .eq('passport_id', assetId);

  const { data: scans } = await supabase
    .from('scan_events')
    .select('city')
    .eq('passport_id', assetId);

  const { count: ownerCount } = await supabase
    .from('ownership_history')
    .select('*', { count: 'exact', head: true })
    .eq('passport_id', assetId);

  const uniqueCities = new Set(
    (scans ?? []).map((s: any) => s.city).filter(Boolean)
  ).size;

  const attrs = (asset.attributes as any) ?? {};

  return {
    id: asset.id,
    qrCode: asset.qr_code,
    brand: asset.brand ?? attrs.brand ?? 'Unknown',
    model: asset.model ?? attrs.model ?? 'Item',
    colorway: asset.colorway ?? attrs.colorway,
    objectType: asset.object_type ?? 'sneaker',
    serialNumber: `STD #${String(scanCount ?? 0).padStart(6, '0')}`,
    securityTier: asset.security_tier ?? 'standard',
    identityStatus: asset.identity_status ?? 'unverified',
    cities: uniqueCities,
    scans: scanCount ?? 0,
    owners: ownerCount ?? 1,
    firstClaimant: asset.first_claimant_id ? ownerHandle : undefined,
    createdAt: asset.created_at,
    // ✅ Fix: map cover_image_url → existingImageUrl cho PosterCanvas
    existingImageUrl: asset.cover_image_url ?? (asset.image_urls as string[])?.[0] ?? undefined,
  };
}

function detectPersona(objectType: string): PersonaType {
  if (['sneaker', 'sports', 'bike'].includes(objectType)) return 'dynamic';
  if (['watch', 'camera', 'tech'].includes(objectType)) return 'precision';
  return 'static';
}

function buildCriteria(persona: PersonaType, asset: AssetData): PosterCriteria[] {
  switch (persona) {
    case 'dynamic':
      return [
        { label: 'Hành trình', value: `${asset.cities} thành phố` },
        { label: 'Lượt scan', value: `${asset.scans} lần` },
        { label: 'Số chủ', value: `${asset.owners} người` },
      ];
    case 'precision':
      return [
        { label: 'Serial', value: asset.serialNumber },
        { label: 'Tier', value: asset.securityTier.toUpperCase() },
        { label: 'Trạng thái', value: asset.identityStatus === 'temp_claimed' ? 'Đã định danh' : 'Mới khai sinh' },
      ];
    default:
      return [
        { label: 'Độc bản', value: asset.serialNumber },
        { label: 'The First', value: asset.firstClaimant ? `@${asset.firstClaimant}` : 'Chưa claim' },
        { label: 'Khai sinh', value: new Date(asset.createdAt).toLocaleDateString('vi-VN') },
      ];
  }
}

function buildPrompt(input: {
  assetData: AssetData;
  concept: ConceptType;
  criteria: PosterCriteria[];
  listingInfo: { price: number; description: string };
  affiliateHandle: string;
  isElite: boolean;
}): string {
  const { assetData: a, concept, criteria, listingInfo, affiliateHandle, isElite } = input;
  const itemName = `${a.brand} ${a.model}${a.colorway ? ` "${a.colorway}"` : ''}`;
  const priceFormatted = new Intl.NumberFormat('vi-VN').format(listingInfo.price) + ' VNĐ';

  // Concept-specific scene descriptions
  const scenePrompts = {
    archive: [
      `Museum-quality product photography of this exact item`,
      `Minimalist dark studio, single dramatic spotlight from above`,
      `Deep black background, catalogue auction house aesthetic`,
      `Professional studio lighting, item perfectly centered`,
    ].join('. '),

    lifestyle: [
      `The item placed in an authentic Vietnamese urban lifestyle scene`,
      a.objectType === 'sneaker'
        ? `Hanoi Old Quarter cobblestones at golden hour, warm street light reflecting on wet pavement`
        : a.objectType === 'watch'
        ? `Sophisticated rooftop cafe, Ho Chi Minh City skyline at dusk, warm ambient lighting`
        : a.objectType === 'ceramics'
        ? `Traditional Vietnamese artisan workshop, soft natural window light, wooden surfaces`
        : `Modern Vietnamese home interior, natural light from large windows, minimal decor`,
      `Vibrant cinematic colors, editorial photography style`,
    ].join('. '),

    emotional: [
      `Intimate macro photography focusing on the unique details and textures of this item`,
      `Moody atmospheric lighting, very shallow depth of field`,
      `Film photography aesthetic, bokeh background`,
      `Focus on the character marks, patina, and story written into the surface`,
      `Dark, contemplative, emotionally resonant`,
    ].join('. '),
  };

  const qualityPrompt = isElite
    ? 'Ultra high quality, 8K resolution, cinematic professional photography, award-winning composition'
    : 'High quality, professional photography, clean composition';

  // Hero image instruction — Gemini sẽ dùng ảnh thật từ Cloudinary
  const heroInstruction = a.existingImageUrl
    ? `BASE THIS ON THE PROVIDED HERO IMAGE. Remove the background and place the item in the described scene.`
    : `Create a realistic representation of ${itemName}.`;

  return `You are a professional product photographer and visual designer.

TASK: Create a square 1:1 poster image for a heritage item listing.

ITEM: ${itemName}
${heroInstruction}

SCENE: ${scenePrompts[concept]}

DESIGN REQUIREMENTS:
- Square 1:1 aspect ratio (1080x1080px equivalent)
- Dark premium aesthetic matching 16Store brand
- Leave 20% clear space at BOTTOM for text overlay
- Leave 8% clear space at TOP for branding bar
- NO text rendered in the image
- Amber/orange accent color (#C8531C) as brand color
- ${qualityPrompt}

OVERLAY TEXT (will be added programmatically after):
- TOP: 16STORE HERITAGE | ${a.qrCode}
- BRAND: ${a.brand.toUpperCase()}
- MODEL: ${a.model}
- CRITERIA: ${criteria.map(c => `${c.label}: ${c.value}`).join(' | ')}
- PRICE: ${priceFormatted}
- FOOTER: 16store.app/passport/${a.qrCode}?ref=${affiliateHandle}`;
}

function generateSVGFallback(
  asset: AssetData,
  concept: ConceptType,
  criteria: PosterCriteria[],
  affiliateHandle: string,
  listingInfo: { price: number; description: string }
): GenerateVisualResult {
  const bg = concept === 'archive' ? '#0a0a0f'
           : concept === 'lifestyle' ? '#0f1a08'
           : '#050a0f';
  const accent = concept === 'archive' ? '#c8531c'
               : concept === 'lifestyle' ? '#d4af37'
               : '#5DCAA5';
  const priceFormatted = new Intl.NumberFormat('vi-VN').format(listingInfo.price);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${bg}"/>
  <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M40 0L0 0 0 40" fill="none" stroke="${accent}" stroke-width="0.3" opacity="0.12"/>
  </pattern></defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <rect x="0" y="0" width="1080" height="4" fill="${accent}"/>
  <text x="60" y="72" font-family="monospace" font-size="12" fill="${accent}" letter-spacing="4" opacity="0.7">16STORE · HERITAGE PASSPORT</text>
  <text x="1020" y="72" font-family="monospace" font-size="10" fill="${accent}" letter-spacing="2" text-anchor="end" opacity="0.5">${asset.qrCode}</text>
  <text x="60" y="220" font-family="Georgia,serif" font-size="88" fill="white" font-weight="bold">${asset.brand.toUpperCase().substring(0, 10)}</text>
  <text x="60" y="295" font-family="Georgia,serif" font-size="44" fill="${accent}" font-style="italic">${asset.model.substring(0, 22)}</text>
  ${asset.colorway ? `<text x="60" y="340" font-family="monospace" font-size="16" fill="white" opacity="0.45">"${asset.colorway}"</text>` : ''}
  <line x1="60" y1="400" x2="1020" y2="400" stroke="${accent}" stroke-width="0.5" opacity="0.35"/>
  ${criteria.map((c, i) => `
  <text x="60" y="${460 + i * 50}" font-family="monospace" font-size="13" fill="${accent}" opacity="0.7" letter-spacing="2">${c.label.toUpperCase()}</text>
  <text x="280" y="${460 + i * 50}" font-family="monospace" font-size="15" fill="white" font-weight="bold">${c.value}</text>`).join('')}
  <line x1="60" y1="620" x2="1020" y2="620" stroke="${accent}" stroke-width="0.5" opacity="0.25"/>
  <text x="60" y="700" font-family="monospace" font-size="13" fill="white" opacity="0.4" letter-spacing="3">GIÁ ĐỀ XUẤT</text>
  <text x="60" y="760" font-family="Georgia,serif" font-size="64" fill="${accent}" font-weight="bold">${priceFormatted}</text>
  <text x="60" y="790" font-family="monospace" font-size="14" fill="white" opacity="0.4">VNĐ</text>
  ${listingInfo.description ? `<text x="60" y="860" font-family="Georgia,serif" font-size="18" fill="white" opacity="0.5" font-style="italic">"${listingInfo.description.substring(0, 50)}..."</text>` : ''}
  <rect x="880" y="900" width="140" height="140" fill="white" rx="8"/>
  <text x="950" y="978" font-family="monospace" font-size="8" fill="#0a0a0f" text-anchor="middle">16store.app/passport</text>
  <text x="60" y="980" font-family="monospace" font-size="11" fill="${accent}" opacity="0.55" letter-spacing="2">16store.app/passport/${asset.qrCode}</text>
  <text x="60" y="1000" font-family="monospace" font-size="9" fill="white" opacity="0.25">?ref=${affiliateHandle}&utm=heritage</text>
  <text x="60" y="1040" font-family="monospace" font-size="10" fill="white" opacity="0.18" letter-spacing="1">"Quét để xem câu chuyện di sản"</text>
  <rect x="0" y="1076" width="1080" height="4" fill="${accent}"/>
</svg>`;

  // Encode SVG - replace special chars to avoid base64 issues
  const safeSvg = svg
    .replace(/[^\x00-\x7F]/g, c => `&#${c.charCodeAt(0)};`); // HTML encode non-ASCII
  const encoded = Buffer.from(safeSvg, 'utf-8').toString('base64');
  return {
    success: true,
    imageBase64: `data:image/svg+xml;base64,${encoded}`,
    concept,
  };
}
