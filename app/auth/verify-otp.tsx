// app/auth/verify-otp.tsx
import Button from '@/components/ui/button';
import OTPInput from '@/components/ui/OTPInput';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function VerifyOTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setAuthenticated, setUserType, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [fadeAnim] = useState(new Animated.Value(0));

  const email = params.email as string;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleComplete = (code: string) => {
    setOtp(code);
    Keyboard.dismiss();
  };

  const handleVerify = async () => {
    if (otp.length !== 4) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await authService.verifyOTP({
        email,
        otp,
      });

      if (response.success && response.data) {
        // Update auth state
        const userType = response.data.user.userType;
        await setUserType(userType);
        await setAuthenticated(true);
        setUser({
          id: response.data.user.id,
          name: response.data.user.fullName,
          email: response.data.user.email,
          type: userType,
        });

        // Navigate based on user type
        if (userType === 'user') {
          router.replace('/user/(tabs)/home' as never);
        } else {
          router.replace('/driver/(tabs)/home' as never);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Verification failed');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    try {
      const response = await authService.resendOTP(email);
      if (response.success) {
        Alert.alert('Success', 'OTP sent successfully');
        setResendTimer(60);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>OTP Verification</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Enter OTP Code</Text>
          <Text style={styles.subtitle}>
            We sent a OTP verification code to {email}. Enter the OTP
            verification code to verify your account.
          </Text>

          <OTPInput length={4} onComplete={handleComplete} />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't see the code? </Text>
            <Pressable onPress={handleResend} disabled={resendTimer > 0}>
              <Text
                style={[
                  styles.resendLink,
                  resendTimer > 0 && styles.resendLinkDisabled,
                ]}
              >
                Resend Code {resendTimer > 0 && `(${resendTimer}s)`}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length !== 4}
          />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginRight: 40,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
  },
  resendLinkDisabled: {
    color: Colors.textLight,
  },
  footer: {
    paddingBottom: 40,
  },
});