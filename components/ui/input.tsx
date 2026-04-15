import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View,
} from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export default function Input({
  label,
  error,
  icon,
  isPassword,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
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
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? Colors.primary : Colors.textSecondary}
            style={styles.icon}
          />
        )}
        <TextInput
          style={styles.input}
          placeholderTextColor={Colors.textLight}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !isPasswordVisible}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
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
    paddingHorizontal: 16,
    height: 56,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
  },
  eyeIcon: {
    padding: 8,
  },
  error: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.error,
    marginTop: 4,
  },
});
