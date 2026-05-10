import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DeliveryCompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const price = params.price as string || '0';
  const pickupLabel = params.pickupLabel as string || '';
  const destLabel = params.destLabel as string || '';
  const distance = params.distance as string || '';
  const eta = params.eta as string || '';

  const [showReceipt, setShowReceipt] = useState(false);
  const receiptAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const pickupShort = pickupLabel?.split(',').slice(0, 2).join(',') || 'Pickup location';
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Checkmark */}
        <View style={styles.iconWrapper}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color={Colors.primary} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Package Delivered</Text>
        <Text style={styles.subtitle}>
          Account has been credited with{'  '}
          <Text style={styles.creditAmount}>{priceDisplay}</Text>
        </Text>

        {/* Trip summary card */}
        <View style={styles.summaryCard}>

          {/* Pickup */}
          <View style={styles.routeRow}>
            <View style={styles.redDot} />
            <Text style={styles.routeText} numberOfLines={1}>{pickupShort}</Text>
            <TouchableOpacity style={styles.changeBtn}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.changeBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.routeConnector} />

          {/* Destination */}
          <View style={styles.routeRow}>
            <Ionicons name="location" size={14} color={Colors.textPrimary} />
            <Text style={[styles.routeText, { marginLeft: 6 }]} numberOfLines={1}>
              {destShort}
            </Text>
            {distance ? <Text style={styles.distanceText}>{distance} km</Text> : null}
          </View>

          <View style={styles.divider} />

          {/* Duration */}
          <View style={styles.detailRow}>
            <Ionicons name="arrow-up-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{eta || '30 mins'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Trip fee */}
          <View style={styles.detailRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.detailLabel}>Trip fee</Text>
            <Text style={styles.detailValue}>{priceDisplay}</Text>
          </View>
        </View>
      </View>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.receiptBtn}
          onPress={openReceipt}
          activeOpacity={0.85}
        >
          <Text style={styles.receiptBtnText}>Get Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.earningsBtn}
          onPress={() => router.replace('/driver/(tabs)/wallet' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.earningsBtnText}>See Earnings</Text>
        </TouchableOpacity>
      </View>

      {/* Backdrop */}
      {showReceipt && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="none"
        />
      )}

      {/* Receipt sheet */}
      {showReceipt && (
        <Animated.View style={[styles.receiptSheet, { transform: [{ translateY: receiptAnim }] }]}>
          <View style={styles.sheetHandle} />

          <TouchableOpacity style={styles.closeBtn} onPress={closeReceipt}>
            <Ionicons name="close" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.sheetTitle}>Get receipt</Text>
          <Text style={styles.sheetBody}>
            Your trip has been completed successfully. A detailed receipt has been generated for this delivery including the route, duration, and fare breakdown.
          </Text>

          <View style={styles.receiptDivider} />

          <TouchableOpacity style={styles.receiptOption}>
            <Ionicons name="arrow-down-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.receiptOptionText}>Download receipt</Text>
          </TouchableOpacity>

          <View style={styles.receiptDivider} />

          <TouchableOpacity style={styles.receiptOption}>
            <Ionicons name="mail-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.receiptOptionText}>Send receipt to email</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },

  iconWrapper: { alignItems: 'center', marginBottom: 20 },
  checkCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 22, color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 32,
  },
  creditAmount: { fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary },

  summaryCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 20, paddingVertical: 8,
  },

  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 8 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  routeText: {
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary,
    flex: 1,
  },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  changeBtnText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  distanceText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  routeConnector: { width: 1.5, height: 16, backgroundColor: Colors.border, marginLeft: 5 },

  divider: { height: 1, backgroundColor: Colors.border },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  detailLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, flex: 1 },
  detailValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 12 : 24,
    paddingTop: 16,
    gap: 12,
  },
  receiptBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  receiptBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },
  earningsBtn: {
    paddingVertical: 14, alignItems: 'center',
  },
  earningsBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.primary },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },

  receiptSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute', top: 20, right: 24,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 20, color: Colors.textPrimary,
    marginBottom: 12,
  },
  sheetBody: {
    fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary,
    lineHeight: 22, marginBottom: 8,
  },
  receiptDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  receiptOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 18,
  },
  receiptOptionText: { fontFamily: Fonts.poppins.medium, fontSize: 15, color: Colors.textPrimary },
});