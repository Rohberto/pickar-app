import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const CLOUDINARY_CLOUD = 'dtr1shkje';
const CLOUDINARY_PRESET = 'pickar_profiles';

const MenuItem = ({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  rightElement,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  rightElement?: React.ReactNode;
}) => (
  <Pressable
    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    onPress={onPress}
  >
    <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
      <Ionicons
        name={icon}
        size={19}
        color={danger ? Colors.error : Colors.primary}
      />
    </View>
    <View style={styles.menuCenter}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
    </View>
    {rightElement ?? (
      !danger && <Ionicons name="chevron-forward" size={17} color={Colors.textSecondary} />
    )}
  </Pressable>
);

export default function AccountScreen() {
  const router = useRouter();
  const { user, logout, setUserPhoto } = useAuth() as any;
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as any);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('folder', 'pickar/profiles');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload failed');

      await api.patch('/users/me', { photo: data.secure_url });
      if (setUserPhoto) await setUserPhoto(data.secure_url);
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  const handleContactUs = () => {
    Alert.alert(
      'Contact Us',
      'How would you like to reach us?',
      [
        {
          text: 'Email Us',
          onPress: () => Linking.openURL('mailto:support@pickar.ng?subject=Support Request'),
        },
        {
          text: 'Call Us',
          onPress: () => Linking.openURL('tel:+2348000000000'),
        },
        {
          text: 'WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/2348000000000'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const avatarUri = user?.photo
    ? user.photo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=8B1538&color=ffffff&size=128&bold=true`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatarPressable}
              onPress={handlePickAndUploadPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.85}
            >
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              {uploadingPhoto && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={Colors.white} />
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickAndUploadPhoto}
              disabled={uploadingPhoto}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              {uploadingPhoto
                ? <ActivityIndicator size={10} color={Colors.white} />
                : <Ionicons name="camera" size={11} color={Colors.white} />
              }
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {/* Account settings */}
        <View style={styles.section}>
          <MenuItem
            icon="person-outline"
            label="Personal Information"
            sublabel="Name, phone, email"
            onPress={() => router.push('/user/account/your-profile')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Security"
            sublabel="Password & authentication"
            onPress={() => router.push('/user/account/security')}
          />
        </View>

        {/* Support */}
        <View style={styles.section}>
          <MenuItem
            icon="chatbubble-ellipses-outline"
            label="Contact Us"
            sublabel="Email, call or WhatsApp"
            onPress={handleContactUs}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="help-circle-outline"
            label="Help & FAQ"
            onPress={() => router.push('/user/account/help' as never)}
          />
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <MenuItem
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
          <View style={styles.divider} />
          <MenuItem
            icon="trash-outline"
            label="Delete Account"
            onPress={() => router.push('/user/account/delete-account')}
            danger
          />
        </View>

        <Text style={styles.version}>Pickar v1.0.0</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { flex: 1, paddingHorizontal: 20 },
  title: {
    fontSize: 26,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 24,
  },
  profileSection: { alignItems: 'center', marginBottom: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 10 },
  avatarPressable: {
    width: 84, height: 84, borderRadius: 42,
    overflow: 'hidden', backgroundColor: Colors.lightGray,
    borderWidth: 3, borderColor: Colors.primary,
  },
  avatar: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  userName: {
    fontSize: 17,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  menuItemPressed: { backgroundColor: Colors.lightGray },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconBoxDanger: {
    backgroundColor: '#FEE2E2',
  },
  menuCenter: { flex: 1 },
  menuLabel: {
    fontSize: 15, fontFamily: Fonts.poppins.medium, color: Colors.textPrimary,
  },
  menuLabelDanger: { color: Colors.error },
  menuSublabel: {
    fontSize: 12, fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary, marginTop: 1,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});