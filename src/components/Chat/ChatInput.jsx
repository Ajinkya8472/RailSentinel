import React, { memo, useState, useRef, useId, useCallback, useEffect } from 'react';

export default memo(function ChatInput({
  onSend = () => {},
  disabled = false,
  isTyping = false,
  placeholder = 'Ask RailSentinel Copilot...',
  maxLength = 2000,
  initialValue = '',
}) {
  const inputId = useId();
  const textareaRef = useRef(null);
  const [value, setValue] = useState(initialValue);

  const isDisabled = disabled || isTyping;
  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isDisabled;

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [value]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, trimmed, onSend]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="relative flex flex-col w-full">
      <textarea
        id={inputId}
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isDisabled ? 'Synthesizing...' : placeholder}
        disabled={isDisabled}
        maxLength={maxLength}
        className="w-full bg-transparent text-white placeholder-text-tertiary text-sm px-4 py-3 border-none outline-none resize-none min-h-[44px] max-h-[150px] scrollbar-hide"
        aria-label="Message RailSentinel"
      />
      <div className="absolute right-2 bottom-2">
         <button
           type="button"
           disabled={!canSend}
           onClick={handleSend}
           className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
             canSend 
               ? 'bg-brand-primary text-white hover:bg-brand-primaryHover shadow-glow-brand' 
               : 'bg-white/5 text-text-tertiary cursor-not-allowed'
           }`}
         >
           {isTyping ? (
             <div className="w-1.5 h-1.5 bg-text-tertiary rounded-full animate-ping" />
           ) : (
             <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19V5m-7 7l7-7 7 7"></path>
             </svg>
           )}
         </button>
      </div>
    </div>
  );
});
