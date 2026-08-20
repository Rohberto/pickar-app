// Mirrors the ride types a user can choose from (see backend
// config/rideTypes.js) — used here so a driver can register under one of
// the real, user-facing service tiers instead of a generic "bike/truck"
// choice. Keep labels/descriptions in sync with the backend if those
// ever change.
export type RideTypeKey = 'standard' | 'eco_send' | 'express' | 'truck';

export interface RideTypeOption {
  type: RideTypeKey;
  label: string;
  description: string;
  vehicleClass: 'bike' | 'truck';
  icon: any;
}

export const DRIVER_RIDE_TYPES: RideTypeOption[] = [
  {
    type: 'standard',
    label: 'Standard',
    description: 'Regular bike deliveries around the city',
    vehicleClass: 'bike',
    icon: require('@/assets/images/standard.png'),
  },
  {
    type: 'eco_send',
    label: 'Eco Send',
    description: 'Budget-friendly, scheduled/grouped deliveries',
    vehicleClass: 'bike',
    icon: require('@/assets/images/eco_send.png'),
  },
  {
    type: 'express',
    label: 'Express',
    description: 'Fast, priority deliveries — higher payout',
    vehicleClass: 'bike',
    icon: require('@/assets/images/express.png'),
  },
  {
    type: 'truck',
    label: 'Truck',
    description: 'House loads and large items',
    vehicleClass: 'truck',
    icon: require('@/assets/images/bus.png'),
  },
];
