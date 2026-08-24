import {
  Server,
  Database,
  Layers,
  HardDrive,
  Cpu,
  Globe,
  Radio,
  Zap,
  Smartphone,
  Box,
} from 'lucide-react';

export interface SystemComponentItem {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  defaultLabel: string;
}

export const SYSTEM_COMPONENTS: SystemComponentItem[] = [
  {
    type: 'CLIENT',
    label: 'Client / App',
    icon: Smartphone,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    defaultLabel: 'Client (Web/Mobile)',
  },
  {
    type: 'CDN',
    label: 'CDN',
    icon: Globe,
    color: 'text-sky-600 bg-sky-50 border-sky-200',
    defaultLabel: 'Cloudflare CDN',
  },
  {
    type: 'LOAD_BALANCER',
    label: 'Load Balancer',
    icon: Layers,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    defaultLabel: 'Nginx Load Balancer',
  },
  {
    type: 'API_GATEWAY',
    label: 'API Gateway',
    icon: Server,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    defaultLabel: 'API Gateway & Auth',
  },
  {
    type: 'MICROSERVICE',
    label: 'Microservice',
    icon: Cpu,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    defaultLabel: 'Core App Service',
  },
  {
    type: 'MESSAGE_QUEUE',
    label: 'Message Queue',
    icon: Radio,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    defaultLabel: 'Kafka / RabbitMQ',
  },
  {
    type: 'CACHE',
    label: 'In-Memory Cache',
    icon: Zap,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    defaultLabel: 'Redis Cluster',
  },
  {
    type: 'RELATIONAL_DB',
    label: 'Relational DB',
    icon: Database,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    defaultLabel: 'PostgreSQL Primary',
  },
  {
    type: 'NOSQL_DB',
    label: 'NoSQL Store',
    icon: HardDrive,
    color: 'text-teal-600 bg-teal-50 border-teal-200',
    defaultLabel: 'MongoDB / DynamoDB',
  },
  {
    type: 'BLOB_STORAGE',
    label: 'Blob Storage',
    icon: Box,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    defaultLabel: 'AWS S3 / GCS',
  },
];

interface ComponentPaletteProps {
  onAddComponent: (comp: SystemComponentItem) => void;
}

export function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2" data-testid="component-palette">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          System Components
        </span>
        <span className="text-[10px] text-slate-400">Click to place</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
        {SYSTEM_COMPONENTS.map(comp => {
          const Icon = comp.icon;
          return (
            <button
              key={comp.type}
              type="button"
              onClick={() => onAddComponent(comp)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all hover:scale-[1.02] hover:shadow-xs active:scale-95 ${comp.color}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold text-slate-800 truncate">{comp.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
