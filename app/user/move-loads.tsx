import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

// ─── Google Places helpers (same pattern as send-package.tsx) ─────
interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

const searchPlaces = async (query: string): Promise<Prediction[]> => {
  if (!query || query.length < 3) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&key=${GOOGLE_MAPS_KEY}` +
      `&components=country:ng` +
      `&language=en`;
    const res = await fetch(url);
    const data = await res.json();
    return data.status === 'OK' ? data.predictions ?? [] : [];
  } catch (err) {
    console.error('[Places] autocomplete error:', err);
    return [];
  }
};

const getPlaceCoords = async (
  placeId: string
): Promise<{ lat: number; lng: number } | null> => {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=geometry,formatted_address` +
      `&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
      const loc = data.result.geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch (err) {
    console.error('[Places] details error:', err);
    return null;
  }
};

// ─── Types ────────────────────────────────────────────────────────
interface AddressResult {
  label: string;
  coordinates: { lat: number; lng: number };
}

interface FormState {
  pickup: AddressResult | null;
  destination: AddressResult | null;
  contactName: string;
  contactPhone: string;
  loadDescription: string;
}

type ActiveField = 'pickup' | 'destination' | null;

export default function MoveLoadsScreen() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    pickup: null,
    destination: null,
    contactName: '',
    contactPhone: '',
    loadDescription: '',
  });

  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Search sheet open/close ──────────────────────────────────
  const openSearch = (field: ActiveField) => {
    setActiveField(field);
    setSearchQuery('');
    setPredictions([]);
    Keyboard.dismiss();
    Animated.spring(slideAnim, {
      toValue: 0, tension: 60, friction: 12, useNativeDriver: true,
    }).start(() => searchInputRef.current?.focus());
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 600, duration: 260, useNativeDriver: true,
    }).start(() => {
      setActiveField(null);
      setSearchQuery('');
      setPredictions([]);
    });
  };

  // ─── Debounced Google Places search ──────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.length < 3) {
      setPredictions([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchPlaces(text);
      setPredictions(results);
      setSearchLoading(false);
    }, 400);
  }, []);

  // ─── Select a prediction ──────────────────────────────────────
  const handleSelectPrediction = async (pred: Prediction) => {
    setSelectLoading(true);
    try {
      const coords = await getPlaceCoords(pred.place_id);
      if (!coords) throw new Error('Could not get coordinates');
      const result: AddressResult = { label: pred.description, coordinates: coords };
      setForm(prev => ({ ...prev, [activeField!]: result }));
      closeSearch();
    } catch {
      Alert.alert('Error', 'Failed to fetch location details. Try again.');
    } finally {
      setSelectLoading(false);
    }
  };

  // ─── Use current GPS location ─────────────────────────────────
  const handleUseCurrentLocation = async () => {
    setSelectLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use current location.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const label = addr
        ? [addr.street, addr.city, addr.subregion, addr.region].filter(Boolean).join(', ')
        : `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;
      const result: AddressResult = {
        label,
        coordinates: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      };
      setForm(prev => ({ ...prev, [activeField!]: result }));
      closeSearch();
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setSelectLoading(false);
    }
  };

  // ─── Form validation ──────────────────────────────────────────
  const isFormValid =
    form.pickup !== null &&
    form.destination !== null &&
    form.contactName.trim().length > 1 &&
    form.contactPhone.trim().length >= 10;

  // ─── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isFormValid || submitting) return;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      // Step 1 — create delivery with truck ride type
      const { data: initiateData } = await api.post('/deliveries/initiate', {
        pickupAddress: form.pickup,
        recipientAddress: form.destination,
        recipientName: form.contactName.trim(),
        recipientPhone: form.contactPhone.trim(),
        packageType: 'non_fragile',
        agreedToInsurance: true,
        loadDescription: form.loadDescription.trim(),
        rideType: 'truck',
      });

      if (!initiateData.success) throw new Error(initiateData.message);
      const deliveryId = initiateData.data._id;

      // Step 2 — select truck ride type + trigger driver matching
      const { data: rideData } = await api.post(`/deliveries/${deliveryId}/select-ride`, {
        rideType: 'truck',
      });

      if (!rideData.success) throw new Error(rideData.message);

      // Step 3 — navigate to finding driver screen
      router.replace({
        pathname: '/user/finding-driver',
        params: { deliveryId },
      } as never);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || err.message || 'Could not book. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Move House Loads</Text>
          <Text style={styles.headerSub}>Truck delivery for large items</Text>
        </View>
        <View style={styles.truckBadge}>
          <Ionicons name="car" size={18} color={Colors.primary} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Route */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Route</Text>
            <View style={styles.routeCard}>
              <TouchableOpacity
                style={styles.locationRow}
                onPress={() => openSearch('pickup')}
                activeOpacity={0.8}
              >
                <View style={styles.dotPickup} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.locationLabel}>Pickup Location</Text>
                  <Text
                    style={[styles.locationValue, !form.pickup && styles.locationPlaceholder]}
                    numberOfLines={1}
                  >
                    {form.pickup?.label ?? 'Where are you moving from?'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.routeConnectorLine} />

              <TouchableOpacity
                style={styles.locationRow}
                onPress={() => openSearch('destination')}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={16} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.locationLabel}>Destination</Text>
                  <Text
                    style={[styles.locationValue, !form.destination && styles.locationPlaceholder]}
                    numberOfLines={1}
                  >
                    {form.destination?.label ?? 'Where are you moving to?'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Contact at destination */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact at Destination</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={form.contactName}
                  onChangeText={t => setForm(p => ({ ...p, contactName: t }))}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.inputDivider} />
              <View style={styles.inputRow}>
                <Ionicons name="call-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone number"
                  placeholderTextColor={Colors.textSecondary}
                  value={form.contactPhone}
                  onChangeText={t => setForm(p => ({ ...p, contactPhone: t.replace(/[^0-9+]/g, '') }))}
                  keyboardType="phone-pad"
                  maxLength={14}
                  returnKeyType="next"
                />
              </View>
            </View>
          </View>

          {/* Load description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Load Description</Text>
            <Text style={styles.sectionSub}>Tell the driver what you're moving</Text>
            <View style={styles.textAreaCard}>
              <TextInput
                style={styles.textArea}
                placeholder="e.g. 3-bedroom furniture — sofa, beds, wardrobes, appliances. No piano."
                placeholderTextColor={Colors.textSecondary}
                value={form.loadDescription}
                onChangeText={t => setForm(p => ({ ...p, loadDescription: t }))}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                returnKeyType="done"
                blurOnSubmit
              />
              <Text style={styles.charCount}>{form.loadDescription.length}/500</Text>
            </View>
          </View>

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>
              A truck driver will be assigned to handle your move. The driver will call you before arrival.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (!isFormValid || submitting) && styles.submitBtnOff]}
          onPress={handleSubmit}
          disabled={!isFormValid || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="car-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Find a Truck Driver</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Search overlay backdrop */}
      {activeField && (
        <TouchableWithoutFeedback onPress={closeSearch}>
          <View style={styles.searchOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Search sheet */}
      {activeField && (
        <Animated.View style={[styles.searchSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.searchHandle} />
          <Text style={styles.searchTitle}>
            {activeField === 'pickup' ? 'Pickup Location' : 'Destination'}
          </Text>

          {/* Search input */}
          <View style={styles.searchInputRow}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search Nigeria locations..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setPredictions([]); }}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Current location */}
          <TouchableOpacity
            style={styles.currentLocBtn}
            onPress={handleUseCurrentLocation}
            disabled={selectLoading}
          >
            {selectLoading
              ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 12 }} />
              : <View style={styles.currentLocIcon}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
                </View>
            }
            <Text style={styles.currentLocText}>Use current location</Text>
          </TouchableOpacity>

          <View style={styles.searchDivider} />

          {/* Results */}
          {searchLoading ? (
            <View style={styles.searchLoadingBox}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.searchLoadingText}>Searching...</Text>
            </View>
          ) : (
            <FlatList
              data={predictions}
              keyExtractor={item => item.place_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelectPrediction(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultIconBox}>
                    <Ionicons name="location-outline" size={16} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultText} numberOfLines={1}>
                      {item.structured_formatting?.main_text ?? item.description.split(',')[0]}
                    </Text>
                    <Text style={styles.resultSubText} numberOfLines={1}>
                      {item.structured_formatting?.secondary_text ??
                        item.description.split(',').slice(1).join(',').trim()}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                searchQuery.length >= 3 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="search-outline" size={32} color={Colors.border} />
                    <Text style={styles.emptyText}>No results found</Text>
                  </View>
                ) : (
                  <View style={styles.emptyBox}>
                    <Ionicons name="location-outline" size={32} color={Colors.border} />
                    <Text style={styles.emptyText}>Search for an address</Text>
                  </View>
                )
              }
            />
          )}
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 17, color: '#fff' },
  headerSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  truckBadge: {
    marginLeft: 'auto', width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 20 },

  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },

  routeCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  dotPickup: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: `${Colors.primary}40`,
  },
  routeConnectorLine: { width: 1.5, height: 18, backgroundColor: Colors.border, marginLeft: 21 },
  locationLabel: { fontFamily: Fonts.poppins.medium, fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  locationValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
  locationPlaceholder: { fontFamily: Fonts.poppins.regular, color: Colors.textSecondary },

  inputCard: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, padding: 0 },
  inputDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  textAreaCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  textArea: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textPrimary, minHeight: 100, lineHeight: 22,
  },
  charCount: {
    fontFamily: Fonts.poppins.regular, fontSize: 11,
    color: Colors.textSecondary, textAlign: 'right', marginTop: 6,
  },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${Colors.primary}10`,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: `${Colors.primary}20`,
  },
  infoText: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, flex: 1, lineHeight: 20,
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  submitBtnOff: { opacity: 0.45 },
  submitBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: '#fff' },

  // Search sheet
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40,
  },
  searchSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 50, backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 20,
  },
  searchHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  searchTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, marginBottom: 14 },
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.lightGray, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  searchInput: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, padding: 0 },
  currentLocBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, marginBottom: 4,
  },
  currentLocIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  currentLocText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },
  searchDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 8 },
  searchLoadingBox: { padding: 32, alignItems: 'center', gap: 12 },
  searchLoadingText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  resultText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary },
  resultSubText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  emptyBox: { padding: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textSecondary },
});