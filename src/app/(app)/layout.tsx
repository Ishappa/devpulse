/**
 * Product shell layout. Wraps the app route group in the client Providers (Redux +
 * session) and the nav. The marketing group does NOT use this layout, so its pages
 * ship none of this client JS — keeping the landing page's Lighthouse score high.
 */
import { Providers } from '@/store/Providers';
import { TopNav } from '@/components/TopNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <TopNav />
      <main className="mx-auto max-w-5xl px-4 py-4 sm:py-8">{children}</main>
    </Providers>
  );
}
