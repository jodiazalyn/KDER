"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
  disabled?: boolean;
  /** Increment to reset + re-shake on new errors */
  errorKey?: number;
}

export function OtpInput({
  length = 6,
  onComplete,
  error = false,
  disabled = false,
  errorKey = 0,
}: OtpInputProps) {
  // Use errorKey as React key to fully remount on error, which:
  // 1. Resets all input values (fresh state)
  // 2. Triggers CSS animation (fresh DOM element)
  // 3. Re-focuses first input (autoFocus)
  return (
    <OtpInputInner
      key={errorKey}
      length={length}
      onComplete={onComplete}
      error={error}
      disabled={disabled}
      shouldAnimate={errorKey > 0}
    />
  );
}

interface OtpInputInnerProps {
  length: number;
  onComplete: (code: string) => void;
  error: boolean;
  disabled: boolean;
  shouldAnimate: boolean;
}

function OtpInputInner({
  length,
  onComplete,
  error,
  disabled,
  shouldAnimate,
}: OtpInputInnerProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, length - 1));
      inputRefs.current[clamped]?.focus();
    },
    [length]
  );

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (!/^\d?$/.test(digit)) return;

      const newValues = [...values];
      newValues[index] = digit;
      setValues(newValues);

      if (digit && index < length - 1) {
        focusInput(index + 1);
      }

      if (digit && newValues.every((v) => v !== "")) {
        onComplete(newValues.join(""));
      }
    },
    [values, length, focusInput, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (values[index]) {
          handleChange(index, "");
        } else if (index > 0) {
          focusInput(index - 1);
          handleChange(index - 1, "");
        }
        e.preventDefault();
      } else if (e.key === "ArrowLeft" && index > 0) {
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [values, handleChange, focusInput, length]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, length);
      if (pasted.length === 0) return;

      const newValues = [...values];
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i];
      }
      setValues(newValues);

      if (pasted.length === length) {
        onComplete(newValues.join(""));
      } else {
        focusInput(pasted.length);
      }
    },
    [values, length, focusInput, onComplete]
  );

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div
      className={cn(
        "flex gap-3 justify-center",
        shouldAnimate && "animate-shake"
      )}
      role="group"
      aria-label="One-time verification code"
    >
      {values.map((val, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={val}
          disabled={disabled}
          onChange={(e) =>
            handleChange(i, e.target.value.replace(/\D/g, ""))
          }
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={cn(
            "h-14 w-12 rounded-xl border bg-white/[0.06] text-center text-2xl font-bold text-white backdrop-blur-[8px]",
            "focus:border-green-400/60 focus:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-green-700",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            error
              ? "border-red-500/60 bg-red-500/[0.08]"
              : "border-white/[0.12]"
          )}
        />
      ))}
    </div>
  );
}
