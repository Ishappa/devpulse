import { Skeleton } from '@/components/ui/primitives';

/** Skeletons match the EntityCard row height to avoid layout shift on load. */
export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    </div>
  );
}
