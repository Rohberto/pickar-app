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
  status: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const txIcon = (type: string) => {
  switch (type) {
    case 'topup': return { name: 'arrow-down-circle' as const, color: '#16A34A' };
    case 'escrow_hold':
    case 'delivery_debit': return { name: 'arrow-up-circle' as const, color: Colors.primary };
    case 'refund': return { name: 'refresh-circle' as const, color: '#2563EB' };
    default: return { name: 'ellipse' as const, color: Colors.textSecondary };
  }
};

export default function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBalance, setShowBalance] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [])
  );

  const fetchWallet = async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
      ]);
      if (walletRes.data.success) setBalance(walletRes.data.data.balance);
      if (txRes.data.success) setTransactions(txRes.data.data);
    } catch (err) {
      console.error('[Wallet]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchWallet(); };

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Wallet</Text>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          {/* Decorative circles */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <View style={styles.balanceContent}>
            <View>
              <View style={styles.balanceLabelRow}>
                <Text style={styles.balanceLabel}>Current balance</Text>
                <TouchableOpacity onPress={() => setShowBalance(v => !v)} style={{ marginLeft: 6 }}>
                  <Ionicons
                    name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                    size={15}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                ₦{showBalance ? balance.toLocaleString() : '••••••'}
                <Text style={styles.balanceDecimal}>.00</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addFundBtn}
              onPress={() => router.push('/user/add-funds' as never)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color={Colors.white} />
              <Text style={styles.addFundBtnText}>Add fund</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment methods */}
        <Text style={styles.sectionTitle}>Payment methods</Text>

        <View style={styles.methodsCard}>
          <TouchableOpacity
            style={styles.methodRow}
            onPress={() => router.push({ pathname: '/user/add-funds', params: { method: 'card' } } as never)}
          >
            <View style={styles.methodIconBox}>
              <Ionicons name="card-outline" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.methodLabel}>Debit/Credit Card</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.methodDivider} />

          <TouchableOpacity
            style={styles.methodRow}
            onPress={() => router.push({ pathname: '/user/add-funds', params: { method: 'transfer' } } as never)}
          >
            <View style={styles.methodIconBox}>
              <Ionicons name="business-outline" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.methodLabel}>Bank Transfer</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.methodDivider} />

          <TouchableOpacity
            style={styles.methodRow}
            onPress={() => router.push({ pathname: '/user/add-funds', params: { method: 'verve' } } as never)}
          >
            <View style={styles.methodIconBox}>
              <Ionicons name="location-outline" size={20} color={Colors.textPrimary} />
            </View>
            <Text style={styles.methodLabel}>Verve</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.methodDivider} />

          <TouchableOpacity
            style={styles.methodRow}
            onPress={() => router.push('/user/add-funds' as never)}
          >
            <View style={[styles.methodIconBox, styles.addMethodIcon]}>
              <Ionicons name="add" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.methodLabel}>Add payment method</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <>
            <View style={styles.txHeaderRow}>
              <Text style={styles.sectionTitle}>Recent transactions</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.txCard}>
              {transactions.slice(0, 10).map((tx, i) => {
                const icon = txIcon(tx.type);
                const isCredit = ['topup', 'refund'].includes(tx.type);
                return (
                  <View key={tx._id}>
                    {i > 0 && <View style={styles.methodDivider} />}
                    <View style={styles.txRow}>
                      <View style={[styles.txIconBox, { backgroundColor: `${icon.color}15` }]}>
                        <Ionicons name={icon.name} size={22} color={icon.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                        <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
                      </View>
                      <Text style={[styles.txAmount, { color: isCredit ? '#16A34A' : Colors.textPrimary }]}>
                        {isCredit ? '+' : '-'}₦{tx.amount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 22,
    color: Colors.textPrimary, marginTop: 8, marginBottom: 16,
  },

  // Balance card
  balanceCard: {
    backgroundColor: Colors.white,
    borderRadius: 16, padding: 24, marginBottom: 28,
    overflow: 'hidden', position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  decorCircle1: {
    position: 'absolute', right: -40, top: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: `${Colors.primary}08`,
  },
  decorCircle2: {
    position: 'absolute', right: 20, bottom: -50,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: `${Colors.primary}05`,
  },
  balanceContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  balanceLabel: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.primary },
  balanceAmount: { fontFamily: Fonts.poppins.bold, fontSize: 32, color: Colors.textPrimary },
  balanceDecimal: { fontFamily: Fonts.poppins.regular, fontSize: 20, color: Colors.textPrimary },

  addFundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 30,
  },
  addFundBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.white },

  sectionTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16,
    color: Colors.textPrimary, marginBottom: 12,
  },

  // Payment methods
  methodsCard: {
    backgroundColor: Colors.white, borderRadius: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  methodRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
  },
  methodIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  addMethodIcon: { borderWidth: 1.5, borderColor: Colors.border, backgroundColor: 'transparent' },
  methodLabel: { fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, flex: 1 },
  methodDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Transactions
  txHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAllText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.primary },
  txCard: {
    backgroundColor: Colors.white, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  txIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textPrimary, marginBottom: 2 },
  txDate: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary },
  txAmount: { fontFamily: Fonts.poppins.semiBold, fontSize: 14 },
});