# 16STORE — Hướng dẫn cài đặt và kịch bản test (Phase 1+2+3)

Tài liệu này giúp bạn cài đặt từ đầu và test toàn bộ 3 giai đoạn theo thứ tự.

**Cách dùng:** Đi từng bước. Sau mỗi bước có **Checklist test** — đánh dấu ✓ hoặc ✗ rồi báo lại cho tôi.

**Format báo cáo cho tôi:**
```
Bước 1: ✓
Bước 2: ✓
Bước 3: ✗ — Lỗi: "permission denied for table users"
...
```

**Tổng thời gian dự kiến:** 60-90 phút nếu suôn sẻ.

---

# PHẦN A — Cài đặt môi trường (15 phút)

## Bước 1: Cài Node.js và pnpm

```bash
node --version    # cần >= 20
npm install -g pnpm
pnpm --version
```

**Checklist:**
- [ ] `node --version` >= v20
- [ ] `pnpm --version` trả về số version

---

## Bước 2: Tạo Supabase project

1. https://supabase.com → New Project
2. Tên: `16store-dev`
3. Region: **Southeast Asia (Singapore)**
4. Đặt mật khẩu database (lưu lại)
5. Đợi 2-3 phút khởi tạo

**Checklist:**
- [ ] Project xuất hiện trong dashboard
- [ ] Vào "Project Settings → API", thấy 3 thông tin: Project URL, anon key, service_role key

---

## Bước 3: Apply 4 file SQL migration

Vào **SQL Editor** trong Supabase Dashboard, chạy 4 file theo thứ tự:

**3a. `0001_init_schema_v2.sql`**
- Mở file → copy toàn bộ → paste vào SQL Editor → Run
- Kết quả: "Success. No rows returned"

**3b. `0002_seed_data.sql`**
- Tương tự, paste và Run

**3c. `0003_phase2_auth_telegram.sql`**
- Tương tự
- Lưu ý: nếu báo lỗi "permission denied for table buckets" ở phần cuối, bỏ qua và làm thủ công ở Bước 4

**3d. `0004_phase3_ai_payment.sql`**
- Tương tự, paste và Run

**Checklist:**
- [ ] Vào Table Editor → có **10 bảng**: `users`, `hubs`, `posts`, `payments`, `qr_codes`, `notifications`, `telegram_link_tokens`, `campaigns`, `pricing_rules`, `reputation_log`
- [ ] Bảng `hubs` có 4 rows
- [ ] Bảng `posts` có 12 rows
- [ ] Bảng `users` có 8 rows
- [ ] Bảng `qr_codes` có 15 rows
- [ ] Bảng `campaigns` có 1 row (Tết 2026)
- [ ] Bảng `pricing_rules` có 1 row

---

## Bước 4: Tạo Storage bucket

Nếu Bước 3c không tự tạo, làm thủ công:
1. Storage → New bucket
2. Tên: `sneaker-photos`
3. **Public bucket**: ON
4. File size limit: 5 MB

**Checklist:**
- [ ] Bucket `sneaker-photos` xuất hiện
- [ ] Có icon "public"

---

## Bước 5: Cấu hình Auth URLs

1. Authentication → URL Configuration
2. Site URL: `http://localhost:3000`
3. Redirect URLs: thêm `http://localhost:3000/auth/callback`

**Checklist:**
- [ ] Site URL = `http://localhost:3000`
- [ ] Redirect URLs có `http://localhost:3000/auth/callback`

---

## Bước 6: Cài project và setup .env.local

```bash
cd 16store-app
pnpm install
cp .env.local.example .env.local
```

