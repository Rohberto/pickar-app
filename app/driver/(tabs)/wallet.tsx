import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Transaction {
  _id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface EarningsData {
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  todayEarnings: number;
  todayRides: number;
  recentTransactions: Transaction[];
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const BankBadge = ({ name }: { name: string }) => {
  const palette = ['#D97706', '#DC2626', '#7C3AED', '#059669', '#2563EB'];
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <View style={[styles.bankBadge, { backgroundColor: color }]}>
      <Text style={styles.bankBadgeText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
};

export default function DriverEarningsScreen() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  useFocusEffect(useCallback(() => { fetchEarnings(); }, []));

  const fetchEarnings = async () => {
    try {
      const { data } = await api.get('/drivers/earnings');
      if (data.success) setEarnings(data.data);
    } catch (err) {
      console.error('[DriverEarnings]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.pageTitle}>Earnings</Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.balanceContent}>
            <View>
              <View style={styles.balanceLabelRow}>
                <Text style={styles.balanceLabel}>Total balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(v => !v)} style={{ marginLeft: 6 }}>
                  <Ionicons name={showBalance ? 'eye-outline' : 'eye-off-outline'} size={15} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                ₦{showBalance ? (earnings?.balance ?? 0).toLocaleString() : '••••••'}
                <Text style={styles.balanceDecimal}>.00</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={() => router.push('/driver/withdraw' as never)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color={Colors.white} />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today stats */}
        <Text style={styles.sectionTitle}>Today's Activities</Text>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Hours</Text>
            <Text style={styles.statValue}>{((earnings?.todayRides ?? 0) * 0.25).toFixed(1)}Hrs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Rides</Text>
            <Text style={styles.statValue}>{earnings?.todayRides ?? 0}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={[styles.statValue, { fontSize: 13 }]}>₦{(earnings?.todayEarnings ?? 0).toLocaleString()}</Text>
          </View>
        </View>

        {/* Recent transactions */}
        <View style={styles.txHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity><Text style={styles.seeAllText}>See all  ›</Text></TouchableOpacity>
        </View>

        {(earnings?.recentTransactions?.length ?? 0) === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={44} color={Colors.border} />
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubText}>Complete deliveries to start earning</Text>
          </View>
        ) : (
          <View style={styles.txCard}>
            {earnings!.recentTransactions.map((tx, i) => (
              <View key={tx._id}>
                {i > 0 && <View style={styles.txDivider} />}
                <View style={styles.txRow}>
                  <BankBadge name={tx.description?.split(' ')[0] ?? 'P'} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                    <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'earning' && { color: '#16A34A' }]}>
                    {tx.type === 'earning' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 22, color: Colors.textPrimary, marginTop: 8, marginBottom: 16 },

  balanceCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 24, marginBottom: 28,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  decorCircle1: { position: 'absolute', right: -40, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: `${Colors.primary}08` },
  decorCircle2: { position: 'absolute', right: 20, bottom: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: `${Colors.primary}05` },
  balanceContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  balanceLabel: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.primary },
  balanceAmount: { fontFamily: Fonts.poppins.bold, fontSize: 32, color: Colors.textPrimary },
  balanceDecimal: { fontFamily: Fonts.poppins.regular, fontSize: 20, color: Colors.textPrimary },
  withdrawBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30 },
  withdrawBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.white },

  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary, marginBottom: 12 },

  statsCard: {
    backgroundColor: Colors.white, borderRadius: 16, flexDirection: 'row', padding: 20, marginBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  statValue: { fontFamily: Fonts.poppins.bold, fontSize: 15, color: Colors.textPrimary },
  statDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  txHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAllText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.primary },

  txCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  txDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  bankBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bankBadgeText: { fontFamily: Fonts.poppins.bold, fontSize: 16, color: '#fff' },
  txDesc: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textPrimary, marginBottom: 2 },
  txDate: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary },
  txAmount: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  emptySubText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary },
});