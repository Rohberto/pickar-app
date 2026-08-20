import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

// No custom style here on purpose — this map is left on Google's default
// styling (real road/area labels, POI icons, colored parks/water) so it
// reads as a "rich" map like Bolt/Uber's route preview, instead of the
// flattened/desaturated look a custom style gives.

// ─── Compass bearing from A to B, in degrees (0 = north) ──────────────
const bearingBetween = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from.lat), lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

// ─── Straight-line distance (meters) — used to frame the map immediately,
// before (or even if) the real route ever comes back from Directions, so
// pickup/destination are always visible instead of the camera sitting at
// its generic Lagos-wide initialRegion. This is what "sometimes the line
// doesn't draw" actually was: the polyline itself was there (a dashed
// straight line renders as a fallback even without Directions), it just
// wasn't ever inside the visible viewport when that API call was slow,
// failed, or returned no route.
const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Zoom level that makes `spanMeters` fill roughly `fractionOfScreen`
// of the map's width, at the given latitude ─────────────────────────
// Standard Web Mercator meters-per-pixel-at-zoom-0 formula. Computed fresh
// from the actual route distance every time (never reads the current/prior
// camera state), so repeated calls always land on the same framing instead
// of compounding zoom-out on top of whatever the camera already was.
const zoomForSpan = (spanMeters: number, atLat: number, fractionOfScreen = 0.55) => {
  const targetPx = SCREEN_WIDTH * fractionOfScreen;
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((atLat * Math.PI) / 180);
  const zoom = Math.log2((metersPerPixelAtZoom0 * targetPx) / Math.max(spanMeters, 150));
  return Math.max(9, Math.min(17, zoom));
};

// ─── Decode Google encoded polyline (same helper as the nav screens) ──
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

interface RideOption {
  rideType: string;
  label: string;
  description: string;
  total: number;
  distanceKm: number;
  pickupZone: string;
  dropoffZone: string;
  eta: number | null;
  breakdown: Record<string, number>;
}

// Surge-fee keys we want to surface. Anything else in `breakdown`
// (baseFee, distanceFee, weightFee, zoneFee) stays internal.
const SURGE_LABELS = ['Peak Hour Fee', 'Island Congestion Fee', 'Rain Fee'];

// Surge is a route-level condition — if it's active, it's active for every
// ride type on this route. Compute the union once instead of per-row.
function getActiveSurgeLabels(options: RideOption[]): string[] {
  const active = new Set<string>();
  options.forEach((opt) => {
    SURGE_LABELS.forEach((label) => {
      if (opt.breakdown?.[label] > 0) active.add(label);
    });
  });
  return Array.from(active);
}

