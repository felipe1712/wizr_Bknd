import { useState } from "react";
import { format, startOfDay, setHours, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Clock, CalendarRange } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DateRange } from "react-day-picker";

export type TimeRangePreset = "7d" | "30d" | "90d" | "day" | "range";

export interface DateRangeConfig {
  type: TimeRangePreset;
  // For single day reports
  customDate?: Date;
  // For custom range
  rangeStart?: Date;
  rangeEnd?: Date;
  cutoffHour: number; // 0-23, default 8 (8 AM)
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
  { value: 0, label: "12:00 AM (medianoche)" },
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 12, label: "12:00 PM (mediodía)" },
];

export function calculateDateRange(config: DateRangeConfig): DateRangeResult {
  const now = new Date();
  const cutoffHour = config.cutoffHour;

  // Single day report
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

  // Custom range
  if (config.type === "range" && config.rangeStart && config.rangeEnd) {
    const startDate = setHours(startOfDay(config.rangeStart), cutoffHour);
    const endDate = setHours(startOfDay(config.rangeEnd), cutoffHour);

    return {
      startDate,
      endDate,
      label: `${format(config.rangeStart, "d MMM", { locale: es })} - ${format(config.rangeEnd, "d MMM yyyy", { locale: es })}`,
    };
  }

  // Preset ranges
  const days = config.type === "7d" ? 7 : config.type === "30d" ? 30 : 90;
  const endDate = now;
  const startDate = subDays(now, days);

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
  const [dayCalendarOpen, setDayCalendarOpen] = useState(false);
  const [rangeCalendarOpen, setRangeCalendarOpen] = useState(false);

  const handlePresetChange = (preset: TimeRangePreset) => {
    if (preset === "day") {
      onChange({
        ...value,
        type: "day",
        customDate: value.customDate || new Date(),
      });
    } else if (preset === "range") {
      onChange({
        ...value,
        type: "range",
        rangeStart: value.rangeStart || subDays(new Date(), 7),
        rangeEnd: value.rangeEnd || new Date(),
      });
    } else {
      onChange({
        ...value,
        type: preset,
      });
    }
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      onChange({
        ...value,
        type: "day",
        customDate: date,
      });
      setDayCalendarOpen(false);
    }
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range) {
      onChange({
        ...value,
        type: "range",
        rangeStart: range.from,
        rangeEnd: range.to || range.from,
      });
      // Close when both dates selected
      if (range.from && range.to) {
        setRangeCalendarOpen(false);
      }
    }
  };

  const handleCutoffChange = (hour: string) => {
    onChange({
      ...value,
      cutoffHour: parseInt(hour, 10),
    });
  };

  const rangeResult = calculateDateRange(value);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      <Tabs
        value={value.type}
        onValueChange={(v) => handlePresetChange(v as TimeRangePreset)}
        className="w-full sm:w-auto"
      >
        <TabsList className="grid w-full grid-cols-5 sm:w-auto">
          <TabsTrigger value="7d">7d</TabsTrigger>
          <TabsTrigger value="30d">30d</TabsTrigger>
          <TabsTrigger value="90d">90d</TabsTrigger>
          <TabsTrigger value="day">Día</TabsTrigger>
          <TabsTrigger value="range">Rango</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Single Day Selector */}
      {value.type === "day" && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Popover open={dayCalendarOpen} onOpenChange={setDayCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !value.customDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value.customDate
                    ? format(value.customDate, "d MMM yyyy", { locale: es })
                    : "Seleccionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="start">
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
            <Select
              value={value.cutoffHour.toString()}
              onValueChange={handleCutoffChange}
            >
              <SelectTrigger className="w-[120px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                {CUTOFF_HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value.toString()}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Range Selector */}
      {value.type === "range" && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rango de fechas</Label>
            <Popover open={rangeCalendarOpen} onOpenChange={setRangeCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[260px] justify-start text-left font-normal",
                    !value.rangeStart && "text-muted-foreground"
                  )}
                >
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {value.rangeStart && value.rangeEnd ? (
                    <>
                      {format(value.rangeStart, "d MMM", { locale: es })} - {format(value.rangeEnd, "d MMM yyyy", { locale: es })}
                    </>
                  ) : value.rangeStart ? (
                    format(value.rangeStart, "d MMM yyyy", { locale: es })
                  ) : (
                    "Seleccionar rango"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border shadow-lg z-50" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: value.rangeStart,
                    to: value.rangeEnd,
                  }}
                  onSelect={handleRangeSelect}
                  disabled={(date) => date > new Date()}
                  numberOfMonths={2}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Corte</Label>
            <Select
              value={value.cutoffHour.toString()}
              onValueChange={handleCutoffChange}
            >
              <SelectTrigger className="w-[120px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                {CUTOFF_HOURS.map((h) => (
                  <SelectItem key={h.value} value={h.value.toString()}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Show computed range for day/range modes */}
      {(value.type === "day" || value.type === "range") && (
        <div className="text-xs text-muted-foreground sm:ml-2 flex items-center gap-1">
          <span className="font-medium">Período:</span>
          {format(rangeResult.startDate, "d MMM HH:mm", { locale: es })}
          {" → "}
          {format(rangeResult.endDate, "d MMM HH:mm", { locale: es })}
        </div>
      )}
    </div>
  );
}
