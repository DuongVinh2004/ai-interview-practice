import { create } from 'zustand';

export interface CanvasElement {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  properties?: Record<string, any>;
}

export interface CanvasConnector {
  id: string;
  fromId: string;
  toId: string;
  protocol: string;
  label?: string;
  properties?: Record<string, any>;
}

export interface WhiteboardState {
  elements: CanvasElement[];
  connectors: CanvasConnector[];
  selectedElementId: string | null;
  tool: 'select' | 'pen' | 'rect' | 'arrow' | 'text';
  version: number;
  etag: string | null;
  isSyncing: boolean;
  hasPendingSync: boolean;
  syncConflict: string | null;
  lastSyncedAt: string | null;
  syncDebounceTimeout: any | null;

  // Actions
  setTool: (tool: 'select' | 'pen' | 'rect' | 'arrow' | 'text') => void;
  setSelectedElementId: (id: string | null) => void;
  setElements: (elements: CanvasElement[]) => void;
  setConnectors: (connectors: CanvasConnector[]) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  moveElement: (id: string, x: number, y: number) => void;
  removeElement: (id: string) => void;
  addConnector: (connector: CanvasConnector) => void;
  removeConnector: (id: string) => void;
  clearCanvas: () => void;
  setInitialState: (
    elements: CanvasElement[],
    connectors: CanvasConnector[],
    version: number,
    etag: string | null,
  ) => void;
  setVersionAndEtag: (version: number, etag: string) => void;
  setSyncConflict: (conflict: string | null) => void;

  // Debounced sync action (500ms) with concurrency control
  scheduleDebouncedSync: (
    syncFn: (payload: {
      elements: CanvasElement[];
      connectors: CanvasConnector[];
      version: number;
      etag: string | null;
    }) => Promise<{ version: number; etag: string } | void>,
  ) => void;
}

export const INITIAL_WHITEBOARD_ELEMENTS: CanvasElement[] = [
  {
    id: 'init-client',
    type: 'CLIENT',
    label: 'Client (Web/Mobile)',
    x: 40,
    y: 120,
    width: 140,
    height: 48,
    color: '#4f46e5',
    properties: { platform: 'cross-platform' },
  },
  {
    id: 'init-lb',
    type: 'LOAD_BALANCER',
    label: 'Load Balancer',
    x: 220,
    y: 120,
    width: 140,
    height: 48,
    color: '#059669',
    properties: { algorithm: 'round-robin', capacity: '100k rps' },
  },
  {
    id: 'init-app',
    type: 'MICROSERVICE',
    label: 'URL Shortener Service',
    x: 400,
    y: 120,
    width: 160,
    height: 48,
    color: '#d97706',
    properties: { replicas: 3, framework: 'NestJS' },
  },
  {
    id: 'init-cache',
    type: 'CACHE',
    label: 'Redis Cache',
    x: 400,
    y: 220,
    width: 140,
    height: 48,
    color: '#ea580c',
    properties: { memory: '16GB', ttl: 86400 },
  },
  {
    id: 'init-db',
    type: 'RELATIONAL_DB',
    label: 'PostgreSQL Primary',
    x: 600,
    y: 120,
    width: 160,
    height: 48,
    color: '#2563eb',
    properties: { engine: 'Postgres 16', replication: 'multi-az' },
  },
  {
    id: 'init-queue',
    type: 'MESSAGE_QUEUE',
    label: 'Kafka Queue',
    x: 600,
    y: 220,
    width: 150,
    height: 48,
    color: '#e11d48',
    properties: { partitions: 8, retentionDays: 7 },
  },
];

