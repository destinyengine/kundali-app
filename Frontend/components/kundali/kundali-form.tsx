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
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main content area with side-by-side layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Personal Info & Birth Date/Time */}
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center text-lg font-semibold">
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
                  className="mt-1"
                />
              </div>
            </div>

            {/* Birth Date and Time */}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center text-lg font-semibold">
                <CalendarIcon className="mr-2 h-4 w-4 text-amber-500" />
                Birth Date and Time
              </h2>
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Date of Birth</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <EnhancedDatePicker
                        date={formData.date}
                        onDateChange={(date: Date | undefined) => handleInputChange("date", date)}
                        placeholder="Select your birth date"
                        isBS={formData.isBS}
                      />
                    </div>
                    <div className="flex items-center space-x-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 dark:border-amber-800 dark:bg-amber-950/20">
                      <Label htmlFor="calendar-type" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Calendar Type
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="text-sm font-medium">Time of Birth</Label>
                  <TimePicker
                    value={formData.time}
                    onChange={(time) => handleInputChange("time", time)}
                  />
                  <div className="rounded-md bg-green-50 p-2 dark:bg-green-950/20">
                    <p className="text-xs text-green-700 dark:text-green-300">
                      <strong>Tip:</strong> Enter the exact time of birth if known. 
                      If unknown, 6:00 AM is commonly used as a default for astrological calculations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Birth Location */}
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center text-lg font-semibold">
              <MapPin className="mr-2 h-4 w-4 text-amber-500" />
              Birth Location
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="place" className="text-sm">Search Location</Label>
                <Input
                  id="place"
                  placeholder="Search for a city, landmark, or address..."
                  value={formData.place}
                  onChange={(e) => handleInputChange("place", e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              {/* Compact Map */}
              <div className="h-[250px]">
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

              {/* Location Details in a compact grid */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Place of Birth</div>
                <div className="text-xs text-muted-foreground mb-2">
                  Search for a city/location using the map below
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="latitude" className="text-xs">Latitude</Label>
                    <Input
                      id="latitude"
                      placeholder="e.g., 27.7172"
                      value={formData.latitude}
                      onChange={(e) =>
                        handleInputChange("latitude", e.target.value)
                      }
                      required
                      className="font-mono text-xs h-8"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auto-filled from map selection
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="longitude" className="text-xs">Longitude</Label>
                    <Input
                      id="longitude"
                      placeholder="e.g., 85.3240"
                      value={formData.longitude}
                      onChange={(e) =>
                        handleInputChange("longitude", e.target.value)
                      }
                      required
                      className="font-mono text-xs h-8"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Auto-filled from map selection
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="timezone" className="text-xs">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value: string) =>
                      handleInputChange("timezone", value)
                    }
                  >
                    <SelectTrigger id="timezone" className="h-8 text-xs">
                      <SelectValue placeholder="UTC+05:45" />
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

              {/* Map Tips */}
              <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  • Search for your birth location using the search box above - Click anywhere on the map to set your exact birth location 
                  • Use the crosshair button to get your current location. The coordinates will be automatically filled in the form.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Output Options - Full width at bottom */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="flex items-center text-lg font-semibold">
                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                Output Options :
              </h2>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="language" className="text-sm">Language</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value: string) =>
                    handleInputChange("language", value)
                  }
                >
                  <SelectTrigger id="language" className="w-32 h-8">
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
                <Label htmlFor="show-chart" className="text-sm">Show Kundali Chart</Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50 px-8"
              size="lg"
            >
              {isLoading ? "Generating..." : "Generate Kundali"}
            </Button>
          </div>
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