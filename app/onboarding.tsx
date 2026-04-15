
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { ONBOARDING_SLIDES } from '@/constants/onboarding';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { setHasSeenOnboarding } = useAuth();

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (nextIndex > 0) {
        flatListRef.current?.scrollToIndex({ index: nextIndex - 1 });
      }
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleBack = () => {
    if (currentIndex > 1) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      flatListRef.current?.scrollToIndex({ index: prevIndex - 1 });
    }
  };

  const handleFinish = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/auth/register-choice' as never);
  };

  const renderItem = ({ item, index }: { item: typeof ONBOARDING_SLIDES[0]; index: number }) => {
    return (
      <View style={styles.slide}>
        {/* Text at the top */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {item.title.line1}
            {'\n'}
            <Text style={styles.titleBold}>{item.title.line2}</Text>
          </Text>
        </View>

        {/* Image at the bottom - fills entire bottom and goes behind button */}
        <View style={styles.imageContainer}>
          <Image
            source={item.image}
            style={styles.onboardingImage}
            resizeMode="cover"
            fadeDuration={300}
          />
        </View>
      </View>
    );
  };

  const renderPagination = () => {
    // Don't show pagination on splash screen
    if (currentIndex === 0) return null;

    return (
      <View style={styles.pagination}>
        {ONBOARDING_SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === currentIndex - 1 && styles.paginationDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  // Show splash screen on first load (currentIndex === 0)
  if (currentIndex === 0) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="light" />
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
            fadeDuration={0}
          />
        </View>
        
        <View style={styles.buttonContainer}>
          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next</Text>
          </Pressable>
          
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Back button - only show on second onboarding slide onwards */}
      {currentIndex > 1 && (
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={Colors.white} />
        </Pressable>
      )}
      
      {/* Skip button */}
      <Pressable style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(item) => item.id.toString()}
        removeClippedSubviews={false}
        initialNumToRender={ONBOARDING_SLIDES.length}
        maxToRenderPerBatch={ONBOARDING_SLIDES.length}
        windowSize={ONBOARDING_SLIDES.length}
      />

      {/* Pagination and button overlaid on top of everything */}
      <View style={styles.overlayContainer}>
        {renderPagination()}
        
        <View style={styles.bottomContainer}>
          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex === ONBOARDING_SLIDES.length ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 160,
    height: 160,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 10,
    padding: 10,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.poppins.medium,
  },
  slide: {
    width,
    height: height,
  },
  textContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    fontFamily: Fonts.poppins.regular,
    color: Colors.white,
    lineHeight: 40,
  },
  titleBold: {
    fontFamily: Fonts.poppins.bold,
  },
  imageContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.65,
  },
  onboardingImage: {
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: Colors.white,
  },
  bottomContainer: {
    paddingHorizontal: 40,
    paddingBottom: 50,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
 
  nextButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
        marginBottom: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  nextButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
  },
  skipText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.poppins.medium,
    textAlign: 'center',
  },
});
