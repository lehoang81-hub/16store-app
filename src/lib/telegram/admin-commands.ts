import { createServiceClient } from '@/lib/supabase/service';
import { formatVnd } from '@/lib/utils';

interface CommandContext {
  chatId: number;
  userId: string;
  userRole: 'seller' | 'buyer' | 'hub_admin' | 'super_admin';
  args: string[];
}

/**
 * Dispatch admin commands. Trả về response string hoặc null nếu không phải admin command.
 */
export async function handleAdminCommand(
  command: string,
  ctx: CommandContext
): Promise<string | null> {
  const cmd = command.toLowerCase();

  // Không phải admin — trả null để webhook fallback về /help thường
  if (ctx.userRole !== 'hub_admin' && ctx.userRole !== 'super_admin') {
    return null;
  }

  switch (cmd) {
    case '/stats':
      return handleStats(ctx);
    case '/pending':
      return handlePending(ctx);
    case '/revenue':
      return handleRevenue(ctx);
    case '/hub':
      return handleHub(ctx);
    case '/hubs':
      return handleHubs(ctx);
    case '/admin':
    case '/adminhelp':
      return handleAdminHelp(ctx);
    default:
      return null;
  }
}

async function handleStats(ctx: CommandContext): Promise<string> {
  const supabase = createServiceClient();
  const period = ctx.args[0] || 'month'; // today / week / month (default)

  const { startDate, label } = parsePeriod(period);

  if (ctx.userRole === 'super_admin') {
    // All hubs aggregate
    const { data: posts } = await supabase
      .from('posts')
      .select('status, asking_price_vnd, sold_at, created_at, hub_id');

    const recent = (posts ?? []).filter((p) => new Date(p.created_at) >= startDate);
    const sold = (posts ?? []).filter(
      (p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startDate
    );
    const revenue = sold.reduce((sum, p) => sum + (p.asking_price_vnd ?? 0), 0);
    const pending = (posts ?? []).filter((p) => p.status === 'pending_verify').length;
    const live = (posts ?? []).filter((p) => p.status === 'live').length;

    return (
      `📊 <b>16Store Overview</b> · ${label}\n\n` +
      `⏳ Pending verify:  <b>${pending}</b> pairs\n` +
      `🟢 Live on floor:   <b>${live}</b> pairs\n` +
      `💰 Sold ${label}:    <b>${sold.length}</b> pairs\n` +
      `📥 New pairs ${label}: <b>${recent.length}</b>\n\n` +
      `💵 Revenue ${label}: <b>${formatVnd(revenue)} VNĐ</b>\n\n` +
      `🔗 Xem chi tiết: 16store.com/admin/overview`
    );
  }

  // Hub admin
  const { data: hub } = await supabase
    .from('hubs')
    .select('id, name, code')
    .eq('managed_by_user_id', ctx.userId)
    .single();

  if (!hub) {
    return '⚠ Tài khoản của bạn chưa được gán hub quản lý.';
  }

  const { data: posts } = await supabase
    .from('posts')
    .select('status, asking_price_vnd, sold_at, created_at, lot_id, brand, model')
    .eq('hub_id', hub.id);

  const sold = (posts ?? []).filter(
    (p) => p.status === 'sold' && p.sold_at && new Date(p.sold_at) >= startDate
  );
  const revenue = sold.reduce((sum, p) => sum + (p.asking_price_vnd ?? 0), 0);
  const pendingList = (posts ?? [])
    .filter((p) => p.status === 'pending_verify')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 5);
  const pendingCount = (posts ?? []).filter((p) => p.status === 'pending_verify').length;
  const live = (posts ?? []).filter((p) => p.status === 'live').length;
  const pendingPayment = (posts ?? []).filter((p) => p.status === 'pending_payment').length;

  let msg =
    `📊 <b>${hub.name}</b> · ${label}\n\n` +
    `⏳ Chờ verify:     <b>${pendingCount}</b> pairs\n` +
    `💰 Chờ thanh toán: <b>${pendingPayment}</b> pairs\n` +
    `🟢 Đang live:      <b>${live}</b> pairs\n` +
    `✓ Đã bán ${label}:  <b>${sold.length}</b> pairs\n\n` +
    `💵 Revenue ${label}: <b>${formatVnd(revenue)} VNĐ</b>\n\n`;

  if (pendingList.length > 0) {
    msg += `<b>⚡ Cần xử lý gấp:</b>\n`;
    for (const p of pendingList) {
      const hrs = Math.round((Date.now() - new Date(p.created_at).getTime()) / 3600000);
      msg += `• <code>${p.lot_id}</code> · ${p.brand} ${p.model.slice(0, 20)} · ${hrs}h\n`;
    }
    msg += `\n🔗 Xem full: 16store.com/admin/hub`;
  } else {
    msg += `✓ Không có pair pending. Hub đang sạch.`;
  }

  return msg;
}

