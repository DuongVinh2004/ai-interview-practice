export type ProcessRole = 'api' | 'worker' | 'all';

export function isWorkerProcess(): boolean {
  return process.env.PROCESS_ROLE === 'worker' || process.env.PROCESS_ROLE === 'all';
}
