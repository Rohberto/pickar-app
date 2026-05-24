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
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const CLOUDINARY_CLOUD = 'dtr1shkje';
const CLOUDINARY_PRESET = 'pickar_profiles';

export default function YourProfileScreen() {
  const router = useRouter();
  const { user, setUser, setUserPhoto } = useAuth() as any;

  const [name, setName] = useState<string>(user?.name || '');
  const [nameFocused, setNameFocused] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const nameChanged = name.trim() !== (user?.name || '').trim();

  const handleSaveName = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    setSavingName(true);
    try {
      const { data } = await api.patch('/users/me', { fullName: name.trim() });
      if (data.success) {
        setUser({ ...user, name: name.trim() });
        Alert.alert('Success', 'Name updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

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

  const avatarUri = user?.photo
    ? user.photo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=8B1538&color=ffffff&size=128&bold=true`;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Profile</Text>
          {/* Save button only appears when name has changed */}
          {nameChanged ? (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveName}
              disabled={savingName}
            >
              {savingName
                ? <ActivityIndicator size={14} color={Colors.primary} />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          ) : (
            <View style={{ width: 48 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <TouchableOpacity
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
                style={styles.editBadge}
                onPress={handlePickAndUploadPhoto}
                disabled={uploadingPhoto}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              >
                <Ionicons name="pencil" size={12} color={Colors.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.addPhotoText}>Tap to change photo</Text>
          </View>

          {/* Full Name — editable */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={[styles.fieldValue, nameFocused && styles.fieldValueFocused]}>
              <TextInput
                style={styles.fieldInput}
                value={name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={nameChanged ? handleSaveName : undefined}
              />
              {nameChanged && !savingName && (
                <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
              )}
            </View>
          </View>

          {/* Phone — read only */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone number</Text>
            <View style={styles.fieldValue}>
              <Text style={styles.fieldText}>{user?.phone || '-'}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>

          {/* Email — read only */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.fieldValue}>
              <Text style={[styles.fieldText, { flex: 1 }]}>{user?.email || '-'}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={15} color="#22C55E" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    fontSize: 17,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.offWhite ?? '#FEF5F7',
    borderWidth: 1,
    borderColor: Colors.primary,
    minWidth: 48,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.primary,
  },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginBottom: 36 },
  avatarWrapper: { position: 'relative', marginBottom: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.lightGray,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    borderRadius: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 52,
  },
  fieldValueFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    paddingVertical: 14,
  },
  fieldText: {
    fontSize: 15,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: Fonts.poppins.medium,
    color: '#22C55E',
  },
});