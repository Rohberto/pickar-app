import QRScanner from '@/components/QRScanner';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConfirmDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId      = params.deliveryId      as string;
  const driverProfileId = params.driverProfileId as string;
  const recipientName   = params.recipientName   as string;
  const price           = params.price           as string;
  const pickupLabel     = params.pickupLabel     as string;
  const destLabel       = params.destLabel       as string;
  const distance        = params.distance        as string;
  const eta             = params.eta             as string;

  const [scannerVisible, setScannerVisible] = useState(false);
  const [loading, setLoading]               = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // ─── Core verify logic — called after QR scan ────────────────────
  const handleVerify = async (scannedCode: string) => {
    if (loading) return;
    setLoading(true);
    setLoadingMessage('Verifying code...');

    try {
      // Step 1 — verify delivery code with recipient
      const verifyRes = await api.post(`/deliveries/${deliveryId}/verify-delivery`, {
        deliveryCode: scannedCode,
      });
      if (!verifyRes.data?.success) throw new Error('Invalid delivery code');

      setLoadingMessage('Completing delivery...');

      // Step 2 — mark delivery as delivered
      await api.post(`/deliveries/${deliveryId}/delivered`, {
        driverId: driverProfileId,
      });

      setLoadingMessage('Checking remaining packages...');

      // Step 3 — check for more in_transit deliveries
      const tripsRes = await api.get('/drivers/active-trips');
      const remaining: any[] = (tripsRes.data?.data ?? []).filter(
        (d: any) => d.status === 'in_transit' && d._id !== deliveryId
      );

      if (remaining.length > 0) {
        const next = remaining[0];
        router.replace({
          pathname: '/driver/navigate-delivery',
          params: {
            deliveryId:    next._id,
            deliveryCode:  next.deliveryCode ?? '',
            destLabel:     next.recipient?.address?.label ?? '',
            destLat:       String(next.recipient?.address?.coordinates?.lat ?? 6.5244),
            destLng:       String(next.recipient?.address?.coordinates?.lng ?? 3.3792),
            recipientName: next.recipient?.name ?? '',
            recipientPhone: next.recipient?.phone ?? '',
            price:         String(next.price ?? 0),
            pickupLabel:   next.pickupAddress?.label ?? '',
            pickupLat:     String(next.pickupAddress?.coordinates?.lat ?? 6.5244),
            pickupLng:     String(next.pickupAddress?.coordinates?.lng ?? 3.3792),
          },
        } as never);
        return;
      }

      // All deliveries done
      router.replace({
        pathname: '/driver/delivery-complete',
        params: { deliveryId, price, pickupLabel, destLabel, distance, eta, recipientName },
      } as never);

    } catch (err: any) {
      console.error('[ConfirmDelivery] error:', err);
      Alert.alert(
        'Wrong QR Code',
        err?.response?.data?.message || err.message || 'QR code did not match. Ask the recipient to show their delivery QR again.',
        [{ text: 'Try Again', onPress: () => setScannerVisible(true) }]
      );
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleHelp = () => Alert.alert(
    'Delivery QR Code',
    'Ask the recipient to open the Pickar app and show you the delivery QR code. Scan it with your camera to confirm delivery.',
    [{ text: 'OK' }]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="qr-code-outline" size={52} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Scan Delivery QR</Text>
        <Text style={styles.subtitle}>
          Ask the recipient to open their Pickar app and show you the delivery QR code. Scan it to confirm delivery.
        </Text>

        {recipientName ? (
          <View style={styles.recipientBadge}>
            <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.recipientText}>
              Delivering to{' '}
              <Text style={styles.recipientNameText}>{recipientName}</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.helpRow}>
          <Text style={styles.helpLabel}>Recipient can't show QR? </Text>
          <TouchableOpacity onPress={handleHelp}>
            <Text style={styles.helpLink}>Get Help</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.scanBtn, loading && styles.scanBtnDisabled]}
          onPress={() => setScannerVisible(true)}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={styles.scanBtnText}>{loadingMessage}</Text>
            </View>
          ) : (
            <>
              <Ionicons name="qr-code-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.scanBtnText}>Scan Recipient QR Code</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* QR SCANNER MODAL */}
      <QRScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          setScannerVisible(false);
          handleVerify(code);
        }}
        title="Scan Delivery QR"
        hint="Scan the QR code on the recipient's phone"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },

  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${Colors.primary}10`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },

  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 24,
    color: Colors.textPrimary, marginBottom: 12, textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, lineHeight: 22,
    marginBottom: 24, textAlign: 'center',
  },

  recipientBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.primary}10`, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 28,
  },
  recipientText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  recipientNameText: { fontFamily: Fonts.poppins.semiBold, color: Colors.primary },

  helpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  helpLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  helpLink: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14,
    color: Colors.primary, textDecorationLine: 'underline',
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
    paddingTop: 16,
  },
  scanBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  scanBtnDisabled: { backgroundColor: `${Colors.primary}40` },
  scanBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});