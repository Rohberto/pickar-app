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
  deliveryId: string;
  driverName: string;
  onDone: () => void;   // called after rating submitted OR skipped
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function RatingModal({ visible, deliveryId, driverName, onDone }: Props) {
  const [selected, setSelected] = useState(0);
  const [comment, setComment]   = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Select a rating', 'Please tap a star to rate your driver.');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/deliveries/${deliveryId}/rate`, {
        rating: selected,
        comment: comment.trim(),
      });
      onDone();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not submit rating. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDone}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />

          <Text style={styles.title}>Rate your driver</Text>
          <Text style={styles.subtitle}>
            How was your experience with{' '}
            <Text style={styles.driverName}>{driverName}</Text>?
          </Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelected(star)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <Ionicons
                  name={star <= selected ? 'star' : 'star-outline'}
                  size={42}
                  color={star <= selected ? '#F59E0B' : Colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating label */}
          {selected > 0 && (
            <Text style={styles.ratingLabel}>{LABELS[selected]}</Text>
          )}

          {/* Comment */}
          <TextInput
            style={styles.commentInput}
            placeholder="Leave a comment (optional)"
            placeholderTextColor={Colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={300}
            returnKeyType="done"
            blurOnSubmit
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!selected || loading) && styles.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!selected || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Submit Rating</Text>
            }
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity style={styles.skipBtn} onPress={onDone}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: 24,
  },
  title: {
    fontFamily: Fonts.poppins.semiBold,
    fontSize: 20, color: Colors.textPrimary, marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular,
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 28,
  },
  driverName: {
    fontFamily: Fonts.poppins.semiBold, color: Colors.textPrimary,
  },
  starsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 12,
  },
  ratingLabel: {
    fontFamily: Fonts.poppins.semiBold,
    fontSize: 16, color: '#F59E0B', marginBottom: 20,
  },
  commentInput: {
    width: '100%',
    backgroundColor: Colors.lightGray,
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: Fonts.poppins.regular,
    fontSize: 14, color: Colors.textPrimary,
    minHeight: 90, textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnOff: { opacity: 0.45 },
  submitBtnText: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: '#fff',
  },
  skipBtn: { paddingVertical: 10 },
  skipBtnText: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, textDecorationLine: 'underline',
  },
});