
import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function MartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Mart</Text>
        <Text style={styles.subtitle}>Coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.poppins.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.poppins.regular,
    color: Colors.textSecondary,
  },
});