async function handlePending(ctx: CommandContext): Promise<string> {
  const supabase = createServiceClient();

  // Super admin xem tất cả
  let query = supabase
    .from('posts_with_seller')
    .select('lot_id, brand, model, seller_handle, created_at, asking_price_vnd, hub_name, hub_id')
    .eq('status', 'pending_verify')
    .order('created_at', { ascending: true })
    .limit(10);

  if (ctx.userRole === 'hub_admin') {
    const { data: hub } = await supabase
      .from('hubs')
      .select('id')
      .eq('managed_by_user_id', ctx.userId)
      .single();

    if (!hub) return '⚠ Tài khoản của bạn chưa được gán hub quản lý.';
    query = query.eq('hub_id', hub.id);
  }

  const { data: posts } = await query;

  if (!posts || posts.length === 0) {
    return '✓ <b>Không có pair nào đang chờ verify.</b>\nHub sạch sẽ.';
  }

  let msg = `⏳ <b>${posts.length} pairs đang chờ verify</b>\n\n`;
  for (const p of posts) {
    const hrs = Math.round((Date.now() - new Date(p.created_at).getTime()) / 3600000);
    const days = Math.floor(hrs / 24);
    const age = days > 0 ? `${days}d` : `${hrs}h`;
    msg += `<code>${p.lot_id}</code> · ${p.brand} ${p.model.slice(0, 25)}\n`;
    msg += `   @${p.seller_handle} · ${formatVnd(p.asking_price_vnd)}đ`;
    if (ctx.userRole === 'super_admin') msg += ` · ${p.hub_name}`;
    msg += ` · ${age} ago\n\n`;
  }

  msg += `🔗 Verify: 16store.com/admin/hub`;
  return msg;
}

async function handleRevenue(ctx: CommandContext): Promise<string> {
  const supabase = createServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(1);

  let hubFilter = '';
  let hubName = '';
  if (ctx.userRole === 'hub_admin') {
    const { data: hub } = await supabase
      .from('hubs')
      .select('id, name')
      .eq('managed_by_user_id', ctx.userId)
      .single();
    if (!hub) return '⚠ Tài khoản của bạn chưa được gán hub quản lý.';
    hubFilter = hub.id;
    hubName = hub.name;
  }

  let baseQuery = supabase
    .from('posts')
    .select('asking_price_vnd, sold_at')
    .eq('status', 'sold');

  if (hubFilter) baseQuery = baseQuery.eq('hub_id', hubFilter);

  const { data: sold } = await baseQuery;
  const allSold = sold ?? [];

  const todayRev = allSold
    .filter((p) => p.sold_at && new Date(p.sold_at) >= today)
    .reduce((s, p) => s + (p.asking_price_vnd ?? 0), 0);
  const weekRev = allSold
    .filter((p) => p.sold_at && new Date(p.sold_at) >= weekAgo)
    .reduce((s, p) => s + (p.asking_price_vnd ?? 0), 0);
  const monthRev = allSold
    .filter((p) => p.sold_at && new Date(p.sold_at) >= monthAgo)
    .reduce((s, p) => s + (p.asking_price_vnd ?? 0), 0);

  const todaySold = allSold.filter((p) => p.sold_at && new Date(p.sold_at) >= today).length;
  const weekSold = allSold.filter((p) => p.sold_at && new Date(p.sold_at) >= weekAgo).length;
  const monthSold = allSold.filter((p) => p.sold_at && new Date(p.sold_at) >= monthAgo).length;

  const title = hubName ? hubName : '16Store (Tất cả hubs)';

  return (
    `💵 <b>Doanh thu · ${title}</b>\n\n` +
    `<b>Hôm nay:</b>\n` +
    `  ${formatVnd(todayRev)} VNĐ · ${todaySold} pairs\n\n` +
    `<b>7 ngày:</b>\n` +
    `  ${formatVnd(weekRev)} VNĐ · ${weekSold} pairs\n\n` +
    `<b>Tháng này:</b>\n` +
    `  ${formatVnd(monthRev)} VNĐ · ${monthSold} pairs\n\n` +
    `🔗 Chi tiết: 16store.com/admin/overview`
  );
}

