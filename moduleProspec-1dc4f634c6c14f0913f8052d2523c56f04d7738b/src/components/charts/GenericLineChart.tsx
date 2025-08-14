import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';

// --- Types ---
interface ChartDataItem {
  [key: string]: string | number;
}

interface LineConfig {
  dataKey: string;
  stroke: string;
  name?: string;
}

interface GenericLineChartProps {
  data: ChartDataItem[];
  xAxisDataKey: string;
  lines: LineConfig[];
}

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-lg">
        <p className="font-bold text-slate-800 mb-2">{`Date: ${label}`}</p>
        {payload.map((pld: any) => (
          <div key={pld.dataKey} className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: pld.stroke }} />
            <p className="text-sm text-slate-600">{`${pld.name}: `}</p>
            <p className="text-sm font-semibold text-slate-800 ml-1">{pld.value}</p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// --- No Data Component ---
const NoDataDisplay = () => (
    <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Info className="h-10 w-10 text-slate-400 mb-3" />
        <p className="font-semibold">Données insuffisantes</p>
        <p className="text-sm">Le graphique s'affichera dès que des données seront disponibles.</p>
    </div>
);

export const GenericLineChart = ({ data, xAxisDataKey, lines }: GenericLineChartProps) => {
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  console.log('📊 GenericLineChart - Data received:', data);
  console.log('📊 GenericLineChart - Data length:', data?.length);

  if (!data || data.length === 0) {
      return <NoDataDisplay />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <defs>
          {lines.map(line => (
            <linearGradient key={`gradient-${line.dataKey}`} id={`gradient-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={line.stroke} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={line.stroke} stopOpacity={0}/>
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey={xAxisDataKey} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }} />
        <Legend 
          wrapperStyle={{ fontSize: '0.875rem' }} 
          onMouseEnter={(e) => setHoveredLine(e.dataKey as string)}
          onMouseLeave={() => setHoveredLine(null)}
        />
        {lines.map(line => (
            <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                stroke={line.stroke}
                strokeWidth={hoveredLine && hoveredLine !== line.dataKey ? 1.5 : 2.5}
                strokeOpacity={hoveredLine && hoveredLine !== line.dataKey ? 0.5 : 1}
                fill={`url(#gradient-${line.dataKey})`}
                dot={{ r: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                name={line.name || line.dataKey}
            />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};