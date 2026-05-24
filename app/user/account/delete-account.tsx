import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const REASONS = [
  'I no longer need the service',
  "I'm moving to a location where the service isn't available",
  "The pricing doesn't work for me",
  "I'm experiencing technical issues",
  'I found a better alternative',
  'Poor customer support experience',
  'Privacy or security concerns',
  'Other',
];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [selectedReason, setSelectedReason] = useState<string>(REASONS[0]);
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. Any active deliveries will be cancelled and refunded. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    setLoading(true);
    try {
      await api.delete('/users/me', { data: { reason: selectedReason } });
      await logout();
      router.replace('/auth/register-choice');
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || 'Failed to delete account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Delete Account</Text>
        <Text style={styles.subtitle}>
          We are sorry to see you go. Could you tell us why you want to delete
          your account?
        </Text>

        {/* Warning box */}
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={18} color="#B45309" />
          <Text style={styles.warningText}>
            All your data, deliveries and wallet balance will be permanently removed.
          </Text>
        </View>

        {/* Reason list */}
        <View style={styles.reasonsList}>
          {REASONS.map((reason, index) => {
            const selected = selectedReason === reason;
            return (
              <React.Fragment key={reason}>
                <Pressable
                  style={styles.reasonRow}
                  onPress={() => setSelectedReason(reason)}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && (
                      <Ionicons name="checkmark" size={14} color={Colors.white} />
                    )}
                  </View>
                  <Text style={styles.reasonText}>{reason}</Text>
                </Pressable>
                {index < REASONS.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      {/* Delete Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.deleteButtonLoading]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.deleteButtonText}>Delete Account</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  title: {
    fontSize: 22,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: '#92400E',
    lineHeight: 20,
  },
  reasonsList: {},
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  divider: { height: 1, backgroundColor: Colors.border },
  footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  deleteButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonLoading: { opacity: 0.8 },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});