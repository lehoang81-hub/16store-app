'use client'
import { useEffect } from 'react'

export default function ViewTracker({ lotId }: { lotId: string }) {
  useEffect(() => {
    fetch(`/api/lots/${lotId}/view`, { method: 'POST' })
  }, [lotId])
  return null
}