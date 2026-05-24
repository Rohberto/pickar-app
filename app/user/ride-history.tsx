import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import api from '@/services/api';
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

interface Delivery {
  _id: string;
  status: string;
  pickupAddress: { label: string };
  recipient: { address: { label: string }; name: string };
  price: number;
  createdAt: string;
  packageType: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  delivered:       { label: 'Delivered',       color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-circle' },
  in_transit:      { label: 'In Transit',       color: '#2563EB', bg: '#DBEAFE', icon: 'car'             },
  driver_assigned: { label: 'Driver Assigned',  color: '#9333EA', bg: '#F3E8FF', icon: 'person'          },
  driver_arrived:  { label: 'Driver Arrived',   color: '#EA580C', bg: '#FFEDD5', icon: 'location'        },
  finding_driver:  { label: 'Finding Driver',   color: '#CA8A04', bg: '#FEF9C3', icon: 'search'          },
  cancelled:       { label: 'Cancelled',        color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle'    },
  pending:         { label: 'Pending',          color: '#6B7280', bg: '#F3F4F6', icon: 'time'            },
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
};

const FILTERS = ['All', 'Delivered', 'In Transit', 'Cancelled'];

export default function RideHistoryScreen() {
  const router = useRouter();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/deliveries/history');
      if (data.success) setDeliveries(data.data ?? []);
    } catch (err) {
      console.error('[RideHistory]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const filtered = deliveries.filter(d => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Delivered') return d.status === 'delivered';
    if (activeFilter === 'In Transit') return ['in_transit', 'driver_assigned', 'driver_arrived', 'finding_driver'].includes(d.status);
    if (activeFilter === 'Cancelled') return d.status === 'cancelled';
    return true;
  });

  const renderItem = ({ item }: { item: Delivery }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          // If delivery is still active, resume tracking
          if (!['delivered', 'cancelled'].includes(item.status)) {
            router.push({
              pathname: '/user/finding-driver',
              params: { deliveryId: item._id },
            } as never);
          }
        }}
      >
        {/* Status badge */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          {/* Pickup */}
          <View style={styles.routePoint}>
            <View style={styles.dotPickup} />
            <Text style={styles.routeLabel} numberOfLines={1}>
              {item.pickupAddress?.label ?? 'Pickup'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          {/* Destination */}
          <View style={styles.routePoint}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.routeLabel} numberOfLines={1}>
              {item.recipient?.address?.label ?? 'Destination'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Ionicons name="person-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.footerText}>{item.recipient?.name ?? 'Recipient'}</Text>
            <View style={styles.dot} />
            <Text style={styles.footerText}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.priceText}>₦{(item.price ?? 0).toLocaleString()}</Text>
        </View>

        {/* Tap hint for active deliveries */}
        {!['delivered', 'cancelled'].includes(item.status) && (
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to track delivery</Text>
            <Ionicons name="arrow-forward" size={12} color={Colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptySub}>
                {activeFilter === 'All'
                  ? 'Your delivery history will appear here'
                  : `No ${activeFilter.toLowerCase()} deliveries`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary,
  },

  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.lightGray,
    borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: `${Colors.primary}12`, borderColor: Colors.primary,
  },
  filterText: {
    fontFamily: Fonts.poppins.medium, fontSize: 13, color: Colors.textSecondary,
  },
  filterTextActive: { color: Colors.primary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontFamily: Fonts.poppins.semiBold, fontSize: 11 },
  dateText: {
    fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary,
  },

  routeRow: { marginBottom: 14 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotPickup: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: `${Colors.primary}40`,
  },
  routeLabel: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textPrimary, flex: 1,
  },
  routeLine: {
    width: 1.5, height: 16, backgroundColor: Colors.border,
    marginLeft: 5, marginVertical: 4,
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: {
    fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary,
  },
  dot: {
    width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textSecondary,
  },
  priceText: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary,
  },

  tapHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: `${Colors.primary}20`,
  },
  tapHintText: {
    fontFamily: Fonts.poppins.medium, fontSize: 12, color: Colors.primary,
  },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.poppins.semiBold, fontSize: 17, color: Colors.textPrimary,
  },
  emptySub: {
    fontFamily: Fonts.poppins.regular, fontSize: 13,
    color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 40,
  },
});