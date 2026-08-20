import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { DRIVER_RIDE_TYPES, RideTypeKey } from '@/constants/rideTypes';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
  onComplete: (vehicle: { type: string; plateNumber: string; rideType: RideTypeKey }) => void;
}

// First-time driver registration. The ride type picked here is
// permanent — see driverController.updateMe, which rejects any later
// attempt to change it — so this is the one and only place a driver ever
// makes this choice.
export default function VehicleSetupModal({ visible, onComplete }: Props) {
  const [rideType, setRideType] = useState<RideTypeKey | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const isValid = rideType !== null && plateNumber.trim().length >= 4;

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const { data } = await api.patch('/drivers/me', {
        rideType,
        plateNumber: plateNumber.trim().toUpperCase(),
      });
      const vehicleType = data?.data?.vehicle?.type ?? DRIVER_RIDE_TYPES.find(r => r.type === rideType)?.vehicleClass;
      onComplete({
        type: vehicleType,
        plateNumber: plateNumber.trim().toUpperCase(),
        rideType: rideType!,
      });
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

          <View style={styles.iconCircle}>
            <Ionicons name="car-outline" size={32} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Register Your Ride Type</Text>
          <Text style={styles.subtitle}>
            Choose the delivery type you'll be driving for. This can't be changed later, so pick carefully.
          </Text>

          <View style={styles.typeList}>
            {DRIVER_RIDE_TYPES.map((opt) => (
              <TouchableOpacity
                key={opt.type}
                style={[styles.typeRow, rideType === opt.type && styles.typeRowActive]}
                onPress={() => setRideType(opt.type)}
                activeOpacity={0.8}
              >
                <Image source={opt.icon} style={styles.typeIcon} resizeMode="contain" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.typeLabel, rideType === opt.type && styles.typeLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.typeDesc}>{opt.description}</Text>
                </View>
                <View style={[styles.radio, rideType === opt.type && styles.radioActive]}>
                  {rideType === opt.type && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

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

          <TouchableOpacity
            style={[styles.saveBtn, (!isValid || saving) && styles.saveBtnOff]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Register & Go Online</Text>
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
    lineHeight: 20, marginBottom: 20,
  },

  typeList: { width: '100%', gap: 10, marginBottom: 20 },
  typeRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeRowActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  typeIcon: { width: 38, height: 38 },
  typeLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
  typeLabelActive: { color: Colors.primary },
  typeDesc: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  fieldLabel: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14,
    color: Colors.textPrimary, alignSelf: 'flex-start', marginBottom: 10,
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
