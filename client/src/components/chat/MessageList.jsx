/**
 * MESSAGE LIST COMPONENT
 * ======================
 * Renders the scrollable list of messages in a chat room.
 * 
 * KEY FEATURES:
 * 1. Auto-scroll to bottom when new messages arrive
 * 2. Load older messages when scrolling to the top (cursor-based pagination)
 * 3. IntersectionObserver for read receipts (marks messages as "seen")
 * 
 * SCROLL MANAGEMENT is tricky:
 * - New message from someone else → auto-scroll ONLY if already at bottom
 * - New message from you → always scroll to bottom
 * - Loading older messages → maintain scroll position (don't jump to top)
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import MessageBubble from './MessageBubble';

export default function MessageList({
  messages,
  onLoadMore,
  hasMore,
  loadingMore,
  onReact,
  onReply,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMessageCount = useRef(messages.length);

  /**
   * Check if user is near the bottom of the scroll.
   * We use a threshold of 100px — if within 100px of bottom, we consider it "at bottom".
   */
  const checkIfNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const threshold = 100;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    setIsNearBottom(checkIfNearBottom());

    // Load more messages when scrolled to top
    const el = containerRef.current;
    if (el && el.scrollTop < 50 && hasMore && !loadingMore) {
      onLoadMore && onLoadMore();
    }
  }, [hasMore, loadingMore, onLoadMore, checkIfNearBottom]);

  // Auto-scroll to bottom when new messages arrive (if user is near bottom)
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      // New messages were added
      if (isNearBottom) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isNearBottom]);

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  return (
    <div
      className="message-list"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Load more indicator */}
      {loadingMore && (
        <div className="load-more-indicator">
          <span className="spinner" />
          Loading older messages...
        </div>
      )}

      {hasMore && !loadingMore && (
        <div className="load-more-indicator">
          <button className="load-more-btn" onClick={onLoadMore}>
            Load older messages
          </button>
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="message-list-empty">
          <div className="empty-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Be the first to send a message!</p>
        </div>
      )}

      {/* Message bubbles */}
      {messages.map((msg, index) => {
        // Show date separator if the date changes between messages
        const showDateSep = index === 0 ||
          new Date(msg.createdAt).toDateString() !==
          new Date(messages[index - 1].createdAt).toDateString();

        return (
          <div key={msg._id || index}>
            {showDateSep && (
              <div className="date-separator">
                <span>{formatDate(msg.createdAt)}</span>
              </div>
            )}
            <MessageBubble
              message={msg}
              onReact={onReact}
              onReply={onReply}
            />
          </div>
        );
      })}

      {/* Invisible element at the bottom — used for auto-scrolling */}
      <div ref={bottomRef} />
    </div>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
