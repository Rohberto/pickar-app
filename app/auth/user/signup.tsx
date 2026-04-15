// app/auth/user/signup.tsx
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import PhoneInput from '@/components/ui/phoneInput';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import authService from '@/services/authService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function UserSignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await authService.signupUser({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      if (response.success) {
        // Navigate to OTP screen with email
        router.push({
          pathname: '/auth/verify-otp',
          params: { email: formData.email },
        } as never);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Header */}
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </Pressable>

            <Text style={styles.title}>Register Your Account</Text>
            <Text style={styles.subtitle}>
              Fill your information below to register{'\n'}your account
            </Text>

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Full Name"
                placeholder="John Wilson"
                value={formData.fullName}
                onChangeText={(text) =>
                  setFormData({ ...formData, fullName: text })
                }
                error={errors.fullName}
              />

              <Input
                label="Email"
                placeholder="Enter your email address"
                value={formData.email}
                onChangeText={(text) =>
                  setFormData({ ...formData, email: text })
                }
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
              />

              <PhoneInput
                label="Phone number"
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
                error={errors.phone}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={formData.password}
                onChangeText={(text) =>
                  setFormData({ ...formData, password: text })
                }
                isPassword
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                placeholder="Enter password again"
                value={formData.confirmPassword}
                onChangeText={(text) =>
                  setFormData({ ...formData, confirmPassword: text })
                }
                isPassword
                error={errors.confirmPassword}
              />

              <Button
                title="Register"
                onPress={handleRegister}
                loading={loading}
              />

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <Pressable onPress={() => router.push('/auth/user/login' as never)}>
                  <Text style={styles.loginLink}>Login</Text>
                </Pressable>
              </View>

              <Text style={styles.termsText}>
                By creating an account, you understand and agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
  },
  termsText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },
});
