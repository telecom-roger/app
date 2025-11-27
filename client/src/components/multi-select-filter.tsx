import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedValues: Set<string>;
  onSelectionChange: (values: Set<string>) => void;
}

export function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onSelectionChange,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (option: string) => {
    const copy = new Set(selectedValues);
    copy.has(option) ? copy.delete(option) : copy.add(option);
    onSelectionChange(copy);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9"
      >
        {label} {selectedValues.size > 0 && `(${selectedValues.size})`}
        <ChevronDown className={`w-3 h-3 ml-2 ${isOpen ? "rotate-180" : ""}`} />
      </Button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 z-50 min-w-[180px] shadow-lg">
          <div className="max-h-48 overflow-y-auto space-y-2">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selectedValues.has(o)} onCheckedChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="w-full mt-2 text-xs" onClick={() => setIsOpen(false)}>
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
