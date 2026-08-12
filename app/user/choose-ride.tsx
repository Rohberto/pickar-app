import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface RideOption {
  rideType: string;
  label: string;
  description: string;
  total: number;
  distanceKm: number;
  pickupZone: string;
  dropoffZone: string;
  eta: number | null;
  breakdown: Record<string, number>;
}

// Surge-fee keys we want to surface. Anything else in `breakdown`
// (baseFee, distanceFee, weightFee, zoneFee) stays internal.
const SURGE_LABELS = ['Peak Hour Fee', 'Island Congestion Fee', 'Rain Fee'];

// Surge is a route-level condition — if it's active, it's active for every
// ride type on this route. Compute the union once instead of per-row.
function getActiveSurgeLabels(options: RideOption[]): string[] {
  const active = new Set<string>();
  options.forEach((opt) => {
    SURGE_LABELS.forEach((label) => {
      if (opt.breakdown?.[label] > 0) active.add(label);
    });
  });
  return Array.from(active);
}

export default function ChooseRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [rideOptions, setRideOptions] = useState<RideOption[]>([]);
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [destination, setDestination] = useState('');

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    fetchRideOptions();
    fetchDeliveryDetails();
  }, []);

  const fetchDeliveryDetails = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}/status`);
      if (response.data.success) {
        setDestination(response.data.data.recipient?.address?.label || 'Destination');
      }
    } catch (error: any) {
      console.error('Error fetching delivery:', error);
    }
  };

  const fetchRideOptions = async () => {
    try {
      const response = await api.get('/deliveries/ride-options', {
        params: { deliveryId },
      });
      console.log('Ride options from backend:', response.data); // Debug log
      if (response.data.success) {
        setRideOptions(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching ride options:', error.response?.data || error.message);
      Alert.alert('Error', 'Failed to load ride options');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWallet = async () => {
    setShowWalletModal(true);
    setWalletLoading(true);
    try {
      const response = await api.get('/wallet');
      if (response.data.success) {
        setWalletBalance(response.data.data.balance ?? 0);
      }
    } catch (error: any) {
      console.error('Error fetching wallet balance:', error.response?.data || error.message);
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  };

  const handleSelectRide = async () => {
    if (!selectedRide) {
      Alert.alert('Error', 'Please select a ride type');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/deliveries/${deliveryId}/select-ride`, {
        rideType: selectedRide,
      });

      if (response.data.success) {
        // Navigate to delivery instructions
        router.push({
          pathname: '/user/delivery-instruction',
          params: { deliveryId },
        } as never);
      }
    } catch (error: any) {
      console.error('Error selecting ride:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.message || 'Failed to select ride');
    } finally {
      setSubmitting(false);
    }
  };

