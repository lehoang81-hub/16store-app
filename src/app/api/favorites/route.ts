import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('favorites')
    .select(`
      post_id,
      notes,
      notify_price_drop,
      created_at,
      posts (
        id,
        lot_id,
        brand,
        model,
        colorway,
        size_us,
        asking_price_vnd,
        cover_image_url,
        status,
        is_mystery
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favorites: data })
}