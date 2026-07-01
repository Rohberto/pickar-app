import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const CLOUDINARY_CLOUD = 'dtr1shkje';
const CLOUDINARY_PRESET = 'pickar_profiles';

// ─── Types ────────────────────────────────────────────────────────
interface DriverProfile {
  _id: string;
  name: string;
  phone: string;
  photo?: string;
  rating?: { average: number; count: number };
  vehicle?: { type: 'bike' | 'truck'; plateNumber: string };
  status: string;
}

interface BankAccount {
  _id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

type Tab = 'profile' | 'vehicle' | 'documents' | 'bank' | 'settings';

// ─── Reusable components ─────────────────────────────────────────
const InfoRow = ({ label, value, verified }: { label: string; value: string; verified?: boolean }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View style={styles.infoValueRow}>
      <Text style={styles.infoValue}>{value || '—'}</Text>
      {verified && (
        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      )}
    </View>
  </View>
);

const SectionCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[styles.sectionCard, style]}>{children}</View>
);

const MenuItem = ({
  icon,
  label,
  sublabel,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable
    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
    onPress={onPress}
  >
    <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
      <Ionicons name={icon} size={19} color={danger ? Colors.error : Colors.primary} />
    </View>
    <View style={styles.menuCenter}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
    </View>
    {!danger && <Ionicons name="chevron-forward" size={17} color={Colors.textSecondary} />}
  </Pressable>
);

export default function DriverAccountScreen() {
  const router = useRouter();
  const { user, logout } = useAuth() as any;

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<'bike' | 'truck'>('bike');
  const [nameFocused, setNameFocused] = useState(false);
  const [plateFocused, setPlateFocused] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get('/drivers/me');
      if (data.success) {
        const d = data.data;
        setDriver(d);
        setName(d.name || '');
        setPhone(d.phone || '');
        setPlateNumber(d.vehicle?.plateNumber || '');
        setVehicleType(d.vehicle?.type || 'bike');
      }
      const { data: bankData } = await api.get('/drivers/bank-accounts');
      if (bankData.success) setBankAccounts(bankData.data);
    } catch (err) {
      console.error('[DriverAccount] fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Photo upload ─────────────────────────────────────────────
  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as any);
      formData.append('upload_preset', CLOUDINARY_PRESET);
      formData.append('folder', 'pickar/drivers');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const uploadData = await res.json();
      if (!uploadData.secure_url) throw new Error(uploadData.error?.message ?? 'Upload failed');

      await api.patch('/drivers/me', { photo: uploadData.secure_url });
      setDriver(prev => prev ? { ...prev, photo: uploadData.secure_url } : prev);
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Save name ────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      await api.patch('/drivers/me', { name: name.trim() });
      setDriver(prev => prev ? { ...prev, name: name.trim() } : prev);
      Alert.alert('Success', 'Name updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  // ─── Save vehicle ─────────────────────────────────────────────
  const handleSaveVehicle = async () => {
    if (!plateNumber.trim()) {
      Alert.alert('Error', 'Please enter your plate number.');
      return;
    }
    setSavingVehicle(true);
    try {
      await api.patch('/drivers/me', {
        vehicle: { type: vehicleType, plateNumber: plateNumber.trim().toUpperCase() },
      });
      setDriver(prev =>
        prev ? { ...prev, vehicle: { type: vehicleType, plateNumber: plateNumber.trim().toUpperCase() } } : prev
      );
      Alert.alert('Success', 'Vehicle details updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update vehicle.');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleContactUs = () => {
    Alert.alert('Contact Us', 'How would you like to reach us?', [
      { text: 'Email', onPress: () => Linking.openURL('mailto:support@pickar.ng?subject=Driver Support') },
      { text: 'Call', onPress: () => Linking.openURL('tel:+2348000000000') },
      { text: 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/2348000000000') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out', style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth/register-choice');
        },
      },
    ]);
  };

  const nameChanged = name.trim() !== (driver?.name || '').trim();
  const vehicleChanged =
    plateNumber.trim().toUpperCase() !== (driver?.vehicle?.plateNumber || '') ||
    vehicleType !== (driver?.vehicle?.type || 'bike');

  const avatarUri = driver?.photo
    ? driver.photo
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(driver?.name || 'D')}&background=8B1538&color=fff&size=128&bold=true`;

  const ratingAvg = driver?.rating?.average;
  const ratingDisplay = ratingAvg && ratingAvg > 0 ? ratingAvg.toFixed(1) : '—';

  const TABS: { key: Tab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'profile',   icon: 'person-outline',    label: 'Profile'   },
    { key: 'vehicle',   icon: 'car-outline',        label: 'Vehicle'   },
    { key: 'documents', icon: 'document-text-outline', label: 'Docs'  },
    { key: 'bank',      icon: 'card-outline',       label: 'Bank'      },
    { key: 'settings',  icon: 'settings-outline',   label: 'Settings'  },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerAvatarRow}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} activeOpacity={0.85}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              {uploadingPhoto && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={Colors.white} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={11} color={Colors.white} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{driver?.name || 'Driver'}</Text>
            <Text style={styles.headerPhone}>{driver?.phone || ''}</Text>
            <View style={styles.headerBadgeRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>{ratingDisplay}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                driver?.status === 'online' && styles.statusOnline,
                driver?.status === 'busy' && styles.statusBusy,
              ]}>
                <View style={[
                  styles.statusDot,
                  driver?.status === 'online' && styles.statusDotOnline,
                  driver?.status === 'busy' && styles.statusDotBusy,
                ]} />
                <Text style={[
                  styles.statusText,
                  driver?.status === 'online' && styles.statusTextOnline,
                  driver?.status === 'busy' && styles.statusTextBusy,
                ]}>
                  {driver?.status === 'online' ? 'Online'
                    : driver?.status === 'busy' ? 'On a trip'
                    : 'Offline'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── TABS ─────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── TAB CONTENT ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.tabContentInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ══ PROFILE TAB ════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <SectionCard>
              {/* Name — editable */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={[styles.fieldInput, nameFocused && styles.fieldInputFocused]}>
                  <TextInput
                    style={styles.fieldTextInput}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    placeholder="Your full name"
                    placeholderTextColor={Colors.textSecondary}
                    autoCapitalize="words"
                  />
                  {nameChanged && (
                    <TouchableOpacity
                      style={styles.inlineSaveBtn}
                      onPress={handleSaveName}
                      disabled={savingName}
                    >
                      {savingName
                        ? <ActivityIndicator size={12} color={Colors.white} />
                        : <Text style={styles.inlineSaveBtnText}>Save</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.infoRowDivider} />
              <InfoRow label="Phone Number" value={driver?.phone || ''} verified />
              <View style={styles.infoRowDivider} />
              <InfoRow label="Email" value={user?.email || ''} verified />
            </SectionCard>

            <Text style={styles.sectionTitle}>Account Status</Text>
            <SectionCard>
              <InfoRow
                label="Approval Status"
                value={user?.isApproved ? 'Approved' : user?.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
              />
              <View style={styles.infoRowDivider} />
              <InfoRow
                label="Account"
                value={user?.isSuspended ? 'Suspended' : 'Active'}
              />
              <View style={styles.infoRowDivider} />
              <InfoRow
                label="Member Since"
                value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              />
            </SectionCard>

            <Text style={styles.sectionTitle}>Need Help?</Text>
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('mailto:support@pickar.ng?subject=Driver Support')}
                activeOpacity={0.8}
              >
                <View style={[styles.contactIconBox, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="mail-outline" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.contactCardLabel}>Email</Text>
                <Text style={styles.contactCardSub}>support@pickar.ng</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('tel:+2348000000000')}
                activeOpacity={0.8}
              >
                <View style={[styles.contactIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="call-outline" size={22} color="#22C55E" />
                </View>
                <Text style={styles.contactCardLabel}>Call Us</Text>
                <Text style={styles.contactCardSub}>+234 800 000 0000</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactCard}
                onPress={() => Linking.openURL('https://wa.me/2348000000000')}
                activeOpacity={0.8}
              >
                <View style={[styles.contactIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                </View>
                <Text style={styles.contactCardLabel}>WhatsApp</Text>
                <Text style={styles.contactCardSub}>Chat with us</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══ VEHICLE TAB ════════════════════════════════════════ */}
        {activeTab === 'vehicle' && (
          <>
            <Text style={styles.sectionTitle}>Registered Vehicle</Text>

            <SectionCard>
              {/* Vehicle type selector */}
              <Text style={styles.fieldLabel}>Vehicle Type</Text>
              <View style={styles.vehicleTypeRow}>
                <TouchableOpacity
                  style={[styles.vehicleTypeCard, vehicleType === 'bike' && styles.vehicleTypeCardActive]}
                  onPress={() => setVehicleType('bike')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="bicycle-outline"
                    size={28}
                    color={vehicleType === 'bike' ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.vehicleTypeLabel, vehicleType === 'bike' && styles.vehicleTypeLabelActive]}>
                    Bike
                  </Text>
                  <Text style={styles.vehicleTypeDesc}>Packages & small deliveries</Text>
                  {vehicleType === 'bike' && (
                    <View style={styles.vehicleCheckBadge}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vehicleTypeCard, vehicleType === 'truck' && styles.vehicleTypeCardActive]}
                  onPress={() => setVehicleType('truck')}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="car-outline"
                    size={28}
                    color={vehicleType === 'truck' ? Colors.primary : Colors.textSecondary}
                  />
                  <Text style={[styles.vehicleTypeLabel, vehicleType === 'truck' && styles.vehicleTypeLabelActive]}>
                    Truck / Car
                  </Text>
                  <Text style={styles.vehicleTypeDesc}>House loads & large items</Text>
                  {vehicleType === 'truck' && (
                    <View style={styles.vehicleCheckBadge}>
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.infoRowDivider} />

              {/* Plate number */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Plate Number</Text>
                <View style={[styles.fieldInput, plateFocused && styles.fieldInputFocused]}>
                  <Ionicons name="card-outline" size={17} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.fieldTextInput, { letterSpacing: 2 }]}
                    value={plateNumber}
                    onChangeText={t => setPlateNumber(t.toUpperCase())}
                    onFocus={() => setPlateFocused(true)}
                    onBlur={() => setPlateFocused(false)}
                    placeholder="e.g. ABC 123 XY"
                    placeholderTextColor={Colors.textSecondary}
                    autoCapitalize="characters"
                    maxLength={12}
                  />
                </View>
              </View>
            </SectionCard>

            {vehicleChanged && (
              <TouchableOpacity
                style={styles.saveVehicleBtn}
                onPress={handleSaveVehicle}
                disabled={savingVehicle}
                activeOpacity={0.85}
              >
                {savingVehicle
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveVehicleBtnText}>Save Vehicle Details</Text>
                }
              </TouchableOpacity>
            )}

            {driver?.vehicle?.plateNumber ? (
              <>
                <Text style={styles.sectionTitle}>Current Registration</Text>
                <SectionCard>
                  <InfoRow label="Vehicle Type" value={driver.vehicle.type === 'bike' ? 'Motorcycle / Bike' : 'Truck / Car'} />
                  <View style={styles.infoRowDivider} />
                  <InfoRow label="Plate Number" value={driver.vehicle.plateNumber} />
                </SectionCard>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="car-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyStateText}>No vehicle registered yet</Text>
                <Text style={styles.emptyStateSub}>Fill in the details above to register your vehicle</Text>
              </View>
            )}
          </>
        )}

        {/* ══ DOCUMENTS TAB ══════════════════════════════════════ */}
        {activeTab === 'documents' && (
          <>
            <Text style={styles.sectionTitle}>KYC Documents</Text>
            <Text style={styles.sectionSub}>
              Documents are reviewed by Pickar before your account is approved. Ensure all uploads are clear and valid.
            </Text>

            {/* ID Document */}
            <DocumentCard
              title="Government-Issued ID"
              subtitle="National ID, Driver's License, Voter's Card or International Passport"
              icon="id-card-outline"
              fieldKey="idDocument"
              currentUrl={user?.idDocument}
              onUploadSuccess={fetchProfile}
            />

            {/* Proof of Address */}
            <DocumentCard
              title="Proof of Address"
              subtitle="Utility bill or bank statement (not older than 3 months)"
              icon="home-outline"
              fieldKey="proofOfAddress"
              currentUrl={user?.proofOfAddress}
              onUploadSuccess={fetchProfile}
            />

            {/* Vehicle document */}
            <DocumentCard
              title="Vehicle Document"
              subtitle="Vehicle registration or roadworthiness certificate"
              icon="document-outline"
              fieldKey="vehicleDocument"
              currentUrl={user?.vehicleDocument}
              onUploadSuccess={fetchProfile}
            />

            <View style={styles.docInfoBanner}>
              <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
              <Text style={styles.docInfoText}>
                All documents are encrypted and only visible to Pickar admins for verification purposes.
              </Text>
            </View>
          </>
        )}

        {/* ══ BANK TAB ═══════════════════════════════════════════ */}
        {activeTab === 'bank' && (
          <>
            <Text style={styles.sectionTitle}>Bank Accounts</Text>
            <Text style={styles.sectionSub}>
              Bank accounts are used to receive your earnings withdrawals.
            </Text>

            {bankAccounts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={40} color={Colors.border} />
                <Text style={styles.emptyStateText}>No bank accounts added</Text>
                <Text style={styles.emptyStateSub}>Add a bank account to receive your earnings</Text>
              </View>
            ) : (
              bankAccounts.map((account) => (
                <SectionCard key={account._id} style={styles.bankCard}>
                  <View style={styles.bankCardLeft}>
                    <View style={styles.bankIconBox}>
                      <Ionicons name="business-outline" size={20} color={Colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.bankName}>{account.bankName}</Text>
                      <Text style={styles.bankAccount}>{account.accountName}</Text>
                      <Text style={styles.bankNumber}>
                        •••• •••• {account.accountNumber.slice(-4)}
                      </Text>
                    </View>
                  </View>
                  {account.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </SectionCard>
              ))
            )}

            <TouchableOpacity
              style={styles.addBankBtn}
              onPress={() => router.push('/driver/(tabs)/earnings' as never)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.addBankBtnText}>Add Bank Account</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══ SETTINGS TAB ═══════════════════════════════════════ */}
        {activeTab === 'settings' && (
          <>
            <Text style={styles.sectionTitle}>Account Settings</Text>

            <View style={styles.menuSection}>
              <MenuItem
                icon="shield-checkmark-outline"
                label="Security"
                sublabel="Password & authentication"
                onPress={() => router.push('/driver/account/security' as never)}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="notifications-outline"
                label="Notifications"
                sublabel="Manage notification preferences"
                onPress={() => router.push('/driver/account/notifications' as never)}
              />
            </View>

            <Text style={styles.sectionTitle}>Support</Text>
            <View style={styles.menuSection}>
              <MenuItem
                icon="chatbubble-ellipses-outline"
                label="Contact Us"
                sublabel="Email, call or WhatsApp"
                onPress={handleContactUs}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="help-circle-outline"
                label="Help & FAQ"
                onPress={() => router.push('/driver/account/help' as never)}
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="document-text-outline"
                label="Terms & Conditions"
                onPress={() => Linking.openURL('https://pickar.ng/terms')}
              />
            </View>

            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <View style={styles.menuSection}>
              <MenuItem
                icon="log-out-outline"
                label="Log Out"
                onPress={handleLogout}
                danger
              />
              <View style={styles.menuDivider} />
              <MenuItem
                icon="trash-outline"
                label="Delete Account"
                onPress={() => router.push('/driver/account/delete-account' as never)}
                danger
              />
            </View>

            <Text style={styles.version}>Pickar Driver v1.0.0</Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Document Card Component ──────────────────────────────────────
function DocumentCard({
  title,
  subtitle,
  icon,
  fieldKey,
  currentUrl,
  onUploadSuccess,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  fieldKey: string;
  currentUrl?: string;
  onUploadSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'doc.jpg' } as any);
      formData.append('upload_preset', 'pickar_profiles');
      formData.append('folder', 'pickar/documents');

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/dtr1shkje/image/upload`,
        { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload failed');

      await api.patch('/users/me', { [fieldKey]: data.secure_url });
      Alert.alert('Uploaded', `${title} uploaded successfully.`);
      onUploadSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  const isUploaded = !!currentUrl;

  return (
    <View style={styles.docCard}>
      <View style={styles.docCardLeft}>
        <View style={[styles.docIconBox, isUploaded && styles.docIconBoxUploaded]}>
          <Ionicons name={icon} size={22} color={isUploaded ? '#22C55E' : Colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docSubtitle}>{subtitle}</Text>
          {isUploaded && (
            <View style={styles.uploadedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
              <Text style={styles.uploadedBadgeText}>Uploaded</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[styles.docUploadBtn, isUploaded && styles.docReuploadBtn]}
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading
          ? <ActivityIndicator size={14} color={isUploaded ? Colors.textSecondary : Colors.white} />
          : <Text style={[styles.docUploadBtnText, isUploaded && styles.docReuploadBtnText]}>
              {isUploaded ? 'Re-upload' : 'Upload'}
            </Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 20,
  },
  headerAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.lightGray,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: Fonts.poppins.semiBold, fontSize: 18, color: '#fff', marginBottom: 2 },
  headerPhone: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  headerBadgeRow: { flexDirection: 'row', gap: 8 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  ratingText: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: '#fff' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusOnline: { backgroundColor: 'rgba(34,197,94,0.2)' },
  statusBusy: { backgroundColor: 'rgba(245,158,11,0.2)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  statusDotOnline: { backgroundColor: '#22C55E' },
  statusDotBusy: { backgroundColor: '#F59E0B' },
  statusText: { fontFamily: Fonts.poppins.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  statusTextOnline: { color: '#22C55E' },
  statusTextBusy: { color: '#F59E0B' },

  // Tabs
  tabBar: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    maxHeight: 52,
  },
  tabBarContent: { paddingHorizontal: 12, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.primary },

  // Tab content
  tabContent: { flex: 1 },
  tabContentInner: { padding: 20 },

  sectionTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 14,
    color: Colors.textPrimary, marginBottom: 4, marginTop: 8,
  },
  sectionSub: {
    fontFamily: Fonts.poppins.regular, fontSize: 12,
    color: Colors.textSecondary, marginBottom: 14, lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16, overflow: 'hidden',
  },

  // Info rows
  infoRow: { paddingVertical: 12 },
  infoLabel: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoValue: { fontFamily: Fonts.poppins.medium, fontSize: 15, color: Colors.textPrimary, flex: 1 },
  infoRowDivider: { height: 1, backgroundColor: Colors.border },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontFamily: Fonts.poppins.medium, fontSize: 12, color: '#22C55E' },

  // Fields
  fieldGroup: { marginBottom: 8 },
  fieldLabel: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textPrimary, marginBottom: 8 },
  fieldInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.lightGray, borderRadius: 10,
    paddingHorizontal: 14, borderWidth: 1.5, borderColor: 'transparent', minHeight: 50,
  },
  fieldInputFocused: { borderColor: Colors.primary, backgroundColor: Colors.white },
  fieldTextInput: {
    flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 15,
    color: Colors.textPrimary, paddingVertical: 12,
  },
  inlineSaveBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 8,
  },
  inlineSaveBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 12, color: '#fff' },

  // Vehicle type
  vehicleTypeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  vehicleTypeCard: {
    flex: 1, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, alignItems: 'center', gap: 6,
    position: 'relative',
  },
  vehicleTypeCardActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  vehicleTypeLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textSecondary },
  vehicleTypeLabelActive: { color: Colors.primary },
  vehicleTypeDesc: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  vehicleCheckBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.white,
  },
  saveVehicleBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginBottom: 16,
  },
  saveVehicleBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: '#fff' },

  // Documents
  docCard: {
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  docCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  docIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  docIconBoxUploaded: { backgroundColor: '#F0FDF4' },
  docTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary, marginBottom: 2 },
  docSubtitle: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  uploadedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  uploadedBadgeText: { fontFamily: Fonts.poppins.medium, fontSize: 11, color: '#22C55E' },
  docUploadBtn: {
    backgroundColor: Colors.primary, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10,
  },
  docReuploadBtn: { backgroundColor: Colors.lightGray, borderWidth: 1, borderColor: Colors.border },
  docUploadBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: '#fff' },
  docReuploadBtnText: { color: Colors.textSecondary },
  docInfoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${Colors.primary}10`, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: `${Colors.primary}20`, marginTop: 4,
  },
  docInfoText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Bank
  bankCard: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14, marginBottom: 10,
  },
  bankCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bankIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  bankName: { fontFamily: Fonts.poppins.semiBold, fontSize: 14, color: Colors.textPrimary },
  bankAccount: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  bankNumber: { fontFamily: Fonts.poppins.medium, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  defaultBadge: {
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  defaultBadgeText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11, color: Colors.primary },
  addBankBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: 14, paddingVertical: 15, marginTop: 4,
  },
  addBankBtnText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.primary },

  // Menu
  menuSection: {
    backgroundColor: Colors.white,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  menuItemPressed: { backgroundColor: Colors.lightGray },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  menuIconBoxDanger: { backgroundColor: '#FEE2E2' },
  menuCenter: { flex: 1 },
  menuLabel: { fontSize: 15, fontFamily: Fonts.poppins.medium, color: Colors.textPrimary },
  menuLabelDanger: { color: Colors.error },
  menuSublabel: { fontSize: 12, fontFamily: Fonts.poppins.regular, color: Colors.textSecondary, marginTop: 1 },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Contact cards
  contactRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  contactCard: {
    flex: 1, backgroundColor: Colors.white,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    padding: 14, alignItems: 'center', gap: 8,
  },
  contactIconBox: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  contactCardLabel: { fontFamily: Fonts.poppins.semiBold, fontSize: 13, color: Colors.textPrimary },
  contactCardSub: { fontFamily: Fonts.poppins.regular, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyStateText: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textSecondary },
  emptyStateSub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  version: {
    textAlign: 'center', fontSize: 12,
    fontFamily: Fonts.poppins.regular, color: Colors.textSecondary, marginTop: 8,
  },
});