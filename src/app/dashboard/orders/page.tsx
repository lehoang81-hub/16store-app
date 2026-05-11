import { Nav } from '@/components/Nav'
import { BuyerOrdersList } from '@/components/BuyerOrdersList'

export default function BuyerOrdersPage() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-concrete mb-1">
            Dashboard
          </div>
          <h1 className="font-display text-3xl uppercase">Đơn hàng của tôi</h1>
        </div>
        <BuyerOrdersList />
      </main>
    </>
  )
}
