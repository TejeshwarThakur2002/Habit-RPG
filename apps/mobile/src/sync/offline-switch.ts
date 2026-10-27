// "Simulate offline" for the dev outbox screen (D54): while it's on, every sync request fails as
// if the network were gone, before it leaves the phone, so the outbox, retries and status behave
// as in a real cut. In memory only, so a restart always turns it off. No React here.

import type { SyncTransport } from './engine';

let offline = false;
const listeners = new Set<() => void>();

export function simulatedOffline(): boolean {
  return offline;
}

export function setSimulatedOffline(on: boolean): void {
  if (on === offline) return;
  offline = on;
  listeners.forEach((listener) => listener());
}

export function subscribeSimulatedOffline(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The transport, cut off while simulated offline is on. */
export function withOfflineSwitch(transport: SyncTransport): SyncTransport {
  return {
    send: (request) =>
      offline
        ? Promise.resolve({ ok: false, kind: 'offline', message: 'Simulated offline' })
        : transport.send(request),
  };
}
