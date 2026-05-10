import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function DriverRidesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Rides</Text>
        <Text style={styles.subtitle}>Your trip history will appear here</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Fonts.poppins.semiBold, fontSize: 20, color: Colors.textPrimary },
  subtitle: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
});