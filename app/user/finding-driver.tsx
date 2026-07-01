import QRCodeCard from '@/components/QRCodeCard';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

const { height } = Dimensions.get('window');
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

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

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#e8f0ee' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b3d4cc' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
];

type DeliveryStatus = 'finding_driver' | 'driver_assigned' | 'driver_arrived' | 'in_transit';

interface DriverInfo {
  _id: string;
  name: string;
  phone?: string;
  vehicle: { model: string; plateNumber: string };
  photo?: string;
  rating?: number;
}

interface DeliveryData {
  _id: string;
  pickupAddress: { label: string; coordinates: { lat: number; lng: number } };
  recipient: {
    name: string;
    phone?: string;
    address: { label: string; coordinates: { lat: number; lng: number } };
  };
  price: number;
  status: DeliveryStatus;
  driver?: DriverInfo;
  pickupCode?: string;
  deliveryCode?: string;
  eta?: string;
  createdAt?: string;
}

const calcDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))).toFixed(1);
};

const calcEta = (dLat1: number, dLng1: number, tLat: number, tLng: number): string => {
  const R = 6371;
  const dLat = ((tLat - dLat1) * Math.PI) / 180;
  const dLng = ((tLng - dLng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((dLat1 * Math.PI) / 180) * Math.cos((tLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const mins = Math.round((km / 20) * 60);
  if (mins < 1) return '< 1 min';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
};

export default function FindingDriverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [status, setStatus] = useState<DeliveryStatus>('finding_driver');
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [eta, setEta] = useState('');
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverDistance, setDriverDistance] = useState('');
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const { incrementUnread, clearUnread, unreadCounts } = useChatStore();
  const unreadCount = unreadCounts[deliveryId] ?? 0;

  const bannerAnim       = useRef(new Animated.Value(-130)).current;
  const tripDetailsAnim  = useRef(new Animated.Value(600)).current;
  const bannerTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTitleRef   = useRef('');
  const bannerBodyRef    = useRef('');
  const pulseAnim        = useRef(new Animated.Value(1)).current;
  const socketRef        = useRef<Socket | null>(null);
  const mapRef           = useRef<MapView>(null);

  const deliveryRef        = useRef<DeliveryData | null>(null);
  const driverReceivedRef  = useRef(false);
  const statusRef          = useRef<DeliveryStatus>('finding_driver');
  const userRef            = useRef(user);
  const driverRef          = useRef<DriverInfo | null>(null);
  const driverLocationRef  = useRef<{ lat: number; lng: number } | null>(null);
  const hasInitialFitRef   = useRef(false);

  // ── FIX 1: Polling interval ref ────────────────────────────────
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { deliveryRef.current = delivery; }, [delivery]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { driverRef.current = driver; }, [driver]);
  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);

  useEffect(() => {
    if (!user?.id || !socketRef.current?.connected) return;
    socketRef.current.emit('join_user_room', { userId: user.id });
  }, [user?.id]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (!deliveryId) return;

    // Reset all state for new delivery
    setStatus('finding_driver');
    setDriver(null);
    setPickupCode('');
    setDeliveryCode('');
    setDriverLocation(null);
    setDriverDistance('');
    setEta('');
    setRouteCoords([]);
    driverReceivedRef.current = false;
    statusRef.current = 'finding_driver';
    driverLocationRef.current = null;
    hasInitialFitRef.current = false;

    fetchDelivery();
    connectSocket();
    startPolling(); // ── FIX 2: Start polling immediately

    return () => {
      socketRef.current?.disconnect();
      stopPolling(); // ── FIX 2: Clean up polling on unmount
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [deliveryId]);

  useFocusEffect(
    useCallback(() => {
      if (!deliveryId || !driverReceivedRef.current) return;
      fetchDelivery().then(() => {
        const loc = driverLocationRef.current;
        if (!loc) return;
        const d = deliveryRef.current;
        if (!d) return;
        const target = statusRef.current === 'in_transit'
          ? d.recipient?.address?.coordinates
          : d.pickupAddress?.coordinates;
        if (target) fetchRoute(loc.lat, loc.lng, target.lat, target.lng);
      });
    }, [deliveryId])
  );

  // ── FIX 2: Polling helpers ──────────────────────────────────────
  // Polls every 3 seconds while status is finding_driver.
  // Catches driver_assigned even when the socket event is missed
  // (e.g. socket connected after the event was emitted, or old delivery
  // room was still active when a new delivery was started).
  const startPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(async () => {
      if (statusRef.current !== 'finding_driver') {
        stopPolling();
        return;
      }
      try {
        const { data } = await api.get(`/deliveries/${deliveryId}/status`);
        if (data.success && data.data.status !== 'finding_driver') {
          stopPolling();
          fetchDelivery();
        }
      } catch (_) {}
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // ── Core fetch ──────────────────────────────────────────────────
  const fetchDelivery = async () => {
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/status`);
      if (data.success) {
        const d: DeliveryData = data.data;
        setDelivery(d);

        if (driverReceivedRef.current) {
          if (d.status !== statusRef.current) {
            statusRef.current = d.status as DeliveryStatus;
            setStatus(d.status as DeliveryStatus);
          }
          if (d.pickupCode) setPickupCode(d.pickupCode);
          if (d.deliveryCode) setDeliveryCode(d.deliveryCode);
          return;
        }

        const coords = d.pickupAddress?.coordinates;
        if (coords && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coords.lat, longitude: coords.lng,
            latitudeDelta: 0.022, longitudeDelta: 0.022,
          }, 800);
        }

        if (d.status !== 'finding_driver') {
          statusRef.current = d.status as DeliveryStatus;
          setStatus(d.status as DeliveryStatus);
          if (d.driver) {
            setDriver(d.driver);
            const driverLoc = (d.driver as any)?.location?.coordinates;
            if (driverLoc && Array.isArray(driverLoc) && coords) {
              const loc = { lat: driverLoc[1], lng: driverLoc[0] };
              driverLocationRef.current = loc;
              setDriverLocation(loc);
              const target = d.status === 'in_transit'
                ? d.recipient?.address?.coordinates
                : coords;
              if (target) {
                setDriverDistance(calcDistance(loc, target));
                setEta(calcEta(loc.lat, loc.lng, target.lat, target.lng));
                fetchRoute(loc.lat, loc.lng, target.lat, target.lng);
              }
              if (!hasInitialFitRef.current && target) {
                hasInitialFitRef.current = true;
                mapRef.current?.fitToCoordinates(
                  [{ latitude: loc.lat, longitude: loc.lng }, { latitude: target.lat, longitude: target.lng }],
                  { edgePadding: { top: 80, right: 60, bottom: 300, left: 60 }, animated: true }
                );
              }
            }
          }
          if (d.pickupCode) setPickupCode(d.pickupCode);
          if (d.deliveryCode) setDeliveryCode(d.deliveryCode);
          if (d.driver) driverReceivedRef.current = true;
        }
      }
    } catch (err) {
      console.error('[FindingDriver] fetchDelivery error:', err);
    }
  };

  const fetchRoute = async (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    if (!GOOGLE_MAPS_KEY) return;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${fromLat},${fromLng}` +
        `&destination=${toLat},${toLng}` +
        `&mode=driving` +
        `&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        setRouteCoords(decodePolyline(data.routes[0].overview_polyline.points));
      }
    } catch (err) {
      console.error('[FindingDriver] fetchRoute error:', err);
    }
  };

  const connectSocket = () => {
    // Disconnect any existing socket before creating a new one
    socketRef.current?.disconnect();

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // ── FIX 3: Always fetch on connect, not just on reconnect ──────
    // Previously used isFirstConnect flag which meant a missed event
    // on first connect would never be recovered. Now we always fetch
    // so any driver assignment that happened before socket connected
    // is caught immediately.
    socket.on('connect', () => {
      const userId = userRef.current?.id;
      if (userId) socket.emit('join_user_room', { userId });
      fetchDelivery(); // always fetch — catches missed events
    });

    socket.on('driver_assigned', (payload) => {
      stopPolling(); // ── FIX 2: Stop polling — socket caught it
      driverReceivedRef.current = true;
      setDriver(payload.driver);
      setPickupCode(payload.pickupCode ?? '');

      if (payload.driverLocation) {
        const loc = payload.driverLocation;
        driverLocationRef.current = loc;
        setDriverLocation(loc);

        const pickupCoords = deliveryRef.current?.pickupAddress?.coordinates;
        if (pickupCoords) {
          setDriverDistance(calcDistance(loc, pickupCoords));
          setEta(calcEta(loc.lat, loc.lng, pickupCoords.lat, pickupCoords.lng));
          fetchRoute(loc.lat, loc.lng, pickupCoords.lat, pickupCoords.lng);

          if (!hasInitialFitRef.current) {
            hasInitialFitRef.current = true;
            mapRef.current?.fitToCoordinates(
              [
                { latitude: loc.lat, longitude: loc.lng },
                { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
              ],
              { edgePadding: { top: 80, right: 60, bottom: 300, left: 60 }, animated: true }
            );
          }
        }
      } else {
        setEta(payload.eta ?? '20 mins');
      }

      setStatus('driver_assigned');
      statusRef.current = 'driver_assigned';
      showBanner();
    });

    socket.on('driver_location', (payload) => {
      const loc = payload.location ?? payload;
      if (!loc?.lat) return;

      driverLocationRef.current = loc;
      setDriverLocation(loc);

      const isInTransit = statusRef.current === 'in_transit';
      const target = isInTransit
        ? deliveryRef.current?.recipient?.address?.coordinates
        : deliveryRef.current?.pickupAddress?.coordinates;

      if (target?.lat && target?.lng) {
        setDriverDistance(calcDistance(loc, target));
        setEta(calcEta(loc.lat, loc.lng, target.lat, target.lng));
      }
    });

    socket.on('driver_arrived', () => {
      statusRef.current = 'driver_arrived';
      setStatus('driver_arrived');
      setEta('Here');
      showBanner();
    });

    socket.on('package_picked_up', (payload) => {
      setDeliveryCode(payload.deliveryCode ?? '');
      statusRef.current = 'in_transit';
      setStatus('in_transit');
      hasInitialFitRef.current = false;
      setRouteCoords([]);

      const recipient = deliveryRef.current?.recipient?.address?.coordinates;
      const driverLoc = driverLocationRef.current;

      if (driverLoc && recipient?.lat && recipient?.lng) {
        setDriverDistance(calcDistance(driverLoc, recipient));
        setEta(calcEta(driverLoc.lat, driverLoc.lng, recipient.lat, recipient.lng));
        fetchRoute(driverLoc.lat, driverLoc.lng, recipient.lat, recipient.lng);

        const midLat = (driverLoc.lat + recipient.lat) / 2;
        const midLng = (driverLoc.lng + recipient.lng) / 2;
        const latDelta = Math.max(Math.abs(driverLoc.lat - recipient.lat) * 2.2, 0.025);
        const lngDelta = Math.max(Math.abs(driverLoc.lng - recipient.lng) * 2.2, 0.025);

        mapRef.current?.animateToRegion(
          { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta },
          800
        );
        hasInitialFitRef.current = true;
      }

      showBanner();
    });

    socket.on('new_message', (msg: any) => {
      if (msg.senderType !== 'driver') return;
      incrementUnread(deliveryId, msg.message, 'driver');
      bannerTitleRef.current = '💬 New message from driver';
      bannerBodyRef.current = msg.message?.slice(0, 80) ?? 'You have a new message';
      showBanner();
    });

    socket.on('package_delivered', () => {
      router.replace({
        pathname: '/user/delivery-complete',
        params: {
          deliveryId,
          price: String(deliveryRef.current?.price ?? 0),
          pickupLabel: deliveryRef.current?.pickupAddress?.label ?? '',
          destLabel: deliveryRef.current?.recipient?.address?.label ?? '',
          recipientName: deliveryRef.current?.recipient?.name ?? '',
          driverName: driverRef.current?.name ?? '',
          driverPhoto: driverRef.current?.photo ?? '',
          driverVehicle: driverRef.current?.vehicle?.model ?? '',
          driverPlate: driverRef.current?.vehicle?.plateNumber ?? '',
        },
      } as never);
    });

    socket.on('no_drivers_available', () => {
      Alert.alert(
        'No Drivers Found',
        'We could not find a driver nearby right now. Would you like to keep searching?',
        [
          {
            text: 'Keep Searching',
            onPress: () => {
              api.post(`/deliveries/${deliveryId}/find-driver`).catch(() => {});
            },
          },
          {
            text: 'Cancel Delivery',
            style: 'destructive',
            onPress: async () => {
              await api.post(`/deliveries/${deliveryId}/cancel`).catch(() => {});
              router.replace('/user/(tabs)/home' as never);
            },
          },
        ],
        { cancelable: false }
      );
    });

    socket.on('disconnect', (reason) => {
      console.log('[FindingDriver] Socket disconnected:', reason);
    });
  };

  const showBanner = () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    Animated.spring(bannerAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }).start();
    bannerTimerRef.current = setTimeout(hideBanner, 5000);
  };

  const hideBanner = () => {
    Animated.timing(bannerAnim, { toValue: -130, duration: 300, useNativeDriver: true }).start();
  };

  const openTripDetails = () => {
    setShowTripDetails(true);
    Animated.spring(tripDetailsAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }).start();
  };

  const closeTripDetails = () => {
    Animated.timing(tripDetailsAnim, { toValue: 600, duration: 280, useNativeDriver: true })
      .start(() => setShowTripDetails(false));
  };

  const handleShareTrip = async () => {
    try {
      await Share.share({
        title: 'Track My Package',
        message:
          `Track my Pickar delivery!\n\n` +
          `From: ${delivery?.pickupAddress?.label ?? ''}\n` +
          `To: ${delivery?.recipient?.address?.label ?? ''}\n\n` +
          `Tracking link: https://usepickar.com/track/${deliveryId}`,
      });
    } catch (err) {
      console.error('[FindingDriver] share error:', err);
    }
  };

  const handleTrackPackage = () => {
    closeTripDetails();
    setTimeout(() => {
      router.push({
        pathname: '/user/track-package',
        params: {
          deliveryId,
          driverName: driver?.name ?? '',
          driverPhoto: driver?.photo ?? '',
          driverVehicle: driver?.vehicle?.model ?? '',
          driverPlate: driver?.vehicle?.plateNumber ?? '',
          driverPhone: driver?.phone ?? '',
          pickupLabel: delivery?.pickupAddress?.label ?? '',
          pickupLat: String(delivery?.pickupAddress?.coordinates?.lat ?? 6.5244),
          pickupLng: String(delivery?.pickupAddress?.coordinates?.lng ?? 3.3792),
          destLabel: delivery?.recipient?.address?.label ?? '',
          destLat: String(delivery?.recipient?.address?.coordinates?.lat ?? 6.5244),
          destLng: String(delivery?.recipient?.address?.coordinates?.lng ?? 3.3792),
          recipientName: delivery?.recipient?.name ?? '',
          recipientPhone: delivery?.recipient?.phone ?? '',
          status,
          price: String(delivery?.price ?? 0),
          createdAt: delivery?.createdAt ?? '',
        },
      } as never);
    }, 300);
  };

  const handleCancelTrip = () => {
    Alert.alert('Cancel Trip', 'Are you sure you want to cancel this trip?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try { await api.post(`/deliveries/${deliveryId}/cancel`); } catch (_) {}
          finally { router.replace('/user/(tabs)/home' as never); }
        },
      },
    ]);
  };

  const handleCallDriver = () => {
    if (!driver?.phone) return Alert.alert('Unavailable', "Driver's phone number is not available.");
    Linking.openURL(`tel:${driver.phone}`).catch(() => Alert.alert('Error', 'Could not open the phone app.'));
  };

  const handleChatWithDriver = () => {
    if (!driver?._id) return;
    clearUnread(deliveryId);
    router.push({
      pathname: '/user/chat',
      params: {
        deliveryId,
        driverName: driver.name,
        driverPhoto: driver.photo ?? '',
        driverPhone: driver.phone ?? '',
      },
    } as never);
  };

  // ── Derived values ───────────────────────────────────────────────
  const isSearching    = status === 'finding_driver';
  const hasDriver      = !isSearching;
  const pickupCoords   = delivery?.pickupAddress?.coordinates;
  const recipientCoords = delivery?.recipient?.address?.coordinates;
  const targetCoords   = status === 'in_transit' ? recipientCoords : pickupCoords;

  const mapRegion = {
    latitude:  pickupCoords?.lat ?? 6.5244,
    longitude: pickupCoords?.lng ?? 3.3792,
    latitudeDelta: 0.022, longitudeDelta: 0.022,
  };

  const bannerTitle =
    status === 'in_transit'     ? 'Package Delivery Code'
    : status === 'driver_arrived' ? '🚗 Your driver is here!'
    : 'Your driver is on the way!';

  const bannerBody =
    status === 'in_transit'
      ? `Your ride has started. Package delivery code: ${deliveryCode}`
      : status === 'driver_arrived'
      ? 'Your driver has arrived. Please hand over your package.'
      : `Driver accepted. Your pick-up code is ${pickupCode}`;

  const cardTitle =
    status === 'driver_arrived' ? 'Your driver is here'
    : status === 'in_transit'   ? 'Trip Started'
    : 'Your driver is on the way';

  const codeLabel = status === 'in_transit' ? 'Package Delivery Code' : 'Pick Up Code';
  const codeValue = status === 'in_transit' ? deliveryCode : pickupCode;
  const codeDesc  =
    status === 'in_transit'
      ? 'Show this QR to the recipient to confirm delivery'
      : 'Show this QR to your driver to confirm pickup';

  const pickupLine1   = delivery?.pickupAddress?.label?.split(',')[0] ?? 'Pickup location';
  const pickupLine2   = delivery?.pickupAddress?.label?.split(',').slice(1).join(',').trim() ?? '';
  const priceDisplay  = `₦${delivery?.price?.toLocaleString() ?? '0'}`;

  const etaBadgeText =
    status === 'driver_arrived' ? 'Driver is here'
    : eta ? `Arriving in ${eta}`
    : 'Calculating...';

  return (
    <View style={styles.container}>

      {/* MAP */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          initialRegion={mapRegion}
          customMapStyle={MAP_STYLE}
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          moveOnMarkerPress={false}
          zoomEnabled
          scrollEnabled
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {targetCoords && (
            <Marker
              coordinate={{ latitude: targetCoords.lat, longitude: targetCoords.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pickupMarkerWrapper}>
                <View style={styles.pickupMarkerBubble}>
                  <Ionicons
                    name={status === 'in_transit' ? 'location' : 'person'}
                    size={15}
                    color={status === 'in_transit' ? Colors.primary : Colors.textSecondary}
                  />
                  {hasDriver && (
                    <Text style={styles.arrivesText}>
                      {status === 'driver_arrived' ? 'Driver here'
                        : status === 'in_transit' ? `Delivering in ${eta || '...'}`
                        : `Arrives in ${eta || '...'}`}
                    </Text>
                  )}
                </View>
                <View style={styles.markerTip} />
              </View>
            </Marker>
          )}

          {driverLocation && hasDriver && (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.driverMarkerWrapper}>
                <View style={styles.driverIconBox}>
                  <Ionicons name="car" size={18} color={Colors.white} />
                </View>
                <View style={styles.driverNameBox}>
                  <Text style={styles.driverNameBoxText}>
                    {driver?.name?.split(' ')[0] ?? 'Driver'}
                  </Text>
                  <Text style={styles.driverDistText}>
                    {driverDistance ? `${driverDistance} km away` : 'Locating...'}
                  </Text>
                </View>
              </View>
            </Marker>
          )}

          {hasDriver && (
            routeCoords.length > 0 ? (
              <Polyline
                coordinates={routeCoords}
                strokeColor={Colors.primary}
                strokeWidth={3}
                lineDashPattern={[8, 5]}
              />
            ) : (
              driverLocation && targetCoords && (
                <Polyline
                  coordinates={[
                    { latitude: driverLocation.lat, longitude: driverLocation.lng },
                    { latitude: targetCoords.lat, longitude: targetCoords.lng },
                  ]}
                  strokeColor={`${Colors.primary}50`}
                  strokeWidth={2}
                  lineDashPattern={[6, 4]}
                />
              )
            )
          )}
        </MapView>

        {isSearching && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/user/(tabs)/home' as never)}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}

        {hasDriver && (
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.push('/user/(tabs)/home' as never)}
          >
            <Ionicons name="home-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}

        {isSearching && (
          <View style={styles.searchingOverlay} pointerEvents="none">
            <View style={styles.searchRow}>
              <Animated.View style={[styles.searchCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="person-outline" size={22} color={Colors.textSecondary} />
              </Animated.View>
              <View style={styles.dashedLine}>
                {[...Array(7)].map((_, i) => <View key={i} style={styles.dash} />)}
              </View>
              <View style={styles.searchCircle}>
                <Ionicons name="car-outline" size={22} color={Colors.textSecondary} />
              </View>
            </View>
            <View style={styles.connectingPill}>
              <Text style={styles.connectingText}>Connecting you to a Driver</Text>
            </View>
          </View>
        )}

        {hasDriver && (
          <View style={styles.etaBadge}>
            <Ionicons name="calendar-outline" size={13} color={Colors.white} />
            <Text style={styles.etaBadgeText}>{etaBadgeText}</Text>
          </View>
        )}
      </View>

      {/* BANNER */}
      {hasDriver && (
        <Animated.View style={[styles.banner, { transform: [{ translateY: bannerAnim }] }]}>
          <View style={styles.bannerInner}>
            <Ionicons name="warning-outline" size={20} color="#D97706" style={{ marginTop: 1 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.bannerTitle}>{bannerTitle}</Text>
              <Text style={styles.bannerBody}>{bannerBody}</Text>
            </View>
            <TouchableOpacity onPress={hideBanner} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* BOTTOM CARD */}
      <View style={[styles.bottomCard, isSearching && styles.bottomCardShort]}>
        <View style={styles.dragHandle} />

        {isSearching ? (
          <>
            <Text style={styles.chooseLabel}>Choose pick-up location</Text>
            <View style={styles.addressRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>{pickupLine1}</Text>
                <Text style={styles.addressSub}>
                  {pickupLine2}{'  '}<Text style={styles.priceInline}>{priceDisplay}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.changeLocRow}>
                <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.changeLocText}>Change location</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.btn, styles.btnDisabled]} disabled activeOpacity={1}>
              <Text style={styles.btnText}>Confirm Pick-Up Location</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={styles.cardTitle}>{cardTitle}</Text>

            <View style={styles.driverRow}>
              <View style={styles.avatarBox}>
                {driver?.photo
                  ? <Image source={{ uri: driver.photo }} style={styles.avatar} />
                  : <Ionicons name="person" size={26} color={Colors.textSecondary} />
                }
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.driverName}>{driver?.name ?? 'Your Driver'}</Text>
                <Text style={styles.driverVehicleText}>
                  {driver?.vehicle?.model ?? ''}{'  '}
                  <Text style={styles.plateText}>{driver?.vehicle?.plateNumber ?? ''}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.profileBtn}>
                <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.profileBtnText}>View Driver's Profile</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.chatBtn} onPress={handleChatWithDriver}>
                <Ionicons name="chatbox-outline" size={17} color={Colors.primary} />
                <Text style={styles.chatBtnText}>Chat with Driver</Text>
                {unreadCount > 0 && (
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                <Ionicons name="call-outline" size={19} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {codeValue ? (
              <View style={styles.qrSection}>
                <QRCodeCard
                  code={codeValue}
                  title={codeLabel}
                  subtitle={codeDesc}
                />
              </View>
            ) : (
              <View style={styles.codeRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.codeLabel}>{codeLabel}</Text>
                  <Text style={styles.codeDesc}>Waiting for code...</Text>
                </View>
                <View style={styles.codeValueRow}>
                  <Text style={styles.codeValue}>----</Text>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.spotHeaderRow}>
              <Text style={styles.spotLabel}>Pick Up Spot</Text>
              <TouchableOpacity onPress={openTripDetails}>
                <Text style={styles.seeTripText}>See Trip Details</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.addressTitle}>{pickupLine1}</Text>
            <Text style={styles.addressSub}>
              {pickupLine2}{'  '}<Text style={styles.priceInline}>{priceDisplay}</Text>
            </Text>

            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={handleCancelTrip} activeOpacity={0.85}>
              <Text style={styles.btnText}>Cancel Trip</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* TRIP DETAILS SHEET */}
      {showTripDetails && (
        <>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeTripDetails} />
          <Animated.View style={[styles.tripDetailsSheet, { transform: [{ translateY: tripDetailsAnim }] }]}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={closeTripDetails}>
                <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Trip Details</Text>
              <TouchableOpacity onPress={closeTripDetails}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <View style={styles.tripRouteRow}>
              <View style={styles.redDot} />
              <Text style={styles.tripRouteText} numberOfLines={1}>{delivery?.pickupAddress?.label ?? ''}</Text>
              <TouchableOpacity style={styles.changeBtn}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.tripRouteRow}>
              <Ionicons name="location" size={14} color={Colors.textPrimary} />
              <Text style={[styles.tripRouteText, { marginLeft: 6 }]} numberOfLines={1}>{delivery?.recipient?.address?.label ?? ''}</Text>
              <TouchableOpacity>
                <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.sheetRow}>
              <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.sheetRowLabel}>Amount</Text>
              <Text style={styles.sheetRowValue}>{priceDisplay}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.sheetRow} onPress={handleShareTrip}>
              <Ionicons name="arrow-up-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.sheetRowLabel}>Share trip details</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.sheetRow} onPress={handleTrackPackage}>
              <Ionicons name="radio-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.sheetRowLabel}>Track Package</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightGray },
  mapContainer: { flex: 1 },

  backButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44, left: 20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },
  homeButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 44, left: 20,
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },

  searchingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  searchCircle: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: '#D1D5DB',
    backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center',
  },
  dashedLine: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  dash: { width: 10, height: 2, backgroundColor: Colors.primary, marginHorizontal: 2, borderRadius: 1, opacity: 0.55 },
  connectingPill: {
    backgroundColor: Colors.white, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  connectingText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary },

  etaBadge: {
    position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 6,
  },
  etaBadgeText: { color: Colors.white, fontFamily: Fonts.poppins.semiBold, fontSize: 13, marginLeft: 6 },

  pickupMarkerWrapper: { alignItems: 'center' },
  pickupMarkerBubble: {
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4, gap: 6,
  },
  arrivesText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textPrimary },
  markerTip: {
    width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.white, marginTop: -1,
  },

  driverMarkerWrapper: { alignItems: 'center' },
  driverIconBox: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.textPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  driverNameBox: {
    backgroundColor: Colors.textPrimary, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginTop: 3, alignItems: 'center',
  },
  driverNameBoxText: { color: Colors.white, fontFamily: Fonts.poppins.semiBold, fontSize: 11 },
  driverDistText: { color: '#9CA3AF', fontFamily: Fonts.poppins.regular, fontSize: 10 },

  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 99,
    backgroundColor: Colors.white, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    paddingTop: Platform.OS === 'ios' ? 58 : 42, paddingBottom: 18, paddingHorizontal: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 10,
  },
  bannerInner: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textPrimary, marginBottom: 2 },
  bannerBody: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  bottomCard: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    maxHeight: height * 0.54,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 14,
  },
  bottomCardShort: { maxHeight: height * 0.27 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },

  chooseLabel: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  addressTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  addressSub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  priceInline: { fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary },
  changeLocRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  changeLocText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginLeft: 3 },

  btn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.45 },
  btnCancel: { marginTop: 18 },
  btnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },

  cardTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, textAlign: 'center', marginBottom: 18 },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  driverName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  driverVehicleText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  plateText: { fontFamily: Fonts.poppins.medium, color: Colors.textPrimary },
  profileBtn: { flexDirection: 'row', alignItems: 'center' },
  profileBtnText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginLeft: 3 },

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 13, gap: 8,
    position: 'relative',
  },
  chatBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
  chatBadge: {
    position: 'absolute', top: -8, right: -8,
    backgroundColor: Colors.primary, borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  chatBadgeText: { fontFamily: Fonts.poppins.bold, fontSize: 10, color: Colors.white },
  callBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 14 },
  qrSection: { marginHorizontal: -20 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  codeDesc: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  codeValueRow: { flexDirection: 'row', alignItems: 'center' },
  codeValue: { fontFamily: Fonts.poppins.bold, fontSize: 24, color: Colors.textPrimary },

  spotHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  spotLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textSecondary },
  seeTripText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.primary },

  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40 },
  tripDetailsSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 24, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  tripRouteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  tripRouteText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  routeConnector: { width: 1.5, height: 16, backgroundColor: Colors.border, marginLeft: 5 },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeBtnText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  sheetRowLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary, flex: 1 },
  sheetRowValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
});