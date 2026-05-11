'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';

// ── Types ─────────────────────────────────────────────────────

export type JournalEntryType = 'experience' | 'repair' | 'memory' | 'location' | 'other';

export interface JournalEntry {
  id: string;
  passport_id: string;
  owner_id: string;
  entry_type: JournalEntryType;
  title: string;
  content: string;
  entry_date: string;
  image_urls: string[];
  is_premium: boolean;
  is_public: boolean;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
}

export interface CreateJournalEntryInput {
  passportId: string;
  entryType: JournalEntryType;
  title: string;
  content: string;
  entryDate: string;
  imageUrls?:     string[];
  lat?:           number;
  lng?:           number;
  isPublic?:      boolean;
  writtenByRole?: 'owner' | 'borrower';
}

// ── Constants ─────────────────────────────────────────────────

import {
  FREE_IMAGE_LIMIT,
  PREMIUM_IMAGE_LIMIT,
  PREMIUM_HLR_COST,
} from '@/lib/journal-constants';

// ── Queries ───────────────────────────────────────────────────

export async function getJournalEntries(passportId: string): Promise<JournalEntry[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('passport_journal')
    .select('*')
    .eq('passport_id', passportId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getJournalEntries]', error);
    return [];
  }
  return (data ?? []) as JournalEntry[];
}

export async function getJournalImageCount(passportId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('passport_journal')
    .select('image_urls')
    .eq('passport_id', passportId);

  return (data ?? []).reduce((sum, row) => sum + (row.image_urls?.length ?? 0), 0);
}

// ── Create entry ──────────────────────────────────────────────

export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<{ success: boolean; entry?: JournalEntry; error?: string }> {
  try {
    const authClient = await createClient();
    const { data: { user: authUser } } = await authClient.auth.getUser();
    if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

    // Dùng service client để tránh RLS block
    const supabase = createServiceClient();

    // Get user_id từ auth_id
    const { data: userProfile } = await supabase
      .from('users_view')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();

    if (!userProfile) {
      console.error('[createJournalEntry] userProfile not found for auth_id:', authUser.id);
      return { success: false, error: 'Không tìm thấy hồ sơ người dùng' };
    }

    console.log('[createJournalEntry] userProfile.id:', userProfile.id);

    // Verify ownership
    const { data: passport } = await supabase
      .from('universal_assets')
      .select('id, owner_id')
      .eq('id', input.passportId)
      .single();

    console.log('[createJournalEntry] passport.owner_id:', passport?.owner_id, 'vs user:', userProfile.id);

    if (!passport || passport.owner_id !== userProfile.id) {
      return { success: false, error: `Không có quyền ghi nhật ký. owner=${passport?.owner_id} user=${userProfile.id}` };
    }

  // Check image quota
  if (input.imageUrls && input.imageUrls.length > 0) {
    const currentImageCount = await getJournalImageCount(input.passportId);
    const { data: isPremium } = await supabase
      .from('passport_journal')
      .select('is_premium')
      .eq('passport_id', input.passportId)
      .eq('is_premium', true)
      .maybeSingle();

    const limit = isPremium ? PREMIUM_IMAGE_LIMIT : FREE_IMAGE_LIMIT;
    const newTotal = currentImageCount + input.imageUrls.length;

    if (newTotal > limit) {
      const remaining = Math.max(0, limit - currentImageCount);
      return {
        success: false,
        error: remaining === 0
          ? `Đã đạt giới hạn ${limit} ảnh. Nâng cấp gói để thêm ảnh.`
          : `Chỉ còn ${remaining} ảnh miễn phí. Đang thêm ${input.imageUrls.length} ảnh sẽ vượt giới hạn.`,
      };
    }
  }

  const { data, error } = await supabase
    .from('passport_journal')
    .insert({
      passport_id: input.passportId,
      owner_id:    userProfile.id,
      entry_type:  input.entryType,
      title:       input.title,
      content:     input.content,
      entry_date:  input.entryDate,
      image_urls:  input.imageUrls ?? [],
      is_premium:  false,
      is_public:   input.isPublic ?? true,
      lat:         input.lat ?? null,
      lng:         input.lng ?? null,
    } as never)
    .select()
    .single();

  if (error) {
    console.error('[createJournalEntry] INSERT error:', error.message, error.details);
    return { success: false, error: `Lỗi DB: ${error.message}` };
  }

  console.log('[createJournalEntry] SUCCESS, id:', data?.id);
  revalidatePath(`/passport`);
  return { success: true, entry: data as JournalEntry };

  } catch (err) {
    console.error('[createJournalEntry] EXCEPTION:', err);
    return { success: false, error: `Lỗi hệ thống: ${String(err)}` };
  }
}

// ── Delete entry ──────────────────────────────────────────────

export async function deleteJournalEntry(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

  const { data: userProfile } = await authClient
    .from('users_view')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('passport_journal')
    .delete()
    .eq('id', entryId)
    .eq('owner_id', userProfile?.id ?? '');

  if (error) return { success: false, error: error.message };
  revalidatePath('/passport');
  return { success: true };
}

// ── Unlock premium images (30 HLR) ────────────────────────────

export async function unlockPremiumImages(
  passportId: string
): Promise<{ success: boolean; error?: string }> {
  const authClient = await createClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  if (!authUser) return { success: false, error: 'Chưa đăng nhập' };

  const { data: userProfile } = await authClient
    .from('users_view')
    .select('id, reward_points')
    .eq('auth_id', authUser.id)
    .single();

  if (!userProfile) return { success: false, error: 'Không tìm thấy hồ sơ' };

  const balance = userProfile.reward_points ?? 0;
  if (balance < PREMIUM_HLR_COST) {
    return {
      success: false,
      error: `Không đủ HLR. Cần ${PREMIUM_HLR_COST} HLR, hiện có ${balance} HLR.`,
    };
  }

  const supabase = createServiceClient();

  // Trừ HLR
  await supabase
    .from('users')
    .update({ reward_points: balance - PREMIUM_HLR_COST })
    .eq('user_id', userProfile.id);

  // Mark all entries of this passport as premium
  await supabase
    .from('passport_journal')
    .update({ is_premium: true })
    .eq('passport_id', passportId)
    .eq('owner_id', userProfile.id);

  // Insert a marker entry
  await supabase
    .from('passport_journal')
    .insert({
      passport_id: passportId,
      owner_id:    userProfile.id,
      entry_type:  'other',
      title:       '✦ Nâng cấp gói ảnh Premium',
      content:     `Đã mở khóa lưu trữ ${PREMIUM_IMAGE_LIMIT} ảnh nhật ký.`,
      entry_date:  new Date().toISOString().split('T')[0],
      image_urls:  [],
      is_premium:  true,
      is_public:   false,
    } as never);

  revalidatePath('/passport');
  return { success: true };
}
