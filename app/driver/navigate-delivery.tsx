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

// ─── Arrival threshold ────────────────────────────────────────────
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

type State = 'en_route' | 'arrived';
type Sheet = 'main' | 'trip_details';

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

// ─── Haversine in metres ──────────────────────────────────────────
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

const formatDistance = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const formatEta = (s: number) => {
  if (s < 60) return '< 1 min';
  const mins = Math.round(s / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// ─── Step maneuver → icon ─────────────────────────────────────────
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

export default function NavigateDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId    = params.deliveryId as string;
  const userName      = (params.recipientName as string) || (params.userName as string) || 'Recipient';
  const deliveryCode  = params.deliveryCode as string;
  const destLabel     = (params.destLabel as string) || 'Destination';
  const pickupLabel   = (params.pickupLabel as string) || 'Pickup Location';
  const recipientName = (params.recipientName as string) || '';
  const recipientPhone = (params.recipientPhone as string) || '';
  const price         = (params.price as string) || '0';
  const userPhoto     = (params.userPhoto as string) || undefined;
  const userPhone     = (params.userPhone as string) || undefined;
  const destLat       = parseFloat(params.destLat as string) || 6.5244;
  const destLng       = parseFloat(params.destLng as string) || 3.3792;
  const pickupLat     = parseFloat(params.pickupLat as string) || 6.5244;
  const pickupLng     = parseFloat(params.pickupLng as string) || 3.3792;

  const [state, setState]                   = useState<State>('en_route');
  const [sheet, setSheet]                   = useState<Sheet>('main');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [eta, setEta]                       = useState('');
  const [distance, setDistance]             = useState('');
  const [routeCoords, setRouteCoords]       = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeLoading, setRouteLoading]     = useState(false);
  const [steps, setSteps]                   = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navigationActive, setNavigationActive] = useState(false);
  const [arrivalDetected, setArrivalDetected]   = useState(false);
  const [dashPhase, setDashPhase]           = useState(0);

  const mapRef             = useRef<MapView>(null);
  const socketRef          = useRef<Socket | null>(null);
  const locationWatchRef   = useRef<Location.LocationSubscription | null>(null);
  const intervalRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const dashIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverLocationRef  = useRef<{ latitude: number; longitude: number } | null>(null);
  const driverProfileIdRef = useRef<string | null>(null);
  const stepsRef           = useRef<Step[]>([]);
  const currentStepRef     = useRef(0);
  const isMountedRef       = useRef(false);
  const sheetAnim          = useRef(new Animated.Value(600)).current;
  const instructionAnim    = useRef(new Animated.Value(0)).current;

  // ─── Mount ────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchDriverProfile();
    startLocationTracking();
    connectSocket();
    fetchOverviewRoute();
    startDashAnimation();
    return () => {
      isMountedRef.current = false;
      locationWatchRef.current?.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (dashIntervalRef.current) clearInterval(dashIntervalRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);
  useEffect(() => { driverProfileIdRef.current = driverProfileId; }, [driverProfileId]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);
  useEffect(() => { currentStepRef.current = currentStepIndex; }, [currentStepIndex]);
  useEffect(() => {
    if (driverProfileId) socketRef.current?.emit('join_driver_room', { driverId: driverProfileId });
  }, [driverProfileId]);

  // ─── Overview route (pickup → dest) on mount ─────────────────
  const fetchOverviewRoute = async () => {
    if (!GOOGLE_MAPS_KEY) {
      setRouteCoords([
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: destLat, longitude: destLng },
      ]);
      return;
    }
    setRouteLoading(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${pickupLat},${pickupLng}` +
        `&destination=${destLat},${destLng}` +
        `&mode=driving` +
        `&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        const decoded = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(decoded);
        mapRef.current?.fitToCoordinates(decoded, {
          edgePadding: { top: 100, right: 60, bottom: 320, left: 60 },
          animated: true,
        });
      }
    } catch (err) {
      console.error('[NavigateDelivery] fetchOverviewRoute:', err);
    } finally {
      setRouteLoading(false);
    }
  };

  // ─── Navigation route (driver → dest) with turn-by-turn steps ─
  const fetchNavigationRoute = async (fromLat: number, fromLng: number) => {
    if (!GOOGLE_MAPS_KEY) return;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${fromLat},${fromLng}` +
        `&destination=${destLat},${destLng}` +
        `&mode=driving` +
        `&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        setRouteCoords(decodePolyline(route.overview_polyline.points));

        const parsedSteps: Step[] = leg.steps.map((s: any) => ({
          instruction: s.html_instructions.replace(/<[^>]+>/g, ''),
          distance: s.distance.text,
          maneuver: s.maneuver ?? 'straight',
          endLat: s.end_location.lat,
          endLng: s.end_location.lng,
        }));
        setSteps(parsedSteps);
        setCurrentStepIndex(0);
        setDistance(leg.distance.text);
        setEta(leg.duration.text);

        Animated.spring(instructionAnim, {
          toValue: 1, tension: 60, friction: 10, useNativeDriver: true,
        }).start();
      }
    } catch (err) {
      console.error('[NavigateDelivery] fetchNavigationRoute:', err);
    }
  };

  // ─── Animated flowing dashes ──────────────────────────────────
  const startDashAnimation = () => {
    dashIntervalRef.current = setInterval(() => {
      setDashPhase(prev => (prev + 1.5) % 20);
    }, 60);
  };

  // ─── Location tracking ────────────────────────────────────────
  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setDriverLocation(coords);
      const distM = haversineMetres(coords.latitude, coords.longitude, destLat, destLng);
      setDistance(formatDistance(distM));
      setEta(formatEta((distM / 20000) * 3600));

      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 },
        (loc) => {
          const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setDriverLocation(c);
          onLocationUpdate(c.latitude, c.longitude);
        }
      );

      intervalRef.current = setInterval(() => {
        const loc = driverLocationRef.current;
        const id = driverProfileIdRef.current;
        if (loc && id && socketRef.current) {
          socketRef.current.emit('driver_location_update', {
            driverId: id, lat: loc.latitude, lng: loc.longitude,
          });
        }
      }, 3000);
    } catch (err) {
      console.error('[NavigateDelivery] location error:', err);
    }
  };

  // ─── Called on every GPS update ──────────────────────────────
  const onLocationUpdate = (lat: number, lng: number) => {
    const distM = haversineMetres(lat, lng, destLat, destLng);
    setDistance(formatDistance(distM));
    setEta(formatEta((distM / 20000) * 3600));

    // Auto-advance turn-by-turn step
    const currentSteps = stepsRef.current;
    const idx = currentStepRef.current;
    if (currentSteps.length > 0 && idx < currentSteps.length - 1) {
      const distToEnd = haversineMetres(lat, lng, currentSteps[idx].endLat, currentSteps[idx].endLng);
      if (distToEnd < 30) setCurrentStepIndex(idx + 1);
    }

    // Auto-arrival detection
    if (distM < ARRIVAL_THRESHOLD_M && !arrivalDetected) {
      setArrivalDetected(true);
      if (isMountedRef.current) {
        Alert.alert(
          "You've Arrived! 🎉",
          'You are at the drop-off location.',
          [
            { text: 'Not yet', style: 'cancel', onPress: () => setArrivalDetected(false) },
            { text: 'Complete Delivery', onPress: () => setState('arrived') },
          ]
        );
      }
    }

    // Keep map centred on driver in navigation mode
    if (navigationActive) {
      mapRef.current?.animateToRegion({
        latitude: lat, longitude: lng,
        latitudeDelta: 0.005, longitudeDelta: 0.005,
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

  const fetchDriverProfile = async () => {
    try {
      const { data } = await api.get('/drivers/me');
      if (data.success) setDriverProfileId(data.data._id);
    } catch (err) {
      console.error('[NavigateDelivery] fetchDriverProfile:', err);
    }
  };

  // ─── Start in-app navigation ──────────────────────────────────
  const handleStartNavigation = async () => {
    setNavigationActive(true);
    const loc = driverLocationRef.current;
    if (loc) {
      await fetchNavigationRoute(loc.latitude, loc.longitude);
      mapRef.current?.animateToRegion({
        latitude: loc.latitude, longitude: loc.longitude,
        latitudeDelta: 0.006, longitudeDelta: 0.006,
      }, 800);
    }
  };

  const handleStopNavigation = () => {
    setNavigationActive(false);
    fetchOverviewRoute();
  };

  const handleOpenExternalMaps = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${destLat},${destLng}&dirflg=d`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });
    Linking.openURL(url!).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`)
    );
  };

  const handleCompleteDelivery = () => {
    router.push({
      pathname: '/driver/confirm-delivery',
      params: {
        deliveryId,
        driverProfileId: driverProfileId ?? '',
        recipientName,
        price,
        pickupLabel,
        destLabel,
        distance,
        eta,
      },
    } as never);
  };

  const showTripDetails = () => {
    setSheet('trip_details');
    Animated.spring(sheetAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }).start();
  };

  const hideTripDetails = () => {
    Animated.timing(sheetAnim, { toValue: 600, duration: 280, useNativeDriver: true })
      .start(() => setSheet('main'));
  };

  const pickupCoords = { latitude: pickupLat, longitude: pickupLng };
  const destCoords   = { latitude: destLat, longitude: destLng };
  const destLine1    = destLabel.split(',')[0] ?? 'Destination';
  const destLine2    = destLabel.split(',').slice(1).join(',').trim() ?? '';
  const currentStep  = steps[currentStepIndex];

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
          latitude: (pickupLat + destLat) / 2,
          longitude: (pickupLng + destLng) / 2,
          latitudeDelta: Math.abs(pickupLat - destLat) * 2.5 + 0.05,
          longitudeDelta: Math.abs(pickupLng - destLng) * 2.5 + 0.05,
        }}
      >
        {/* Pickup marker — green cube */}
        <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.pickupMarker}>
            <Ionicons name="cube" size={16} color={Colors.white} />
          </View>
        </Marker>

        {/* Destination marker */}
        <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
          <View style={styles.destMarkerWrapper}>
            <View style={styles.destMarkerBubble}>
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.destMarkerText}>
                {state === 'en_route'
                  ? (eta ? `${eta} away` : 'Drop off')
                  : 'Drop off spot'}
              </Text>
            </View>
            <View style={styles.markerTip} />
          </View>
        </Marker>

        {/* Driver marker */}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.driverMarkerWrapper}>
              <View style={styles.driverIconBox}>
                <Ionicons name="car" size={18} color={Colors.white} />
              </View>
              {!navigationActive && (
                <View style={styles.driverNameBox}>
                  <Text style={styles.driverNameText}>You</Text>
                  {distance ? <Text style={styles.driverDistText}>{distance} away</Text> : null}
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
            lineDashPattern={navigationActive ? undefined : [12, 6]}
            lineDashPhase={navigationActive ? undefined : dashPhase}
          />
        ) : (
          <Polyline
            coordinates={[pickupCoords, destCoords]}
            strokeColor={`${Colors.primary}50`}
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>

      {/* ── TURN-BY-TURN INSTRUCTION BANNER ──────────────────────── */}
      {navigationActive && currentStep && (
        <Animated.View style={[
          styles.instructionBanner,
          {
            opacity: instructionAnim,
            transform: [{
              translateY: instructionAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }),
            }],
          },
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
          {steps[currentStepIndex + 1] && (
            <View style={styles.nextStepBox}>
              <Text style={styles.nextStepLabel}>Then</Text>
              <Ionicons
                name={stepIcon(steps[currentStepIndex + 1].maneuver)}
                size={16}
                color="rgba(255,255,255,0.7)"
              />
            </View>
          )}
        </Animated.View>
      )}

      {/* ── ETA BAR (navigation mode) ─────────────────────────────── */}
      {navigationActive && (
        <View style={styles.etaBar}>
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{eta || '...'}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          <View style={styles.etaSep} />
          <View style={styles.etaItem}>
            <Text style={styles.etaValue}>{distance || '...'}</Text>
            <Text style={styles.etaLabel}>Distance</Text>
          </View>
          <TouchableOpacity style={styles.etaExitBtn} onPress={handleStopNavigation}>
            <Ionicons name="close" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── BACK BUTTON (overview mode only) ─────────────────────── */}
      {!navigationActive && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/driver/(tabs)/Home' as never); }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* ══ EN ROUTE CARD ══════════════════════════════════════════ */}
      {state === 'en_route' && sheet === 'main' && (
        <View style={styles.bottomCard}>
          <View style={styles.dragHandle} />

          {!navigationActive && (
            <>
              <Text style={styles.cardTitle}>Drop off in {eta || '...'}</Text>

              {/* Destination address pill */}
              <View style={styles.addressPill}>
                <Ionicons name="location-outline" size={15} color={Colors.primary} />
                <Text style={styles.addressPillText} numberOfLines={1}>{destLabel}</Text>
              </View>

              {/* Distance stat */}
              {distance ? (
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="navigate-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{distance}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.statText}>{eta}</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}

          {/* Receiver row */}
          <View style={styles.receiverRow}>
            <View style={styles.avatarBox}>
              {userPhoto
                ? <Image source={{ uri: userPhoto }} style={styles.avatar} />
                : <Ionicons name="person" size={22} color={Colors.textSecondary} />
              }
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.receiverName}>{userName}</Text>
              <Text style={styles.receiverSub}>Recipient</Text>
            </View>
            {!navigationActive && (
              <TouchableOpacity style={styles.viewDetailsBtn} onPress={showTripDetails}>
                <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.viewDetailsText}>View Details</Text>
              </TouchableOpacity>
            )}
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
              onPress={() => Linking.openURL(`tel:${recipientPhone}`)}
            >
              <Ionicons name="call-outline" size={19} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Primary — Start / Stop Navigation */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={navigationActive ? handleStopNavigation : handleStartNavigation}
            activeOpacity={0.85}
          >
            <Ionicons
              name={navigationActive ? 'map-outline' : 'navigate'}
              size={18}
              color={Colors.white}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.primaryBtnText}>
              {navigationActive ? 'Show Overview' : 'Start Navigation'}
            </Text>
          </TouchableOpacity>

          {/* Secondary options */}
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleOpenExternalMaps}>
              <Ionicons name="open-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.secondaryBtnText}>Open in Google Maps</Text>
            </TouchableOpacity>
            <View style={styles.secSep} />
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setState('arrived')}>
              <Ionicons name="checkmark-circle-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.secondaryBtnText}>I'm at drop off</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══ ARRIVED CARD ════════════════════════════════════════════ */}
      {state === 'arrived' && sheet === 'main' && (
        <View style={styles.arrivedCard}>
          <View style={styles.dragHandle} />

          <View style={styles.arrivedHeaderRow}>
            <TouchableOpacity onPress={() => setState('en_route')}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.cardTitle}>You've arrived!</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={38} color={Colors.white} />
          </View>

          <View style={styles.addressLine}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={[styles.addressTitle, { marginLeft: 6 }]}>{destLine1}</Text>
          </View>
          {destLine2 ? <Text style={styles.addressSub}>{destLine2}</Text> : null}

          <View style={styles.recipientRow}>
            <Text style={styles.recipientName}>{recipientName || 'Recipient'}</Text>
            <Text style={styles.recipientPhone}>{recipientPhone}</Text>
          </View>

          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleCompleteDelivery}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══ TRIP DETAILS SHEET ══════════════════════════════════════ */}
      {sheet === 'trip_details' && (
        <Animated.View style={[styles.tripDetailsCard, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.dragHandle} />

          <View style={styles.tripDetailsHeader}>
            <TouchableOpacity onPress={hideTripDetails}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.tripDetailsTitle}>Trip Details</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.tripRow}>
            <View style={styles.redDot} />
            <Text style={styles.tripAddressText} numberOfLines={1}>{pickupLabel}</Text>
          </View>
          <View style={styles.tripConnector} />
          <View style={styles.tripRow}>
            <Ionicons name="location" size={16} color={Colors.textPrimary} />
            <Text style={[styles.tripAddressText, { marginLeft: 8 }]} numberOfLines={1}>{destLabel}</Text>
            <Text style={styles.tripMeta}>{distance}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.tripDetailRow}>
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.tripDetailLabel}>Duration</Text>
            <Text style={styles.tripDetailValue}>{eta || '...'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.tripDetailRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.tripDetailLabel}>Fair estimate</Text>
            <Text style={styles.tripDetailValue}>₦{parseInt(price || '0').toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteDelivery} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Complete Delivery</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightGray },

  backButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44, left: 20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4, zIndex: 10,
  },

  // ── Turn-by-turn banner ──
  instructionBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44,
    left: 16, right: 16,
    backgroundColor: Colors.primary, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
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

  // ── ETA bar ──
  etaBar: {
    position: 'absolute', top: Platform.OS === 'ios' ? 136 : 120,
    left: 16, right: 16,
    backgroundColor: Colors.white, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
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

  // ── Markers ──
  pickupMarker: {
    backgroundColor: '#10B981', padding: 10, borderRadius: 24,
    borderWidth: 3, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  destMarkerWrapper: { alignItems: 'center' },
  destMarkerBubble: {
    backgroundColor: Colors.white, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  destMarkerText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textPrimary },
  markerTip: {
    width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.white, marginTop: -1,
  },
  driverMarkerWrapper: { alignItems: 'center' },
  driverIconBox: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  driverNameBox: {
    backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 8, marginTop: 4, alignItems: 'center',
  },
  driverNameText: { color: Colors.white, fontFamily: Fonts.poppins.semiBold, fontSize: 12 },
  driverDistText: { color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.poppins.regular, fontSize: 10 },

  // ── Bottom card ──
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 16,
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
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  addressPillText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textPrimary, flex: 1,
  },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },

  receiverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  receiverName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  receiverSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center' },
  viewDetailsText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  callBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 4,
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

  // ── Arrived card ──
  arrivedCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
    alignItems: 'center',
  },
  arrivedHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', width: '100%', marginBottom: 20,
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  addressLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  addressTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  addressSub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  recipientRow: { flexDirection: 'row', gap: 16, marginTop: 4, marginBottom: 4 },
  recipientName: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary },
  recipientPhone: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textPrimary },
  completeBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 20,
  },

  // ── Trip details sheet ──
  tripDetailsCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  tripDetailsHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  tripDetailsTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  tripRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  tripAddressText: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textPrimary, marginLeft: 12, flex: 1,
  },
  tripMeta: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  tripConnector: { width: 1.5, height: 20, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 2 },
  tripDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripDetailLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, flex: 1 },
  tripDetailValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
});