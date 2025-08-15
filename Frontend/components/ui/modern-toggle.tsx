"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ModernToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  leftLabel: string;
  rightLabel: string;
  disabled?: boolean;
  className?: string;
}

export function ModernToggle({
  checked,
  onCheckedChange,
  leftLabel,
  rightLabel,
  disabled = false,
  className
}: ModernToggleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full p-1 transition-all duration-300 ease-in-out cursor-pointer select-none",
        "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20",
        "border border-amber-200 dark:border-amber-700",
        "shadow-inner",
        isHovered && !disabled && "shadow-lg scale-105",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={() => !disabled && onCheckedChange(!checked)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background sliding element */}
      <div
        className={cn(
          "absolute inset-1 w-1/2 rounded-full transition-all duration-300 ease-out",
          "bg-gradient-to-b from-white to-amber-50 dark:from-amber-600 dark:to-amber-700",
          "shadow-md border border-amber-300 dark:border-amber-500",
          checked ? "translate-x-full" : "translate-x-0"
        )}
      />
      
      {/* Left label */}
      <div
        className={cn(
          "relative z-10 px-3 py-1.5 text-xs font-semibold transition-all duration-300",
          "rounded-full min-w-[32px] text-center",
          !checked 
            ? "text-amber-800 dark:text-amber-100" 
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {leftLabel}
      </div>
      
      {/* Right label */}
      <div
        className={cn(
          "relative z-10 px-3 py-1.5 text-xs font-semibold transition-all duration-300",
          "rounded-full min-w-[32px] text-center",
          checked 
            ? "text-amber-800 dark:text-amber-100" 
            : "text-amber-600 dark:text-amber-400"
        )}
      >
        {rightLabel}
      </div>
      
      {/* Subtle glow effect on active side */}
      <div
        className={cn(
          "absolute inset-1 w-1/2 rounded-full pointer-events-none transition-all duration-300",
          "bg-gradient-to-b from-amber-400/20 to-amber-600/20",
          "opacity-0",
          isHovered && "opacity-100",
          checked ? "translate-x-full" : "translate-x-0"
        )}
      />
    </div>
  );
}
