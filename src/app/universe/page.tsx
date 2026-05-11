import { Nav } from '@/components/Nav'
import { UniverseRooms } from '@/components/UniverseRooms'

export default function UniversePage() {
  return (
    <>
      <Nav />
      <main style={{ background: '#080808', minHeight: '100vh', color: '#ebe6dc', overflowX: 'hidden' }}>

        {/* Hero */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(20px, 5vw, 48px) clamp(40px, 6vw, 72px)',
          textAlign: 'center',
          position: 'relative',
          borderBottom: '1px solid rgba(235,230,220,0.06)',
        }}>
          {/* Grain */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04, zIndex: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }} />

          <div style={{ position: 'relative', zIndex: 1, margin: '0 auto', maxWidth: 680 }}>
            {/* Tag */}
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 'clamp(8px, 1.5vw, 10px)', letterSpacing: '0.4em',
              color: '#c8531c', textTransform: 'uppercase', marginBottom: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <span style={{ width: 32, height: 1, background: '#c8531c', display: 'inline-block', flexShrink: 0 }} />
              <span>HLRace Universe · 1 ID · Vô hạn thế giới</span>
              <span style={{ width: 32, height: 1, background: '#c8531c', display: 'inline-block', flexShrink: 0 }} />
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: "'Archivo Black', 'Arial Black', sans-serif",
              fontSize: 'clamp(36px, 8vw, 80px)',
              lineHeight: 0.95, letterSpacing: '-0.03em',
              textTransform: 'uppercase', marginBottom: 20,
              textAlign: 'center', wordBreak: 'keep-all',
            }}>
              Một cánh cửa.
              <br />
              <span style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontStyle: 'italic', fontWeight: 'normal', color: '#c8531c',
              }}>
                Ngàn vũ trụ.
              </span>
            </h1>

            {/* Sub */}
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 'clamp(9px, 1.8vw, 11px)', letterSpacing: '0.16em',
              color: '#6b6660', textTransform: 'uppercase',
              lineHeight: 2, textAlign: 'center',
            }}>
              Mỗi Room là một thế giới riêng biệt.<br />
              Một tài khoản — xuyên suốt mọi không gian.
            </p>

            <div style={{ width: 40, height: 1, background: '#c8531c', margin: '28px auto 0' }} />
          </div>
        </section>

        {/* Rooms */}
        <UniverseRooms />

        {/* Footer */}
        <footer style={{
          padding: 'clamp(32px, 5vw, 48px)',
          textAlign: 'center',
          borderTop: '1px solid rgba(235,230,220,0.06)',
        }}>
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 10, letterSpacing: '0.28em',
            color: '#2a2a2a', textTransform: 'uppercase', marginBottom: 20,
          }}>
            HLRace Universe · Powered by 16Store Infrastructure
          </div>
          <a href="/" style={{
            display: 'inline-block',
            padding: 'clamp(12px, 2vw, 14px) clamp(28px, 5vw, 40px)',
            background: '#c8531c', color: '#080808',
            fontFamily: "'Space Mono', monospace",
            fontSize: 'clamp(10px, 1.8vw, 11px)', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 'bold', textDecoration: 'none',
          }}>
            Vào Store Room →
          </a>
        </footer>
      </main>
    </>
  )
}
