// components/map/NearbyDriversLayer.tsx
import api from '@/services/api';
import { useEffect, useRef, useState } from 'react';
import AnimatedDriverMarker from './AnimatedDriverMarker';

interface NearbyDriver {
  _id: string;
  name?: string;
  vehicle?: { type?: 'bike' | 'truck' };
  location: { coordinates: [number, number] }; // [lng, lat] — GeoJSON order
}

interface DriverPosition {
  latitude: number;
  longitude: number;
  vehicleType: 'bike' | 'truck';
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  rideType?: 'bike' | 'truck';
  pollIntervalMs?: number;
}

/**
 * Shows nearby online drivers as small moving bike markers, like
 * Uber/Bolt's home screen. Hits the existing GET /drivers/nearby
 * endpoint on an interval; each marker animates itself (see
 * AnimatedDriverMarker) rather than relying on AnimatedRegion.
 *
 * NOTE: /drivers/nearby currently filters to bike XOR truck, never
 * both — see driverController.getNearbyDrivers. Fine for the main
 * Send a Package flow; ping me if you want both vehicle types visible
 * at once, it's a small backend tweak.
 */
export default function NearbyDriversLayer({
  userLocation,
  rideType = 'bike',
  pollIntervalMs = 4000,
}: Props) {
  const [drivers, setDrivers] = useState<Record<string, DriverPosition>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userLocation) return;

    const poll = async () => {
      try {
        const { data } = await api.get('/drivers/nearby', {
          params: { lat: userLocation.latitude, lng: userLocation.longitude, rideType },
        });
        if (!data?.success) return;

        const list: NearbyDriver[] = data.data ?? [];
        const next: Record<string, DriverPosition> = {};

        list.forEach((d) => {
          if (!d.location?.coordinates) return;
          const [lng, lat] = d.location.coordinates;
          next[d._id] = {
            latitude: lat,
            longitude: lng,
            vehicleType: d.vehicle?.type ?? rideType,
          };
        });

        setDrivers(next);
      } catch {
        // Nearby drivers are decorative — fail silently, don't disrupt the map
      }
    };

    poll();
    intervalRef.current = setInterval(poll, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [userLocation?.latitude, userLocation?.longitude, rideType, pollIntervalMs]);

  return (
    <>
      {Object.entries(drivers).map(([id, d]) => (
        <AnimatedDriverMarker
          key={id}
          latitude={d.latitude}
          longitude={d.longitude}
          vehicleType={d.vehicleType}
          duration={pollIntervalMs * 0.9}
        />
      ))}
    </>
  );
}