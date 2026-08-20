import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Minimum lead time enforced client-side too (mirrors the backend check)
// so the picker never lets someone pick a time that'll just get rejected.
const MIN_SCHEDULE_LEAD_MINUTES = 20;
const defaultScheduleTime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + MIN_SCHEDULE_LEAD_MINUTES + 10, 0, 0);
  return d;
};

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '';

// Lagos-only cap — interstate delivery isn't live yet, so every pickup and
// destination picked right now must resolve to somewhere in Lagos state.
// Bias search results toward Lagos and hard-block anything that resolves
// outside it. Checked against actual coordinates (same bounding box the
// backend enforces) rather than the address text — Google's description
// for well-known areas (e.g. "Ikorodu") often omits the state name
// entirely, which made a text match unreliable and rejected real Lagos
// addresses.
const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 };
const LAGOS_SEARCH_RADIUS_M = 60000;
const LAGOS_BOUNDS = { minLat: 6.30, maxLat: 6.75, minLng: 2.65, maxLng: 4.35 };
const isInLagos = (coords: { lat: number; lng: number }) =>
  coords.lat >= LAGOS_BOUNDS.minLat && coords.lat <= LAGOS_BOUNDS.maxLat &&
  coords.lng >= LAGOS_BOUNDS.minLng && coords.lng <= LAGOS_BOUNDS.maxLng;
const NOT_LAGOS_MESSAGE =
  'We currently only deliver within Lagos. Interstate delivery is coming soon — please choose a Lagos address.';

interface LocationData {
  label: string;
  coordinates: { lat: number; lng: number };
}

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

const MIN_WEIGHT_KG = 0.1;
const MAX_WEIGHT_KG = 1000;

