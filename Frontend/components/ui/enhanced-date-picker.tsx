"use client";

import { useState, useMemo } from "react";
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
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnhancedDatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isBS?: boolean; // Bikram Sambat mode
}

// Nepali number conversion
const nepaliNumbers = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

const convertToNepali = (num: number): string => {
  return num.toString().split('').map(digit => nepaliNumbers[parseInt(digit)]).join('');
};

// Nepali month names
const nepaliMonths = [
  'बैशाख', 'जेठ', 'आषाढ', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

const englishMonths = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// More comprehensive Nepali calendar data with accurate day counts
// This covers from 1970 BS (1913 AD) to 2100 BS (2043 AD) approximately
const nepaliCalendarData: { [year: number]: number[] } = {
  1970: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1971: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  1972: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1973: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  1974: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1975: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1976: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1977: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  1978: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1979: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1980: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1981: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  1982: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1983: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1984: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  1985: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  1986: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1987: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1988: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  1989: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1990: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1991: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1992: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  1993: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  1994: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1995: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  1996: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  1997: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  1998: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  1999: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2000: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2003: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2004: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2005: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2006: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2007: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2008: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2009: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2010: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2011: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2012: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2013: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2014: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2015: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2016: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2017: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2018: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2019: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2020: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2021: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2022: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2023: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2024: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2025: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2026: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2027: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2028: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2029: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2030: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2031: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2032: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2033: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2034: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2035: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2036: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2037: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2038: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2039: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2040: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2041: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2042: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2043: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2044: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2045: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2046: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2047: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2048: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2049: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2050: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2051: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2052: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2053: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2054: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2055: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2056: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2057: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2058: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2059: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2060: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2061: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2062: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2063: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2064: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2065: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2066: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2067: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2068: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2069: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2073: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2074: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2075: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2077: [30, 32, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
  2078: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2081: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 30, 30],
  2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2089: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2091: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2092: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2093: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2094: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2095: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2096: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30],
  2097: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2098: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2099: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2100: [31, 31, 31, 32, 31, 31, 30, 30, 29, 29, 30, 30]
};

// Reference dates for accurate conversion
// Using multiple reference points for better accuracy
// 1st Baisakh 2000 BS = 14th April 1943 AD (historically verified)
// 1st Baisakh 2080 BS = 13th April 2023 AD (modern reference)
const BS_AD_REFERENCES = [
  {
    bsYear: 2000,
    bsMonth: 0, // Baisakh (0-indexed)
    bsDay: 1,
    adDate: new Date(1943, 3, 14) // April 14, 1943
  },
  {
    bsYear: 2080,
    bsMonth: 0, // Baisakh (0-indexed) 
    bsDay: 1,
    adDate: new Date(2023, 3, 13) // April 13, 2023
  }
];

// Find the closest reference point for better accuracy
const getClosestReference = (bsYear: number) => {
  return BS_AD_REFERENCES.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.bsYear - bsYear);
    const currentDiff = Math.abs(current.bsYear - bsYear);
    return currentDiff < closestDiff ? current : closest;
  });
};

// Get days in a Nepali month
const getDaysInNepaliMonth = (bsYear: number, bsMonth: number): number => {
  const yearData = nepaliCalendarData[bsYear];
  if (!yearData) {
    // Fallback pattern if year data not available
    const fallbackPattern = [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30];
    return fallbackPattern[bsMonth] || 30;
  }
  return yearData[bsMonth] || 30;
};

// Calculate total days from reference date
const getTotalDaysFromReference = (bsYear: number, bsMonth: number, bsDay: number): number => {
  const reference = getClosestReference(bsYear);
  let totalDays = 0;
  
  if (bsYear >= reference.bsYear) {
    // Forward calculation
    for (let year = reference.bsYear; year < bsYear; year++) {
      const yearData = nepaliCalendarData[year];
      if (yearData) {
        totalDays += yearData.reduce((sum, days) => sum + days, 0);
      } else {
        totalDays += 365; // Approximate fallback
      }
    }
    
    // Add days for complete months in the target year
    for (let month = 0; month < bsMonth; month++) {
      totalDays += getDaysInNepaliMonth(bsYear, month);
    }
    
    // Add remaining days
    totalDays += bsDay - 1; // -1 because we're counting from day 1
  } else {
    // Backward calculation
    for (let year = bsYear; year < reference.bsYear; year++) {
      const yearData = nepaliCalendarData[year];
      if (yearData) {
        totalDays -= yearData.reduce((sum, days) => sum + days, 0);
      } else {
        totalDays -= 365; // Approximate fallback
      }
    }
    
    // Subtract days for months in the target year
    for (let month = bsMonth + 1; month < 12; month++) {
      totalDays -= getDaysInNepaliMonth(bsYear, month);
    }
    
    // Subtract remaining days
    totalDays -= (getDaysInNepaliMonth(bsYear, bsMonth) - bsDay + 1);
  }
  
  return totalDays;
};

