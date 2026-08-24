import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { TutorRatingButtons } from './TutorRatingButtons';
import { TutorRole } from '@ai-interview/contracts';

interface SocraticTutorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  turnNumber: number;
  questionContent: string;
  messages: any[];
  isStreaming: boolean;
  streamedContent: string;
  onSendMessage: (msg: string) => Promise<void>;
  onRate: (rating: 'UP' | 'DOWN', feedback?: string) => Promise<any>;
}

export const SocraticTutorDrawer: React.FC<SocraticTutorDrawerProps> = ({
  isOpen,
  onClose,
  turnNumber,
  questionContent,
  messages,
  isStreaming,
  streamedContent,
  onSendMessage,
  onRate,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamedContent]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isStreaming) return;
    const msg = inputText.trim();
    setInputText('');
    await onSendMessage(msg);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150" data-testid="socratic-tutor-drawer">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <span>AI Socratic Tutor</span>
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded font-bold">
                  Câu #{turnNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">Gợi mở & đào sâu kỹ năng tư duy phản biện</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Context Banner */}
        <div className="p-3 bg-indigo-50/50 border-b border-indigo-100 text-xs text-indigo-950 flex items-start space-x-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="line-clamp-2 font-medium">"{questionContent}"</p>
        </div>

        {/* Message History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => {
            const isTutor = msg.role === TutorRole.AI_TUTOR || msg.role === 'AI_TUTOR';
            return (
              <div
                key={msg.id || index}
                className={`flex items-start space-x-2.5 ${isTutor ? 'justify-start' : 'justify-end'}`}
              >
                {isTutor && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    isTutor
                      ? 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
                      : 'bg-primary-600 text-white rounded-tr-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Documentation References */}
                  {msg.references && Array.isArray(msg.references) && msg.references.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                        <BookOpen className="w-3 h-3 text-indigo-600" />
                        <span>Tài liệu tham khảo:</span>
                      </span>
                      {msg.references.map((ref: any, rIdx: number) => (
                        <a
                          key={rIdx}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-indigo-600 hover:underline font-medium truncate"
                        >
                          → {ref.title || ref.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {!isTutor && (
                  <div className="w-7 h-7 rounded-full bg-primary-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Streaming Bubble */}
          {isStreaming && (
            <div className="flex items-start space-x-2.5 justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none">
                <p className="whitespace-pre-wrap">{streamedContent || 'AI Tutor đang suy nghĩ...'}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Rating Footer */}
        <div className="px-4 py-1.5 border-t border-slate-100 bg-slate-50/50">
          <TutorRatingButtons onRate={onRate} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex items-center space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Hỏi AI Tutor thêm về khái niệm hoặc trường hợp biên..."
            disabled={isStreaming}
            className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50"
          />
          <Button
            type="submit"
            size="sm"
            data-testid="tutor-send-btn"
            disabled={!inputText.trim() || isStreaming}
            isLoading={isStreaming}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};
