'use client'

import { useState, useRef, useEffect } from 'react'

interface Spot {
  x: number
  y: number
  label: string
  description: string
}

interface HotspotViewerProps {
  postId: string
  imageUrl: string
  initialSpots?: Spot[] | null
}

export function HotspotViewer({ postId, imageUrl, initialSpots }: HotspotViewerProps) {
  const [spots, setSpots] = useState<Spot[]>(initialSpots ?? [])
  const [loading, setLoading] = useState(false)
  const [activeSpot, setActiveSpot] = useState<number | null>(null)
  const [generated, setGenerated] = useState(!!initialSpots?.length)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Close popup khi click ngoài
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        activeSpot !== null &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setActiveSpot(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeSpot])

  async function handleGenerate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/hotspots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, image_url: imageUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Có lỗi xảy ra')
        return
      }
      setSpots(data.hotspot.spots)
      setGenerated(true)
    } catch {
      setError('Mất kết nối, thử lại nhé.')
    } finally {
      setLoading(false)
    }
  }

  // Tính vị trí popup — tránh bị tràn ra ngoài
  function getPopupPosition(spot: Spot) {
    const isRight = spot.x > 0.6
    const isBottom = spot.y > 0.6
    return {
      left: isRight ? 'auto' : 'calc(100% + 12px)',
      right: isRight ? 'calc(100% + 12px)' : 'auto',
      top: isBottom ? 'auto' : '0',
      bottom: isBottom ? '0' : 'auto',
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-rust flex items-center gap-2 before:content-[''] before:w-2 before:h-2 before:bg-rust">
          AI Hotspot Analysis
        </div>
        {!generated && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-rust text-ink px-4 py-2 font-mono text-[10px] font-bold tracking-[0.18em] uppercase hover:bg-bone transition-colors disabled:opacity-40 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-3 h-3 border border-ink border-t-transparent rounded-full animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : (
              '✦ Phân tích AI →'
            )}
          </button>
        )}
        {generated && (
          <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6ec070]">
            ✓ {spots.length} điểm đã phân tích
          </div>
        )}
      </div>

      {error && (
        <p className="font-mono text-[11px] text-rust mb-3">{error}</p>
      )}

      {/* Image với overlay */}
      <div ref={containerRef} className="relative select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Sneaker hotspot view"
          className="w-full object-cover"
          draggable={false}
        />

        {/* SVG overlay */}
        {generated && spots.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <style>{`
                @keyframes pulse-ring {
                  0%   { r: 3; opacity: 0.8; }
                  70%  { r: 6; opacity: 0; }
                  100% { r: 6; opacity: 0; }
                }
                @keyframes pulse-dot {
                  0%, 100% { opacity: 1; }
                  50%       { opacity: 0.6; }
                }
                .spot-ring {
                  animation: pulse-ring 2s ease-out infinite;
                  fill: none;
                  stroke: #e0a23a;
                  stroke-width: 0.5;
                }
                .spot-dot {
                  animation: pulse-dot 2s ease-in-out infinite;
                  fill: #e0a23a;
                }
                .spot-ring-active {
                  fill: none;
                  stroke: #ebe6dc;
                  stroke-width: 0.5;
                  r: 5;
                }
                .spot-dot-active {
                  fill: #ebe6dc;
                }
              `}</style>
            </defs>

            {spots.map((spot, i) => {
              const cx = spot.x * 100
              const cy = spot.y * 100
              const isActive = activeSpot === i
              const delay = `${i * 0.4}s`

              return (
                <g
                  key={i}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveSpot(isActive ? null : i)
                  }}
                >
                  {/* Pulse ring */}
                  {!isActive && (
                    <circle
                      cx={cx} cy={cy}
                      className="spot-ring"
                      style={{ animationDelay: delay }}
                    />
                  )}
                  {/* Active ring */}
                  {isActive && (
                    <circle cx={cx} cy={cy} r="5" className="spot-ring-active" />
                  )}
                  {/* Center dot */}
                  <circle
                    cx={cx} cy={cy} r="2"
                    className={isActive ? 'spot-dot-active' : 'spot-dot'}
                    style={{ animationDelay: delay }}
                  />
                  {/* Hit area (invisible, larger for easier tap) */}
                  <circle cx={cx} cy={cy} r="6" fill="transparent" />
                </g>
              )
            })}
          </svg>
        )}

        {/* Popup */}
        {activeSpot !== null && spots[activeSpot] && (
          <div
            ref={popupRef}
            className="absolute z-20 w-56 bg-ink border border-hazard p-3 shadow-lg"
            style={{
              left: `${spots[activeSpot].x * 100}%`,
              top: `${spots[activeSpot].y * 100}%`,
              transform: spots[activeSpot].x > 0.6
                ? 'translate(-110%, -50%)'
                : 'translate(10%, -50%)',
            }}
          >
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-hazard mb-1">
              {spots[activeSpot].label}
            </div>
            <p className="font-mono text-[11px] text-bone-2 leading-relaxed">
              {spots[activeSpot].description}
            </p>
            <button
              onClick={() => setActiveSpot(null)}
              className="absolute top-2 right-2 text-concrete hover:text-bone font-mono text-[10px]"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-6 h-6 border-2 border-rust border-t-transparent rounded-full animate-spin mb-2" />
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-bone-2">
                Gemini đang phân tích...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Spot list */}
      {generated && spots.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {spots.map((spot, i) => (
            <button
              key={i}
              onClick={() => setActiveSpot(activeSpot === i ? null : i)}
              className={`text-left p-2 border transition-colors ${
                activeSpot === i
                  ? 'border-hazard bg-hazard/10'
                  : 'border-line hover:border-hazard/50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-hazard flex-shrink-0" />
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-hazard truncate">
                  {spot.label}
                </span>
              </div>
              <p className="font-mono text-[10px] text-concrete leading-relaxed line-clamp-2">
                {spot.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
