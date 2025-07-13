"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value?: string;
  onChange?: (time: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TimePicker({ value = "", onChange, disabled, className }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState<'hour' | 'minute' | null>(null);
  const clockRef = useRef<SVGSVGElement>(null);

  // Parse the time value (HH:MM format)
  const parseTime = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) {
      return { hours: 12, minutes: 0, period: "AM" };
    }
    
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours24 = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    
    return { hours: hours12, minutes, period };
  };

  // Format time back to 24-hour format
  const formatTime = (hours: number, minutes: number, period: string) => {
    let hours24 = hours;
    
    if (period === "AM" && hours === 12) {
      hours24 = 0;
    } else if (period === "PM" && hours !== 12) {
      hours24 = hours + 12;
    }
    
    return `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const { hours, minutes, period } = parseTime(value);

  // Calculate angles for clock hands
  const hourAngle = (hours % 12) * 30 + (minutes * 0.5); // 30 degrees per hour + minute adjustment
  const minuteAngle = minutes * 6; // 6 degrees per minute

  // Get mouse position relative to clock center
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!clockRef.current) return 0;
    
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360; // Adjust for 12 o'clock being 0 degrees
    
    return angle;
  }, []);

  // Handle mouse interactions
  const handleMouseDown = (type: 'hour' | 'minute') => {
    setIsDragging(type);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const angle = getAngleFromCenter(e.clientX, e.clientY);
    
    if (isDragging === 'hour') {
      const newHour = Math.round(angle / 30) || 12;
      const formattedTime = formatTime(newHour, minutes, period);
      onChange?.(formattedTime);
    } else if (isDragging === 'minute') {
      const newMinute = Math.round(angle / 6) % 60;
      const formattedTime = formatTime(hours, newMinute, period);
      onChange?.(formattedTime);
    }
  }, [isDragging, getAngleFromCenter, hours, minutes, period, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleMouseMove, handleMouseUp]);

  const handleTimeChange = (newHours: number, newMinutes: number, newPeriod: string) => {
    const formattedTime = formatTime(newHours, newMinutes, newPeriod);
    onChange?.(formattedTime);
  };

  const handlePeriodChange = (newPeriod: string) => {
    handleTimeChange(hours, minutes, newPeriod);
  };

  // Clock numbers
  const clockNumbers = Array.from({ length: 12 }, (_, i) => {
    const number = i === 0 ? 12 : i;
    const angle = i * 30;
    const radius = 85;
    const x = 120 + radius * Math.cos((angle - 90) * Math.PI / 180);
    const y = 120 + radius * Math.sin((angle - 90) * Math.PI / 180);
    
    return { number, x, y };
  });

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-12",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <Clock className="mr-2 h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-sm">
                {value ? 
                  `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}` 
                  : "Select time"
                }
              </span>
              {value && (
                <span className="text-xs text-muted-foreground">
                  24-hour: {value}
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-6" align="start">
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
              </div>
              <div className="text-sm text-muted-foreground">
                {period}
              </div>
            </div>

            {/* Clock Face */}
            <div className="flex justify-center">
              <div className="relative">
                <svg
                  ref={clockRef}
                  width="240"
                  height="240"
                  className="cursor-pointer select-none"
                  style={{ userSelect: 'none' }}
                >
                  {/* Clock circle */}
                  <circle
                    cx="120"
                    cy="120"
                    r="110"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-border"
                  />
                  
                  {/* Hour markers */}
                  {Array.from({ length: 12 }, (_, i) => {
                    const angle = i * 30;
                    const innerRadius = 95;
                    const outerRadius = 105;
                    const x1 = 120 + innerRadius * Math.cos((angle - 90) * Math.PI / 180);
                    const y1 = 120 + innerRadius * Math.sin((angle - 90) * Math.PI / 180);
                    const x2 = 120 + outerRadius * Math.cos((angle - 90) * Math.PI / 180);
                    const y2 = 120 + outerRadius * Math.sin((angle - 90) * Math.PI / 180);
                    
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted-foreground"
                      />
                    );
                  })}

                  {/* Numbers */}
                  {clockNumbers.map(({ number, x, y }) => (
                    <text
                      key={number}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-sm font-medium fill-current cursor-pointer hover:text-primary"
                      onClick={() => handleTimeChange(number, minutes, period)}
                    >
                      {number}
                    </text>
                  ))}

                  {/* Hour hand */}
                  <line
                    x1="120"
                    y1="120"
                    x2={120 + 60 * Math.cos((hourAngle - 90) * Math.PI / 180)}
                    y2={120 + 60 * Math.sin((hourAngle - 90) * Math.PI / 180)}
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="text-primary cursor-pointer"
                    onMouseDown={() => handleMouseDown('hour')}
                  />

                  {/* Minute hand */}
                  <line
                    x1="120"
                    y1="120"
                    x2={120 + 80 * Math.cos((minuteAngle - 90) * Math.PI / 180)}
                    y2={120 + 80 * Math.sin((minuteAngle - 90) * Math.PI / 180)}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="text-secondary-foreground cursor-pointer"
                    onMouseDown={() => handleMouseDown('minute')}
                  />

                  {/* Center dot */}
                  <circle
                    cx="120"
                    cy="120"
                    r="6"
                    fill="currentColor"
                    className="text-primary"
                  />
                </svg>
              </div>
            </div>

            {/* AM/PM Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Period</Label>
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick time presets */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Quick Select</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "6:00 AM", value: "06:00" },
                  { label: "12:00 PM", value: "12:00" },
                  { label: "6:00 PM", value: "18:00" },
                  { label: "12:00 AM", value: "00:00" },
                ].map((preset) => (
                  <Button
                    key={preset.value}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => onChange?.(preset.value)}
                    disabled={disabled}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
