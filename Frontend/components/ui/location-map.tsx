"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import { LatLngExpression, LeafletMouseEvent } from "leaflet";
import { Search, MapPin, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

// Fix for default markers in React Leaflet
import L from "leaflet";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationMapProps {
  latitude: string;
  longitude: string;
  place: string;
  onLocationChange: (location: {
    latitude: string;
    longitude: string;
    place: string;
  }) => void;
  className?: string;
  modalOpen?: boolean; // New prop to handle modal state
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e: LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationMap({
  latitude,
  longitude,
  place,
  onLocationChange,
  className
}: LocationMapProps) {
  const [searchQuery, setSearchQuery] = useState(place);
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<LatLngExpression>([
    parseFloat(latitude) || 39.9526, // Default to Philadelphia, USA
    parseFloat(longitude) || -75.1652
  ]);

  const mapRef = useRef<any>(null);

  // Update position when props change
  useEffect(() => {
    if (latitude && longitude) {
      const newPosition: LatLngExpression = [parseFloat(latitude), parseFloat(longitude)];
      setPosition(newPosition);
      if (mapRef.current) {
        mapRef.current.setView(newPosition, 13);
      }
    }
  }, [latitude, longitude]);

  // Handle map click
  const handleMapClick = async (lat: number, lng: number) => {
    const newPosition: LatLngExpression = [lat, lng];
    setPosition(newPosition);
    
    // Update parent component
    onLocationChange({
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
      place: searchQuery || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    });

    // Try to get place name from coordinates (reverse geocoding)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await response.json();
      if (data.display_name) {
        const placeName = data.display_name.split(',').slice(0, 3).join(', ');
        setSearchQuery(placeName);
        onLocationChange({
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          place: placeName
        });
      }
    } catch (error) {
      console.error("Error getting place name:", error);
    }
  };

  // Search for location
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        const newPosition: LatLngExpression = [lat, lng];
        
        setPosition(newPosition);
        if (mapRef.current) {
          mapRef.current.setView(newPosition, 13);
        }
        
        onLocationChange({
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
          place: result.display_name.split(',').slice(0, 3).join(', ')
        });
      }
    } catch (error) {
      console.error("Error searching location:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Get user's current location
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          handleMapClick(lat, lng);
        },
        (error) => {
          console.error("Error getting current location:", error);
          alert("Unable to get your current location. Please search for your location or click on the map.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Controls */}
      <div className="space-y-3">
        <Label htmlFor="location-search">Search Location</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="location-search"
              placeholder="Search for a city, landmark, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            variant="outline"
            className="shrink-0"
          >
            {isSearching ? "Searching..." : "Search"}
          </Button>
          <Button
            type="button"
            onClick={handleGetCurrentLocation}
            variant="outline"
            size="icon"
            className="shrink-0"
            title="Use current location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[300px] w-full overflow-hidden rounded-lg border">
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>
              <div className="text-center">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Birth Location</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Array.isArray(position) ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Location'}
                </div>
              </div>
            </Popup>
          </Marker>
          <MapClickHandler onMapClick={handleMapClick} />
        </MapContainer>
      </div>
    </div>
  );
}
