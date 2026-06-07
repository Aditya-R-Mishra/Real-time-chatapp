/**
 * SIDEBAR COMPONENT
 * =================
 * The left panel of the chat app showing:
 * 1. User info header
 * 2. Room list (public channels)
 * 3. DM list (private conversations)
 * 4. Create room button
 * 5. Search
 * 
 * WHY SIDEBAR?
 * Every modern chat app (Slack, Discord, WhatsApp) has a sidebar
 * for navigation. It's the primary way to switch between conversations.
 */

import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onCreateDM,
  users,
}) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Separate rooms and DMs
  const publicRooms = rooms.filter((r) => !r.isPrivate);
  const dmRooms = rooms.filter((r) => r.isPrivate);

  // Filter rooms by search
  const filteredPublic = publicRooms.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (newRoomName.trim()) {
      onCreateRoom(newRoomName.trim());
      setNewRoomName('');
      setShowCreateModal(false);
    }
  };

  // Get avatar initial and color
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
        <button className="sidebar-logout" onClick={logout} title="Logout" id="logout-btn">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <path d="M6 15H3a1 1 0 01-1-1V4a1 1 0 011-1h3m4 10l4-4m0 0l-4-4m4 4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="search-icon">
          <path d="M6.5 1a5.5 5.5 0 013.89 9.39l3.61 3.61a.75.75 0 11-1.06 1.06l-3.61-3.61A5.5 5.5 0 116.5 1zm0 1.5a4 4 0 100 8 4 4 0 000-8z"/>
        </svg>
        <input
          type="text"
          placeholder="Search rooms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
          id="search-rooms"
        />
      </div>

      {/* Channels section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Channels</span>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowCreateModal(true)}
            title="Create channel"
            id="create-room-btn"
          >
            +
          </button>
        </div>

        <div className="sidebar-room-list">
          {filteredPublic.map((room) => (
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

          {filteredPublic.length === 0 && (
            <div className="sidebar-empty">
              {searchQuery ? 'No rooms found' : 'No channels yet'}
            </div>
          )}
        </div>
      </div>

      {/* DMs section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Direct Messages</span>
          <button
            className="sidebar-add-btn"
            onClick={() => setShowDMModal(true)}
            title="New DM"
            id="create-dm-btn"
          >
            +
          </button>
        </div>

        <div className="sidebar-room-list">
          {dmRooms.map((room) => {
            // For DMs, show the other user's name (not your own)
            const otherUser = room.members?.find((m) => (m._id || m) !== user?._id);
            const displayName = otherUser?.username || room.name;

            return (
              <button
                key={room._id}
                className={`sidebar-room-item ${room._id === activeRoomId ? 'active' : ''}`}
                onClick={() => onSelectRoom(room)}
              >
                <span className="room-dm-icon">●</span>
                <span className="room-name">{displayName}</span>
              </button>
            );
          })}

          {dmRooms.length === 0 && (
            <div className="sidebar-empty">No conversations yet</div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Channel</h2>
            <form onSubmit={handleCreateRoom}>
              <div className="form-group">
                <label htmlFor="new-room-name">Channel name</label>
                <input
                  id="new-room-name"
                  type="text"
                  placeholder="e.g. general"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="confirm-create-room">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DM User Modal */}
      {showDMModal && (
        <div className="modal-overlay" onClick={() => setShowDMModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Start a Conversation</h2>
            <div className="dm-user-list">
              {users
                .filter((u) => u._id !== user?._id)
                .map((u) => (
                  <button
                    key={u._id}
                    className="dm-user-item"
                    onClick={() => {
                      onCreateDM(u._id);
                      setShowDMModal(false);
                    }}
                  >
                    <div
                      className="dm-user-avatar"
                      style={{
                        backgroundColor: `hsl(${u.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                      }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span>{u.username}</span>
                  </button>
                ))}

              {users.filter((u) => u._id !== user?._id).length === 0 && (
                <div className="sidebar-empty">No users available</div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowDMModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
