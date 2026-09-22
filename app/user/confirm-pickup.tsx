import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

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

// ─── Decode Google encoded polyline (same helper used across nav screens) ──
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

interface Coords { lat: number; lng: number }

// Splits "12 Olagbaiye Street, Mushin, Lagos" into a bold headline
// ("12 Olagbaiye Street") and a lighter subtitle ("Mushin, Lagos").
const splitAddress = (full: string) => {
  const parts = (full || '').split(',');
  return {
    title: (parts[0] || 'Unknown location').trim(),
    subtitle: parts.slice(1).join(',').trim() || 'Lagos',
  };
};

export default function ConfirmPickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [destLabel, setDestLabel] = useState('');
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDistanceText, setRouteDistanceText] = useState('');
  const [price, setPrice] = useState(0);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchDeliveryDetails();
  }, []);

  const fetchDeliveryDetails = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}/status`);
      if (response.data.success) {
        const delivery = response.data.data;
        setPickupLabel(delivery.pickupAddress?.label || 'Unknown location');
        setDestLabel(delivery.recipient?.address?.label || 'Unknown location');
        setPrice(delivery.price || 0);
        setScheduledFor(delivery.scheduledFor || null);

        const pickup = delivery.pickupAddress?.coordinates;
        const dest = delivery.recipient?.address?.coordinates;
        if (pickup?.lat && dest?.lat) {
          setPickupCoords(pickup);
          setDestCoords(dest);
          fetchRoute(pickup, dest);
        }
      }
    } catch (error: any) {
      console.error('Error fetching delivery:', error);
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  // ─── Route preview — real road distance, not a straight line ──────
  const fetchRoute = async (pickup: Coords, dest: Coords) => {
    if (!GOOGLE_MAPS_KEY) return;
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${pickup.lat},${pickup.lng}` +
        `&destination=${dest.lat},${dest.lng}` +
        `&mode=driving` +
        `&key=${GOOGLE_MAPS_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        const decoded = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(decoded);
        setRouteDistanceText(data.routes[0].legs[0].distance.text);
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(decoded, {
            edgePadding: { top: 100, right: 60, bottom: 320, left: 60 },
            animated: true,
          });
        }, 100);
      }
    } catch (err) {
      console.error('[ConfirmPickup] fetchRoute error:', err);
    }
  };

  const handleChangeAddresses = () => {
    Alert.alert(
      'Change addresses',
      'Do you want to go back and change your pickup or delivery address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: () => {
            router.back();
            router.back();
            router.back(); // Back to send-package screen
          },
        },
      ]
    );
  };

  const handleConfirmPickup = async () => {
    setConfirming(true);
    try {
      const response = await api.post(`/deliveries/${deliveryId}/confirm-pickup`);

      if (response.data.success) {
        router.replace({
          pathname: response.data.scheduled ? '/user/scheduled-delivery' : '/user/finding-driver',
          params: { deliveryId },
        } as never);
      }
    } catch (error: any) {
      console.error('Error confirming pickup:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to confirm pickup. Please try again.'
      );
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const pickup = splitAddress(pickupLabel);
  const dest = splitAddress(destLabel);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── MAP ──────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        initialRegion={{
          latitude: pickupCoords?.lat ?? 6.5244,
          longitude: pickupCoords?.lng ?? 3.3792,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }}
      >
        {routeCoords.length > 0 ? (
          <Polyline coordinates={routeCoords} strokeColor={Colors.primary} strokeWidth={4} />
        ) : pickupCoords && destCoords ? (
          <Polyline
            coordinates={[
              { latitude: pickupCoords.lat, longitude: pickupCoords.lng },
              { latitude: destCoords.lat, longitude: destCoords.lng },
            ]}
            strokeColor={`${Colors.primary}60`}
            strokeWidth={2}
            lineDashPattern={[8, 6]}
          />
        ) : null}

        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.pickupMarker}>
              <Ionicons name="cube" size={14} color={Colors.white} />
            </View>
          </Marker>
        )}

        {destCoords && (
          <Marker
            coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.destMarkerWrapper}>
              <View style={styles.destMarkerBubble}>
                <Ionicons name="location" size={13} color={Colors.primary} />
                <Text style={styles.destMarkerText}>Drop-off</Text>
              </View>
              <View style={styles.destMarkerTip} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── BACK BUTTON ──────────────────────────────────────────── */}
      <SafeAreaView style={styles.backButtonSafeArea}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </Pressable>
      </SafeAreaView>

      {/* ── BOTTOM CARD ──────────────────────────────────────────── */}
      <View style={styles.bottomCard}>
        <View style={styles.dragHandle} />
        <Text style={styles.title}>Confirm your delivery</Text>

        {/* Pickup row */}
        <View style={styles.addressRow}>
          <View style={styles.addressIconCol}>
            <View style={styles.pickupDot} />
          </View>
          <View style={styles.addressTextCol}>
            <Text style={styles.addressKicker}>Pickup</Text>
            <Text style={styles.addressTitle} numberOfLines={1}>{pickup.title}</Text>
            <Text style={styles.addressSubtitle} numberOfLines={1}>{pickup.subtitle}</Text>
          </View>
        </View>

        <View style={styles.routeConnectorCol}>
          <View style={styles.routeConnector} />
        </View>

        {/* Delivery row */}
        <View style={styles.addressRow}>
          <View style={styles.addressIconCol}>
            <Ionicons name="location" size={16} color={Colors.primary} />
          </View>
          <View style={styles.addressTextCol}>
            <Text style={styles.addressKicker}>Delivery</Text>
            <Text style={styles.addressTitle} numberOfLines={1}>{dest.title}</Text>
            <Text style={styles.addressSubtitle} numberOfLines={1}>{dest.subtitle}</Text>
          </View>
        </View>

        <Pressable style={styles.changeAddressesBtn} onPress={handleChangeAddresses}>
          <Ionicons name="create-outline" size={14} color={Colors.primary} />
          <Text style={styles.changeAddressesText}>Change addresses</Text>
        </Pressable>

        {scheduledFor && (
          <View style={styles.scheduledPill}>
            <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
            <Text style={styles.scheduledPillText}>
              Scheduled for {format(new Date(scheduledFor), "EEE d MMM, h:mm a")}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Price + distance */}
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Estimated fare</Text>
            <Text style={styles.price}>₦{price.toLocaleString()}</Text>
          </View>
          {routeDistanceText ? (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.distancePillText}>{routeDistanceText}</Text>
            </View>
          ) : null}
        </View>

        {/* Confirm Button */}
        <Pressable
          style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
          onPress={handleConfirmPickup}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.confirmButtonText}>
              {scheduledFor ? 'Confirm & Schedule Pickup' : 'Confirm & Find Driver'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButtonSafeArea: {
    position: 'absolute',
    top: 0, left: 0,
  },
  backButton: {
    marginTop: 12,
    marginLeft: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },

  // Markers
  pickupMarker: {
    backgroundColor: '#10B981', padding: 8, borderRadius: 20,
    borderWidth: 3, borderColor: Colors.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  destMarkerWrapper: { alignItems: 'center' },
  destMarkerBubble: {
    backgroundColor: Colors.white, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 4, elevation: 4,
  },
  destMarkerText: { fontFamily: Fonts.poppins.medium, fontSize: 11, color: Colors.textPrimary },
  destMarkerTip: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.white, marginTop: -1,
  },

  // Bottom card
  bottomCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 18,
  },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addressIconCol: { width: 28, alignItems: 'center', paddingTop: 3 },
  pickupDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#10B981',
  },
  addressTextCol: { flex: 1, marginLeft: 8 },
  addressKicker: {
    fontSize: 11,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  addressTitle: {
    fontSize: 15,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  addressSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  routeConnectorCol: { width: 28, alignItems: 'center' },
  routeConnector: {
    width: 1.5, height: 18,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },

  changeAddressesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 4,
  },
  changeAddressesText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },

  scheduledPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', backgroundColor: `${Colors.primary}12`,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 10,
  },
  scheduledPillText: {
    fontSize: 12, fontFamily: Fonts.poppins.medium, color: Colors.primary,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  price: {
    fontSize: 22,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  distancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.lightGray,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  distancePillText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textSecondary,
  },

  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});
