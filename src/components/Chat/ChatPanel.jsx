import React, { memo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import useUiStore from '../../store/uiStore';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';

/**
 * RailSentinel Copilot AI Assistant
 * Cursor/Perplexity style floating terminal.
 */
export default memo(function ChatPanel({
  messages = [],
  isTyping = false,
  onSend = null,
  onClose = null,
}) {
  const closeAiAssistant = useUiStore((s) => s.closeAiAssistant);
  const [pendingPrompt, setPendingPrompt] = useState('');

  const handleSend = useCallback((text) => {
    if (!text?.trim()) return;
    if (typeof onSend === 'function') {
      onSend(text);
    }
    setPendingPrompt('');
  }, [onSend]);

  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') onClose();
    else closeAiAssistant();
  }, [onClose, closeAiAssistant]);

  return (
    <motion.div 
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex flex-col h-full w-full bg-[#020617]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-hidden font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#020617]">
        <div className="flex items-center gap-3">
           <div className="w-5 h-5 rounded flex items-center justify-center bg-brand-primary/20 border border-brand-primary/50 text-brand-primary">
             <span className="text-[10px] font-black">AI</span>
           </div>
           <div className="flex flex-col">
             <span className="text-xs font-bold text-white tracking-wide">Sentinel Copilot</span>
             <span className="text-[9px] text-brand-primary font-mono uppercase tracking-widest">v4.2 GPT-4o</span>
           </div>
        </div>
        <button 
          onClick={handleClose}
          className="text-text-tertiary hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-hide">
         {messages.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <div className="text-4xl">⌘</div>
              <div className="text-xs font-mono text-text-secondary max-w-[250px]">
                I'm RailSentinel Copilot. Ask me to analyze incidents, reroute trains, or predict network failures.
              </div>
           </div>
         ) : (
           <ChatMessageList messages={messages} isTyping={isTyping} />
         )}
         {isTyping && (
           <motion.div 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }}
             className="flex items-center gap-2 text-xs text-text-tertiary font-mono"
           >
             <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
             Synthesizing response...
           </motion.div>
         )}
      </div>

      {/* Input */}
      <div className="p-4 bg-gradient-to-t from-[#020617] to-transparent">
        <div className="relative rounded-xl border border-white/10 bg-white/5 backdrop-blur-md focus-within:border-brand-primary/50 focus-within:bg-white/10 transition-colors shadow-lg overflow-hidden">
           <ChatInput 
             onSend={handleSend}
             isTyping={isTyping}
           />
           <div className="flex items-center justify-between px-3 py-2 border-t border-white/5 bg-black/20">
             <div className="flex gap-2">
               <button className="text-[10px] flex items-center gap-1 font-mono text-text-tertiary hover:text-white transition-colors">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                 Context
               </button>
             </div>
             <span className="text-[9px] font-mono text-text-tertiary uppercase tracking-widest">
               Return ↵
             </span>
           </div>
        </div>
      </div>
    </motion.div>
  );
});
