import ChatButton from '@/components/ChatButton';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

// ─── Arrival threshold — 80 metres ───────────────────────────────
const ARRIVAL_THRESHOLD_M = 80;

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f9fafb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ─── Decode Google encoded polyline ──────────────────────────────
const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
  const poly: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
};

// ─── Haversine distance in metres ────────────────────────────────
const haversineMetres = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (metres: number): string => {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
};

const formatEta = (seconds: number): string => {
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// ─── Direction step icon ──────────────────────────────────────────
const stepIcon = (maneuver: string): keyof typeof Ionicons.glyphMap => {
  if (maneuver.includes('left')) return 'arrow-back';
  if (maneuver.includes('right')) return 'arrow-forward';
  if (maneuver.includes('uturn')) return 'return-up-back';
  if (maneuver.includes('roundabout')) return 'refresh';
  return 'arrow-up';
};

interface Step {
  instruction: string;
  distance: string;
  maneuver: string;
  endLat: number;
  endLng: number;
}

type State = 'en_route' | 'arrived';

export default function NavigatePickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId    = params.deliveryId as string;
  const userName      = params.userName as string;
  const userPhoto     = params.userPhoto as string;
  const userPhone     = params.userPhone as string;
  const pickupLabel   = params.pickupLabel as string;
  const pickupLat     = parseFloat(params.pickupLat as string);
  const pickupLng     = parseFloat(params.pickupLng as string);

  const [state, setState]               = useState<State>('en_route');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [routeCoords, setRouteCoords]   = useState<{ latitude: number; longitude: number }[]>([]);
  const [steps, setSteps]               = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceLeft, setDistanceLeft] = useState('');
  const [etaLeft, setEtaLeft]           = useState('');
  const [navigationActive, setNavigationActive] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [arrivalDetected, setArrivalDetected] = useState(false);

  const mapRef              = useRef<MapView>(null);
  const socketRef           = useRef<Socket | null>(null);
  const locationWatchRef    = useRef<Location.LocationSubscription | null>(null);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverLocationRef   = useRef<{ latitude: number; longitude: number } | null>(null);
  const driverProfileIdRef  = useRef<string | null>(null);
  const stepsRef            = useRef<Step[]>([]);
  const currentStepRef      = useRef(0);
  const isMountedRef        = useRef(false);
  const instructionAnim     = useRef(new Animated.Value(0)).current;

  // ─── Mount ────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchDriverProfile();
    startLocationTracking();
    connectSocket();
    return () => {
      isMountedRef.current = false;
      locationWatchRef.current?.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);
  useEffect(() => { driverProfileIdRef.current = driverProfileId; }, [driverProfileId]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { currentStepRef.current = currentStepIndex; }, [currentStepIndex]);

  useEffect(() => {
    if (!driverProfileId) return;
    socketRef.current?.emit('join_driver_room', { driverId: driverProfileId });
  }, [driverProfileId]);

  // ─── Fetch driver profile ────────────────────────────────────
  const fetchDriverProfile = async () => {
    try {
      const { data } = await api.get('/drivers/me');
      if (data.success) setDriverProfileId(data.data._id);
    } catch (err) {
      console.error('[NavigatePickup] fetchDriverProfile:', err);
    }
  };

  // ─── Fetch Google Directions route + steps ───────────────────
  const fetchRoute = async (fromLat: number, fromLng: number) => {
    if (!GOOGLE_MAPS_KEY) return;
    setRouteLoading(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${fromLat},${fromLng}` +
        `&destination=${pickupLat},${pickupLng}` +
        `&mode=driving` +
        `&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        // Decode full polyline
        setRouteCoords(decodePolyline(route.overview_polyline.points));

        // Parse turn-by-turn steps
        const parsedSteps: Step[] = leg.steps.map((s: any) => ({
          instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
          distance: s.distance.text,
          maneuver: s.maneuver ?? 'straight',
          endLat: s.end_location.lat,
          endLng: s.end_location.lng,
        }));
        setSteps(parsedSteps);
        setCurrentStepIndex(0);

        // Overall ETA + distance from Google
        setDistanceLeft(leg.distance.text);
        setEtaLeft(leg.duration.text);

        // Animate instruction banner in
        Animated.spring(instructionAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
      }
    } catch (err) {
      console.error('[NavigatePickup] fetchRoute error:', err);
    } finally {
      setRouteLoading(false);
    }
  };

  // ─── Location tracking ────────────────────────────────────────
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setDriverLocation(coords);

    // Fit map to show driver + pickup
    mapRef.current?.fitToCoordinates(
      [coords, { latitude: pickupLat, longitude: pickupLng }],
      { edgePadding: { top: 160, right: 60, bottom: 300, left: 60 }, animated: true }
    );

    locationWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
      (loc) => {
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setDriverLocation(c);
        onLocationUpdate(c.latitude, c.longitude);
      }
    );

    // Socket location broadcast interval
    intervalRef.current = setInterval(() => {
      const loc = driverLocationRef.current;
      const id  = driverProfileIdRef.current;
      if (loc && id) {
        socketRef.current?.emit('driver_location_update', {
          driverId: id, lat: loc.latitude, lng: loc.longitude,
        });
      }
    }, 3000);
  };

  // ─── Called on every GPS update ──────────────────────────────
  const onLocationUpdate = (lat: number, lng: number) => {
    const distM = haversineMetres(lat, lng, pickupLat, pickupLng);
    setDistanceLeft(formatDistance(distM));
    setEtaLeft(formatEta((distM / 20000) * 3600)); // rough fallback until Google responds

    // Auto-advance turn-by-turn step
    const currentSteps = stepsRef.current;
    const idx = currentStepRef.current;
    if (currentSteps.length > 0 && idx < currentSteps.length - 1) {
      const step = currentSteps[idx];
      const distToStepEnd = haversineMetres(lat, lng, step.endLat, step.endLng);
      if (distToStepEnd < 30) {
        setCurrentStepIndex(idx + 1);
      }
    }

    // Auto-arrival detection
    if (distM < ARRIVAL_THRESHOLD_M && !arrivalDetected) {
      setArrivalDetected(true);
      if (isMountedRef.current) {
        Alert.alert(
          "You've Arrived! 🎉",
          'You are at the pickup location.',
          [
            { text: 'Not yet', style: 'cancel', onPress: () => setArrivalDetected(false) },
            { text: 'Confirm Arrival', onPress: () => setState('arrived') },
          ]
        );
      }
    }

    // Re-centre map on driver with heading tilt
    if (navigationActive) {
      mapRef.current?.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
  };

  // ─── Socket ───────────────────────────────────────────────────
  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (driverProfileIdRef.current) {
        socket.emit('join_driver_room', { driverId: driverProfileIdRef.current });
      }
    });

    socket.on('trip_cancelled', () => {
      if (!isMountedRef.current) return;
      Alert.alert('Trip Cancelled', 'The user has cancelled this trip.', [{
        text: 'OK',
        onPress: () => setTimeout(() => router.replace('/driver/(tabs)/Home' as never), 300),
      }]);
    });
  };

  // ─── Start in-app navigation ──────────────────────────────────
  const handleStartNavigation = async () => {
    setNavigationActive(true);
    const loc = driverLocationRef.current;
    if (loc) {
      await fetchRoute(loc.latitude, loc.longitude);
      // Switch map to driver-centred navigation view
      mapRef.current?.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }, 800);
    }
  };

  // ─── Stop navigation / overview ──────────────────────────────
  const handleStopNavigation = () => {
    setNavigationActive(false);
    const loc = driverLocationRef.current;
    if (loc) {
      mapRef.current?.fitToCoordinates(
        [loc, { latitude: pickupLat, longitude: pickupLng }],
        { edgePadding: { top: 160, right: 60, bottom: 300, left: 60 }, animated: true }
      );
    }
  };

  // ─── Fallback: open in external Google Maps ───────────────────
  const handleOpenExternalMaps = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${pickupLat},${pickupLng}&dirflg=d`,
      android: `google.navigation:q=${pickupLat},${pickupLng}`,
    });
    Linking.openURL(url!).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${pickupLat},${pickupLng}&travelmode=driving`)
    );
  };

  const handleImHere = () => setState('arrived');

  const handleConfirmArrival = async () => {
    try {
      await api.post(`/deliveries/${deliveryId}/driver-arrived`).catch(() => {});
      router.push({
        pathname: '/driver/at-pickup',
        params: {
          deliveryId, userName, userPhoto, userPhone,
          recipientPhone: params.recipientPhone as string,
          pickupLat: String(pickupLat),
          pickupLng: String(pickupLng),
        },
      } as never);
    } catch (err) {
      console.error('[NavigatePickup] confirmArrival:', err);
    }
  };

  const pickupCoords = { latitude: pickupLat, longitude: pickupLng };
  const currentStep = steps[currentStepIndex];

  return (
    <View style={styles.container}>

      {/* ── MAP ──────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        showsTraffic={navigationActive}
        initialRegion={{
          latitude: pickupLat, longitude: pickupLng,
          latitudeDelta: 0.04, longitudeDelta: 0.04,
        }}
      >
        {/* Pickup marker */}
        <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
          <View style={styles.pickupMarkerWrapper}>
            <View style={styles.pickupMarkerBubble}>
              <Ionicons
                name={state === 'en_route' ? 'person' : 'location'}
                size={14}
                color={state === 'en_route' ? Colors.textSecondary : Colors.primary}
              />
              <Text style={styles.pickupMarkerText}>
                {state === 'en_route'
                  ? (etaLeft ? `${etaLeft} away` : 'Pickup')
                  : 'Pickup spot'}
              </Text>
            </View>
            <View style={styles.markerTip} />
          </View>
        </Marker>

        {/* Driver marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.driverMarkerWrapper}>
              <View style={styles.driverIconBox}>
                <Ionicons name="car" size={18} color={Colors.white} />
              </View>
              {!navigationActive && (
                <View style={styles.driverNameBox}>
                  <Text style={styles.driverNameText}>You</Text>
                  {distanceLeft ? <Text style={styles.driverDistText}>{distanceLeft} away</Text> : null}
                </View>
              )}
            </View>
          </Marker>
        )}

        {/* Route polyline */}
        {routeCoords.length > 0 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.primary}
            strokeWidth={4}
          />
        ) : driverLocation ? (
          <Polyline
            coordinates={[driverLocation, pickupCoords]}
            strokeColor={Colors.primary}
            strokeWidth={2}
            lineDashPattern={[8, 6]}
          />
        ) : null}
      </MapView>

      {/* ── TURN-BY-TURN INSTRUCTION BANNER ──────────────────────── */}
      {navigationActive && currentStep && (
        <Animated.View style={[
          styles.instructionBanner,
          { opacity: instructionAnim, transform: [{ translateY: instructionAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }
        ]}>
          <View style={styles.instructionIconBox}>
            <Ionicons name={stepIcon(currentStep.maneuver)} size={28} color={Colors.white} />
          </View>
          <View style={styles.instructionTextBox}>
            <Text style={styles.instructionText} numberOfLines={2}>
              {currentStep.instruction}
            </Text>
            <Text style={styles.instructionDistance}>{currentStep.distance}</Text>
          </View>
          {/* Next step preview */}
          {steps[currentStepIndex + 1] && (
            <View style={styles.nextStepBox}>
              <Text style={styles.nextStepLabel}>Then</Text>
              <Ionicons
                name={stepIcon(steps[currentStepIndex + 1].maneuver)}
                size={16}
                color={Colors.textSecondary}
              />
            </View>
          )}
        </Animated.View>
      )}

      {/* ── TOP ETA / DISTANCE BAR (navigation mode) ─────────────── */}
      {navigationActive && (
        <View style={styles.etaBar}>
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{etaLeft || '...'}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          <View style={styles.etaSep} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{distanceLeft || '...'}</Text>
            <Text style={styles.etaLabel}>Distance</Text>
          </View>
          <TouchableOpacity style={styles.etaExitBtn} onPress={handleStopNavigation}>
            <Ionicons name="close" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── BACK BUTTON (overview mode) ───────────────────────────── */}
      {!navigationActive && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/driver/(tabs)/Home' as never); }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* ── BOTTOM CARD ───────────────────────────────────────────── */}
      <View style={[styles.bottomCard, navigationActive && styles.bottomCardCompact]}>
        <View style={styles.dragHandle} />

        {!navigationActive && (
          <>
            <Text style={styles.cardTitle}>
              {state === 'en_route' ? 'Go to pick-up location' : 'You have arrived!'}
            </Text>

            {/* Pickup address pill */}
            <View style={styles.addressPill}>
              <Ionicons name="location-outline" size={15} color={Colors.primary} />
              <Text style={styles.addressPillText} numberOfLines={1}>{pickupLabel || 'Pickup location'}</Text>
            </View>

            {/* Distance / ETA row */}
            {distanceLeft || etaLeft ? (
              <View style={styles.statsRow}>
                {distanceLeft ? (
                  <View style={styles.statItem}>
                    <Ionicons name="navigate-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{distanceLeft}</Text>
                  </View>
                ) : null}
                {etaLeft ? (
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{etaLeft}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {/* User row */}
        <View style={styles.userRow}>
          <View style={styles.avatarBox}>
            {userPhoto
              ? <Image source={{ uri: userPhoto }} style={styles.avatar} />
              : <Ionicons name="person" size={22} color={Colors.textSecondary} />
            }
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{userName || 'Customer'}</Text>
          </View>
          <TouchableOpacity style={styles.viewProfileBtn}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.viewProfileText}>View User Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <ChatButton
            deliveryId={deliveryId}
            side="driver"
            variant="full"
            userName={userName}
            userPhoto={userPhoto}
            userPhone={userPhone}
          />
          <TouchableOpacity
            style={styles.callBtn}
            onPress={() => Linking.openURL(`tel:${params.recipientPhone}`)}
          >
            <Ionicons name="call-outline" size={19} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {state === 'en_route' ? (
          <>
            {/* Primary — Start In-App Navigation */}
            <TouchableOpacity
              style={[styles.primaryBtn, routeLoading && { opacity: 0.7 }]}
              onPress={navigationActive ? handleStopNavigation : handleStartNavigation}
              disabled={routeLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name={navigationActive ? 'map-outline' : 'navigate'}
                size={18}
                color={Colors.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.primaryBtnText}>
                {routeLoading ? 'Loading route...' : navigationActive ? 'Show Overview' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>

            {/* Secondary options */}
            <View style={styles.secondaryRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenExternalMaps}>
                <Ionicons name="open-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.secondaryBtnText}>Open in Google Maps</Text>
              </TouchableOpacity>
              <View style={styles.secSep} />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleImHere}>
                <Ionicons name="checkmark-circle-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.secondaryBtnText}>I'm already here</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmArrival} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Confirm at Pickup Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightGray },

  // Back button
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4, zIndex: 10,
  },

  // Turn-by-turn banner
  instructionBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 16, right: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12, zIndex: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
  },
  instructionIconBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  instructionTextBox: { flex: 1 },
  instructionText: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 15,
    color: Colors.white, lineHeight: 20,
  },
  instructionDistance: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.7)', marginTop: 2,
  },
  nextStepBox: { alignItems: 'center', gap: 2 },
  nextStepLabel: { fontFamily: Fonts.poppins.regular, fontSize: 10, color: 'rgba(255,255,255,0.6)' },

  // ETA bar (navigation mode)
  etaBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 136 : 120,
    left: 16, right: 16,
    backgroundColor: Colors.white,
    borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 6, zIndex: 15,
  },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValue: { fontFamily: Fonts.poppins.bold, fontSize: 16, color: Colors.textPrimary },
  etaLabel: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary },
  etaSep: { width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 8 },
  etaExitBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  // Markers
  pickupMarkerWrapper: { alignItems: 'center' },
  pickupMarkerBubble: {
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },
  pickupMarkerText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textPrimary },
  markerTip: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.white, marginTop: -1,
  },
  driverMarkerWrapper: { alignItems: 'center' },
  driverIconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  driverNameBox: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginTop: 3, alignItems: 'center',
  },
  driverNameText: { color: Colors.white, fontFamily: Fonts.poppins.semiBold, fontSize: 11 },
  driverDistText: { color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.poppins.regular, fontSize: 10 },

  // Bottom card
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  bottomCardCompact: {
    // Less height in navigation mode so more map is visible
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  cardTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16,
    color: Colors.textPrimary, textAlign: 'center', marginBottom: 10,
  },
  addressPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${Colors.primary}10`,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10,
  },
  addressPillText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textPrimary, flex: 1,
  },
  statsRow: {
    flexDirection: 'row', gap: 16, marginBottom: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center' },
  viewProfileText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  callBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', marginBottom: 4,
  },
  primaryBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },

  secondaryRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', marginTop: 8, gap: 8,
  },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  secondaryBtnText: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },
  secSep: { width: 1, height: 16, backgroundColor: Colors.border },
});