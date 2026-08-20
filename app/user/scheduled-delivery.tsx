import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Landing screen right after a user confirms a *scheduled* pickup — there's
// no live search to show yet (that's finding-driver.tsx's job, once
// scheduledDeliveryService's sweep actually kicks the search off), so this
// just confirms the booking and polls quietly in case the scheduled time
// arrives while the screen is open.
const POLL_INTERVAL_MS = 20000;

export default function ScheduledDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDelivery = async () => {
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/status`);
      if (!data.success || !data.data) return;
      const next = data.data;
      setDelivery(next);

      // The scheduled sweep (or the user cancelling elsewhere) moved this
      // delivery on — follow it to wherever it actually is now.
      if (next.status === 'finding_driver' || next.status === 'driver_assigned') {
        router.replace({ pathname: '/user/finding-driver', params: { deliveryId } } as never);
      } else if (next.status === 'cancelled') {
        stopPolling();
        Alert.alert('Delivery cancelled', 'This scheduled delivery was cancelled.', [
          { text: 'OK', onPress: () => router.replace('/user/(tabs)/home' as never) },
        ]);
      }
    } catch (_) {
      // transient — next poll will retry
    } finally {
      setLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!deliveryId) return;
    fetchDelivery();
    pollRef.current = setInterval(fetchDelivery, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchDelivery();
    });

    return () => {
      stopPolling();
      sub.remove();
    };
  }, [deliveryId]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel scheduled delivery?',
      'Your payment will be refunded to your wallet.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel Delivery',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await api.post(`/deliveries/${deliveryId}/cancel`);
              router.replace('/user/(tabs)/home' as never);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not cancel. Try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const scheduledFor = delivery?.scheduledFor ? new Date(delivery.scheduledFor) : null;
  const pickupLabel = delivery?.pickupAddress?.label || '';
  const destLabel = delivery?.recipient?.address?.label || '';
  const price = delivery?.price || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={40} color={Colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Delivery Scheduled!</Text>
        <Text style={styles.subtitle}>
          We'll start finding you a driver{'\n'}
          {scheduledFor ? (
            <Text style={styles.timeHighlight}>{format(scheduledFor, "EEEE d MMM 'at' h:mm a")}</Text>
          ) : 'at the scheduled time'}
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.routeRow}>
            <View style={styles.redDot} />
            <Text style={styles.routeText} numberOfLines={2}>{pickupLabel}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <Ionicons name="location" size={14} color={Colors.textPrimary} />
            <Text style={[styles.routeText, { marginLeft: 6 }]} numberOfLines={2}>{destLabel}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.amountRow}>
            <Ionicons name="wallet-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.amountLabel}>Amount paid</Text>
            <Text style={styles.amountValue}>₦{Math.round(price).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          You'll be notified here and can track your driver as soon as the search begins.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
          onPress={handleCancel}
          disabled={cancelling}
        >
          {cancelling
            ? <ActivityIndicator color={Colors.primary} />
            : <Text style={styles.cancelBtnText}>Cancel Delivery</Text>
          }
        </Pressable>
        <Pressable style={styles.homeBtn} onPress={() => router.replace('/user/(tabs)/home' as never)}>
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },

  iconWrapper: { marginBottom: 20 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
  },

  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 24,
    color: Colors.textPrimary, marginBottom: 10, textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  timeHighlight: { fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary },

  summaryCard: {
    width: '100%', backgroundColor: Colors.white,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  routeText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textPrimary, flex: 1 },
  routeConnector: { width: 1.5, height: 12, backgroundColor: Colors.border, marginLeft: 5 },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, flex: 1 },
  amountValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  note: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: Colors.textSecondary, textAlign: 'center', lineHeight: 18,
  },

  footer: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 12 },
  cancelBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#D64545',
  },
  cancelBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: '#D64545' },
  homeBtn: { paddingVertical: 14, alignItems: 'center' },
  homeBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
});
