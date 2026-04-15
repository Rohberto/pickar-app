
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/register-choice');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>{user?.name || user?.email}</Text>
        
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
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
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.error,
  },
});
