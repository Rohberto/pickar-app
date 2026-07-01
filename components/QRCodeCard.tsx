import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  code: string;
  title: string;
  subtitle: string;
}

export default function QRCodeCard({ code, title, subtitle }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.qrWrapper}>
        <QRCode
          value={code}
          size={180}
          color={Colors.primary}
          backgroundColor="#fff"
          quietZone={12}
        />
      </View>

      {/* Fallback code shown below QR in case scan fails */}
      <View style={styles.codeRow}>
        <Text style={styles.codeLabel}>Manual code</Text>
        <Text style={styles.codeValue}>{code}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginHorizontal: 20,
  },
  title: {
    fontFamily: Fonts.poppins.semiBold,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.poppins.regular,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: `${Colors.primary}20`,
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  codeLabel: {
    fontFamily: Fonts.poppins.regular,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  codeValue: {
    fontFamily: Fonts.poppins.bold,
    fontSize: 18,
    color: Colors.primary,
    letterSpacing: 4,
  },
});