// ─── Google Places API Helpers ─────────────────────────────────────
const searchPlaces = async (query: string): Promise<Prediction[]> => {
  if (!query || query.length < 3) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&key=${GOOGLE_MAPS_KEY}` +
      `&components=country:ng` +
      `&location=${LAGOS_CENTER.lat},${LAGOS_CENTER.lng}` +
      `&radius=${LAGOS_SEARCH_RADIUS_M}` +
      `&language=en`;
    const res = await fetch(url);
    const data = await res.json();
    // ZERO_RESULTS just means nothing matched this query yet (normal while
    // typing) — not an error. Only log genuinely broken responses, and use
    // warn (not error) so it doesn't trigger the LogBox red screen in dev.
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Places] status:', data.status, data.error_message);
    }
    return data.status === 'OK' ? data.predictions ?? [] : [];
  } catch (err) {
    console.error('[Places] autocomplete error:', err);
    return [];
  }
};

const getPlaceCoords = async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
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

export default function SendPackageScreen() {
  const router = useRouter();

  const [pickupAddress, setPickupAddress] = useState<LocationData | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<LocationData | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [packageType, setPackageType] = useState<'fragile' | 'non_fragile' | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [agreedToInsurance, setAgreedToInsurance] = useState(true);

  // ─── When: send now vs schedule for later ──────────────────────
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [tempScheduleDate, setTempScheduleDate] = useState<Date>(defaultScheduleTime());
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [androidPickerStep, setAndroidPickerStep] = useState<'date' | 'time' | null>(null);

  const openSchedulePicker = () => {
    const base = scheduledFor && scheduledFor > new Date() ? scheduledFor : defaultScheduleTime();
    setTempScheduleDate(base);
    if (Platform.OS === 'ios') setShowIOSPicker(true);
    else setAndroidPickerStep('date');
  };

  const handleIOSPickerChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setTempScheduleDate(date);
  };

  const confirmIOSSchedule = () => {
    setScheduledFor(tempScheduleDate);
    setShowIOSPicker(false);
  };

  const handleAndroidPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type !== 'set' || !date) {
      setAndroidPickerStep(null);
      return;
    }
    if (androidPickerStep === 'date') {
      const merged = new Date(tempScheduleDate);
      merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setTempScheduleDate(merged);
      setAndroidPickerStep('time');
    } else {
      const merged = new Date(tempScheduleDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setTempScheduleDate(merged);
      setScheduledFor(merged);
      setAndroidPickerStep(null);
    }
  };

  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [showPackageTypeModal, setShowPackageTypeModal] = useState(false);

  const parsedWeight = parseFloat(weightInput);
  const isWeightValid =
    weightInput.trim().length > 0 &&
    !isNaN(parsedWeight) &&
    parsedWeight >= MIN_WEIGHT_KG &&
    parsedWeight <= MAX_WEIGHT_KG;

  const [pickupQuery, setPickupQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced Search
  const handleQueryChange = useCallback((text: string, isPickup: boolean) => {
    if (isPickup) setPickupQuery(text);
    else setDestinationQuery(text);

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

  // Select from Google Places
  const handleSelectPrediction = async (pred: Prediction, isPickup: boolean) => {
    setSelectLoading(true);
    try {
      const coords = await getPlaceCoords(pred.place_id);
      if (!coords) throw new Error();

      const location: LocationData = {
        label: pred.description,
        coordinates: coords,
      };

      if (!isInLagos(location.coordinates)) {
        Alert.alert('Lagos only for now', NOT_LAGOS_MESSAGE);
        return;
      }

      if (isPickup) {
        setPickupAddress(location);
        setPickupQuery(pred.description);
        setShowPickupSearch(false);
      } else {
        setRecipientAddress(location);
        setDestinationQuery(pred.description);
        setShowDestinationSearch(false);
      }
      setPredictions([]);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch location details');
    } finally {
      setSelectLoading(false);
    }
  };

  // Use Current GPS Location
  const handleUseCurrentLocation = async (isPickup: boolean) => {
    setSelectLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [addr] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const label = addr
        ? [addr.street, addr.city, addr.subregion, addr.region]
            .filter(Boolean)
            .join(', ')
        : `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`;

      const location: LocationData = {
        label,
        coordinates: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      };

      if (!isInLagos(location.coordinates)) {
        Alert.alert('Lagos only for now', NOT_LAGOS_MESSAGE);
        return;
      }

      if (isPickup) {
        setPickupAddress(location);
        setPickupQuery(label);
        setShowPickupSearch(false);
      } else {
        setRecipientAddress(location);
        setDestinationQuery(label);
        setShowDestinationSearch(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not get current location.');
    } finally {
      setSelectLoading(false);
    }
  };

  // Submit
  const handleContinue = async () => {
    if (!pickupAddress) return Alert.alert('Error', 'Please select a pickup location.');
    if (!recipientAddress) return Alert.alert('Error', 'Please select a destination.');
    if (!recipientName.trim()) return Alert.alert('Error', 'Please enter recipient name.');
    if (!recipientPhone.trim()) return Alert.alert('Error', 'Please enter recipient phone.');
    if (!packageType) return Alert.alert('Error', 'Please select package type.');
    if (!isWeightValid) {
      return Alert.alert('Error', `Please enter a valid weight between ${MIN_WEIGHT_KG}kg and ${MAX_WEIGHT_KG}kg.`);
    }
    if (sendMode === 'schedule' && !scheduledFor) {
      return Alert.alert('Error', 'Please choose a date and time for your scheduled delivery.');
    }

    setFormLoading(true);
    try {
      const { data } = await api.post('/deliveries/initiate', {
        pickupAddress,
        recipientAddress: {
          label: recipientAddress.label,
          coordinates: recipientAddress.coordinates,
        },
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        packageType,
        weightKg: parsedWeight,
        agreedToInsurance,
        scheduledFor: sendMode === 'schedule' && scheduledFor ? scheduledFor.toISOString() : undefined,
      });

      if (data.success) {
        router.push({
          pathname: '/user/choose-ride',
          params: { deliveryId: data.data._id },
        } as never);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message ?? 'Failed to initiate delivery.');
    } finally {
      setFormLoading(false);
    }
  };

  const isFormValid =
    !!pickupAddress &&
    !!recipientAddress &&
    !!recipientName.trim() &&
    !!recipientPhone.trim() &&
    !!packageType &&
    isWeightValid &&
    (sendMode === 'now' || !!scheduledFor);

  // Map Preview Component
  const LocationMapPreview = ({ address, title }: { address: LocationData | null; title: string }) => {
    if (!address) return null;

    return (
      <View style={styles.mapPreviewContainer}>
        <Text style={styles.mapPreviewTitle}>{title}</Text>
        <MapView
          style={styles.mapPreview}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: address.coordinates.lat,
            longitude: address.coordinates.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: address.coordinates.lat,
              longitude: address.coordinates.lng,
            }}
            title={title}
          />
        </MapView>
      </View>
    );
  };

  // Location Search Modal Content
  const renderLocationSearch = (isPickup: boolean) => {
    const query = isPickup ? pickupQuery : destinationQuery;

    return (
      <View style={styles.searchSheet}>
        <View style={styles.searchHeader}>
          <Pressable
            style={styles.searchBackBtn}
            onPress={() => {
              if (isPickup) {
                setShowPickupSearch(false);
                setPickupQuery('');
              } else {
                setShowDestinationSearch(false);
                setDestinationQuery('');
              }
              setPredictions([]);
            }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <TextInput
            style={styles.searchInput}
            placeholder={isPickup ? 'Search pickup location...' : 'Search destination...'}
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={(t) => handleQueryChange(t, isPickup)}
            autoFocus
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleQueryChange('', isPickup)}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Pressable style={styles.currentLocBtn} onPress={() => handleUseCurrentLocation(isPickup)} disabled={selectLoading}>
          <View style={styles.currentLocIcon}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </View>
          <Text style={styles.currentLocText}>Use current location</Text>
        </Pressable>

        {searchLoading || selectLoading ? (
          <View style={styles.searchLoadingBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.searchLoadingText}>
              {selectLoading ? 'Getting location...' : 'Searching...'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable style={styles.predictionItem} onPress={() => handleSelectPrediction(item, isPickup)}>
                <View style={styles.predictionIcon}>
                  <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.predictionMain} numberOfLines={1}>
                    {item.structured_formatting?.main_text ?? item.description.split(',')[0]}
                  </Text>
                  <Text style={styles.predictionSub} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text ?? item.description.split(',').slice(1).join(',').trim()}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              query.length >= 3 ? (
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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Send Package</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <Text style={styles.sectionDescription}>
            Select locations and provide recipient information.
          </Text>
        </View>

        {/* Pickup */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Pickup Location</Text>
          <Pressable style={styles.locationBtn} onPress={() => setShowPickupSearch(true)}>
            <Ionicons name="location-outline" size={20} color={Colors.textSecondary} />
            <Text style={[styles.locationBtnText, !pickupAddress && styles.placeholder]} numberOfLines={2}>
              {pickupAddress?.label ?? 'Select pickup location'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
          <LocationMapPreview address={pickupAddress} title="Pickup Point" />
        </View>

        {/* Destination */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Destination</Text>
          <Pressable style={styles.locationBtn} onPress={() => setShowDestinationSearch(true)}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={[styles.locationBtnText, !recipientAddress && styles.placeholder]} numberOfLines={2}>
              {recipientAddress?.label ?? 'Select destination'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
          <LocationMapPreview address={recipientAddress} title="Drop-off Point" />
        </View>

        {/* Recipient Name */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter recipient name"
            placeholderTextColor={Colors.textSecondary}
            value={recipientName}
            onChangeText={setRecipientName}
          />
        </View>

        {/* Recipient Phone */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Recipient Phone Number</Text>
          <TextInput
            style={styles.textInput}
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
          <Pressable style={styles.locationBtn} onPress={() => setShowPackageTypeModal(true)}>
            <Ionicons
              name={packageType === 'fragile' ? 'alert-circle-outline' : 'cube-outline'}
              size={20}
              color={packageType ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.locationBtnText, !packageType && styles.placeholder]}>
              {packageType === 'fragile' ? 'Fragile' : packageType === 'non_fragile' ? 'Non Fragile' : 'Select package type'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Weight */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Package Weight (kg)</Text>
          <View style={styles.weightInputRow}>
            <Ionicons name="scale-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.weightInput}
              placeholder="Enter actual weight, e.g. 4.5"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={(t) => setWeightInput(t.replace(/[^0-9.]/g, ''))}
            />
            <Text style={styles.weightUnit}>kg</Text>
          </View>
          {weightInput.length > 0 && !isWeightValid && (
            <Text style={styles.weightError}>
              Enter a weight between {MIN_WEIGHT_KG}kg and {MAX_WEIGHT_KG}kg.
            </Text>
          )}
        </View>

        {/* When */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>When</Text>
          <View style={styles.whenRow}>
            <Pressable
              style={[styles.whenPill, sendMode === 'now' && styles.whenPillActive]}
              onPress={() => setSendMode('now')}
            >
              <Ionicons name="flash-outline" size={16} color={sendMode === 'now' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.whenPillText, sendMode === 'now' && styles.whenPillTextActive]}>Send now</Text>
            </Pressable>
            <Pressable
              style={[styles.whenPill, sendMode === 'schedule' && styles.whenPillActive]}
              onPress={() => setSendMode('schedule')}
            >
              <Ionicons name="calendar-outline" size={16} color={sendMode === 'schedule' ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.whenPillText, sendMode === 'schedule' && styles.whenPillTextActive]}>Schedule for later</Text>
            </Pressable>
          </View>

          {sendMode === 'schedule' && (
            <Pressable style={[styles.locationBtn, { marginTop: 12 }]} onPress={openSchedulePicker}>
              <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
              <Text style={[styles.locationBtnText, !scheduledFor && styles.placeholder]}>
                {scheduledFor ? format(scheduledFor, "EEE d MMM, h:mm a") : 'Choose date & time'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Insurance */}
        <Pressable style={styles.insuranceRow} onPress={() => setAgreedToInsurance(!agreedToInsurance)}>
          <View style={[styles.checkbox, agreedToInsurance && styles.checkboxChecked]}>
            {agreedToInsurance && <Ionicons name="checkmark" size={13} color={Colors.white} />}
          </View>
          <Text style={styles.insuranceText}>
            I agree to the insurance policy terms.{' '}
            <Text style={styles.learnMore}>Learn more</Text>
          </Text>
        </Pressable>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.continueBtn, (!isFormValid || formLoading) && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!isFormValid || formLoading}
        >
          {formLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.continueBtnText}>Continue</Text>}
        </Pressable>
      </View>

      {/* Modals */}
      <Modal visible={showPickupSearch} animationType="slide" onRequestClose={() => setShowPickupSearch(false)}>
        <SafeAreaView style={styles.modalSafe}>{renderLocationSearch(true)}</SafeAreaView>
      </Modal>

      <Modal visible={showDestinationSearch} animationType="slide" onRequestClose={() => setShowDestinationSearch(false)}>
        <SafeAreaView style={styles.modalSafe}>{renderLocationSearch(false)}</SafeAreaView>
      </Modal>

      <Modal visible={showPackageTypeModal} animationType="slide" transparent onRequestClose={() => setShowPackageTypeModal(false)}>
        <Pressable style={styles.pkgOverlay} onPress={() => setShowPackageTypeModal(false)}>
          <View style={styles.pkgSheet}>
            <View style={styles.pkgHeader}>
              <Pressable onPress={() => setShowPackageTypeModal(false)}>
                <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.pkgTitle}>Select Package Type</Text>
              <View style={{ width: 24 }} />
            </View>

            {[
              { id: 'fragile', label: 'Fragile', icon: 'alert-circle-outline' },
              { id: 'non_fragile', label: 'Non Fragile', icon: 'cube-outline' },
            ].map((opt) => (
              <Pressable
                key={opt.id}
                style={styles.pkgOption}
                onPress={() => {
                  setPackageType(opt.id as any);
                  setShowPackageTypeModal(false);
                }}
              >
                <View style={styles.pkgOptionLeft}>
                  <Ionicons name={opt.icon as any} size={22} color={Colors.textPrimary} />
                  <Text style={styles.pkgOptionText}>{opt.label}</Text>
                </View>
                {packageType === opt.id && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Android: native dialogs, date then time, auto-dismiss and chain */}
      {Platform.OS === 'android' && androidPickerStep && (
        <DateTimePicker
          value={tempScheduleDate}
          mode={androidPickerStep}
          display="default"
          minimumDate={new Date()}
          onChange={handleAndroidPickerChange}
        />
      )}

      {/* iOS: inline spinner in a sheet with an explicit Done button */}
      <Modal visible={showIOSPicker} transparent animationType="slide" onRequestClose={() => setShowIOSPicker(false)}>
        <Pressable style={styles.pkgOverlay} onPress={() => setShowIOSPicker(false)}>
          <Pressable style={styles.pkgSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pkgHeader}>
              <Pressable onPress={() => setShowIOSPicker(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.pkgTitle}>Schedule pickup</Text>
              <Pressable onPress={confirmIOSSchedule}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
            {showIOSPicker && (
              <DateTimePicker
                value={tempScheduleDate}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={handleIOSPickerChange}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerBack: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: Colors.textPrimary },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },

  section: { marginTop: 24, marginBottom: 32 },
  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, marginBottom: 12 },
  sectionDescription: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  inputSection: { marginBottom: 24 },
  inputLabel: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary, marginBottom: 8 },

  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationBtnText: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary },
  placeholder: { color: Colors.textSecondary },

  textInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontFamily: Fonts.poppins.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weightInput: {
    flex: 1,
    fontFamily: Fonts.poppins.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  weightUnit: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },
  weightError: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: '#D64545', marginTop: 6 },

  whenRow: { flexDirection: 'row', gap: 10 },
  whenPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  whenPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  whenPillText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },
  whenPillTextActive: { color: Colors.white },

  pickerCancelText: { fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textSecondary },
  pickerDoneText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.primary },

  insuranceRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
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
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  insuranceText: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  learnMore: { color: Colors.primary, fontFamily: Fonts.poppins.medium },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: Colors.lightGray },
  continueBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },

  // Map Preview
  mapPreviewContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapPreviewTitle: {
    fontFamily: Fonts.poppins.medium,
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  mapPreview: {
    width: '100%',
    height: 160,
  },

  // Search Modal Styles
  modalSafe: { flex: 1, backgroundColor: Colors.white },
  searchSheet: { flex: 1 },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBackBtn: { padding: 4 },
  searchInput: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 16, color: Colors.textPrimary },

  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  currentLocIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },

  searchLoadingBox: { padding: 32, alignItems: 'center', gap: 12 },
  searchLoadingText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },

  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  predictionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionMain: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.textPrimary },
  predictionSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  emptyBox: { padding: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textSecondary },

  // Package Type / Weight Modal
  pkgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pkgSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  pkgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pkgTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: Colors.textPrimary },
  pkgOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pkgOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pkgOptionText: { fontFamily: Fonts.poppins.medium, fontSize: 16, color: Colors.textPrimary },
});