export default function ChooseRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [rideOptions, setRideOptions] = useState<RideOption[]>([]);
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [destination, setDestination] = useState('');
  const [pickupLabel, setPickupLabel] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  const [destCoords, setDestCoords] = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDistanceText, setRouteDistanceText] = useState('');
  const [routeDurationText, setRouteDurationText] = useState('');

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchRideOptions();
    fetchDeliveryDetails();
  }, []);

  const fetchDeliveryDetails = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}/status`);
      if (response.data.success) {
        const delivery = response.data.data;
        setDestination(delivery.recipient?.address?.label || 'Destination');
        setPickupLabel(delivery.pickupAddress?.label || 'Pickup location');

        const pickup = delivery.pickupAddress?.coordinates;
        const dest = delivery.recipient?.address?.coordinates;
        if (pickup?.lat && dest?.lat) {
          setPickupCoords(pickup);
          setDestCoords(dest);
          // Frame the camera on pickup/destination right away, using the
          // straight-line distance between them. Previously the camera
          // only moved once fetchRoute's Directions call succeeded, so if
          // that request was slow, rate-limited, or failed, the map just
          // sat at its generic city-wide initialRegion — the dashed
          // fallback line was technically drawn, it just wasn't inside
          // the visible viewport. This guarantees it always is.
          frameRoute(pickup, dest, haversineMeters(pickup, dest));
          fetchRoute(pickup, dest);
        }
      }
    } catch (error: any) {
      console.error('Error fetching delivery:', error);
    }
  };

  // Rotate + zoom the camera so pickup → destination reads horizontally
  // (pickup left, destination right), regardless of which real-world
  // compass direction the route actually runs — matches how ride apps
  // present the route preview. spanMeters drives the zoom level so pickup
  // and destination always land a consistent, clearly-separated distance
  // apart on screen instead of drifting zoomed-out over repeated calls.
  const frameRoute = (pickup: Coords, dest: Coords, spanMeters: number) => {
    const bearing = bearingBetween(pickup, dest);
    const heading = (bearing - 90 + 360) % 360;
    const center = {
      latitude: (pickup.lat + dest.lat) / 2,
      longitude: (pickup.lng + dest.lng) / 2,
    };
    const zoom = zoomForSpan(spanMeters, center.latitude);
    setTimeout(() => {
      mapRef.current?.animateCamera(
        { center, heading, zoom, pitch: 0 },
        { duration: 500 }
      );
    }, 100);
  };

  // ─── Route preview — real road distance/duration, not a straight line ──
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
        const leg = data.routes[0].legs[0];
        const decoded = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoords(decoded);
        setRouteDistanceText(leg.distance.text);
        setRouteDurationText(leg.duration.text);
        // Re-frame using the real route distance now that we have it —
        // refines the initial straight-line-based framing above.
        frameRoute(pickup, dest, leg.distance.value);
      } else {
        // Directions failed (ZERO_RESULTS, OVER_QUERY_LIMIT, etc). The
        // dashed straight-line fallback still renders and the camera is
        // already framed from fetchDeliveryDetails, so the user still
        // sees a line — just not the real road route.
        console.warn('[ChooseRide] Directions API returned', data.status);
      }
    } catch (err) {
      console.error('[ChooseRide] fetchRoute error:', err);
    }
  };

  const fetchRideOptions = async () => {
    try {
      const response = await api.get('/deliveries/ride-options', {
        params: { deliveryId },
      });
      console.log('Ride options from backend:', response.data); // Debug log
      if (response.data.success) {
        setRideOptions(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching ride options:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load ride options');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWallet = async () => {
    setShowWalletModal(true);
    setWalletLoading(true);
    try {
      const response = await api.get('/wallet');
      if (response.data.success) {
        setWalletBalance(response.data.data.balance ?? 0);
      }
    } catch (error: any) {
      console.error('Error fetching wallet balance:', error.response?.data || error.message);
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleSelectRide = async () => {
    if (!selectedRide) {
      Alert.alert('Error', 'Please select a ride type');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/deliveries/${deliveryId}/select-ride`, {
        rideType: selectedRide,
      });

      if (response.data.success) {
        // Navigate to delivery instructions
        router.push({
          pathname: '/user/delivery-instruction',
          params: { deliveryId },
        } as never);
      }
    } catch (error: any) {
      console.error('Error selecting ride:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to select ride');
    } finally {
      setSubmitting(false);
    }
  };

