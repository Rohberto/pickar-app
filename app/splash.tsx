
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
const { width, height } = Dimensions.get('window');
const AnimatedPath = Animated.createAnimatedComponent(Path);

// EXACT paths from website preloader
const BIRD_PATH = 
  "M55.76,57.78c-10-13.55-23.23-19-39.57-19.48," +
  "3.45,6.21,10.42,18.12,12.21,22.78," +
  "3.21,9.8-3.27,19.45-13.8,19.54C4.29,80.7-2.42,70.76.82,61.08c2-5.92," +
  "8.69-17,12.1-22.81l-1.4,0c.77-.55,1.53-1.07,2.3-1.56.31-.6.73-.79," +
  "1.14-.69,8.56-5,17.31-6,26.06-7.12C35.75,15.12,26.23,5.22,14.58.84c36-7," +
  "48.41,32,65.29,33.33,17.66,1.4,54.54-36.87,93.6-23.74-25.22,8.6-45.15," +
  "21.22-58.21,43,18.32,7.79,34.06,20,43.38,36.59C116.11,63.74,77.77,87.57," +
  "55.77,57.78Z" +
  "M15.25,38.28l-1.32,0c-1.06,2.58-2.88,7.25-3.42,9.08-.94,3.18,1,6.43," +
  "4,6.4s5-3.19,4-6.4c-.49-1.43-2.27-6.36-3.31-9.06Z";

