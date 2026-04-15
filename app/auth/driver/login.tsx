// app/auth/driver/login.tsx
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
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

export default function DriverLoginScreen() {
  const router = useRouter();
  const { setAuthenticated, setUserType, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await authService.login({
        email: formData.email,
        password: formData.password,
        userType: 'driver',
      });

      if (response.success && response.data) {
        // Update auth state
        await setUserType('driver');
        await setAuthenticated(true);
        setUser({
          id: response.data.user.id,
          name: response.data.user.fullName,
          email: response.data.user.email,
          type: 'driver',
        });

        // Navigate to driver home
        router.replace('/(driver)/(tabs)/home' as never);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Login failed');
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

            <Text style={styles.title}>Driver Login</Text>
            <Text style={styles.subtitle}>
              Login to your driver account to continue
            </Text>

            {/* Form */}
            <View style={styles.form}>
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

              <View style={styles.optionsRow}>
                <Pressable
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color={Colors.white} />
                    )}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </Pressable>

                <Pressable onPress={() => router.push('/auth/forgot-password' as never)}>
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </Pressable>
              </View>

              <Button
                title="Login"
                onPress={handleLogin}
                loading={loading}
              />

              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <Pressable onPress={() => router.push('/auth/driver/signup' as never)}>
                  <Text style={styles.signupLink}>Sign up</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Same styles as user login...
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
  },
  form: {
    flex: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rememberMeText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  forgotPassword: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  signupLink: {
    fontSize: 14,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
  },
});