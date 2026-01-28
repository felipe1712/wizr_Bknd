import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useState, useEffect } from "react";

export type DateRangePreset = "1d" | "3d" | "7d" | "14d" | "28d" | "custom";

interface RankingDateFilterProps {
  preset: DateRangePreset;
  customRange?: DateRange;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomRangeChange: (range: DateRange | undefined) => void;
  onApply?: () => void;
}

const presetLabels: Record<DateRangePreset, string> = {
  "1d": "Ayer",
  "3d": "Últimos 3 días",
  "7d": "Última semana",
  "14d": "Últimas 2 semanas",
  "28d": "Último mes",
  "custom": "Personalizado",
};

export function getDateRangeFromPreset(preset: DateRangePreset, customRange?: DateRange): { from: Date; to: Date } {
  const now = new Date();
  const to = endOfDay(now);
  
  switch (preset) {
    case "1d":
      return { from: startOfDay(subDays(now, 1)), to };
    case "3d":
      return { from: startOfDay(subDays(now, 3)), to };
    case "7d":
      return { from: startOfDay(subDays(now, 7)), to };
    case "14d":
      return { from: startOfDay(subDays(now, 14)), to };
    case "28d":
      return { from: startOfDay(subDays(now, 28)), to };
    case "custom":
      if (customRange?.from && customRange?.to) {
        return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
      }
      return { from: startOfDay(subDays(now, 28)), to };
    default:
      return { from: startOfDay(subDays(now, 28)), to };
  }
}

export function RankingDateFilter({ 
  preset, 
  customRange, 
  onPresetChange, 
  onCustomRangeChange,
  onApply 
}: RankingDateFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialPreset] = useState(preset);
  const [initialCustomRange] = useState(customRange);

  // Track if there are unsaved changes
  useEffect(() => {
    const presetChanged = preset !== initialPreset;
    const customRangeChanged = preset === "custom" && (
      customRange?.from?.getTime() !== initialCustomRange?.from?.getTime() ||
      customRange?.to?.getTime() !== initialCustomRange?.to?.getTime()
    );
    setHasChanges(presetChanged || customRangeChanged);
  }, [preset, customRange, initialPreset, initialCustomRange]);

  const handlePresetChange = (value: string) => {
    onPresetChange(value as DateRangePreset);
    if (value !== "custom") {
      onCustomRangeChange(undefined);
    }
    setHasChanges(true);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    onCustomRangeChange(range);
    if (range?.from && range?.to) {
      setCalendarOpen(false);
    }
    setHasChanges(true);
  };

  const handleApply = () => {
    setHasChanges(false);
    onApply?.();
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
      <span className="text-sm font-medium text-muted-foreground">Período:</span>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Selecciona período" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(presetLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[240px]",
                !customRange?.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {customRange?.from ? (
                customRange.to ? (
                  <>
                    {format(customRange.from, "dd MMM", { locale: es })} -{" "}
                    {format(customRange.to, "dd MMM yyyy", { locale: es })}
                  </>
                ) : (
                  format(customRange.from, "dd MMM yyyy", { locale: es })
                )
              ) : (
                "Selecciona fechas"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              locale={es}
              disabled={(date) => date > new Date()}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      <Button 
        onClick={handleApply}
        size="sm"
        className="ml-auto"
      >
        <Check className="h-4 w-4 mr-1" />
        Aplicar
      </Button>
    </div>
  );
}
