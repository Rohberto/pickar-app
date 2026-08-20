import LiveLocationMarker from '@/components/map/LiveLocationMarker';
import VehicleSetupModal from '@/components/VehicleSetupModal';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { storage } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const CLOUDINARY_CLOUD = 'dtr1shkje';
const CLOUDINARY_PRESET = 'pickar_profiles';

// Kept the color palette but dropped the poi/transit visibility:'off'
// overrides — those were hiding landmarks, shops, bus stops etc.
// wholesale, which makes the map read as bare/broken next to a real
// mapping app. Same fix already applied on the user-side maps.
const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f9fafb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Only two meaningful stops here (unlike the user home sheet's three) —
// there's no extra scrollable content to reveal by expanding further up,
// just the fixed greeting/stats/CTA block. So: its normal resting height,
// or dragged almost all the way down to uncover the map.
const SHEET_OPEN   = SCREEN_HEIGHT * 0.52;
const SHEET_CLOSED = SCREEN_HEIGHT - 90;
const TAP_THRESHOLD_PX = 6;

interface TripOffer {
  deliveryId: string;
  pickup: { label: string; coordinates: { lat: number; lng: number } };
  destination: { label: string; coordinates: { lat: number; lng: number } };
  recipientName?: string;
  recipientPhone?: string;
  userPhone?: string;
  packageType: string;
  price: number;
  rideType: string;
  timeoutSeconds: number;
  userPhoto?: string;
}

interface IncomingRequest {
  deliveryId: string;
  userName: string;
  userPhoto?: string;
  userPhone?: string;
  recipientPhone?: string;
  pickupLabel: string;
  pickupCoords: { lat: number; lng: number };
  destLabel: string;
  price: number;
  estimatedDuration: string;
}

// Module-level flag — survives remounts, prevents navigation loop
let hasCheckedActiveTripOnce = false;

// Persists the driver's last online/offline choice across app restarts.
// The backend still flips a driver to 'offline' whenever their socket
// disconnects (correct — a closed app truly can't receive trips), so this
// preference is what lets us silently bring them back online on relaunch
// instead of leaving them stuck offline until they flip the switch again.
const DRIVER_ONLINE_PREF_KEY = 'driver_online_pref';

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth() as any;

  const [isOnline, setIsOnline] = useState(false);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<string | null>((user as any)?.photo ?? null);
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [activeTrips, setActiveTrips] = useState<string[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [driverRating, setDriverRating] = useState<string>('—');
  const [profileLoading, setProfileLoading] = useState(true);
  const [vehicleInfo, setVehicleInfo] = useState<{ type: string; plateNumber: string } | null>(null);
  const [showVehicleSetup, setShowVehicleSetup] = useState(false);
  const [homeSheetClosed, setHomeSheetClosed] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const socketRef = useRef<Socket | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);
  const isOnlineRef = useRef(false);
  const driverProfileIdRef = useRef<string | null>(null);
  const driverLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const sheetAnim = useRef(new Animated.Value(700)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);
  const hasCenteredRef = useRef(false);

  // ─── Draggable home sheet (greeting/stats/CTA) ─────────────────────
  const homeSheetTop = useRef(new Animated.Value(SHEET_OPEN)).current;
  const lastHomeSheetTop = useRef(SHEET_OPEN);

  const snapHomeSheetTo = (destination: number) => {
    lastHomeSheetTop.current = destination;
    setHomeSheetClosed(destination === SHEET_CLOSED);
    Animated.spring(homeSheetTop, {
      toValue: destination,
      useNativeDriver: false,
      tension: 60,
      friction: 12,
    }).start();
  };

  const homeSheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderMove: (_, { dy }) => {
        const next = lastHomeSheetTop.current + dy;
        const clamped = Math.max(SHEET_OPEN, Math.min(SHEET_CLOSED, next));
        homeSheetTop.setValue(clamped);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (Math.abs(dy) < TAP_THRESHOLD_PX) {
          const isClosed = lastHomeSheetTop.current === SHEET_CLOSED;
          snapHomeSheetTo(isClosed ? SHEET_OPEN : SHEET_CLOSED);
          return;
        }
        const current = lastHomeSheetTop.current + dy;
        const projected = current + vy * 80;
        const stops = [SHEET_OPEN, SHEET_CLOSED];
        const destination = stops.reduce((closest, stop) =>
          Math.abs(stop - projected) < Math.abs(closest - projected) ? stop : closest
        );
        snapHomeSheetTo(destination);
      },
    })
  ).current;

  // ─── Pulse animation ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  // ─── Mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDriverProfile();
    return () => {
      isMountedRef.current = false;
      socketRef.current?.disconnect();
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!driverProfileId) return;
    connectSocket();
    fetchStats();
    if (!hasCheckedActiveTripOnce) {
      hasCheckedActiveTripOnce = true;
      checkActiveTrip();
    }
    return () => { socketRef.current?.disconnect(); };
  }, [driverProfileId]);

  useEffect(() => { driverProfileIdRef.current = driverProfileId; }, [driverProfileId]);
  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);

  // ─── Driver profile ───────────────────────────────────────────────
  const fetchDriverProfile = async () => {
    try {
      const { data } = await api.get('/drivers/me');
      if (data.success) {
        setDriverProfileId(data.data._id);
        driverProfileIdRef.current = data.data._id;
        if (data.data.photo) setDriverPhoto(data.data.photo);
        const avg = data.data.rating?.average;
        setDriverRating(avg && avg > 0 ? String(avg.toFixed(1)) : '—');
        const hasVehicle = !!(data.data.vehicle?.type && data.data.vehicle?.plateNumber);
        if (hasVehicle) setVehicleInfo(data.data.vehicle);

        // Restore online status if the driver was online right before they
        // closed the app — otherwise every relaunch silently drops them
        // to offline even though nothing about their intent changed.
        const wasOnline = await storage.get(DRIVER_ONLINE_PREF_KEY);
        if (wasOnline && hasVehicle) {
          goOnlineNow(data.data._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch driver profile:', err);
      if (err instanceof Error) {
        console.log('[DriverHome] fetchDriverProfile:', err.message);
      } else {
        console.log('[DriverHome] fetchDriverProfile:', String(err));
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/drivers/earnings');
      if (data.success) {
        setTodayEarnings(data.data.todayEarnings ?? 0);
        setTotalTrips(data.data.allTimeRides ?? 0);
      }
    } catch (_) {}
  };

  // ─── Active trip check ────────────────────────────────────────────
  const checkActiveTrip = async () => {
    try {
      const { data } = await api.get('/drivers/active-trip');
      if (!isMountedRef.current) return;
      if (data.success && data.data) {
        const delivery = data.data;
        if (delivery.status === 'driver_assigned') {
          router.replace({
            pathname: '/driver/navigate-pickup',
            params: {
              deliveryId: delivery._id,
              userName: delivery.recipient?.name ?? '',
              userPhoto: delivery.user?.photo ?? '',
              pickupLabel: delivery.pickupAddress?.label ?? '',
              pickupLat: String(delivery.pickupAddress?.coordinates?.lat ?? 6.5244),
              pickupLng: String(delivery.pickupAddress?.coordinates?.lng ?? 3.3792),
              destLabel: delivery.recipient?.address?.label ?? '',
              price: String(delivery.price ?? 0),
            },
          } as never);
        } else if (delivery.status === 'driver_arrived') {
          router.replace({
            pathname: '/driver/at-pickup',
            params: {
              deliveryId: delivery._id,
              userName: delivery.recipient?.name ?? '',
              userPhoto: delivery.user?.photo ?? '',
              pickupLat: String(delivery.pickupAddress?.coordinates?.lat ?? 6.5244),
              pickupLng: String(delivery.pickupAddress?.coordinates?.lng ?? 3.3792),
            },
          } as never);
        } else if (delivery.status === 'in_transit') {
          router.replace({
            pathname: '/driver/navigate-delivery',
            params: {
              deliveryId: delivery._id,
              userName: delivery.recipient?.name ?? '',
              userPhoto: delivery.user?.photo ?? '',
              deliveryCode: delivery.deliveryCode ?? '',
              destLabel: delivery.recipient?.address?.label ?? '',
              destLat: String(delivery.recipient?.address?.coordinates?.lat ?? 6.5244),
              destLng: String(delivery.recipient?.address?.coordinates?.lng ?? 3.3792),
              recipientName: delivery.recipient?.name ?? '',
              recipientPhone: delivery.recipient?.phone ?? '',
              price: String(delivery.price ?? 0),
              pickupLabel: delivery.pickupAddress?.label ?? '',
              pickupLat: String(delivery.pickupAddress?.coordinates?.lat ?? 6.5244),
              pickupLng: String(delivery.pickupAddress?.coordinates?.lng ?? 3.3792),
            },
          } as never);
        }
      }
    } catch (_) {}
  };

  // ─── Location ─────────────────────────────────────────────────────
  // Position + heading are now owned by <LiveLocationMarker> (the same
  // reactive, compass-driven "blue dot" used on the user home map) — its
  // onLocationChange callback below is the only thing driving
  // driverLocation now. This file just centers the map on the first fix
  // and, while online, emits that live position to the backend on a
  // timer so match-making sees fresh coordinates.
  const handleLiveLocationChange = (coords: { latitude: number; longitude: number }) => {
    setDriverLocation(coords);
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
    }
  };

  // ─── Recenter button — snaps the map back to the live GPS dot ──
  const handleRecenter = () => {
    if (!driverLocation) return;
    mapRef.current?.animateToRegion(
      { ...driverLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      500
    );
  };

  const startLocationTracking = () => {
    locationIntervalRef.current = setInterval(() => {
      const id = driverProfileIdRef.current;
      const loc = driverLocationRef.current;
      if (loc && id) {
        socketRef.current?.emit('driver_location_update', {
          driverId: id,
          lat: loc.latitude,
          lng: loc.longitude,
        });
      }
    }, 5000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };

  // ─── Socket ───────────────────────────────────────────────────────
  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (isOnlineRef.current && driverProfileIdRef.current) {
        const loc = driverLocationRef.current;
        socket.emit('driver_online', {
          driverId: driverProfileIdRef.current,
          lat: loc?.latitude ?? 6.5244,
          lng: loc?.longitude ?? 3.3792,
        });
      }
    });

    socket.on('trip_offer', (payload: TripOffer) => {
      setIncomingRequest({
        deliveryId: payload.deliveryId,
        userName: payload.recipientName ?? 'Customer',
        userPhoto: payload.userPhoto,
        userPhone: payload.userPhone ?? '',
        recipientPhone: payload.recipientPhone ?? '',
        pickupLabel: payload.pickup?.label ?? '',
        pickupCoords: payload.pickup?.coordinates ?? { lat: 0, lng: 0 },
        destLabel: payload.destination?.label ?? '',
        price: payload.price,
        estimatedDuration: payload.timeoutSeconds
          ? `${Math.ceil(payload.timeoutSeconds / 60)} mins`
          : '30 mins',
      });
      showSheet();
    });
  };

  // ─── Go online logic (extracted so it can be called without depending on vehicleInfo state) ──
  // Accepts an explicit driverId so it can be called from fetchDriverProfile
  // (on app launch, to restore prior online status) before driverProfileId
  // state has actually committed.
  const goOnlineNow = async (idOverride?: string) => {
    const id = idOverride ?? driverProfileId;
    setIsOnline(true);
    isOnlineRef.current = true;
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      socketRef.current?.emit('driver_online', {
        driverId: id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
      api.post('/drivers/online', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      }).catch(() => {});
      startLocationTracking();
    } catch {
      // Location permission denied — still mark online, socket will update on next ping
    }
  };

  // ─── Online toggle ────────────────────────────────────────────────
  const handleToggleOnline = async (value: boolean) => {
    if (value && !vehicleInfo) {
      // Vehicle info missing — show setup modal, do not go online yet
      setShowVehicleSetup(true);
      return;
    }
    if (value) {
      await goOnlineNow();
      storage.set(DRIVER_ONLINE_PREF_KEY, true);
    } else {
      setIsOnline(false);
      isOnlineRef.current = false;
      socketRef.current?.emit('driver_offline', { driverId: driverProfileId });
      api.post('/drivers/offline').catch(() => {});
      stopLocationTracking();
      storage.set(DRIVER_ONLINE_PREF_KEY, false);
    }
  };

  // ─── Photo upload ─────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as any);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('folder', 'pickar/drivers');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload failed');

      await api.patch('/drivers/me', { photo: data.secure_url });
      setDriverPhoto(data.secure_url);
      if (user) setUser({ ...user, photo: data.secure_url });
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Sheet helpers ────────────────────────────────────────────────
  const showSheet = () => {
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const hideSheet = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 700, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setIncomingRequest(null));
  };

  // ─── Accept / Decline ─────────────────────────────────────────────
  const handleAccept = async () => {
    if (!incomingRequest || accepting) return;
    console.log(incomingRequest);
    setAccepting(true);
    const { deliveryId } = incomingRequest;
    const isAdditional = activeTrips.length > 0;
    try {
      await api.post(`/deliveries/${deliveryId}/assign-driver`);
      setActiveTrips(prev => [...prev, deliveryId]);
      hideSheet();
      if (!isAdditional) {
        router.push({
          pathname: '/driver/navigate-pickup',
          params: {
            deliveryId,
            userName: incomingRequest.userName,
            userPhoto: incomingRequest.userPhoto ?? '',
            recipientPhone: incomingRequest.recipientPhone ?? '',
            userPhone: incomingRequest.userPhone ?? '',
            pickupLabel: incomingRequest.pickupLabel,
            pickupLat: String(incomingRequest.pickupCoords.lat),
            pickupLng: String(incomingRequest.pickupCoords.lng),
            destLabel: incomingRequest.destLabel,
            price: String(incomingRequest.price),
          },
        } as never);
      }
    } catch (err) {
      console.error('[DriverHome] accept error:', err);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    if (!incomingRequest) return;
    socketRef.current?.emit(`trip_response_${incomingRequest.deliveryId}`, { accepted: false });
    hideSheet();
  };

  const hasActiveTrip = activeTrips.length > 0;
  const firstName = (user?.fullName || user?.name || 'Driver').split(' ')[0];
  const avatarUri = driverPhoto
    ? driverPhoto
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || user?.name || 'D')}&background=8B1538&color=fff&size=128&bold=true`;

  return (
    <View style={styles.container}>

      {/* ── MAP ─────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        initialRegion={{
          latitude: driverLocation?.latitude ?? 6.5244,
          longitude: driverLocation?.longitude ?? 3.3792,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <LiveLocationMarker onLocationChange={handleLiveLocationChange} />
      </MapView>

      {/* ── FLOATING HEADER ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            style={styles.avatarPressable}
            onPress={() => router.push('/driver/(tabs)/account' as never)}
          >
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cameraBadge}
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto
              ? <ActivityIndicator size={9} color="#fff" />
              : <Ionicons name="camera" size={10} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        <View style={styles.onlineRow}>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={profileLoading}
            trackColor={{ false: Colors.border, true: Colors.primary }}
            thumbColor={Colors.white}
            ios_backgroundColor={Colors.border}
            style={styles.switch}
          />
          <Text style={[styles.onlineLabel, isOnline && styles.onlineLabelActive]}>
            {profileLoading ? 'Loading...' : isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {hasActiveTrip && (
          <View style={styles.activeTripBadge}>
            <Ionicons name="cube-outline" size={13} color={Colors.white} />
            <Text style={styles.activeTripText}>{activeTrips.length} active</Text>
          </View>
        )}

        <TouchableOpacity style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── RECENTER FAB — snaps the map back to current location ── */}
      <TouchableOpacity
        style={styles.recenterFab}
        activeOpacity={0.85}
        onPress={handleRecenter}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="locate" size={20} color={Colors.primary} />
      </TouchableOpacity>

      {/* ── REOPEN FAB — shown once the sheet is dragged fully closed ── */}
      {homeSheetClosed && (
        <TouchableOpacity
          style={styles.reopenFab}
          activeOpacity={0.85}
          onPress={() => snapHomeSheetTo(SHEET_OPEN)}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="chevron-up" size={24} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* ── GRADIENT BOTTOM SHEET — draggable, same pattern as user home ── */}
      <Animated.View
        style={[styles.bottomSheet, { top: homeSheetTop }]}
        pointerEvents={homeSheetClosed ? 'none' : 'auto'}
      >
        <LinearGradient
          colors={['#9B1515', '#3D0707']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />
        <View {...homeSheetPanResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingHi}>Hi {firstName} 👋</Text>
            <Text style={styles.greetingSub}>
              {isOnline ? "You're online — waiting for requests" : 'Go online to start receiving requests'}
            </Text>
          </View>
          {isOnline && (
            <Animated.View style={[styles.onlinePulseOuter, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.onlinePulseDot} />
            </Animated.View>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statValue}>₦{todayEarnings.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Today's earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Ionicons name="bicycle-outline" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statValue}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Total rides</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Ionicons name="star-outline" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={styles.statValue}>{driverRating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {isOnline ? (
          <View style={styles.waitingBox}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
            <Text style={styles.waitingText}>Listening for nearby delivery requests...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.goOnlineBtn}
            onPress={() => handleToggleOnline(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="radio-outline" size={18} color="#9B1515" style={{ marginRight: 8 }} />
            <Text style={styles.goOnlineBtnText}>Go Online & Find Rides</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {incomingRequest && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="none"
        />
      )}

      {incomingRequest && (
        <Animated.View style={[styles.requestSheet, { transform: [{ translateY: sheetAnim }] }]}>
          <View style={styles.sheetDragHandle} />

          {hasActiveTrip && (
            <View style={styles.multiPkgBanner}>
              <Ionicons name="layers-outline" size={15} color={Colors.primary} />
              <Text style={styles.multiPkgText}>Add this package to your current route</Text>
            </View>
          )}

          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.sheetTitle}>Ride request – Delivery</Text>
              <Text style={styles.sheetSubtitle}>
                {incomingRequest.userName} wants to deliver a package
              </Text>
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{incomingRequest.estimatedDuration} Trip</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.userRow}>
            <View style={styles.userAvatarBox}>
              {incomingRequest.userPhoto
                ? <Image source={{ uri: incomingRequest.userPhoto }} style={styles.userAvatar} />
                : <Ionicons name="person" size={22} color={Colors.textSecondary} />
              }
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.userName}>{incomingRequest.userName}</Text>
            </View>
            <TouchableOpacity style={styles.viewProfileBtn}>
              <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.viewProfileText}>View Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.addressRow}>
            <View style={styles.redDot} />
            <Text style={styles.addressLabel} numberOfLines={1}>
              {incomingRequest.pickupLabel}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.textPrimary} />
            <Text style={[styles.addressLabel, { marginLeft: 12, flex: 1 }]} numberOfLines={1}>
              {incomingRequest.destLabel}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.priceLabel}>Fair estimate</Text>
            <Text style={styles.priceValue}>₦{incomingRequest.price.toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.actionRow}>
            <Pressable
              style={styles.declineBtn}
              onPress={handleDecline}
              disabled={accepting}
            >
              <Text style={styles.declineBtnText}>Decline</Text>
            </Pressable>
            <Pressable
              style={[styles.acceptBtn, accepting && { opacity: 0.7 }]}
              onPress={handleAccept}
              disabled={accepting}
            >
              <Text style={styles.acceptBtnText}>
                {accepting ? 'Accepting...' : hasActiveTrip ? 'Add to Route' : 'Accept Delivery'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* ── VEHICLE SETUP MODAL ──────────────────────────────────── */}
      {/* Fires when driver tries to go online without vehicle info  */}
      {/* onComplete calls goOnlineNow() directly — bypasses the     */}
      {/* vehicleInfo state check which would still be null due to   */}
      {/* React's async state batching.                              */}
      <VehicleSetupModal
        visible={showVehicleSetup}
        onComplete={(vehicle) => {
          setVehicleInfo(vehicle);   // saves for future toggles
          setShowVehicleSetup(false);
          goOnlineNow();             // go online directly, no state dependency
          storage.set(DRIVER_ONLINE_PREF_KEY, true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

  reopenFab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 28,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    zIndex: 9,
  },

  // Sits just above the sheet's default (open) resting position, same
  // idea as the user home screen's recenter button.
  recenterFab: {
    position: 'absolute',
    right: 16,
    bottom: SCREEN_HEIGHT - SHEET_OPEN + 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
    zIndex: 8,
  },

  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 50,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, zIndex: 10,
  },
  avatarContainer: { width: 40, height: 40, position: 'relative', marginRight: 4 },
  avatarPressable: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.primary,
  },
  avatar: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  onlineRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  switch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  onlineLabel: {
    fontFamily: Fonts.poppins.medium, fontSize: 13,
    color: Colors.textSecondary, marginLeft: 4,
  },
  onlineLabelActive: { color: Colors.textPrimary },
  activeTripBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, marginRight: 6, gap: 4,
  },
  activeTripText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11, color: Colors.white },
  bellWrap: { marginLeft: 4, padding: 4 },

  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  dragHandleArea: {
    alignItems: 'center', paddingTop: 12, paddingBottom: 6, paddingHorizontal: 60,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  greetingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
  },
  greetingHi: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: '#fff' },
  greetingSub: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.6)', marginTop: 2,
  },
  onlinePulseOuter: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  onlinePulseDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#4ADE80',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: Fonts.poppins.bold, fontSize: 16, color: '#fff' },
  statLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 10,
    color: 'rgba(255,255,255,0.55)', textAlign: 'center',
  },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)' },

  waitingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  waitingText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  goOnlineBtn: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  goOnlineBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: '#9B1515' },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 20,
  },
  requestSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  sheetDragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  multiPkgBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
  },
  multiPkgText: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: Colors.primary, flex: 1,
  },
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  sheetTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  sheetSubtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, marginTop: 2,
  },
  durationBadge: {
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  durationText: { fontFamily: Fonts.poppins.semiBold, fontSize: 12, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center' },
  userAvatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  viewProfileBtn: { flexDirection: 'row', alignItems: 'center' },
  viewProfileText: {
    fontFamily: Fonts.poppins.regular, fontSize: 11,
    color: Colors.textSecondary, marginLeft: 4,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  addressLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textPrimary, marginLeft: 12, flex: 1,
  },
  routeConnector: {
    width: 1.5, height: 14, backgroundColor: Colors.border,
    marginLeft: 5, marginVertical: 2,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, flex: 1,
  },
  priceValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  declineBtn: {
    flex: 1, paddingVertical: 15, alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.primary,
  },
  declineBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.primary },
  acceptBtn: {
    flex: 2, paddingVertical: 15, alignItems: 'center',
    borderRadius: 14, backgroundColor: Colors.primary,
  },
  acceptBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },
});