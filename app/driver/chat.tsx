import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

interface Message {
  _id: string;
  sender: string;
  senderType: 'user' | 'driver';
  message: string;
  createdAt: string;
  read: boolean;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export default function DriverChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const { clearUnread } = useChatStore();

  const deliveryId = params.deliveryId as string;
  const userName   = (params.userName  as string) || 'Customer';
  const userPhoto  = params.userPhoto  as string;
  const userPhone  = params.userPhone  as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const listRef   = useRef<FlatList>(null);
  const userRef   = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Clear unread badge on open
  useEffect(() => { clearUnread(deliveryId); }, [deliveryId]);

  useEffect(() => {
    if (!deliveryId) return;
    fetchHistory();
    connectSocket();
    return () => { socketRef.current?.disconnect(); };
  }, [deliveryId]);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get(`/chat/${deliveryId}`);
      if (data.success) setMessages(data.data);
    } catch (err) { console.error('[DriverChat]', err); }
    finally { setLoading(false); }
  };

  const connectSocket = () => {
    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_chat_room', { deliveryId, userId: userRef.current?.id });
      socket.emit('mark_read', { deliveryId, readerType: 'driver' });
    });

    socket.on('message_sent', (msg: Message) => {
      setMessages(prev =>
        prev.map(m => m._id.startsWith('temp_') && m.message === msg.message ? msg : m)
      );
    });

    socket.on('new_message', (msg: Message) => {
      setMessages(prev => {
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      socket.emit('mark_read', { deliveryId, readerType: 'driver' });
      scrollToBottom();
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');

    const temp: Message = {
      _id: `temp_${Date.now()}`, sender: user?.id ?? '',
      senderType: 'driver', message: text,
      createdAt: new Date().toISOString(), read: false,
    };
    setMessages(prev => [...prev, temp]);
    scrollToBottom();

    socketRef.current?.emit('send_message', {
      deliveryId, senderId: user?.id, senderType: 'driver', message: text,
    });
  };

  const handleCall = () => {
    if (!userPhone) {
      Alert.alert('Unavailable', "Customer's number is not available.");
      return;
    }
    Linking.openURL(`tel:${userPhone}`).catch(() =>
      Alert.alert('Error', 'Could not open the phone app.')
    );
  };

  // Safe back
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/driver/(tabs)/home' as never);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderType === 'driver';
    const prev = index > 0 ? messages[index - 1] : null;
    const showTime = !prev ||
      new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
    const isPending = item._id.startsWith('temp_');

    return (
      <View>
        {showTime && <Text style={styles.timeSep}>{formatTime(item.createdAt)}</Text>}
        <View style={[styles.row, isMe && styles.rowMe]}>
          {!isMe && (
            <View style={styles.avatarSmall}>
              {userPhoto
                ? <Image source={{ uri: userPhoto }} style={styles.avatarSmallImg} />
                : <Ionicons name="person" size={13} color={Colors.textSecondary} />
              }
            </View>
          )}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.message}</Text>
          </View>
          {isMe && (
            <View style={styles.tick}>
              {isPending
                ? <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                : item.read
                ? <Ionicons name="checkmark-done" size={13} color={Colors.primary} />
                : <Ionicons name="checkmark" size={13} color={Colors.textSecondary} />
              }
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            {userPhoto
              ? <Image source={{ uri: userPhoto }} style={styles.headerAvatarImg} />
              : <Ionicons name="person" size={18} color={Colors.textSecondary} />
            }
          </View>
          <View>
            <Text style={styles.headerName}>{userName}</Text>
            <Text style={styles.headerSub}>Package sender</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
          <Ionicons name="call" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={i => i._id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={44} color={Colors.border} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>Send a message to the customer</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={1000}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.lightGray,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: `${Colors.primary}30`,
  },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  headerName: { fontFamily: Fonts.poppins.semiBold, fontSize: 15, color: Colors.textPrimary },
  headerSub: { fontFamily: Fonts.poppins.regular, fontSize: 12, color: Colors.textSecondary },
  callBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  timeSep: {
    textAlign: 'center', fontFamily: Fonts.poppins.regular,
    fontSize: 11, color: Colors.textSecondary, marginVertical: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  rowMe: { flexDirection: 'row-reverse' },
  avatarSmall: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.lightGray,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 6, marginBottom: 2,
  },
  avatarSmallImg: { width: 26, height: 26, borderRadius: 13 },
  bubble: { maxWidth: '72%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18 },
  bubbleMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, marginLeft: 6 },
  bubbleThem: {
    backgroundColor: Colors.white, borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  bubbleText: { fontFamily: Fonts.poppins.regular, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  tick: { alignSelf: 'flex-end', marginLeft: 4, marginBottom: 3 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: Fonts.poppins.semiBold, fontSize: 16, color: Colors.textPrimary },
  emptySub: { fontFamily: Fonts.poppins.regular, fontSize: 13, color: Colors.textSecondary },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, fontFamily: Fonts.poppins.regular, fontSize: 15, color: Colors.textPrimary,
    backgroundColor: Colors.lightGray, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: Colors.border },
});