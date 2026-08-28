import { useRef, useEffect, useState } from 'react';
import { useSystemDesign } from './useSystemDesign';
import { ComponentPalette, SystemComponentItem } from './ComponentPalette';
import { DesignFeedbackPanel } from './DesignFeedbackPanel';
import { CanvasTimelapse } from './CanvasTimelapse';
import { DesignEvaluationReport } from './DesignEvaluationReport';
import { VisualAnnotationOverlay } from '../../components/whiteboard/VisualAnnotationOverlay';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useWhiteboardStore, CanvasElement, CanvasConnector } from '../../stores/whiteboard.store';
import {
  Pen,
  Square,
  ArrowRight,
  Camera,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Download,
  Edit3,
  X,
  Link2,
  Info,
} from 'lucide-react';

const PALETTE_COLORS = [
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Rose', value: '#e11d48' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Teal', value: '#0f766e' },
  { label: 'Slate', value: '#475569' },
];

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
    exportDiagram,
  } = useSystemDesign(interviewId);

  const {
    elements,
    connectors,
    selectedElementId,
    tool,
    version,
    etag,
    isSyncing,
    syncConflict,
    setTool,
    setSelectedElementId,
    setInitialState,
    addElement,
    updateElement,
    moveElement,
    removeElement,
    addConnector,
    clearCanvas,
    setVersionAndEtag,
    setSyncConflict,
    scheduleDebouncedSync,
  } = useWhiteboardStore();

  const canvasRef = useRef<HTMLDivElement>(null);
  const elapsedSecondsRef = useRef(0);

  // Drag & Drop State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    elemX: number;
    elemY: number;
  } | null>(null);

  // Connector Creation State
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);

  // Freehand Pen Drawing State
  const [penStrokes, setPenStrokes] = useState<Array<{ id: string; color: string; d: string }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPenPathRef = useRef<string>('');
  const [currentPenDrawing, setCurrentPenDrawing] = useState<string>('');

  // Initial State Hydration from latest snapshot
  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (!hasHydratedRef.current && snapshots && snapshots.length > 0) {
      const latest = snapshots[snapshots.length - 1];
      const latestState = latest.canvasStateJson as any;
      if (latestState?.elements && Array.isArray(latestState.elements)) {
        setInitialState(
          latestState.elements,
          latestState.connectors || [],
          latestState.version || snapshots.length,
          latestState.etag || null,
        );
      }
      hasHydratedRef.current = true;
    }
  }, [snapshots, setInitialState]);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      elapsedSecondsRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard Delete / Backspace handler for selected component
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedElementId &&
        activeSnapshotIdx === null &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        removeElement(selectedElementId);
        triggerDebouncedSync();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, activeSnapshotIdx, removeElement]);

  const generateCanvasSvgDataUri = (elems: CanvasElement[], conns: CanvasConnector[]) => {
    const svgConnectors = conns
      .map(conn => {
        const fromEl = elems.find(e => e.id === conn.fromId);
        const toEl = elems.find(e => e.id === conn.toId);
        if (!fromEl || !toEl) return '';
        const x1 = fromEl.x + fromEl.width / 2;
        const y1 = fromEl.y + fromEl.height / 2;
        const x2 = toEl.x + toEl.width / 2;
        const y2 = toEl.y + toEl.height / 2;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4" />`;
      })
      .join('');

    const svgBoundaries = elems
      .filter(el => el.type === 'BOUNDARY_BOX' || el.properties?.isBoundary)
      .map(
        el =>
          `<g transform="translate(${el.x},${el.y})">` +
          `<rect width="${el.width}" height="${el.height}" rx="12" fill="${el.color}15" stroke="${el.color}" stroke-width="2" stroke-dasharray="6,4" />` +
          `<text x="12" y="24" fill="${el.color}" font-size="12" font-family="system-ui, sans-serif" font-weight="700">${el.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` +
          `</g>`,
      )
      .join('');

    const svgElements = elems
      .filter(el => el.type !== 'BOUNDARY_BOX' && !el.properties?.isBoundary)
      .map(
        el =>
          `<g transform="translate(${el.x},${el.y})">` +
          `<rect width="${el.width}" height="${el.height}" rx="8" fill="${el.color}" stroke="#0f172a" stroke-width="1.5" />` +
          `<text x="${el.width / 2}" y="${el.height / 2 + 5}" text-anchor="middle" fill="#ffffff" font-size="12" font-family="system-ui, sans-serif" font-weight="600">${el.label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>` +
          `</g>`,
      )
      .join('');

    const svgPenPaths = penStrokes
      .map(
        stroke =>
          `<path d="${stroke.d}" fill="none" stroke="${stroke.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`,
      )
      .join('');

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="100%" height="100%" fill="#f8fafc" /><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" />${svgBoundaries}${svgConnectors}${svgPenPaths}${svgElements}</svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  };

  const triggerDebouncedSync = () => {
    scheduleDebouncedSync(async payload => {
      const snapshotUrl = generateCanvasSvgDataUri(payload.elements, payload.connectors);
      const res = await saveSnapshot({
        imageUrl: snapshotUrl,
        canvasStateJson: {
          elements: payload.elements,
          connectors: payload.connectors,
        },
        elapsedSeconds: elapsedSecondsRef.current,
        expectedVersion: payload.version,
        ifMatchEtag: payload.etag || undefined,
      });
      return { version: res.version, etag: res.etag };
    });
  };

  const handleAddComponent = (comp: SystemComponentItem) => {
    if (activeSnapshotIdx !== null) setActiveSnapshotIdx(null);

    const canvasWidth = canvasRef.current?.clientWidth || 700;
    const canvasHeight = canvasRef.current?.clientHeight || 400;

    const newElement: CanvasElement = {
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: comp.type,
      label: comp.defaultLabel,
      x: Math.round(50 + Math.random() * Math.max(50, canvasWidth - 220)),
      y: Math.round(40 + Math.random() * Math.max(40, canvasHeight - 120)),
      width: 150,
      height: 48,
      color: '#0f766e',
      properties: { defaultType: comp.type },
    };
    addElement(newElement);
    setSelectedElementId(newElement.id);
    triggerDebouncedSync();
  };

  const handleSaveSnapshot = async () => {
    const snapshotUrl = generateCanvasSvgDataUri(elements, connectors);
    const res = await saveSnapshot({
      imageUrl: snapshotUrl,
      canvasStateJson: { elements, connectors },
      elapsedSeconds: elapsedSecondsRef.current,
      expectedVersion: version,
      ifMatchEtag: etag || undefined,
    });
    if (res?.version && res?.etag) {
      setVersionAndEtag(res.version, res.etag);
    }
  };

  const handleTriggerAnalysis = async () => {
    const snapshotUrl = generateCanvasSvgDataUri(elements, connectors);
    await analyzeCanvas({
      imageUrl: snapshotUrl,
      canvasStateJson: { elements, connectors },
    });
  };

  const handleEvaluate = async () => {
    await handleSaveSnapshot();
    await evaluateDesign();
    if (onCompleteSession) onCompleteSession();
  };

  const handleExport = async () => {
    try {
      const result = await exportDiagram('svg');
      if (result.svgContent) {
        const blob = new Blob([result.svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-design-${interviewId}-v${result.version}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setSyncConflict(err.message || 'Export failed');
    }
  };

  // Pointer Interaction Handlers
  const handleElementPointerDown = (e: React.PointerEvent, el: CanvasElement) => {
    if (isViewingHistory) return;

    if (tool === 'arrow') {
      e.stopPropagation();
      if (!arrowSourceId) {
        setArrowSourceId(el.id);
      } else if (arrowSourceId === el.id) {
        setArrowSourceId(null);
      } else {
        const exists = connectors.some(
          c =>
            (c.fromId === arrowSourceId && c.toId === el.id) ||
            (c.fromId === el.id && c.toId === arrowSourceId),
        );
        if (!exists) {
          const newConn: CanvasConnector = {
            id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            fromId: arrowSourceId,
            toId: el.id,
            protocol: 'HTTPS/REST',
            label: 'Connection',
          };
          addConnector(newConn);
          triggerDebouncedSync();
        }
        setArrowSourceId(null);
      }
      return;
    }

    // Select & Drag mode
    e.stopPropagation();
    setSelectedElementId(el.id);
    setDraggingId(el.id);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      elemX: el.x,
      elemY: el.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // pointer capture fallback
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (isViewingHistory) return;
    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const clickX = Math.round(e.clientX - canvasRect.left);
    const clickY = Math.round(e.clientY - canvasRect.top);

    if (tool === 'pen') {
      setIsDrawing(true);
      currentPenPathRef.current = `M ${clickX} ${clickY}`;
      setCurrentPenDrawing(currentPenPathRef.current);
    } else if (tool === 'rect') {
      const newBoundary: CanvasElement = {
        id: `boundary-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'BOUNDARY_BOX',
        label: 'VPC / Subnet Boundary',
        x: Math.max(10, clickX - 100),
        y: Math.max(10, clickY - 75),
        width: 250,
        height: 180,
        color: '#64748b',
        properties: { isBoundary: true },
      };
      addElement(newBoundary);
      setSelectedElementId(newBoundary.id);
      triggerDebouncedSync();
    } else if (tool === 'select') {
      setSelectedElementId(null);
      setArrowSourceId(null);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isViewingHistory) return;

    if (draggingId && dragStartRef.current && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      const currentEl = elements.find(el => el.id === draggingId);
      const elWidth = currentEl?.width || 150;
      const elHeight = currentEl?.height || 48;

      const rawX = dragStartRef.current.elemX + dx;
      const rawY = dragStartRef.current.elemY + dy;
      const clampedX = Math.max(10, Math.min(canvasRect.width - elWidth - 10, rawX));
      const clampedY = Math.max(10, Math.min(canvasRect.height - elHeight - 10, rawY));

      moveElement(draggingId, Math.round(clampedX), Math.round(clampedY));
    } else if (tool === 'pen' && isDrawing && currentPenPathRef.current && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x = Math.round(e.clientX - canvasRect.left);
      const y = Math.round(e.clientY - canvasRect.top);
      currentPenPathRef.current += ` L ${x} ${y}`;
      setCurrentPenDrawing(currentPenPathRef.current);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // pointer capture fallback
      }
      setDraggingId(null);
      dragStartRef.current = null;
      triggerDebouncedSync();
    }
    if (tool === 'pen' && isDrawing) {
      if (currentPenPathRef.current) {
        setPenStrokes(prev => [
          ...prev,
          { id: `stroke-${Date.now()}`, color: '#0f766e', d: currentPenPathRef.current },
        ]);
      }
      setIsDrawing(false);
      currentPenPathRef.current = '';
      setCurrentPenDrawing('');
    }
  };

  // Determine active elements and connectors to display
  const isViewingHistory = activeSnapshotIdx !== null && activeSnapshotIdx < snapshots.length;
  const historySnapshot = isViewingHistory ? snapshots[activeSnapshotIdx!] : null;
  const displayElements: CanvasElement[] = isViewingHistory
    ? historySnapshot?.canvasStateJson?.elements || []
    : elements;
  const displayConnectors: CanvasConnector[] = isViewingHistory
    ? historySnapshot?.canvasStateJson?.connectors || []
    : connectors;

  const selectedElement = elements.find(el => el.id === selectedElementId);

  if (isLoadingSession) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 gap-3"
        data-testid="whiteboard-loading"
      >
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Initializing system design whiteboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="whiteboard-room">
      {/* Concurrency Conflict Banner */}
      {syncConflict && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-amber-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>State Conflict:</strong> {syncConflict}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSyncConflict(null)}
            className="text-amber-900 underline hover:no-underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* History Replay Banner */}
      {isViewingHistory && (
        <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl flex items-center justify-between text-sky-900 text-xs">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              <strong>Viewing Historical Snapshot #{activeSnapshotIdx + 1}</strong> (Read-only
              mode).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSnapshotIdx(null)}
            className="px-2.5 py-1 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-all"
          >
            Return to Live Canvas
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              Interactive Whiteboard Canvas
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              v{version} {etag ? `(${etag.substring(0, 10)}...)` : ''}
            </span>
            {isSyncing && (
              <span className="text-[10px] text-sky-600 animate-pulse flex items-center gap-1">
                <Spinner size="sm" /> Syncing...
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            {session?.initialPrompt || 'Distributed System Design Workspace'}
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="gap-1.5 text-xs h-8 focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Export Diagram as SVG"
            aria-label="Xuất sơ đồ dưới dạng file SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveSnapshot}
            isLoading={isSavingSnapshot}
            disabled={isViewingHistory}
            className="gap-1.5 text-xs h-8 focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Lưu ảnh chụp trạng thái hiện tại"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Save Snapshot</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleEvaluate}
            isLoading={isEvaluating}
            className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Nộp bài thiết kế hệ thống"
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
          <div
            role="toolbar"
            aria-label="Thanh công cụ vẽ Canvas"
            className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-2"
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setTool('select');
                  setArrowSourceId(null);
                }}
                disabled={isViewingHistory}
                aria-label="Công cụ chọn và di chuyển"
                aria-pressed={tool === 'select'}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                  tool === 'select'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Select & Move (Click & Drag nodes)"
              >
                <span>Select & Move</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTool('arrow');
                  setSelectedElementId(null);
                }}
                disabled={isViewingHistory}
                aria-label="Công cụ vẽ mũi tên kết nối"
                aria-pressed={tool === 'arrow'}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                  tool === 'arrow'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Connector Arrow (Click source node then target node)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTool('rect');
                  setSelectedElementId(null);
                  setArrowSourceId(null);
                }}
                disabled={isViewingHistory}
                aria-label="Công cụ tạo hộp phân vùng"
                aria-pressed={tool === 'rect'}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                  tool === 'rect'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Boundary Box (Click canvas to place boundary)"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Boundary Box</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTool('pen');
                  setSelectedElementId(null);
                  setArrowSourceId(null);
                }}
                disabled={isViewingHistory}
                aria-label="Công cụ vẽ tự do"
                aria-pressed={tool === 'pen'}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                  tool === 'pen'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Freehand Draw"
              >
                <Pen className="w-3.5 h-3.5" />
                <span>Pen</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  clearCanvas();
                  setPenStrokes([]);
                  triggerDebouncedSync();
                }}
                disabled={isViewingHistory}
                aria-label="Xóa tất cả các phần tử trên canvas"
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                title="Clear All"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Mode Guidance Alert */}
          {tool === 'arrow' && !isViewingHistory && (
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
              <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {arrowSourceId
                  ? 'Source component selected! Click target component to complete connection.'
                  : 'Click first component to start connection.'}
              </span>
            </div>
          )}

          {/* Interactive Whiteboard Canvas Area */}
          <div
            ref={canvasRef}
            data-testid="whiteboard-canvas-area"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className={`relative w-full h-[480px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden shadow-inner select-none p-4 touch-none ${
              tool === 'pen'
                ? 'cursor-crosshair'
                : tool === 'arrow'
                  ? 'cursor-alias'
                  : tool === 'rect'
                    ? 'cursor-cell'
                    : 'cursor-default'
            }`}
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* SVG Connector Lines & Pen Paths */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {/* Boundary Boxes */}
              {displayElements
                .filter(el => el.type === 'BOUNDARY_BOX' || el.properties?.isBoundary)
                .map(el => (
                  <g key={el.id} transform={`translate(${el.x},${el.y})`}>
                    <rect
                      width={el.width}
                      height={el.height}
                      rx={12}
                      fill={`${el.color}15`}
                      stroke={el.color}
                      strokeWidth="2"
                      strokeDasharray="6,4"
                    />
                    <text
                      x="12"
                      y="22"
                      fill={el.color}
                      fontSize="11"
                      fontFamily="system-ui, sans-serif"
                      fontWeight="700"
                    >
                      {el.label}
                    </text>
                  </g>
                ))}

              {/* Freehand Pen Strokes */}
              {penStrokes.map(stroke => (
                <path
                  key={stroke.id}
                  d={stroke.d}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* In-progress drawing pen stroke */}
              {currentPenDrawing && (
                <path
                  d={currentPenDrawing}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Connector lines */}
              {displayConnectors.map(conn => {
                const fromEl = displayElements.find(e => e.id === conn.fromId);
                const toEl = displayElements.find(e => e.id === conn.toId);
                if (!fromEl || !toEl) return null;
                return (
                  <g key={conn.id}>
                    <line
                      x1={fromEl.x + fromEl.width / 2}
                      y1={fromEl.y + fromEl.height / 2}
                      x2={toEl.x + toEl.width / 2}
                      y2={toEl.y + toEl.height / 2}
                      stroke="#64748b"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />
                    {conn.label && (
                      <text
                        x={(fromEl.x + toEl.x) / 2 + 10}
                        y={(fromEl.y + toEl.y) / 2}
                        fontSize="10"
                        fill="#64748b"
                        className="font-mono font-medium"
                      >
                        {conn.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Placed Elements (Nodes) */}
            {displayElements
              .filter(el => el.type !== 'BOUNDARY_BOX' && !el.properties?.isBoundary)
              .map(el => {
                const isSelected = selectedElementId === el.id;
                const isArrowSource = arrowSourceId === el.id;

                return (
                  <div
                    key={el.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Diagram component ${el.label}`}
                    aria-pressed={isSelected}
                    onPointerDown={e => handleElementPointerDown(e, el)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedElementId(el.id);
                      }
                    }}
                    className={`absolute p-2.5 rounded-xl border bg-white shadow-sm flex items-center gap-2 cursor-move transition-shadow focus:outline-none focus:ring-2 focus:ring-emerald-500 z-20 select-none ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md'
                        : isArrowSource
                          ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 shadow-md'
                          : 'border-slate-300 hover:border-slate-400'
                    }`}
                    style={{
                      left: `${el.x}px`,
                      top: `${el.y}px`,
                      width: `${el.width}px`,
                      minHeight: `${el.height}px`,
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: el.color }}
                    />
                    <span className="text-xs font-bold text-slate-800 truncate">{el.label}</span>
                  </div>
                );
              })}

            {/* Multimodal AI Vision Bounding Box Annotations Overlay */}
            <VisualAnnotationOverlay
              annotations={
                (evaluation as any)?.annotations || (analysisResult as any)?.annotations || []
              }
            />
          </div>

          {/* Selected Element Quick Property Inspector */}
          {selectedElement && !isViewingHistory && (
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between gap-3 flex-wrap animate-fadeIn">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Edit3 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700 shrink-0">Label:</span>
                <input
                  type="text"
                  value={selectedElement.label}
                  onChange={e => {
                    updateElement(selectedElement.id, { label: e.target.value });
                    triggerDebouncedSync();
                  }}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1"
                  placeholder="Component name..."
                />
              </div>

              {/* Color Swatches */}
              <div className="flex items-center gap-1.5">
                {PALETTE_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      updateElement(selectedElement.id, { color: c.value });
                      triggerDebouncedSync();
                    }}
                    title={c.label}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      selectedElement.color === c.value
                        ? 'ring-2 ring-offset-1 ring-slate-800 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Delete Selected Element */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    removeElement(selectedElement.id);
                    setSelectedElementId(null);
                    triggerDebouncedSync();
                  }}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedElementId(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  title="Deselect"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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