async function handleHub(ctx: CommandContext): Promise<string> {
  if (ctx.userRole !== 'hub_admin') {
    return '⚠ Lệnh /hub chỉ dành cho hub admin. Super admin dùng <code>/hubs</code>.';
  }

  const supabase = createServiceClient();
  const { data: hub } = await supabase
    .from('hubs')
    .select('*')
    .eq('managed_by_user_id', ctx.userId)
    .single();

  if (!hub) return '⚠ Tài khoản của bạn chưa được gán hub quản lý.';

  const { data: postCount } = await supabase
    .from('posts')
    .select('status')
    .eq('hub_id', hub.id);

  const active = (postCount ?? []).filter((p) => ['pending_verify', 'live', 'reserved'].includes(p.status)).length;

  return (
    `🏢 <b>${hub.name}</b> (${hub.code})\n\n` +
    `📍 ${hub.address}\n` +
    `🏙 ${hub.city}\n\n` +
    `📊 Status: <b>${hub.status}</b>\n` +
    `📦 Capacity: <b>${active} / ${hub.capacity}</b> lots\n` +
    `🕐 Giờ mở cửa: ${hub.hours_open ?? '9:00 - 21:00'}\n\n` +
    `🔗 Dashboard: 16store.com/admin/hub`
  );
}

async function handleHubs(ctx: CommandContext): Promise<string> {
  if (ctx.userRole !== 'super_admin') {
    return '⚠ Lệnh /hubs chỉ dành cho super admin.';
  }

  const supabase = createServiceClient();
  const { data: hubs } = await supabase.from('hubs').select('*').order('name');

  if (!hubs || hubs.length === 0) return '⚠ Không có hub nào.';

  let msg = `🏢 <b>Tất cả hubs (${hubs.length})</b>\n\n`;

  for (const h of hubs) {
    const statusEmoji = h.status === 'open' ? '🟢' : h.status === 'closed' ? '🔴' : h.status === 'busy' ? '🟡' : '⚪';
    const capacityPct = h.capacity ? Math.round((h.active_lots / h.capacity) * 100) : 0;
    msg += `${statusEmoji} <b>${h.name}</b> · ${h.code}\n`;
    msg += `   ${h.city} · ${h.active_lots}/${h.capacity} (${capacityPct}%)\n\n`;
  }

  msg += `🔗 Chi tiết: 16store.com/admin/overview`;
  return msg;
}

function handleAdminHelp(ctx: CommandContext): string {
  return (
    `🔧 <b>Admin Commands</b>\n\n` +
    `<code>/stats</code> — Báo cáo nhanh (tháng này)\n` +
    `<code>/stats today</code> — Báo cáo hôm nay\n` +
    `<code>/stats week</code> — Báo cáo 7 ngày\n\n` +
    `<code>/pending</code> — List 10 pair chờ verify\n` +
    `<code>/revenue</code> — Doanh thu hôm nay/tuần/tháng\n` +
    (ctx.userRole === 'hub_admin'
      ? `<code>/hub</code> — Info hub bạn quản lý\n`
      : `<code>/hubs</code> — List tất cả hubs\n`) +
    `<code>/help</code> — Các lệnh seller thường\n\n` +
    `🔗 Web admin: 16store.com/admin/${ctx.userRole === 'super_admin' ? 'overview' : 'hub'}`
  );
}

function parsePeriod(input: string): { startDate: Date; label: string } {
  const now = new Date();
  switch (input.toLowerCase()) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return { startDate: d, label: 'hôm nay' };
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { startDate: d, label: '7 ngày' };
    }
    case 'month':
    default: {
      const d = new Date(now);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return { startDate: d, label: 'tháng này' };
    }
  }
}