// COMPLETE WORDMARK PATH from website
const WORDMARK_PATH = 
  "M145.13,329.39v23.08a.49.49,0,0,1-.52.46h-8.16a.49.49,0,0,1-.52-.46V290.28a.49.49,0,0,1,.52-.46h19.13a37.52,37.52,0,0,1,10.07,1.23,21.54,21.54,0,0,1,7.6,3.74,16,16,0,0,1,4.74,6,19.49,19.49,0,0,1,1.57,8,19.1,19.1,0,0,1-1.75,8.22,19.31,19.31,0,0,1-5.25,6.61l0,0a23.64,23.64,0,0,1-8.17,4.3,36.4,36.4,0,0,1-10.58,1.43h-8.65Z" +
  "M144.13,352V328.93a.49.49,0,0,1,.52-.46h9.18A35.08,35.08,0,0,0,164,327.08a22.73,22.73,0,0,0,7.81-4.09l0,0a17.5,17.5,0,0,0,6.67-14.15,18.51,18.51,0,0,0-1.5-7.67,14.79,14.79,0,0,0-4.46-5.66,20.58,20.58,0,0,0-7.22-3.55,36.48,36.48,0,0,0-9.76-1.19H137V352Z" +
  "M145.13,297.32v24.57h8a28,28,0,0,0,7.29-.85,14.47,14.47,0,0,0,5.25-2.49,10.47,10.47,0,0,0,3.2-4,13,13,0,0,0,1.07-5.4q0-5.94-3.9-8.89t-11.9-3Z" +
  "M144.13,322.32v-25.5a.49.49,0,0,1,.52-.46h9.57q8.34,0,12.57,3.19t4.26,9.59a13.79,13.79,0,0,1-1.14,5.75,11.41,11.41,0,0,1-3.48,4.33,15.59,15.59,0,0,1-5.63,2.68,29.92,29.92,0,0,1-7.59.88h-8.56a.5.5,0,0,1-.52-.46Z" +
  "M192.13,299.9a6.14,6.14,0,0,1-2.17-.37,5.64,5.64,0,0,1-1.83-1.07,4.79,4.79,0,0,1-1.25-1.64,4.68,4.68,0,0,1-.42-2,4.78,4.78,0,0,1,.42-2,4.85,4.85,0,0,1,1.25-1.65,5.63,5.63,0,0,1,1.82-1.08,6.42,6.42,0,0,1,2.17-.36,6.73,6.73,0,0,1,2.23.36,5.7,5.7,0,0,1,1.86,1.08,4.92,4.92,0,0,1,1.26,1.65l0,0a4.84,4.84,0,0,1,.41,2,4.45,4.45,0,0,1-.43,1.95,4.85,4.85,0,0,1-1.26,1.63,5.59,5.59,0,0,1-1.87,1.11,6.39,6.39,0,0,1-2.22.37Z" +
  "M190.35,298.67a5.16,5.16,0,0,0,1.78.3,5.4,5.4,0,0,0,1.83-.3,4.63,4.63,0,0,0,1.53-.92,4,4,0,0,0,1-1.33,3.71,3.71,0,0,0,.35-1.6,4,4,0,0,0-.34-1.63h0a3.83,3.83,0,0,0-1-1.34A4.6,4.6,0,0,0,194,291a5.48,5.48,0,0,0-1.85-.3,5.06,5.06,0,0,0-1.77.3,4.52,4.52,0,0,0-1.49.88,3.8,3.8,0,0,0-1,1.34,4.17,4.17,0,0,0,0,3.3,3.7,3.7,0,0,0,1,1.31,4.62,4.62,0,0,0,1.49.88Z" +
  "M196,352.93h-8a.5.5,0,0,1-.52-.47V308.05a.5.5,0,0,1,.52-.47h8a.49.49,0,0,1,.52.47v44.41A.49.49,0,0,1,196,352.93Z" +
  "M188.54,352h6.94V308.51h-6.94Z" +
  "M241.13,351a24.13,24.13,0,0,1-6.06,2.2,31.88,31.88,0,0,1-7.09.74,27.42,27.42,0,0,1-9.33-1.5,20.91,20.91,0,0,1-7.37-4.53l0,0a19.92,19.92,0,0,1-4.74-6.9,22.84,22.84,0,0,1-1.58-8.64,25.77,25.77,0,0,1,1.7-9.57,21,21,0,0,1,5.13-7.52,22.33,22.33,0,0,1,8-4.86A30.47,30.47,0,0,1,230,308.78a32.26,32.26,0,0,1,6,.53,25,25,0,0,1,5.24,1.57.46.46,0,0,1,.29.42v6.89a.49.49,0,0,1-.52.46.58.58,0,0,1-.32-.1,21.36,21.36,0,0,0-5.29-2.39,20.08,20.08,0,0,0-5.65-.79,17.39,17.39,0,0,0-6.39,1.12,15,15,0,0,0-8.48,8.6,20.21,20.21,0,0,0-.07,13.18A13.41,13.41,0,0,0,218,343.2l0,0a13.67,13.67,0,0,0,4.9,3.08,18.28,18.28,0,0,0,6.4,1,19.65,19.65,0,0,0,5.83-.87,21.16,21.16,0,0,0,5.48-2.66.57.57,0,0,1,.73.1.43.43,0,0,1,.11.27v6.39A.48.48,0,0,1,241.13,351Z" +
  "M234.82,352.31a23.34,23.34,0,0,0,5.56-2V345.1a21.79,21.79,0,0,1-4.93,2.25,20.7,20.7,0,0,1-6.17.94,19.63,19.63,0,0,1-6.8-1.11,14.79,14.79,0,0,1-5.27-3.32l0,0a14.41,14.41,0,0,1-3.38-5.27,19.22,19.22,0,0,1-1.12-6.79,19.58,19.58,0,0,1,1.2-7,15.59,15.59,0,0,1,3.58-5.55,15.86,15.86,0,0,1,5.46-3.61,18.59,18.59,0,0,1,6.81-1.2,21.26,21.26,0,0,1,6,.84,22.11,22.11,0,0,1,4.77,2v-5.73a24.45,24.45,0,0,0-4.7-1.38,31,31,0,0,0-5.76-.5,29.19,29.19,0,0,0-9.86,1.55,21.46,21.46,0,0,0-7.63,4.63,20.13,20.13,0,0,0-4.91,7.2,24.72,24.72,0,0,0-1.64,9.26,22,22,0,0,0,1.52,8.33,18.82,18.82,0,0,0,4.52,6.58l0,0a19.79,19.79,0,0,0,7,4.31A26.16,26.16,0,0,0,228,353a31.33,31.33,0,0,0,6.83-.71Z" +
  "M288.69,352.93H278.08a.56.56,0,0,1-.42-.18l-20.11-19.54v19.26a.49.49,0,0,1-.52.46h-7.57a.49.49,0,0,1-.52-.46V290a.49.49,0,0,1,.52-.47H257a.49.49,0,0,1,.52.47v38.57L276.67,310a.55.55,0,0,1,.38-.15H287a.49.49,0,0,1,.52.47.45.45,0,0,1-.17.34l-21.54,20,23.28,21.53a.43.43,0,0,1,0,.65.55.55,0,0,1-.36.13Z" +
  "M278.3,352h9.17l-22.78-21.07a.42.42,0,0,1,0-.64l21.07-19.57h-8.48l-19.66,19.16a.52.52,0,0,1-.41.17H257a.5.5,0,0,1-.53-.46V290.48H250V352h6.53V332.2a.5.5,0,0,1,.53-.46h.18a.56.56,0,0,1,.39.15Z" +
  "M327.38,352.92H319.8a.49.49,0,0,1-.52-.46v-5.18a16.39,16.39,0,0,1-5.5,4.7,18.5,18.5,0,0,1-8.7,1.95,22.16,22.16,0,0,1-6.46-.86,13.64,13.64,0,0,1-4.95-2.61,11.27,11.27,0,0,1-3.12-4,12.48,12.48,0,0,1-1-5.16,12.28,12.28,0,0,1,4.06-9.69q4-3.56,12-4.55l13.71-1.72q-.18-9.94-9.21-9.94A24.23,24.23,0,0,0,295,320.5a.59.59,0,0,1-.74-.05.47.47,0,0,1-.12-.31v-6.93a.44.44,0,0,1,.26-.4,29.76,29.76,0,0,1,7.62-3,36.19,36.19,0,0,1,8.69-1q8.57,0,12.88,4.09T327.89,325v27.46a.49.49,0,0,1-.52.46Z" +
  "M320.32,352h6.54V325q0-7.69-4-11.5t-12.12-3.79a35,35,0,0,0-8.42,1,28.87,28.87,0,0,0-7.11,2.77v5.7a25.27,25.27,0,0,1,14.88-4.72q10.26,0,10.26,11.27a.48.48,0,0,1-.45.46L305.71,328q-7.63.94-11.4,4.28a11.47,11.47,0,0,0-3.75,9,11.8,11.8,0,0,0,.95,4.81,10.43,10.43,0,0,0,2.87,3.72,12.88,12.88,0,0,0,4.57,2.41,21.22,21.22,0,0,0,6.13.81,17.46,17.46,0,0,0,8.18-1.83,15.73,15.73,0,0,0,5.9-5.46.51.51,0,0,1,.47-.26h.17a.49.49,0,0,1,.52.46Z" +
  "M319.3,331.64,308.48,333a28.56,28.56,0,0,0-4.51.89,13,13,0,0,0-3.2,1.37h0a4.75,4.75,0,0,0-1.81,2.12,8.32,8.32,0,0,0-.64,3.44,5.94,5.94,0,0,0,.57,2.63,6.19,6.19,0,0,0,1.73,2.09l0,0a8.06,8.06,0,0,0,2.66,1.36,12,12,0,0,0,3.53.47,13.82,13.82,0,0,0,4.93-.84,11.71,11.71,0,0,0,4-2.54,11.08,11.08,0,0,0,2.65-3.85,12.58,12.58,0,0,0,.88-4.8Z" +
  "M308.36,332.06l11.36-1.41h.1a.49.49,0,0,1,.52.47v4.22a13.43,13.43,0,0,1-.94,5.11,12.18,12.18,0,0,1-2.87,4.17,12.83,12.83,0,0,1-4.34,2.76,15,15,0,0,1-5.34.92,13.53,13.53,0,0,1-3.85-.52,9.05,9.05,0,0,1-3-1.55l0,0a6.6,6.6,0,0,1-2.65-5.42A9.14,9.14,0,0,1,298,337a5.74,5.74,0,0,1,2.18-2.52h0a13.86,13.86,0,0,1,3.47-1.49,29.21,29.21,0,0,1,4.7-.92Z" +
  "M363.08,317.44a6.83,6.83,0,0,0-2.22-.91,14,14,0,0,0-3.16-.32,9.17,9.17,0,0,0-4.2,1A10.46,10.46,0,0,0,350,320.1l0,0a13.66,13.66,0,0,0-2.34,4.65,22.46,22.46,0,0,0-.79,6.19v21.51a.49.49,0,0,1-.52.46h-7.58a.49.49,0,0,1-.52-.46V310.26a.49.49,0,0,1,.52-.46h7.58a.49.49,0,0,1,.52.46v6.62a13.9,13.9,0,0,1,1.26-2.13,13.6,13.6,0,0,1,3-3.1v0a13.35,13.35,0,0,1,3.66-1.95,13,13,0,0,1,4.1-.65,21.36,21.36,0,0,1,2.68.15,9.71,9.71,0,0,1,2,.46.47.47,0,0,1,.33.43v7a.49.49,0,0,1-.52.46.55.55,0,0,1-.34-.11Z" +
  "M361.13,315.63a8.76,8.76,0,0,1,1.77.62v-5.85a8.63,8.63,0,0,0-1.47-.3,20.79,20.79,0,0,0-2.53-.14,11.49,11.49,0,0,0-7.08,2.39h0a12.32,12.32,0,0,0-2.79,2.88,15.87,15.87,0,0,0-2,3.83.49.49,0,0,1-.5.36h-.19a.49.49,0,0,1-.52-.46v-8.25h-6.54V352h6.54V331a23,23,0,0,1,.82-6.42,14.43,14.43,0,0,1,2.5-4.95l0,0a11.66,11.66,0,0,1,3.82-3.19,10.37,10.37,0,0,1,4.72-1.08,15.34,15.34,0,0,1,3.43.35Z";

