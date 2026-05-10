import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CODE_LENGTH = 4;

export default function ConfirmPickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string;
  const userName = params.userName as string;
  const userPhoto = params.userPhoto as string;

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const inputRefs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null));

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 300); }, []);

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setError('');
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullCode = code.join('');
  const isComplete = fullCode.length === CODE_LENGTH && code.every(Boolean);

  const handleVerify = async () => {
    if (!isComplete || loading) return;
    setLoading(true);
    setError('');
    setLoadingMessage('Verifying code...');

    try {
      // Step 1 — verify pickup code (backend sets status → in_transit)
      const verifyRes = await api.post(`/deliveries/${deliveryId}/verify-pickup`, {
        pickupCode: fullCode,
      });
      if (!verifyRes.data?.success) throw new Error('Invalid pickup code');

      setLoadingMessage('Checking packages...');

      // Step 2 — fetch ALL active deliveries to decide routing
      const tripsRes = await api.get('/drivers/active-trips');
      const allTrips: any[] = tripsRes.data?.data ?? [];

      // Packages still waiting to be picked up (excluding the one just confirmed)
      const pendingPickups = allTrips.filter(
        (d: any) => d.status === 'driver_assigned' && d._id !== deliveryId
      );

      if (pendingPickups.length > 0) {
        // ── MORE PICKUPS REMAINING ─────────────────────────────────
        const next = pendingPickups[0];
        router.replace({
          pathname: '/driver/navigate-pickup',
          params: {
            deliveryId: next._id,
            userName: next.recipient?.name ?? '',
            userPhoto: '',
            pickupLabel: next.pickupAddress?.label ?? '',
            pickupLat: String(next.pickupAddress?.coordinates?.lat ?? 6.5244),
            pickupLng: String(next.pickupAddress?.coordinates?.lng ?? 3.3792),
            destLabel: next.recipient?.address?.label ?? '',
            price: String(next.price ?? 0),
          },
        } as never);
        return;
      }

      // ── ALL PICKED UP — START DELIVERING ──────────────────────────
      setLoadingMessage('Loading delivery details...');

      // Fetch current delivery with retry (it just became in_transit)
      let currentDelivery: any = null;
      for (let i = 1; i <= 3; i++) {
        try {
          const res = await api.get(`/deliveries/${deliveryId}/status`);
          currentDelivery = res.data?.data;
          if (currentDelivery) break;
        } catch (_) {}
        if (i < 3) await new Promise(r => setTimeout(r, 500));
      }
      if (!currentDelivery) throw new Error('Could not load delivery details');

      // Deliver the oldest in_transit package first (allTrips sorted oldest-first)
      const toDeliver = allTrips.filter((d: any) => d.status === 'in_transit');

      // If timing means the just-verified delivery isn't in allTrips yet, use currentDelivery
      const firstDelivery = toDeliver.length > 0 ? toDeliver[0] : currentDelivery;
      const isThis = firstDelivery._id === deliveryId || !firstDelivery._id;

      const d = isThis ? currentDelivery : firstDelivery;

      router.replace({
        pathname: '/driver/navigate-delivery',
        params: {
          userName,
          userPhoto,
          deliveryId: isThis ? deliveryId : d._id,
          deliveryCode: isThis ? (verifyRes.data.data?.deliveryCode ?? '') : (d.deliveryCode ?? ''),
          destLabel: d.recipient?.address?.label ?? '',
          destLat: String(d.recipient?.address?.coordinates?.lat ?? 6.5244),
          destLng: String(d.recipient?.address?.coordinates?.lng ?? 3.3792),
          recipientName: d.recipient?.name ?? '',
          recipientPhone: d.recipient?.phone ?? '',
          price: String(d.price ?? 0),
          pickupLabel: d.pickupAddress?.label ?? '',
          pickupLat: String(d.pickupAddress?.coordinates?.lat ?? 6.5244),
          pickupLng: String(d.pickupAddress?.coordinates?.lng ?? 3.3792),
        },
      } as never);

    } catch (err: any) {
      console.error('[ConfirmPickup] error:', err);
      setError(err?.response?.data?.message || err.message || 'Failed to verify');
      shakeInputs();
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const shakeInputs = () => {
    setCode(Array(CODE_LENGTH).fill(''));
    setTimeout(() => inputRefs.current[0]?.focus(), 150);
  };

  const handleResend = () => Alert.alert(
    'Pickup Code',
    'Ask your customer to show you the OTP verification code displayed on their app.',
    [{ text: 'OK' }]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>OTP Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter OTP Code</Text>
        <Text style={styles.subtitle}>
          Ask the user to show you the OTP verification code on their app, then enter it here to start the ride.
        </Text>

        <View style={styles.otpRow}>
          {Array(CODE_LENGTH).fill(0).map((_, index) => (
            <View key={index} style={[styles.otpBox, code[index] ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}>
              <TextInput
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={styles.otpInput}
                value={code[index]}
                onChangeText={(val) => handleChange(val, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
                caretHidden
              />
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't see the code? </Text>
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendLink}>Resend Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.verifyBtn, !isComplete && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={styles.verifyBtnText}>{loadingMessage}</Text>
            </View>
          ) : (
            <Text style={styles.verifyBtnText}>Verify & Start Ride</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 0 : 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontFamily: Fonts.poppins.semiBold, fontSize: 24, color: Colors.textPrimary, marginBottom: 10 },
  subtitle: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 40 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  otpBox: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.lightGray, borderBottomWidth: 2, borderBottomColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderBottomColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  otpBoxError: { borderBottomColor: Colors.error, backgroundColor: '#FEF2F2' },
  otpInput: { width: '100%', height: '100%', fontFamily: Fonts.poppins.bold, fontSize: 28, color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.error, marginBottom: 12, textAlign: 'center' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  resendLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  resendLink: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.primary, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 24, paddingTop: 16 },
  verifyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  verifyBtnDisabled: { backgroundColor: `${Colors.primary}40` },
  verifyBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },
});