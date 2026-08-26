import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { JoinRoomResponseDto } from '@ai-interview/contracts';
import { AiCoPilotHintPanel } from './components/AiCoPilotHintPanel';
import { ScoreOverrideModal } from './components/ScoreOverrideModal';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Sparkles,
  MessageSquare,
  FileText,
  ShieldAlert,
  Play,
  Send,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';

export const MentorLiveRoom: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'copilot' | 'chat' | 'notes'>('copilot');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [mentorNotes, setMentorNotes] = useState('');
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: string; text: string; time: string }>
  >([
    {
      sender: 'System',
      text: 'Live Session room connected via WebRTC Mock Provider.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);

  // 1. Join live session and get room token
  const { data: roomInfo, isLoading } = useQuery<JoinRoomResponseDto>({
    queryKey: ['live-room', sessionId],
    queryFn: async () => {
      const res = await apiClient.post<JoinRoomResponseDto>(`/sessions/${sessionId}/join`);
      return res.data;
    },
    enabled: !!sessionId,
  });

  // 2. Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/sessions/${sessionId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-room', sessionId] });
    },
  });

  // 3. End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/sessions/${sessionId}/end`);
    },
    onSuccess: () => {
      navigate('/mentors');
    },
  });

  // 4. Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/sessions/${sessionId}/notes`, { notes: mentorNotes });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      {
        sender: roomInfo?.role === 'MENTOR' ? 'Mentor' : 'Candidate',
        text: chatInput,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  const handleInsertHint = (hintText: string) => {
    setChatInput(hintText);
    setActiveTab('chat');
  };

  if (isLoading) {
    return (
      <div
        className="h-[calc(100vh-4rem)] bg-slate-900 flex items-center justify-center text-white"
        data-testid="live-room-loading"
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium">Connecting to ephemeral live interview room...</p>
        </div>
      </div>
    );
  }

  const isMentor = roomInfo?.role === 'MENTOR';

  return (
    <div
      className="h-[calc(100vh-4rem)] bg-slate-950 flex flex-col md:flex-row overflow-hidden"
      data-testid="mentor-live-room"
    >
      {/* Left: Video Call Stage & Controls */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
        {/* Top Room Bar */}
        <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl px-5 py-3 text-white mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            <div>
              <h2 className="font-bold text-sm">{roomInfo?.roomName || 'Mock Interview Room'}</h2>
              <p className="text-xs text-slate-400">
                Connected as <strong className="text-emerald-400">{roomInfo?.role}</strong> (
                {roomInfo?.participantName})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isMentor && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => startSessionMutation.mutate()}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                data-testid="start-session-btn"
              >
                <Play className="h-3.5 w-3.5" /> Start Recording
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={() => (isMentor ? endSessionMutation.mutate() : navigate('/mentors'))}
              className="gap-1.5 text-xs"
              data-testid="end-session-btn"
            >
              <PhoneOff className="h-3.5 w-3.5" /> {isMentor ? 'Complete Session' : 'Leave Room'}
            </Button>
          </div>
        </div>

        {/* Video Viewports Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          {/* Main Candidate Stage */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 relative flex items-center justify-center overflow-hidden shadow-inner">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-3xl font-bold shadow-xl mx-auto mb-3">
                C
              </div>
              <p className="text-white font-bold text-base">Candidate Stream</p>
              <span className="text-xs text-emerald-400 font-medium">
                Video active (WebRTC Mock)
              </span>
            </div>
            <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-xl text-xs text-white border border-slate-700 font-medium">
              Candidate
            </div>
          </div>

          {/* Mentor Stage */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 relative flex items-center justify-center overflow-hidden shadow-inner">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-3xl font-bold shadow-xl mx-auto mb-3">
                M
              </div>
              <p className="text-white font-bold text-base">Mentor Stream</p>
              <span className="text-xs text-purple-400 font-medium">Video active</span>
            </div>
            <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-xl text-xs text-white border border-slate-700 font-medium">
              Mentor (You)
            </div>
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3.5 rounded-2xl transition-all ${
              isMuted
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
            }`}
            data-testid="mute-btn"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-3.5 rounded-2xl transition-all ${
              !isVideoOn
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
            }`}
            data-testid="video-toggle-btn"
          >
            {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Right Sidebar: AI Co-Pilot / Chat / Notes */}
      <div className="w-full md:w-96 bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('copilot')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'copilot'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-copilot"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Co-Pilot
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'chat'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            data-testid="tab-chat"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </button>

          {isMentor && (
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'notes'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              data-testid="tab-notes"
            >
              <FileText className="h-3.5 w-3.5" /> Notes
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'copilot' && (
            <AiCoPilotHintPanel sessionId={sessionId || ''} onSelectHint={handleInsertHint} />
          )}

          {activeTab === 'chat' && (
            <div className="flex flex-col h-full p-4 justify-between" data-testid="chat-panel">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl text-xs ${
                      msg.sender === 'Mentor'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-950 ml-6'
                        : msg.sender === 'Candidate'
                          ? 'bg-slate-100 text-slate-900 mr-6'
                          : 'bg-slate-50 text-slate-500 text-center text-[11px]'
                    }`}
                  >
                    <div className="flex justify-between font-bold mb-1">
                      <span>{msg.sender}</span>
                      <span className="text-[10px] opacity-70 font-normal">{msg.time}</span>
                    </div>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message or probing question..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-emerald-500 focus:border-emerald-500"
                  data-testid="chat-input"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="px-3"
                  data-testid="send-chat-btn"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}

          {activeTab === 'notes' && (
            <div
              className="p-4 space-y-4 h-full flex flex-col justify-between"
              data-testid="notes-panel"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mentor Private Notes
                  </h4>
                  <span className="text-[10px] text-slate-400">Auto-saved to session audit</span>
                </div>

                <Textarea
                  rows={8}
                  value={mentorNotes}
                  onChange={e => setMentorNotes(e.target.value)}
                  placeholder="Record candidate strengths, architectural design decisions, and areas for improvement..."
                  className="text-xs font-mono"
                  data-testid="mentor-notes-textarea"
                />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveNotesMutation.mutate()}
                  disabled={saveNotesMutation.isPending}
                  className="w-full text-xs"
                >
                  {saveNotesMutation.isPending ? 'Saving...' : 'Save Private Notes'}
                </Button>
              </div>

              {/* Score Override Action */}
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Human Evaluation Moderation
                </div>
                <p className="text-slate-600">
                  Did the candidate clarify a key insight during live discussion? You can adjust the
                  AI evaluation score.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsOverrideModalOpen(true)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1"
                  data-testid="open-override-btn"
                >
                  <ShieldAlert className="h-3.5 w-3.5" /> Override AI Score
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score Override Modal */}
      <ScoreOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        evaluationId={sessionId || ''}
        originalScore={7.0}
      />
    </div>
  );
};
