"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import debounce from "lodash/debounce";
import { Button } from "@/components/ui/button";
import { ELDLog, Location } from "@/types";

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
  const [activeTab, setActiveTab] = useState<'map' | 'logs'>('map');
  const [searchText, setSearchText] = useState({
    current: "",
    pickup: "",
    dropoff: "",
  });
  const [activeInput, setActiveInput] = useState<"current" | "pickup" | "dropoff" | null>(null);

  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }

      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        setSuggestions(response.data);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      }
    }, 300),
    []
  );

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
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h1 className="text-2xl font-bold mb-6">Trip Planner</h1>
          
          <div className="space-y-2 relative">
            <label className="block">Current Location</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  placeholder="Enter current location"
                  value={searchText.current}
                  onChange={(e) => handleInputChange(e.target.value, "current")}
                  onFocus={() => setActiveInput("current")}
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
            <label className="block">Pickup Location</label>
            <div className="relative">
              <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Enter pickup location"
                value={searchText.pickup}
                onChange={(e) => handleInputChange(e.target.value, "pickup")}
                onFocus={() => setActiveInput("pickup")}
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
            <label className="block">Dropoff Location</label>
            <div className="relative">
              <input
                type="text"
                className="w-full p-2 border rounded"
                placeholder="Enter dropoff location"
                value={searchText.dropoff}
                onChange={(e) => handleInputChange(e.target.value, "dropoff")}
                onFocus={() => setActiveInput("dropoff")}
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
            <label className="block">Current Cycle Hours</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={cycleHours}
              onChange={(e) => setCycleHours(Number(e.target.value))}
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

        <div className="h-[600px] bg-gray-100 rounded">
          {tripId && eldLogs.length > 0 && (
            <div className="mb-4 flex border-b">
              <button 
                className={`px-4 py-2 ${activeTab === 'map' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
                onClick={() => setActiveTab('map')}
              >
                Map View
              </button>
              <button 
                className={`px-4 py-2 ${activeTab === 'logs' ? 'border-b-2 border-blue-500 font-medium' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                Daily Logs
              </button>
            </div>
          )}
          
          {activeTab === 'map' ? (
            <Map
              currentLocation={currentLocation}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              stops={tripStops}
            />
          ) : tripId && eldLogs.length > 0 ? (
            <div className="h-full overflow-auto">
              <DailyLogSheet logs={eldLogs} tripId={tripId} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
