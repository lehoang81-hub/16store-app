import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { target_type, target_id, reason, detail } = await req.json()
    if (!target_type || !target_id || !reason) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Không tự report mình
    if (target_type === 'seller' && target_id === user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        target_type,
        target_id,
        reason,
        detail: detail ?? null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ report: data })
  } catch (err) {
    console.error('[reports]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
