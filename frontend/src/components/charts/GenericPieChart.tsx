import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ChartDataItem {
  [key: string]: string | number;
}

interface GenericPieChartProps {
  title: string;
  data: ChartDataItem[];
  dataKey: string;
  nameKey: string;
  colors: string[];
}

export const GenericPieChart = ({ title, data, dataKey, nameKey, colors }: GenericPieChartProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={290}>
          <PieChart>
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))' }}
              contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              fill="#8884d8"
              paddingAngle={3}
              dataKey={dataKey}
              nameKey={nameKey}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Legend iconSize={10} wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};