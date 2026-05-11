'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'

interface FavoriteButtonProps {
  postId: string
  initialFavorited?: boolean
  className?: string
}

export default function FavoriteButton({ postId, initialFavorited = false, className = '' }: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Check actual state từ server
    fetch(`/api/favorites/${postId}`)
      .then(r => r.json())
      .then(d => {
        setIsFavorited(d.isFavorited)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [postId])

  const toggle = async () => {
    setLoading(true)
    try {
      if (isFavorited) {
        await fetch(`/api/favorites/${postId}`, { method: 'DELETE' })
        setIsFavorited(false)
      } else {
        await fetch(`/api/favorites/${postId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notify_price_drop: false })
        })
        setIsFavorited(true)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!checked) return (
    <button disabled className={`opacity-0 ${className}`}>
      <Heart size={20} />
    </button>
  )

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isFavorited ? 'Bỏ yêu thích' : 'Lưu yêu thích'}
      className={`
        flex items-center gap-1.5 px-3 py-2 rounded border transition-all duration-200
        ${isFavorited
          ? 'border-rust bg-rust/10 text-rust'
          : 'border-line text-bone-2 hover:border-rust hover:text-rust'
        }
        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <Heart
        size={16}
        className={`transition-all ${isFavorited ? 'fill-rust' : ''}`}
      />
      <span className="text-xs font-mono">
        {isFavorited ? 'ĐÃ LƯU' : 'LƯU'}
      </span>
    </button>
  )
}