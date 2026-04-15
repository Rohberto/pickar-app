import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DeliveryInstructionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const deliveryId = params.deliveryId as string;

  const handleOkay = () => {
    // Navigate to confirm pickup
    router.push({
      pathname: '/user/confirm-pickup',
      params: { deliveryId },
    } as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Drag Handle */}
      <View style={styles.dragHandle} />

      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <Image
            source={require('@/assets/images/boxes.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>Delivery Instructions</Text>

        {/* Description */}
        <Text style={styles.description}>
          Please review our delivery guidelines carefully before confirming your pickup. These instructions ensure a smooth and safe delivery experience for both you and our riders.
        </Text>

        {/* Instructions List */}
        <View style={styles.instructionsList}>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Ensure package is properly sealed and labeled with recipient details
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Be available at pickup location when rider arrives
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Fragile items must be clearly marked and properly packaged
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Maximum package weight: 25kg for standard delivery
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Prohibited items: Illegal substances, weapons, perishable foods, and hazardous materials
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Insurance coverage up to ₦50,000 for fragile items
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Provide accurate phone numbers for both sender and recipient
            </Text>
          </View>

          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={20} color={Colors.primary} />
            <Text style={styles.instructionText}>
              Track your delivery in real-time through the app
            </Text>
          </View>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By using Pickar Delivery, you agree to our terms and local regulations
        </Text>
      </ScrollView>

      {/* Okay Button */}
      <View style={styles.buttonContainer}>
        <Pressable style={styles.okayButton} onPress={handleOkay}>
          <Text style={styles.okayButtonText}>Okay</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  illustration: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: 13,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  instructionsList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  terms: {
    fontSize: 12,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  okayButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  okayButtonText: {
    fontSize: 16,
    fontFamily: Fonts.poppins.semiBold,
    color: Colors.white,
  },
});
