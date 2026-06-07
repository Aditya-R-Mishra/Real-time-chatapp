/**
 * REACTION PICKER COMPONENT
 * =========================
 * A popup that lets users pick an emoji reaction for a message.
 * 
 * WHY EMOJI REACTIONS?
 * - Quick responses without typing
 * - Reduce noise (instead of "haha" messages, just react)
 * - Similar to Slack, Discord, iMessage
 * 
 * TOGGLE LOGIC:
 * Clicking an emoji you already reacted with removes your reaction.
 * This is handled server-side using array toggle logic.
 */

import { useEffect, useRef } from 'react';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

export default function ReactionPicker({ onSelect, onClose }) {
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="reaction-picker" ref={pickerRef}>
      {EMOJI_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          className="reaction-option"
          onClick={() => onSelect(emoji)}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
