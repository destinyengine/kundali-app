"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  CalendarIcon,
  Clock,
  MapPin,
  Languages,
  Sparkles,
  BookOpen,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { EnhancedDatePicker } from "@/components/ui/enhanced-date-picker";
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
import { TimePicker } from "@/components/ui/time-picker";
import { Switch } from "@/components/ui/switch";

// Dynamic import for LocationMap to handle SSR issues with Leaflet
const LocationMap = dynamic(
  () => import("@/components/ui/location-map").then(mod => ({ default: mod.LocationMap })),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full rounded-lg border bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    )
  }
);
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import KundaliResults from "@/components/kundali/kundali-results";

const timezones = [
  "UTC-12:00",
  "UTC-11:00",
  "UTC-10:00",
  "UTC-09:30",
  "UTC-09:00",
  "UTC-08:00",
  "UTC-07:00",
  "UTC-06:00",
  "UTC-05:00",
  "UTC-04:00",
  "UTC-03:30",
  "UTC-03:00",
  "UTC-02:00",
  "UTC-01:00",
  "UTC+00:00",
  "UTC+01:00",
  "UTC+02:00",
  "UTC+03:00",
  "UTC+03:30",
  "UTC+04:00",
  "UTC+04:30",
  "UTC+05:00",
  "UTC+05:30",
  "UTC+05:45",
  "UTC+06:00",
  "UTC+06:30",
  "UTC+07:00",
  "UTC+08:00",
  "UTC+08:45",
  "UTC+09:00",
  "UTC+09:30",
  "UTC+10:00",
  "UTC+10:30",
  "UTC+11:00",
  "UTC+12:00",
  "UTC+12:45",
  "UTC+13:00",
  "UTC+14:00",
];