export default function SplashScreen() {
  const router = useRouter();
  const { hasSeenOnboarding, isAuthenticated, userType } = useAuth();
  
  // Animation values matching website timeline
  const birdStrokeAnim = useRef(new Animated.Value(0)).current;
  const wordStrokeAnim = useRef(new Animated.Value(0)).current;
  const strokeColorAnim = useRef(new Animated.Value(0)).current;
  const filledLogoOpacity = useRef(new Animated.Value(0)).current;
  const strokeOpacity = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(14)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    
    // Exact website timeline sequence
    const timeline = Animated.parallel([
      // 1. Bird stroke draws (0.3s delay, 1.6s duration)
      Animated.timing(birdStrokeAnim, {
        toValue: 1,
        delay: 300,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),

      // 2. Wordmark stroke draws (0.65s delay, 1.4s duration)
      Animated.timing(wordStrokeAnim, {
        toValue: 1,
        delay: 650,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),

      // 3. Stroke color pink → white (1.3s delay, 0.7s duration)
      Animated.timing(strokeColorAnim, {
        toValue: 1,
        delay: 1300,
        duration: 700,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),

      // 4. Filled logo fades in (2.0s delay, 0.5s duration)
      Animated.timing(filledLogoOpacity, {
        toValue: 1,
        delay: 2000,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),

      // 5. Strokes fade out (2.05s delay, 0.35s duration)
      Animated.timing(strokeOpacity, {
        toValue: 0,
        delay: 2050,
        duration: 350,
        easing: Easing.linear,
        useNativeDriver: true,
      }),

      // 6. Tagline fades in (2.4s delay, 0.6s duration)
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          delay: 2400,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          delay: 2400,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 7. Entire screen fades out (3.8s delay, 0.6s duration)
      Animated.timing(screenOpacity, {
        toValue: 0,
        delay: 3800,
        duration: 600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    timeline.start(({ finished }) => {
      if (finished) {
        if (!hasSeenOnboarding) {
          router.replace('/onboarding');
        } else if (!isAuthenticated) {
          router.replace('/auth/register-choice');
        } else if (userType === 'user') {
          router.replace('/user/(tabs)/home' as never);
        } else if (userType === 'driver') {
          router.replace('/driver/(tabs)/Home' as never);
        }
      }
    });

    return () => timeline.stop();
  }, [hasSeenOnboarding, isAuthenticated, userType]);

  // Interpolate stroke color from pink (#EC4899) to white
  const strokeColor = strokeColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgb(236, 72, 153)', 'rgb(255, 255, 255)'],
  });

  // Path lengths (estimated based on complexity)
  const birdPathLength = 700;
  const wordPathLength = 3500; // Longer path for complete wordmark

  const birdDashOffset = birdStrokeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [birdPathLength, 0],
  });

  const wordDashOffset = wordStrokeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [wordPathLength, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar style="light" />

      <View style={styles.svgContainer}>
        {/* Stroke outlines */}
        <Animated.View style={[styles.strokeContainer, { opacity: strokeOpacity }]}>
          {/* Bird stroke - viewBox from website: -2 -2 180 96 */}
          <Svg 
            width={width * 0.45} 
            height={width * 0.24}
            viewBox="-2 -2 180 96"
            style={styles.birdSvg}
          >
            <AnimatedPath
              d={BIRD_PATH}
              stroke={strokeColor}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[birdPathLength, birdPathLength]}
              strokeDashoffset={birdDashOffset}
            />
          </Svg>

          {/* Wordmark stroke - viewBox from website: 135 285 235 75 */}
          <Svg 
            width={width * 0.7}
            height={width * 0.22}
            viewBox="135 285 235 75"
            style={styles.wordSvg}
          >
            <AnimatedPath
              d={WORDMARK_PATH}
              stroke={strokeColor}
              strokeWidth={0.65}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[wordPathLength, wordPathLength]}
              strokeDashoffset={wordDashOffset}
            />
          </Svg>
        </Animated.View>

        {/* Filled logo */}
        <Animated.View style={[styles.filledContainer, { opacity: filledLogoOpacity }]}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Tagline */}
      <Animated.View
        style={[
          styles.taglineContainer,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineY }],
          },
        ]}
      >
        <Text style={styles.tagline}>...bridging your services to you</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgContainer: {
    width: width * 0.9,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  strokeContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  birdSvg: {
    marginBottom: 20,
  },
  wordSvg: {
    marginTop: 10,
  },
  filledContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
  },
  taglineContainer: {
    position: 'absolute',
    bottom: height * 0.2,
    paddingHorizontal: 40,
  },
  tagline: {
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.white,
    textAlign: 'center',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
});
