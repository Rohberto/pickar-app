
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Pressable,
    StyleSheet,
    Text,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const [scaleAnim] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.button,
          variant === 'primary' ? styles.primary : styles.secondary,
          isDisabled && styles.disabled,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text
            style={[
              styles.text,
              variant === 'secondary' && styles.secondaryText,
            ]}
          >
            {title}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.lightGray,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
  secondaryText: {
    color: Colors.textPrimary,
  },
});
