import React from 'react';
import { Skeleton } from '@/components/ui-admin/skeleton';

const PageSkeleton: React.FC = () => (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="space-y-8 animate-pulse max-w-screen-2xl mx-auto">
            <div className="flex items-center justify-between">
                <Skeleton className="h-12 w-1/2 bg-slate-200 rounded-lg" />
                <Skeleton className="h-12 w-36 bg-slate-200 rounded-lg" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl bg-slate-200" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-2xl bg-slate-200" />)}
            </div>
        </div>
    </div>
);

export default PageSkeleton;