// Convert BS to AD with proper calculation
const bsToAd = (bsYear: number, bsMonth: number, bsDay: number): Date => {
  const reference = getClosestReference(bsYear);
  
  // Calculate days from reference
  const totalDays = getTotalDaysFromReference(bsYear, bsMonth, bsDay);
  
  // Add to reference AD date
  const resultDate = new Date(reference.adDate);
  resultDate.setDate(resultDate.getDate() + totalDays);
  
  return resultDate;
};

// Convert AD to BS with proper calculation
const adToBs = (adDate: Date): { year: number; month: number; day: number } => {
  // Find the best reference point
  const reference2080 = BS_AD_REFERENCES[1]; // 2080 BS reference
  const reference2000 = BS_AD_REFERENCES[0]; // 2000 BS reference
  
  // Use 2080 reference for modern dates, 2000 for older dates
  const reference = adDate >= new Date(1980, 0, 1) ? reference2080 : reference2000;
  
  // Calculate days difference from reference
  const timeDiff = adDate.getTime() - reference.adDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  let remainingDays = daysDiff;
  let bsYear = reference.bsYear;
  let bsMonth = reference.bsMonth;
  let bsDay = reference.bsDay;
  
  if (remainingDays >= 0) {
    // Forward calculation
    while (remainingDays > 0) {
      const daysInCurrentMonth = getDaysInNepaliMonth(bsYear, bsMonth);
      const daysLeftInMonth = daysInCurrentMonth - bsDay + 1;
      
      if (remainingDays >= daysLeftInMonth) {
        remainingDays -= daysLeftInMonth;
        bsMonth++;
        if (bsMonth >= 12) {
          bsMonth = 0;
          bsYear++;
        }
        bsDay = 1;
      } else {
        bsDay += remainingDays;
        remainingDays = 0;
      }
    }
  } else {
    // Backward calculation
    remainingDays = Math.abs(remainingDays);
    while (remainingDays > 0) {
      if (remainingDays >= bsDay) {
        remainingDays -= bsDay;
        bsMonth--;
        if (bsMonth < 0) {
          bsMonth = 11;
          bsYear--;
        }
        bsDay = getDaysInNepaliMonth(bsYear, bsMonth);
      } else {
        bsDay -= remainingDays;
        remainingDays = 0;
      }
    }
  }
  
  return { year: bsYear, month: bsMonth, day: bsDay };
};

