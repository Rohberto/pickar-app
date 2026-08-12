// Verifies a delivery is still active — on screen focus AND whenever the
// app returns to foreground from background. Socket 'trip_cancelled' only
// fires if the driver's socket happens to be connected at the exact
// moment of cancellation; this catches the case where it wasn't (app
// backgrounded or killed), by re-checking status the moment the driver
// comes back.
import api from '@/services/api';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

const TERMINAL_STATUSES = ['cancelled', 'delivered', 'no_driver_found'];

export function useVerifyActiveTrip(deliveryId: string | undefined, onCancelled: () => void) {
  const onCancelledRef = useRef(onCancelled);
  onCancelledRef.current = onCancelled;

  const verify = useCallback(async () => {
    if (!deliveryId) return;
    try {
      const { data } = await api.get(`/deliveries/${deliveryId}/status`);
      if (data.success && TERMINAL_STATUSES.includes(data.data.status)) {
        Alert.alert(
          'Trip No Longer Active',
          'This delivery was cancelled or is no longer available.',
          [{ text: 'OK', onPress: () => onCancelledRef.current() }],
          { cancelable: false }
        );
      }
    } catch (_) {
      // network hiccup — don't kick the driver out on a transient error
    }
  }, [deliveryId]);

  // Check whenever this screen gains focus
  useFocusEffect(
    useCallback(() => {
      verify();
    }, [verify])
  );

  // Check whenever the app returns to foreground, even if this screen
  // never lost focus within the app (just backgrounded/killed and reopened)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') verify();
    });
    return () => sub.remove();
  }, [verify]);
}