import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';

interface ChartDataItem {
  [key: string]: string | number;
}

interface GenericHorizontalBarChartProps {
  title: string;
  data: ChartDataItem[];
  yAxisDataKey: string;
  barDataKey: string;
  fillColor: string;
  barName?: string;
}

export const GenericHorizontalBarChart = ({ 
  title, 
  data, 
  yAxisDataKey, 
  barDataKey, 
  fillColor,
  barName 
}: GenericHorizontalBarChartProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart 
            layout="vertical" 
            data={data} 
            margin={{
              top: 5,
              right: 30, 
              left: 20,
              bottom: 20, 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
            
            <YAxis 
              type="category" 
              dataKey={yAxisDataKey} 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              width={80} 
              tick={{ fill: 'hsl(var(--foreground))' }}
            />
            
            <Tooltip 
              cursor={{ fill: 'hsl(var(--muted))' }} 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                borderColor: 'hsl(var(--border))',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              }} 
            />
            
            <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} />
            
            <Bar 
              dataKey={barDataKey} 
              name={barName || "Valeur"} 
              fill={fillColor} 
              radius={[0, 4, 4, 0]} 
            >
              <LabelList 
                dataKey={barDataKey} 
                position="right" 
                style={{ fill: 'hsl(var(--foreground))', fontSize: '12px' }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};