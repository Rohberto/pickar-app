import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useChatStore } from '@/store/chatStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  deliveryId: string;
  // User side — pass these when driver chats with user
  driverName?: string;
  driverPhoto?: string;
  driverPhone?: string;
  // Driver side — pass these when user chats with driver
  userName?: string;
  userPhoto?: string;
  userPhone?: string;
  // Which side is opening the chat
  side: 'user' | 'driver';
  // Visual variant
  variant?: 'full' | 'icon'; // full = "Chat with Driver" label, icon = just the icon
}

export default function ChatButton({
  deliveryId,
  driverName, driverPhoto, driverPhone,
  userName, userPhoto, userPhone,
  side,
  variant = 'full',
}: Props) {
  const router = useRouter();
  const { unreadCounts, clearUnread } = useChatStore();
  const unread = unreadCounts[deliveryId] ?? 0;

  const handlePress = () => {
    clearUnread(deliveryId);

    if (side === 'user') {
      router.push({
        pathname: '/user/chat',
        params: { deliveryId, driverName, driverPhoto, driverPhone },
      } as never);
    } else {
      router.push({
        pathname: '/driver/chat',
        params: { deliveryId, userName, userPhoto, userPhone },
      } as never);
    }
  };

  if (variant === 'icon') {
    return (
      <TouchableOpacity style={styles.iconBtn} onPress={handlePress} activeOpacity={0.8}>
        <Ionicons name="chatbox-outline" size={20} color={Colors.primary} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.fullBtn} onPress={handlePress} activeOpacity={0.8}>
      <Ionicons name="chatbox-outline" size={17} color={Colors.primary} />
      <Text style={styles.fullBtnText}>
       Chat With Driver
      </Text>
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  fullBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 13, gap: 8, position: 'relative',
  },
  fullBtnText: {
    fontFamily: Fonts.poppins.medium, fontSize: 14, color: Colors.primary,
  },
  badge: {
    position: 'absolute', top: -7, right: -7,
    backgroundColor: '#DC2626', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: {
    fontFamily: Fonts.poppins.bold, fontSize: 9, color: '#fff',
  },
});