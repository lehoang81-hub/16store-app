import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getCurrentUser } from '@/lib/queries/current-user'

// Điểm reputation theo số sao (chỉ áp dụng cho buyer_to_seller)
const REPUTATION_DELTA: Record<number, number> = {
  1: -3,
  2: -1,
  3: 2,
  4: 3,
  5: 5,
}

// Badge tier theo reputation_score
function getBadge(score: number): string {
  if (score >= 2500) return 'platinum'
  if (score >= 1000) return 'gold'
  if (score >= 500) return 'silver'
  return 'bronze'
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_id, review_type, rating, comment } = await req.json()

    if (!order_id || !review_type || !rating) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify order
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id, seller_id, status')
      .eq('id', order_id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status !== 'completed') {
      return NextResponse.json({ error: 'Can only review completed orders' }, { status: 409 })
    }

    // Verify quyền review
    const isBuyer = order.buyer_id === user.id
    const isSeller = order.seller_id === user.id

    if (review_type === 'buyer_to_seller' && !isBuyer) {
      return NextResponse.json({ error: 'Only buyer can review seller' }, { status: 403 })
    }
    if (review_type === 'seller_to_buyer' && !isSeller) {
      return NextResponse.json({ error: 'Only seller can review buyer' }, { status: 403 })
    }
    if (review_type === 'buyer_to_platform' && !isBuyer) {
      return NextResponse.json({ error: 'Only buyer can review platform' }, { status: 403 })
    }

    const reviewee_id = review_type === 'buyer_to_seller'
      ? order.seller_id
      : review_type === 'seller_to_buyer'
      ? order.buyer_id
      : null

    // AI moderation
    const badWords = ['lừa', 'scam', 'fake', 'giả']
    const aiFlagged = comment && badWords.some(w => comment.toLowerCase().includes(w))

    // Insert review
    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        order_id,
        reviewer_id: user.id,
        reviewee_id,
        review_type,
        rating,
        comment: comment ?? null,
        ai_moderated: true,
        ai_flagged: aiFlagged ?? false,
        is_visible: !aiFlagged,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already reviewed' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Cập nhật reputation cho reviewee (chỉ buyer_to_seller, không bị flag)
    if (reviewee_id && review_type === 'buyer_to_seller' && !aiFlagged) {
      const delta = REPUTATION_DELTA[rating] ?? 0

      if (delta !== 0) {
        // Cộng/trừ điểm
        try {
          await supabase.rpc('increment_reputation', {
            p_user_id: reviewee_id,
            p_delta: delta,
          })
        } catch { /* ignore */ }

        // Log vào reputation_log
        try {
          await supabase
            .from('reputation_log')
            .insert({
              user_id: reviewee_id,
              delta,
              reason: delta > 0 ? 'positive_review' : 'negative_review',
              related_post_id: null,
              notes: `${rating}⭐ review từ đơn hàng ${order_id.slice(0, 8)}`,
            })
        } catch { /* ignore */ }

        // Cập nhật badge tự động
        const { data: updatedUser } = await supabase
          .from('users')
          .select('reputation_score')
          .eq('id', reviewee_id)
          .single()

        if (updatedUser) {
          const newBadge = getBadge(updatedUser.reputation_score)
          try {
            await supabase
              .from('users')
              .update({
                badge: newBadge,
                badge_updated_at: new Date().toISOString(),
              })
              .eq('id', reviewee_id)
          } catch { /* ignore */ }
        }
      }
    }

    return NextResponse.json({ review })
  } catch (err) {
    console.error('[reviews]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const user_id = searchParams.get('user_id')
    const order_id = searchParams.get('order_id')

    const supabase = createServiceClient()

    let query = supabase
      .from('reviews')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false })

    if (user_id) query = query.eq('reviewee_id', user_id)
    if (order_id) query = query.eq('order_id', order_id)

    const { data, error } = await query.limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reviews: data })
  } catch (err) {
    console.error('[reviews/get]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}