// src/pages/admin/statistiques/StatistiquesSkeleton.tsx
import { Skeleton } from "@/components/ui-admin/skeleton";

export const StatistiquesSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-wrap gap-4 justify-between items-center border-b pb-4">
        <Skeleton className="h-9 w-1/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
        <Skeleton className="h-10 w-[250px]" />
      </div>

      {/* KPIs Skeleton */}
      <section>
        <Skeleton className="h-6 w-1/4 mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-80 w-full" />
          </section>
          <section>
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-80 w-full" />
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          <section>
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-96 w-full" />
          </section>
          <section>
            <Skeleton className="h-6 w-1/4 mb-4" />
            <Skeleton className="h-96 w-full" />
          </section>
        </div>
      </div>
    </div>
  );
};