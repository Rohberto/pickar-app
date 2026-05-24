import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Bank {
  id: number;
  name: string;
  code: string;
}

type Step = 'form' | 'verified';

export default function AddBankAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('form');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const accountInputRef = useRef<TextInput>(null);

  useEffect(() => { fetchBanks(); }, []);

  useEffect(() => {
    if (!bankSearch.trim()) {
      setFilteredBanks(banks);
    } else {
      setFilteredBanks(
        banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
      );
    }
  }, [bankSearch, banks]);

  const fetchBanks = async () => {
    try {
      const { data } = await api.get('/drivers/banks');
      if (data.success) {
        setBanks(data.data);
        setFilteredBanks(data.data);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load bank list');
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleSelectBank = (bank: Bank) => {
    setSelectedBank(bank);
    setBankSearch('');
    setShowBankPicker(false);
    // Focus account number input after selecting bank
    setTimeout(() => accountInputRef.current?.focus(), 300);
  };

  const handleVerify = async () => {
    if (!selectedBank) {
      Alert.alert('Select Bank', 'Please select your bank first');
      return;
    }
    if (accountNumber.length !== 10) {
      Alert.alert('Invalid Account', 'Account number must be 10 digits');
      return;
    }
    Keyboard.dismiss();
    setVerifying(true);
    try {
      const { data } = await api.post('/drivers/bank-accounts/verify', {
        bankCode: selectedBank.code,
        accountNumber,
      });
      if (data.success) {
        setVerifiedName(data.data.accountName);
        setStep('verified');
      }
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        err.response?.data?.message || 'Could not verify account. Check your details and try again.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!selectedBank || !verifiedName) return;
    setSaving(true);
    try {
      const { data } = await api.post('/drivers/bank-accounts', {
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountNumber,
      });
      if (data.success) {
        Alert.alert(
          'Account Added ✓',
          `${verifiedName}'s ${selectedBank.name} account has been saved.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not save account');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 'verified') {
      setStep('form');
      setVerifiedName('');
    } else {
      router.back();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Bank Account</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={styles.content}>

            {step === 'form' ? (
              <>
                <Text style={styles.stepLabel}>Enter your bank details</Text>

                {/* Bank selector */}
                <Text style={styles.fieldLabel}>Bank</Text>
                <TouchableOpacity
                  style={[styles.selector, selectedBank && styles.selectorFilled]}
                  onPress={() => setShowBankPicker(true)}
                  activeOpacity={0.8}
                >
                  {loadingBanks ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Text style={[styles.selectorText, !selectedBank && styles.selectorPlaceholder]}>
                        {selectedBank?.name ?? 'Select your bank'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                    </>
                  )}
                </TouchableOpacity>

                {/* Account number */}
                <Text style={styles.fieldLabel}>Account Number</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    ref={accountInputRef}
                    style={styles.input}
                    value={accountNumber}
                    onChangeText={t => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
                    keyboardType="numeric"
                    placeholder="Enter 10-digit account number"
                    placeholderTextColor={Colors.textSecondary}
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Text style={styles.charCount}>{accountNumber.length}/10</Text>
                </View>

                {/* Verify button */}
                <TouchableOpacity
                  style={[
                    styles.verifyBtn,
                    (!selectedBank || accountNumber.length !== 10 || verifying) && styles.verifyBtnOff,
                  ]}
                  onPress={handleVerify}
                  disabled={!selectedBank || accountNumber.length !== 10 || verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator color={Colors.white} />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verify Account</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Verified state */}
                <View style={styles.verifiedCard}>
                  <View style={styles.verifiedIconBox}>
                    <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
                  </View>
                  <Text style={styles.verifiedTitle}>Account Verified</Text>
                  <Text style={styles.verifiedSub}>Please confirm these details are correct</Text>
                </View>

                <View style={styles.detailsCard}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Name</Text>
                    <Text style={styles.detailValue}>{verifiedName}</Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Bank</Text>
                    <Text style={styles.detailValue}>{selectedBank?.name}</Text>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account Number</Text>
                    <Text style={styles.detailValue}>{accountNumber}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnOff]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator color={Colors.white} />
                    : <Text style={styles.saveBtnText}>Add Account</Text>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={styles.editBtn} onPress={() => setStep('form')}>
                  <Ionicons name="create-outline" size={16} color={Colors.primary} />
                  <Text style={styles.editBtnText}>Edit details</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Bank picker modal */}
        <Modal
          visible={showBankPicker}
          animationType="slide"
          onRequestClose={() => setShowBankPicker(false)}
        >
          <View style={[styles.pickerRoot, { paddingTop: insets.top }]}>
            {/* Picker header */}
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Bank</Text>
              <TouchableOpacity
                style={styles.pickerCloseBtn}
                onPress={() => setShowBankPicker(false)}
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
              >
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search banks..."
                placeholderTextColor={Colors.textSecondary}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>

            {/* Bank list */}
            <FlatList
              data={filteredBanks}
              keyExtractor={item => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.bankRow,
                    selectedBank?.code === item.code && styles.bankRowSelected,
                  ]}
                  onPress={() => handleSelectBank(item)}
                  activeOpacity={0.7}
                >
                  {/* Coloured initial badge */}
                  <View style={[styles.bankBadge, { backgroundColor: getBankColor(item.name) }]}>
                    <Text style={styles.bankBadgeText}>{item.name.charAt(0)}</Text>
                  </View>
                  <Text style={styles.bankName}>{item.name}</Text>
                  {selectedBank?.code === item.code && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.bankSeparator} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>No banks found</Text>
                </View>
              }
            />
          </View>
        </Modal>

      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const getBankColor = (name: string) => {
  const palette = ['#D97706', '#DC2626', '#7C3AED', '#059669', '#2563EB', '#DB2777', '#0891B2'];
  return palette[name.charCodeAt(0) % palette.length];
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },

  stepLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 14,
    color: Colors.textSecondary, marginBottom: 24,
  },

  fieldLabel: {
    fontFamily: Fonts.poppins.medium, fontSize: 14,
    color: Colors.textPrimary, marginBottom: 8,
  },

  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
  },
  selectorFilled: { borderColor: Colors.primary },
  selectorText: { fontFamily: Fonts.poppins.medium, fontSize: 15, color: Colors.textPrimary },
  selectorPlaceholder: { color: Colors.textSecondary, fontFamily: Fonts.poppins.regular },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, marginBottom: 28,
  },
  input: {
    flex: 1, fontFamily: Fonts.poppins.medium, fontSize: 17,
    color: Colors.textPrimary, paddingVertical: 14, letterSpacing: 2,
  },
  charCount: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },

  verifyBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  verifyBtnOff: { opacity: 0.45 },
  verifyBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },

  // Verified step
  verifiedCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  verifiedIconBox: { marginBottom: 12 },
  verifiedTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: Colors.textPrimary, marginBottom: 4 },
  verifiedSub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary },

  detailsCard: {
    backgroundColor: Colors.white, borderRadius: 16, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  detailLabel: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
  detailValue: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  detailDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },

  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.white },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  editBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary },

  // Bank picker modal
  pickerRoot: { flex: 1, backgroundColor: Colors.white },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pickerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 17, color: Colors.textPrimary },
  pickerCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.lightGray, alignItems: 'center', justifyContent: 'center',
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginVertical: 12,
    backgroundColor: Colors.lightGray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, padding: 0 },

  bankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  bankRowSelected: { backgroundColor: `${Colors.primary}06` },
  bankBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  bankBadgeText: { fontFamily: Fonts.poppins.bold, fontSize: 15, color: '#fff' },
  bankName: { fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary, flex: 1 },
  bankSeparator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textSecondary },
});