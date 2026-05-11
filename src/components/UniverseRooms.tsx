'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const ROOMS = [
  {
    id: 'store', number: '01', name: 'Store', suffix: 'Room',
    tagline: 'Nơi vật phẩm có linh hồn số',
    desc: 'Giày · Gear · Đồng hồ · Túi xách · Mỗi vật phẩm một hộ chiếu riêng.',
    status: 'open', statusLabel: 'Đang mở', href: '/',
    accent: '#c8531c',
    bg: 'radial-gradient(ellipse at 30% 50%, #1a0a05 0%, #080808 70%)',
    particles: ['◆', '◈', '◉'],
  },
  {
    id: 'race', number: '02', name: 'Race', suffix: 'Room',
    tagline: 'Mỗi bước chạy là một dấu ấn',
    desc: 'Giải chạy · BIB · Hành trình · Dù là 1 pixel cũng đã hiện diện.',
    status: 'open', statusLabel: 'Đang mở', href: 'https://hlrace.netlify.app',
    accent: '#1a8ab0',
    bg: 'radial-gradient(ellipse at 70% 50%, #031218 0%, #080808 70%)',
    particles: ['▲', '△', '▷'],
  },
  {
    id: 'flower', number: '03', name: 'Flower', suffix: '& Fruit',
    tagline: 'Hoa tươi và hoa quả nghệ thuật',
    desc: 'Bó hoa · Giỏ quà · Hoa nghệ thuật · Mỗi bó hoa là một thông điệp yêu thương.',
    status: 'soon', statusLabel: 'Sắp ra mắt', href: null,
    accent: '#d4527a',
    bg: 'radial-gradient(ellipse at 40% 60%, #1a0810 0%, #080808 70%)',
    particles: ['✿', '❀', '❋'],
  },
  {
    id: 'estate', number: '04', name: 'Estate', suffix: 'Room',
    tagline: 'Tài sản lớn có hộ chiếu số',
    desc: 'Bất động sản · Xe cộ · Pháp lý · Số hóa mọi tài sản có giá trị.',
    status: 'soon', statusLabel: 'Sắp ra mắt', href: null,
    accent: '#c49a2a',
    bg: 'radial-gradient(ellipse at 60% 40%, #12100a 0%, #080808 70%)',
    particles: ['⬡', '⬢', '⬟'],
  },
  {
    id: 'motor', number: '05', name: 'Motor', suffix: 'Room',
    tagline: 'Xe không chỉ là phương tiện',
    desc: 'Ô tô · Xe máy · Phụ tùng · Hành trình của xe — được ghi lại mãi mãi.',
    status: 'soon', statusLabel: 'Sắp ra mắt', href: null,
    accent: '#c04030',
    bg: 'radial-gradient(ellipse at 30% 30%, #120808 0%, #080808 70%)',
    particles: ['◯', '○', '⊙'],
  },
  {
    id: 'art', number: '06', name: 'Art', suffix: 'Room',
    tagline: 'Nghệ thuật tìm chủ nhân mới',
    desc: 'Tranh · Tác phẩm · Collectibles · Mỗi tác phẩm mang DNA người sáng tạo.',
    status: 'coming', statusLabel: 'Coming soon', href: null,
    accent: '#9a6dd0',
    bg: 'radial-gradient(ellipse at 70% 20%, #0d0814 0%, #080808 70%)',
    particles: ['✦', '✧', '✩'],
  },
  {
    id: 'living', number: '07', name: 'Living', suffix: 'Room',
    tagline: 'Sinh vật xứng đáng có hộ chiếu',
    desc: 'Thú cưng · Cây cảnh · Sinh vật · Mỗi sinh linh một câu chuyện riêng.',
    status: 'coming', statusLabel: 'Coming soon', href: null,
    accent: '#4a9a4a',
    bg: 'radial-gradient(ellipse at 20% 80%, #081208 0%, #080808 70%)',
    particles: ['🌿', '🍃', '🌱'],
  },
  {
    id: 'vault', number: '08', name: 'Vault', suffix: 'Room',
    tagline: 'Tài sản tối thượng — được bảo vệ',
    desc: 'Kim cương · Đồng hồ hàng hiệu · Tài liệu pháp lý · Chỉ dành cho tài sản xứng đáng.',
    status: 'invite', statusLabel: 'Invite only', href: null,
    accent: '#6a8ac0',
    bg: 'radial-gradient(ellipse at 50% 50%, #0a0a14 0%, #080808 70%)',
    particles: ['◈', '◇', '◆'],
    wide: true,
  },
]

