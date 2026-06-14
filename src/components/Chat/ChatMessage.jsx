import React, { memo } from 'react';

export default memo(function ChatMessage({ message }) {
  if (!message) return null;

  const isUser = message.role === 'user';
  const hasError = message.isError || message.status === 'error';

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div 
        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-brand-primary text-white shadow-glow-brand rounded-br-sm' 
            : hasError 
              ? 'bg-semantic-error-bg/20 border border-semantic-error-border text-semantic-error-text rounded-bl-sm'
              : 'bg-white/5 border border-white/10 text-text-primary rounded-bl-sm'
        }`}
      >
        <div className={`text-sm ${isUser ? 'font-medium' : 'font-mono text-xs leading-relaxed'} whitespace-pre-wrap`}>
          {message.content}
        </div>
      </div>
      
      {/* Footer */}
      {!isUser && (
        <div className="flex items-center gap-2 px-1 opacity-50 hover:opacity-100 transition-opacity">
           <button className="text-[10px] bg-transparent border border-white/10 text-white rounded px-2 hover:bg-white/10">Copy</button>
           <button className="text-[10px] bg-transparent border border-white/10 text-white rounded px-2 hover:bg-white/10">Apply</button>
        </div>
      )}
    </div>
  );
});
