"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Stop } from "../app/page";
import { format } from 'date-fns';
import { calculateDistance, formatDuration } from "@/lib/utils";
import { Location } from "@/types";

interface MapProps {
  currentLocation: Location | null;
  pickupLocation: Location | null;
  dropoffLocation: Location | null;
  stops?: Stop[];
}

export default function Map({ currentLocation, pickupLocation, dropoffLocation, stops = [] }: MapProps) {
  useEffect(() => {
    const map = L.map("map").setView([0, 0], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: 'spotter'
    }).addTo(map);

    const markers: L.Marker[] = [];
    const polylines: L.Polyline[] = [];

    const currentLocationIcon = L.divIcon({
      html: `<div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
      </div>`,
      className: 'custom-div-icon'
    });

    if (currentLocation) {
      markers.push(
        L.marker([currentLocation.lat, currentLocation.lng], { icon: currentLocationIcon })
          .addTo(map)
          .bindPopup(`
            <div class="font-sans p-1">
              <strong>Current Location</strong><br/>
              ${currentLocation.address}
            </div>
          `)
      );
    }

    const pickupIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
      </div>`,
      className: 'custom-div-icon'
    });

    const dropoffIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
        </svg>
      </div>`,
      className: 'custom-div-icon'
    });

    const fuelIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.5A2.5 2.5 0 014.5 2h11a2.5 2.5 0 012.5 2.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 4a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11z" />
          <path d="M8 8a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1H9a1 1 0 01-1-1V8z" />
          <path d="M9 7a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1V8a1 1 0 00-1-1H9z" />
        </svg>
      </div>`,
      className: 'custom-div-icon'
    });

    const restIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
        </svg>
      </div>`,
      className: 'custom-div-icon'
    });
      
    const sortedStops = [...stops].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    
    sortedStops.forEach((stop, index) => {
      if (!stop.location || typeof stop.location.lat !== 'number' || typeof stop.location.lng !== 'number') {
        console.warn("Invalid stop location:", stop);
        return;
      }

      let icon;
      let typeLabel = '';
      
      switch (stop.stop_type) {
        case 'FUEL':
          icon = fuelIcon;
          typeLabel = 'Fuel Stop';
          break;
        case 'REST':
          icon = restIcon;
          typeLabel = 'Rest Stop';
          break;
        case 'PICKUP':
          icon = pickupIcon;
          typeLabel = 'Pickup Stop';
          break;
        case 'DROPOFF':
          icon = dropoffIcon;
          typeLabel = 'Dropoff Stop';
          break;
        default:
          icon = L.divIcon({
            html: `<div class="w-6 h-6 bg-yellow-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <span class="text-xs text-white font-bold">${stop.sequence || '?'}</span>
            </div>`,
            className: 'custom-div-icon'
          });
          typeLabel = `Stop #${stop.sequence || '?'}`;
      }
      
      let distanceFromPrevious = '';
      if (index > 0) {
        const prevStop = sortedStops[index - 1];
        const distance = calculateDistance(
          [stop.location.lat, stop.location.lng],
          [prevStop.location.lat, prevStop.location.lng]
        );
        distanceFromPrevious = `<div class="text-sm mt-1">
          <strong>Distance from previous:</strong> ${distance} miles
        </div>`;
      } else if (currentLocation) {
        const distance = calculateDistance(
          [stop.location.lat, stop.location.lng],
          [currentLocation.lat, currentLocation.lng]
        );
        distanceFromPrevious = `<div class="text-sm mt-1">
          <strong>Distance from start:</strong> ${distance} miles
        </div>`;
      }
      
      let timeInfo = '';
      if (stop.planned_arrival && stop.planned_departure) {
        const arrivalTime = format(new Date(stop.planned_arrival), 'MMM d, h:mm a');
        const departureTime = format(new Date(stop.planned_departure), 'MMM d, h:mm a');
        const duration = formatDuration(stop.planned_arrival, stop.planned_departure);
        
        timeInfo = `<div class="text-sm mt-1">
          <strong>Arrival:</strong> ${arrivalTime}<br>
          <strong>Departure:</strong> ${departureTime}<br>
          <strong>Duration:</strong> ${duration}
        </div>`;
      }
      
      markers.push(
        L.marker([stop.location.lat, stop.location.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div class="font-sans p-2">
              <strong>${typeLabel}</strong><br/>
              ${stop.location.address || 'No address available'}
              ${distanceFromPrevious}
              ${timeInfo}
            </div>
          `)
      );

      if (index < sortedStops.length - 1) {
        const nextStop = sortedStops[index + 1];
        
        const routeLine = L.polyline(
          [[stop.location.lat, stop.location.lng], [nextStop.location.lat, nextStop.location.lng]],
          { color: 'blue', weight: 3 }
        ).addTo(map);
        
        polylines.push(routeLine);
      }
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    if (currentLocation && sortedStops.length > 0) {
      // Create an array of LatLngExpression objects
      const stopPoints = sortedStops.map(stop => 
        [stop.location.lat, stop.location.lng] as L.LatLngTuple
      );
      
      polylines.push(
        L.polyline(
          [[currentLocation.lat, currentLocation.lng] as L.LatLngTuple, ...stopPoints],
          { color: 'blue', weight: 3 }
        ).addTo(map)
      );
    }

    return () => {
      map.remove();
    };
  }, [currentLocation, pickupLocation, dropoffLocation, stops]);

  return <div id="map" className="w-full h-full rounded" />;
}
