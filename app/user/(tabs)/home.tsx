import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

const CLOUDINARY_CLOUD = 'dtr1shkje';
const CLOUDINARY_PRESET = 'pickar_profiles';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_COLLAPSED = SCREEN_HEIGHT * 0.44;
const SHEET_EXPANDED  = SCREEN_HEIGHT * 0.15;

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f9fafb' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth() as any;
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<{ _id: string; status: string } | null>(null);
  const [showPromoBanner, setShowPromoBanner] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const firstName = (user?.fullName || user?.name || 'there').split(' ')[0];

  // ─── Draggable sheet ─────────────────────────────────────────
  const sheetTop = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const lastSheetTop = useRef(SHEET_COLLAPSED);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 5,
      onPanResponderMove: (_, { dy }) => {
        const next = lastSheetTop.current + dy;
        const clamped = Math.max(SHEET_EXPANDED, Math.min(SHEET_COLLAPSED, next));
        sheetTop.setValue(clamped);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const destination = dy + vy * 80 < 0 ? SHEET_EXPANDED : SHEET_COLLAPSED;
        lastSheetTop.current = destination;
        Animated.spring(sheetTop, {
          toValue: destination,
          useNativeDriver: false,
          tension: 60,
          friction: 12,
        }).start();
      },
    })
  ).current;

  // ─── Animate map only when both ready ────────────────────────
  useEffect(() => {
    if (mapReady && userLocation) {
      mapRef.current?.animateToRegion(
        { ...userLocation, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        800
      );
    }
  }, [mapReady, userLocation]);

  // ─── Location ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  // ─── Fetch profile + wallet on mount ─────────────────────────
  useEffect(() => {
    fetchUserProfile();
    fetchWallet();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get('/users/me');
      if (data.success && data.data?.photo && data.data.photo !== user?.photo) {
        setUser({ ...user, photo: data.data.photo });
      }
    } catch (_) {}
  };

  const fetchWallet = async () => {
    try {
      const { data } = await api.get('/wallet');
      if (data.success) setWalletBalance(data.data.balance ?? 0);
    } catch (_) {}
  };

  // Refresh wallet balance whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkActiveDelivery();
      fetchWallet();
    }, [])
  );

  const checkActiveDelivery = async () => {
    try {
      const { data } = await api.get('/deliveries/active');
      setActiveDelivery(data.success && data.data ? data.data : null);
    } catch (_) {}
  };

  // ─── Cloudinary photo upload ──────────────────────────────────
  const handlePickAndUploadPhoto = async () => {
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
      formData.append('folder', 'pickar/profiles');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload failed');

      await api.patch('/users/me', { photo: data.secure_url });
      setUser({ ...user, photo: data.secure_url });
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────
  const hasPhoto = !!(user as any)?.photo;
  const avatarUri = hasPhoto
    ? (user as any).photo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user?.fullName || user?.name || 'U'
      )}&background=ffffff&color=861313&size=128&bold=true`;

  const activeStatusText =
    activeDelivery?.status === 'in_transit'       ? 'Package on the way to recipient'
    : activeDelivery?.status === 'driver_arrived'  ? 'Driver is at your pickup location'
    : activeDelivery?.status === 'driver_assigned' ? 'Driver is heading to you'
    : 'Finding a driver...';

  const balanceLabel = walletBalance !== null
    ? `₦${walletBalance.toLocaleString()}`
    : '---';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── MAP ──────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        onMapReady={() => setMapReady(true)}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        initialRegion={{
          latitude: 6.5244, longitude: 3.3792,
          latitudeDelta: 0.012, longitudeDelta: 0.012,
        }}
      >
        {userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <View style={styles.pinContainer}>
              <View style={styles.pinBody}>
                <View style={styles.pinInnerDot} />
              </View>
              <View style={styles.pinShadowBlob} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── FLOATING TOP BAR ─────────────────────────────────── */}
      <View style={styles.mapTopBar}>
        {/* Left — wallet balance pill (where logo was) */}
        <TouchableOpacity
          style={styles.walletPill}
          onPress={() => router.push('/user/(tabs)/wallet' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="wallet-outline" size={14} color={Colors.primary} />
          <Text style={styles.walletPillText}>{balanceLabel}</Text>
        </TouchableOpacity>

        {/* Right — notification bell (stays where it was) */}
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      {/* ── DRAGGABLE GRADIENT SHEET ──────────────────────────── */}
      <Animated.View style={[styles.sheet, { top: sheetTop }]}>
        <LinearGradient
          colors={['#9B1515', '#3D0707']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />

        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragHandle} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces
          scrollEventThrottle={16}
        >
          {/* ── HEADER ── */}
          <View style={styles.headerRow}>
            <View style={styles.avatarContainer}>
              <Pressable
                style={styles.avatarPressable}
                onPress={() => router.push('/user/(tabs)/account' as never)}
              >
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              </Pressable>
              <TouchableOpacity
                style={styles.cameraBadge}
                onPress={handlePickAndUploadPhoto}
                disabled={uploadingPhoto}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                {uploadingPhoto
                  ? <ActivityIndicator size={9} color="#fff" />
                  : <Ionicons name="camera" size={10} color="#fff" />
                }
              </TouchableOpacity>
            </View>
            <View style={styles.greetingBlock}>
              <Text style={styles.hiText}>Hi {firstName}</Text>
              <Text style={styles.subText}>Where would you like to deliver to?</Text>
            </View>
          </View>

          {/* ── ACTIVE DELIVERY ── */}
          {activeDelivery && (
            <TouchableOpacity
              style={styles.activeBanner}
              onPress={() =>
                router.push({
                  pathname: '/user/finding-driver',
                  params: { deliveryId: activeDelivery._id },
                } as never)
              }
              activeOpacity={0.85}
            >
              <View style={styles.activePulseRing}>
                <View style={styles.activePulseDot} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.activeBannerTitle}>Delivery in progress</Text>
                <Text style={styles.activeBannerSub}>{activeStatusText}</Text>
              </View>
              <View style={styles.activeBannerArrow}>
                <Ionicons name="arrow-forward" size={16} color="#9B1515" />
              </View>
            </TouchableOpacity>
          )}

          {/* ── PROMO ── */}
          {showPromoBanner && (
            <View style={styles.promoBanner}>
              <View style={styles.promoIconBox}>
                <Ionicons name="pricetag" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.promoPrimary}>40% off your first two rides</Text>
                <Text style={styles.promoSecondary}>View details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPromoBanner(false)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── SERVICES ── */}
          <Text style={styles.sectionTitle}>Our services</Text>
          <View style={styles.servicesRow}>
            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => router.push('/user/send-package' as never)}
              activeOpacity={0.85}
            >
              <View style={styles.serviceImgContainer}>
                <Image
                  source={require('@/assets/images/bike.png')}
                  style={styles.serviceImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.serviceLabel}>Send a package</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceCard} activeOpacity={0.85}>
              <View style={styles.serviceImgContainer}>
                <Image
                  source={require('@/assets/images/bus.png')}
                  style={styles.serviceImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.serviceLabel}>Move your house loads</Text>
            </TouchableOpacity>
          </View>

          {/* ── RIDE HISTORY (replaces wallet card) ── */}
          <TouchableOpacity
            style={styles.historyCard}
            activeOpacity={0.85}
            onPress={() => router.push('/user/ride-history' as never)}
          >
            <View style={styles.historyLeft}>
              <View style={styles.historyIconCircle}>
                <Ionicons name="time-outline" size={20} color="#9B1515" />
              </View>
              <View style={{ marginLeft: 14 }}>
                <Text style={styles.historyTitle}>Ride History</Text>
                <Text style={styles.historySub}>View all your past deliveries</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3D0707' },

  mapTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 10,
  },

  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20, paddingHorizontal: 14, height: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  walletPillText: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.primary,
  },

  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary, borderWidth: 1.5, borderColor: '#fff',
  },

  pinContainer: { alignItems: 'center' },
  pinBody: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary, borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 8,
    transform: [{ rotate: '45deg' }],
  },
  pinInnerDot: {
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: '#fff', transform: [{ rotate: '-45deg' }],
  },
  pinShadowBlob: {
    width: 14, height: 6, borderRadius: 7,
    backgroundColor: 'rgba(134,19,19,0.25)', marginTop: 2,
  },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
  },
  dragHandleArea: {
    alignItems: 'center', paddingTop: 12, paddingBottom: 4, paddingHorizontal: 60,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2,
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatarContainer: { width: 52, height: 52, marginRight: 14, position: 'relative' },
  avatarPressable: {
    width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatar: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#9B1515',
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  greetingBlock: { flex: 1 },
  hiText: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: '#fff' },
  subText: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.6)', marginTop: 1,
  },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  activePulseRing: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(155,21,21,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  activePulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary },
  activeBannerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textPrimary },
  activeBannerSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  activeBannerArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(155,21,21,0.1)', alignItems: 'center', justifyContent: 'center',
  },

  promoBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 14, marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  promoIconBox: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  promoPrimary: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: '#fff' },
  promoSecondary: {
    fontFamily: Fonts.poppins.regular, fontSize: 11,
    color: 'rgba(255,255,255,0.55)', marginTop: 1, textDecorationLine: 'underline',
  },

  sectionTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14,
    color: 'rgba(255,255,255,0.7)', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 14,
  },

  servicesRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  serviceCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, overflow: 'hidden', paddingBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  serviceImgContainer: {
    width: '100%', height: 130, alignItems: 'center', justifyContent: 'center',
    paddingTop: 16, paddingHorizontal: 12,
  },
  serviceImg: { width: '100%', height: '100%' },
  serviceLabel: {
    fontFamily: Fonts.poppins.medium, fontSize: 13,
    color: '#fff', textAlign: 'center', paddingHorizontal: 10, marginTop: 6,
  },

  historyCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  historyIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  historyTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: '#fff', marginLeft: 14,
  },
  historySub: {
    fontFamily: Fonts.poppins.regular, fontSize: 11,
    color: 'rgba(255,255,255,0.5)', marginTop: 2, marginLeft: 14,
  },
});