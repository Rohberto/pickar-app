import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

const OTP_LENGTH = 4;

export default function ForgotPasswordResetScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [otp, setOtp] = useState(['', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH).split('');
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < OTP_LENGTH) newOtp[index + i] = d; });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert('Sent', 'A new code has been sent to your email.');
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      Alert.alert('Error', 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleReset = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email,
        otp: otp.join(''),
        newPassword,
      });
      if (data.success) {
        Alert.alert('Success', 'Password reset successfully! Please log in.', [
          {
            text: 'Log In',
            onPress: () => router.replace('/auth/register-choice'),
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const otpComplete = otp.every(d => d !== '');
  const isValid = otpComplete && newPassword.length >= 8 && newPassword === confirmPassword;

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
            Enter the 4-digit code sent to{' '}
            <Text style={styles.emailBold}>{email}</Text>, then set your new password.
          </Text>

          {/* OTP Boxes */}
          <Text style={styles.fieldLabel}>Verification Code</Text>
          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={ref => { inputRefs.current[index] = ref; }}
                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                value={digit}
                onChangeText={value => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              {resending
                ? <ActivityIndicator size={12} color={Colors.primary} />
                : <Text style={styles.resendLink}>Resend</Text>
              }
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={[styles.inputContainer]}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={8}>
                <Ionicons
                  name={showConfirm ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>
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
    marginBottom: 24,
  },
  emailBold: {
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    fontSize: 22,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderBottomColor: Colors.primary,
    color: Colors.primary,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  resendText: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 13,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  fieldGroup: { marginBottom: 20 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
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
    marginTop: 6,
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