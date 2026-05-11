/**
 * 16Store Settings Types
 * Dùng trong admin/settings page
 */

export type SettingCategory =
  | 'Platform'
  | 'Affiliate'
  | 'Verification'
  | 'Payment'
  | 'Messaging'
  | 'General';

export type SettingValueType = 'string' | 'number' | 'boolean' | 'percentage';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  valueType: SettingValueType;
  defaultValue: string;
  validation?: (value: string) => boolean;
  inputType?: 'text' | 'number' | 'toggle' | 'select';
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  unit?: string; // e.g. "%" or "VND"
}

/**
 * Hardcoded definitions của tất cả 16Store settings
 * Được dùng để render form + validate user input
 */
export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  '16store.affiliate_fee_percent': {
    key: '16store.affiliate_fee_percent',
    label: 'Affiliate Commission Rate',
    description: 'Phần trăm hoa hồng cho affiliate partners',
    category: 'Affiliate',
    valueType: 'percentage',
    defaultValue: '3',
    inputType: 'number',
    min: 0,
    max: 50,
    unit: '%',
    validation: (v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num >= 0 && num <= 50;
    },
  },

  '16store.platform_fee_percent': {
    key: '16store.platform_fee_percent',
    label: 'Platform Fee Rate',
    description: 'Phần trăm phí nền tảng trích từ mỗi giao dịch',
    category: 'Payment',
    valueType: 'percentage',
    defaultValue: '5',
    inputType: 'number',
    min: 0,
    max: 30,
    unit: '%',
    validation: (v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num >= 0 && num <= 30;
    },
  },

  '16store.min_post_price_vnd': {
    key: '16store.min_post_price_vnd',
    label: 'Minimum Post Price',
    description: 'Giá tối thiểu cho mỗi bài đăng (VND)',
    category: 'Platform',
    valueType: 'number',
    defaultValue: '100000',
    inputType: 'number',
    min: 10000,
    unit: 'VND',
    validation: (v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 10000;
    },
  },

  '16store.max_post_price_vnd': {
    key: '16store.max_post_price_vnd',
    label: 'Maximum Post Price',
    description: 'Giá tối đa cho mỗi bài đăng (VND)',
    category: 'Platform',
    valueType: 'number',
    defaultValue: '1000000000',
    inputType: 'number',
    min: 100000,
    unit: 'VND',
    validation: (v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 100000;
    },
  },

  '16store.deposit_percent': {
    key: '16store.deposit_percent',
    label: 'Deposit Percentage',
    description: 'Phần trăm tiền cọc yêu cầu khi mua',
    category: 'Payment',
    valueType: 'percentage',
    defaultValue: '30',
    inputType: 'number',
    min: 0,
    max: 100,
    unit: '%',
    validation: (v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num >= 0 && num <= 100;
    },
  },

  '16store.reservation_timeout_hours': {
    key: '16store.reservation_timeout_hours',
    label: 'Reservation Timeout',
    description: 'Thời gian tối đa để hoàn thành thanh toán sau khi cọc (giờ)',
    category: 'Payment',
    valueType: 'number',
    defaultValue: '24',
    inputType: 'number',
    min: 1,
    max: 168,
    unit: 'hours',
    validation: (v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 1 && num <= 168;
    },
  },

  '16store.seller_payout_delay_days': {
    key: '16store.seller_payout_delay_days',
    label: 'Seller Payout Delay',
    description: 'Số ngày đợi trước khi chuyển tiền cho seller (hold period)',
    category: 'Payment',
    valueType: 'number',
    defaultValue: '7',
    inputType: 'number',
    min: 0,
    max: 30,
    unit: 'days',
    validation: (v) => {
      const num = parseInt(v);
      return !isNaN(num) && num >= 0 && num <= 30;
    },
  },

  '16store.verification_required': {
    key: '16store.verification_required',
    label: 'Require Verification',
    description: 'Bắt buộc xác minh post trước khi live?',
    category: 'Verification',
    valueType: 'boolean',
    defaultValue: 'true',
    inputType: 'toggle',
    validation: (v) => v === 'true' || v === 'false',
  },

  '16store.auto_reject_unverified': {
    key: '16store.auto_reject_unverified',
    label: 'Auto Reject After Timeout',
    description: 'Tự động reject post nếu không xác minh sau 48h?',
    category: 'Verification',
    valueType: 'boolean',
    defaultValue: 'false',
    inputType: 'toggle',
    validation: (v) => v === 'true' || v === 'false',
  },

  '16store.default_hub_id': {
    key: '16store.default_hub_id',
    label: 'Default Hub',
    description: 'Hub mặc định cho post (nếu không specify)',
    category: 'Platform',
    valueType: 'string',
    defaultValue: 'hcm-01',
    inputType: 'text',
    validation: (v) => v.length > 0,
  },

  '16store.zalo_notification_enabled': {
    key: '16store.zalo_notification_enabled',
    label: 'Enable Zalo Notifications',
    description: 'Gửi thông báo qua Zalo?',
    category: 'Messaging',
    valueType: 'boolean',
    defaultValue: 'true',
    inputType: 'toggle',
    validation: (v) => v === 'true' || v === 'false',
  },

  '16store.telegram_notification_enabled': {
    key: '16store.telegram_notification_enabled',
    label: 'Enable Telegram Notifications',
    description: 'Gửi thông báo qua Telegram?',
    category: 'Messaging',
    valueType: 'boolean',
    defaultValue: 'true',
    inputType: 'toggle',
    validation: (v) => v === 'true' || v === 'false',
  },

  '16store.sms_notification_enabled': {
    key: '16store.sms_notification_enabled',
    label: 'Enable SMS Notifications',
    description: 'Gửi thông báo qua SMS?',
    category: 'Messaging',
    valueType: 'boolean',
    defaultValue: 'false',
    inputType: 'toggle',
    validation: (v) => v === 'true' || v === 'false',
  },
};

/**
 * Helper: Lấy setting definition theo key
 */
export function getSettingDef(key: string): SettingDefinition | undefined {
  return SETTING_DEFINITIONS[key];
}

/**
 * Helper: Lấy tất cả settings grouped by category
 */
export function getSettingsByCategory(): Record<SettingCategory, SettingDefinition[]> {
  const grouped = {} as Record<SettingCategory, SettingDefinition[]>;

  Object.values(SETTING_DEFINITIONS).forEach((def) => {
    if (!grouped[def.category]) {
      grouped[def.category] = [];
    }
    grouped[def.category].push(def);
  });

  return grouped;
}

export type SystemConfig = Record<string, SettingValueType>;
