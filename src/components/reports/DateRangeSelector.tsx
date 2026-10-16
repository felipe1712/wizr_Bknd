import { useState } from "react";
import { format, startOfDay, endOfDay, setHours, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { DateRange } from "react-day-picker";

export type TimeRangePreset = "7d" | "30d" | "90d" | "day" | "range";

export interface DateRangeConfig {
  type: TimeRangePreset;
  customDate?: Date;
  rangeStart?: Date;
  rangeEnd?: Date;
  cutoffHour: number;
}

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeSelectorProps {
  value: DateRangeConfig;
  onChange: (config: DateRangeConfig) => void;
}

const CUTOFF_HOURS = [
  { value: 0, label: "12:00 AM" },
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 12, label: "12:00 PM" },
];

const PRESETS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "day", label: "Un día" },
  { value: "range", label: "Rango personalizado" },
];

export function calculateDateRange(config: DateRangeConfig): DateRangeResult {
  const now = new Date();
  const cutoffHour = config.cutoffHour;

  if (config.type === "day" && config.customDate) {
    const selectedDate = config.customDate;
    const endDate = setHours(startOfDay(selectedDate), cutoffHour);
    const startDate = setHours(startOfDay(subDays(selectedDate, 1)), cutoffHour);
    return {
      startDate,
      endDate,
      label: `Día ${format(selectedDate, "d MMM yyyy", { locale: es })} (corte ${cutoffHour}:00)`,
    };
  }

  if (config.type === "range" && config.rangeStart && config.rangeEnd) {
    const startDate = startOfDay(config.rangeStart);
    const rangeEndDate = endOfDay(config.rangeEnd);
    return {
      startDate,
      endDate: rangeEndDate,
      label: `${format(config.rangeStart, "d MMM", { locale: es })} - ${format(config.rangeEnd, "d MMM yyyy", { locale: es })}`,
    };
  }

  const days = config.type === "7d" ? 7 : config.type === "30d" ? 30 : 90;
  const endDate = now;
  const startDate = startOfDay(subDays(now, days));

  const labelMap: Record<string, string> = {
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
    "90d": "Últimos 90 días",
  };

  return {
    startDate,
    endDate,
    label: labelMap[config.type] || "Personalizado",
  };
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [startCalOpen, setStartCalOpen] = useState(false);
  const [endCalOpen, setEndCalOpen] = useState(false);
  const [dayCalendarOpen, setDayCalendarOpen] = useState(false);

  const handlePresetChange = (preset: string) => {
    if (preset === "day") {
      onChange({ ...value, type: "day", customDate: value.customDate || new Date() });
    } else if (preset === "range") {
      onChange({
        ...value,
        type: "range",
        rangeStart: value.rangeStart || subDays(new Date(), 7),
        rangeEnd: value.rangeEnd || new Date(),
      });
    } else {
      onChange({ ...value, type: preset as TimeRangePreset });
    }
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...value, type: "day", customDate: date });
      setDayCalendarOpen(false);
    }
  };

  const handleStartSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...value, type: "range", rangeStart: date });
      setStartCalOpen(false);
    }
  };

  const handleEndSelect = (date: Date | undefined) => {
    if (date) {
      onChange({ ...value, type: "range", rangeEnd: date });
      setEndCalOpen(false);
    }
  };

  const handleCutoffChange = (hour: string) => {
    onChange({ ...value, cutoffHour: parseInt(hour, 10) });
  };

  const rangeResult = calculateDateRange(value);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
      {/* Preset selector */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Select value={value.type} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Single Day Selector */}
      {value.type === "day" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Popover open={dayCalendarOpen} onOpenChange={setDayCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[150px] justify-start font-normal h-9">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {value.customDate
                    ? format(value.customDate, "d MMM yyyy", { locale: es })
                    : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.customDate}
                  onSelect={handleDaySelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Corte</Label>
            <Select value={value.cutoffHour.toString()} onValueChange={handleCutoffChange}>
              <SelectTrigger className="w-[110px] h-9">
                <Clock className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUTOFF_HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value.toString()}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Range: two independent date pickers */}
      {value.type === "range" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[150px] justify-start font-normal h-9">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {value.rangeStart
                    ? format(value.rangeStart, "d MMM yyyy", { locale: es })
                    : "Inicio"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.rangeStart}
                  onSelect={handleStartSelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[150px] justify-start font-normal h-9">
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {value.rangeEnd
                    ? format(value.rangeEnd, "d MMM yyyy", { locale: es })
                    : "Fin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={value.rangeEnd}
                  onSelect={handleEndSelect}
                  disabled={(date) => date > new Date() || (value.rangeStart ? date < value.rangeStart : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {/* Computed range display */}
      <div className="text-xs text-muted-foreground flex items-center gap-1 h-9 sm:ml-1">
        <span>{rangeResult.label}</span>
      </div>
    </div>
  );
}