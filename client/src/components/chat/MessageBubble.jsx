/**
 * MESSAGE BUBBLE COMPONENT
 * ========================
 * Renders a single chat message with its metadata.
 * 
 * WHY A SEPARATE COMPONENT?
 * Each message has a lot of sub-features:
 * - Different styling for own messages vs others
 * - Avatar display
 * - Timestamp formatting
 * - File/image attachments
 * - Emoji reactions
 * - Reply references
 * - Read receipts
 * 
 * Keeping this as a separate component makes MessageList clean
 * and makes each message independently re-renderable.
 */

import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import ReactionPicker from './ReactionPicker';

export default function MessageBubble({ message, onReact, onReply }) {
  const { user } = useAuth();
  const [showReactions, setShowReactions] = useState(false);
  const bubbleRef = useRef(null);

  const isOwn = message.senderId?._id === user?._id;
  const sender = message.senderId;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get initials for avatar fallback
  const initials = sender?.username
    ? sender.username.charAt(0).toUpperCase()
    : '?';

  // Generate a consistent color from username
  const avatarColor = sender?.username
    ? `hsl(${sender.username.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`
    : '#6366f1';

  // Collect reactions into an array of { emoji, count, usernames, hasReacted }
  const reactionList = [];
  if (message.reactions) {
    const reactionsObj = message.reactions instanceof Map
      ? Object.fromEntries(message.reactions)
      : message.reactions;

    for (const [emoji, userIds] of Object.entries(reactionsObj)) {
      if (Array.isArray(userIds) && userIds.length > 0) {
        reactionList.push({
          emoji,
          count: userIds.length,
          hasReacted: userIds.includes(user?._id),
        });
      }
    }
  }

  return (
    <div
      ref={bubbleRef}
      className={`message-bubble ${isOwn ? 'message-own' : 'message-other'}`}
      data-message-id={message._id}
    >
      {/* Avatar — only for other people's messages */}
      {!isOwn && (
        <div className="message-avatar" style={{ backgroundColor: avatarColor }}>
          {sender?.avatar ? (
            <img src={sender.avatar} alt={sender.username} />
          ) : (
            initials
          )}
        </div>
      )}

      <div className="message-content-wrapper">
        {/* Username + timestamp header */}
        {!isOwn && (
          <div className="message-header">
            <span className="message-sender">{sender?.username || 'Unknown'}</span>
            <span className="message-time">{time}</span>
          </div>
        )}

        {/* Reply reference */}
        {message.parentMessageId && (
          <div className="message-reply-ref">
            <div className="reply-bar" />
            <span className="reply-text">
              {message.parentMessageId?.content
                ? message.parentMessageId.content.substring(0, 80) + (message.parentMessageId.content.length > 80 ? '...' : '')
                : 'Original message'}
            </span>
          </div>
        )}

        {/* Message content */}
        <div className="message-body">
          {message.content && <p>{message.content}</p>}

          {/* File attachment */}
          {message.fileUrl && (
            <div className="message-attachment">
              {message.fileType?.startsWith('image/') ? (
                <img src={message.fileUrl} alt="Attachment" className="message-image" loading="lazy" />
              ) : (
                <a href={message.fileUrl} target="_blank" rel="noopener noreferrer" className="message-file-link">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 1h5.586L14 5.414V14c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1zm5 1H4v12h9V6H9V2z"/>
                  </svg>
                  {message.fileName || 'Download file'}
                </a>
              )}
            </div>
          )}

          {/* Own message time */}
          {isOwn && <span className="message-time-inline">{time}</span>}
        </div>

        {/* Reactions */}
        {reactionList.length > 0 && (
          <div className="message-reactions">
            {reactionList.map(({ emoji, count, hasReacted }) => (
              <button
                key={emoji}
                className={`reaction-badge ${hasReacted ? 'reaction-active' : ''}`}
                onClick={() => onReact && onReact(message._id, emoji)}
                title={`${emoji} ${count}`}
              >
                {emoji} {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons (hover) */}
        <div className="message-actions">
          <button
            className="message-action-btn"
            onClick={() => setShowReactions(!showReactions)}
            title="React"
          >
            😀
          </button>
          <button
            className="message-action-btn"
            onClick={() => onReply && onReply(message)}
            title="Reply"
          >
            ↩
          </button>
        </div>

        {/* Reaction picker */}
        {showReactions && (
          <ReactionPicker
            onSelect={(emoji) => {
              onReact && onReact(message._id, emoji);
              setShowReactions(false);
            }}
            onClose={() => setShowReactions(false)}
          />
        )}
      </div>
    </div>
  );
}
