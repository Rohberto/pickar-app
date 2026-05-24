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
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable
    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    onPress={onPress}
  >
    <View style={styles.menuLeft}>
      <Ionicons
        name={icon}
        size={22}
        color={danger ? Colors.error : Colors.textPrimary}
      />
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
        {label}
      </Text>
    </View>
    {!danger && (
      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
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
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as any);
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

  const avatarUri = user?.photo
    ? user.photo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=8B1538&color=ffffff&size=128&bold=true`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatarPressable}
              onPress={handlePickAndUploadPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.85}
            >
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
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
        </View>

        <View style={styles.section}>
          <MenuItem
            icon="person-outline"
            label="Personal Information"
            onPress={() => router.push('/user/account/your-profile')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="shield-outline"
            label="Security"
            onPress={() => router.push('/user/account/security')}
          />
        </View>

        <View style={styles.section}>
          <MenuItem
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="trash-outline"
            label="Delete Account"
            onPress={() => router.push('/user/account/delete-account')}
            danger
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, paddingHorizontal: 20 },
  title: {
    fontSize: 26,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 24,
  },
  profileSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarPressable: {
    width: 80, height: 80, borderRadius: 40,
    overflow: 'hidden', backgroundColor: Colors.lightGray,
  },
  avatar: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  userName: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 16,
  },
  menuItemPressed: { backgroundColor: Colors.lightGray },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: {
    fontSize: 15, fontFamily: Fonts.poppins.regular, color: Colors.textPrimary,
  },
  menuLabelDanger: { color: Colors.error },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
});