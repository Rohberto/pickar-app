import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const SecurityOption = ({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <Pressable
    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
    onPress={onPress}
  >
    <View style={styles.optionText}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
  </Pressable>
);

export default function SecurityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.optionList}>
          <SecurityOption
            title="Reset Password"
            subtitle="Change your current password"
            onPress={() => router.push('/user/account/reset-password')}
          />
          <View style={styles.divider} />
          <SecurityOption
            title="Forgot Password"
            subtitle="Forgotten your password? Create a new one"
            onPress={() => router.push('/user/account/forgot-password')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 18,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  optionList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  optionPressed: {
    opacity: 0.7,
  },
  optionText: {
    flex: 1,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});