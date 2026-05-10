import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

const PAYMENT_METHODS = [
  { id: 'card',     label: 'Debit/Credit Card', icon: 'card-outline'     },
  { id: 'transfer', label: 'Bank Transfer',      icon: 'business-outline' },
  { id: 'verve',    label: 'Verve',              icon: 'location-outline' },
];

export default function AddFundsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>(
    (params.method as string) || 'card'
  );
  const [loading, setLoading]     = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);

  // Keep reference in a ref so the WebView callback can read it
  // without stale closure issues
  const paymentRefRef = useRef<string | null>(null);

  const numericAmount = parseFloat(amount.replace(/,/g, '')) || 0;

  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    setAmount(digits ? parseInt(digits).toLocaleString() : '');
  };

  const handleQuickAmount = (val: number) => {
    Keyboard.dismiss();
    setAmount(val.toLocaleString());
  };

  const handleAddFund = async () => {
    if (numericAmount < 100) {
      Alert.alert('Invalid Amount', 'Minimum top-up is ₦100');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const { data } = await api.post('/wallet/initiate-topup', {
        amount: numericAmount,
        channel: selectedMethod,
      });
      if (data.success) {
        paymentRefRef.current = data.data.reference;
        setPaymentUrl(data.data.authorizationUrl);
        setShowWebView(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not initiate payment');
    } finally {
      setLoading(false);
    }
  };

  // Paystack signals completion by redirecting to standard.paystack.co/close
  const handleNavChange = async (navState: any) => {
    const url: string = navState.url ?? '';
    const done =
      url.includes('standard.paystack.co/close') ||
      url.includes('paystack.co/close')           ||
      url.includes('/callback')                   ||
      url.includes('transaction/verify');

    if (done) {
      setShowWebView(false);
      verifyPayment();
    }
  };

  const verifyPayment = async () => {
    const ref = paymentRefRef.current;
    if (!ref) return;
    setVerifying(true);
    try {
      const { data } = await api.post('/wallet/verify-topup', { reference: ref });
      if (data.success) {
        Alert.alert(
          '🎉 Payment Successful',
          `₦${data.data.amountAdded.toLocaleString()} has been added to your wallet.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Check Your Balance',
        err.response?.data?.message ||
          'We could not verify your payment. Check your wallet balance — funds may still have been added.',
        [
          { text: 'Back to Wallet', onPress: () => router.back() },
          { text: 'Stay Here', style: 'cancel' },
        ]
      );
    } finally {
      setVerifying(false);
      paymentRefRef.current = null;
      setPaymentUrl(null);
    }
  };

  const handleCloseWebView = async () => {
    const ref = paymentRefRef.current;

    // No reference means nothing to verify — just close
    if (!ref) {
      setShowWebView(false);
      return;
    }

    // Try to verify silently — if payment already completed, route automatically
    // without showing the cancel dialog
    setShowWebView(false);
    setVerifying(true);
    try {
      const { data } = await api.post('/wallet/verify-topup', { reference: ref });
      if (data.success) {
        // Payment was already successful — auto-route, no dialog needed
        paymentRefRef.current = null;
        setPaymentUrl(null);
        Alert.alert(
          '🎉 Payment Successful',
          `₦${data.data.amountAdded.toLocaleString()} has been added to your wallet.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }
    } catch (_) {
      // Payment not completed yet — fall through to cancel dialog
    } finally {
      setVerifying(false);
    }

    // Payment genuinely not done yet — ask to cancel or go back
    Alert.alert(
      'Cancel Payment',
      'Your payment has not been completed yet. Are you sure you want to cancel?',
      [
        {
          text: 'Continue Payment',
          style: 'cancel',
          onPress: () => setShowWebView(true), // re-open WebView
        },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            paymentRefRef.current = null;
            setPaymentUrl(null);
          },
        },
      ]
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add fund</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Amount card */}
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <Text style={styles.nairaSymbol}>₦</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.border}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <Text style={styles.amountDecimal}>.00</Text>
            </View>
          </View>
          <Text style={styles.hint}>Enter an amount to top up your account</Text>

          {/* Quick chips */}
          <View style={styles.quickGrid}>
            {QUICK_AMOUNTS.map(val => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, numericAmount === val && styles.chipOn]}
                onPress={() => handleQuickAmount(val)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, numericAmount === val && styles.chipTextOn]}>
                  ₦{val.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment methods */}
          <Text style={styles.sectionTitle}>Select Payment methods</Text>
          <View style={styles.methodsCard}>
            {PAYMENT_METHODS.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={[styles.methodRow, selectedMethod === m.id && styles.methodRowOn]}
                  onPress={() => setSelectedMethod(m.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodIcon}>
                    <Ionicons name={m.icon as any} size={20} color={Colors.textPrimary} />
                  </View>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <View style={[styles.radio, selectedMethod === m.id && styles.radioOn]}>
                    {selectedMethod === m.id && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.divider} />
            <TouchableOpacity style={styles.methodRow}>
              <View style={[styles.methodIcon, styles.methodIconAdd]}>
                <Ionicons name="add" size={20} color={Colors.textSecondary} />
              </View>
              <Text style={styles.methodLabel}>Add payment method</Text>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.addBtn, (numericAmount < 100 || loading) && styles.addBtnOff]}
            onPress={handleAddFund}
            disabled={numericAmount < 100 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.addBtnText}>Add fund</Text>
            }
          </TouchableOpacity>
        </KeyboardAvoidingView>

        {/* Verifying overlay */}
        {verifying && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.overlayText}>Verifying payment...</Text>
          </View>
        )}

        {/* Paystack WebView */}
        <Modal visible={showWebView} animationType="slide" onRequestClose={handleCloseWebView}>
          {/* paddingTop = device safe area so header is never hidden under notch */}
          <View style={[styles.webRoot, { paddingTop: insets.top }]}>

            {/* Always-visible header with reachable close button */}
            <View style={styles.webHeader}>
              <TouchableOpacity
                style={styles.webCloseBtn}
                onPress={handleCloseWebView}
                hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.webTitle}>Secure Payment</Text>
              <View style={styles.secureBadge}>
                <Ionicons name="lock-closed" size={11} color="#16A34A" />
                <Text style={styles.secureBadgeText}>Secure</Text>
              </View>
            </View>

            {paymentUrl && (
              <WebView
                source={{ uri: paymentUrl }}
                onNavigationStateChange={handleNavChange}
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.webLoader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.webLoaderText}>Loading payment page...</Text>
                  </View>
                )}
                style={{ flex: 1 }}
              />
            )}
          </View>
        </Modal>

      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  amountCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, marginTop: 24,
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  nairaSymbol: { fontFamily: Fonts.poppins.semiBold, fontSize: 28, color: Colors.textPrimary, marginRight: 4 },
  amountInput: { flex: 1, fontFamily: Fonts.poppins.bold, fontSize: 36, color: Colors.textPrimary, padding: 0 },
  amountDecimal: { fontFamily: Fonts.poppins.regular, fontSize: 22, color: Colors.textSecondary },
  hint: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, marginHorizontal: 20, marginTop: 8, marginBottom: 20 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, gap: 10, marginBottom: 24 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  chipOn: { backgroundColor: `${Colors.primary}12`, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary },
  chipTextOn: { color: Colors.primary },

  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary, marginHorizontal: 20, marginBottom: 12 },

  methodsCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 14, borderRadius: 16 },
  methodRowOn: { backgroundColor: `${Colors.primary}06` },
  methodIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  methodIconAdd: { borderWidth: 1.5, borderColor: Colors.border, backgroundColor: 'transparent' },
  methodLabel: { fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  addBtn: { backgroundColor: Colors.primary, marginHorizontal: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  addBtnOff: { opacity: 0.45 },
  addBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 99 },
  overlayText: { fontFamily: Fonts.poppins.medium, fontSize: 15, color: Colors.textPrimary },

  webRoot: { flex: 1, backgroundColor: Colors.white },
  webHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  webCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  webTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, flex: 1 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureBadgeText: { fontFamily: Fonts.poppins.medium, fontSize: 11, color: '#16A34A' },
  webLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: Colors.white },
  webLoaderText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
});