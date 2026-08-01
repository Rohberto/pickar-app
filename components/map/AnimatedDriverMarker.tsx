// components/map/AnimatedDriverMarker.tsx
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

interface Coord {
  latitude: number;
  longitude: number;
}

interface AnimatedDriverMarkerProps {
  latitude: number;
  longitude: number;
  vehicleType?: 'bike' | 'truck';
  /** How long to glide toward each new ping — should be a bit under your poll interval. */
  duration?: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Compass bearing (0–360, 0 = north) from point a to point b.
function bearingBetween(a: Coord, b: Coord) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Same illustrated assets already used on the "Send a package" /
// "Move house loads" service cards.
const BIKE_SRC = require('@/assets/images/bike.png');
const TRUCK_SRC = require('@/assets/images/bus.png');

// Both are side-view/angled renders, not top-down icons, so they can't
// rotate through 360° convincingly — instead we mirror left/right
// based on travel direction, same trick most delivery apps use for
// illustrated (non-top-down) vehicle art.
//
// ASSUMPTION: the source art faces right by default. If it looks like
// it's driving backwards on your device, flip this one constant.
const ART_FACES_RIGHT = true;

/**
 * Same reasoning as LiveLocationMarker: NOT using AnimatedRegion /
 * Marker.Animated — unreliable under Expo's New Architecture. Position
 * glides manually via rAF; tracksViewChanges toggles on only while moving.
 */
export default function AnimatedDriverMarker({
  latitude,
  longitude,
  vehicleType = 'bike',
  duration = 3600,
}: AnimatedDriverMarkerProps) {
  const [displayCoord, setDisplayCoord] = useState<Coord>({ latitude, longitude });
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const [facingRight, setFacingRight] = useState(ART_FACES_RIGHT);

  const displayCoordRef = useRef<Coord>({ latitude, longitude });
  const lastTargetRef = useRef<Coord>({ latitude, longitude });
  const firstRef = useRef(true);

  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpTracksViewChanges = () => {
    setTracksViewChanges(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setTracksViewChanges(false), 250);
  };

  useEffect(() => {
    const target: Coord = { latitude, longitude };

    if (firstRef.current) {
      firstRef.current = false;
      displayCoordRef.current = target;
      setDisplayCoord(target);
      lastTargetRef.current = target;
      return;
    }

    // Ignore GPS jitter (sub-meter noise) so the bike doesn't twitch in place
    const dLat = target.latitude - lastTargetRef.current.latitude;
    const dLon = target.longitude - lastTargetRef.current.longitude;
    const moved = Math.abs(dLat) > 0.000005 || Math.abs(dLon) > 0.000005;

    if (moved) {
      const bearing = bearingBetween(lastTargetRef.current, target);
      const eastwardComponent = Math.sin((bearing * Math.PI) / 180);
      // Ignore near-vertical movement (straight up/down the screen) so
      // the icon doesn't flip erratically — just keep its last facing.
      if (Math.abs(eastwardComponent) > 0.2) {
        const movingEast = eastwardComponent >= 0;
        setFacingRight(ART_FACES_RIGHT ? movingEast : !movingEast);
      }
      lastTargetRef.current = target;
    }

    const start = { ...displayCoordRef.current };
    const startTime = Date.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const next = {
        latitude: lerp(start.latitude, target.latitude, t),
        longitude: lerp(start.longitude, target.longitude, t),
      };
      displayCoordRef.current = next;
      setDisplayCoord(next);
      bumpTracksViewChanges();
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    []
  );

  const isTruck = vehicleType === 'truck';

  return (
    <Marker
      coordinate={displayCoord}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      tracksViewChanges={tracksViewChanges}
    >
      <View
        style={[
          styles.shadowWrap,
          isTruck ? styles.truckBox : styles.bikeBox,
          { transform: [{ scaleX: facingRight ? 1 : -1 }] },
        ]}
      >
        <Image
          source={isTruck ? TRUCK_SRC : BIKE_SRC}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  bikeBox: { width: 34, height: 44 },
  truckBox: { width: 46, height: 36 },
  image: { width: '100%', height: '100%' },
});