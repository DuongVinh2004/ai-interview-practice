import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { MentorProfileDto, LiveSessionDto } from '@ai-interview/contracts';
import {
  Users,
  Star,
  Calendar,
  Clock,
  CheckCircle,
  Video,
  Search,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';
import { useNavigate } from 'react-router-dom';

export const MentorBookingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedExpertise, setSelectedExpertise] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedMentor, setSelectedMentor] = useState<MentorProfileDto | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [selectedTime, setSelectedTime] = useState<string>('14:00');
  const [bookedSession, setBookedSession] = useState<LiveSessionDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: mentors, isLoading } = useQuery<MentorProfileDto[]>({
    queryKey: ['mentors-list', selectedExpertise],
    queryFn: async () => {
      const endpoint = selectedExpertise
        ? `/mentor/list?expertise=${encodeURIComponent(selectedExpertise)}`
        : '/mentor/list';
      const res = await apiClient.get<MentorProfileDto[]>(endpoint);
      return res.data;
    },
  });

  const { data: mySessions } = useQuery<LiveSessionDto[]>({
    queryKey: ['my-live-sessions'],
    queryFn: async () => {
      const res = await apiClient.get<LiveSessionDto[]>('/sessions/my');
      return res.data;
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      const res = await apiClient.post<LiveSessionDto>('/sessions/book', {
        mentorId: selectedMentor?.id,
        scheduledAt,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-live-sessions'] });
      setBookedSession(data);
      setSelectedMentor(null);
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to book session');
    },
  });

  const filteredMentors = mentors?.filter((m) => {
    const matchesKeyword =
      !searchKeyword ||
      m.fullName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      m.expertiseAreas.some((e) => e.toLowerCase().includes(searchKeyword.toLowerCase()));
    return matchesKeyword;
  });

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" data-testid="mentor-booking-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Human-in-the-Loop
            </span>
            <span className="text-xs text-slate-400">Track F012</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Book 1-on-1 Mentor Mock Interviews
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect with seasoned tech leads & hiring managers powered by real-time AI Co-Pilot hints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/mentor/availability')} className="gap-1.5">
            <Clock className="h-4 w-4" /> Mentor Availability Settings
          </Button>
        </div>
      </div>

      {bookedSession && (
        <Alert variant="success" className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <span>
              Session successfully booked for{' '}
              <strong>{new Date(bookedSession.scheduledAt).toLocaleString()}</strong>!
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/mentors/room/${bookedSession.id}`)}
            className="gap-1.5 ml-4"
          >
            <Video className="h-4 w-4" /> Enter Live Room
          </Button>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {errorMessage}
        </Alert>
      )}

      {/* Upcoming Active Sessions */}
      {mySessions && mySessions.length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Video className="h-5 w-5 text-emerald-400" /> Your Scheduled Live Sessions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySessions.slice(0, 2).map((s) => (
              <div key={s.id} className="p-4 bg-white/10 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{s.status}</span>
                  <h4 className="font-bold text-base mt-1">{s.mentorName}</h4>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(s.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/mentors/room/${s.id}`)}
                  className="gap-1.5"
                  data-testid="join-live-room-btn"
                >
                  <Video className="h-4 w-4" /> Enter Room
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by mentor name, skill, or company..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-10"
            data-testid="mentor-search-input"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['', 'System Design', 'Backend Architecture', 'Concurrency'].map((exp) => (
            <button
              key={exp}
              onClick={() => setSelectedExpertise(exp)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                selectedExpertise === exp
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {exp || 'All Mentors'}
            </button>
          ))}
        </div>
      </div>

      {/* Mentor Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="mentor-grid">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse border border-slate-200" />
          ))
        ) : filteredMentors && filteredMentors.length > 0 ? (
          filteredMentors.map((mentor) => (
            <div
              key={mentor.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              data-testid="mentor-card"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl font-bold shadow-md">
                      {mentor.fullName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900">{mentor.fullName}</h3>
                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span>{mentor.rating > 0 ? mentor.rating.toFixed(1) : '5.0'}</span>
                        <span className="text-slate-400 font-normal">({mentor.totalSessions} sessions)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 mb-4">{mentor.bio || 'Verified Tech Mentor'}</p>

                {/* Expertise Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {mentor.expertiseAreas.map((area) => (
                    <span key={area} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                      {area}
                    </span>
                  ))}
                </div>

                {/* Availability Preview */}
                {mentor.availabilities && mentor.availabilities.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1 mb-4">
                    <span className="font-bold text-slate-700 block">Weekly Availability:</span>
                    {mentor.availabilities.slice(0, 2).map((slot, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{DAYS[slot.dayOfWeek]}</span>
                        <span className="font-semibold text-slate-800">{slot.startTime} - {slot.endTime}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedMentor(mentor)}
                className="w-full gap-2 mt-2"
                data-testid="book-slot-btn"
              >
                <Calendar className="h-4 w-4" /> Book Session
              </Button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            No mentors found matching your criteria.
          </div>
        )}
      </div>

      {/* Booking Slot Modal */}
      {selectedMentor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" data-testid="booking-modal">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Book Session with {selectedMentor.fullName}</h3>
                <p className="text-xs text-slate-500">Select date and time slot</p>
              </div>
              <button onClick={() => setSelectedMentor(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  data-testid="booking-date-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Time Slot</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-emerald-500 focus:border-emerald-500 font-semibold"
                  data-testid="booking-time-select"
                >
                  <option value="09:00">09:00 AM - 09:45 AM</option>
                  <option value="11:00">11:00 AM - 11:45 AM</option>
                  <option value="14:00">02:00 PM - 02:45 PM</option>
                  <option value="16:00">04:00 PM - 04:45 PM</option>
                  <option value="19:00">07:00 PM - 07:45 PM</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="ghost" size="md" onClick={() => setSelectedMentor(null)}>Cancel</Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                data-testid="confirm-booking-btn"
              >
                {bookMutation.isPending ? 'Confirming...' : 'Confirm Booking'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