const getRideIcon = (type: string) => {
  switch (type) {
    case 'truck':
      return require('@/assets/images/bus.png');
    case 'standard':
      return require('@/assets/images/standard.png');
    case 'eco_send':
      return require('@/assets/images/eco_send.png');
    case 'express':
      return require('@/assets/images/express.png');
    default:
      return require('@/assets/images/standard.png');
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

  const activeSurgeLabels = getActiveSurgeLabels(rideOptions);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Top Section - Route Map ─────────────────────────────────── */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_GOOGLE}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          initialRegion={{
            latitude: pickupCoords?.lat ?? destCoords?.lat ?? 6.5244,
            longitude: pickupCoords?.lng ?? destCoords?.lng ?? 3.3792,
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

          {/* Pins with short labeled bubbles, styled like the Bolt/Uber
              route preview — this is the only place trip info lives on
              this screen now, no separate floating text bar. */}
          {pickupCoords && (
            <Marker
              coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pickupBubbleWrapper}>
                <View style={styles.pickupBubble}>
                  <Text style={styles.pickupBubbleText}>Pickup</Text>
                </View>
                <View style={styles.bubbleTip} />
              </View>
            </Marker>
          )}

          {destCoords && (
            <Marker
              coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.destBubbleWrapper}>
                <View style={styles.destBubble}>
                  <Text style={styles.destBubbleText}>
                    {routeDurationText ? `Delivery in ${routeDurationText}` : 'Delivery'}
                  </Text>
                </View>
                <View style={[styles.bubbleTip, styles.destBubbleTip]} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Minimal back button — no address text box on the map anymore */}
        <SafeAreaView style={styles.backBtnSafeArea}>
          <Pressable onPress={() => router.back()} style={styles.mapBackBtn}>
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </Pressable>
        </SafeAreaView>
      </View>

      {/* White Section with Border Radius at Top */}
      <View style={styles.whiteSection}>
        {/* Title with Back Arrow */}
        <View style={styles.titleContainer}>
          <Pressable onPress={() => router.back()} style={styles.backArrow}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Choose a ride</Text>
        </View>

        {/* Route-level surge banner — shows once, not per ride option */}
        {activeSurgeLabels.length > 0 && (
          <View style={styles.surgeBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.surgeBannerText}>
              {activeSurgeLabels.length === 1
                ? `${activeSurgeLabels[0]} applies to this route`
                : `${activeSurgeLabels.join(' + ')} apply to this route`}
            </Text>
          </View>
        )}

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Ride Options - Large Padding, No Border (except when selected) */}
          <View style={styles.optionsContainer}>
            {rideOptions.map((option) => (
              <Pressable
                key={option.rideType}
                style={[
                  styles.rideOption,
                  selectedRide === option.rideType && styles.rideOptionSelected,
                ]}
                onPress={() => setSelectedRide(option.rideType)}
              >
                <View style={styles.rideOptionLeft}>
                  <Image source={getRideIcon(option.rideType)} style={styles.rideIcon} resizeMode="contain" />
                  <View style={styles.rideInfo}>
                    <Text style={styles.rideName}>{option.label}</Text>
                    <Text style={styles.rideEta}>
                      {option.eta ? `Arrives in ${option.eta} min` : 'Delivers quickly'}
                    </Text>
                  </View>
                </View>
                <View style={styles.rideOptionRight}>
                  <Text style={styles.ridePrice}>₦{option.total.toLocaleString()}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {rideOptions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No ride options available</Text>
            </View>
          )}

          {/* Wallet — opens a modal instead of navigating away, so selecting
              a ride type isn't lost just to check the balance */}
          <Pressable style={styles.walletButton} onPress={handleOpenWallet}>
            <View style={styles.walletLeft}>
              <Ionicons name="wallet-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.walletText}>Wallet</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>

          {/* Extra padding for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Select Ride Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.selectButton}
            onPress={handleSelectRide}
            disabled={!selectedRide || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.selectButtonText}>Select Ride</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Wallet Balance Modal */}
      <Modal
        visible={showWalletModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWalletModal(false)}
      >
        <Pressable style={styles.walletOverlay} onPress={() => setShowWalletModal(false)}>
          <Pressable style={styles.walletSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.walletSheetHeader}>
              <Text style={styles.walletSheetTitle}>Wallet</Text>
              <Pressable onPress={() => setShowWalletModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {walletLoading ? (
              <View style={styles.walletBalanceBox}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              <View style={styles.walletBalanceBox}>
                <Text style={styles.walletBalanceLabel}>Available Balance</Text>
                <Text style={styles.walletBalanceValue}>
                  {walletBalance !== null ? `₦${walletBalance.toLocaleString()}` : 'Unable to load balance'}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.walletTopUpBtn}
              onPress={() => {
                setShowWalletModal(false);
                router.push('/user/wallet' as never);
              }}
            >
              <Text style={styles.walletTopUpText}>Top Up Wallet</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background for top
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Section - Route Map
  mapSection: {
    height: 260,
    backgroundColor: '#F3F4F6',
  },
  backBtnSafeArea: {
    position: 'absolute',
    top: 0, left: 0,
  },
  mapBackBtn: {
    marginTop: 12,
    marginLeft: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  // Marker bubbles — matches the labeled-pin look of the reference map
  pickupBubbleWrapper: { alignItems: 'center' },
  pickupBubble: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  pickupBubbleText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11, color: Colors.white },
  destBubbleWrapper: { alignItems: 'center' },
  destBubble: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  destBubbleText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11, color: Colors.white },
  bubbleTip: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: Colors.textPrimary, marginTop: -1,
  },
  destBubbleTip: { borderTopColor: Colors.primary },

  // White Section with Border Radius
  whiteSection: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  backArrow: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },

  // Surge banner — shows once for the whole route, not per ride option
  surgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}10`,
  },
  surgeBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },

  scrollContent: {
    paddingBottom: 20,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    gap: 0, // No gap between items
  },
  rideOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24, // Large padding
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    // NO BORDER by default
  },
  rideOptionSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  rideOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
rideIcon: {
  width: 80,
  height: 60,
  marginRight: 16,
},
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  rideEta: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  rideOptionRight: {
    alignItems: 'flex-end',
  },
  ridePrice: {
    fontSize: 18,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  rideOldPrice: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
walletButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 16,
  backgroundColor: Colors.white,
},
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 30,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  selectButton: {
    flex: 1,
    backgroundColor: Colors.primary, // Always wine color, never disabled
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
  // Wallet Modal
  walletOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  walletSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  walletSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  walletSheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  walletBalanceBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginBottom: 20,
  },
  walletBalanceLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  walletBalanceValue: {
    fontSize: 28,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  walletTopUpBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  walletTopUpText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});