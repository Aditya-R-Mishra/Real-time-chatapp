/**
 * CREATE GROUP MODAL COMPONENT
 * =============================
 * Allows a user to create a private group with multiple selected friends.
 */

import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function CreateGroupModal({ isOpen, onClose, onCreateGroup }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchFriends = async () => {
        setLoading(true);
        try {
          const { data } = await api.get('/friends');
          setFriends(data || []);
        } catch (err) {
          console.error('Failed to load friends for group creation:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchFriends();
      setName('');
      setDescription('');
      setSelectedMemberIds([]);
      setSearch('');
    }
  }, [isOpen]);

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedMemberIds.length === 0) {
      alert('Please select at least one friend to add to the group');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedMemberIds,
      });
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredFriends = friends.filter((f) =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal create-group-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <h2>👥 Create New Group</h2>
            <button className="modal-close-icon" onClick={onClose}>✕</button>
          </div>
          <p className="modal-subtitle">
            Create a private group chat with multiple friends.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="create-group-form">
          <div className="form-group">
            <label htmlFor="group-name">Group Name *</label>
            <input
              id="group-name"
              type="text"
              placeholder="e.g. Project Devs, Gaming Crew, Study Group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-desc">Description (Optional)</label>
            <input
              id="group-desc"
              type="text"
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>
              Select Friends ({selectedMemberIds.length} selected)
            </label>

            <input
              type="text"
              placeholder="Filter friends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-friends-input"
            />

            <div className="group-members-select-list">
              {loading ? (
                <div className="loading-state">
                  <span className="spinner" /> Loading friends...
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="empty-friends-state" style={{ padding: '16px' }}>
                  <p>
                    {friends.length === 0
                      ? 'You have no friends yet. Add friends first to create a group!'
                      : 'No friends match your search.'}
                  </p>
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedMemberIds.includes(friend._id);
                  return (
                    <div
                      key={friend._id}
                      className={`member-select-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleMember(friend._id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="member-checkbox"
                      />
                      <div
                        className="member-avatar"
                        style={{
                          backgroundColor: `hsl(${friend.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`,
                        }}
                      >
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="member-name">{friend.username}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !name.trim() || selectedMemberIds.length === 0}
            >
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
