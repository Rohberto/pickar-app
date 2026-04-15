
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
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ConfirmPickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupSubtitle, setPickupSubtitle] = useState('');
  const [price, setPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchDeliveryDetails();
  }, []);

  const fetchDeliveryDetails = async () => {
    try {
      const response = await api.get(`/deliveries/${deliveryId}/status`);
      if (response.data.success) {
        const delivery = response.data.data;
        const fullAddress = delivery.pickupAddress?.label || 'Unknown location';
        const addressParts = fullAddress.split(',');
        
        setPickupAddress(addressParts[0].trim());
        setPickupSubtitle(addressParts.slice(1).join(',').trim() || 'Lagos');
        setPrice(delivery.price || 0);
      }
    } catch (error: any) {
      console.error('Error fetching delivery:', error);
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLocation = () => {
    // Navigate back to send-package screen to change pickup location
    Alert.alert(
      'Change Location',
      'Do you want to go back and change the pickup location?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Change',
          onPress: () => {
            router.back();
            router.back();
            router.back(); // Go back to send-package screen
          },
        },
      ]
    );
  };

  const handleConfirmPickup = async () => {
    setConfirming(true);
    try {
      const response = await api.post(`/deliveries/${deliveryId}/confirm-pickup`);
      
      if (response.data.success) {
        // Navigate to finding driver screen
        router.replace({
          pathname: '/user/finding-driver',
          params: { deliveryId },
        } as never);
      }
    } catch (error: any) {
      console.error('Error confirming pickup:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to confirm pickup. Please try again.'
      );
    } finally {
      setConfirming(false);
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

      {/* Top Section - Light Gray */}
      <View style={styles.topSection}>
        <SafeAreaView>
          {/* Back Button - Circle with White Background */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </Pressable>

          {/* Bike Illustration */}
          <View style={styles.illustrationContainer}>
            <Image
              source={require('@/assets/images/bike.png')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>
        </SafeAreaView>
      </View>

      {/* Bottom White Card with Curved Top */}
      <View style={styles.bottomCard}>
        {/* Title */}
        <Text style={styles.title}>Confirm pick-up location</Text>

        {/* Address Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressLeft}>
            <Text style={styles.addressTitle}>{pickupAddress}</Text>
            <Text style={styles.addressSubtitle}>{pickupSubtitle}</Text>
          </View>
          <Pressable 
            style={styles.changeLocationButton}
            onPress={handleChangeLocation}
          >
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.changeLocationText}>Change location</Text>
          </Pressable>
        </View>

        {/* Price */}
        <Text style={styles.price}>₦{price.toLocaleString()}</Text>

        {/* Confirm Button */}
        <Pressable
          style={[styles.confirmButton, confirming && styles.confirmButtonDisabled]}
          onPress={handleConfirmPickup}
          disabled={confirming}
        >
          {confirming ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm Pick-Up Location</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light gray
    position: 'relative'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Top Section - Light Gray
  topSection: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
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
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    width: 320,
    height: 320,
  },

  // Bottom White Card
  bottomCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addressSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  addressLeft: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  addressSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeLocationText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary, // Primary color to show it's clickable
    textDecorationLine: 'underline', // Underline to show it's clickable
  },
  price: {
    fontSize: 20,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});
