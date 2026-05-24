import ChatButton from '@/components/ChatButton';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function AtPickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string;
  const userName = params.userName as string;
  const userPhoto = params.userPhoto as string;
  const userPhone = params.userPhone as string;
const recipientPhone = params.recipientPhone as string;
  const pickupLat = parseFloat(params.pickupLat as string) || 6.5244;
  const pickupLng = parseFloat(params.pickupLng as string) || 3.3792;

  const [loading, setLoading] = useState(false);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const driverProfileIdRef = useRef<string | null>(null);

  // isMountedRef — prevents stale socket events from navigating
  // after the screen has already unmounted
  const isMountedRef = useRef(false);

  // ─── Mount ───────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchDriverProfile();
    connectSocket();
    notifyUserOfArrival();
    return () => {
      isMountedRef.current = false;
      socketRef.current?.disconnect();
    };
  }, []);

  // ─── Keep ref in sync ────────────────────────────────────────────
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
      console.error('[AtPickup] fetchDriverProfile:', err);
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
      console.log('[AtPickup] Socket connected');
      if (driverProfileIdRef.current) {
        socket.emit('join_driver_room', { driverId: driverProfileIdRef.current });
      }
    });

    // User cancelled while driver is at pickup
    // isMountedRef guard prevents "navigate before mounting" error
    socket.on('trip_cancelled', () => {
      if (!isMountedRef.current) return;
      Alert.alert(
        'Trip Cancelled',
        'The user has cancelled this trip.',
        [{
          text: 'OK',
          onPress: () => {
            // setTimeout ensures Root Layout is fully mounted before navigation
            setTimeout(() => {
              router.replace('/driver/(tabs)/Home' as never);
            }, 300);
          },
        }]
      );
    });
  };

  // ─── Notify user of arrival ───────────────────────────────────────
  const notifyUserOfArrival = async () => {
    try {
      console.log('[AtPickup] Calling driver-arrived for:', deliveryId);
      const { data } = await api.post(`/deliveries/${deliveryId}/driver-arrived`);
      console.log('[AtPickup] driver-arrived response:', data);
    } catch (err) {
      console.error('[AtPickup] notifyUserOfArrival:', err);
    }
  };

  // ─── Actions ──────────────────────────────────────────────────────
  const handleCallUser = () => {
    Linking.openURL('tel:').catch(() => {});
  };

  const handleStartDelivery = async () => {
    setLoading(true);
    try {
      router.push({
        pathname: '/driver/confirm-pickup',
        params: { deliveryId, userName, userPhoto, userPhone, recipientPhone },
      } as never);
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* MAP */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        initialRegion={{
          latitude: pickupLat,
          longitude: pickupLng,
          latitudeDelta: 0.018,
          longitudeDelta: 0.018,
        }}
      >
        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.driverMarkerWrapper}>
            <View style={styles.driverIconBox}>
              <Ionicons name="car" size={18} color={Colors.white} />
            </View>
            <View style={styles.driverNameBox}>
              <Text style={styles.driverNameText}>You</Text>
              <Text style={styles.driverAtText}>At Pickup Location</Text>
            </View>
          </View>
        </Marker>
      </MapView>

      <TouchableOpacity style={styles.backButton}  onPress={() => {if (router.canGoBack()) router.back();
else router.replace('/user/(tabs)/home');}}>
        <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* BOTTOM CARD */}
      <View style={styles.bottomCard}>
        <View style={styles.dragHandle} />

        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={38} color={Colors.white} />
        </View>

        <Text style={styles.title}>At Pickup Location</Text>
        <Text style={styles.subtitle}>
          Your customer has been notified of your arrival
        </Text>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
                  <ChatButton
            deliveryId={deliveryId}
            side="driver"
            variant="full"           // just the icon with badge
            userName={userName}
            userPhoto={userPhoto}
            userPhone={userPhone}
          />
          <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${params.recipientPhone}`)}>
            <Ionicons name="call-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="person-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartDelivery}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.primaryBtnText}>Start Delivery</Text>
          }
        </TouchableOpacity>
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
  driverAtText: { color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.poppins.regular, fontSize: 10 },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 16,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, marginBottom: 20,
  },

  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },

  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: Colors.textPrimary,
    marginBottom: 6, textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 4,
  },

  divider: {
    width: '100%', height: 1,
    backgroundColor: Colors.border, marginVertical: 16,
  },

  actionRow: { flexDirection: 'row', gap: 10, width: '100%', alignItems: 'center' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, gap: 8,
  },
  actionBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.white },
});