import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui-admin/card';
import type { LucideIcon } from 'lucide-react';
import CountUp from 'react-countup';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  Icon: LucideIcon;
  prefix?: string;
  suffix?: string;
  color?: string;
}

const StatCard = ({ title, value, Icon, prefix, suffix, color }: StatCardProps) => {
  return (
    <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm transition-transform duration-300 hover:-translate-y-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <Icon className={cn("h-5 w-5", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">
          {typeof value === 'number' && !isNaN(value) ? (
            <CountUp
              start={0}
              end={value}
              duration={1.5}
              separator=" "
              prefix={prefix}
              suffix={suffix}
              decimals={value % 1 !== 0 ? 1 : 0}
            />
          ) : (
            <span className="text-slate-400">N/A</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;