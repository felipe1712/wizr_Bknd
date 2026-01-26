import { useState, useMemo } from "react";
import { subDays, setHours, startOfDay } from "date-fns";
import type { DateRangeConfig, TimeRangePreset } from "@/components/reports/DateRangeSelector";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

const DEFAULT_CUTOFF_HOUR = 8;

export function useDateRangeFilter(defaultPreset: TimeRangePreset = "30d") {
  const [dateConfig, setDateConfig] = useState<DateRangeConfig>({
    type: defaultPreset,
    customDate: new Date(),
    rangeStart: subDays(new Date(), 7),
    rangeEnd: new Date(),
    cutoffHour: DEFAULT_CUTOFF_HOUR,
  });

  const dateRange = useMemo((): DateRange => {
    const now = new Date();
    const cutoffHour = dateConfig.cutoffHour;

    // Single day mode
    if (dateConfig.type === "day" && dateConfig.customDate) {
      const selectedDate = dateConfig.customDate;
      const endDate = setHours(startOfDay(selectedDate), cutoffHour);
      const startDate = setHours(startOfDay(subDays(selectedDate, 1)), cutoffHour);
      return { startDate, endDate };
    }

    // Custom range mode
    if (dateConfig.type === "range" && dateConfig.rangeStart && dateConfig.rangeEnd) {
      const startDate = setHours(startOfDay(dateConfig.rangeStart), cutoffHour);
      const endDate = setHours(startOfDay(dateConfig.rangeEnd), cutoffHour);
      return { startDate, endDate };
    }

    // Preset modes (7d, 30d, 90d)
    const days = dateConfig.type === "7d" ? 7 : dateConfig.type === "30d" ? 30 : 90;
    return {
      startDate: subDays(now, days),
      endDate: now,
    };
  }, [dateConfig]);

  // Helper to get days as number for legacy hooks
  const daysRange = useMemo(() => {
    if (dateConfig.type === "7d") return 7;
    if (dateConfig.type === "30d") return 30;
    if (dateConfig.type === "90d") return 90;
    
    // For custom ranges, calculate days difference
    const diffTime = Math.abs(dateRange.endDate.getTime() - dateRange.startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [dateConfig.type, dateRange]);

  return {
    dateConfig,
    setDateConfig,
    dateRange,
    daysRange,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };
}
