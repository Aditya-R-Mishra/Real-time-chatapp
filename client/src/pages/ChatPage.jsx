/**
 * CHAT PAGE
 * =========
 * The main orchestrator of the chat application.
 * Manages rooms, active conversations, real-time events, friends, and groups.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, notifyNewMessage } from '../utils/notifications';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/layout/ChatWindow';
import FriendsModal from '../components/chat/FriendsModal';
import CreateGroupModal from '../components/chat/CreateGroupModal';

export default function ChatPage() {
  const { user } = useAuth();
  const { emit, on, off, isConnected } = useSocket();

  // ─── State ─────────────────────────────────────────────
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modals & Friend State
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  const activeRoomRef = useRef(null);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Request browser notification permission
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Fetch initial rooms and friend requests
  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/rooms');
      const loadedRooms = data.rooms || data || [];
      setRooms(loadedRooms);
      // If no active room yet, pick the first public channel
      if (!activeRoomRef.current && loadedRooms.length > 0) {
        const defaultChannel = loadedRooms.find((r) => !r.isPrivate) || loadedRooms[0];
        setActiveRoom(defaultChannel);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, []);

  const fetchFriendRequests = useCallback(async () => {
    try {
      const { data } = await api.get('/friends/requests');
      setPendingRequestsCount(data.incoming?.length || 0);
    } catch (err) {
      console.error('Failed to fetch friend requests:', err);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchFriendRequests();
  }, [fetchRooms, fetchFriendRequests]);

  // Load message history when active room changes
  useEffect(() => {
    if (!activeRoom) return;

    const fetchMessages = async () => {
      try {
        const { data } = await api.get(`/rooms/${activeRoom._id}/messages`);
        const msgs = Array.isArray(data) ? data : data.messages || [];
        setMessages(msgs);
        setHasMore(msgs.length >= 50);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      }
    };

    fetchMessages();
    setTypingUsers([]);
    setReplyTo(null);
  }, [activeRoom?._id]);

  // Join/leave room via socket
  useEffect(() => {
    if (!activeRoom || !isConnected) return;

    emit('join_room', activeRoom._id);

    return () => {
      emit('leave_room', activeRoom._id);
    };
  }, [activeRoom?._id, isConnected, emit]);

  // Socket event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleNewMessage = (message) => {
      if (message.roomId === activeRoomRef.current?._id) {
        setMessages((prev) => [...prev, message]);
      }

      if (message.senderId?._id !== user?._id) {
        const room = rooms.find((r) => r._id === message.roomId);
        notifyNewMessage(message, room?.name || 'Chat');
      }
    };

    const handleTyping = ({ userId, username, roomId, isTyping }) => {
      if (roomId !== activeRoomRef.current?._id) return;
      if (userId === user?._id) return;

      setTypingUsers((prev) => {
        if (isTyping) {
          return prev.includes(username) ? prev : [...prev, username];
        } else {
          return prev.filter((u) => u !== username);
        }
      });
    };

    const handleReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, reactions } : msg))
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    };

    const handleRoomCreated = (room) => {
      setRooms((prev) => {
        if (prev.find((r) => r._id === room._id)) return prev;
        return [room, ...prev];
      });
    };

    const handleNewFriendRequest = ({ recipientId }) => {
      if (recipientId === user?._id) {
        setPendingRequestsCount((prev) => prev + 1);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Friend Request', {
            body: 'You received a new friend request on ChatApp!',
            icon: '/favicon.svg',
          });
        }
      }
    };

    const handleFriendRequestAccepted = ({ user1, user2 }) => {
      if (user1 === user?._id || user2 === user?._id) {
        fetchFriendRequests();
      }
    };

    const unsubs = [
      on('new_message', handleNewMessage),
      on('user_typing', handleTyping),
      on('reaction_updated', handleReaction),
      on('message_deleted', handleMessageDeleted),
      on('room_created', handleRoomCreated),
      on('new_friend_request', handleNewFriendRequest),
      on('friend_request_accepted', handleFriendRequestAccepted),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [isConnected, on, off, user?._id, rooms, fetchFriendRequests]);

  // Actions
  const handleSelectRoom = useCallback((room) => {
    setActiveRoom(room);
  }, []);

  const handleCreateRoom = useCallback(async (name) => {
    try {
      const { data } = await api.post('/rooms', { name });
      const newRoom = data.room || data;
      setRooms((prev) => [newRoom, ...prev]);
      setActiveRoom(newRoom);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create room');
    }
  }, []);

  const handleCreateGroup = useCallback(async ({ name, description, memberIds }) => {
    try {
      const { data } = await api.post('/rooms/group', { name, description, memberIds });
      const newGroup = data.room || data;
      setRooms((prev) => [newGroup, ...prev]);
      setActiveRoom(newGroup);
    } catch (err) {
      console.error('Failed to create group:', err);
      throw err;
    }
  }, []);

  const handleStartDMWithFriend = useCallback(async (targetUserId) => {
    try {
      const { data } = await api.post('/rooms/dm', { targetUserId });
      const dmRoom = data.room || data;

      setRooms((prev) => {
        if (prev.find((r) => r._id === dmRoom._id)) return prev;
        return [dmRoom, ...prev];
      });
      setActiveRoom(dmRoom);
    } catch (err) {
      console.error('Failed to create DM:', err);
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to start conversation');
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !activeRoom) return;

    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const cursor = oldestMessage?._id;
      const { data } = await api.get(
        `/rooms/${activeRoom._id}/messages?before=${cursor}&limit=30`
      );
      const olderMessages = Array.isArray(data) ? data : data.messages || [];
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(olderMessages.length >= 30);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeRoom, messages, loadingMore, hasMore]);

  const handleReact = useCallback((messageId, emoji) => {
    if (!activeRoom) return;
    emit('toggle_reaction', { messageId, emoji, roomId: activeRoom._id });
  }, [emit, activeRoom]);

  const handleReply = useCallback((message) => {
    setReplyTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleSearch = useCallback(async (query) => {
    if (!activeRoom) return;
    try {
      const { data } = await api.get(
        `/rooms/${activeRoom._id}/search?q=${encodeURIComponent(query)}`
      );
      setMessages(Array.isArray(data) ? data : data.messages || []);
      setHasMore(false);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, [activeRoom]);

  return (
    <div className="chat-page">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoom?._id}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={handleCreateRoom}
        onOpenFriendsModal={() => setShowFriendsModal(true)}
        onOpenCreateGroupModal={() => setShowCreateGroupModal(true)}
        pendingRequestsCount={pendingRequestsCount}
      />
      <ChatWindow
        room={activeRoom}
        messages={messages}
        typingUsers={typingUsers}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onReact={handleReact}
        onReply={handleReply}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        onSearch={handleSearch}
      />

      {/* Friends & Requests Modal */}
      <FriendsModal
        isOpen={showFriendsModal}
        onClose={() => {
          setShowFriendsModal(false);
          fetchFriendRequests();
        }}
        onStartDM={handleStartDMWithFriend}
      />

      {/* Create Multi-User Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
}