Mở `.env.local`, điền **bắt buộc**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_PROJECT_ID=xxxxx
GEMINI_API_KEY=AIza...
USE_PAYMENT_MOCK=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Tạm để trống** Telegram (sẽ điền ở Phần D):
```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

Chạy:
```bash
pnpm dev
```

**Checklist:**
- [ ] `pnpm install` chạy không lỗi
- [ ] `pnpm dev` thấy "Ready in xxx ms"
- [ ] Mở http://localhost:3000 → trang chủ load được

---

# PHẦN B — Test trang chủ (Phase 1) (5 phút)

## Bước 7: Test trang chủ

Mở http://localhost:3000 và scroll qua tất cả sections.

**Checklist:**
- [ ] Ticker chạy ngang ở đầu (rust màu cam)
- [ ] Hero section "Đôi giày không chỉ là đôi giày" + sneaker SVG bên phải
- [ ] Section "This week's floor" có 6 sneaker cards
- [ ] Section "Sàn ký gửi" có 3 cột: filter / feed / activity
- [ ] Section bản đồ với 4 hub pins
- [ ] Section "Bốn bước, không phải bốn ngàn dòng chat" (nền bone)
- [ ] Footer có 5 cột
- [ ] Click "Đăng nhập" → chuyển sang `/login`

---

# PHẦN C — Test Đăng nhập (Phase 2) (10 phút)

## Bước 8: Test trang Login

Vào http://localhost:3000/login

**Checklist:**
- [ ] Layout có 4 góc trang trí (corner ticks rust)
- [ ] Form có ô email và button "Gửi đường dẫn đăng nhập"
- [ ] Click logo trên đầu → quay về trang chủ

---

## Bước 9: Test gửi magic link

1. Nhập email **thật** của bạn (Gmail, Outlook, ...)
2. Click "Gửi đường dẫn đăng nhập"

**Checklist:**
- [ ] Form chuyển sang trạng thái "Đã gửi" với dấu ✓
- [ ] Email đến trong vòng 1 phút (kiểm tra Spam)
- [ ] Email có nút Confirm/Magic Link

---

## Bước 10: Test đăng nhập thành công

Click link trong email.

**Checklist:**
- [ ] Browser chuyển hướng đến `/dashboard`
- [ ] Header dashboard có "Chào, @user_xxxxxxxx"
- [ ] Stats: Tổng pairs = 0
- [ ] Section "Cài đặt thông báo / Telegram" hiện ở dưới
- [ ] Vào Supabase → bảng `users` → có row mới với handle dạng `user_xxxxxxxx`

---

## Bước 11: Test đăng xuất

1. Vào `/settings`
2. Click "Đăng xuất"

**Checklist:**
- [ ] Quay về trang chủ
- [ ] Nav hiện "Đăng nhập" thay vì handle
- [ ] Vào `/dashboard` → tự redirect về `/login`

---

# PHẦN D — Setup Telegram bot (Phase 2) (15 phút)

## Bước 12: Tạo bot trên Telegram

1. Mở Telegram, tìm **@BotFather**
2. Gửi `/newbot`
3. Đặt tên hiển thị: vd `16Store Notifications`
4. Đặt username: phải kết thúc bằng `bot`, vd `store16_notify_bot`
5. Copy **HTTP API token** dạng `1234567890:ABCdef...`

**Checklist:**
- [ ] Nhận được token từ BotFather
- [ ] Token có format `số:chữ`

---

## Bước 13: Update .env.local với Telegram

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
TELEGRAM_WEBHOOK_SECRET=tao-tu-nghi-mot-chuoi-bi-mat-12345
```

Restart dev server (Ctrl+C, `pnpm dev` lại).

**Checklist:**
- [ ] Server restart không lỗi

---

## Bước 14: Cài và chạy ngrok

```bash
# Cài ngrok: https://ngrok.com/download
# Mở terminal mới, giữ pnpm dev ở terminal cũ
ngrok http 3000
```

Copy URL https mà ngrok in ra (vd `https://abcd1234.ngrok-free.app`).

**Checklist:**
- [ ] Ngrok chạy, thấy URL https

---

## Bước 15: Đăng ký webhook với Telegram

Chạy lệnh sau (thay BOT_TOKEN, NGROK_URL, SECRET):

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abcd1234.ngrok-free.app/api/telegram/webhook",
    "secret_token": "tao-tu-nghi-mot-chuoi-bi-mat-12345"
  }'
```

**Checklist:**
- [ ] Trả về `{"ok":true,"result":true,"description":"Webhook was set"}`

---

## Bước 16: Test link Telegram

1. Đăng nhập web (nếu chưa) → vào `/settings`
2. Section "Telegram bot" → "Tạo mã liên kết" → copy mã (dạng `ABCD-1234`)
3. Mở Telegram, tìm bot vừa tạo, gõ `/start` → bot chào mừng
4. Gõ `/link ABCD-1234` → bot trả lời "✓ Liên kết thành công"
5. Refresh `/settings`

**Checklist:**
- [ ] Bot trả lời `/start` với hướng dẫn
- [ ] Bot trả lời `/link` với "Liên kết thành công"
- [ ] `/settings` hiện "● Đã liên kết" màu xanh
- [ ] Bảng `users` → row của bạn có `telegram_chat_id` ≠ null

---

# PHẦN E — Test Submit Manual (Phase 2) (10 phút)

## Bước 17: Test submit manual

1. Vào `/submit`
2. Click tab **"Ký gửi đầy đủ"** (manual)
3. Điền:
   - Brand: Air Jordan
   - Model: AJ4 Test Manual
   - Colorway: Bred
   - Size: 9.5
   - Năm: 2024
   - Tình trạng: DS
   - Giá: 6800000
   - Hub: Thái Hà
4. Upload 1-2 ảnh sneaker bất kỳ (download từ Google)
5. Click "Gửi để được verify"

**Checklist:**
- [ ] Form chuyển sang `/dashboard?submitted=A-XXX`
- [ ] Banner "Đã gửi pair A-XXX"
- [ ] Stats: Chờ verify = 1
- [ ] Telegram bot gửi tin "✓ Pair của bạn đã được tiếp nhận"

---

## Bước 18: Verify trong database

Vào Supabase → Table Editor:

**Checklist:**
- [ ] `posts` → có row mới, status = `pending_verify`
- [ ] `qr_codes` → có row code dạng `16S:LOT:A-XXX:xxxxxxxx`
- [ ] Storage → `sneaker-photos` → có folder = user ID, chứa ảnh

---

# PHẦN F — Test Submit qua AI (Phase 3) (15 phút)

## Bước 19: Lấy Gemini API key

1. Vào https://aistudio.google.com/apikey
2. Click "Create API key"
3. Copy key dạng `AIzaSy...`
4. Paste vào `.env.local`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```
5. Restart `pnpm dev`

