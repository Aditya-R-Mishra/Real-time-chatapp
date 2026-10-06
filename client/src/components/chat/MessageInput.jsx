/**
 * MESSAGE INPUT COMPONENT
 * =======================
 * Text input with send button, photo/video/file attachments, typing indicator.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

export default function MessageInput({ roomId, replyTo, onCancelReply }) {
  const { emit } = useSocket();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Focus input when room changes or reply is set
  useEffect(() => {
    inputRef.current?.focus();
  }, [roomId, replyTo]);

  /**
   * TYPING INDICATOR — Debounced
   */
  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing', { roomId, isTyping: true });
    }

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
   */
  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && !pendingAttachment) return;

    const messageData = {
      roomId,
      content: trimmed,
    };

    if (pendingAttachment) {
      messageData.fileUrl = pendingAttachment.url;
      messageData.fileType = pendingAttachment.mimetype || pendingAttachment.type;
      messageData.fileName = pendingAttachment.filename;
      messageData.type = pendingAttachment.type;
    }

    if (replyTo) {
      messageData.parentMessageId = replyTo._id;
    }

    emit('send_message', messageData);
    setContent('');
    setPendingAttachment(null);
    onCancelReply && onCancelReply();

    // Stop typing indicator
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emit('typing', { roomId, isTyping: false });
    }
  };

  /**
   * FILE / PHOTO / VIDEO UPLOAD
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be under 50MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPendingAttachment({
        url: data.url,
        type: data.type, // 'image' | 'video' | 'file'
        filename: data.filename || file.name,
        mimetype: file.type,
      });
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.error || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const isSendDisabled = (!content.trim() && !pendingAttachment) || uploading;

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

      {/* Pending Attachment preview */}
      {pendingAttachment && (
        <div className="attachment-preview-bar">
          <div className="attachment-preview-info">
            {pendingAttachment.type === 'image' && (
              <img src={pendingAttachment.url} alt="Preview" className="preview-thumb" />
            )}
            {pendingAttachment.type === 'video' && (
              <div className="preview-video-badge">🎥 Video</div>
            )}
            {pendingAttachment.type === 'file' && (
              <div className="preview-file-badge">📄 File</div>
            )}
            <span className="preview-name">{pendingAttachment.filename}</span>
          </div>
          <button
            className="attachment-remove-btn"
            onClick={() => setPendingAttachment(null)}
            title="Remove attachment"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="message-input-form" id="message-form">
        {/* Photo & Video / File upload button */}
        <label className="file-upload-btn" title="Send Photo, Video or Document">
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
          />
          {uploading ? (
            <span className="spinner spinner-sm" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-5 2.5 3L14 9l2 6z"/>
            </svg>
          )}
        </label>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          className="message-text-input"
          placeholder={pendingAttachment ? "Add a caption..." : "Type a message..."}
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
          disabled={isSendDisabled}
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
