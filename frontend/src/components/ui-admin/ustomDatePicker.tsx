// frontend-shadcn/src/pages/admin/commerciaux/CustomDatePicker.tsx 
// (Ou à l'intérieur de CommercialDetailsPage.tsx)
import React from 'react';
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui-admin/button';
import { Calendar } from "@/components/ui-admin/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-admin/popover";

interface CustomDatePickerProps {
  onCancel: () => void;
  onValidate: (range: { from: Date; to: Date }) => void;
}

export const CustomDatePicker = ({ onCancel, onValidate }: CustomDatePickerProps) => {
    const [startDate, setStartDate] = React.useState<Date | undefined>();
    const [endDate, setEndDate] = React.useState<Date | undefined>();

    // Ferme le popover après sélection
    const handleStartDateSelect = (date?: Date) => {
        setStartDate(date);
    };

    const handleEndDateSelect = (date?: Date) => {
        setEndDate(date);
    };

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2 bg-background shadow-sm">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] font-normal justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'd LLL y', { locale: fr }) : <span>Date de début</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={handleStartDateSelect}
                        initialFocus
                        locale={fr}
                    />
                </PopoverContent>
            </Popover>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] font-normal justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, 'd LLL y', { locale: fr }) : <span>Date de fin</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={handleEndDateSelect}
                        initialFocus
                        locale={fr}
                    />
                </PopoverContent>
            </Popover>
            <Button 
                className="bg-green-600 hover:bg-green-700" 
                onClick={() => onValidate({ from: startDate!, to: endDate! })} 
                disabled={!startDate || !endDate}
            >
                Valider
            </Button>
            <Button variant="ghost" onClick={onCancel}>
                Annuler
            </Button>
        </div>
    );
};