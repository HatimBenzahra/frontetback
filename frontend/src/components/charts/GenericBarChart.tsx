import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';

interface ChartDataItem {
  [key: string]: string | number;
}

interface BarConfig {
  dataKey: string;
  fill: string;
  name?: string;
}

interface GenericBarChartProps {
  title: string;
  data: ChartDataItem[];
  xAxisDataKey: string;
  bars: BarConfig[];
}



export const GenericBarChart = ({ title, data, xAxisDataKey, bars = [] }: GenericBarChartProps) => {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            
            <XAxis 
              dataKey={xAxisDataKey} 
              stroke="hsl(var(--foreground))"
              fontSize={13} 
              tickLine={false} 
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60} 
            />

            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip 
              cursor={{ fill: 'hsl(var(--muted))' }} 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }} 
            />
            <Legend />
            {bars?.map((bar) => (
              <Bar 
                key={bar.dataKey}
                dataKey={bar.dataKey} 
                fill={bar.fill}
                name={bar.name || bar.dataKey}
                radius={[4, 4, 0, 0]}
              >
                <LabelList dataKey={bar.dataKey} position="top" style={{ fill: 'hsl(var(--foreground))', fontSize: '11px' }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};