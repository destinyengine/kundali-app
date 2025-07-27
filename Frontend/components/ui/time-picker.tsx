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
  const [isDragging, setIsDragging] = useState(false);
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour'); // New state for clock mode
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

  // Reset clock mode to hour when opening
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setClockMode('hour');
    }
  };

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
  const handleClockClick = (clientX: number, clientY: number) => {
    const angle = getAngleFromCenter(clientX, clientY);
    
    if (clockMode === 'hour') {
      const newHour = Math.round(angle / 30) || 12;
      const formattedTime = formatTime(newHour, minutes, period);
      onChange?.(formattedTime);
      // Don't auto-switch during drag - only on release
    } else if (clockMode === 'minute') {
      const newMinute = Math.round(angle / 6) % 60;
      const formattedTime = formatTime(hours, newMinute, period);
      onChange?.(formattedTime);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleClockClick(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const angle = getAngleFromCenter(e.clientX, e.clientY);
    
    if (clockMode === 'hour') {
      const newHour = Math.round(angle / 30) || 12;
      const formattedTime = formatTime(newHour, minutes, period);
      onChange?.(formattedTime);
    } else if (clockMode === 'minute') {
      const newMinute = Math.round(angle / 6) % 60;
      const formattedTime = formatTime(hours, newMinute, period);
      onChange?.(formattedTime);
    }
  }, [isDragging, getAngleFromCenter, clockMode, hours, minutes, period, onChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && clockMode === 'hour') {
      // Auto-switch to minute selection after hour is selected and mouse is released
      setTimeout(() => setClockMode('minute'), 300);
    }
    setIsDragging(false);
  }, [isDragging, clockMode]);

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

  // Clock numbers - different for hour and minute modes
  const getClockNumbers = () => {
    if (clockMode === 'hour') {
      return Array.from({ length: 12 }, (_, i) => {
        const number = i === 0 ? 12 : i;
        const angle = i * 30;
        const radius = 85;
        const x = 120 + radius * Math.cos((angle - 90) * Math.PI / 180);
        const y = 120 + radius * Math.sin((angle - 90) * Math.PI / 180);
        return { number, x, y, angle };
      });
    } else {
      // Minute mode - show 00, 05, 10, 15, etc.
      return Array.from({ length: 12 }, (_, i) => {
        const number = i * 5;
        const angle = i * 30;
        const radius = 85;
        const x = 120 + radius * Math.cos((angle - 90) * Math.PI / 180);
        const y = 120 + radius * Math.sin((angle - 90) * Math.PI / 180);
        return { number: number.toString().padStart(2, '0'), x, y, angle };
      });
    }
  };

  // Get the current hand angle and length
  const getCurrentHand = () => {
    if (clockMode === 'hour') {
      return {
        angle: (hours % 12) * 30 + (minutes * 0.5),
        length: 60,
        strokeWidth: 4
      };
    } else {
      return {
        angle: minutes * 6,
        length: 80,
        strokeWidth: 2
      };
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
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
              <div className="text-sm text-muted-foreground mb-2">
                Select {clockMode}
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant={clockMode === 'hour' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClockMode('hour')}
                >
                  Hour
                </Button>
                <Button
                  variant={clockMode === 'minute' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setClockMode('minute')}
                >
                  Minute
                </Button>
                <Select value={period} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
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
                  onMouseDown={handleMouseDown}
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
                  
                  {/* Hour/Minute markers */}
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
                  {getClockNumbers().map(({ number, x, y }, index) => (
                    <text
                      key={index}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-sm font-medium fill-current cursor-pointer hover:text-primary ${
                        clockMode === 'hour' 
                          ? (number === hours ? 'text-primary font-bold' : '') 
                          : (parseInt(number.toString()) === minutes ? 'text-primary font-bold' : '')
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (clockMode === 'hour') {
                          handleTimeChange(typeof number === 'string' ? parseInt(number) : number, minutes, period);
                          setTimeout(() => setClockMode('minute'), 300);
                        } else {
                          handleTimeChange(hours, typeof number === 'string' ? parseInt(number) : number, period);
                        }
                      }}
                    >
                      {number}
                    </text>
                  ))}

                  {/* Single hand based on current mode */}
                  {(() => {
                    const { angle, length, strokeWidth } = getCurrentHand();
                    return (
                      <line
                        x1="120"
                        y1="120"
                        x2={120 + length * Math.cos((angle - 90) * Math.PI / 180)}
                        y2={120 + length * Math.sin((angle - 90) * Math.PI / 180)}
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        className="text-primary cursor-pointer"
                      />
                    );
                  })()}

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
