import React, { useState } from 'react';

export interface CopilotChatMessage {
  id: string;
  sender: 'USER' | 'COPILOT';
  text: string;
  timestamp: string;
}

interface ArenaCopilotChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAskCopilot: (question: string) => Promise<{ answer: string; mode: string } | undefined>;
  isAsking: boolean;
}

export const ArenaCopilotChatPanel: React.FC<ArenaCopilotChatPanelProps> = ({
  isOpen,
  onClose,
  onAskCopilot,
  isAsking,
}) => {
  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      id: 'init-1',
      sender: 'COPILOT',
      text: 'Hello! I am your AI Engineering Copilot. Ask me for conceptual hints, error explanations, or architectural guidance for this repository challenge.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!inputQuery.trim() || isAsking) return;

    const userMsg: CopilotChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'USER',
      text: inputQuery.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const queryToSend = inputQuery;
    setInputQuery('');

    try {
      const response = await onAskCopilot(queryToSend);
      if (response) {
        const copilotMsg: CopilotChatMessage = {
          id: `msg-resp-${Date.now()}`,
          sender: 'COPILOT',
          text: response.answer,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, copilotMsg]);
      }
    } catch (err: any) {
      const errorMsg: CopilotChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'COPILOT',
        text: 'Sorry, I encountered an issue retrieving guidance. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <div
      role="complementary"
      aria-label="AI Copilot Chat Panel"
      className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col h-full shadow-2xl z-20"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">AI Copilot</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close AI Copilot"
          className="text-slate-400 hover:text-white text-sm p-1 rounded"
        >
          ✕
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-sans text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl max-w-[90%] ${
              m.sender === 'USER'
                ? 'ml-auto bg-primary-600 text-white rounded-br-none'
                : 'mr-auto bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
            }`}
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}
        {isAsking && (
          <div className="mr-auto bg-slate-900 border border-slate-800 p-3 rounded-xl rounded-bl-none text-slate-400 italic">
            Analyzing repository context & generating guidance...
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950 flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setInputQuery('Explain the failure cause of the latest test run.');
          }}
          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-800"
        >
          💡 Explain failure
        </button>
        <button
          onClick={() => {
            setInputQuery('Give me a architectural hint for resource scoping.');
          }}
          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-800"
        >
          🔍 Request hint
        </button>
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Copilot..."
          disabled={isAsking}
          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          onClick={handleSend}
          disabled={isAsking || !inputQuery.trim()}
          className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
};
