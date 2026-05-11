/**
 * Sinh URL ảnh VietQR động qua img.vietqr.io
 * Hoạt động với mọi ngân hàng VN có hỗ trợ NAPAS, không cần SDK/API key.
 */
export function generateVietQR(params: {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
}): string {
  const { bankBin, accountNumber, accountName, amount, description } = params;
  const encodedDesc = encodeURIComponent(description);
  const encodedName = encodeURIComponent(accountName);
  return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;
}

/**
 * Sinh order code unique để map với post.
 * Format: 16S + timestamp + random
 */
export function generateOrderCode(): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `16S${ts}${rand}`;
}

/**
 * Tên ngân hàng hiển thị từ BIN
 */
export const BANK_NAMES: Record<string, string> = {
  '970422': 'MBBank',
  '970418': 'BIDV',
  '970436': 'Vietcombank',
  '970407': 'Techcombank',
  '970432': 'VPBank',
  '970415': 'VietinBank',
  '970405': 'Agribank',
  '970423': 'TPBank',
  '970428': 'NamABank',
  '970454': 'BVBank',
};

export function bankName(bin: string): string {
  return BANK_NAMES[bin] ?? 'Unknown Bank';
}
