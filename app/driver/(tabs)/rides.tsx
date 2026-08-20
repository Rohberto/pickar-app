import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
import { downloadReceipt } from '@/utils/receipt';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Ride {
  _id: string;
  status: string;
  pickupAddress: { label: string };
  recipient: { address: { label: string }; name: string };
  user?: { fullName?: string };
  business?: { name?: string };
  price: number;
  createdAt: string;
  rideType?: string;
  distanceKm?: number;
  weightKg?: number;
  packageType?: string;
  fareBreakdown?: Record<string, number>;
  timeline?: { deliveredAt?: string };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  delivered:       { label: 'Delivered',      color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' },
  in_transit:      { label: 'In Transit',     color: '#2563EB', bg: '#DBEAFE', icon: 'car'             },
  driver_assigned: { label: 'Assigned',       color: '#9333EA', bg: '#F3E8FF', icon: 'person'          },
  driver_arrived:  { label: 'At Pickup',      color: '#EA580C', bg: '#FFEDD5', icon: 'location'        },
  cancelled:       { label: 'Cancelled',      color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle'    },
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
};
const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
};

const FILTERS = ['All', 'Delivered', 'Cancelled'];

export default function DriverRidesScreen() {
  const router = useRouter();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => { fetchRides(); }, []);

  const fetchRides = async () => {
    try {
      const { data } = await api.get('/drivers/rides');
      if (data.success) setRides(data.data ?? []);
    } catch (err) {
      console.error('[DriverRides]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRides();
  };

  const filtered = rides.filter(r => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Delivered') return r.status === 'delivered';
    if (activeFilter === 'Cancelled') return r.status === 'cancelled';
    return true;
  });

  const handleDownloadReceipt = async (ride: Ride) => {
    setDownloadingId(ride._id);
    try {
      await downloadReceipt({
        deliveryId: ride._id,
        date: ride.timeline?.deliveredAt || ride.createdAt,
        price: ride.price,
        pickupLabel: ride.pickupAddress?.label,
        destLabel: ride.recipient?.address?.label,
        recipientName: ride.recipient?.name || ride.user?.fullName || ride.business?.name,
        distanceKm: ride.distanceKm,
        weightKg: ride.weightKg,
        packageType: ride.packageType,
        rideType: ride.rideType,
        fareBreakdown: ride.fareBreakdown,
      });
    } catch (_) {
      // silent — receipt generation is best-effort from this list; the
      // driver can always retry from delivery-complete.tsx too
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: Ride }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.driver_assigned;
    const isActive = ['driver_assigned', 'driver_arrived', 'in_transit'].includes(item.status);
    const isDelivered = item.status === 'delivered';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          if (isActive) {
            router.push({ pathname: '/driver/(tabs)/Home' as never });
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.redDot} />
          <Text style={styles.routeText} numberOfLines={1}>{item.pickupAddress?.label || 'Pickup'}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <Ionicons name="location" size={13} color={Colors.textPrimary} />
          <Text style={[styles.routeText, { marginLeft: 6 }]} numberOfLines={1}>
            {item.recipient?.address?.label || 'Destination'}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View>
            <Text style={styles.customerText}>
              {item.user?.fullName || item.business?.name || item.recipient?.name || 'Customer'}
            </Text>
            {item.rideType && (
              <Text style={styles.rideTypeText}>{item.rideType.replace('_', ' ')}</Text>
            )}
          </View>
          <Text style={styles.earningText}>₦{Math.round(item.price || 0).toLocaleString()}</Text>
        </View>

        {isDelivered && (
          <TouchableOpacity
            style={styles.receiptBtn}
            onPress={() => handleDownloadReceipt(item)}
            disabled={downloadingId === item._id}
            activeOpacity={0.7}
          >
            {downloadingId === item._id
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Ionicons name="receipt-outline" size={15} color={Colors.primary} />
            }
            <Text style={styles.receiptBtnText}>
              {downloadingId === item._id ? 'Preparing...' : 'Download receipt'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rides</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="receipt-outline" size={40} color={Colors.border} />
          <Text style={styles.emptyText}>No rides yet</Text>
          <Text style={styles.emptySub}>Your completed trips will show up here</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 22, color: Colors.textPrimary },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },

  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textSecondary, marginTop: 8 },
  emptySub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11 },
  dateText: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },

  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  routeText: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textPrimary, flex: 1, marginLeft: 12 },
  routeConnector: { width: 1.5, height: 12, backgroundColor: Colors.border, marginLeft: 4.5, marginVertical: 1 },

  footerRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  customerText: { fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textPrimary },
  rideTypeText: { fontFamily: Fonts.poppins.regular, fontSize: 11, color: Colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  earningText: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },

  receiptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: `${Colors.primary}0F`,
  },
  receiptBtnText: { fontFamily: Fonts.poppins.medium, fontSize: 12, color: Colors.primary },
});
