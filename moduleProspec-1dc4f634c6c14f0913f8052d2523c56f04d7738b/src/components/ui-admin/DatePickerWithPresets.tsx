// src/components/ui/DatePickerWithPresets.tsx
import { useEffect, useState } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  subDays,
  isToday,
  isSameDay,
  isWithinInterval
} from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Sparkles,
  Zap,
  Target,
  TrendingUp,
  CalendarDays,
  X,
  Check
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-admin/button";
import { Calendar } from "@/components/ui-admin/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-admin/popover";
import { Badge } from "@/components/ui-admin/badge";

interface DatePickerWithPresetsProps {
  className?: string;
  selectedDate: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  onPresetSelect: (preset: string) => void;
}

export function DatePickerWithPresets({
  className,
  selectedDate,
  onDateChange,
  onPresetSelect,
}: DatePickerWithPresetsProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetClick = (preset: string) => {
    setActivePreset(preset);
    onPresetSelect(preset);
    
    const today = new Date();
    let range: DateRange | undefined;

    switch (preset) {
      case "today":
        range = { from: today, to: today };
        break;
      case "week":
        range = { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
        break;
      case "month":
        range = { from: startOfMonth(today), to: endOfMonth(today) };
        break;
      case "quarter":
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 3, 0);
        range = { from: quarterStart, to: quarterEnd };
        break;
      case "year":
        range = { from: startOfYear(today), to: endOfYear(today) };
        break;
      case "last7days":
        range = { from: subDays(today, 6), to: today };
        break;
      case "last30days":
        range = { from: subDays(today, 29), to: today };
        break;
    }

    if (range) {
      onDateChange(range);
    }
  };

  const clearSelection = () => {
    onDateChange(undefined);
    setActivePreset(null);
  };

  const getDisplayText = () => {
    if (!selectedDate?.from) return "Choisir une période";
    
    if (selectedDate.to && !isSameDay(selectedDate.from, selectedDate.to)) {
      return `${format(selectedDate.from, "d MMM", { locale: fr })} – ${format(selectedDate.to, "d MMM yyyy", { locale: fr })}`;
    }
    
    return format(selectedDate.from, "d MMMM yyyy", { locale: fr });
  };

  const getDaysCount = () => {
    if (!selectedDate?.from || !selectedDate?.to) return 0;
    const diffTime = Math.abs(selectedDate.to.getTime() - selectedDate.from.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const presets = [
    { key: "today", label: "Aujourd'hui", icon: Sparkles, color: "bg-gradient-to-r from-blue-500 to-purple-500" },
    { key: "week", label: "Cette semaine", icon: CalendarDays, color: "bg-gradient-to-r from-green-500 to-emerald-500" },
    { key: "month", label: "Ce mois", icon: Target, color: "bg-gradient-to-r from-orange-500 to-red-500" },
    { key: "quarter", label: "Ce trimestre", icon: TrendingUp, color: "bg-gradient-to-r from-purple-500 to-pink-500" },
    { key: "year", label: "Cette année", icon: Zap, color: "bg-gradient-to-r from-indigo-500 to-blue-500" },
    { key: "last7days", label: "7 derniers jours", icon: Clock, color: "bg-gradient-to-r from-teal-500 to-cyan-500" },
    { key: "last30days", label: "30 derniers jours", icon: CalendarDays, color: "bg-gradient-to-r from-amber-500 to-yellow-500" }
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant="outline"
          className={cn(
            "w-full h-12 justify-between text-left font-medium relative overflow-hidden group",
            "bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 border-2 border-gray-200 hover:border-blue-300 transition-all duration-300",
            "shadow-sm hover:shadow-lg hover:-translate-y-0.5",
            !selectedDate && "text-gray-400",
            selectedDate && "border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-gray-600">Période</span>
              <span className="text-base font-semibold text-gray-900">{getDisplayText()}</span>
            </div>
          </div>
          
          {selectedDate && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                {getDaysCount()} jour{getDaysCount() > 1 ? 's' : ''}
              </Badge>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          )}
          
          {/* Animated background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className={cn(
          "w-[300px] p-0 bg-white border-0 shadow-2xl rounded-xl overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold">Sélection de période</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          {selectedDate && (
            <div className="flex items-center justify-between p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <div>
                <p className="text-xs opacity-90">Période sélectionnée</p>
                <p className="font-medium text-xs">{getDisplayText()}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-white hover:bg-white/20 h-5 px-1.5 text-xs"
              >
                Effacer
              </Button>
            </div>
          )}
        </div>

        {/* Presets Grid */}
        <div className="p-2">
          <h4 className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-500" />
            Périodes rapides
          </h4>
          
          <div className="grid grid-cols-2 gap-1 mb-2">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePresetClick(preset.key)}
                className={cn(
                  "relative p-1.5 rounded-lg border-2 transition-all duration-300 hover:scale-105 group overflow-hidden",
                  activePreset === preset.key
                    ? "border-blue-500 bg-blue-50 shadow-lg"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
                )}
              >
                {/* Background gradient */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300",
                  preset.color
                )} />
                
                <div className="relative flex items-center gap-1">
                  <div className={cn(
                    "p-0.5 rounded-lg text-white",
                    preset.color
                  )}>
                    <preset.icon className="h-2.5 w-2.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 text-xs leading-tight">{preset.label}</p>
                  </div>
                  {activePreset === preset.key && (
                    <Check className="h-2.5 w-2.5 text-blue-600" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3 text-purple-500" />
              Calendrier personnalisé
            </h4>
            
            <div className="rounded-lg border-2 border-gray-100 bg-gradient-to-br from-gray-50 to-blue-50 p-1.5">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={selectedDate?.from}
                selected={selectedDate}
                onSelect={onDateChange}
                numberOfMonths={1}
                locale={fr}
                className="[&_.rdp-button]:hover:bg-blue-500 [&_.rdp-button]:hover:text-white [&_.rdp-button]:transition-all [&_.rdp-button]:duration-200 [&_.rdp-button]:text-xs [&_.rdp-button]:h-6 [&_.rdp-button]:w-6 [&_.rdp-caption]:text-xs [&_.rdp-nav]:text-xs [&_.rdp-weekday]:text-xs [&_.rdp-table]:text-xs"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2 pt-1.5 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Cliquez sur une période ou utilisez le calendrier</span>
              {selectedDate && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1 py-0.5">
                  {getDaysCount()} jour{getDaysCount() > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
