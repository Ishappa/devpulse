import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-5xl font-bold text-accent">404</p>
      <p className="mt-3 text-lg">This page doesn&apos;t exist.</p>
      <Link href="/trending" className="mt-5 text-sm text-accent hover:underline">
        Go to trending →
      </Link>
    </main>
  );
}
