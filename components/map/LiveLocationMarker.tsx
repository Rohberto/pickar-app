// components/map/LiveLocationMarker.tsx
import { Colors } from '@/constants/colors';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Defs, Path, RadialGradient, Stop } from 'react-native-svg';

interface LiveLocationMarkerProps {
  onLocationChange?: (coords: { latitude: number; longitude: number }) => void;
  size?: number;
  /** Half-angle of the beam in degrees. Google's cone is ~50°, giving a ~100° total spread. */
  beamHalfAngle?: number;
}

function polarPoint(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A "blue dot" marker like Google Maps / Uber.
 *
 * IMPORTANT IMPLEMENTATION NOTE: this deliberately does NOT use
 * react-native-maps' AnimatedRegion / Marker.Animated. That combo is
 * unreliable on Expo's New Architecture (Fabric) — it paints once and
 * then silently stops updating, which is exactly the "dot doesn't move,
 * beam doesn't rotate" symptom. Instead:
 *  - position is interpolated manually frame-by-frame in JS (rAF) and
 *    fed into a plain <Marker coordinate={...}>
 *  - tracksViewChanges is toggled ON only during active animation
 *    bursts (position glide or heading rotation), so the native marker
 *    actually re-snapshots and reflects the change. It's OFF the rest
 *    of the time to keep this cheap — there's only ever one of these
 *    on screen at once.
 */
export default function LiveLocationMarker({
  onLocationChange,
  size = 16,
  beamHalfAngle = 50,
}: LiveLocationMarkerProps) {
  const [ready, setReady] = useState(false);
  const [hasHeading, setHasHeading] = useState(false);
  const [displayCoord, setDisplayCoord] = useState({ latitude: 0, longitude: 0 });
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const displayCoordRef = useRef({ latitude: 0, longitude: 0 });
  const readyRef = useRef(false); // mirrors ready state, readable inside the position-watcher closure below
  const posRafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headingAnim = useRef(new Animated.Value(0)).current;
  const headingValueRef = useRef(0);
  const hasHeadingRef = useRef(false); // mirrors hasHeading state, readable inside the position-watcher closure below
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const WRAP_SIZE = size * 6;
  const BEAM_RADIUS = WRAP_SIZE / 2 - 2;

  const beamPath = useMemo(() => {
    const cx = WRAP_SIZE / 2;
    const cy = WRAP_SIZE / 2;
    const p1 = polarPoint(cx, cy, BEAM_RADIUS, -beamHalfAngle);
    const p2 = polarPoint(cx, cy, BEAM_RADIUS, beamHalfAngle);
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${BEAM_RADIUS} ${BEAM_RADIUS} 0 0 1 ${p2.x} ${p2.y} Z`;
  }, [WRAP_SIZE, BEAM_RADIUS, beamHalfAngle]);

  // Turns the "re-render the marker bitmap" flag on, and schedules it
  // back off a short beat after the last animation frame — so the map
  // isn't re-snapshotting this marker 60x/sec while it's just sitting still.
  const bumpTracksViewChanges = () => {
    setTracksViewChanges(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setTracksViewChanges(false), 250);
  };

  // ─── Position: manual rAF glide instead of AnimatedRegion ─────
  const animateTo = (target: { latitude: number; longitude: number }, duration = 800) => {
    const start = { ...displayCoordRef.current };
    const startTime = Date.now();

    if (posRafRef.current) cancelAnimationFrame(posRafRef.current);

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

      if (t < 1) {
        posRafRef.current = requestAnimationFrame(step);
      }
    };

    posRafRef.current = requestAnimationFrame(step);
  };

  // ─── Pulsing accuracy ring ──────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const animateHeading = (deg: number) => {
    const current = headingValueRef.current;
    let delta = deg - (current % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const target = current + delta;
    headingValueRef.current = target;
    Animated.timing(headingAnim, { toValue: target, duration: 300, useNativeDriver: true }).start();
    bumpTracksViewChanges();
    hasHeadingRef.current = true;
    setHasHeading(true);
  };

  useEffect(() => {
    let posSub: Location.LocationSubscription | null = null;
    let headingSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[LiveLocationMarker] Location permission not granted');
        return;
      }

      try {
        posSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 1500 },
          (loc) => {
            if (cancelled) return;
            const { latitude, longitude, heading: courseHeading } = loc.coords;

            if (!readyRef.current) {
              displayCoordRef.current = { latitude, longitude };
              setDisplayCoord({ latitude, longitude });
              readyRef.current = true;
              setReady(true);
            } else {
              animateTo({ latitude, longitude });
            }

            // Fall back to GPS course (direction of travel) when the
            // compass hasn't reported a heading yet. (hasHeadingRef, not
            // the hasHeading state, because this callback closes over
            // its initial values for the life of the subscription.)
            if (!hasHeadingRef.current && courseHeading != null && courseHeading >= 0) {
              animateHeading(courseHeading);
            }

            onLocationChange?.({ latitude, longitude });
          }
        );
      } catch (err) {
        console.warn('[LiveLocationMarker] watchPositionAsync failed:', err);
      }

      try {
        headingSub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (deg >= 0) animateHeading(deg);
        });
      } catch (err) {
        // Compass isn't available on every device/simulator — position
        // tracking above still works fine without it.
        console.warn('[LiveLocationMarker] watchHeadingAsync failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      posSub?.remove();
      headingSub?.remove();
      if (posRafRef.current) cancelAnimationFrame(posRafRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const rotate = headingAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Marker
      coordinate={displayCoord}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      tracksViewChanges={tracksViewChanges}
    >
      <View style={[styles.wrap, { width: WRAP_SIZE, height: WRAP_SIZE }]}>
        <Animated.View style={[styles.beamWrap, { transform: [{ rotate }] }]}>
          <Svg width={WRAP_SIZE} height={WRAP_SIZE}>
            <Defs>
              <RadialGradient
                id="beamGradient"
                cx="50%"
                cy="50%"
                r="50%"
                gradientUnits="objectBoundingBox"
              >
                <Stop offset="0%" stopColor={Colors.primary} stopOpacity={0.55} />
                <Stop offset="60%" stopColor={Colors.primary} stopOpacity={0.22} />
                <Stop offset="100%" stopColor={Colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Path d={beamPath} fill="url(#beamGradient)" />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[
            styles.pulse,
            {
              width: size * 2.4,
              height: size * 2.4,
              borderRadius: size * 1.2,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />

        <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  beamWrap: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  pulse: {
    position: 'absolute',
    backgroundColor: Colors.primary,
  },
  dot: {
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});