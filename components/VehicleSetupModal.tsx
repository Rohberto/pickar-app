import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Props {
  visible: boolean;
  onComplete: (vehicle: { type: 'bike' | 'truck'; plateNumber: string }) => void;
}

export default function VehicleSetupModal({ visible, onComplete }: Props) {
  const [vehicleType, setVehicleType] = useState<'bike' | 'truck' | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = vehicleType !== null && plateNumber.trim().length >= 4;

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await api.patch('/drivers/me', {
        vehicle: {
          type: vehicleType,
          plateNumber: plateNumber.trim().toUpperCase(),
        },
      });
      onComplete({ type: vehicleType!, plateNumber: plateNumber.trim().toUpperCase() });
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not save vehicle info. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="car-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Set Up Your Vehicle</Text>
          <Text style={styles.subtitle}>
            We need your vehicle details before you can go online and receive trips.
          </Text>

          {/* Vehicle type selector */}
          <Text style={styles.fieldLabel}>Vehicle Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeCard, vehicleType === 'bike' && styles.typeCardActive]}
              onPress={() => setVehicleType('bike')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="bicycle-outline"
                size={28}
                color={vehicleType === 'bike' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.typeLabel, vehicleType === 'bike' && styles.typeLabelActive]}>
                Bike
              </Text>
              <Text style={styles.typeDesc}>Packages & small deliveries</Text>
              {vehicleType === 'bike' && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeCard, vehicleType === 'truck' && styles.typeCardActive]}
              onPress={() => setVehicleType('truck')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="car-outline"
                size={28}
                color={vehicleType === 'truck' ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.typeLabel, vehicleType === 'truck' && styles.typeLabelActive]}>
                Truck
              </Text>
              <Text style={styles.typeDesc}>House loads & large items</Text>
              {vehicleType === 'truck' && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Plate number */}
          <Text style={styles.fieldLabel}>Plate Number</Text>
          <View style={styles.plateInput}>
            <Ionicons name="card-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.plateInputText}
              placeholder="e.g. ABC 123 XY"
              placeholderTextColor={Colors.textSecondary}
              value={plateNumber}
              onChangeText={t => setPlateNumber(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              returnKeyType="done"
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnOff]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save & Go Online</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 12,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 20,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 20,
    color: Colors.textPrimary, marginBottom: 8, textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },

  fieldLabel: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14,
    color: Colors.textPrimary, alignSelf: 'flex-start', marginBottom: 10,
  },

  typeRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },
  typeCard: {
    flex: 1, borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center', gap: 6,
    position: 'relative',
  },
  typeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}08`,
  },
  typeLabel: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 15,
    color: Colors.textSecondary,
  },
  typeLabelActive: { color: Colors.primary },
  typeDesc: {
    fontFamily: Fonts.poppins.regular, fontSize: 11,
    color: Colors.textSecondary, textAlign: 'center',
  },
  checkBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },

  plateInput: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', backgroundColor: Colors.lightGray,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  plateInputText: {
    flex: 1, fontFamily: Fonts.poppins.semiBold,
    fontSize: 16, color: Colors.textPrimary,
    letterSpacing: 2, padding: 0,
  },

  saveBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: '#fff' },
});