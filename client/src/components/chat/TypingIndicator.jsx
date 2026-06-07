/**
 * TYPING INDICATOR COMPONENT
 * ==========================
 * Shows "User is typing..." with an animated dots effect.
 * 
 * The typing state comes from socket events:
 * - "user_typing" event → add user to typing list
 * - Stop receiving → remove user after timeout
 * 
 * This is a "transient" state — it's never stored in the database.
 * It only exists in real-time while users are actively typing.
 */

export default function TypingIndicator({ typingUsers = [] }) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing`
        : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;

  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">{text}</span>
    </div>
  );
}
