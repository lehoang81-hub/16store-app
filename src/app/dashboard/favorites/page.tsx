import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: favorites } = await supabase
    .from('favorites')
    .select(`
      post_id, notes, notify_price_drop, created_at,
      posts (
        id, lot_id, brand, model, colorway,
        size_us, asking_price_vnd, cover_image_url, status, is_mystery
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-ink text-bone px-4 py-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-archivo text-2xl font-black tracking-tight">
          WISHLIST
        </h1>
        <p className="text-bone-2 text-sm font-mono mt-1">
          {favorites?.length ?? 0} món đang theo dõi
        </p>
      </div>

      {!favorites || favorites.length === 0 ? (
        <div className="text-center py-20 border border-line rounded">
          <p className="text-bone-2 font-mono text-sm">Chưa có gì trong wishlist</p>
          <Link
            href="/"
            className="inline-block mt-4 px-4 py-2 border border-rust text-rust text-xs font-mono rounded hover:bg-rust/10 transition"
          >
            KHÁM PHÁ FLOOR →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {favorites.map((fav) => {
            const post = fav.posts as any
            if (!post) return null
            const isSold = post.status === 'sold'

            return (
              <Link
                key={fav.post_id}
                href={`/lot/${post.lot_id}`}
                className={`
                  group relative border border-line rounded overflow-hidden
                  hover:border-rust/50 transition-all duration-200
                  ${isSold ? 'opacity-60' : ''}
                `}
              >
                {/* Cover image */}
                <div className="relative aspect-square bg-ink-2">
                  {post.cover_image_url ? (
                    <Image
                      src={post.cover_image_url}
                      alt={post.model}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-bone-2 font-mono text-xs">
                      NO IMAGE
                    </div>
                  )}
                  {isSold && (
                    <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                      <span className="font-mono text-xs text-bone-2 border border-bone-2 px-2 py-1">SOLD</span>
                    </div>
                  )}
                  {post.is_mystery && (
                    <div className="absolute inset-0 bg-ink/80 flex items-center justify-center">
                      <span className="font-archivo text-lg font-black text-hazard">???</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-ink-2">
                  <p className="font-mono text-xs text-bone-2 uppercase">{post.brand}</p>
                  <p className="font-archivo font-black text-sm text-bone truncate">
                    {post.is_mystery ? 'BLIND BOX' : post.model}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-mono text-xs text-concrete">US {post.size_us}</span>
                    <span className="font-mono text-xs text-hazard">
                      {post.asking_price_vnd?.toLocaleString('vi-VN')}₫
                    </span>
                  </div>
                  <p className="font-mono text-xs text-concrete mt-1">
                    Lưu {new Date(fav.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}