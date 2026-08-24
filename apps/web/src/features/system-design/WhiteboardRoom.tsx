import { useState, useRef, useEffect } from 'react';
import { useSystemDesign } from './useSystemDesign';
import { ComponentPalette, SystemComponentItem } from './ComponentPalette';
import { DesignFeedbackPanel } from './DesignFeedbackPanel';
import { CanvasTimelapse } from './CanvasTimelapse';
import { DesignEvaluationReport } from './DesignEvaluationReport';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  Pen,
  Square,
  ArrowRight,
  Camera,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface CanvasElement {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface WhiteboardRoomProps {
  interviewId: string;
  onCompleteSession?: () => void;
}

export function WhiteboardRoom({ interviewId, onCompleteSession }: WhiteboardRoomProps) {
  const {
    session,
    isLoadingSession,
    snapshots,
    activeSnapshotIdx,
    setActiveSnapshotIdx,
    saveSnapshot,
    isSavingSnapshot,
    analyzeCanvas,
    isAnalyzing,
    analysisResult,
    evaluateDesign,
    isEvaluating,
    evaluation,
  } = useSystemDesign(interviewId);

  const [tool, setTool] = useState<'select' | 'pen' | 'rect' | 'arrow' | 'text'>('select');
  const [elements, setElements] = useState<CanvasElement[]>([
    {
      id: 'init-client',
      type: 'CLIENT',
      label: 'Client (Web/Mobile)',
      x: 40,
      y: 120,
      width: 140,
      height: 48,
      color: '#4f46e5',
    },
    {
      id: 'init-gw',
      type: 'API_GATEWAY',
      label: 'API Gateway',
      x: 230,
      y: 120,
      width: 130,
      height: 48,
      color: '#9333ea',
    },
    {
      id: 'init-app',
      type: 'MICROSERVICE',
      label: 'URL Shortener Service',
      x: 410,
      y: 120,
      width: 160,
      height: 48,
      color: '#d97706',
    },
  ]);

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAddComponent = (comp: SystemComponentItem) => {
    const newElement: CanvasElement = {
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: comp.type,
      label: comp.defaultLabel,
      x: 100 + Math.random() * 200,
      y: 80 + Math.random() * 150,
      width: 150,
      height: 48,
      color: '#0f766e',
    };
    setElements(prev => [...prev, newElement]);
  };

  const handleSaveSnapshot = async () => {
    const snapshotUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23f8fafc"/></svg>`;
    await saveSnapshot({
      imageUrl: snapshotUrl,
      canvasStateJson: { elements },
      elapsedSeconds,
    });
  };

  const handleTriggerAnalysis = async () => {
    const snapshotUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="%23f8fafc"/></svg>`;
    await analyzeCanvas({
      imageUrl: snapshotUrl,
      canvasStateJson: { elements },
    });
  };

  const handleEvaluate = async () => {
    await handleSaveSnapshot();
    await evaluateDesign();
    if (onCompleteSession) onCompleteSession();
  };

  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3" data-testid="whiteboard-loading">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Initializing system design whiteboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whiteboard-room">
      {/* Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
            Interactive Whiteboard Canvas
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            {session?.initialPrompt || 'Distributed System Design Workspace'}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveSnapshot}
            isLoading={isSavingSnapshot}
            className="gap-1.5 text-xs h-8"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Save Snapshot</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleEvaluate}
            isLoading={isEvaluating}
            className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Submit Design</span>
          </Button>
        </div>
      </div>

      {/* Main Workspace Split-Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Canvas + Toolbars (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Canvas Toolbar */}
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  tool === 'select' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Select & Move"
              >
                <span>Select</span>
              </button>

              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  tool === 'pen' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Freehand Draw"
              >
                <Pen className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setTool('arrow')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  tool === 'arrow' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Connector Arrow"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setTool('rect')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  tool === 'rect' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Boundary Box"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setElements([])}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1"
                title="Clear All"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Interactive Whiteboard Canvas Area */}
          <div
            ref={canvasRef}
            data-testid="whiteboard-canvas-area"
            className="relative w-full h-[480px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden shadow-inner select-none p-4"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* SVG Connector Lines between components */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {elements.length > 1 &&
                elements.slice(0, elements.length - 1).map((el, i) => {
                  const next = elements[i + 1];
                  return (
                    <line
                      key={`conn-${i}`}
                      x1={el.x + el.width / 2}
                      y1={el.y + el.height / 2}
                      x2={next.x + next.width / 2}
                      y2={next.y + next.height / 2}
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                  );
                })}
            </svg>

            {/* Placed Elements */}
            {elements.map(el => (
              <div
                key={el.id}
                onClick={() => setSelectedElementId(el.id)}
                className={`absolute p-2.5 rounded-xl border bg-white shadow-sm flex items-center gap-2 cursor-move transition-all ${
                  selectedElementId === el.id
                    ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
                style={{
                  left: `${el.x}px`,
                  top: `${el.y}px`,
                  width: `${el.width}px`,
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: el.color }}
                />
                <span className="text-xs font-bold text-slate-800 truncate">{el.label}</span>
              </div>
            ))}
          </div>

          {/* Time-Lapse Slider */}
          <CanvasTimelapse
            snapshots={snapshots}
            activeIdx={activeSnapshotIdx}
            onSelectSnapshot={setActiveSnapshotIdx}
          />
        </div>

        {/* Right Column: Palette & Feedback Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <ComponentPalette onAddComponent={handleAddComponent} />

          <DesignFeedbackPanel
            analysis={analysisResult}
            isAnalyzing={isAnalyzing}
            onTriggerAnalysis={handleTriggerAnalysis}
          />
        </div>
      </div>

      {/* Evaluation Results Report Section */}
      {evaluation && (
        <div className="mt-8 pt-4">
          <DesignEvaluationReport evaluation={evaluation} />
        </div>
      )}
    </div>
  );
}
