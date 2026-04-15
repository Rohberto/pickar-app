
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface LocationData {
  label: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface Suggestion {
  description: string;
  place_id: string;
}

export default function SendPackageScreen() {
  const router = useRouter();
  
  // Form state
  const [pickupAddress, setPickupAddress] = useState<LocationData | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<LocationData | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [packageType, setPackageType] = useState<'fragile' | 'non_fragile' | null>(null);
  const [agreedToInsurance, setAgreedToInsurance] = useState(true);
  
  // UI state
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [showPackageTypeModal, setShowPackageTypeModal] = useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Simple search using text input - no API needed
  const handleSearchChange = (text: string, isPickup: boolean) => {
    if (isPickup) {
      setPickupSearchQuery(text);
    } else {
      setDestinationSearchQuery(text);
    }

    // Generate mock suggestions for now
    // In production, you can integrate Google Places API here
    if (text.length > 2) {
      const mockSuggestions = [
        { description: `${text}, Lagos, Nigeria`, place_id: '1' },
        { description: `${text}, Ikeja, Lagos`, place_id: '2' },
        { description: `${text}, Victoria Island, Lagos`, place_id: '3' },
        { description: `${text}, Lekki, Lagos`, place_id: '4' },
      ];
      setSuggestions(mockSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = async (suggestion: Suggestion, isPickup: boolean) => {
    setSearchLoading(true);
    try {
      // Try to geocode the address to get coordinates
      const geocoded = await Location.geocodeAsync(suggestion.description);
      
      if (geocoded.length > 0) {
        const location: LocationData = {
          label: suggestion.description,
          coordinates: {
            lat: geocoded[0].latitude,
            lng: geocoded[0].longitude,
          },
        };

        if (isPickup) {
          setPickupAddress(location);
          setPickupSearchQuery(suggestion.description);
          setShowPickupSearch(false);
        } else {
          setRecipientAddress(location);
          setDestinationSearchQuery(suggestion.description);
          setShowDestinationSearch(false);
        }
      } else {
        // If geocoding fails, use default Lagos coordinates
        const location: LocationData = {
          label: suggestion.description,
          coordinates: {
            lat: 6.5244,
            lng: 3.3792,
          },
        };

        if (isPickup) {
          setPickupAddress(location);
          setPickupSearchQuery(suggestion.description);
          setShowPickupSearch(false);
        } else {
          setRecipientAddress(location);
          setDestinationSearchQuery(suggestion.description);
          setShowDestinationSearch(false);
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      // Use the text as-is with default coordinates
      const location: LocationData = {
        label: suggestion.description,
        coordinates: {
          lat: 6.5244,
          lng: 3.3792,
        },
      };

      if (isPickup) {
        setPickupAddress(location);
        setPickupSearchQuery(suggestion.description);
        setShowPickupSearch(false);
      } else {
        setRecipientAddress(location);
        setDestinationSearchQuery(suggestion.description);
        setShowDestinationSearch(false);
      }
    } finally {
      setSearchLoading(false);
      setSuggestions([]);
    }
  };

  // Get user's current location
  const getCurrentLocation = async (isPickup: boolean) => {
    setSearchLoading(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature');
        setSearchLoading(false);
        return;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({});
      
      // Reverse geocode to get address
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const formattedAddress = [
          address.street,
          address.city || address.subregion,
          address.region,
          address.country
        ].filter(Boolean).join(', ');
        
        const locationData: LocationData = {
          label: formattedAddress,
          coordinates: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          },
        };

        if (isPickup) {
          setPickupAddress(locationData);
          setPickupSearchQuery(formattedAddress);
          setShowPickupSearch(false);
        } else {
          setRecipientAddress(locationData);
          setDestinationSearchQuery(formattedAddress);
          setShowDestinationSearch(false);
        }
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get your current location');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleContinue = async () => {
    // Validate all fields
    if (!pickupAddress) {
      Alert.alert('Error', 'Please select a pickup location');
      return;
    }
    if (!recipientAddress) {
      Alert.alert('Error', 'Please select a recipient location');
      return;
    }
    if (!recipientName.trim()) {
      Alert.alert('Error', 'Please enter recipient name');
      return;
    }
    if (!recipientPhone.trim()) {
      Alert.alert('Error', 'Please enter recipient phone number');
      return;
    }
    if (!packageType) {
      Alert.alert('Error', 'Please select package type');
      return;
    }

    setLoading(true);
    try {
    const response = await api.post('/deliveries/initiate', {
      pickupAddress,
      recipientAddress: { // Match backend structure
        label: recipientAddress.label,
        coordinates: recipientAddress.coordinates,
      },
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      packageType,
      agreedToInsurance,
    });

    if (response.data.success) {
      const deliveryId = response.data.data._id;
      
      router.push({
        pathname: '/user/choose-ride',
        params: { deliveryId },
      } as never);
    }
   }
    catch (error: any) {
      console.error('Error initiating delivery:', error.response?.data || error.message);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to initiate delivery. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderLocationSearch = (isPickup: boolean) => {
    const query = isPickup ? pickupSearchQuery : destinationSearchQuery;

    return (
      <View style={styles.searchContainer}>
        <View style={styles.searchHeader}>
          <Pressable 
            onPress={() => {
              if (isPickup) {
                setShowPickupSearch(false);
                setPickupSearchQuery('');
              } else {
                setShowDestinationSearch(false);
                setDestinationSearchQuery('');
              }
              setSuggestions([]);
            }}
            style={styles.searchBackButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <TextInput
            style={styles.searchInput}
            placeholder={isPickup ? "Enter pickup location" : "Enter destination"}
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={(text) => handleSearchChange(text, isPickup)}
            autoFocus
          />
        </View>

        {/* Current Location Button */}
        <Pressable 
          style={styles.currentLocationButton}
          onPress={() => getCurrentLocation(isPickup)}
          disabled={searchLoading}
        >
          <Ionicons name="navigate" size={20} color={Colors.primary} />
          <Text style={styles.currentLocationText}>
            {searchLoading ? 'Getting location...' : 'Use current location'}
          </Text>
        </Pressable>

        {/* Suggestions List */}
        {searchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.suggestionItem}
                onPress={() => handleSelectSuggestion(item, isPickup)}
              >
                <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
                <View style={styles.suggestionText}>
                  <Text style={styles.suggestionMain}>{item.description}</Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              query.length >= 3 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Type your address and select from suggestions
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    Start typing to search for locations
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header - NO BORDER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Where To?</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Recipient Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient Details</Text>
          <Text style={styles.sectionDescription}>
            Enter the recipient's delivery information including their location, name, and phone number. Make sure all details are correct before proceeding.
          </Text>
        </View>

        {/* Pickup Address */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Pickup Location</Text>
          <Pressable 
            style={styles.locationInput}
            onPress={() => setShowPickupSearch(true)}
          >
            <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            <Text style={[
              styles.locationInputText,
              !pickupAddress && styles.locationInputPlaceholder
            ]}>
              {pickupAddress?.label || 'Select pickup location'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Destination Address */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Destination</Text>
          <Pressable 
            style={styles.locationInput}
            onPress={() => setShowDestinationSearch(true)}
          >
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={[
              styles.locationInputText,
              !recipientAddress && styles.locationInputPlaceholder
            ]}>
              {recipientAddress?.label || 'Select destination'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Recipient Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter recipient name"
            placeholderTextColor={Colors.textSecondary}
            value={recipientName}
            onChangeText={setRecipientName}
          />
        </View>

        {/* Recipient Phone Number Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            value={recipientPhone}
            onChangeText={setRecipientPhone}
          />
        </View>

        {/* Package Type */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Package Type</Text>
          <Pressable 
            style={styles.locationInput}
            onPress={() => setShowPackageTypeModal(true)}
          >
            <Ionicons 
              name={packageType === 'fragile' ? 'alert-circle-outline' : 'cube-outline'} 
              size={20} 
              color={packageType ? Colors.primary : Colors.textSecondary} 
            />
            <Text style={[
              styles.locationInputText,
              !packageType && styles.locationInputPlaceholder
            ]}>
              {packageType === 'fragile' ? 'Fragile' : packageType === 'non_fragile' ? 'Non Fragile' : 'Select package type'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Insurance Checkbox */}
        <Pressable 
          style={styles.insuranceCheckbox}
          onPress={() => setAgreedToInsurance(!agreedToInsurance)}
        >
          <View style={[
            styles.checkbox,
            agreedToInsurance && styles.checkboxChecked
          ]}>
            {agreedToInsurance && (
              <Ionicons name="checkmark" size={14} color={Colors.white} />
            )}
          </View>
          <Text style={styles.insuranceText}>
            By clicking this, you agree to our terms of insurance policy.{' '}
            <Text style={styles.learnMore}>Learn more</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* Continue Button - Fixed at bottom */}
      <View style={styles.buttonContainer}>
        <Pressable 
          style={[
            styles.continueButton,
            (!pickupAddress || !recipientAddress || !recipientName || !recipientPhone || !packageType || loading) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!pickupAddress || !recipientAddress || !recipientName || !recipientPhone || !packageType || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>

      {/* Pickup Location Search Modal */}
      <Modal
        visible={showPickupSearch}
        animationType="slide"
        onRequestClose={() => setShowPickupSearch(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {renderLocationSearch(true)}
        </SafeAreaView>
      </Modal>

      {/* Destination Search Modal */}
      <Modal
        visible={showDestinationSearch}
        animationType="slide"
        onRequestClose={() => setShowDestinationSearch(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {renderLocationSearch(false)}
        </SafeAreaView>
      </Modal>

      {/* Package Type Modal */}
      <Modal
        visible={showPackageTypeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPackageTypeModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPackageTypeModal(false)}
        >
          <View style={styles.packageTypeModal}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPackageTypeModal(false)}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.modalTitle}>Select package type</Text>
              <View style={styles.placeholder} />
            </View>

            <Pressable 
              style={styles.packageOption}
              onPress={() => {
                setPackageType('fragile');
                setShowPackageTypeModal(false);
              }}
            >
              <View style={styles.packageOptionLeft}>
                <Ionicons name="alert-circle-outline" size={24} color={Colors.textPrimary} />
                <Text style={styles.packageOptionText}>Fragile</Text>
              </View>
              {packageType === 'fragile' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </Pressable>

            <Pressable 
              style={styles.packageOption}
              onPress={() => {
                setPackageType('non_fragile');
                setShowPackageTypeModal(false);
              }}
            >
              <View style={styles.packageOptionLeft}>
                <Ionicons name="cube-outline" size={24} color={Colors.textPrimary} />
                <Text style={styles.packageOptionText}>Non fragile</Text>
              </View>
              {packageType === 'non_fragile' && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // NO BORDER HERE
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    marginTop: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  locationInputText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
  },
  locationInputPlaceholder: {
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insuranceCheckbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  insuranceText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  learnMore: {
    color: Colors.primary,
    fontFamily: Fonts.poppins.medium,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.lightGray,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },

  // Location Search Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  searchContainer: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBackButton: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  currentLocationText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Package Type Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  packageTypeModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  packageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  packageOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageOptionText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginLeft: 12,
  },
});
