import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  type ColumnDef, type ColumnFiltersState, type SortingState, type RowSelectionState, type Row,
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table"
import { PlusCircle, Search, Trash2, XCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui-admin/table"
import { Button } from "@/components/ui-admin/button"
import { Input } from "@/components/ui-admin/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-admin/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select"
import { cn } from "@/lib/utils"

interface DataTableProps<TData extends { id: string }, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  fullData?: TData[]
  filterColumnId: string
  filterPlaceholder: string
  title: string
  rowLinkBasePath?: string
  onRowClick?: (row: TData) => void
  addEntityButtonText?: string
  onAddEntity?: () => void
  isDeleteMode?: boolean
  onToggleDeleteMode?: () => void
  onConfirmDelete?: (selectedRows: TData[]) => void
  rowSelection?: RowSelectionState
  setRowSelection?: React.Dispatch<React.SetStateAction<RowSelectionState>>
  customHeaderContent?: React.ReactNode
  noCardWrapper?: boolean;
  // Optional manual pagination (for server-side)
  manualPagination?: boolean;
  pageCount?: number;
  pagination?: { pageIndex: number; pageSize: number };
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
}

export function DataTable<TData extends { id: string }, TValue>({
  columns, data, fullData,
  filterColumnId, filterPlaceholder, title, rowLinkBasePath, onRowClick,
  addEntityButtonText, onAddEntity,
  isDeleteMode, onToggleDeleteMode, onConfirmDelete,
  rowSelection = {}, setRowSelection = () => {},
  customHeaderContent,
  noCardWrapper = false,
  manualPagination = false,
  pageCount,
  pagination,
  onPaginationChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [searchFocused, setSearchFocused] = React.useState(false)
  const navigate = useNavigate()

  const filterValue = (columnFilters.find(f => f.id === filterColumnId)?.value as string) ?? "";

  const tableData = React.useMemo(() => {
    const base = Array.isArray(fullData) && filterValue
      ? fullData
      : Array.isArray(data)
        ? data
        : [];

    if (Array.isArray(fullData) && filterValue) {
      return base.filter(row =>
        String(row[filterColumnId as keyof TData])
          .toLowerCase()
          .includes(filterValue.toLowerCase())
      );
    }
    return base;
  }, [data, fullData, filterValue, filterColumnId]);

  const safeColumns = React.useMemo(() => Array.isArray(columns) ? columns : [], [columns]);

  const table = useReactTable({
    data: tableData,
    columns: safeColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: updater => {
      if (!manualPagination) return; // internal controls if not manual
      const next = typeof updater === 'function' ? updater((pagination ?? { pageIndex: 0, pageSize: 10 })) : updater;
      onPaginationChange?.(next as { pageIndex: number; pageSize: number });
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      rowSelection,
      // Always provide a pagination object to avoid destructuring undefined
      pagination: (pagination ?? { pageIndex: 0, pageSize: 10 }),
    },
    manualFiltering: !!fullData,
    manualPagination,
    pageCount: manualPagination ? pageCount : undefined,
  });

  const selectedRowsData = table.getFilteredSelectedRowModel().rows.map(row => row.original)
  const areRowsClickable = (onRowClick || rowLinkBasePath) && !isDeleteMode

  const handleRowClick = (row: Row<TData>) => {
    if (isDeleteMode) {
      row.toggleSelected()
    } else if (onRowClick) {
      onRowClick(row.original)
    } else if (rowLinkBasePath) {
      navigate(`${rowLinkBasePath}/${row.original.id}`)
    }
  }

  const tableElement = (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} className="border-b-[#EFEDED] hover:bg-transparent">
              {headerGroup.headers.map(header => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-12 px-4 text-base font-semibold text-gray-600 bg-muted/50",
                    (header.column.columnDef.meta as { className?: string })?.className
                  )}
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? table.getRowModel().rows.map((row, index) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              onClick={() => handleRowClick(row)}
              className={cn(
                "group border-b-[#EFEDED] animate-in fade-in-0 slide-in-from-bottom-2 transition",
                areRowsClickable ? "cursor-pointer" : "select-none",
                row.getIsSelected() && isDeleteMode ? "bg-red-50" : row.getIsSelected() ? "bg-blue-50" : ""
              )}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {row.getVisibleCells().map(cell => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "align-top group-hover:bg-zinc-100 transition-colors duration-150 py-4 px-4",
                    (cell.column.columnDef.meta as { className?: string })?.className
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={safeColumns.length} className="h-24 text-center text-gray-400">
                <span className="flex flex-col items-center justify-center gap-2">
                  <Search className="mx-auto h-8 w-8 opacity-30" />
                  <span>Aucun résultat trouvé.</span>
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const innerContent = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className={cn(
          "relative w-full md:w-auto transition-all",
          searchFocused ? "ring-2 ring-primary/30 rounded-md" : "",
        )}>
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-all",
            searchFocused ? "text-primary" : "text-muted-foreground"
          )} />
          <Input
            placeholder={filterPlaceholder}
            value={filterValue}
            onChange={e => setColumnFilters(prev => {
              const newFilters = prev.filter(f => f.id !== filterColumnId);
              return [...newFilters, { id: filterColumnId, value: e.target.value }];
            })}
            className="pl-10 w-full min-w-[280px] md:min-w-[320px]"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Rechercher"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {customHeaderContent}
          {!isDeleteMode ? (
            <>
              {addEntityButtonText && (
                <Button onClick={onAddEntity} className="bg-black text-white hover:bg-zinc-800 focus:ring-2 focus:ring-black/40 focus:outline-none">
                  <PlusCircle className="mr-2 h-4 w-4" />{addEntityButtonText}
                </Button>
              )}
              {onToggleDeleteMode && (
                <Button variant="outline" onClick={onToggleDeleteMode} className="focus:ring-2 focus:ring-destructive/30 focus:outline-none">
                  <Trash2 className="mr-2 h-4 w-4" />Supprimer
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                disabled={selectedRowsData.length === 0}
                onClick={() => onConfirmDelete && onConfirmDelete(selectedRowsData)}
                className="bg-red-600 text-white hover:bg-red-700 border border-red-600 focus:ring-2 focus:ring-red-400 focus:outline-none"
              >
                <Trash2 className="mr-2 h-4 w-4" />Supprimer ({selectedRowsData.length})
              </Button>
              <Button variant="outline" onClick={onToggleDeleteMode} className="focus:ring-2 focus:ring-muted/30 focus:outline-none">
                <XCircle className="mr-2 h-4 w-4" />Annuler
              </Button>
            </>
          )}
        </div>
      </div>

      {tableElement}

      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-4">
        <div className="text-sm text-muted-foreground">
          {isDeleteMode
            ? `${table.getFilteredSelectedRowModel().rows.length} sélectionné(s) sur ${table.getFilteredRowModel().rows.length} visible(s)`
            : `${table.getFilteredRowModel().rows.length} ligne(s) affichée(s)`}
        </div>
        <div className="flex items-center justify-center sm:justify-end flex-wrap gap-4">
          <Select value={`${table.getState().pagination.pageSize}`} onValueChange={v => table.setPageSize(Number(v))}>
            <SelectTrigger className="w-[140px] md:w-[160px] min-w-[140px]">
              <SelectValue placeholder={`${table.getState().pagination.pageSize} par page`} />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 40, 50].map(ps => <SelectItem key={ps} value={`${ps}`}>{ps} par page</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 rounded-lg px-3 py-1 bg-gray-50 min-w-[180px]">
            <div className="text-sm font-medium">Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}</div>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Précédent</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Suivant</Button>
          </div>
        </div>
      </div>
    </>
  );

  const tableContent = noCardWrapper ? (
    <div className={!title ? "pt-0" : "pt-6"}>{innerContent}</div>
  ) : (
    <>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={!title ? "pt-6" : ""}>
        {innerContent}
      </CardContent>
    </>
  );

  if (noCardWrapper) {
    return tableContent;
  }

  return (
    <Card>
      {tableContent}
    </Card>
  )
}
