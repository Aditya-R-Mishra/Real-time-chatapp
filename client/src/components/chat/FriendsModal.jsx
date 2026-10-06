/**
 * FRIENDS MODAL COMPONENT
 * =======================
 * Manages Friends list, Incoming/Outgoing Requests, and User Search for adding friends.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

export default function FriendsModal({ isOpen, onClose, onStartDM }) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'add'
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // Fetch friends and requests
  const loadData = useCallback(async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/requests'),
      ]);
      setFriends(friendsRes.data || []);
      setIncomingRequests(requestsRes.data?.incoming || []);
      setOutgoingRequests(requestsRes.data?.outgoing || []);
    } catch (err) {
      console.error('Failed to load friends data:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Search users for Add Friend tab
  useEffect(() => {
    if (activeTab !== 'add') return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/friends/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data || []);
      } catch (err) {
        console.error('Search users failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Send friend request
  const handleSendRequest = async (recipientId) => {
    setActionLoading((prev) => ({ ...prev, [recipientId]: true }));
    try {
      await api.post('/friends/request', { recipientId });
      await loadData();
      // Update local search results
      setSearchResults((prev) =>
        prev.map((u) => (u._id === recipientId ? { ...u, friendshipStatus: 'request_sent' } : u))
      );
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [recipientId]: false }));
    }
  };

  // Accept request
  const handleAcceptRequest = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await api.post(`/friends/request/${requestId}/accept`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  // Reject request
  const handleRejectRequest = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await api.post(`/friends/request/${requestId}/reject`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  // Cancel outgoing request
  const handleCancelRequest = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      await api.delete(`/friends/request/${requestId}`);
      await loadData();
      if (activeTab === 'add') {
        setSearchResults((prev) =>
          prev.map((u) => (u.requestId === requestId ? { ...u, friendshipStatus: 'none', requestId: null } : u))
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel request');
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  if (!isOpen) return null;

  const totalRequestsCount = incomingRequests.length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <h2>Friends & Connections</h2>
            <button className="modal-close-icon" onClick={onClose}>✕</button>
          </div>
          <p className="modal-subtitle">
            You can only message users who are your friends. Connect with people to chat!
          </p>

          {/* Tabs */}
          <div className="friends-tabs">
            <button
              className={`friends-tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends ({friends.length})
            </button>
            <button
              className={`friends-tab ${activeTab === 'requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              Requests
              {totalRequestsCount > 0 && (
                <span className="tab-badge">{totalRequestsCount}</span>
              )}
            </button>
            <button
              className={`friends-tab ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
            >
              + Add Friend
            </button>
          </div>
        </div>

        <div className="friends-modal-body">
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'friends' && (
            <div className="friends-list-container">
              {friends.length === 0 ? (
                <div className="empty-friends-state">
                  <div className="empty-icon">👥</div>
                  <h3>No friends yet</h3>
                  <p>Send friend requests to start chatting with other users!</p>
                  <button className="btn-primary btn-sm" onClick={() => setActiveTab('add')}>
                    Find Friends
                  </button>
                </div>
              ) : (
                <div className="friends-grid">
                  {friends.map((friend) => (
                    <div key={friend._id} className="friend-card">
                      <div className="friend-avatar-wrapper">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt={friend.username} className="friend-avatar-img" />
                        ) : (
                          <div
                            className="friend-avatar-initial"
                            style={{
                              backgroundColor: `hsl(${friend.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                            }}
                          >
                            {friend.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`status-dot ${friend.status === 'online' ? 'status-online' : 'status-offline'}`} />
                      </div>

                      <div className="friend-info">
                        <span className="friend-name">{friend.username}</span>
                        <span className="friend-status-text">{friend.status || 'offline'}</span>
                      </div>

                      <button
                        className="btn-primary btn-sm chat-action-btn"
                        onClick={() => {
                          onStartDM(friend._id);
                          onClose();
                        }}
                      >
                        💬 Chat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="requests-container">
              {/* Incoming Requests */}
              <div className="requests-section">
                <h4>Incoming Requests ({incomingRequests.length})</h4>
                {incomingRequests.length === 0 ? (
                  <p className="no-requests-text">No pending incoming requests</p>
                ) : (
                  <div className="requests-list">
                    {incomingRequests.map((req) => (
                      <div key={req._id} className="request-card">
                        <div className="request-user">
                          <div
                            className="request-avatar"
                            style={{
                              backgroundColor: `hsl(${req.sender.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                            }}
                          >
                            {req.sender.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="request-username">{req.sender.username}</span>
                            <span className="request-time">Wants to connect with you</span>
                          </div>
                        </div>

                        <div className="request-actions">
                          <button
                            className="btn-primary btn-sm"
                            disabled={actionLoading[req._id]}
                            onClick={() => handleAcceptRequest(req._id)}
                          >
                            Accept
                          </button>
                          <button
                            className="btn-secondary btn-sm"
                            disabled={actionLoading[req._id]}
                            onClick={() => handleRejectRequest(req._id)}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outgoing Requests */}
              <div className="requests-section" style={{ marginTop: '20px' }}>
                <h4>Sent Requests ({outgoingRequests.length})</h4>
                {outgoingRequests.length === 0 ? (
                  <p className="no-requests-text">No pending sent requests</p>
                ) : (
                  <div className="requests-list">
                    {outgoingRequests.map((req) => (
                      <div key={req._id} className="request-card">
                        <div className="request-user">
                          <div
                            className="request-avatar"
                            style={{
                              backgroundColor: `hsl(${req.recipient.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                            }}
                          >
                            {req.recipient.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="request-username">{req.recipient.username}</span>
                            <span className="request-time">Pending acceptance</span>
                          </div>
                        </div>

                        <button
                          className="btn-secondary btn-sm"
                          disabled={actionLoading[req._id]}
                          onClick={() => handleCancelRequest(req._id)}
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ADD FRIEND SEARCH */}
          {activeTab === 'add' && (
            <div className="add-friend-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search user by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-user-input"
                  autoFocus
                />
              </div>

              {loading ? (
                <div className="loading-state">
                  <span className="spinner" /> Searching users...
                </div>
              ) : (
                <div className="search-results-list">
                  {searchResults.map((user) => (
                    <div key={user._id} className="user-search-card">
                      <div className="user-search-info">
                        <div
                          className="user-search-avatar"
                          style={{
                            backgroundColor: `hsl(${user.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                          }}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="user-search-name">{user.username}</span>
                      </div>

                      <div className="user-search-action">
                        {user.friendshipStatus === 'friend' && (
                          <span className="badge-friend">✓ Friends</span>
                        )}
                        {user.friendshipStatus === 'request_sent' && (
                          <button
                            className="btn-secondary btn-sm"
                            disabled={actionLoading[user.requestId]}
                            onClick={() => handleCancelRequest(user.requestId)}
                          >
                            Cancel Request
                          </button>
                        )}
                        {user.friendshipStatus === 'request_received' && (
                          <button
                            className="btn-primary btn-sm"
                            disabled={actionLoading[user.requestId]}
                            onClick={() => handleAcceptRequest(user.requestId)}
                          >
                            Accept Request
                          </button>
                        )}
                        {user.friendshipStatus === 'none' && (
                          <button
                            className="btn-primary btn-sm"
                            disabled={actionLoading[user._id]}
                            onClick={() => handleSendRequest(user._id)}
                          >
                            + Add Friend
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {searchResults.length === 0 && !loading && (
                    <div className="empty-friends-state">
                      <p>Type a username to find other registered users and send friend requests.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
