import React, { InputHTMLAttributes, useState } from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, icon: Icon, onFocus, onBlur, ...props }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const errorId = error ? `${inputId}-error` : undefined;
    const hasValue = props.value !== '' && props.value !== undefined;
    const isDateInput = props.type === 'date' || props.type === 'datetime-local' || props.type === 'time' || props.type === 'month' || props.type === 'week';

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    return (
      <div className="w-full space-y-1 relative group">
        <div className="relative">
          {Icon && (
            <div className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200",
              isFocused ? "text-indigo-500" : "text-slate-400"
            )}>
              <Icon size={18} />
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-14 w-full rounded-xl border-0 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm',
              Icon && 'pl-11',
              label && 'pt-6 pb-2', // Add padding for floating label
              error && 'ring-2 ring-red-500 bg-red-50',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={!!error}
            aria-describedby={errorId}
            placeholder={label || props.placeholder} // Placeholder needed for :placeholder-shown trick
            {...props}
          />
          
          {label && (
            <label 
              htmlFor={inputId} 
              className={cn(
                "absolute left-3 transition-all duration-200 pointer-events-none text-slate-500",
                Icon ? "left-10" : "left-3",
                (isFocused || hasValue || isDateInput) 
                  ? "top-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-500" 
                  : "top-1/2 -translate-y-1/2 text-base"
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
Input.displayName = 'Input';
