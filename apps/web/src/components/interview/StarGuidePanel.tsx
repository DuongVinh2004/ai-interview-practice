import React from 'react';
import { Compass, CheckCircle2 } from 'lucide-react';
import { Card } from '../ui/Card';

interface StarGuidePanelProps {
  currentStage?: 'situation' | 'task' | 'action' | 'result';
}

export const StarGuidePanel: React.FC<StarGuidePanelProps> = ({ currentStage }) => {
  const steps = [
    {
      key: 'situation',
      label: 'Situation (Bối cảnh)',
      desc: 'Set the scene: What was the project, company, challenge, or conflict?',
      color: 'border-amber-400 bg-amber-50 text-amber-900',
    },
    {
      key: 'task',
      label: 'Task (Nhiệm vụ)',
      desc: 'What was your specific responsibility, objective, or assignment?',
      color: 'border-sky-400 bg-sky-50 text-sky-900',
    },
    {
      key: 'action',
      label: 'Action (Hành động)',
      desc: 'What specific steps and technical initiatives did YOU personally take?',
      color: 'border-orange-400 bg-orange-50 text-orange-900',
    },
    {
      key: 'result',
      label: 'Result (Kết quả)',
      desc: 'What quantifiable outcome (metrics, percentages, learnings) resulted?',
      color: 'border-emerald-400 bg-emerald-50 text-emerald-900',
    },
  ];

  return (
    <Card className="border-indigo-100 bg-indigo-50/30 p-4" data-testid="star-guide-panel">
      <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm mb-3">
        <Compass className="w-4 h-4 text-indigo-600" />
        <span>STAR Storytelling Framework Guide</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {steps.map(step => {
          const isActive = currentStage === step.key;
          return (
            <div
              key={step.key}
              className={`p-2.5 rounded-lg border transition-all ${
                isActive ? 'ring-2 ring-indigo-500 shadow-sm' : ''
              } ${step.color}`}
            >
              <div className="font-semibold flex items-center justify-between mb-1">
                <span>{step.label}</span>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
              </div>
              <p className="text-[11px] opacity-90 leading-tight">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
