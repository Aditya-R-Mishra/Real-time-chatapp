/**
 * MESSAGE INPUT COMPONENT
 * =======================
 * Text input with send button, file upload, and typing indicator emission.
 * 
 * TYPING INDICATOR LOGIC:
 * We emit "typing" events to the socket, but we DEBOUNCE them:
 * - Start typing → emit "typing" (true)
 * - Stop typing for 2 seconds → emit "typing" (false)
 * This prevents flooding the socket with events on every keystroke.
 * 
 * FILE UPLOAD:
 * Uses a hidden <input type="file"> triggered by a button click.
 * Files are uploaded to Cloudinary via the /api/upload endpoint,
 * then the CDN URL is sent as part of the message.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

export default function MessageInput({ roomId, replyTo, onCancelReply }) {
  const { emit } = useSocket();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Focus input when room changes or reply is set
  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId, replyTo]);

  /**
   * TYPING INDICATOR — Debounced
   * On keystroke: emit typing=true, set a 2s timeout to emit typing=false
   * Each new keystroke resets the timeout
   */
  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing', { roomId, isTyping: true });
    }

    // Reset the "stop typing" timer
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing', { roomId, isTyping: false });
    }, 2000);
  }, [roomId, emit]);

  // Clear typing timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      if (isTypingRef.current) {
        emit('typing', { roomId, isTyping: false });
      }
    };
  }, [roomId, emit]);

  /**
   * SEND MESSAGE
   * Emits a socket event (not an HTTP request!) for real-time delivery.
   */
  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && !uploading) return;

    const messageData = {
      roomId,
      content: trimmed,
    };

    // If replying to a message, include the parent ID
    if (replyTo) {
      messageData.parentMessageId = replyTo._id;
    }

    emit('send_message', messageData);
    setContent('');
    onCancelReply && onCancelReply();

    // Stop typing indicator
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emit('typing', { roomId, isTyping: false });
    }
  };

  /**
   * FILE UPLOAD
   * 1. Upload file to Cloudinary via our API
   * 2. Send a message with the file URL
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Send the file as a message
      emit('send_message', {
        roomId,
        content: '',
        fileUrl: data.url,
        fileType: file.type,
        fileName: file.name,
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('File upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div className="message-input-container">
      {/* Reply preview */}
      {replyTo && (
        <div className="reply-preview">
          <div className="reply-preview-bar" />
          <div className="reply-preview-content">
            <span className="reply-preview-sender">
              Replying to {replyTo.senderId?.username || 'unknown'}
            </span>
            <span className="reply-preview-text">
              {replyTo.content?.substring(0, 60) || '📎 Attachment'}
            </span>
          </div>
          <button className="reply-preview-close" onClick={onCancelReply}>
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="message-input-form" id="message-form">
        {/* File upload button */}
        <label className="file-upload-btn" title="Attach file">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          {uploading ? (
            <span className="spinner spinner-sm" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V4a1 1 0 011-1z" />
            </svg>
          )}
        </label>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          className="message-text-input"
          placeholder="Type a message..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          id="message-input"
          autoComplete="off"
        />

        {/* Send button */}
        <button
          type="submit"
          className="send-btn"
          disabled={!content.trim() && !uploading}
          id="send-button"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.94 5.34l6.47 2.57a.5.5 0 010 .93L2.94 11.41a1 1 0 01-1.34-1.17l.72-3.6a.5.5 0 01.41-.41l.72-.14a1 1 0 01.49.25zM10 10l7.04-3.23a1 1 0 00-.02-1.82L3.53 1.13a1 1 0 00-1.36 1.18L3.64 8.5l-1.47 6.19a1 1 0 001.36 1.18l13.49-3.82a1 1 0 00.02-1.82L10 10z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
