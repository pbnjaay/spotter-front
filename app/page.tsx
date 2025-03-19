"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ELDLog, Location } from "@/types";
import axios from "axios";
import debounce from "lodash/debounce";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });
const DailyLogSheet = dynamic(() => import("@/components/DailyLogSheet"), { ssr: false });

interface LocationSuggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface Stop {
  location: Location;
  stop_type: 'PICKUP' | 'DROPOFF' | 'FUEL' | 'REST';
  sequence: number;
  planned_arrival?: string;
  planned_departure?: string;
}

export default function Home() {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<Location | null>(null);
  const [cycleHours, setCycleHours] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [tripStops, setTripStops] = useState<Stop[]>([]);
  const [eldLogs, setEldLogs] = useState<ELDLog[]>([]);
  const [tripId, setTripId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>('map');
  const [searchText, setSearchText] = useState({
    current: "",
    pickup: "",
    dropoff: "",
  });
  const [activeInput, setActiveInput] = useState<"current" | "pickup" | "dropoff" | null>(null);

  const debouncedSearch = useCallback((query: string) => {
    const searchFn = async (query: string) => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        setSuggestions(response.data);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };
    
    const debouncedFn = debounce(searchFn, 300);
    debouncedFn(query);
    
    return () => {
      debouncedFn.cancel();
    };
  }, []);

  const handleInputChange = (value: string, type: "current" | "pickup" | "dropoff") => {
    setSearchText(prev => ({ ...prev, [type]: value }));
    setActiveInput(type);
    debouncedSearch(value);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    const location: Location = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
      address: suggestion.display_name,
    };

    switch (activeInput) {
      case "current":
        setCurrentLocation(location);
        setSearchText(prev => ({ ...prev, current: suggestion.display_name }));
        break;
      case "pickup":
        setPickupLocation(location);
        setSearchText(prev => ({ ...prev, pickup: suggestion.display_name }));
        break;
      case "dropoff":
        setDropoffLocation(location);
        setSearchText(prev => ({ ...prev, dropoff: suggestion.display_name }));
        break;
    }

    setSuggestions([]);
    setActiveInput(null);
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await axios.get(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const location: Location = {
              lat: latitude,
              lng: longitude,
              address: response.data.display_name,
            };
            setCurrentLocation(location);
            setSearchText(prev => ({ ...prev, current: response.data.display_name }));
          } catch (error) {
            console.error("Error getting address:", error);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const handleSubmit = async () => {
    if (!currentLocation || !pickupLocation || !dropoffLocation) {
      alert("Please fill in all locations");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_TRIP_API_URL}/api/trips/`, {
        current_location: {
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        },
        pickup_location: {
          lat: pickupLocation.lat,
          lng: pickupLocation.lng,
        },
        dropoff_location: {
          lat: dropoffLocation.lat,
          lng: dropoffLocation.lng,
        },
        current_cycle_hours: cycleHours,
      });
      
      console.log("Trip created:", response.data);
      
      const stops = response.data.stops.map((stop: Stop) => ({
                              ...stop,
                              location: {
                                lat: stop.location.lat,
                                lng: stop.location.lng,
                                address: `${stop.stop_type} Stop`
                              },
                              planned_arrival: stop.planned_arrival,
                              planned_departure: stop.planned_departure
                            }));

      console.log("stops PAGES", stops);
      setTripStops(stops);
      
      if (response.data.eld_logs) {
        setEldLogs(response.data.eld_logs);
      }
      
      setTripId(response.data.id);
    } catch (error) {
      console.error("Error creating trip:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h1 className="text-2xl font-bold mb-6">Trip Planner</h1>
          
          <div className="space-y-2 relative">
            <Label htmlFor="current-location">Current Location</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="current-location"
                  type="text"
                  value={searchText.current}
                  onChange={(e) => handleInputChange(e.target.value, "current")}
                  onFocus={() => setActiveInput("current")}
                  placeholder="Enter current location"
                  className="w-full"
                />
                {activeInput === "current" && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white mt-1 border rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((suggestion) => (
                      <div
                        key={suggestion.place_id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                onClick={getCurrentLocation}
                variant="default"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="pickup-location">Pickup Location</Label>
            <div className="relative">
              <Input
                id="pickup-location"
                type="text"
                value={searchText.pickup}
                onChange={(e) => handleInputChange(e.target.value, "pickup")}
                onFocus={() => setActiveInput("pickup")}
                placeholder="Enter pickup location"
                className="w-full"
              />
              {activeInput === "pickup" && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white mt-1 border rounded-md shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.place_id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="dropoff-location">Dropoff Location</Label>
            <div className="relative">
              <Input
                id="dropoff-location"
                type="text"
                value={searchText.dropoff}
                onChange={(e) => handleInputChange(e.target.value, "dropoff")}
                onFocus={() => setActiveInput("dropoff")}
                placeholder="Enter dropoff location"
                className="w-full"
              />
              {activeInput === "dropoff" && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white mt-1 border rounded-md shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.place_id}
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cycle-hours">Current Cycle Hours</Label>
            <Input
              id="cycle-hours"
              type="number"
              value={cycleHours}
              onChange={(e) => setCycleHours(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant="default"
            className="w-full"
          >
            {loading ? "Processing..." : "Plan Trip"}
          </Button>
        </div>

        <div className="lg:col-span-2 h-[700px] bg-gray-100 rounded">
          {tripId && eldLogs.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="map">Map View</TabsTrigger>
                <TabsTrigger value="logs">Daily Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="map" className="h-[650px]">
                <div className="h-full">
                  <Map
                    currentLocation={currentLocation}
                    pickupLocation={pickupLocation}
                    dropoffLocation={dropoffLocation}
                    stops={tripStops}
                  />
                </div>
              </TabsContent>
              <TabsContent value="logs" className="h-[650px]">
                <div className="h-full overflow-auto">
                  <DailyLogSheet 
                    logs={eldLogs} 
                    tripId={tripId} 
                  />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="h-full">
              <Map
                currentLocation={currentLocation}
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                stops={tripStops}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
