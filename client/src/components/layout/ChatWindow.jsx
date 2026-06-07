/**
 * CHAT WINDOW COMPONENT
 * =====================
 * The main chat area — header, messages, and input.
 * 
 * This component composes MessageList, MessageInput, TypingIndicator,
 * and UserList into a cohesive chat interface.
 * 
 * COMPOSITION PATTERN:
 * Instead of one massive component, we break it into focused pieces:
 * - ChatWindow (layout) → MessageList (display) → MessageBubble (single message)
 * Each component has a single responsibility.
 */

import { useState } from 'react';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import TypingIndicator from '../chat/TypingIndicator';
import UserList from '../chat/UserList';

export default function ChatWindow({
  room,
  messages,
  typingUsers,
  onLoadMore,
  hasMore,
  loadingMore,
  onReact,
  onReply,
  replyTo,
  onCancelReply,
  onSearch,
}) {
  const [showMembers, setShowMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  if (!room) {
    return (
      <main className="chat-window chat-window-empty">
        <div className="empty-state">
          <div className="empty-state-icon">💬</div>
          <h2>Welcome to ChatApp</h2>
          <p>Select a channel or start a conversation</p>
        </div>
      </main>
    );
  }

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch && onSearch(searchQuery.trim());
    }
  };

  return (
    <main className="chat-window">
      {/* Chat header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h2 className="chat-room-name">
            {room.isPrivate ? '' : '# '}
            {room.name}
          </h2>
          <span className="chat-member-count">
            {room.members?.length || 0} members
          </span>
        </div>

        <div className="chat-header-actions">
          {/* Search button */}
          <button
            className="header-action-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="Search messages"
            id="toggle-search"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M7.5 1.5a6 6 0 014.243 10.243l3.757 3.757a.75.75 0 01-1.06 1.06l-3.757-3.757A6 6 0 117.5 1.5zm0 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"/>
            </svg>
          </button>

          {/* Members toggle */}
          <button
            className={`header-action-btn ${showMembers ? 'active' : ''}`}
            onClick={() => setShowMembers(!showMembers)}
            title="Toggle members"
            id="toggle-members"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M9 4a3 3 0 100 6 3 3 0 000-6zM5 7a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zM9 12c-3 0-6 1.5-6 3v1h12v-1c0-1.5-3-3-6-3z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="chat-search-bar">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search messages in this room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="chat-search-input"
              id="message-search-input"
            />
            <button type="submit" className="btn-primary btn-sm" id="message-search-btn">
              Search
            </button>
          </form>
        </div>
      )}

      {/* Main content area */}
      <div className="chat-body">
        <div className="chat-messages-area">
          <MessageList
            messages={messages}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onReact={onReact}
            onReply={onReply}
          />

          <TypingIndicator typingUsers={typingUsers} />

          <MessageInput
            roomId={room._id}
            replyTo={replyTo}
            onCancelReply={onCancelReply}
          />
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="chat-members-panel">
            <UserList members={room.members || []} />
          </div>
        )}
      </div>
    </main>
  );
}
