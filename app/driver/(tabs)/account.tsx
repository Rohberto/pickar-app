import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function DriverAccountScreen() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/register-choice');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={40} color={Colors.textSecondary} />
        </View>

        {/* Name + email */}
        <Text style={styles.name}>{user?.name ?? 'Driver'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <View style={styles.divider} />

        {/* Logout */}
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 48 },

  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontFamily: Fonts.poppins.semiBold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontFamily: Fonts.poppins.regular,
    fontSize: 14,
    color: Colors.textSecondary,
  },

  divider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 32,
  },

  logoutButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  logoutText: {
    fontFamily: Fonts.poppins.semiBold,
    fontSize: 15,
    color: Colors.error,
  },
});