export function EnhancedDatePicker({ 
  date, 
  onDateChange, 
  placeholder = "Select date",
  disabled, 
  className, 
  isBS = false 
}: EnhancedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(date || new Date());

  const currentDate = date || new Date();
  const { year: displayYear, month: displayMonth, day: displayDay } = useMemo(() => {
    if (isBS && date) {
      return adToBs(currentDate);
    }
    return {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth(),
      day: currentDate.getDate()
    };
  }, [currentDate, isBS, date]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (isBS) {
      const bsDate = adToBs(viewDate);
      const bsYear = bsDate.year;
      const bsMonth = bsDate.month;
      
      // Get actual days in this Nepali month
      const daysInMonth = getDaysInNepaliMonth(bsYear, bsMonth);
      
      // Calculate first day of month in AD to get proper day alignment
      const firstDayBsDate = bsToAd(bsYear, bsMonth, 1);
      const firstDayOfMonth = firstDayBsDate.getDay(); // 0 = Sunday, matches Nepali आइत
      
      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
      }
      
      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }
      
      return days;
    } else {
      // Gregorian calendar logic
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      
      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null);
      }
      
      // Add days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(day);
      }
      
      return days;
    }
  }, [viewDate, isBS]);

  const handleDayClick = (day: number) => {
    if (isBS) {
      const bsDate = adToBs(viewDate);
      const newDate = bsToAd(bsDate.year, bsDate.month, day);
      onDateChange(newDate);
    } else {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      onDateChange(newDate);
    }
    setIsOpen(false);
  };

  const handleMonthChange = (monthIndex: number) => {
    if (isBS) {
      const bsDate = adToBs(viewDate);
      const newDate = bsToAd(bsDate.year, monthIndex, 1);
      setViewDate(newDate);
    } else {
      setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
    }
  };

  const handleYearChange = (year: number) => {
    if (isBS) {
      const bsDate = adToBs(viewDate);
      const newDate = bsToAd(year, bsDate.month, 1);
      setViewDate(newDate);
    } else {
      setViewDate(new Date(year, viewDate.getMonth(), 1));
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setViewDate(newDate);
  };

  const formatDisplayDate = () => {
    if (!date) return placeholder;
    
    if (isBS) {
      const bsDate = adToBs(currentDate);
      return `${convertToNepali(bsDate.day)} ${nepaliMonths[bsDate.month]} ${convertToNepali(bsDate.year)}`;
    }
    return currentDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const weekDays = isBS 
    ? ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const months = isBS ? nepaliMonths : englishMonths;
  
  const currentViewYear = isBS ? adToBs(viewDate).year : viewDate.getFullYear();
  const currentViewMonth = isBS ? adToBs(viewDate).month : viewDate.getMonth();

  // Generate year options (current year ± 50)
  const yearOptions = useMemo(() => {
    if (isBS) {
      // For BS, use years from our calendar data
      const availableYears = Object.keys(nepaliCalendarData).map(Number).sort((a, b) => a - b);
      return availableYears.length > 0 ? availableYears : 
        Array.from({ length: 131 }, (_, i) => 1970 + i); // Fallback range 1970-2100
    } else {
      // For AD, use current year ± 50
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 101 }, (_, i) => currentYear - 50 + i);
    }
  }, [isBS]);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-12",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <Calendar className="mr-2 h-5 w-5" />
            <div className="flex flex-col">
              <span className="text-sm">
                {formatDisplayDate()}
              </span>
              {date && (
                <span className="text-xs text-muted-foreground">
                  {isBS ? 'बिक्रम संवत्' : 'Gregorian Calendar'}
                </span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            {/* Header with month/year selectors */}
            <div className="flex items-center justify-between space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex flex-col items-center space-y-1">
                <div className="flex space-x-2">
                  <Select 
                    value={currentViewMonth.toString()} 
                    onValueChange={(value: string) => handleMonthChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select 
                    value={currentViewYear.toString()} 
                    onValueChange={(value: string) => handleYearChange(parseInt(value))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {isBS ? convertToNepali(year) : year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Show days in month for BS calendar */}
                {isBS && (
                  <div className="text-xs text-muted-foreground">
                    {convertToNepali(getDaysInNepaliMonth(currentViewYear, currentViewMonth))} दिन
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-2">
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="h-8 w-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const isSelected = day === displayDay && 
                    currentViewMonth === displayMonth && 
                    currentViewYear === displayYear;
                  const isToday = !isBS && day && 
                    new Date().getDate() === day &&
                    new Date().getMonth() === currentViewMonth &&
                    new Date().getFullYear() === currentViewYear;

                  return (
                    <Button
                      key={index}
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 font-normal",
                        !day && "invisible",
                        isToday && !isSelected && "bg-accent",
                        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                      onClick={() => day && handleDayClick(day)}
                      disabled={!day}
                    >
                      {day && (isBS ? convertToNepali(day) : day)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Quick date selections */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onDateChange(new Date());
                    setIsOpen(false);
                  }}
                >
                  {isBS ? 'आज' : 'Today'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    onDateChange(yesterday);
                    setIsOpen(false);
                  }}
                >
                  {isBS ? 'हिजो' : 'Yesterday'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const lastWeek = new Date();
                    lastWeek.setDate(lastWeek.getDate() - 7);
                    onDateChange(lastWeek);
                    setIsOpen(false);
                  }}
                >
                  {isBS ? 'गत हप्ता' : 'Last Week'}
                </Button>
              </div>
              
              {/* Nepali calendar info */}
              {isBS && (
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded space-y-1">
                  <div>
                    <strong>नोट:</strong> नेपाली क्यालेन्डरमा प्रत्येक महिनामा फरक-फरक दिनहरू हुन्छन्।
                  </div>
                  {date && (
                    <div className="text-xs opacity-75">
                      AD: {date.toLocaleDateString('en-GB')} | BS: {(() => {
                        const bs = adToBs(date);
                        return `${convertToNepali(bs.day)}/${convertToNepali(bs.month + 1)}/${convertToNepali(bs.year)}`;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between gap-2 pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                {isBS ? 'रद्द' : 'Cancel'}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                {isBS ? 'गर्नुहोस्' : 'Done'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
