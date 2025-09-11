import React from 'react';
import { Card, CardContent } from '@/components/ui-admin/card';
import { Input } from '@/components/ui-admin/input';
import { Button } from '@/components/ui-admin/button';
import { Search, PlusCircle, ArrowUpDown, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FilterBarProps } from '../../types/types';
import { buildingStatusMap } from '../../constants/building-status';

const FilterButton = ({ filterKey, label, icon, activeFilter, onFilterChange }: { 
    filterKey: string, 
    label: string, 
    icon?: React.ReactNode,
    activeFilter: string,
    onFilterChange: (filter: string) => void 
}) => (
    <button
        key={filterKey}
        onClick={() => onFilterChange(filterKey)}
        className={cn(
            "px-3 py-1.5 text-sm rounded-md font-semibold transition-colors duration-200 flex items-center gap-2 whitespace-nowrap",
            activeFilter === filterKey
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
        )}
    >
        {icon}
        {label}
    </button>
);

const FilterBar: React.FC<FilterBarProps> = ({
    searchTerm,
    onSearchChange,
    activeFilter,
    onFilterChange,
    onAddImmeuble
}) => {
    return (
        <Card className="rounded-2xl bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        <Input
                            placeholder="Rechercher par adresse, ville, code postal..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full rounded-lg bg-slate-100 border-transparent focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:p-0 md:m-0">
                        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                            <FilterButton 
                                filterKey="all" 
                                label="Tous"
                                activeFilter={activeFilter}
                                onFilterChange={onFilterChange}
                            />
                            <FilterButton 
                                filterKey="hasElevator" 
                                label="Ascenseur" 
                                icon={<ArrowUpDown className="h-4 w-4" />}
                                activeFilter={activeFilter}
                                onFilterChange={onFilterChange}
                            />
                            {Object.entries(buildingStatusMap).map(([key, { label, icon: Icon }]) => (
                                <FilterButton 
                                    key={key} 
                                    filterKey={key} 
                                    label={label} 
                                    icon={<Icon className={cn("h-4 w-4", key === 'EN_COURS' && 'animate-spin')} />}
                                    activeFilter={activeFilter}
                                    onFilterChange={onFilterChange}
                                />
                            ))}
                            <FilterButton 
                                filterKey="SOLO" 
                                label="Solo" 
                                icon={<User className="h-4 w-4" />}
                                activeFilter={activeFilter}
                                onFilterChange={onFilterChange}
                            />
                            <FilterButton 
                                filterKey="DUO" 
                                label="Duo" 
                                icon={<Users className="h-4 w-4" />}
                                activeFilter={activeFilter}
                                onFilterChange={onFilterChange}
                            />
                        </div>
                    </div>
                    <Button 
                        onClick={onAddImmeuble} 
                        className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-200 rounded-lg px-5 py-2.5 w-full md:w-auto md:ml-auto"
                    >
                        <PlusCircle className="mr-2 h-5 w-5" /> 
                        Ajouter un immeuble
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default FilterBar;