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
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface RideOption {
  type: string;
  label: string;
  basePrice: number;
  discountedPrice: number;
  eta: number | null;
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
      const response = await api.get('/deliveries/ride-options');
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
        return require('@/assets/images/bus-load.png');
      case 'standard':
      case 'eco_send':
      case 'express':
        return require('@/assets/images/package.png');
      default:
        return require('@/assets/images/package.png');
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

        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Ride Options - Large Padding, No Border (except when selected) */}
          <View style={styles.optionsContainer}>
            {rideOptions.map((option) => (
              <Pressable
                key={option.type}
                style={[
                  styles.rideOption,
                  selectedRide === option.type && styles.rideOptionSelected,
                ]}
                onPress={() => setSelectedRide(option.type)}
              >
                <View style={styles.rideOptionLeft}>
                  <Image source={getRideIcon(option.type)} style={styles.rideIcon} resizeMode="contain" />
                  <View style={styles.rideInfo}>
                    <Text style={styles.rideName}>{option.label}</Text>
                    <Text style={styles.rideEta}>
                      {option.eta ? `Arrives in ${option.eta} min` : 'Delivers quickly'}
                    </Text>
                  </View>
                </View>
                <View style={styles.rideOptionRight}>
                  <Text style={styles.ridePrice}>₦{option.discountedPrice.toLocaleString()}</Text>
                  {option.basePrice !== option.discountedPrice && (
                    <Text style={styles.rideOldPrice}>₦{option.basePrice.toLocaleString()}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {rideOptions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No ride options available</Text>
            </View>
          )}

          {/* Wallet */}
          <Pressable style={styles.walletButton} onPress={() => router.push('/user/wallet' as never)}>
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
    width: 48,
    height: 48,
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
});
