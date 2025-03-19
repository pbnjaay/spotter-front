export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface ELDLog {
  id: number;
  trip: number;
  start_time: string;
  end_time: string;
  duty_status: 'OFF' | 'SB' | 'D' | 'ON'; // Off Duty, Sleeper Berth, Driving, On Duty Not Driving
  location: Location;
  remarks: string;
}

export const DUTY_STATUS_LABELS = {
  'OFF': 'Off Duty',
  'SB': 'Sleeper Berth',
  'D': 'Driving',
  'ON': 'On Duty Not Driving'
};

export const DUTY_STATUS_COLORS = {
  'OFF': '#f3f4f6', // gray-100
  'SB': '#dbeafe', // blue-100
  'D': '#dcfce7', // green-100
  'ON': '#fee2e2'  // red-100
};
