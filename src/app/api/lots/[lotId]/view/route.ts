import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ lotId: string }> }
) {
  const { lotId } = await params
  const supabase = createServiceClient()

  await supabase.rpc('increment_view_count', { p_lot_id: lotId })

  return NextResponse.json({ success: true })
}