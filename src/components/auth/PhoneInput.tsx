"use client";

import { forwardRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function extractDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  className?: string;
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, disabled, className }, ref) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const digits = extractDigits(e.target.value);
      onChange(digits);
    };

    return (
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(555) 555-5555"
        value={formatPhone(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Phone number"
        className={cn(
          "glass-input h-14 w-full px-4 text-center text-2xl text-white placeholder:text-white/35",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-200",
          className
        )}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput, formatPhone, extractDigits };
