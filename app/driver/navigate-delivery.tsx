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
  View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

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

// ─── Decode Google's encoded polyline ─────────────────────────────
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

// ─── Haversine helpers ─────────────────────────────────────────────
const calcEta = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const mins = Math.round((km / 20) * 60);
  return mins < 1 ? '< 1 min' : `${mins} min${mins > 1 ? 's' : ''}`;
};

const calcDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

export default function NavigateDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // ─── Params ───────────────────────────────────────────────────────
  const deliveryId = params.deliveryId as string;
  const userName = (params.recipientName as string) || (params.userName as string) || 'Recipient';
  const deliveryCode = params.deliveryCode as string;
  const destLabel = (params.destLabel as string) || 'Destination';
  const pickupLabel = (params.pickupLabel as string) || 'Pickup Location';
  const recipientName = (params.recipientName as string) || '';
  const recipientPhone = (params.recipientPhone as string) || '';
  const price = (params.price as string) || '0';
const userPhoto = (params.userPhoto as string) || null;
  const destLat = parseFloat(params.destLat as string) || 6.5244;
  const destLng = parseFloat(params.destLng as string) || 3.3792;
  const pickupLat = parseFloat(params.pickupLat as string) || 6.5244;
  const pickupLng = parseFloat(params.pickupLng as string) || 3.3792;

  // ─── State ────────────────────────────────────────────────────────
  const [state, setState] = useState<State>('en_route');
  const [sheet, setSheet] = useState<Sheet>('main');
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [eta, setEta] = useState('');
  const [distance, setDistance] = useState('');

  // Route — real road polyline from Google Directions API
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);

  // Animated dash phase — makes route line appear to flow forward (iOS)
  const [dashPhase, setDashPhase] = useState(0);

  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const driverProfileIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(false);
  const sheetAnim = useRef(new Animated.Value(600)).current;

  // ─── Mount ────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchDriverProfile();
    startLocationTracking();
    connectSocket();
    fetchRoute();
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
  useEffect(() => {
    if (driverProfileId) socketRef.current?.emit('join_driver_room', { driverId: driverProfileId });
  }, [driverProfileId]);

  // ─── Fetch real road route from Google Directions API ─────────────
  const fetchRoute = async () => {
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
      } else {
        setRouteCoords([
          { latitude: pickupLat, longitude: pickupLng },
          { latitude: destLat, longitude: destLng },
        ]);
      }
    } catch (err) {
      console.error('[NavigateDelivery] fetchRoute:', err);
      setRouteCoords([
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: destLat, longitude: destLng },
      ]);
    } finally {
      setRouteLoading(false);
    }
  };

  // ─── Animated dashes ──────────────────────────────────────────────
  const startDashAnimation = () => {
    dashIntervalRef.current = setInterval(() => {
      setDashPhase((prev) => (prev + 1.5) % 20);
    }, 60);
  };

  // ─── Location tracking ────────────────────────────────────────────
  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setDriverLocation(coords);
      setEta(calcEta(coords.latitude, coords.longitude, destLat, destLng));
      setDistance(calcDistanceKm(coords.latitude, coords.longitude, destLat, destLng));

      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 3000 },
        (loc) => {
          const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setDriverLocation(c);
          setEta(calcEta(c.latitude, c.longitude, destLat, destLng));
          setDistance(calcDistanceKm(c.latitude, c.longitude, destLat, destLng));
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
      }, 4000);
    } catch (err) {
      console.error('[NavigateDelivery] location error:', err);
    }
  };

  // ─── Socket ───────────────────────────────────────────────────────
  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[NavigateDelivery] Socket connected');
      if (driverProfileIdRef.current) {
        socket.emit('join_driver_room', { driverId: driverProfileIdRef.current });
      }
    });

    socket.on('trip_cancelled', () => {
      if (!isMountedRef.current) return;
      Alert.alert('Trip Cancelled', 'The user has cancelled this trip.', [{
        text: 'OK',
        onPress: () => setTimeout(() => router.replace('/driver/(tabs)/home' as never), 300),
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

  // ─── Actions ──────────────────────────────────────────────────────
  const handleOpenMaps = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${destLat},${destLng}&dirflg=d`,
      android: `google.navigation:q=${destLat},${destLng}`,
    });
    Linking.openURL(url!).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`)
    );
  };

  // ─── KEY FIX: Navigate to confirm-delivery for OTP verification ───
  // Previously this called markDelivered directly — wrong.
  // Correct flow: confirm-delivery verifies the delivery code with the
  // recipient, then calls markDelivered, then shows delivery-complete.
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

  // ─── Derived values ───────────────────────────────────────────────
  const pickupCoords = { latitude: pickupLat, longitude: pickupLng };
  const destCoords = { latitude: destLat, longitude: destLng };
  const destLine1 = destLabel.split(',')[0] ?? 'Destination';
  const destLine2 = destLabel.split(',').slice(1).join(',').trim() ?? '';

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
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
                  ? eta ? `Arrives in ${eta}` : 'Drop off'
                  : 'Drop off spot'}
              </Text>
            </View>
            <View style={styles.markerTip} />
          </View>
        </Marker>

        {/* Driver marker — moves with real GPS */}
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
              <View style={styles.driverNameBox}>
                <Text style={styles.driverNameText}>You</Text>
                {distance ? <Text style={styles.driverDistText}>{distance} km away</Text> : null}
              </View>
            </View>
          </Marker>
        )}

        {/* Single animated route line following actual roads */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.primary}
            strokeWidth={4}
            lineDashPattern={[12, 6]}
            lineDashPhase={dashPhase}
          />
        )}

        {/* Fallback while route is loading */}
        {routeLoading && routeCoords.length === 0 && (
          <Polyline
            coordinates={[pickupCoords, destCoords]}
            strokeColor={`${Colors.primary}50`}
            strokeWidth={2}
            lineDashPattern={[6, 4]}
          />
        )}
      </MapView>

      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* ── EN ROUTE CARD ── */}
      {state === 'en_route' && sheet === 'main' && (
        <View style={styles.bottomCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.cardTitle}>Drop off in  {eta || '...'}</Text>

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
            <TouchableOpacity style={styles.viewDetailsBtn} onPress={showTripDetails}>
              <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.chatBtn}>
              <Ionicons name="chatbox-outline" size={17} color={Colors.primary} />
              <Text style={styles.chatBtnText}>Chat with Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${recipientPhone}`)}>
              <Ionicons name="call-outline" size={19} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.dropoffRow}>
            <Text style={styles.dropoffLabel}>Drop off at</Text>
            <TouchableOpacity onPress={showTripDetails}>
              <Text style={styles.seeTripText}>See Trip Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressLine}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.addressTitle}>{destLine1}</Text>
          </View>
          <Text style={styles.addressSub}>
            {destLine2}{'  '}
            <Text style={styles.priceInline}>₦{parseInt(price || '0').toLocaleString()}</Text>
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenMaps} activeOpacity={0.85}>
            <Ionicons name="navigate-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
            <Text style={styles.primaryBtnText}>Navigate to Drop Off</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setState('arrived')}>
            <Text style={styles.secondaryBtnText}>I'm at the drop off location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ARRIVED CARD ── */}
      {state === 'arrived' && sheet === 'main' && (
        <View style={styles.arrivedCard}>
          <View style={styles.dragHandle} />

          <View style={styles.arrivedHeaderRow}>
            <TouchableOpacity onPress={() => setState('en_route')}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.cardTitle}>Drop off in  {eta || '...'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={38} color={Colors.white} />
          </View>

          <View style={styles.addressLine}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={[styles.addressTitle, { marginLeft: 6 }]}>{destLine1}</Text>
          </View>

          <View style={styles.recipientRow}>
            <Text style={styles.recipientName}>{recipientName || 'Recipient'}</Text>
            <Text style={styles.recipientPhone}>{recipientPhone}</Text>
          </View>

          {/* Full-width tall button — navigates to confirm-delivery for code verification */}
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleCompleteDelivery}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── TRIP DETAILS SHEET ── */}
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
            <Text style={styles.tripMeta}>{distance} km</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.tripDetailRow}>
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.tripDetailLabel}>Duration</Text>
            <Text style={styles.tripDetailValue}>{eta || '30 mins'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.tripDetailRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.tripDetailLabel}>Fair estimate</Text>
            <Text style={styles.tripDetailValue}>₦{parseInt(price || '0').toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          {/* Full-width button in trip details too */}
          <TouchableOpacity
            style={styles.completeBtn}
            onPress={handleCompleteDelivery}
            activeOpacity={0.85}
          >
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

  pickupMarker: {
    backgroundColor: '#10B981', padding: 10, borderRadius: 24,
    borderWidth: 3, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },

  destMarkerWrapper: { alignItems: 'center' },
  destMarkerBubble: {
    backgroundColor: Colors.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
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
avatar: { width: 44, height: 44, borderRadius: 22 },
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

  // ── En route bottom card ──
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
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  cardTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 16,
  },

  receiverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  receiverName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  receiverSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  viewDetailsBtn: { flexDirection: 'row', alignItems: 'center' },
  viewDetailsText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, gap: 8,
  },
  chatBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
  callBtn: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  dropoffRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  dropoffLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textSecondary },
  seeTripText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.primary },

  addressLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  addressTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  addressSub: {
    fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, marginBottom: 14,
  },
  priceInline: { fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },
  secondaryBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center' },
  secondaryBtnText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },

  // Full-width taller "Complete Delivery" button — matches design
  completeBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginTop: 20,
  },

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
  recipientRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  recipientName: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary },
  recipientPhone: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textPrimary },

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
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary,
    marginLeft: 12, flex: 1,
  },
  tripMeta: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  tripConnector: {
    width: 1.5, height: 20, backgroundColor: Colors.border, marginLeft: 5, marginVertical: 2,
  },

  tripDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripDetailLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, flex: 1 },
  tripDetailValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
});