const getRideIcon = (type: string) => {
  switch (type) {
    case 'truck':
      return require('@/assets/images/bus.png');
    case 'standard':
      return require('@/assets/images/standard.png');
    case 'eco_send':
      return require('@/assets/images/eco_send.png');
    case 'express':
      return require('@/assets/images/express.png');
    default:
      return require('@/assets/images/standard.png');
  }
};

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const activeSurgeLabels = getActiveSurgeLabels(rideOptions);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Top Section - Light Gray Background */}
      <View style={styles.topSection}>
        <SafeAreaView>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButtonCircle}>
              <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
            </Pressable>
            <View style={styles.locationBar}>
              <Ionicons name="search-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {destination}
              </Text>
              <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* White Section with Border Radius at Top */}
      <View style={styles.whiteSection}>
        {/* Title with Back Arrow */}
        <View style={styles.titleContainer}>
          <Pressable onPress={() => router.back()} style={styles.backArrow}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Choose a ride</Text>
        </View>

        {/* Route-level surge banner — shows once, not per ride option */}
        {activeSurgeLabels.length > 0 && (
          <View style={styles.surgeBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.surgeBannerText}>
              {activeSurgeLabels.length === 1
                ? `${activeSurgeLabels[0]} applies to this route`
                : `${activeSurgeLabels.join(' + ')} apply to this route`}
            </Text>
          </View>
        )}

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Ride Options - Large Padding, No Border (except when selected) */}
          <View style={styles.optionsContainer}>
            {rideOptions.map((option) => (
              <Pressable
                key={option.rideType}
                style={[
                  styles.rideOption,
                  selectedRide === option.rideType && styles.rideOptionSelected,
                ]}
                onPress={() => setSelectedRide(option.rideType)}
              >
                <View style={styles.rideOptionLeft}>
                  <Image source={getRideIcon(option.rideType)} style={styles.rideIcon} resizeMode="contain" />
                  <View style={styles.rideInfo}>
                    <Text style={styles.rideName}>{option.label}</Text>
                    <Text style={styles.rideEta}>
                      {option.eta ? `Arrives in ${option.eta} min` : 'Delivers quickly'}
                    </Text>
                  </View>
                </View>
                <View style={styles.rideOptionRight}>
                  <Text style={styles.ridePrice}>₦{option.total.toLocaleString()}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {rideOptions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No ride options available</Text>
            </View>
          )}

          {/* Wallet — opens a modal instead of navigating away, so selecting
              a ride type isn't lost just to check the balance */}
          <Pressable style={styles.walletButton} onPress={handleOpenWallet}>
            <View style={styles.walletLeft}>
              <Ionicons name="wallet-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.walletText}>Wallet</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>

          {/* Extra padding for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Select Ride Button - BEFORE Calendar Icon */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={styles.selectButton}
            onPress={handleSelectRide}
            disabled={!selectedRide || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.selectButtonText}>Select Ride</Text>
            )}
          </Pressable>
          <Pressable style={styles.floatingButton}>
            <Ionicons name="calendar-outline" size={24} color={Colors.white} />
          </Pressable>
        </View>
      </View>

      {/* Wallet Balance Modal */}
      <Modal
        visible={showWalletModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWalletModal(false)}
      >
        <Pressable style={styles.walletOverlay} onPress={() => setShowWalletModal(false)}>
          <Pressable style={styles.walletSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.walletSheetHeader}>
              <Text style={styles.walletSheetTitle}>Wallet</Text>
              <Pressable onPress={() => setShowWalletModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {walletLoading ? (
              <View style={styles.walletBalanceBox}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : (
              <View style={styles.walletBalanceBox}>
                <Text style={styles.walletBalanceLabel}>Available Balance</Text>
                <Text style={styles.walletBalanceValue}>
                  {walletBalance !== null ? `₦${walletBalance.toLocaleString()}` : 'Unable to load balance'}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.walletTopUpBtn}
              onPress={() => {
                setShowWalletModal(false);
                router.push('/user/wallet' as never);
              }}
            >
              <Text style={styles.walletTopUpText}>Top Up Wallet</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray background for top
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Section - Light Gray
  topSection: {
    backgroundColor: '#F3F4F6',
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
  },

  // White Section with Border Radius
  whiteSection: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  backArrow: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },

  // Surge banner — shows once for the whole route, not per ride option
  surgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}10`,
  },
  surgeBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },

  scrollContent: {
    paddingBottom: 20,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    gap: 0, // No gap between items
  },
  rideOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24, // Large padding
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    // NO BORDER by default
  },
  rideOptionSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  rideOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
rideIcon: {
  width: 80,
  height: 60,
  marginRight: 16,
},
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  rideEta: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  rideOptionRight: {
    alignItems: 'flex-end',
  },
  ridePrice: {
    fontSize: 18,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  rideOldPrice: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
walletButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 16,
  backgroundColor: Colors.white,
},
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 30,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  selectButton: {
    flex: 1,
    backgroundColor: Colors.primary, // Always wine color, never disabled
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  selectButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Wallet Modal
  walletOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  walletSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  walletSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  walletSheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  walletBalanceBox: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginBottom: 20,
  },
  walletBalanceLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  walletBalanceValue: {
    fontSize: 28,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  walletTopUpBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  walletTopUpText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});