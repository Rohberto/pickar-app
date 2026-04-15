import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000'; // Update with your backend URL

interface Driver {
  _id: string;
  name: string;
  vehicle: {
    model: string;
    plateNumber: string;
  };
  photo?: string;
  rating?: number;
}

type DeliveryStatus = 'finding_driver' | 'driver_assigned' | 'driver_arrived' | 'in_transit';

export default function FindingDriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const [status, setStatus] = useState<DeliveryStatus>('finding_driver');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [pickupCode, setPickupCode] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupSubtitle, setPickupSubtitle] = useState('');
  const [price, setPrice] = useState(0);
  const [eta, setEta] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    fetchDeliveryDetails();
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (status === 'finding_driver') {
      startPulseAnimation();
    }
  }, [status]);

  useEffect(() => {
    if (showBanner) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Auto-hide banner after 5 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showBanner]);

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
        
        // Set initial status and data based on delivery state
        if (delivery.driver) {
          setDriver(delivery.driver);
          setPickupCode(delivery.pickupCode || '');
          setDeliveryCode(delivery.deliveryCode || '');
          
          if (delivery.status === 'in_transit') {
            setStatus('in_transit');
            setDeliveryCode(delivery.deliveryCode || '');
          } else if (delivery.status === 'driver_arrived') {
            setStatus('driver_arrived');
          } else if (delivery.status === 'driver_assigned') {
            setStatus('driver_assigned');
            setEta('20 mins');
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching delivery:', error);
    }
  };

  const connectSocket = () => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      // Join user room
      socketRef.current?.emit('join_user_room', deliveryId);
    });

    // Listen for driver assigned
    socketRef.current.on('driver_assigned', (data: any) => {
      console.log('Driver assigned:', data);
      setDriver(data.driver);
      setPickupCode(data.pickupCode || '');
      setEta(data.eta || '20 mins');
      setStatus('driver_assigned');
      setShowBanner(true);
    });

    // Listen for driver location updates
    socketRef.current.on('driver_location', (data: any) => {
      console.log('Driver location:', data);
      // Update ETA if provided
      if (data.eta) {
        setEta(data.eta);
      }
    });

    // Listen for driver arrived
    socketRef.current.on('driver_arrived', () => {
      console.log('Driver arrived');
      setStatus('driver_arrived');
    });

    // Listen for package picked up
    socketRef.current.on('package_picked_up', (data: any) => {
      console.log('Package picked up:', data);
      setDeliveryCode(data.deliveryCode || '');
      setStatus('in_transit');
      setShowBanner(true);
    });

    // Listen for package delivered
    socketRef.current.on('package_delivered', () => {
      console.log('Package delivered');
      // Navigate to delivery complete screen
      router.replace({
        pathname: '/user/delivery-complete',
        params: { deliveryId },
      } as never);
    });

    socketRef.current.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleCancelTrip = () => {
    // Show confirmation dialog
    // Then call cancel endpoint and navigate back
    router.back();
  };

  const handleChatWithDriver = () => {
    // Navigate to chat screen
    console.log('Chat with driver');
  };

  const handleCallDriver = () => {
    // Make phone call
    console.log('Call driver');
  };

  const handleViewProfile = () => {
    // View driver profile
    console.log('View driver profile');
  };

  const renderBanner = () => {
    if (!showBanner) return null;

    const bannerContent = status === 'driver_assigned' ? {
      icon: 'warning-outline' as const,
      title: 'Your driver is on the way!',
      message: `Your request has been accepted by a driver and your pick-up code is ${pickupCode}`,
    } : {
      icon: 'information-circle-outline' as const,
      title: 'Package Delivery Code',
      message: `Your order has been confirmed by the driver and your ride has started. Your package delivery code is ${deliveryCode}`,
    };

    return (
      <Animated.View 
        style={[
          styles.banner,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.bannerContent}>
          <Ionicons name={bannerContent.icon} size={24} color="#F59E0B" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>{bannerContent.title}</Text>
            <Text style={styles.bannerMessage}>{bannerContent.message}</Text>
          </View>
        </View>
        <Pressable onPress={() => {
          setShowBanner(false);
          Animated.timing(slideAnim, {
            toValue: -300,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }}>
          <Ionicons name="close" size={20} color={Colors.textSecondary} />
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Banner */}
      {renderBanner()}

      {/* Top Section - Map Area */}
      <View style={styles.mapSection}>
        <SafeAreaView>
          {/* Back Button */}
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </Pressable>

          {/* Map Placeholder with Animation */}
          <View style={styles.mapContainer}>
            {/* Pickup Location Icon */}
            <View style={styles.pickupMarker}>
              <Ionicons name="person" size={20} color={Colors.primary} />
              {status !== 'finding_driver' && (
                <Text style={styles.etaText}>Arrives in {eta}</Text>
              )}
            </View>

            {/* Dashed Route Line */}
            <View style={styles.routeLine} />

            {/* Driver/Car Marker */}
            {status !== 'finding_driver' && (
              <View style={styles.driverMarker}>
                <View style={styles.driverIcon}>
                  <Ionicons name="car" size={24} color={Colors.textPrimary} />
                </View>
                <View style={styles.driverBubble}>
                  <Text style={styles.driverName}>Gregor</Text>
                  <Text style={styles.driverDistance}>5.2 km away</Text>
                </View>
              </View>
            )}

            {/* Destination Pin */}
            <View style={styles.destinationPin}>
              <Ionicons name="location" size={24} color={Colors.textSecondary} />
            </View>

            {/* ETA Badge */}
            {status === 'driver_assigned' && (
              <View style={styles.etaBadge}>
                <Ionicons name="car" size={14} color={Colors.white} />
                <Text style={styles.etaBadgeText}>Arriving in {eta}</Text>
              </View>
            )}

            {/* Finding Driver Animation */}
            {status === 'finding_driver' && (
              <View style={styles.findingDriverContainer}>
                <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.pulseInner}>
                  <Ionicons name="person" size={24} color={Colors.primary} />
                </View>
                <View style={styles.dashedLine} />
                <View style={styles.carIcon}>
                  <Ionicons name="car" size={32} color={Colors.textPrimary} />
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Bottom Card */}
      <View style={styles.bottomCard}>
        {/* Finding Driver State */}
        {status === 'finding_driver' && (
          <>
            <Text style={styles.bottomTitle}>Connecting you to a Driver</Text>
            
            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Choose pick-up location</Text>
            
            <View style={styles.addressSection}>
              <View style={styles.addressLeft}>
                <Text style={styles.addressTitle}>{pickupAddress}</Text>
                <Text style={styles.addressSubtitle}>{pickupSubtitle}</Text>
              </View>
              <Text style={styles.priceText}>₦{price.toLocaleString()}</Text>
            </View>

            <Pressable style={styles.confirmButton}>
              <Text style={styles.confirmButtonText}>Confirm Pick-Up Location</Text>
            </Pressable>
          </>
        )}

        {/* Driver Assigned / Driver Arrived / In Transit States */}
        {status !== 'finding_driver' && driver && (
          <>
            <Text style={styles.bottomTitle}>
              {status === 'driver_arrived' ? 'Your driver is here' : 
               status === 'in_transit' ? 'Trip Started' : 
               'Your driver is on the way'}
            </Text>

            {/* Driver Info */}
            <View style={styles.driverSection}>
              <Image
                source={{ uri: driver.photo || 'https://ui-avatars.com/api/?name=' + driver.name }}
                style={styles.driverPhoto}
              />
              <View style={styles.driverDetails}>
                <Text style={styles.driverNameText}>{driver.name}</Text>
                <Text style={styles.driverVehicle}>
                  {driver.vehicle.model} • {driver.vehicle.plateNumber}
                </Text>
              </View>
              <Pressable onPress={handleViewProfile} style={styles.viewProfileButton}>
                <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.viewProfileText}>View Driver's Profile</Text>
              </Pressable>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Pressable style={styles.chatButton} onPress={handleChatWithDriver}>
                <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
                <Text style={styles.chatButtonText}>Chat with Driver</Text>
              </Pressable>
              <Pressable style={styles.callButton} onPress={handleCallDriver}>
                <Ionicons name="call-outline" size={24} color={Colors.primary} />
              </Pressable>
            </View>

            {/* Pickup/Delivery Code */}
            <View style={styles.codeSection}>
              <View style={styles.codeLeft}>
                <Text style={styles.codeLabel}>
                  {status === 'in_transit' ? 'Package Delivery Code' : 'Pick Up Code'}
                </Text>
                <Text style={styles.codeDescription}>
                  {status === 'in_transit' 
                    ? 'Share this code to the package receiver to confirm package delivery with the driver'
                    : 'Give this code to the driver for order confirmation.'}
                </Text>
              </View>
              <View style={styles.codeBox}>
                {status === 'in_transit' && (
                  <Ionicons name="reload-outline" size={20} color={Colors.textPrimary} />
                )}
                <Text style={styles.codeNumber}>
                  {status === 'in_transit' ? deliveryCode : pickupCode}
                </Text>
              </View>
            </View>

            {/* Pickup Spot */}
            <View style={styles.pickupSection}>
              <Text style={styles.pickupLabel}>Pick Up Spot</Text>
              <Pressable style={styles.tripDetailsButton}>
                <Text style={styles.tripDetailsText}>See Trip Details</Text>
              </Pressable>
            </View>
            
            <View style={styles.addressSection}>
              <View style={styles.addressLeft}>
                <Text style={styles.addressTitle}>{pickupAddress}</Text>
                <Text style={styles.addressSubtitle}>{pickupSubtitle}</Text>
              </View>
              <Text style={styles.priceText}>₦{price.toLocaleString()}</Text>
            </View>

            <Pressable style={styles.cancelButton} onPress={handleCancelTrip}>
              <Text style={styles.cancelButtonText}>Cancel Trip</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  
  // Banner
  banner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  bannerMessage: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Map Section
  mapSection: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  backButton: {
    position: 'absolute',
    top: 16,
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
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },

  // Finding Driver Animation
  findingDriverContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    opacity: 0.2,
  },
  pulseInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dashedLine: {
    width: 2,
    height: 100,
    marginVertical: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.textSecondary,
  },
  carIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Map Elements
  pickupMarker: {
    position: 'absolute',
    left: 60,
    bottom: '60%',
    alignItems: 'center',
  },
  etaText: {
    fontSize: 11,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  routeLine: {
    position: 'absolute',
    left: '25%',
    top: '25%',
    width: '40%',
    height: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    transform: [{ rotate: '35deg' }],
  },
  driverMarker: {
    position: 'absolute',
    right: 40,
    top: '20%',
    alignItems: 'center',
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.textPrimary,
  },
  driverBubble: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  driverName: {
    fontSize: 12,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  driverDistance: {
    fontSize: 10,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  destinationPin: {
    position: 'absolute',
    right: 60,
    top: '15%',
  },
  etaBadge: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  etaBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.white,
  },

  // Bottom Card
  bottomCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  bottomTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 12,
  },

  // Driver Section
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  driverPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  driverDetails: {
    flex: 1,
  },
  driverNameText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  driverVehicle: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewProfileText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  chatButtonText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Code Section
  codeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLeft: {
    flex: 1,
    marginRight: 16,
  },
  codeLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  codeDescription: {
    fontSize: 11,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeNumber: {
    fontSize: 24,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },

  // Pickup Section
  pickupSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickupLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  tripDetailsButton: {
    paddingVertical: 4,
  },
  tripDetailsText: {
    fontSize: 13,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },

  // Address Section
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
  priceText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },

  // Buttons
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
  cancelButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});