const STATUS_COLORS: Record<string, string> = {
  open: '#6ec070', soon: '#f0c419', coming: '#2a2a2a', invite: '#6a8ac0',
}
const STATUS_CTA: Record<string, string> = {
  open: 'Bước vào', soon: 'Đăng ký sớm', coming: 'Coming soon', invite: 'Yêu cầu truy cập',
}

export function UniverseRooms() {
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <section style={{ padding: '2px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '2px',
      }}>
        {ROOMS.map((room) => {
          const isActive = activeRoom === room.id
          const isClickable = room.status === 'open'
          const statusColor = STATUS_COLORS[room.status] ?? '#2a2a2a'

          const inner = (
            <div
              onMouseEnter={() => setActiveRoom(room.id)}
              onMouseLeave={() => setActiveRoom(null)}
              onTouchStart={() => setActiveRoom(room.id)}
              onTouchEnd={() => setTimeout(() => setActiveRoom(null), 300)}
              style={{
                position: 'relative',
                padding: isMobile
                  ? '28px 24px'
                  : room.wide ? '40px 48px' : '36px 32px',
                minHeight: isMobile ? 160 : room.wide ? 140 : 220,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                cursor: isClickable ? 'pointer' : 'default',
                overflow: 'hidden',
                background: room.bg,
                borderLeft: `3px solid ${isActive ? room.accent : 'rgba(235,230,220,0.05)'}`,
                transition: 'border-color 0.3s, transform 0.3s',
                transform: isActive && mounted && !isMobile ? 'scale(1.006)' : 'scale(1)',
                zIndex: isActive ? 2 : 1,
              }}
            >
              {/* Particles */}
              {mounted && room.particles.map((p, i) => (
                <span key={i} style={{
                  position: 'absolute',
                  color: room.accent,
                  opacity: isActive ? 0.12 : 0.03,
                  fontSize: isMobile ? `${18 + i * 10}px` : `${26 + i * 16}px`,
                  top: `${15 + i * 28}%`,
                  right: `${8 + i * 5}%`,
                  transition: 'opacity 0.35s',
                  pointerEvents: 'none',
                }}>
                  {p}
                </span>
              ))}

              {/* Watermark number */}
              {!isMobile && (
                <div style={{
                  position: 'absolute', top: 20, right: 24,
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: 72, color: 'rgba(255,255,255,0.025)',
                  lineHeight: 1, pointerEvents: 'none',
                }}>
                  {room.number}
                </div>
              )}

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Status */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: statusColor, display: 'inline-block',
                    boxShadow: room.status === 'open' ? `0 0 8px ${statusColor}` : 'none',
                  }} />
                  <span style={{ color: statusColor }}>{room.statusLabel}</span>
                </div>

                {/* Name */}
                <div style={{
                  fontFamily: "'Archivo Black', 'Arial Black', sans-serif",
                  fontSize: isMobile ? 20 : room.wide ? 28 : 24,
                  textTransform: 'uppercase', letterSpacing: '-0.01em',
                  lineHeight: 1, marginBottom: 8,
                }}>
                  <span style={{ color: room.accent }}>{room.name}</span>
                  {' '}
                  <span style={{ color: '#ebe6dc' }}>{room.suffix}</span>
                </div>

                {/* Tagline */}
                <div style={{
                  fontFamily: "'Instrument Serif', Georgia, serif",
                  fontStyle: 'italic', fontSize: isMobile ? 13 : 14,
                  color: isActive ? '#c9c2b3' : '#6b6660',
                  marginBottom: 6, transition: 'color 0.3s',
                }}>
                  {room.tagline}
                </div>

                {/* Desc — ẩn trên mobile để gọn */}
                {!isMobile && !room.wide && (
                  <div style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 10, letterSpacing: '0.1em',
                    color: isActive ? room.accent + '90' : '#4a4a40',
                    textTransform: 'uppercase', lineHeight: 1.7,
                    transition: 'color 0.3s',
                  }}>
                    {room.desc}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div style={{
                position: 'relative', zIndex: 1, marginTop: 16,
                fontFamily: "'Space Mono', monospace",
                fontSize: isMobile ? 9 : 10, letterSpacing: '0.22em', textTransform: 'uppercase',
                color: isClickable ? room.accent : statusColor,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {STATUS_CTA[room.status] ?? 'Coming soon'}
                {isClickable && (
                  <span style={{
                    display: 'inline-block',
                    transform: isActive ? 'translateX(6px)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                  }}>→</span>
                )}
              </div>
            </div>
          )

          // Vault full width
          if (room.wide) {
            return (
              <div key={room.id} style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                {inner}
              </div>
            )
          }

          if (isClickable && room.href) {
            return (
              <Link key={room.id} href={room.href}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                {inner}
              </Link>
            )
          }

          return <div key={room.id}>{inner}</div>
        })}
      </div>
    </section>
  )
}
