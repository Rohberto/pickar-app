import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f3f4f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

type TrackingStatus = 'finding_driver' | 'driver_assigned' | 'driver_arrived' | 'in_transit' | 'delivered';

const formatDate = (iso: string) => {
  if (!iso) return 'Just now';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return 'Just now'; }
};

export default function TrackPackageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const driverName = (params.driverName as string) || 'Your Driver';
  const driverPhoto = params.driverPhoto as string;
  const driverVehicle = params.driverVehicle as string;
  const driverPlate = params.driverPlate as string;
  const driverPhone = params.driverPhone as string;
  const pickupLabel = (params.pickupLabel as string) || '';
  const destLabel = (params.destLabel as string) || '';
  const recipientName = (params.recipientName as string) || '';
  const recipientPhone = (params.recipientPhone as string) || '';
  const status = ((params.status as string) || 'driver_assigned') as TrackingStatus;
  const price = (params.price as string) || '0';
  const createdAt = (params.createdAt as string) || '';

  // Real coordinates passed from finding-driver
  const pickupLat = parseFloat(params.pickupLat as string) || 6.5244;
  const pickupLng = parseFloat(params.pickupLng as string) || 3.3792;
  const destLat = parseFloat(params.destLat as string) || 6.5244;
  const destLng = parseFloat(params.destLng as string) || 3.3792;

  // Map centre between pickup and destination
  const mapCentreLat = (pickupLat + destLat) / 2;
  const mapCentreLng = (pickupLng + destLng) / 2;
  const latDelta = Math.abs(pickupLat - destLat) * 2.5 + 0.02;
  const lngDelta = Math.abs(pickupLng - destLng) * 2.5 + 0.02;

  const handleCallDriver = () => {
    if (!driverPhone) return;
    Linking.openURL(`tel:${driverPhone}`).catch(() => {});
  };

  const timelineSteps = [
    { key: 'placed', label: 'Order Placed', icon: 'radio-button-on-outline' },
    { key: 'accepted', label: 'Accepted', icon: 'checkmark-circle-outline' },
    { key: 'on_road', label: 'On the road', icon: 'bicycle-outline' },
    { key: 'delivered', label: 'Delivered', icon: 'cube-outline' },
  ];

  const completedSteps: Record<string, boolean> = {
    placed: true,
    accepted: ['driver_assigned', 'driver_arrived', 'in_transit', 'delivered'].includes(status),
    on_road: ['in_transit', 'delivered'].includes(status),
    delivered: status === 'delivered',
  };

  const activities = [
    {
      icon: 'book-outline' as const,
      title: 'You requested a delivery ride service order',
      time: formatDate(createdAt),
      show: true,
    },
    {
      icon: 'checkmark-circle-outline' as const,
      title: 'Your order has been confirmed and accepted',
      subtitle: driverName ? `${driverName} has accepted your delivery request` : undefined,
      time: formatDate(createdAt),
      show: ['driver_assigned', 'driver_arrived', 'in_transit', 'delivered'].includes(status),
    },
    {
      icon: 'bicycle-outline' as const,
      title: 'Your package has been picked for delivery',
      subtitle: driverName ? `Our delivery man (${driverName}) has picked up your package for delivery` : undefined,
      time: 'En route to recipient',
      show: ['in_transit', 'delivered'].includes(status),
    },
    {
      icon: 'cube-outline' as const,
      title: 'Your package has been delivered',
      subtitle: 'Thank you for using our service',
      time: 'Just now',
      show: status === 'delivered',
    },
  ].filter(a => a.show);

  // Delivery status text for mini map overlay
  const etaText =
    status === 'delivered' ? 'Delivered'
    : status === 'in_transit' ? 'On the way to recipient'
    : status === 'driver_arrived' ? 'Driver at pickup'
    : 'Heading to pickup';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Your Package</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Driver info */}
        <View style={styles.driverRow}>
          <View style={styles.avatarBox}>
            {driverPhoto
              ? <Image source={{ uri: driverPhoto }} style={styles.avatar} />
              : <Ionicons name="person" size={24} color={Colors.textSecondary} />
            }
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.driverSub}>
              {driverVehicle}{'  '}
              <Text style={styles.plateText}>{driverPlate}</Text>
            </Text>
          </View>
          {driverPhone ? (
            <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Mini map with real pickup + destination coords */}
        <View style={styles.miniMapContainer}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            provider={PROVIDER_GOOGLE}
            customMapStyle={MAP_STYLE}
            showsCompass={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            zoomEnabled={false}
            scrollEnabled={false}
            initialRegion={{
              latitude: mapCentreLat,
              longitude: mapCentreLng,
              latitudeDelta: latDelta,
              longitudeDelta: lngDelta,
            }}
          >
            {/* Pickup marker */}
            <Marker
              coordinate={{ latitude: pickupLat, longitude: pickupLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.pickupDot} />
            </Marker>

            {/* Destination marker */}
            <Marker
              coordinate={{ latitude: destLat, longitude: destLng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <Ionicons name="location" size={28} color={Colors.primary} />
            </Marker>

            {/* Driver marker — shown between pickup and dest */}
            <Marker
              coordinate={{
                latitude: (pickupLat + destLat) / 2 + 0.003,
                longitude: (pickupLng + destLng) / 2 + 0.005,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={styles.driverMarker}>
                <Ionicons name="car" size={13} color={Colors.white} />
                <Text style={styles.driverMarkerText}>{driverName.split(' ')[0]}</Text>
              </View>
            </Marker>

            {/* Route line between pickup and destination */}
            <Polyline
              coordinates={[
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: (pickupLat + destLat) / 2 + 0.003, longitude: (pickupLng + destLng) / 2 + 0.005 },
                { latitude: destLat, longitude: destLng },
              ]}
              strokeColor="#9CA3AF"
              strokeWidth={2}
              lineDashPattern={[6, 4]}
            />
          </MapView>

          {/* Status overlay */}
          <View style={styles.etaOverlay}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.etaOverlayText}>{etaText}</Text>
          </View>
        </View>

        {/* Tracking timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracking Details</Text>
          {timelineSteps.map((step, i) => {
            const done = completedSteps[step.key];
            const isLast = i === timelineSteps.length - 1;
            return (
              <View key={step.key} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, done && styles.timelineDotActive]}>
                    <Ionicons
                      name={step.icon as any}
                      size={16}
                      color={done ? Colors.primary : Colors.border}
                    />
                  </View>
                  {!isLast && <View style={[styles.timelineLine, done && styles.timelineLineActive]} />}
                </View>
                <Text style={[styles.timelineLabel, done && styles.timelineLabelActive]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        {/* Order activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Activities</Text>
          {activities.map((a, i) => (
            <View key={i} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name={a.icon} size={20} color={Colors.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.activityTitle}>{a.title}</Text>
                {a.subtitle ? <Text style={styles.activitySubtitle}>{a.subtitle}</Text> : null}
                <Text style={styles.activityTime}>{a.time}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Shipping address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <Text style={styles.recipientName}>{recipientName || 'Recipient'}</Text>
          <Text style={styles.recipientAddress}>{destLabel}</Text>
          {recipientPhone ? (
            <TouchableOpacity
              style={styles.recipientPhoneRow}
              onPress={() => Linking.openURL(`tel:${recipientPhone}`).catch(() => {})}
            >
              <Ionicons name="call-outline" size={14} color={Colors.primary} />
              <Text style={styles.recipientPhone}>{recipientPhone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  scrollContent: { paddingHorizontal: 20 },

  driverRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  avatarBox: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  driverName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  driverSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  plateText: { fontFamily: Fonts.poppins.medium, color: Colors.textPrimary },
  callBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: `${Colors.primary}40`,
    alignItems: 'center', justifyContent: 'center',
  },

  miniMapContainer: {
    height: 180, borderRadius: 16, overflow: 'hidden',
    marginVertical: 16, backgroundColor: Colors.lightGray,
  },

  pickupDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.white,
  },
  driverMarker: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.textPrimary, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 10,
  },
  driverMarkerText: { color: Colors.white, fontFamily: Fonts.poppins.semiBold, fontSize: 10 },

  etaOverlay: {
    position: 'absolute', bottom: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  etaOverlayText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textPrimary },

  section: { paddingVertical: 16 },
  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, marginBottom: 16 },
  divider: { height: 1, backgroundColor: Colors.border },

  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 32, marginRight: 16 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  timelineDotActive: { backgroundColor: `${Colors.primary}15` },
  timelineLine: { width: 2, height: 28, backgroundColor: Colors.border, marginVertical: 2 },
  timelineLineActive: { backgroundColor: `${Colors.primary}40` },
  timelineLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary,
    paddingTop: 6, paddingBottom: 26,
  },
  timelineLabelActive: { color: Colors.textPrimary, fontFamily: Fonts.poppins.medium },

  activityItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  activityIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  activityTitle: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary, marginBottom: 2 },
  activitySubtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 2, lineHeight: 18,
  },
  activityTime: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary },

  recipientName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary, marginBottom: 6 },
  recipientAddress: {
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 6,
  },
  recipientPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recipientPhone: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
});