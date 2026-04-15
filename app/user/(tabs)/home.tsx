
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface Delivery {
  _id: string;
  pickupAddress: {
    label: string;
    coordinates: { lat: number; lng: number };
  };
  recipient: {
    address: {
      label: string;
      coordinates: { lat: number; lng: number };
    };
    name: string;
    phone: string;
  };
  status: string;
  price: number;
  rideType?: string;
  packageType: string;
  createdAt: string;
  estimatedArrival?: string;
}

interface WalletData {
  balance: number;
  currency: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [showProfileBanner, setShowProfileBanner] = useState(true);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data from backend
  const fetchData = async () => {
    try {
      // Fetch wallet balance
      const walletResponse = await api.get('/wallet');
      if (walletResponse.data.success) {
        setWallet(walletResponse.data.data);
      }

      // Fetch recent deliveries
      const deliveriesResponse = await api.get('/deliveries/history');
      if (deliveriesResponse.data.success) {
        setRecentDeliveries(deliveriesResponse.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.response?.data || error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSendPackage = () => {
    router.push('/user/send-package' as never);
  };

  const handleRebook = async (deliveryId: string) => {
    try {
      const delivery = recentDeliveries.find(d => d._id === deliveryId);
      if (!delivery) return;

      router.push({
        pathname: '/user/send-package',
        params: {
          pickupAddress: delivery.pickupAddress.label,
          recipientAddress: delivery.recipient.address.label,
        },
      } as never);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to rebook');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.profilePic}>
              <Image
                source={{ uri: 'https://ui-avatars.com/api/?name=' + (user?.name || 'User') + '&background=8B1538&color=fff&size=128' }}
                style={styles.profileImage}
              />
            </Pressable>
            <View>
              <Text style={styles.greetingText}>Hello,</Text>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
            </View>
          </View>
          
          <Pressable style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textPrimary} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </Pressable>
        </View>

        {/* Profile Completion Banner */}
        {showProfileBanner && (
          <View style={styles.profileBanner}>
            <View style={styles.profileBannerContent}>
              <Ionicons name="information-circle" size={20} color="#F59E0B" style={styles.warningIcon} />
              <View style={styles.profileBannerText}>
                <Text style={styles.profileBannerTitle}>Complete your profile to continue</Text>
                <Text style={styles.profileBannerSubtitle}>
                  Verify your phone number and email address.
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setShowProfileBanner(false)}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {/* Wallet Balance Card */}
        {wallet && (
          <Pressable style={styles.walletCard} onPress={() => router.push('/wallet' as never)}>
            <View style={styles.walletContent}>
              <View>
                <View style={styles.walletHeader}>
                  <Text style={styles.walletLabel}>Wallet balance</Text>
                  <Ionicons name="eye-outline" size={16} color={Colors.textSecondary} />
                </View>
                <Text style={styles.walletAmount}>
                  ₦{wallet.balance.toLocaleString()}<Text style={styles.walletDecimal}>.00</Text>
                </Text>
              </View>
              <Pressable style={styles.addFundButton}>
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.addFundText}>Add fund</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* Services */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesGrid}>
            <Pressable style={styles.serviceCard} onPress={handleSendPackage}>
              <View style={styles.serviceImageContainer}>
                <Image
                  source={require('@/assets/images/package.png')}
                  style={styles.serviceImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.serviceText}>Send a package</Text>
            </Pressable>

            <Pressable style={styles.serviceCard}>
              <View style={styles.serviceImageContainer}>
                <Image
                  source={require('@/assets/images/bus-load.png')}
                  style={styles.serviceImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.serviceText}>Move your house loads</Text>
            </Pressable>
          </View>
        </View>

        {/* Promotional Banner */}
        <View style={styles.promoSection}>
          <Text style={styles.sectionTitle}>Our offer for you</Text>
          <View style={styles.promoCard}>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>
                Enjoy 40% off{'\n'}your first two{'\n'}rides
              </Text>
              <Pressable style={styles.promoButton} onPress={handleSendPackage}>
                <Text style={styles.promoButtonText}>Take a trip</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.white} />
              </Pressable>
            </View>
            
            <View style={styles.promoPercentageContainer}>
              <Text style={styles.promoPercent}>%</Text>
            </View>
          </View>
        </View>

        {/* Recent Deliveries */}
        {recentDeliveries.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={styles.sectionTitle}>Ride history</Text>
              <Pressable onPress={() => router.push('/delivery-history' as never)}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            {recentDeliveries.slice(0, 3).map((delivery) => {
              return (
                <View key={delivery._id} style={styles.historyCard}>
                  {/* Map Preview */}
                  <View style={styles.mapPreview}>
                    <View style={styles.mapPlaceholder}>
                      <View style={styles.routeLine} />
                      
                      <View style={styles.startMarker}>
                        <Ionicons name="person" size={16} color={Colors.primary} />
                      </View>
                      
                      <View style={styles.endMarker}>
                        <Ionicons name="cube" size={16} color={Colors.textSecondary} />
                        <Text style={styles.distanceText}>5.2 km</Text>
                      </View>
                      
                      <View style={styles.deliveryTimeBadge}>
                        <Ionicons name="person" size={12} color={Colors.textSecondary} />
                        <Text style={styles.deliveryTimeText}>Delivered in 15 mins</Text>
                      </View>
                    </View>
                  </View>

                  {/* Delivery Footer */}
                  <View style={styles.deliveryFooter}>
                    <View style={styles.deliveryFooterLeft}>
                      <View style={styles.bikeIconContainer}>
                        <Ionicons name="bicycle" size={20} color={Colors.primary} />
                      </View>
                      <View style={styles.deliveryFooterInfo}>
                        <Text style={styles.deliveryAddress} numberOfLines={1}>
                          {delivery.recipient?.address?.label || 'Unknown location'}
                        </Text>
                        <Text style={styles.deliveryDate}>
                          {formatDate(delivery.createdAt)} · ₦{delivery.price.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                    
                    {delivery.status === 'delivered' && (
                      <Pressable 
                        style={styles.rebookButton}
                        onPress={() => handleRebook(delivery._id)}
                      >
                        <Ionicons name="refresh" size={16} color={Colors.primary} />
                        <Text style={styles.rebookText}>Rebook</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {recentDeliveries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyStateTitle}>No deliveries yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Send your first package to get started
            </Text>
            <Pressable style={styles.emptyStateButton} onPress={handleSendPackage}>
              <Text style={styles.emptyStateButtonText}>Send Package</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  greetingText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontFamily: Fonts.poppins.bold,
  },

  // Profile Banner
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  profileBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  profileBannerText: {
    flex: 1,
  },
  profileBannerTitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  profileBannerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },

  // Wallet Card
  walletCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 20,
  },
  walletContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  walletAmount: {
    fontSize: 32,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
  },
  walletDecimal: {
    fontSize: 20,
    fontFamily: Fonts.poppins.regular,
  },
  addFundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  addFundText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
  },

  // Services
  servicesSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    padding: 20,
    borderRadius: 12,
  },
  serviceImageContainer: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // Promo
  promoSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  promoCard: {
    backgroundColor: '#7C1D1D',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 140,
  },
  promoContent: {
    flex: 1,
    zIndex: 2,
  },
  promoTitle: {
    fontSize: 20,
    fontFamily: Fonts.poppins.bold,
    color: Colors.white,
    marginBottom: 16,
    lineHeight: 28,
  },
  promoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
  },
  promoPercentageContainer: {
    position: 'absolute',
    right: -30,
    top: -10,
    bottom: -10,
    justifyContent: 'center',
    opacity: 0.25,
  },
  promoPercent: {
    fontSize: 140,
    fontFamily: Fonts.poppins.bold,
    color: '#EF4444',
    lineHeight: 140,
  },

  // History
  historySection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  mapPreview: {
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    left: '20%',
    bottom: '25%',
    width: '50%',
    height: 2,
    backgroundColor: Colors.textSecondary,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    transform: [{ rotate: '35deg' }],
  },
  startMarker: {
    position: 'absolute',
    left: 40,
    bottom: 50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  endMarker: {
    position: 'absolute',
    right: 40,
    top: 50,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  distanceText: {
    fontSize: 11,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  deliveryTimeBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deliveryTimeText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  deliveryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  deliveryFooterLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bikeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deliveryFooterInfo: {
    flex: 1,
  },
  deliveryAddress: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  deliveryDate: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  rebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  rebookText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
  },
});
