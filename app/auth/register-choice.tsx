import Button from '@/components/ui/button';
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

type RoleType = 'user' | 'driver' | null;

export default function RegisterChoiceScreen() {
  const [selectedRole, setSelectedRole] = useState<RoleType>(null);
  const router = useRouter();
  const { setUserType } = useAuth();

  const handleRegister = async () => {
    if (!selectedRole) return;
    
    await setUserType(selectedRole);
    
    if (selectedRole === 'user') {
      router.push('/auth/user/signup' as never);
    } else {
      router.push('/auth/driver/signup' as never);
    }
  };

  const handleLogin = () => {
    if (!selectedRole) {
      // If no role selected, go to login choice screen
      Alert.alert('Select a role')
      return;
    }

    // Navigate to appropriate login screen based on selected role
    if (selectedRole === 'user') {
      router.push('/auth/user/login' as never);
    } else {
      router.push('/auth/driver/login' as never);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        <Text style={styles.title}>How do you want to register?</Text>

        <View style={styles.rolesContainer}>
          <Pressable
            style={[
              styles.roleCard,
              selectedRole === 'user' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('user')}
          >
            <View style={[
              styles.iconContainer,
              selectedRole === 'user' && styles.iconContainerSelected
            ]}>
              <Ionicons 
                name="person-outline" 
                size={32} 
                color={selectedRole === 'user' ? Colors.primary : Colors.textSecondary} 
              />
            </View>
            <View style={styles.roleInfo}>
              <Text style={[
                styles.roleTitle,
                selectedRole === 'user' && styles.roleTextSelected
              ]}>
                User
              </Text>
              <Text style={[
                styles.roleDescription,
                selectedRole === 'user' && styles.roleTextSelected
              ]}>
                Individual account for personal use
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.roleCard,
              selectedRole === 'driver' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('driver')}
          >
            <View style={[
              styles.iconContainer,
              selectedRole === 'driver' && styles.iconContainerSelected
            ]}>
              <Ionicons 
                name="bicycle-outline" 
                size={32} 
                color={selectedRole === 'driver' ? Colors.primary : Colors.textSecondary} 
              />
            </View>
            <View style={styles.roleInfo}>
              <Text style={[
                styles.roleTitle,
                selectedRole === 'driver' && styles.roleTextSelected
              ]}>
                Driver
              </Text>
              <Text style={[
                styles.roleDescription,
                selectedRole === 'driver' && styles.roleTextSelected
              ]}>
                Deliver a package and earn money
              </Text>
            </View>
          </Pressable>
        </View>

        <Button
          title="Register"
          onPress={handleRegister}
          disabled={!selectedRole}
        />

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Pressable onPress={handleLogin}>
            <Text style={styles.loginLink}>Login</Text>
          </Pressable>
        </View>

        <Text style={styles.termsText}>
          By creating an account, you understand and agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
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
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 32,
  },
  rolesContainer: {
    gap: 16,
    marginBottom: 32,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  roleCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconContainerSelected: {
    backgroundColor: Colors.white,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  roleTextSelected: {
    color: Colors.white,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
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