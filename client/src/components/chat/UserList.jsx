/**
 * USER LIST COMPONENT
 * ===================
 * Shows online users in the current room.
 * 
 * The online status comes from the Socket.io "online_users" event,
 * which the server emits whenever someone connects or disconnects.
 * 
 * WHY SHOW ONLINE STATUS?
 * - Social proof: seeing others online encourages engagement
 * - Expectation setting: know if someone will respond quickly
 * - Community feel: the chat room feels alive
 */

import { useMemo } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function UserList({ members = [] }) {
  const { onlineUsers } = useSocket();
  const { user } = useAuth();

  // Split members into online and offline groups
  const { online, offline } = useMemo(() => {
    const onlineIds = new Set(onlineUsers.map((u) => u.userId || u._id));
    const online = [];
    const offline = [];

    members.forEach((member) => {
      const memberId = member._id || member;
      if (onlineIds.has(memberId)) {
        online.push(member);
      } else {
        offline.push(member);
      }
    });

    return { online, offline };
  }, [members, onlineUsers]);

  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : '?');

  const getColor = (name) =>
    name
      ? `hsl(${name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 70%, 60%)`
      : '#6366f1';

  const renderUser = (member, isOnline) => {
    const username = member?.username || 'Unknown';
    const isYou = member?._id === user?._id;

    return (
      <div key={member?._id || username} className="user-list-item">
        <div className="user-avatar-sm" style={{ backgroundColor: getColor(username) }}>
          {member?.avatar ? (
            <img src={member.avatar} alt={username} />
          ) : (
            getInitial(username)
          )}
          <span className={`status-dot ${isOnline ? 'status-online' : 'status-offline'}`} />
        </div>
        <span className="user-name">
          {username} {isYou && <span className="you-badge">(you)</span>}
        </span>
      </div>
    );
  };

  return (
    <div className="user-list">
      <div className="user-list-header">
        <h3>Members</h3>
        <span className="member-count">{members.length}</span>
      </div>

      {online.length > 0 && (
        <div className="user-group">
          <div className="user-group-label">
            Online — {online.length}
          </div>
          {online.map((m) => renderUser(m, true))}
        </div>
      )}

      {offline.length > 0 && (
        <div className="user-group">
          <div className="user-group-label">
            Offline — {offline.length}
          </div>
          {offline.map((m) => renderUser(m, false))}
        </div>
      )}

      {members.length === 0 && (
        <div className="user-list-empty">
          No members in this room
        </div>
      )}
    </div>
  );
}
