/**
 * CHAT PAGE
 * =========
 * The main page after login — the entire chat interface.
 * 
 * THIS IS THE ORCHESTRATOR — it:
 * 1. Fetches rooms from the API
 * 2. Manages the active room state
 * 3. Listens for socket events (new messages, typing, etc.)
 * 4. Passes data down to Sidebar and ChatWindow
 * 
 * DATA FLOW:
 * ChatPage (state) → Sidebar (room list)
 *                  → ChatWindow (messages, input)
 *                    → MessageList (display)
 *                    → MessageInput (send)
 * 
 * Socket events flow UP (from server) and DOWN (to children):
 * Server → ChatPage (on 'new_message') → updates messages state → MessageList re-renders
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { requestNotificationPermission, notifyNewMessage } from '../utils/notifications';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/layout/ChatWindow';

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
  const [users, setUsers] = useState([]);

  const activeRoomRef = useRef(null);

  // Keep ref in sync with state (for use in socket callbacks)
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // ─── Request notification permission on mount ──────────
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ─── Fetch rooms on mount ─────────────────────────────
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await api.get('/rooms');
        setRooms(data.rooms || data);
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    };

    const fetchUsers = async () => {
      try {
        const { data } = await api.get('/rooms/users');
        setUsers(data.users || data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    fetchRooms();
    fetchUsers();
  }, []);

  // ─── Load message history when active room changes ─────
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

  // ─── Join/leave rooms via socket ──────────────────────
  useEffect(() => {
    if (!activeRoom || !isConnected) return;

    emit('join_room', activeRoom._id);

    return () => {
      emit('leave_room', activeRoom._id);
    };
  }, [activeRoom?._id, isConnected, emit]);

  // ─── Socket event listeners ───────────────────────────
  useEffect(() => {
    if (!isConnected) return;

    // NEW MESSAGE — add to list if it's for the active room
    const handleNewMessage = (message) => {
      if (message.roomId === activeRoomRef.current?._id) {
        setMessages((prev) => [...prev, message]);
      }

      // Browser notification for messages from other users
      if (message.senderId?._id !== user?._id) {
        const room = rooms.find((r) => r._id === message.roomId);
        notifyNewMessage(message, room?.name || 'Chat');
      }
    };

    // TYPING — update typing users for active room
    const handleTyping = ({ userId, username, roomId, isTyping }) => {
      if (roomId !== activeRoomRef.current?._id) return;
      if (userId === user?._id) return; // Don't show own typing

      setTypingUsers((prev) => {
        if (isTyping) {
          return prev.includes(username) ? prev : [...prev, username];
        } else {
          return prev.filter((u) => u !== username);
        }
      });
    };

    // REACTION — update reactions on a message
    const handleReaction = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        )
      );
    };

    // MESSAGE DELETED — remove from list
    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    };

    // ROOM CREATED — add to room list
    const handleRoomCreated = (room) => {
      setRooms((prev) => {
        if (prev.find((r) => r._id === room._id)) return prev;
        return [...prev, room];
      });
    };

    const unsubs = [
      on('new_message', handleNewMessage),
      on('user_typing', handleTyping),
      on('reaction_updated', handleReaction),
      on('message_deleted', handleMessageDeleted),
      on('room_created', handleRoomCreated),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [isConnected, on, off, user?._id, rooms]);

  // ─── Actions ──────────────────────────────────────────

  const handleSelectRoom = useCallback((room) => {
    setActiveRoom(room);
  }, []);

  const handleCreateRoom = useCallback(async (name) => {
    try {
      const { data } = await api.post('/rooms', { name });
      const newRoom = data.room || data;
      setRooms((prev) => [...prev, newRoom]);
      setActiveRoom(newRoom);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert(err.response?.data?.message || 'Failed to create room');
    }
  }, []);

  const handleCreateDM = useCallback(async (targetUserId) => {
    try {
      const { data } = await api.post('/rooms/dm', { targetUserId });
      const dmRoom = data.room || data;

      setRooms((prev) => {
        if (prev.find((r) => r._id === dmRoom._id)) return prev;
        return [...prev, dmRoom];
      });
      setActiveRoom(dmRoom);
    } catch (err) {
      console.error('Failed to create DM:', err);
      alert(err.response?.data?.message || 'Failed to create DM');
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
        onCreateDM={handleCreateDM}
        users={users}
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
    </div>
  );
}
