
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

interface OTPInputProps {
  length?: number;
  onComplete: (otp: string) => void;
}

export default function OTPInput({ length = 4, onComplete }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<TextInput[]>([]);
  const shakeAnims = useRef(
    Array(length).fill(0).map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text[text.length - 1];
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Animate the box
    Animated.sequence([
      Animated.timing(shakeAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnims[index], {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Move to next input
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if OTP is complete
    if (index === length - 1 && text) {
      const completeOtp = [...newOtp];
      completeOtp[index] = text;
      if (completeOtp.every((digit) => digit !== '')) {
        onComplete(completeOtp.join(''));
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {otp.map((digit, index) => {
        const scale = shakeAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.1],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.inputWrapper,
              { transform: [{ scale }] },
            ]}
          >
            <TextInput
              ref={(ref) => {
                if (ref) inputRefs.current[index] = ref;
              }}
              style={[
                styles.input,
                focusedIndex === index && styles.inputFocused,
                digit && styles.inputFilled,
              ]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              onFocus={() => setFocusedIndex(index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 32,
  },
  inputWrapper: {
    flex: 1,
    marginHorizontal: 6,
  },
  input: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.lightGray,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
});
