# 16STORE — Giai đoạn 1 + 2 + 3

Sàn ký gửi sneaker · Industrial Heritage aesthetic · Next.js 15 + Supabase + Telegram + Gemini AI + VietQR.

---

## Đã có gì

### Giai đoạn 1 — Foundation
- Schema 5 bảng (users, hubs, posts, payments, qr_codes) + RLS + triggers
- Seed data: 4 hubs, 8 users, 12 listings sneaker
- Trang chủ với 6 sections render data thật
- Thiết kế Industrial Heritage cao cấp

### Giai đoạn 2 — Auth + Submit + Telegram
- Đăng nhập email magic link (không mật khẩu)
- Form ký gửi pair thủ công với upload ảnh
- Dashboard cá nhân
- Bot Telegram thông báo qua webhook

### Giai đoạn 3 — AI + Payment + Pricing engine
- Submit pair qua AI Gemini Vision (chụp ảnh, AI tự nhận diện)
- VietQR thanh toán phí ký gửi (mọi ngân hàng VN)
- Pricing engine động (campaigns + pricing rules)
- Auto-approve khi AI confidence ≥ 0.85
- Reputation log + atomic point system
- Mock payment flow (test không cần PayOS thật)

---

## Cài đặt nhanh

Đọc `TESTING.md` để có hướng dẫn từng bước chi tiết kèm checklist test.

```bash
# 1. Cài deps
pnpm install

# 2. Copy env và điền keys (xem TESTING.md để biết lấy ở đâu)
cp .env.local.example .env.local

# 3. Chạy 4 file SQL migration trong Supabase SQL Editor (xem TESTING.md)

# 4. Chạy dev server
pnpm dev
```

Mở http://localhost:3000

---

## Cấu trúc

```
16store-app/
├── supabase/migrations/
│   ├── 0001_init_schema_v2.sql        # 5 bảng cốt lõi
│   ├── 0002_seed_data.sql             # Dữ liệu giả lập
│   ├── 0003_phase2_auth_telegram.sql  # Telegram + storage
│   └── 0004_phase3_ai_payment.sql     # AI columns + payment + campaigns
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Trang chủ
│   │   ├── login/page.tsx             # Đăng nhập
│   │   ├── submit/page.tsx            # Ký gửi (AI + Manual)
│   │   ├── dashboard/page.tsx         # Dashboard cá nhân
│   │   ├── settings/page.tsx          # Cài đặt + Telegram
│   │   ├── auth/                      # Auth callback + signout
│   │   └── api/telegram/webhook/      # Webhook Telegram bot
│   ├── components/                    # 13 components
│   ├── lib/
│   │   ├── ai/extract-sneaker.ts      # Gemini Vision module
│   │   ├── payment/vietqr.ts          # VietQR generator
│   │   ├── supabase/                  # Client server + browser
│   │   ├── queries/                   # Data layer
│   │   ├── actions/                   # Server actions
│   │   ├── telegram/                  # Telegram send module
│   │   └── utils.ts
│   ├── types/database.ts
│   └── middleware.ts
└── package.json
```

## Design Tokens

Mọi màu/font define trong `src/app/globals.css`. Đổi 1 token = đổi toàn bộ UI.

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#0a0a0a` | Background chính |
| `--color-bone` | `#ebe6dc` | Text chính |
| `--color-rust` | `#c8531c` | Accent/CTA |
| `--font-display` | Archivo Black | Tiêu đề |
| `--font-mono` | Space Mono | Metadata |
| `--font-serif` | Instrument Serif | Italic accent |

## Roadmap

- ✅ Giai đoạn 1: Foundation
- ✅ Giai đoạn 2: Auth + Submit + Telegram
- ✅ Giai đoạn 3: AI + Payment (mock) + Pricing engine
- ⏳ Giai đoạn 4: Hub admin dashboard + QR vật lý + Hộ chiếu giày (nền tảng)
- ⏳ Giai đoạn 5: Bản đồ kỷ niệm + Curator + Crate event
- ⏳ Giai đoạn 6: Verified Shop Partner program
- ⏳ Giai đoạn 7+: Mở rộng sang nông nghiệp di sản

## Tech stack

- **Framework:** Next.js 15 (App Router) + React 19
- **Styling:** Tailwind CSS v4 với custom design tokens
- **Database:** Supabase (Postgres + Auth + Storage + Realtime)
- **AI:** Google Gemini 2.0 Flash (Vision + structured output)
- **Bot:** Telegram Bot API qua webhook
- **Payment:** VietQR (không cần SDK) + PayOS (Phase 4)
- **Validation:** Zod
- **Animation:** Framer Motion
