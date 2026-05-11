/**
 * CAPTURE GUIDE SYSTEM
 * 
 * Mỗi object_type có bộ góc chụp và anchor points riêng.
 * Custom object types có thể define anchors trong asset_metadata.
 */

export interface AnchorPoint {
  id: string;
  label: string;       // Hiển thị trên UI
  labelEn: string;     // English label
  x: string;           // % position horizontal
  y: string;           // % position vertical
  required: boolean;   // Bắt buộc khớp trước khi chụp
}

export interface CaptureAngle {
  id: string;
  label: string;       // "Mặt trước", "Mặt sau"...
  instruction: string; // Hướng dẫn chi tiết
  anchors: AnchorPoint[];
}

export interface CaptureGuide {
  objectType: string;
  displayName: string;
  icon: string;
  description: string;
  angles: CaptureAngle[];
  minPhotos: number;
}

// ── Built-in guides per object_type ───────────────────────────

export const CAPTURE_GUIDES: Record<string, CaptureGuide> = {

  sneaker: {
    objectType: 'sneaker',
    displayName: 'Giày Sneaker',
    icon: '👟',
    description: 'Chụp 4 góc để định danh hoàn chỉnh',
    minPhotos: 4,
    angles: [
      {
        id: 'front',
        label: 'Mặt bên',
        instruction: 'Đặt giày nghiêng 90°, nhìn thấy toàn bộ profile',
        anchors: [
          { id: 'toe_box', label: 'Mũi giày', labelEn: 'Toe Box', x: '18%', y: '72%', required: true },
          { id: 'logo',    label: 'Logo',     labelEn: 'Logo',    x: '50%', y: '22%', required: true },
          { id: 'heel',    label: 'Gót',      labelEn: 'Heel',    x: '82%', y: '65%', required: true },
          { id: 'sole',    label: 'Đế giày',  labelEn: 'Sole',    x: '50%', y: '85%', required: false },
        ],
      },
      {
        id: 'top',
        label: 'Mặt trên',
        instruction: 'Nhìn thẳng từ trên xuống, thấy lưỡi giày và dây',
        anchors: [
          { id: 'tongue',  label: 'Lưỡi',     labelEn: 'Tongue',   x: '50%', y: '30%', required: true },
          { id: 'laces',   label: 'Dây giày',  labelEn: 'Laces',   x: '50%', y: '55%', required: true },
          { id: 'toe_top', label: 'Mũi (trên)',labelEn: 'Toe Top', x: '50%', y: '80%', required: false },
        ],
      },
      {
        id: 'sole',
        label: 'Đế giày',
        instruction: 'Lật ngược đế giày hướng về camera',
        anchors: [
          { id: 'heel_unit',  label: 'Gót đế',    labelEn: 'Heel Unit', x: '50%', y: '25%', required: true },
          { id: 'midfoot',    label: 'Giữa đế',   labelEn: 'Midfoot',   x: '50%', y: '55%', required: true },
          { id: 'forefoot',   label: 'Mũi đế',    labelEn: 'Forefoot',  x: '50%', y: '80%', required: false },
        ],
      },
      {
        id: 'tag',
        label: 'Tem/Tag',
        instruction: 'Chụp rõ tem size bên trong giày',
        anchors: [
          { id: 'size_tag',   label: 'Tem size', labelEn: 'Size Tag', x: '50%', y: '45%', required: true },
          { id: 'sku',        label: 'Mã SKU',   labelEn: 'SKU',      x: '50%', y: '65%', required: true },
        ],
      },
    ],
  },

  watch: {
    objectType: 'watch',
    displayName: 'Đồng hồ',
    icon: '⌚',
    description: 'Chụp 3 góc chính của đồng hồ',
    minPhotos: 3,
    angles: [
      {
        id: 'dial',
        label: 'Mặt đồng hồ',
        instruction: 'Chụp thẳng mặt trước, ánh sáng đều',
        anchors: [
          { id: 'crown',   label: 'Núm vặn', labelEn: 'Crown',  x: '90%', y: '50%', required: true },
          { id: 'logo',    label: 'Logo',     labelEn: 'Logo',   x: '50%', y: '35%', required: true },
          { id: 'indices', label: 'Số giờ',  labelEn: 'Indices',x: '50%', y: '75%', required: true },
          { id: 'hands',   label: 'Kim',      labelEn: 'Hands',  x: '50%', y: '50%', required: false },
        ],
      },
      {
        id: 'caseback',
        label: 'Đáy đồng hồ',
        instruction: 'Lật ngược, chụp rõ caseback và serial number',
        anchors: [
          { id: 'serial',  label: 'Serial', labelEn: 'Serial No.', x: '50%', y: '40%', required: true },
          { id: 'engrave', label: 'Khắc',   labelEn: 'Engraving', x: '50%', y: '65%', required: false },
        ],
      },
      {
        id: 'bracelet',
        label: 'Dây đeo',
        instruction: 'Chụp toàn bộ dây đeo và khóa',
        anchors: [
          { id: 'clasp',   label: 'Khóa',  labelEn: 'Clasp',   x: '50%', y: '75%', required: true },
          { id: 'links',   label: 'Mắt xích',labelEn:'Links',  x: '50%', y: '45%', required: false },
        ],
      },
    ],
  },

  bag: {
    objectType: 'bag',
    displayName: 'Túi xách',
    icon: '👜',
    description: 'Chụp 4 góc để xác thực túi',
    minPhotos: 4,
    angles: [
      {
        id: 'front',
        label: 'Mặt trước',
        instruction: 'Chụp thẳng mặt trước túi, thấy rõ logo',
        anchors: [
          { id: 'logo',    label: 'Logo',       labelEn: 'Logo',        x: '50%', y: '35%', required: true },
          { id: 'clasp',   label: 'Khóa chính', labelEn: 'Main Clasp', x: '50%', y: '60%', required: true },
          { id: 'corner',  label: 'Góc túi',    labelEn: 'Corner',      x: '15%', y: '80%', required: false },
        ],
      },
      {
        id: 'interior',
        label: 'Bên trong',
        instruction: 'Mở túi, chụp lót trong và tag',
        anchors: [
          { id: 'lining',  label: 'Lót',      labelEn: 'Lining',   x: '50%', y: '40%', required: true },
          { id: 'int_tag', label: 'Tag trong', labelEn: 'Int. Tag', x: '50%', y: '70%', required: true },
        ],
      },
      {
        id: 'hardware',
        label: 'Kim loại',
        instruction: 'Chụp cận các chi tiết kim loại: khóa, móc, zipper',
        anchors: [
          { id: 'zipper',  label: 'Kéo',   labelEn: 'Zipper',  x: '50%', y: '35%', required: true },
          { id: 'stitch',  label: 'Chỉ may',labelEn:'Stitching',x: '50%', y: '65%', required: false },
        ],
      },
      {
        id: 'base',
        label: 'Đáy túi',
        instruction: 'Chụp đáy túi và các chân đỡ',
        anchors: [
          { id: 'feet',    label: 'Chân đỡ', labelEn: 'Feet',  x: '50%', y: '60%', required: true },
          { id: 'base_stitch', label: 'Chỉ đáy', labelEn: 'Base Stitch', x: '30%', y: '40%', required: false },
        ],
      },
    ],
  },

  art: {
    objectType: 'art',
    displayName: 'Tác phẩm nghệ thuật',
    icon: '🎨',
    description: 'Chụp 3 góc để xác thực tác phẩm',
    minPhotos: 3,
    angles: [
      {
        id: 'full',
        label: 'Toàn cảnh',
        instruction: 'Chụp toàn bộ tác phẩm, ánh sáng đều không bóng',
        anchors: [
          { id: 'center',    label: 'Trung tâm', labelEn: 'Center',      x: '50%', y: '50%', required: true },
          { id: 'top_left',  label: 'Góc TL',    labelEn: 'Top Left',    x: '15%', y: '15%', required: true },
          { id: 'bot_right', label: 'Góc BR',    labelEn: 'Bottom Right',x: '85%', y: '85%', required: true },
        ],
      },
      {
        id: 'signature',
        label: 'Chữ ký',
        instruction: 'Chụp cận chữ ký và năm sáng tác',
        anchors: [
          { id: 'signature', label: 'Chữ ký', labelEn: 'Signature', x: '50%', y: '50%', required: true },
        ],
      },
      {
        id: 'texture',
        label: 'Kết cấu',
        instruction: 'Chụp cận bề mặt để thấy kết cấu vật liệu',
        anchors: [
          { id: 'texture',   label: 'Bề mặt', labelEn: 'Texture', x: '50%', y: '50%', required: true },
          { id: 'edge',      label: 'Cạnh',   labelEn: 'Edge',    x: '20%', y: '50%', required: false },
        ],
      },
    ],
  },

  ceramics: {
    objectType: 'ceramics',
    displayName: 'Đồ gốm sứ',
    icon: '🏺',
    description: 'Chụp 4 góc để định danh gốm sứ',
    minPhotos: 4,
    angles: [
      {
        id: 'front',
        label: 'Mặt trước',
        instruction: 'Chụp mặt chính của tác phẩm',
        anchors: [
          { id: 'pattern',  label: 'Hoa văn', labelEn: 'Pattern', x: '50%', y: '40%', required: true },
          { id: 'rim',      label: 'Miệng',   labelEn: 'Rim',     x: '50%', y: '15%', required: true },
          { id: 'body',     label: 'Thân',    labelEn: 'Body',    x: '50%', y: '60%', required: false },
        ],
      },
      {
        id: 'base',
        label: 'Đáy',
        instruction: 'Lật ngược, chụp rõ đáy và dấu hiệu lò nung',
        anchors: [
          { id: 'mark',     label: 'Dấu lò',  labelEn: 'Kiln Mark', x: '50%', y: '50%', required: true },
          { id: 'foot_rim', label: 'Chân đế', labelEn: 'Foot Rim',  x: '50%', y: '75%', required: false },
        ],
      },
      {
        id: 'detail',
        label: 'Chi tiết',
        instruction: 'Chụp cận chi tiết đặc biệt, vết nứt, men sứ',
        anchors: [
          { id: 'glaze',    label: 'Men sứ',  labelEn: 'Glaze',   x: '50%', y: '50%', required: true },
        ],
      },
      {
        id: 'side',
        label: 'Mặt bên',
        instruction: 'Chụp profile từ bên cạnh',
        anchors: [
          { id: 'profile',  label: 'Profile', labelEn: 'Profile', x: '50%', y: '50%', required: true },
        ],
      },
    ],
  },

  // Generic fallback cho mọi object type khác
  generic: {
    objectType: 'generic',
    displayName: 'Vật phẩm',
    icon: '📦',
    description: 'Chụp đa góc để định danh vật phẩm',
    minPhotos: 3,
    angles: [
      {
        id: 'front',
        label: 'Mặt trước',
        instruction: 'Chụp mặt chính của vật phẩm',
        anchors: [
          { id: 'center',  label: 'Trung tâm', labelEn: 'Center', x: '50%', y: '50%', required: true },
          { id: 'top',     label: 'Phía trên', labelEn: 'Top',    x: '50%', y: '20%', required: false },
          { id: 'bottom',  label: 'Phía dưới', labelEn: 'Bottom', x: '50%', y: '80%', required: false },
        ],
      },
      {
        id: 'back',
        label: 'Mặt sau',
        instruction: 'Lật lại, chụp mặt sau',
        anchors: [
          { id: 'back_center', label: 'Mặt sau', labelEn: 'Back', x: '50%', y: '50%', required: true },
        ],
      },
      {
        id: 'detail',
        label: 'Chi tiết',
        instruction: 'Chụp cận chi tiết đặc trưng nhất',
        anchors: [
          { id: 'detail', label: 'Chi tiết', labelEn: 'Detail', x: '50%', y: '50%', required: true },
        ],
      },
    ],
  },
};

// ── Helper functions ───────────────────────────────────────────

/**
 * Lấy capture guide theo object_type.
 * Fallback về generic nếu không có config.
 */
export function getCaptureGuide(objectType: string): CaptureGuide {
  return CAPTURE_GUIDES[objectType] ?? CAPTURE_GUIDES.generic;
}

/**
 * Tất cả object types có sẵn
 */
export const OBJECT_TYPES = [
  { id: 'sneaker',   label: 'Giày Sneaker',         icon: '👟' },
  { id: 'watch',     label: 'Đồng hồ',              icon: '⌚' },
  { id: 'bag',       label: 'Túi xách',             icon: '👜' },
  { id: 'art',       label: 'Tác phẩm nghệ thuật',  icon: '🎨' },
  { id: 'ceramics',  label: 'Đồ gốm sứ',            icon: '🏺' },
  { id: 'generic',   label: 'Khác',                 icon: '📦' },
] as const;

export type ObjectTypeId = typeof OBJECT_TYPES[number]['id'];
