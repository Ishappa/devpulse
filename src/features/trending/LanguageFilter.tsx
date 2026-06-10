'use client';

import Link from 'next/link';

/** Language pills that navigate between ISR'd /trending/[lang] routes. */
export function LanguageFilter({
  languages,
  active,
}: {
  languages: string[];
  active: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Pill href="/trending" label="All" active={active === null} />
      {languages.map((l) => (
        <Pill key={l} href={`/trending/${l}`} label={l} active={active === l} />
      ))}
    </div>
  );
}

function Pill({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-mono transition ${
        active
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border text-muted hover:text-text'
      }`}
    >
      {label}
    </Link>
  );
}
