import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui-admin/card";

interface ChartDataItem {
  [key: string]: string | number;
}

interface StackedBarChartProps {
  title: string;
  description: string;
  data: ChartDataItem[];
  xAxisKey: string;
  bars: { key: string; name: string; color: string }[];
}

export const GenericStackedBarChart = ({ title, description, data, xAxisKey, bars }: StackedBarChartProps) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis type="category" dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }}/>
            {bars.map(bar => (
              <Bar key={bar.key} dataKey={bar.key} name={bar.name} stackId="a" fill={bar.color} radius={[4, 4, 4, 4]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};