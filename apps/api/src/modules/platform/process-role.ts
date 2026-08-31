export type ProcessRole = 'api' | 'worker';

export function isWorkerProcess(): boolean {
  return process.env.PROCESS_ROLE === 'worker';
}
