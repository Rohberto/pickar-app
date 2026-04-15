
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  countryCode?: string;
  onCountryCodePress?: () => void;
}

export default function PhoneInput({
  label,
  value,
  onChangeText,
  error,
  countryCode = '+234',
  onCountryCodePress,
}: PhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useState(new Animated.Value(0))[0];

  const handleFocus = () => {
    setIsFocused(true);
    Animated.spring(focusAnim, {
      toValue: 1,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.spring(focusAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.inputContainer, { borderColor }]}>
        <TouchableOpacity
          style={styles.countryCode}
          onPress={onCountryCodePress}
        >
          <Text style={styles.flag}>🇳🇬</Text>
          <Text style={styles.code}>{countryCode}</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="0000 000 0000"
          placeholderTextColor={Colors.textLight}
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: Colors.lightGray,
    height: 56,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    gap: 8,
  },
  flag: {
    fontSize: 20,
  },
  code: {
    fontSize: 16,
    fontFamily: Fonts.poppins.medium,
    color: Colors.textPrimary,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    paddingHorizontal: 16,
  },
  error: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.error,
    marginTop: 4,
  },
});
