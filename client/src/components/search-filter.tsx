import { X, Search } from "lucide-react";

interface SearchFilterProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  testId?: string;
}

export function SearchFilter({
  placeholder = "Buscar...",
  value,
  onChange,
  onClear,
  testId,
}: SearchFilterProps) {
  return (
    <div 
      className="relative flex items-center gap-2" 
      style={{
        backgroundColor: "#f7f7f8",
        border: "1px solid #999999",
        borderRadius: "999px",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)"
      }}
    >
      <Search className="absolute left-3 h-4 w-4 text-slate-600 dark:text-slate-400" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border-0 bg-transparent focus:outline-none focus:ring-0 text-sm px-9 py-2 placeholder-slate-500 dark:placeholder-slate-400 dark:text-white"
        data-testid={testId}
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="flex-shrink-0 pr-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          title="Limpar"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
