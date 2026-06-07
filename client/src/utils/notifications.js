/**
 * BROWSER NOTIFICATION UTILITIES
 * ==============================
 * Uses the Web Notifications API to show desktop notifications
 * when the user receives a message and the tab is not focused.
 * 
 * WHY BROWSER NOTIFICATIONS?
 * - Users often have many tabs open
 * - Without notifications, they'd miss messages
 * - The Notification API is built into all modern browsers
 * 
 * HOW IT WORKS:
 * 1. First, we request permission (user must click "Allow")
 * 2. We check if the tab is hidden (document.hidden)
 * 3. If hidden + new message → show notification
 * 4. Clicking notification focuses the tab
 * 
 * IMPORTANT:
 * - Notifications require HTTPS in production (localhost is exempt)
 * - Users can revoke permission in browser settings
 * - Some browsers block notifications entirely in incognito mode
 */

/**
 * Request permission to show browser notifications.
 * Call this once, e.g., after the user logs in.
 * Returns: 'granted', 'denied', or 'default'
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
};

/**
 * Show a browser notification for a new message.
 * Only shows if the tab is not focused (document.hidden === true).
 * 
 * @param {string} title - Notification title (e.g., "New message in #general")
 * @param {object} options - { body, icon, tag, data }
 *   - body: Message preview text
 *   - tag: Prevents duplicate notifications for the same room
 *   - data: Extra data passed to the click handler
 */
export const showMessageNotification = (title, options = {}) => {
  // Only show if tab is NOT focused
  if (!document.hidden) return;

  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body: options.body || '',
    icon: options.icon || '/favicon.ico',
    tag: options.tag || 'chat-message', // Same tag = replaces previous notification
    ...options,
  });

  // Click notification → focus the tab
  notification.onclick = () => {
    window.focus();
    notification.close();
    if (options.onClick) options.onClick();
  };

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

/**
 * Format a notification for a chat message.
 * Creates a user-friendly title and body.
 */
export const notifyNewMessage = (message, roomName) => {
  const senderName = message.senderId?.username || 'Someone';
  const title = `${senderName} in #${roomName}`;

  let body = message.content;
  if (message.fileUrl) {
    body = '📎 Sent a file';
  }
  if (body && body.length > 100) {
    body = body.substring(0, 97) + '...';
  }

  showMessageNotification(title, {
    body,
    tag: `room-${message.roomId}`, // One notification per room (replaces old)
  });
};
