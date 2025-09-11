import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui-admin/table';

interface ChartDataItem {
  [key: string]: string | number;
}

interface Column {
  key: string;
  header: string;
  className?: string;
}

interface GenericTableProps {
  title: string;
  description: string;
  columns: Column[];
  data: ChartDataItem[];
}

export const GenericTable = ({ title, description, columns, data }: GenericTableProps) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className={col.className}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map(col => (
                  <TableCell key={col.key} className={`${col.className ?? ''} font-medium`}>{row[col.key]}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};