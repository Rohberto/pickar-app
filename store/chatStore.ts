import { create } from 'zustand';

interface ChatState {
  // unread count per deliveryId — any screen can read/update this
  unreadCounts: Record<string, number>;
  // last message preview per deliveryId — for notification banners
  lastMessage: Record<string, { text: string; senderType: 'user' | 'driver' }>;

  incrementUnread: (deliveryId: string, text: string, senderType: 'user' | 'driver') => void;
  clearUnread: (deliveryId: string) => void;
  getTotalUnread: () => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  unreadCounts: {},
  lastMessage: {},

  incrementUnread: (deliveryId, text, senderType) => {
    set(state => ({
      unreadCounts: {
        ...state.unreadCounts,
        [deliveryId]: (state.unreadCounts[deliveryId] ?? 0) + 1,
      },
      lastMessage: {
        ...state.lastMessage,
        [deliveryId]: { text, senderType },
      },
    }));
  },

  clearUnread: (deliveryId) => {
    set(state => ({
      unreadCounts: { ...state.unreadCounts, [deliveryId]: 0 },
    }));
  },

  getTotalUnread: () => {
    return Object.values(get().unreadCounts).reduce((sum, n) => sum + n, 0);
  },
}));