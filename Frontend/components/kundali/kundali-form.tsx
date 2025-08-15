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
import { ModernToggle } from "@/components/ui/modern-toggle";

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
import { ContinueModal } from "@/components/kundali/continue-modal";

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
  const [showContinueModal, setShowContinueModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

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
    setError(null);

    try {
      // Validate required fields
      if (!formData.date || !formData.time || !formData.latitude || !formData.longitude) {
        throw new Error("Please fill in all required fields");
      }

      // Store form data and show modal
      setPendingFormData(formData);
      setShowContinueModal(true);
      
    } catch (err) {
      console.error("Form validation error:", err);
      setError(err instanceof Error ? err.message : "Please check your form data");
    }
  };

  const handleContinueWithKundali = async (method: 'wallet' | 'guest') => {
    if (!pendingFormData) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Format date as YYYY-MM-DD
      const dateStr = pendingFormData.date.toISOString().split('T')[0];
      
      // Convert timezone to IANA format
      const tzName = convertTimezoneToIANA(pendingFormData.timezone);

      // Build API URL with query parameters
      const params = new URLSearchParams({
        calendar: pendingFormData.isBS ? 'bs' : 'ad',
        date: dateStr,
        time: pendingFormData.time,
        lat: pendingFormData.latitude.toString(),
        lon: pendingFormData.longitude.toString(),
        tz: tzName,
        lang: pendingFormData.language === 'english' ? 'en' : 'ne',
        chart_img: 'false', // We'll handle charts separately if needed
        auth_method: method, // Track how user chose to continue
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
      setPendingFormData(null);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Main content area with responsive layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          {/* Left Column - Personal Info & Birth Date/Time */}
          <div className="space-y-4 md:space-y-6">
            {/* Personal Information */}
            <div className="rounded-lg border bg-card p-3 md:p-4 shadow-sm">
              <h2 className="mb-3 flex items-center text-base md:text-lg font-semibold">
                <BookOpen className="mr-2 h-4 w-4 text-amber-500" />
                Personal Information
              </h2>
              <div>
                <Label htmlFor="name" className="text-sm">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  className="mt-1 h-10 md:h-11"
                />
              </div>
            </div>

            {/* Birth Date and Time */}
            <div className="rounded-lg border bg-card p-3 md:p-4 shadow-sm">
              <h2 className="mb-3 flex items-center text-base md:text-lg font-semibold">
                <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                Birth Date and Time
              </h2>
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Date of Birth</Label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                    <div className="flex-1">
                      <EnhancedDatePicker
                        date={formData.date}
                        onDateChange={(date: Date | undefined) => handleInputChange("date", date)}
                        placeholder="Select your birth date"
                        isBS={formData.isBS}
                      />
                    </div>
                    <div className="flex items-center justify-center sm:justify-start">
                      <ModernToggle
                        checked={formData.isBS}
                        onCheckedChange={(checked: boolean) =>
                          handleInputChange("isBS", checked)
                        }
                        leftLabel="AD"
                        rightLabel="BS"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium">Time of Birth</Label>
                  <TimePicker
                    value={formData.time}
                    onChange={(time) => handleInputChange("time", time)}
                  />
                </div>
              </div>
            </div>

            {/* Output Options */}
            <div className="rounded-lg border bg-card p-3 md:p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="flex items-center text-base md:text-lg font-semibold">
                  <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                  Output Options :
                </h2>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="language" className="text-sm whitespace-nowrap">Language</Label>
                    <Select
                      value={formData.language}
                      onValueChange={(value: string) =>
                        handleInputChange("language", value)
                      }
                    >
                      <SelectTrigger id="language" className="w-24 sm:w-32 h-8">
                        <SelectValue placeholder="Language" />
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
                    <Label htmlFor="show-chart" className="text-sm whitespace-nowrap">Show Kundali Chart</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Birth Location */}
          <div className="rounded-lg border bg-card p-3 md:p-4 shadow-sm h-fit">
            <h2 className="mb-3 flex items-center text-base md:text-lg font-semibold">
              <MapPin className="mr-2 h-4 w-4 text-amber-500" />
              Birth Location
            </h2>
            <div>
              {/* Responsive Map */}
              <div className="h-[362px] sm:h-[412px] md:h-[462px] lg:h-[482px] xl:h-[442px] rounded-lg overflow-hidden">
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
              </div>
            </div>
          </div>
        </div>

        {/* Centered Generate Button */}
        <div className="flex justify-center pt-4 md:pt-6">
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 px-8 md:px-12 py-3 text-base md:text-lg font-semibold"
            size="lg"
          >
            {isLoading ? "Generating..." : "Generate Kundali"}
          </Button>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </form>

      {isSubmitted && kundaliData && (
        <div className="mt-8">
          <KundaliResults formData={formData} kundaliData={kundaliData} />
        </div>
      )}

      <ContinueModal
        open={showContinueModal}
        onOpenChange={setShowContinueModal}
        onContinue={handleContinueWithKundali}
      />
    </div>
  );
};

export default KundaliForm;