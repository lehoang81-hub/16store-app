import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

/**
 * Generate PDF chứa QR codes để in sticker/tag/card.
 * Format query:
 *   GET /api/admin/qr-pdf?passport_id=xxx&type=sticker
 *   GET /api/admin/qr-pdf?passport_ids=id1,id2,id3&type=sticker  (batch)
 *   type: 'sticker' (4cm vuông) | 'tag' (treo) | 'card' (5.5x8.5cm)
 */
export async function GET(request: Request) {
  // Verify admin
  const supabaseAuth = await createClient();
  const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: currentUser } = await supabaseAuth
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single();

  if (currentUser?.role !== 'hub_admin' && currentUser?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('passport_ids') || searchParams.get('passport_id');
  const type = (searchParams.get('type') || 'sticker') as 'sticker' | 'tag' | 'card';

  if (!idsParam) {
    return NextResponse.json({ error: 'Missing passport_id' }, { status: 400 });
  }

  const passportIds = idsParam.split(',').filter(Boolean);

  // Fetch passports + post info
  const supabase = createServiceClient();
  const { data: passports } = await supabase
    .from('shoe_passports')
    .select(`
      id, qr_code,
      posts:current_post_id ( lot_id, brand, model, colorway, size_us )
    `)
    .in('id', passportIds);

  if (!passports || passports.length === 0) {
    return NextResponse.json({ error: 'No passports found' }, { status: 404 });
  }

  // Generate PDF based on type
  let pdfBuffer: Uint8Array;

  if (type === 'sticker') {
    pdfBuffer = await generateStickerPDF(passports as any);
  } else if (type === 'tag') {
    pdfBuffer = await generateTagPDF(passports as any);
  } else {
    pdfBuffer = await generateCardPDF(passports as any);
  }

  return new Response(Buffer.from(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="16store-qr-${type}-${Date.now()}.pdf"`,
    },
  });
}

interface PassportRow {
  id: string;
  qr_code: string;
  posts: {
    lot_id: string;
    brand: string;
    model: string;
    colorway: string | null;
    size_us: number;
  } | null;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://16store.com';

/**
 * STICKER 4cm vuông — dán dưới lưỡi gà
 * Layout: 4x6 grid trên A4 (24 sticker/page)
 */
async function generateStickerPDF(passports: PassportRow[]): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const STICKER_SIZE = 40; // 4cm
  const COLS = 4;
  const ROWS = 6;
  const MARGIN_X = (210 - STICKER_SIZE * COLS) / 2;
  const MARGIN_Y = 20;
  const PER_PAGE = COLS * ROWS;

  for (let i = 0; i < passports.length; i++) {
    const p = passports[i];
    const pageIdx = Math.floor(i / PER_PAGE);
    const itemIdx = i % PER_PAGE;
    const col = itemIdx % COLS;
    const row = Math.floor(itemIdx / COLS);

    if (itemIdx === 0 && pageIdx > 0) doc.addPage();

    const x = MARGIN_X + col * STICKER_SIZE;
    const y = MARGIN_Y + row * STICKER_SIZE;

    // Border (cutting guide)
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.rect(x, y, STICKER_SIZE, STICKER_SIZE);

    // QR code (28mm in center)
    const qrUrl = `${APP_URL}/passport/${p.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 280,
    });
    doc.addImage(qrDataUrl, 'PNG', x + 6, y + 6, 28, 28);

    // 16Store logo text top
    doc.setFontSize(6);
    doc.setTextColor(200, 80, 30);
    doc.text('16STORE', x + STICKER_SIZE / 2, y + 4, { align: 'center' });

    // Lot ID bottom
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text(p.posts?.lot_id || p.qr_code, x + STICKER_SIZE / 2, y + 38, { align: 'center' });
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

/**
 * TAG treo (5cm x 8cm, có lỗ punch) — gắn lưỡi gà như medal
 * Layout: 2x3 trên A4 (6 tag/page)
 */
async function generateTagPDF(passports: PassportRow[]): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 50;
  const H = 80;
  const COLS = 3;
  const ROWS = 3;
  const MARGIN_X = (210 - W * COLS) / 2;
  const MARGIN_Y = 15;
  const PER_PAGE = COLS * ROWS;

  for (let i = 0; i < passports.length; i++) {
    const p = passports[i];
    const pageIdx = Math.floor(i / PER_PAGE);
    const itemIdx = i % PER_PAGE;
    const col = itemIdx % COLS;
    const row = Math.floor(itemIdx / COLS);

    if (itemIdx === 0 && pageIdx > 0) doc.addPage();

    const x = MARGIN_X + col * W;
    const y = MARGIN_Y + row * H;

    // Border
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.rect(x, y, W, H);

    // Punch hole indicator (top center)
    doc.setDrawColor(150, 150, 150);
    doc.circle(x + W / 2, y + 4, 2, 'S');

    // Brand
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text((p.posts?.brand || '16STORE').toUpperCase(), x + W / 2, y + 14, { align: 'center' });

    // Model (large)
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const modelLines = doc.splitTextToSize((p.posts?.model || '').toUpperCase(), W - 4);
    doc.text(modelLines.slice(0, 2), x + W / 2, y + 22, { align: 'center' });

    // QR
    const qrUrl = `${APP_URL}/passport/${p.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 250,
    });
    doc.addImage(qrDataUrl, 'PNG', x + (W - 30) / 2, y + 35, 30, 30);

    // Lot ID
    doc.setFontSize(7);
    doc.setTextColor(200, 80, 30);
    doc.text(p.posts?.lot_id || p.qr_code, x + W / 2, y + 70, { align: 'center' });

    // Footer
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('SCAN TO SEE PASSPORT', x + W / 2, y + 75, { align: 'center' });
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}

/**
 * CARD 5.5cm x 8.5cm (kích thước thẻ ATM) — tặng kèm khi bán
 * Layout: 2x4 trên A4 (8 card/page)
 */
async function generateCardPDF(passports: PassportRow[]): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 85;
  const H = 55;
  const COLS = 2;
  const ROWS = 4;
  const MARGIN_X = (210 - W * COLS) / 2;
  const MARGIN_Y = 15;
  const PER_PAGE = COLS * ROWS;

  for (let i = 0; i < passports.length; i++) {
    const p = passports[i];
    const pageIdx = Math.floor(i / PER_PAGE);
    const itemIdx = i % PER_PAGE;
    const col = itemIdx % COLS;
    const row = Math.floor(itemIdx / COLS);

    if (itemIdx === 0 && pageIdx > 0) doc.addPage();

    const x = MARGIN_X + col * W;
    const y = MARGIN_Y + row * H;

    // Background dark zone left side
    doc.setFillColor(20, 20, 22);
    doc.rect(x, y, W, H, 'F');

    // Border (cutting)
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.rect(x, y, W, H);

    // Logo top-left
    doc.setFontSize(10);
    doc.setTextColor(200, 80, 30);
    doc.text('16', x + 5, y + 8);
    doc.setTextColor(220, 220, 215);
    doc.text('STORE', x + 11, y + 8);

    doc.setFontSize(5);
    doc.setTextColor(120, 120, 115);
    doc.text('HERITAGE CONSIGNMENT', x + 5, y + 12);

    // Pair info center-left
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 145);
    doc.text((p.posts?.brand || '').toUpperCase(), x + 5, y + 22);

    doc.setFontSize(11);
    doc.setTextColor(220, 220, 215);
    const modelLines = doc.splitTextToSize((p.posts?.model || '').toUpperCase(), W - 35);
    doc.text(modelLines.slice(0, 2), x + 5, y + 28);

    if (p.posts?.colorway) {
      doc.setFontSize(7);
      doc.setTextColor(200, 80, 30);
      doc.text(`"${p.posts.colorway}"`, x + 5, y + 38);
    }

    doc.setFontSize(6);
    doc.setTextColor(120, 120, 115);
    doc.text(`LOT ${p.posts?.lot_id || p.qr_code}`, x + 5, y + 45);
    if (p.posts?.size_us) {
      doc.text(`SIZE ${p.posts.size_us} US`, x + 5, y + 49);
    }

    // QR code right side
    const qrUrl = `${APP_URL}/passport/${p.qr_code}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 250,
      color: { dark: '#dcdcd7', light: '#141416' },
    });
    doc.addImage(qrDataUrl, 'PNG', x + W - 28, y + 18, 22, 22);

    doc.setFontSize(5);
    doc.setTextColor(120, 120, 115);
    doc.text('SCAN', x + W - 17, y + 44, { align: 'center' });
    doc.text('PASSPORT', x + W - 17, y + 47, { align: 'center' });
  }

  return doc.output('arraybuffer') as unknown as Uint8Array;
}