export const INITIAL_WHITEBOARD_CONNECTORS: CanvasConnector[] = [
  {
    id: 'conn-init-1',
    fromId: 'init-client',
    toId: 'init-lb',
    protocol: 'HTTPS/REST',
    label: 'Client Traffic',
  },
  {
    id: 'conn-init-2',
    fromId: 'init-lb',
    toId: 'init-app',
    protocol: 'HTTP/2',
    label: 'Reverse Proxy',
  },
  {
    id: 'conn-init-3',
    fromId: 'init-app',
    toId: 'init-cache',
    protocol: 'RESP',
    label: 'Cache-Aside',
  },
  {
    id: 'conn-init-4',
    fromId: 'init-app',
    toId: 'init-db',
    protocol: 'TCP/SQL',
    label: 'Persistence',
  },
  {
    id: 'conn-init-5',
    fromId: 'init-app',
    toId: 'init-queue',
    protocol: 'Kafka',
    label: 'Async Events',
  },
];

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  elements: INITIAL_WHITEBOARD_ELEMENTS,
  connectors: INITIAL_WHITEBOARD_CONNECTORS,
  selectedElementId: null,
  tool: 'select',
  version: 1,
  etag: null,
  isSyncing: false,
  hasPendingSync: false,
  syncConflict: null,
  lastSyncedAt: null,
  syncDebounceTimeout: null,

  setTool: tool => set({ tool }),
  setSelectedElementId: id => set({ selectedElementId: id }),

  setElements: elements =>
    set(state => ({
      elements,
      version: state.version + 1,
    })),

  setConnectors: connectors =>
    set(state => ({
      connectors,
      version: state.version + 1,
    })),

  addElement: element =>
    set(state => ({
      elements: [...state.elements, element],
      version: state.version + 1,
    })),

  updateElement: (id, updates) =>
    set(state => ({
      elements: state.elements.map(el => (el.id === id ? { ...el, ...updates } : el)),
      version: state.version + 1,
    })),

  moveElement: (id, x, y) =>
    set(state => ({
      elements: state.elements.map(el => (el.id === id ? { ...el, x, y } : el)),
      version: state.version + 1,
    })),

  removeElement: id =>
    set(state => ({
      elements: state.elements.filter(el => el.id !== id),
      connectors: state.connectors.filter(conn => conn.fromId !== id && conn.toId !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
      version: state.version + 1,
    })),

  addConnector: connector =>
    set(state => ({
      connectors: [...state.connectors, connector],
      version: state.version + 1,
    })),

  removeConnector: id =>
    set(state => ({
      connectors: state.connectors.filter(conn => conn.id !== id),
      version: state.version + 1,
    })),

  clearCanvas: () =>
    set(state => ({
      elements: [],
      connectors: [],
      selectedElementId: null,
      version: state.version + 1,
    })),

  setInitialState: (elements, connectors, version, etag) =>
    set({
      elements,
      connectors,
      version,
      etag,
      selectedElementId: null,
      syncConflict: null,
      lastSyncedAt: new Date().toISOString(),
    }),

  setVersionAndEtag: (version, etag) =>
    set({
      version,
      etag,
      syncConflict: null,
      lastSyncedAt: new Date().toISOString(),
    }),

  setSyncConflict: conflict => set({ syncConflict: conflict }),

  scheduleDebouncedSync: syncFn => {
    const state = get();

    // Clear existing timer if user continues making edits
    if (state.syncDebounceTimeout) {
      clearTimeout(state.syncDebounceTimeout);
    }

    const timeout = setTimeout(async () => {
      const currentState = get();

      // If already syncing, flag pending sync so next tick runs immediately
      if (currentState.isSyncing) {
        set({ hasPendingSync: true });
        return;
      }

      set({ isSyncing: true, hasPendingSync: false });

      try {
        const result = await syncFn({
          elements: currentState.elements,
          connectors: currentState.connectors,
          version: currentState.version,
          etag: currentState.etag,
        });

        if (result) {
          set({
            version: result.version,
            etag: result.etag,
            syncConflict: null,
            lastSyncedAt: new Date().toISOString(),
            isSyncing: false,
          });
        } else {
          set({ isSyncing: false });
        }
      } catch (err: any) {
        set({
          isSyncing: false,
          syncConflict: err?.message || 'Sync failed due to concurrency conflict',
        });
      }

      // Check if another edit happened while sync was in flight
      if (get().hasPendingSync) {
        set({ hasPendingSync: false });
        get().scheduleDebouncedSync(syncFn);
      }
    }, 500); // 500ms debounce interval

    set({ syncDebounceTimeout: timeout });
  },
}));
