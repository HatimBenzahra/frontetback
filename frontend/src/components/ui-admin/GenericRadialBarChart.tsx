// src/components/charts/GenericRadialBarChart.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { ResponsiveContainer, PolarAngleAxis, RadialBarChart, RadialBar } from 'recharts';

interface GenericRadialChartProps {
  title: string;
  value: number;
  total: number;
  color: string;
}

export const GenericRadialBarChart = ({ title, value, total, color }: GenericRadialChartProps) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const data = [{ name: 'objectif', value: percentage }];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex justify-center items-center relative">
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            innerRadius="80%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
            cx="50%"
            cy="50%"
            barSize={15}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={10}
              angleAxisId={0}
              className={color} // Utilise la classe de couleur passée
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-bold">{Math.round(percentage)}%</span>
          <span className="text-sm text-muted-foreground">{value} / {total}</span>
        </div>
      </CardContent>
    </Card>
  );
};