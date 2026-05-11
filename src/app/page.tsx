import { Ticker } from '@/components/Ticker';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { DropsGrid } from '@/components/DropsGrid';
import { ConsignmentFloor } from '@/components/ConsignmentFloor';
import { HubMap } from '@/components/HubMap';
import { Process, Footer } from '@/components/ProcessAndFooter';

// Force fresh data on each request (Phase 1) — sau này có thể dùng revalidate
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  return (
    <>
      <Ticker />
      <Nav />
      <Hero />
      <DropsGrid />
      <ConsignmentFloor />
      <HubMap />
      <Process />
      <Footer />
    </>
  );
}