**Checklist:**
- [ ] Có API key
- [ ] Đã paste vào .env.local
- [ ] Server restart không lỗi

---

## Bước 20: Test trang submit có 2 mode

Vào `/submit`.

**Checklist:**
- [ ] Có 2 tabs ngang: **"⚡ Khuyến nghị Ký gửi qua AI"** và **"Thủ công Ký gửi đầy đủ"**
- [ ] Tab AI active mặc định (border-left rust)
- [ ] Phía dưới hiện form upload ảnh + caption

---

## Bước 21: Test AI extract

Chuẩn bị 1 ảnh sneaker thật (vd download "AJ1 Chicago", "SB Dunk Panda" từ Google Images).

1. Click "Thêm ảnh" → chọn ảnh
2. Caption: "AJ1 size 9.5, mua 2023, đầy đủ box"
3. Click "⚡ Phân tích bằng AI →"

**Checklist:**
- [ ] Hiện màn hình "AI đang phân tích..." với icon ⚡ động
- [ ] Sau 5-15 giây chuyển sang màn hình preview
- [ ] Panel rust "AI đã phân tích" hiện ở trên với:
  - Brand + Model AI nhận diện được
  - Confidence % (vd "85%" màu xanh)
  - 💡 Chiến lược (text tiếng Việt)
- [ ] Form bên dưới đã được pre-fill bằng data AI
- [ ] Có thể edit từng field

---

## Bước 22: Test confirm và sang payment

1. Sửa lại thông tin nếu cần (đặc biệt chọn Hub)
2. Đặt giá vd 8000000
3. Click "Xác nhận & sang thanh toán →"

**Checklist:**
- [ ] Sau 3-5 giây chuyển sang màn hình **"Quét VietQR để hoàn tất"**
- [ ] Có ảnh QR thật bên trái (load từ img.vietqr.io)
- [ ] Số tiền hiển thị (vd 960K = 12% của 8M, hoặc 640K nếu được áp dụng campaign 8%)
- [ ] Có hướng dẫn 5 bước
- [ ] Có nút vàng "⚡ MOCK: Đánh dấu đã trả →"
- [ ] Telegram bot đã gửi tin với mã lot và phí

---

## Bước 23: Test mock payment + auto-approve

Click "⚡ MOCK: Đánh dấu đã trả →"

**Checklist:**
- [ ] Chuyển về `/dashboard?submitted=...&auto=1` (hoặc `auto=0`)
- [ ] Telegram bot gửi 1 trong 2 tin:
  - **Auto-approved** (AI confidence ≥ 0.85): "🎉 Pair của bạn đã LIVE trên floor! +5 điểm uy tín"
  - **Pending review** (confidence < 0.85): "✅ Đã nhận thanh toán. Pair đang chờ verify thủ công"

---

## Bước 24: Verify trong database (sau mock pay)

Vào Supabase:

**Checklist:**
- [ ] `posts` → row mới, status = `live` (nếu auto) hoặc `pending_verify` (nếu không)
  - Có cột `ai_extracted` chứa JSON
  - Có `ai_confidence` (0.0-1.0)
- [ ] `payments` → row mới, status = `cleared`
  - Có `order_code`, `vietqr_url`
- [ ] Nếu auto-approved: bảng `reputation_log` → có row mới `+5` reason `post_auto_approved`
- [ ] `users` → reputation_score đã tăng

---

## Bước 25: Test pair vừa submit AI có hiện trên trang chủ

Refresh http://localhost:3000

**Checklist:**
- [ ] Nếu auto-approved: pair hiện trong section "Sàn ký gửi" (consignment floor)
- [ ] Có icon ✓ Verified bên cạnh
- [ ] Hiển thị đúng giá, size, hub, brand

---

# PHẦN G — Test Edge cases (10 phút)

