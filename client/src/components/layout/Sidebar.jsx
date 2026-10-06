/**
 * SIDEBAR COMPONENT
 * =================
 * Left navigation panel for Channels, Groups, Direct Messages, and Friends.
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import ThemeToggle from './ThemeToggle';

export default function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onOpenFriendsModal,
  onOpenCreateGroupModal,
  pendingRequestsCount = 0,
}) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Categorize rooms
  const publicChannels = rooms.filter((r) => !r.isPrivate && !r.isGroup);
  const groupRooms = rooms.filter((r) => r.isGroup);
  const dmRooms = rooms.filter((r) => r.isPrivate && !r.isGroup);

  // Filter by search
  const filteredChannels = publicChannels.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredGroups = groupRooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDMs = dmRooms.filter((r) => {
    const otherUser = r.members?.find((m) => (m._id || m) !== user?._id);
    const displayName = otherUser?.username || r.name;
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateChannel = (e) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setShowCreateChannelModal(false);
    }
  };

  const initial = user?.username?.charAt(0).toUpperCase() || '?';
  const avatarColor = user?.username
    ? `hsl(${user.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`
    : '#6366f1';

  return (
    <aside className="sidebar">
      {/* User header */}
      <div className="sidebar-header">
        <div className="sidebar-user-info">
          <div className="sidebar-avatar" style={{ backgroundColor: avatarColor }}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.username} />
            ) : (
              initial
            )}
            <span className={`status-dot ${isConnected ? 'status-online' : 'status-offline'}`} />
          </div>
          <div className="sidebar-user-text">
            <span className="sidebar-username">{user?.username}</span>
            <span className="sidebar-status">
              {isConnected ? 'Online' : 'Connecting...'}
            </span>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <ThemeToggle />
          <button className="sidebar-logout" onClick={logout} title="Logout" id="logout-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M6 15H3a1 1 0 01-1-1V4a1 1 0 011-1h3m4 10l4-4m0 0l-4-4m4 4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Friends & Connections Quick Action Bar */}
      <div className="sidebar-quick-actions">
        <button
          className="sidebar-action-pill"
          onClick={onOpenFriendsModal}
          title="Manage Friends and Friend Requests"
        >
          <span className="action-pill-icon">👥</span>
          <span className="action-pill-text">Friends & Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="action-pill-badge">{pendingRequestsCount}</span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="search-icon">
          <path d="M6.5 1a5.5 5.5 0 013.89 9.39l3.61 3.61a.75.75 0 11-1.06 1.06l-3.61-3.61A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/>
        </svg>
        <input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
          id="search-rooms"
        />
      </div>

      {/* SECTION 1: PUBLIC CHANNELS */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Channels</span>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowCreateChannelModal(true)}
            title="Create channel"
            id="create-room-btn"
          >
            +
          </button>
        </div>

        <div className="sidebar-room-list">
          {filteredChannels.map((room) => (
            <button
              key={room._id}
              className={`sidebar-room-item ${room._id === activeRoomId ? 'active' : ''}`}
              onClick={() => onSelectRoom(room)}
              id={`room-${room._id}`}
            >
              <span className="room-hash">#</span>
              <span className="room-name">{room.name}</span>
            </button>
          ))}

          {filteredChannels.length === 0 && (
            <div className="sidebar-empty">
              {searchQuery ? 'No channels found' : 'No public channels'}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: MULTI-USER GROUPS */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Groups ({groupRooms.length})</span>
          <button
            className="sidebar-add-btn"
            onClick={onOpenCreateGroupModal}
            title="Create new group"
            id="create-group-btn"
          >
            +
          </button>
        </div>

        <div className="sidebar-room-list">
          {filteredGroups.map((room) => (
            <button
              key={room._id}
              className={`sidebar-room-item ${room._id === activeRoomId ? 'active' : ''}`}
              onClick={() => onSelectRoom(room)}
            >
              <span className="room-group-icon">👥</span>
              <span className="room-name">{room.name}</span>
              <span className="room-member-badge">{room.members?.length || 0}</span>
            </button>
          ))}

          {filteredGroups.length === 0 && (
            <div className="sidebar-empty">
              {searchQuery ? 'No groups found' : 'No groups yet. Click + to create'}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: DIRECT MESSAGES (FRIENDS ONLY) */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Direct Messages</span>
          <button
            className="sidebar-add-btn"
            onClick={onOpenFriendsModal}
            title="Start conversation with friend"
            id="create-dm-btn"
          >
            +
          </button>
        </div>

        <div className="sidebar-room-list">
          {filteredDMs.map((room) => {
            const otherUser = room.members?.find((m) => (m._id || m) !== user?._id);
            const displayName = otherUser?.username || room.name;
            const isOtherOnline = otherUser?.status === 'online';

            return (
              <button
                key={room._id}
                className={`sidebar-room-item ${room._id === activeRoomId ? 'active' : ''}`}
                onClick={() => onSelectRoom(room)}
              >
                <span className={`room-dm-dot ${isOtherOnline ? 'online' : 'offline'}`}>●</span>
                <span className="room-name">{displayName}</span>
              </button>
            );
          })}

          {filteredDMs.length === 0 && (
            <div className="sidebar-empty">
              {searchQuery ? 'No conversations found' : 'No conversations. Click + to message a friend'}
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="modal-overlay" onClick={() => setShowCreateChannelModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Channel</h2>
            <form onSubmit={handleCreateChannel}>
              <div className="form-group">
                <label htmlFor="new-room-name">Channel name</label>
                <input
                  id="new-room-name"
                  type="text"
                  placeholder="e.g. general, announcements"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateChannelModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="confirm-create-room">
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
