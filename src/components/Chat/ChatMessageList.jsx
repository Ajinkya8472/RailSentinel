import React, { memo, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';

export default memo(function ChatMessageList({
  messages = [],
  isTyping = false,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  return (
    <div className="flex flex-col gap-6">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} className="h-1" aria-hidden="true" />
    </div>
  );
});
