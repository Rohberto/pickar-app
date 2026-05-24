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
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = email.includes('@') && email.includes('.');

  const handleSendOTP = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      if (data.success) {
        router.push({
          pathname: '/user/account/forgot-password-reset',
          params: { email: email.trim() },
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to send OTP. Try again.');
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

        <View style={styles.content}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter the email address associated with your account. We'll send
            you a code to reset your password.
          </Text>

          <Text style={styles.fieldLabel}>Email address</Text>
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.sendButton, (!isValid || loading) && styles.sendButtonDisabled]}
            onPress={handleSendOTP}
            disabled={!isValid || loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.sendButtonText}>Send Code</Text>
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
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
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
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
  },
  inputFocused: { borderColor: Colors.primary },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#E8C4CE' },
  sendButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});