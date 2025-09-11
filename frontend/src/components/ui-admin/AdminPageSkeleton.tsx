import { Card, CardContent, CardHeader } from "@/components/ui-admin/card";

interface AdminPageSkeletonProps {
  hasHeader?: boolean;
  hasFilters?: boolean;
  hasTable?: boolean;
  hasCards?: boolean;
  hasCharts?: boolean;
  cardsCount?: number;
  chartsCount?: number;
  tableRows?: number;
  className?: string;
}

export const AdminPageSkeleton = ({
  hasHeader = true,
  hasFilters = false,
  hasTable = false,
  hasCards = false,
  hasCharts = false,
  cardsCount = 4,
  chartsCount = 2,
  tableRows = 5,
  className = ""
}: AdminPageSkeletonProps) => {
  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header Section */}
      {hasHeader && (
        <div className="flex justify-between items-center border-b pb-4">
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded-md" />
          <div className="flex gap-2">
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md" />
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md" />
          </div>
        </div>
      )}

      {/* Filters Section */}
      {hasFilters && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="h-10 w-48 bg-gray-200 animate-pulse rounded-md" />
          <div className="h-10 w-48 bg-gray-200 animate-pulse rounded-md" />
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md" />
        </div>
      )}

      {/* Cards Section */}
      {hasCards && (
        <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-${Math.min(cardsCount, 4)}`}>
          {Array.from({ length: cardsCount }).map((_, index) => (
            <Card key={index} className="animate-in fade-in-0 duration-500">
              <CardHeader>
                <div className="h-5 w-3/4 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded-md" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-full bg-gray-200 animate-pulse rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Section */}
      {hasCharts && (
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: chartsCount }).map((_, index) => (
            <Card key={index} className="animate-in fade-in-0 duration-500">
              <CardHeader>
                <div className="h-6 w-1/3 bg-gray-200 animate-pulse rounded-md" />
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full bg-gray-200 animate-pulse rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table Section */}
      {hasTable && (
        <Card className="animate-in fade-in-0 duration-500">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="h-6 w-1/4 bg-gray-200 animate-pulse rounded-md" />
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md" />
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Table Header */}
            <div className="flex space-x-4 border-b pb-2">
              <div className="h-4 w-8 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded-md" />
            </div>
            {/* Table Rows */}
            {Array.from({ length: tableRows }).map((_, index) => (
              <div key={index} className="flex space-x-4 py-2">
                <div className="h-4 w-8 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-4 flex-1 bg-gray-200 animate-pulse rounded-md" />
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};