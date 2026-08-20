import RatingModal from '@/components/RatingModal';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { downloadReceipt } from '@/utils/receipt';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserDeliveryCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string;
  const price = params.price as string || '0';
  const pickupLabel = params.pickupLabel as string || '';
  const destLabel = params.destLabel as string || '';
  const recipientName = params.recipientName as string || '';
  const driverName = params.driverName as string || 'Your Driver';
  const driverPhoto = params.driverPhoto as string;
  const driverVehicle = params.driverVehicle as string;
  const driverPlate = params.driverPlate as string;

  // Extra detail (fare breakdown, distance, weight...) isn't passed as a
  // route param — fetched once on mount purely to make the receipt PDF
  // more complete. The screen renders fine from params alone if this
  // fails or is slow, so it's best-effort and never blocks the UI.
  const [deliveryDetail, setDeliveryDetail] = useState<any>(null);

  useEffect(() => {
    if (!deliveryId) return;
    api.get(`/deliveries/${deliveryId}/status`)
      .then(({ data }) => { if (data?.success) setDeliveryDetail(data.data); })
      .catch(() => {});
  }, [deliveryId]);

  const [showRating, setShowRating] = useState(true);
  const [ratedConfirmed, setRatedConfirmed] = useState(false);
  const [ratingSkipped, setRatingSkipped] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const receiptAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;


  // Animate checkmark on mount
  useState(() => {
    Animated.spring(checkAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  });

  const pickupShort = pickupLabel?.split(',').slice(0, 2).join(',') || 'Pickup';
  const destShort = destLabel?.split(',').slice(0, 2).join(',') || 'Destination';
  const priceDisplay = `₦${parseInt(price || '0').toLocaleString()}`;

  const openReceipt = () => {
    setShowReceipt(true);
    Animated.parallel([
      Animated.spring(receiptAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeReceipt = () => {
    Animated.parallel([
      Animated.timing(receiptAnim, { toValue: 500, duration: 280, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setShowReceipt(false));
  };

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      await downloadReceipt({
        deliveryId,
        date: deliveryDetail?.timeline?.deliveredAt || deliveryDetail?.updatedAt,
        price: deliveryDetail?.price ?? price,
        pickupLabel: deliveryDetail?.pickupAddress?.label || pickupLabel,
        destLabel: deliveryDetail?.recipient?.address?.label || destLabel,
        recipientName: deliveryDetail?.recipient?.name || recipientName,
        driverName: deliveryDetail?.driver?.name || driverName,
        driverVehicle: deliveryDetail?.driver?.vehicle?.type || driverVehicle,
        driverPlate: deliveryDetail?.driver?.vehicle?.plateNumber || driverPlate,
        distanceKm: deliveryDetail?.distanceKm,
        weightKg: deliveryDetail?.weightKg,
        packageType: deliveryDetail?.packageType,
        rideType: deliveryDetail?.rideType,
        fareBreakdown: deliveryDetail?.fareBreakdown,
      });
    } catch (err) {
      Alert.alert('Could not generate receipt', 'Please try again in a moment.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleGoHome = () => {
    router.replace('/user/(tabs)/home' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Animated checkmark */}
        <Animated.View style={[styles.checkWrapper, { transform: [{ scale: checkAnim }] }]}>
          <View style={styles.checkCircleOuter}>
            <View style={styles.checkCircle}>
              <Ionicons name="checkmark" size={44} color={Colors.primary} />
            </View>
          </View>
        </Animated.View>

        <Text style={styles.title}>Package Delivered!</Text>
        <Text style={styles.subtitle}>
          Your package has been successfully delivered to{' '}
          <Text style={styles.recipientHighlight}>{recipientName || 'the recipient'}</Text>
        </Text>

        {/* Trip summary card */}
        <View style={styles.summaryCard}>
          {/* Driver row */}
          <View style={styles.driverRow}>
            <View style={styles.avatarBox}>
              {driverPhoto
                ? <Image source={{ uri: driverPhoto }} style={styles.avatar} />
                : <Ionicons name="person" size={22} color={Colors.textSecondary} />
              }
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.driverName}>{driverName}</Text>
              {driverVehicle ? (
                <Text style={styles.driverSub}>
                  {driverVehicle}{'  '}
                  <Text style={styles.plateText}>{driverPlate}</Text>
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Route */}
          <View style={styles.routeRow}>
            <View style={styles.redDot} />
            <Text style={styles.routeText} numberOfLines={1}>{pickupShort}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <Ionicons name="location" size={14} color={Colors.textPrimary} />
            <Text style={[styles.routeText, { marginLeft: 6 }]} numberOfLines={1}>{destShort}</Text>
          </View>

          <View style={styles.divider} />

          {/* Amount */}
          <View style={styles.amountRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.amountLabel}>Amount paid</Text>
            <Text style={styles.amountValue}>{priceDisplay}</Text>
          </View>
        </View>

        {/* Rating — the actual rating UI lives in RatingModal below, which
            pops up automatically on mount. This card only reflects the
            outcome once the modal is dismissed: a thank-you if they rated,
            or a way back in if they skipped. Nothing renders here while
            the modal is still open, so there's no duplicate rating UI
            visible underneath it. */}
        {ratedConfirmed ? (
          <View style={styles.ratedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
            <Text style={styles.ratedText}>Thanks for your feedback!</Text>
          </View>
        ) : ratingSkipped ? (
          <TouchableOpacity
            style={styles.rateAgainCard}
            onPress={() => { setRatingSkipped(false); setShowRating(true); }}
            activeOpacity={0.85}
          >
            <Ionicons name="star-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.rateAgainText}>Rate your driver</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.receiptBtn, downloadingReceipt && { opacity: 0.7 }]}
          onPress={openReceipt}
          activeOpacity={0.85}
        >
          <Ionicons name="receipt-outline" size={18} color={Colors.white} style={{ marginRight: 8 }} />
          <Text style={styles.receiptBtnText}>Get Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome} activeOpacity={0.85}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      {/* Backdrop */}
      {showReceipt && (
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="none" />
      )}

      {/* Receipt sheet */}
      {showReceipt && (
        <Animated.View style={[styles.receiptSheet, { transform: [{ translateY: receiptAnim }] }]}>
          <View style={styles.dragHandle} />

          <TouchableOpacity style={styles.closeBtn} onPress={closeReceipt}>
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.sheetTitle}>Get receipt</Text>
          <Text style={styles.sheetBody}>
            Your delivery has been completed successfully. A full receipt has been generated including the route, driver details, and fare.
          </Text>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.receiptOption}
            onPress={handleDownloadReceipt}
            disabled={downloadingReceipt}
            activeOpacity={0.7}
          >
            <View style={styles.receiptOptionIcon}>
              {downloadingReceipt
                ? <ActivityIndicator size="small" color={Colors.textPrimary} />
                : <Ionicons name="arrow-down-outline" size={20} color={Colors.textPrimary} />
              }
            </View>
            <Text style={styles.receiptOptionText}>
              {downloadingReceipt ? 'Preparing receipt...' : 'Download receipt'}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      )}
      <RatingModal
        visible={showRating}
        deliveryId={deliveryId}
        driverName={driverName}
        onDone={(rated) => {
          setShowRating(false);
          if (rated) setRatedConfirmed(true);
          else setRatingSkipped(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },

  checkWrapper: { marginBottom: 20 },
  checkCircleOuter: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: `${Colors.primary}10`,
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 24,
    color: Colors.textPrimary, marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  recipientHighlight: { fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary },

  summaryCard: {
    width: '100%', backgroundColor: Colors.white,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20,
  },

  driverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  driverName: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
  driverSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  plateText: { fontFamily: Fonts.poppins.medium, color: Colors.textPrimary },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },

  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  routeText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textPrimary, flex: 1 },
  routeConnector: { width: 1.5, height: 12, backgroundColor: Colors.border, marginLeft: 5 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  amountLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, flex: 1 },
  amountValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  ratedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.primary}12`, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
    width: '100%', justifyContent: 'center',
  },
  ratedText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },

  rateAgainCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '100%', backgroundColor: Colors.lightGray, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16,
  },
  rateAgainText: { flex: 1, fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary },

  footer: {
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    paddingTop: 16, gap: 12,
  },
  receiptBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  receiptBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },
  homeBtn: {
    paddingVertical: 14, alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
  },
  homeBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },

  backdrop: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10,
  },
  receiptSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 24,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 20,
    color: Colors.textPrimary, marginBottom: 10,
  },
  sheetBody: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, lineHeight: 22, marginBottom: 8,
  },
  receiptOption: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  receiptOptionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  receiptOptionText: { fontFamily: Fonts.poppins.medium, fontSize: 15, color: Colors.textPrimary },
});