## Bước 26: Test các trường hợp lỗi

**Test 1:** Submit AI mà không upload ảnh → click "Phân tích"
- Mong đợi: lỗi "Cần ít nhất 1 ảnh"

**Test 2:** Upload ảnh không phải sneaker (vd ảnh bãi biển, mèo) → click "Phân tích"
- Mong đợi: AI vẫn trả về kết quả nhưng confidence rất thấp + risk_flags chứa cảnh báo

**Test 3:** Submit manual với giá < 100,000
- Mong đợi: "Giá quá thấp, tối thiểu 100,000 VNĐ"

**Test 4:** Vào `/submit` ở chế độ chưa login (mở incognito)
- Mong đợi: redirect về `/login`

**Test 5:** Submit pair, chưa mock pay, vào dashboard
- Mong đợi: pair hiện với status "Chờ thanh toán" (sẽ thấy "pending_payment")

**Test 6:** Mock pay 2 lần cùng order_code
- Mong đợi: lần 2 không lỗi (idempotent), không cộng reputation lần nữa

**Test 7:** Tab Manual vẫn hoạt động bình thường (Phase 2 không bị regression)
- Mong đợi: form submit manual vẫn chạy được như Bước 17

**Checklist:**
- [ ] Test 1 ✓
- [ ] Test 2 ✓
- [ ] Test 3 ✓
- [ ] Test 4 ✓
- [ ] Test 5 ✓
- [ ] Test 6 ✓
- [ ] Test 7 ✓

---

## Bước 27: Test responsive

Dev Tools → Toggle device toolbar.

**Checklist mỗi kích thước:**
- [ ] iPhone 12 Pro (390×844): trang chủ, login, submit AI đều OK
- [ ] iPad (768×1024): OK
- [ ] Desktop (1440×900): OK

---

# Báo cáo cho tôi

Sau khi test, gửi tôi báo cáo theo mẫu:

```
PHẦN A — CÀI ĐẶT
Bước 1: ✓
Bước 2: ✓
Bước 3: ✗ — Lỗi khi chạy 0004 SQL: "relation campaigns already exists"
...

PHẦN F — AI
Bước 21: ✓ — AI nhận diện đúng brand, confidence 0.92
Bước 22: ✓ — VietQR load được
Bước 23: ✗ — Mock pay xong nhưng Telegram không gửi tin

LỖI GẶP PHẢI:
- Lỗi 1: <copy error message>
- Lỗi 2: <screenshot link>

GHI CHÚ:
- AI confidence cho ảnh xấu vẫn cao quá (0.7), có thể strict hơn
- UI mock pay button hơi nhỏ trên mobile
- Đề xuất: thêm preview giá trước khi sang payment
```

Tôi sẽ dựa trên báo cáo này để fix bug và polish trước khi build Phase 4.

---

# Troubleshooting

**`pnpm install` lỗi peer dependency:**
```bash
pnpm install --force
```

**Lỗi `permission denied for table`:**
- Kiểm tra RLS policies trong Authentication → Policies
- Đảm bảo đã chạy migration 0001 đầy đủ

**Email không đến:**
- Check Spam
- Supabase → Authentication → Logs xem có gửi không
- Dev mode có rate limit, đợi 1 phút thử lại

**Upload ảnh báo lỗi:**
- Bucket `sneaker-photos` có public không
- 3 policies INSERT/SELECT/DELETE đã đúng

**Telegram bot không trả lời:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```
- Trường `last_error_message` cho biết vấn đề
- Đảm bảo ngrok đang chạy

**AI extract báo lỗi "GEMINI_API_KEY chưa được cấu hình":**
- Check `.env.local` có dòng `GEMINI_API_KEY=AIza...`
- Restart `pnpm dev`

**AI extract báo "API key not valid":**
- Tạo lại key tại aistudio.google.com
- Một số region (vd Việt Nam) bị chặn — cần VPN hoặc dùng tunnel

**VietQR ảnh không load:**
- Mở URL ảnh trong tab mới xem có lỗi gì
- Kiểm tra BANK_BIN, BANK_ACCOUNT trong `.env.local`
- Mặc định là MBBank `970422` + tài khoản giả `0123456789`

**Mock pay button không hoạt động:**
- Check `USE_PAYMENT_MOCK=true` trong `.env.local`
- Restart server

**Migration 0004 báo "type already exists":**
- Có thể bạn đã chạy 1 phần rồi
- Drop type cũ: `drop type if exists campaign_status cascade;` rồi chạy lại
- Hoặc chỉ chạy phần ALTER + CREATE TABLE, bỏ phần CREATE TYPE

**Hết quota Gemini API:**
- Free tier có limit, đợi reset hoặc upgrade
- Có thể test bằng cách dùng tab Manual thay vì AI