const KundaliForm = () => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    date: undefined as Date | undefined,
    time: "",
    isBS: false,
    place: "",
    latitude: "",
    longitude: "",
    timezone: "UTC+05:45", // Default for Nepal
    language: "english",
    showChart: true,
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kundaliData, setKundaliData] = useState<any>(null);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // BS calendar conversion utilities
  const bsMonths = [
    "बैशाख", "जेठ", "आषाढ", "श्रावण", "भाद्र", "आश्विन",
    "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुन", "चैत्र"
  ];

  const bsMonthsEn = [
    "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
    "Kartik", "Mangsir", "Paush", "Magh", "Falgun", "Chaitra"
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Function to convert timezone offset to IANA timezone name
  const convertTimezoneToIANA = (offset: string): string => {
    const timezoneMap: { [key: string]: string } = {
      "UTC-12:00": "Etc/GMT+12",
      "UTC-11:00": "Pacific/Midway",
      "UTC-10:00": "Pacific/Honolulu",
      "UTC-09:00": "America/Anchorage",
      "UTC-08:00": "America/Los_Angeles",
      "UTC-07:00": "America/Denver", 
      "UTC-06:00": "America/Chicago",
      "UTC-05:00": "America/New_York",
      "UTC-04:00": "America/Halifax",
      "UTC-03:00": "America/Sao_Paulo",
      "UTC-02:00": "Atlantic/South_Georgia",
      "UTC-01:00": "Atlantic/Azores",
      "UTC+00:00": "UTC",
      "UTC+01:00": "Europe/London",
      "UTC+02:00": "Europe/Berlin",
      "UTC+03:00": "Europe/Moscow",
      "UTC+03:30": "Asia/Tehran",
      "UTC+04:00": "Asia/Dubai",
      "UTC+04:30": "Asia/Kabul",
      "UTC+05:00": "Asia/Karachi",
      "UTC+05:30": "Asia/Kolkata",
      "UTC+05:45": "Asia/Kathmandu",
      "UTC+06:00": "Asia/Dhaka",
      "UTC+06:30": "Asia/Yangon",
      "UTC+07:00": "Asia/Bangkok",
      "UTC+08:00": "Asia/Shanghai",
      "UTC+09:00": "Asia/Tokyo",
      "UTC+09:30": "Australia/Adelaide",
      "UTC+10:00": "Australia/Sydney",
      "UTC+11:00": "Pacific/Noumea",
      "UTC+12:00": "Pacific/Auckland",
      "UTC+13:00": "Pacific/Tongatapu",
      "UTC+14:00": "Pacific/Kiritimati"
    };
    return timezoneMap[offset] || "Asia/Kathmandu"; // Default to Nepal timezone
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.date || !formData.time || !formData.latitude || !formData.longitude) {
        throw new Error("Please fill in all required fields");
      }

      // Format date as YYYY-MM-DD
      const dateStr = formData.date.toISOString().split('T')[0];
      
      // Convert timezone to IANA format
      const tzName = convertTimezoneToIANA(formData.timezone);

      // Build API URL with query parameters
      const params = new URLSearchParams({
        calendar: formData.isBS ? 'bs' : 'ad',
        date: dateStr,
        time: formData.time,
        lat: formData.latitude.toString(),
        lon: formData.longitude.toString(),
        tz: tzName,
        lang: formData.language === 'english' ? 'en' : 'ne',
        chart_img: 'false', // We'll handle charts separately if needed
      });

      // Make API call to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/kundali?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setKundaliData(data);
      setIsSubmitted(true);
      
      console.log("Kundali data received:", data);
    } catch (err) {
      console.error("Error generating Kundali:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          {/* Personal Information */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-xl font-semibold">
              <BookOpen className="mr-2 h-5 w-5 text-amber-500" />
              Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Birth Date and Time */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-xl font-semibold">
              <CalendarIcon className="mr-2 h-5 w-5 text-amber-500" />
              Birth Date and Time
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Date of Birth</Label>
                  <div className="space-y-3">
                    <EnhancedDatePicker
                      date={formData.date}
                      onDateChange={(date: Date | undefined) => handleInputChange("date", date)}
                      placeholder="Select your birth date"
                      isBS={formData.isBS}
                    />
                    <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <div className="text-sm">
                          <span className="font-medium text-amber-800 dark:text-amber-200">
                            Calendar Type: 
                          </span>
                          <span className="ml-1 text-amber-700 dark:text-amber-300">
                            {formData.isBS ? "Bikram Sambat (BS)" : "Gregorian (AD)"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="calendar-type" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                          {formData.isBS ? "BS" : "AD"}
                        </Label>
                        <Switch
                          id="calendar-type"
                          checked={formData.isBS}
                          onCheckedChange={(checked: boolean) =>
                            handleInputChange("isBS", checked)
                          }
                        />
                      </div>
                    </div>
                    {formData.isBS && (
                      <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          <strong>Note:</strong> Bikram Sambat is the traditional Nepali calendar system. 
                          The date you enter will be converted automatically for astrological calculations.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="time" className="text-sm font-medium">Time of Birth</Label>
                  <div className="space-y-3">
                    <TimePicker
                      value={formData.time}
                      onChange={(time) => handleInputChange("time", time)}
                    />
                    <div className="rounded-md bg-green-50 p-3 dark:bg-green-950/20">
                      <p className="text-xs text-green-700 dark:text-green-300">
                        <strong>Tip:</strong> Enter the exact time of birth if known. 
                        If unknown, 6:00 AM is commonly used as a default for astrological calculations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Birth Location */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-xl font-semibold">
              <MapPin className="mr-2 h-5 w-5 text-amber-500" />
              Birth Location
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="place">Place of Birth</Label>
                <Input
                  id="place"
                  placeholder="Search for a city or location using the map below"
                  value={formData.place}
                  onChange={(e) => handleInputChange("place", e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the interactive map below to search and select your exact birth location
                </p>
              </div>

              {/* Map for location selection */}
              <LocationMap
                latitude={formData.latitude}
                longitude={formData.longitude}
                place={formData.place}
                onLocationChange={(location) => {
                  setFormData(prev => ({
                    ...prev,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    place: location.place
                  }));
                }}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    placeholder="e.g., 27.7172"
                    value={formData.latitude}
                    onChange={(e) =>
                      handleInputChange("latitude", e.target.value)
                    }
                    required
                    className="font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-filled from map selection
                  </p>
                </div>

                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    placeholder="e.g., 85.3240"
                    value={formData.longitude}
                    onChange={(e) =>
                      handleInputChange("longitude", e.target.value)
                    }
                    required
                    className="font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-filled from map selection
                  </p>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value: string) =>
                      handleInputChange("timezone", value)
                    }
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Output Options */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-xl font-semibold">
              <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
              Output Options
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="language">Output Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value: string) =>
                    handleInputChange("language", value)
                  }
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="nepali">Nepali</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="show-chart"
                  checked={formData.showChart}
                  onCheckedChange={(checked: boolean) =>
                    handleInputChange("showChart", checked)
                  }
                />
                <Label htmlFor="show-chart">Show Kundali Chart</Label>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50"
          size="lg"
        >
          {isLoading ? "Generating..." : "Generate Kundali"}
        </Button>
      </form>

      {isSubmitted && kundaliData && (
        <div className="mt-12">
          <KundaliResults formData={formData} kundaliData={kundaliData} />
        </div>
      )}
    </div>
  );
};

export default KundaliForm;