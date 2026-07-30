// app/auth/driver/signup.tsx
import Button from '@/components/ui/button';
import DocumentUpload from '@/components/ui/documentUpload';
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

type Step = 1 | 2 | 3;
const STEP_TITLES: Record<Step, string> = {
  1: 'Personal Information',
  2: 'Identity Verification',
  3: 'Security',
};

export default function DriverSignupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [step, setStep] = useState<Step>(1);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    nationality: '',
    stateOfOrigin: '',
    residentialAddress: '',
    idDocument: '',
    proofOfAddress: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const animateStep = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    animateStep();
  }, [step]);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.nationality.trim()) newErrors.nationality = 'Nationality is required';
    if (!formData.stateOfOrigin.trim()) newErrors.stateOfOrigin = 'State of origin is required';
    if (!formData.residentialAddress.trim()) newErrors.residentialAddress = 'Residential address is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.idDocument) newErrors.idDocument = 'Valid ID document is required';
    if (!formData.proofOfAddress) newErrors.proofOfAddress = 'Proof of address is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
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

  const handleNext = () => {
    const valid = step === 1 ? validateStep1() : validateStep2();
    if (!valid) return;
    setErrors({});
    setStep((prev) => (prev + 1) as Step);
  };

  const handleBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setErrors({});
    setStep((prev) => (prev - 1) as Step);
  };

  const handleRegister = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const response = await authService.signupDriver({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        nationality: formData.nationality,
        stateOfOrigin: formData.stateOfOrigin,
        residentialAddress: formData.residentialAddress,
        password: formData.password,
        idDocument: formData.idDocument,
        proofOfAddress: formData.proofOfAddress,
      });

      if (response.success) {
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
          <View style={styles.content}>
            {/* Header */}
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </Pressable>

            <Text style={styles.title}>Register as Driver</Text>

            {/* Step progress */}
            <View style={styles.progressRow}>
              {[1, 2, 3].map((s) => (
                <View key={s} style={styles.progressItem}>
                  <View
                    style={[
                      styles.progressDot,
                      s < step && styles.progressDotDone,
                      s === step && styles.progressDotActive,
                    ]}
                  >
                    {s < step ? (
                      <Ionicons name="checkmark" size={12} color={Colors.white} />
                    ) : (
                      <Text style={[styles.progressDotText, s === step && styles.progressDotTextActive]}>
                        {s}
                      </Text>
                    )}
                  </View>
                  {s < 3 && <View style={[styles.progressLine, s < step && styles.progressLineDone]} />}
                </View>
              ))}
            </View>

            <Text style={styles.subtitle}>
              Step {step} of 3 — {STEP_TITLES[step]}
            </Text>

            <Animated.View style={[styles.form, { opacity: fadeAnim }]}>
              {/* ── STEP 1: Personal Information ── */}
              {step === 1 && (
                <>
                  <Input
                    label="Full Name"
                    placeholder="John Wilson"
                    value={formData.fullName}
                    onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                    error={errors.fullName}
                  />

                  <Input
                    label="Email"
                    placeholder="Enter your email address"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={errors.email}
                  />

                  <PhoneInput
                    label="Phone number"
                    value={formData.phone}
                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                    error={errors.phone}
                  />

                  <Input
                    label="Nationality"
                    placeholder="e.g. Nigerian"
                    value={formData.nationality}
                    onChangeText={(text) => setFormData({ ...formData, nationality: text })}
                    autoCapitalize="words"
                    error={errors.nationality}
                  />

                  <Input
                    label="State of Origin"
                    placeholder="e.g. Lagos State"
                    value={formData.stateOfOrigin}
                    onChangeText={(text) => setFormData({ ...formData, stateOfOrigin: text })}
                    autoCapitalize="words"
                    error={errors.stateOfOrigin}
                  />

                  <Input
                    label="Residential Address"
                    placeholder="Your current residential address"
                    value={formData.residentialAddress}
                    onChangeText={(text) => setFormData({ ...formData, residentialAddress: text })}
                    error={errors.residentialAddress}
                  />

                  <Button title="Continue" onPress={handleNext} />
                </>
              )}

              {/* ── STEP 2: Identity Verification ── */}
              {step === 2 && (
                <>
                  <Text style={styles.sectionDescription}>
                    Upload a valid government-issued ID (NIN, Driver's License, Passport, or Voter's Card)
                  </Text>

                  <DocumentUpload
                    label="Valid ID Document"
                    placeholder="Upload ID (NIN, License, Passport)"
                    value={formData.idDocument}
                    onSelect={(uri) => setFormData({ ...formData, idDocument: uri })}
                    error={errors.idDocument}
                  />

                  <DocumentUpload
                    label="Proof of Address"
                    placeholder="Upload utility bill or bank statement"
                    value={formData.proofOfAddress}
                    onSelect={(uri) => setFormData({ ...formData, proofOfAddress: uri })}
                    error={errors.proofOfAddress}
                  />

                  <Button title="Continue" onPress={handleNext} />
                </>
              )}

              {/* ── STEP 3: Security ── */}
              {step === 3 && (
                <>
                  <Input
                    label="Password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    isPassword
                    error={errors.password}
                  />

                  <Input
                    label="Confirm Password"
                    placeholder="Enter password again"
                    value={formData.confirmPassword}
                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                    isPassword
                    error={errors.confirmPassword}
                  />

                  <Button title="Register" onPress={handleRegister} loading={loading} />

                  <View style={styles.loginContainer}>
                    <Text style={styles.loginText}>Already have an account? </Text>
                    <Pressable onPress={() => router.push('/auth/driver/login' as never)}>
                      <Text style={styles.loginLink}>Login</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.termsText}>
                    By creating an account, you understand and agree to our{' '}
                    <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>
                  </Text>
                </>
              )}
            </Animated.View>
          </View>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 20,
  },

  // Progress indicator
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  progressDotDone: {
    backgroundColor: Colors.primary,
  },
  progressDotText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textSecondary,
  },
  progressDotTextActive: {
    color: Colors.white,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.lightGray,
    marginHorizontal: 4,
  },
  progressLineDone: {
    backgroundColor: Colors.primary,
  },

  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  form: {
    flex: 1,
  },
  sectionDescription: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
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
    paddingBottom: 20,
  },
  termsLink: {
    fontFamily: Fonts.poppins.medium,
    color: Colors.primary,
  },
});