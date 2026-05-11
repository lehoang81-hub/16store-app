# =====================================================================
# 16STORE — Script setWebhook Telegram
# Usage:
#   1. Sửa 2 biến bên dưới ($botToken và $webhookSecret)
#   2. Mở PowerShell trong folder có file này
#   3. Chạy: .\setup-telegram-webhook.ps1
# =====================================================================

# ─── ĐIỀN 2 THÔNG TIN CỦA BẠN VÀO ĐÂY ───────────────────────────────
$botToken      = "8566450511:AAHnB7nHXMcIJzk6MYrync_U6693pB7mGWs"
$webhookSecret = "HPR_16Store_Bot"
$ngrokUrl      = "https://affection-tubby-doorpost.ngrok-free.dev"
# ────────────────────────────────────────────────────────────────────

$webhookUrl = "$ngrokUrl/api/telegram/webhook"

Write-Host ""
Write-Host "====================================================="
Write-Host "  16STORE — Setup Telegram webhook"
Write-Host "====================================================="
Write-Host "Bot token:      $($botToken.Substring(0, 15))..."
Write-Host "Webhook URL:    $webhookUrl"
Write-Host "Secret length:  $($webhookSecret.Length) characters"
Write-Host ""

# ─── SET WEBHOOK ────────────────────────────────────────────────────
Write-Host "➤ Đang set webhook..." -ForegroundColor Yellow

$setUrl = "https://api.telegram.org/bot$botToken/setWebhook"
$body = @{
    url          = $webhookUrl
    secret_token = $webhookSecret
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $setUrl -Method Post -ContentType "application/json" -Body $body
    if ($response.ok) {
        Write-Host "✓ Webhook đã được đăng ký thành công!" -ForegroundColor Green
        Write-Host "  Response: $($response.description)"
    } else {
        Write-Host "✗ Lỗi: $($response.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Lỗi kết nối: $_" -ForegroundColor Red
}

Write-Host ""

# ─── VERIFY WEBHOOK ─────────────────────────────────────────────────
Write-Host "➤ Kiểm tra thông tin webhook..." -ForegroundColor Yellow

$getUrl = "https://api.telegram.org/bot$botToken/getWebhookInfo"

try {
    $info = Invoke-RestMethod -Uri $getUrl -Method Get
    if ($info.ok) {
        Write-Host "✓ Webhook info:" -ForegroundColor Green
        Write-Host "  URL:                   $($info.result.url)"
        Write-Host "  Pending updates:       $($info.result.pending_update_count)"
        Write-Host "  Max connections:       $($info.result.max_connections)"
        if ($info.result.last_error_message) {
            Write-Host "  ⚠ Last error:          $($info.result.last_error_message)" -ForegroundColor Yellow
            Write-Host "  Last error date:       $($info.result.last_error_date)"
        } else {
            Write-Host "  Last error:            (none)"
        }
    } else {
        Write-Host "✗ Lỗi: $($info.description)" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Lỗi kết nối: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "====================================================="
Write-Host "  Hoàn thành. Giờ mở Telegram, chat với bot,"
Write-Host "  gõ /start để test."
Write-Host "====================================================="
Write-Host ""
