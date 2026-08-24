import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { MentorProfileDto, MentorAvailabilitySlotDto } from '@ai-interview/contracts';
import {
  Clock,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Alert } from '../../components/ui/Alert';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MentorAvailabilityPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [bio, setBio] = useState<string>('');
  const [expertise, setExpertise] = useState<string>('');
  const [slots, setSlots] = useState<MentorAvailabilitySlotDto[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: profile } = useQuery<MentorProfileDto>({
    queryKey: ['my-mentor-profile'],
    queryFn: async () => {
      const res = await apiClient.get<MentorProfileDto>('/mentor/profile/me');
      return res.data;
    },
  });

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setExpertise(profile.expertiseAreas ? profile.expertiseAreas.join(', ') : '');
      if (profile.availabilities) {
        setSlots(profile.availabilities);
      }
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const areas = expertise
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Save profile
      await apiClient.post('/mentor/profile', {
        expertiseAreas: areas.length > 0 ? areas : ['System Design', 'Backend Architecture'],
        bio,
      });

      // Save availability slots
      await apiClient.post('/mentor/availability', { slots });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-mentor-profile'] });
      setSaveSuccess(true);
      setErrorMessage(null);
      setTimeout(() => setSaveSuccess(false), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to save availability');
    },
  });

  const handleAddSlot = () => {
    setSlots((prev) => [
      ...prev,
      { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', isActive: true },
    ]);
  };

  const handleRemoveSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index: number, field: keyof MentorAvailabilitySlotDto, val: any) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: val } : slot)),
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" data-testid="mentor-availability-page">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900">Mentor Profile & Weekly Availability</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set up your mentor bio, target coaching domains, and recurring weekly time windows for candidate bookings.
        </p>
      </div>

      {saveSuccess && (
        <Alert variant="success" className="flex items-center gap-2">
          <Check className="h-4 w-4" /> Mentor schedule and profile saved successfully!
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {errorMessage}
        </Alert>
      )}

      {/* Mentor Bio & Expertise */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-emerald-600" /> Mentor Information
        </h2>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Expertise Areas (Comma-separated)
          </label>
          <Input
            type="text"
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            placeholder="e.g. System Design, Distributed Systems, High Concurrency, Java Core"
            data-testid="mentor-expertise-input"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Mentor Headline & Bio
          </label>
          <Textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Introduce your engineering experience, past companies, and how you mentor candidates..."
            data-testid="mentor-bio-input"
          />
        </div>
      </div>

      {/* Recurring Weekly Availability Slots */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" /> Recurring Weekly Availability Slots
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Define your recurring weekly hours</p>
          </div>

          <Button variant="outline" size="sm" onClick={handleAddSlot} className="gap-1.5" data-testid="add-slot-btn">
            <Plus className="h-4 w-4" /> Add Slot
          </Button>
        </div>

        <div className="space-y-3">
          {slots.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center italic">
              No availability slots configured yet. Click "Add Slot" to add available times.
            </p>
          ) : (
            slots.map((slot, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200"
                data-testid="slot-row"
              >
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) => handleSlotChange(index, 'dayOfWeek', parseInt(e.target.value, 10))}
                  className="w-full sm:w-44 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                >
                  {DAYS.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => handleSlotChange(index, 'startTime', e.target.value)}
                    className="w-full sm:w-32 text-center"
                  />
                  <span className="text-slate-400 text-xs font-bold">to</span>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => handleSlotChange(index, 'endTime', e.target.value)}
                    className="w-full sm:w-32 text-center"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:flex-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slot.isActive}
                      onChange={(e) => handleSlotChange(index, 'isActive', e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    Active
                  </label>

                  <button
                    onClick={() => handleRemoveSlot(index)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors"
                    title="Remove Slot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="save-availability-btn"
          >
            <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
};
