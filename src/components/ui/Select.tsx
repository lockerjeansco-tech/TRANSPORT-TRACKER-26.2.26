import React, { SelectHTMLAttributes, useState } from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon, ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  icon?: LucideIcon;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, icon: Icon, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${selectId}-error` : undefined;
    const hasValue = props.value !== '' && props.value !== undefined;

    const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="w-full space-y-1 relative group">
        <div className="relative">
          {Icon && (
            <div className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none z-10",
              isFocused ? "text-indigo-500" : "text-slate-400"
            )}>
              <Icon size={20} />
            </div>
          )}
          
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown size={16} />
          </div>

          <select
            ref={ref}
            id={selectId}
            className={cn(
              'flex h-14 w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-base text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all duration-200 appearance-none shadow-sm cursor-pointer',
              Icon && 'pl-11',
              label && 'pt-6 pb-2',
              error && 'ring-2 ring-red-500 bg-red-50',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={!!error}
            aria-describedby={errorId}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          
          {label && (
            <label 
              htmlFor={selectId} 
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none",
                Icon ? "left-11" : "left-4",
                // Always float the label for Select because the value (or placeholder option) is always visible
                "top-2 text-[10px] font-semibold uppercase tracking-wider",
                isFocused ? "text-indigo-500" : "text-slate-500"
              )}
            >
              {label}
            </label>
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs text-red-500 ml-1 animate-in slide-in-from-top-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
