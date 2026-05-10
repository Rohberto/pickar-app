import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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

export default function NavigatePickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string;
  const userName = params.userName as string;
  const userPhoto = params.userPhoto as string;
  const pickupLabel = params.pickupLabel as string;
  const pickupLat = parseFloat(params.pickupLat as string);
  const pickupLng = parseFloat(params.pickupLng as string);

  const [state, setState] = useState<State>('en_route');
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [distance, setDistance] = useState('');
  const [eta, setEta] = useState('');

  const mapRef = useRef<MapView>(null);
  const socketRef = useRef<Socket | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const driverProfileIdRef = useRef<string | null>(null);

  // isMountedRef — prevents navigation from firing if screen has unmounted
  // (e.g. trip_cancelled fires just after user navigates away)
  const isMountedRef = useRef(false);

  // ─── Mount ───────────────────────────────────────────────────────
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

  // ─── Keep refs in sync ───────────────────────────────────────────
  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  useEffect(() => {
    driverProfileIdRef.current = driverProfileId;
  }, [driverProfileId]);

  // ─── Join driver room once profile id is loaded ──────────────────
  useEffect(() => {
    if (!driverProfileId) return;
    socketRef.current?.emit('join_driver_room', { driverId: driverProfileId });
  }, [driverProfileId]);

  // ─── Fetch Driver profile ─────────────────────────────────────────
  const fetchDriverProfile = async () => {
    try {
      const { data } = await api.get('/drivers/me');
      if (data.success) setDriverProfileId(data.data._id);
    } catch (err) {
      console.error('[NavigatePickup] fetchDriverProfile:', err);
    }
  };

  // ─── Location tracking ────────────────────────────────────────────
  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    setDriverLocation(coords);
    updateDistanceAndEta(coords.latitude, coords.longitude);

    mapRef.current?.fitToCoordinates(
      [coords, { latitude: pickupLat, longitude: pickupLng }],
      { edgePadding: { top: 80, right: 60, bottom: 240, left: 60 }, animated: true }
    );

    locationWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 0, timeInterval: 3000 },
      (loc) => {
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setDriverLocation(c);
        updateDistanceAndEta(c.latitude, c.longitude);
      }
    );

    intervalRef.current = setInterval(() => {
      const loc = driverLocationRef.current;
      const id = driverProfileIdRef.current;
      if (loc && id) {
        socketRef.current?.emit('driver_location_update', {
          driverId: id,
          lat: loc.latitude,
          lng: loc.longitude,
        });
      }
    }, 3000);
  };

  // ─── Socket ───────────────────────────────────────────────────────
  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[NavigatePickup] Socket connected');
      if (driverProfileIdRef.current) {
        socket.emit('join_driver_room', { driverId: driverProfileIdRef.current });
      }
    });

    // User cancelled the trip — only navigate if screen is still mounted
    socket.on('trip_cancelled', () => {
      if (!isMountedRef.current) return;
      Alert.alert(
        'Trip Cancelled',
        'The user has cancelled this trip.',
        [{
          text: 'OK',
          onPress: () => {
            // Delay ensures Root Layout is fully mounted before navigation
            setTimeout(() => {
              router.replace('/driver/(tabs)/Home' as never);
            }, 300);
          },
        }]
      );
    });
  };

  // ─── Haversine distance + rough ETA ──────────────────────────────
  const updateDistanceAndEta = (lat: number, lng: number) => {
    const R = 6371;
    const dLat = ((pickupLat - lat) * Math.PI) / 180;
    const dLng = ((pickupLng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((pickupLat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setDistance(`${km.toFixed(1)} km`);
    const mins = Math.round((km / 20) * 60);
    setEta(mins <= 1 ? '< 1 min' : `${mins} mins`);
  };

  // ─── Actions ──────────────────────────────────────────────────────
  const handleOpenMaps = () => {
    const url = Platform.select({
      ios: `maps://app?daddr=${pickupLat},${pickupLng}&dirflg=d`,
      android: `google.navigation:q=${pickupLat},${pickupLng}`,
    });
    Linking.openURL(url!).catch(() =>
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${pickupLat},${pickupLng}&travelmode=driving`
      )
    );
  };

  const handleImHere = () => setState('arrived');

  const handleConfirmArrival = async () => {
    try {
      await api.post(`/deliveries/${deliveryId}/driver-arrived`).catch(() => {});
      router.push({
        pathname: '/driver/at-pickup',
        params: {
          deliveryId,
          userName,
          userPhoto,
          pickupLat: String(pickupLat),
          pickupLng: String(pickupLng),
        },
      } as never);
    } catch (err) {
      console.error('[NavigatePickup] confirmArrival:', err);
    }
  };

  const pickupCoords = { latitude: pickupLat, longitude: pickupLng };

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
          latitude: pickupLat,
          longitude: pickupLng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
          <View style={styles.pickupMarkerWrapper}>
            <View style={styles.pickupMarkerBubble}>
              {state === 'en_route'
                ? <Ionicons name="person" size={14} color={Colors.textSecondary} />
                : <Ionicons name="location" size={14} color={Colors.primary} />
              }
              <Text style={styles.pickupMarkerText}>
                {state === 'en_route' ? `Arrives in ${eta || '...'}` : 'Pickup spot'}
              </Text>
            </View>
            <View style={styles.markerTip} />
          </View>
        </Marker>

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
                {distance ? <Text style={styles.driverDistText}>{distance} away</Text> : null}
              </View>
            </View>
          </Marker>
        )}

        {driverLocation && (
          <Polyline
            coordinates={[driverLocation, pickupCoords]}
            strokeColor={Colors.primary}
            strokeWidth={2}
            lineDashPattern={[8, 6]}
          />
        )}
      </MapView>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* BOTTOM CARD */}
      <View style={styles.bottomCard}>
        <View style={styles.dragHandle} />

        <Text style={styles.cardTitle}>
          {state === 'en_route' ? 'Go to pick-up location' : `Pickup in ${eta || '30 mins'}`}
        </Text>

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
          <TouchableOpacity style={styles.chatBtn}>
            <Ionicons name="chatbox-outline" size={17} color={Colors.primary} />
            <Text style={styles.chatBtnText}>Chat with Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${params.recipientPhone}`)}>
            <Ionicons name="call-outline" size={19} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {state === 'en_route' ? (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenMaps} activeOpacity={0.85}>
              <Ionicons name="navigate-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Navigate to Pickup Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleImHere}>
              <Text style={styles.secondaryBtnText}>I'm at the pickup location</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmArrival} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Confirm at Pickup Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightGray },

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
    zIndex: 10,
  },

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

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },

  cardTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 16,
  },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center' },
  viewProfileText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginLeft: 4 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, gap: 8,
  },
  chatBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
  callBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },

  secondaryBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center' },
  secondaryBtnText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },
});