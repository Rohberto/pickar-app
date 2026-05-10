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

export default function ConfirmDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const deliveryId = params.deliveryId as string;
  const driverProfileId = params.driverProfileId as string;
  const recipientName = params.recipientName as string;
  const price = params.price as string;
  const pickupLabel = params.pickupLabel as string;
  const destLabel = params.destLabel as string;
  const distance = params.distance as string;
  const eta = params.eta as string;

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
      // Step 1 — verify delivery code with recipient
      const verifyRes = await api.post(`/deliveries/${deliveryId}/verify-delivery`, {
        deliveryCode: fullCode,
      });
      if (!verifyRes.data?.success) throw new Error('Invalid delivery code');

      setLoadingMessage('Completing delivery...');

      // Step 2 — mark this delivery as delivered
      // Backend only sets driver online if NO more active deliveries remain
      await api.post(`/deliveries/${deliveryId}/delivered`, {
        driverId: driverProfileId,
      });

      setLoadingMessage('Checking remaining packages...');

      // Step 3 — check if there are more in_transit deliveries to complete
      const tripsRes = await api.get('/drivers/active-trips');
      const remaining: any[] = (tripsRes.data?.data ?? []).filter(
        (d: any) => d.status === 'in_transit' && d._id !== deliveryId
      );

      if (remaining.length > 0) {
        // ── MORE DELIVERIES REMAINING ──────────────────────────────
        const next = remaining[0];
        router.replace({
          pathname: '/driver/navigate-delivery',
          params: {
            deliveryId: next._id,
            deliveryCode: next.deliveryCode ?? '',
            destLabel: next.recipient?.address?.label ?? '',
            destLat: String(next.recipient?.address?.coordinates?.lat ?? 6.5244),
            destLng: String(next.recipient?.address?.coordinates?.lng ?? 3.3792),
            recipientName: next.recipient?.name ?? '',
            recipientPhone: next.recipient?.phone ?? '',
            price: String(next.price ?? 0),
            pickupLabel: next.pickupAddress?.label ?? '',
            pickupLat: String(next.pickupAddress?.coordinates?.lat ?? 6.5244),
            pickupLng: String(next.pickupAddress?.coordinates?.lng ?? 3.3792),
          },
        } as never);
        return;
      }

      // ── ALL DELIVERIES DONE — SHOW TRIP SUMMARY ────────────────
      router.replace({
        pathname: '/driver/delivery-complete',
        params: { deliveryId, price, pickupLabel, destLabel, distance, eta, recipientName },
      } as never);

    } catch (err: any) {
      console.error('[ConfirmDelivery] error:', err);
      setError(err?.response?.data?.message || err.message || 'Invalid delivery code');
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

  const handleHelp = () => Alert.alert(
    'Delivery Code',
    'Ask the recipient to show you the delivery code on their app. This confirms the package was delivered to the right person.',
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
        <Text style={styles.title}>Enter Delivery Code</Text>
        <Text style={styles.subtitle}>
          Ask the recipient to show you the delivery code on their app, then enter it here to confirm delivery.
        </Text>

        {recipientName ? (
          <View style={styles.recipientBadge}>
            <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.recipientText}>
              Delivering to <Text style={styles.recipientNameText}>{recipientName}</Text>
            </Text>
          </View>
        ) : null}

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

        <View style={styles.helpRow}>
          <Text style={styles.helpLabel}>Can't get the code? </Text>
          <TouchableOpacity onPress={handleHelp}>
            <Text style={styles.helpLink}>Get Help</Text>
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
            <Text style={styles.verifyBtnText}>Confirm Delivery</Text>
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
  subtitle: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  recipientBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.primary}10`, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 28 },
  recipientText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  recipientNameText: { fontFamily: Fonts.poppins.semiBold, color: Colors.primary },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  otpBox: { width: 72, height: 72, borderRadius: 12, backgroundColor: Colors.lightGray, borderBottomWidth: 2, borderBottomColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  otpBoxFilled: { borderBottomColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  otpBoxError: { borderBottomColor: Colors.error, backgroundColor: '#FEF2F2' },
  otpInput: { width: '100%', height: '100%', fontFamily: Fonts.poppins.bold, fontSize: 28, color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.error, marginBottom: 12, textAlign: 'center' },
  helpRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  helpLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  helpLink: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.primary, textDecorationLine: 'underline' },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 8 : 24, paddingTop: 16 },
  verifyBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  verifyBtnDisabled: { backgroundColor: `${Colors.primary}40` },
  verifyBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },
});