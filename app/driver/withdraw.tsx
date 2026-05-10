import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];

interface BankAccount {
  _id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

const BankBadge = ({ name }: { name: string }) => {
  const palette = ['#D97706', '#DC2626', '#7C3AED', '#059669', '#2563EB'];
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <View style={[styles.bankBadge, { backgroundColor: color }]}>
      <Text style={styles.bankBadgeText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
};

export default function WithdrawScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [earningsRes, accountsRes] = await Promise.all([
        api.get('/drivers/earnings'),
        api.get('/drivers/bank-accounts'),
      ]);
      if (earningsRes.data.success) setBalance(earningsRes.data.data.balance);
      if (accountsRes.data.success) {
        const accts: BankAccount[] = accountsRes.data.data;
        setAccounts(accts);
        const def = accts.find(a => a.isDefault);
        if (def) setSelectedAccount(def._id);
      }
    } catch (err) {
      console.error('[Withdraw]', err);
    } finally {
      setFetchingAccounts(false);
    }
  };

  // Numeric keypad
  const handleKeyPress = (key: string) => {
    if (key === 'del') {
      setAmount(prev => prev.slice(0, -1));
    } else {
      const next = amount + key;
      const num = parseInt(next.replace(/,/g, ''));
      if (!isNaN(num)) setAmount(num.toLocaleString());
    }
  };

  const numericAmount = parseInt(amount.replace(/,/g, '')) || 0;

  const handleWithdraw = async () => {
    if (numericAmount < 1000) return Alert.alert('Invalid Amount', 'Minimum withdrawal is ₦1,000');
    if (numericAmount > balance) return Alert.alert('Insufficient Balance', 'Amount exceeds your earnings balance');
    if (!selectedAccount) return Alert.alert('Select Account', 'Please select a bank account');

    setLoading(true);
    try {
      const { data } = await api.post('/drivers/withdraw', {
        amount: numericAmount,
        bankAccountId: selectedAccount,
      });
      if (data.success) {
        Alert.alert('Withdrawal Initiated', data.message, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const isReady = numericAmount >= 1000 && numericAmount <= balance && !!selectedAccount;

  const KEYPAD = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['+*#', '0', 'del'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw fund</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Amount display */}
      <View style={styles.amountCard}>
        <Text style={styles.amountDisplay}>
          ₦{amount || '0'}<Text style={styles.amountDecimal}>.00</Text>
        </Text>
      </View>
      <Text style={styles.amountHint}>
        Enter an amount to withdraw • Balance: ₦{balance.toLocaleString()}
      </Text>

      {/* Quick amounts */}
      <View style={styles.quickGrid}>
        {QUICK_AMOUNTS.map(val => (
          <TouchableOpacity
            key={val}
            style={[styles.chip, numericAmount === val && styles.chipActive]}
            onPress={() => setAmount(val.toLocaleString())}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, numericAmount === val && styles.chipTextActive]}>
              ₦{val.toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bank accounts */}
      <Text style={styles.sectionTitle}>Choose Account</Text>

      {fetchingAccounts ? (
        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
      ) : accounts.length === 0 ? (
        <TouchableOpacity
          style={styles.addAccountBtn}
          onPress={() => router.push('/driver/add-bank-account' as never)}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addAccountText}>Add a bank account to withdraw</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.accountsList}>
          {accounts.map((acct, i) => (
            <TouchableOpacity
              key={acct._id}
              style={[styles.accountRow, selectedAccount === acct._id && styles.accountRowActive]}
              onPress={() => setSelectedAccount(acct._id)}
              activeOpacity={0.8}
            >
              <BankBadge name={acct.bankName} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.accountName}>{acct.accountName}</Text>
                <Text style={styles.accountDetails}>
                  {acct.bankName} – {acct.accountNumber}
                </Text>
              </View>
              <View style={[styles.radioOuter, selectedAccount === acct._id && styles.radioActive]}>
                {selectedAccount === acct._id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Withdraw button */}
      <TouchableOpacity
        style={[styles.withdrawBtn, !isReady && styles.withdrawBtnDisabled]}
        onPress={handleWithdraw}
        disabled={!isReady || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.withdrawBtnText}>Withdraw</Text>
        }
      </TouchableOpacity>

      {/* Numeric keypad */}
      <View style={styles.keypad}>
        {KEYPAD.map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map(key => (
              <TouchableOpacity
                key={key}
                style={styles.keyBtn}
                onPress={() => key === '+*#' ? null : handleKeyPress(key === 'del' ? 'del' : key)}
                activeOpacity={0.6}
              >
                {key === 'del'
                  ? <Ionicons name="backspace-outline" size={22} color={Colors.textPrimary} />
                  : <Text style={[styles.keyText, key === '+*#' && styles.keySpecial]}>{key}</Text>
                }
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  amountCard: {
    backgroundColor: Colors.white, marginHorizontal: 20, marginTop: 20,
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  amountDisplay: { fontFamily: Fonts.poppins.bold, fontSize: 36, color: Colors.textPrimary },
  amountDecimal: { fontFamily: Fonts.poppins.regular, fontSize: 22, color: Colors.textSecondary },
  amountHint: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: Colors.textSecondary, marginHorizontal: 20, marginTop: 8, marginBottom: 16,
  },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: `${Colors.primary}12`, borderColor: Colors.primary },
  chipText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textPrimary },
  chipTextActive: { color: Colors.primary },

  sectionTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary, marginHorizontal: 20, marginBottom: 10 },

  addAccountBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, padding: 16, borderRadius: 14,
    backgroundColor: `${Colors.primary}08`, borderWidth: 1, borderColor: `${Colors.primary}25`,
    marginBottom: 16,
  },
  addAccountText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },

  accountsList: { marginHorizontal: 20, backgroundColor: Colors.white, borderRadius: 16, marginBottom: 16 },
  accountRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  accountRowActive: { backgroundColor: `${Colors.primary}06` },
  bankBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bankBadgeText: { fontFamily: Fonts.poppins.bold, fontSize: 18, color: '#fff' },
  accountName: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
  accountDetails: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },

  withdrawBtn: {
    backgroundColor: Colors.primary, marginHorizontal: 20,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  withdrawBtnDisabled: { backgroundColor: '#DFC4C4' },
  withdrawBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },

  keypad: { backgroundColor: Colors.white, paddingVertical: 8, paddingHorizontal: 20 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  keyBtn: {
    flex: 1, height: 56, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 4, borderRadius: 12,
  },
  keyText: { fontFamily: Fonts.poppins.medium, fontSize: 22, color: Colors.textPrimary },
  keySpecial: { fontFamily: Fonts.poppins.regular, fontSize: 16, color: Colors.textSecondary },
});