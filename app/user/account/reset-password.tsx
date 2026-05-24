import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const PasswordField = ({
  label,
  placeholder,
  value,
  onChangeText,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) => {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputContainer, focused && styles.inputFocused]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          secureTextEntry={!visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
        />
        <Pressable onPress={() => setVisible(v => !v)} hitSlop={8}>
          <Ionicons
            name={visible ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={Colors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  );
};

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid =
    oldPassword.length >= 8 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword;

  const handleReset = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      if (data.success) {
        Alert.alert('Success', 'Password changed successfully!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Security</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Fill the fields below to reset your password. Choose a password
            that will be easy for you to remember.
          </Text>

          <PasswordField
            label="Old password"
            placeholder="Enter your current password"
            value={oldPassword}
            onChangeText={setOldPassword}
          />
          <PasswordField
            label="New password"
            placeholder="Enter new password (min. 8 characters)"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <PasswordField
            label="Confirm password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.resetButton, (!isValid || loading) && styles.resetButtonDisabled]}
            onPress={handleReset}
            disabled={!isValid || loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.resetButtonText}>Reset Password</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  backButton: { width: 40, height: 40, justifyContent: 'center' },
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
    marginBottom: 28,
  },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: Colors.primary },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.error,
    marginTop: -12,
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
  },
  resetButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonDisabled: { backgroundColor: '#E8C4CE' },
  resetButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});