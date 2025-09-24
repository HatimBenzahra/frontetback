// src/pages/admin/statitistiques/LeaderboardTable.tsx

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui-admin/table';
import { Badge } from '@/components/ui-admin/badge';
import { Avatar, AvatarFallback } from '@/components/ui-admin/avatar';
import { cn } from '@/lib/utils';

interface Performer {
  rank: number;
  name: string;
  avatar: string;
  value: number;
  change: number;
}

interface LeaderboardTableProps {
  title: string;
  description: string;
  data: Performer[];
  unit: string;
}

const rankColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-400/20 text-yellow-700 border-yellow-400/50";
    if (rank === 2) return "bg-slate-400/20 text-slate-700 border-slate-400/50";
    if (rank === 3) return "bg-orange-400/20 text-orange-700 border-orange-400/50";
    return "bg-gray-100 text-gray-600 border-transparent";
}

export const LeaderboardTable = ({ title, description, data, unit }: LeaderboardTableProps) => {
  return (
    <Card className="h-full shadow-lg border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl">
      <CardHeader className="bg-gray-50 border-b border-gray-200 py-4 px-6">
        <CardTitle className="text-lg font-semibold text-gray-800">{title}</CardTitle>
        <CardDescription className="text-sm text-gray-600">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[50px] text-gray-600">Rank</TableHead>
              <TableHead className="text-gray-600">Nom</TableHead>
              <TableHead className="text-right text-gray-600">{unit}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.rank} className="hover:bg-gray-50 transition-colors duration-200">
                <TableCell>
                    <Badge variant="outline" className={cn("font-bold text-sm", rankColor(item.rank))}>
                        {item.rank}
                    </Badge>
                </TableCell>
                <TableCell className="font-medium flex items-center gap-3 text-gray-800">
                    <Avatar className="h-8 w-8 border border-gray-200">
                        <AvatarFallback className="bg-gray-200 text-gray-700 text-sm font-semibold">{item.avatar}</AvatarFallback>
                    </Avatar>
                    {item.name}
                </TableCell>
                <TableCell className="text-right font-bold text-lg text-gray-900">{item.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};