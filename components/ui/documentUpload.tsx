
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface DocumentUploadProps {
  label: string;
  value: string | null;
  onSelect: (uri: string) => void;
  error?: string;
  placeholder?: string;
}

export default function DocumentUpload({
  label,
  value,
  onSelect,
  error,
  placeholder = 'Upload document',
}: DocumentUploadProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to upload documents.'
      );
      return false;
    }
    return true;
  };

  const handlePress = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onSelect(result.assets[0].uri);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onSelect('') },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          style={[styles.uploadBox, error && styles.uploadBoxError]}
          onPress={handlePress}
        >
          {value ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: value }} style={styles.image} />
              <Pressable style={styles.removeButton} onPress={handleRemove}>
                <Ionicons name="close-circle" size={24} color={Colors.error} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.uploadContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="cloud-upload-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.uploadText}>{placeholder}</Text>
              <Text style={styles.uploadHint}>JPG, PNG (Max 5MB)</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    minHeight: 150,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  uploadBoxError: {
    borderColor: Colors.error,
  },
  uploadContent: {
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  error: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.error,
    marginTop: 4,
  },
});
