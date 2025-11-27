import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";

interface DateRangeFilterProps {
  onStartDateChange?: (date: Date | undefined) => void;
  onEndDateChange?: (date: Date | undefined) => void;
  startDate?: Date;
  endDate?: Date;
}

export function DateRangeFilter({
  onStartDateChange,
  onEndDateChange,
  startDate,
  endDate,
}: DateRangeFilterProps) {
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const formatData = (data: Date | undefined) => {
    if (!data) return "Selecionar";
    return data.toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        {/* Data Inicial */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStart(!showStart)}
            className="justify-between gap-2 min-w-[140px] h-9"
            data-testid="button-data-inicio-collapsible"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{formatData(startDate)}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showStart ? "rotate-180" : ""}`} />
          </Button>

          {showStart && (
            <div className="absolute top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 z-50">
              <DayPicker
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  onStartDateChange?.(date);
                  setShowStart(false);
                }}
                disabled={(date) => date > new Date()}
                className="[&_.rdp]:bg-transparent [&_.rdp-months]:m-0 [&_.rdp-month_table]:w-full [&_.rdp-cell]:w-auto [&_.rdp-cell]:p-0 [&_.rdp-cell_button]:w-7 [&_.rdp_cell_button]:h-7 [&_.rdp-day_selected]:bg-blue-600 [&_.rdp-day]:rounded-md"
              />
            </div>
          )}
        </div>

        <span className="text-slate-400 text-sm">→</span>

        {/* Data Final */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEnd(!showEnd)}
            className="justify-between gap-2 min-w-[140px] h-9"
            data-testid="button-data-fim-collapsible"
            disabled={!startDate}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">{formatData(endDate)}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showEnd ? "rotate-180" : ""}`} />
          </Button>

          {showEnd && (
            <div className="absolute top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 z-50">
              <DayPicker
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  onEndDateChange?.(date);
                  setShowEnd(false);
                }}
                disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                className="[&_.rdp]:bg-transparent [&_.rdp-months]:m-0 [&_.rdp-month_table]:w-full [&_.rdp-cell]:w-auto [&_.rdp-cell]:p-0 [&_.rdp-cell_button]:w-7 [&_.rdp_cell_button]:h-7 [&_.rdp-day_selected]:bg-blue-600 [&_.rdp-day]:rounded-md"
              />
            </div>
          )}
        </div>

        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onStartDateChange?.(undefined);
              onEndDateChange?.(undefined);
              setShowStart(false);
              setShowEnd(false);
            }}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 h-9 px-2"
            data-testid="button-limpar-periodo"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}
