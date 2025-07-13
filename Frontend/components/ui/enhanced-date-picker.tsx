"use client";

import * as React from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface EnhancedDatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isBS?: boolean;
}

export function EnhancedDatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  disabled = false,
  className,
  isBS = false,
}: EnhancedDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(date || new Date());
  const [inputValue, setInputValue] = React.useState("");
  // Update input value when date changes
  React.useEffect(() => {
    if (date) {
      if (isBS) {
        // For BS calendar, show in BS format (this is a simplified representation)
        // In a real implementation, you'd convert AD to BS
        setInputValue(format(date, "dd/MM/yyyy") + " BS");
      } else {
        setInputValue(format(date, "dd/MM/yyyy"));
      }
    } else {
      setInputValue("");
    }
  }, [date, isBS]);
  // Generate years (1900 to current year + 10)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 11 }, (_, i) => 1900 + i);
  
  // BS calendar months
  const bsMonths = [
    "बैशाख", "जेठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
    "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र"
  ];
  
  const adMonths = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const months = isBS ? bsMonths : adMonths;
  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Try to parse date from input
    const cleanValue = value.replace(" BS", ""); // Remove BS suffix if present
    const parts = cleanValue.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      
      if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= currentYear + 10) {
        const newDate = new Date(year, month, day);
        if (newDate.getDate() === day && newDate.getMonth() === month && newDate.getFullYear() === year) {
          onDateChange(newDate);
          setMonth(newDate);
        }
      }
    }
  };

  const handleYearChange = (year: string) => {
    const newMonth = new Date(month);
    newMonth.setFullYear(parseInt(year));
    setMonth(newMonth);
  };

  const handleMonthChange = (monthIndex: string) => {
    const newMonth = new Date(month);
    newMonth.setMonth(parseInt(monthIndex));
    setMonth(newMonth);
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    setOpen(false);
  };

  const handleTodayClick = () => {
    const today = new Date();
    onDateChange(today);
    setMonth(today);
    setOpen(false);
  };

  const handleClearClick = () => {
    onDateChange(undefined);
    setInputValue("");
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex gap-2">          <div className="relative flex-1">
            <Input
              placeholder={isBS ? "DD/MM/YYYY (BS)" : "DD/MM/YYYY"}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={disabled}
              className="pr-10"
            />
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted"
                disabled={disabled}
              >
                <CalendarIcon className="h-4 w-4" />
                <span className="sr-only">Open calendar</span>
              </Button>
            </PopoverTrigger>
          </div>
        </div>
          <PopoverContent className="w-auto p-0" align="start">
          <div className="space-y-4 p-4">
            {isBS && (
              <div className="rounded-md bg-blue-50 p-2 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>BS Calendar:</strong> Bikram Sambat calendar system
                </p>
              </div>
            )}
            
            {/* Year and Month selectors */}
            <div className="flex gap-2">
              <Select value={month.getMonth().toString()} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((monthName, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {monthName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={month.getFullYear().toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.reverse().map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calendar */}
            <DayPicker
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              month={month}
              onMonthChange={setMonth}
              showOutsideDays={false}
              className="rounded-md border-0"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-muted rounded-md"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "relative h-8 w-8 text-center text-sm p-0 focus-within:relative focus-within:z-20",
                day: cn(
                  "h-8 w-8 p-0 font-normal rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
              }}
              components={{
                Chevron: ({ orientation, ...props }) => {
                  const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
                  return <Icon className="h-4 w-4" />;
                },
              }}
            />

            {/* Action buttons */}
            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTodayClick}
                className="flex-1"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearClick}
                className="flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
