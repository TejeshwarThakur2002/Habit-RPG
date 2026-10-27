import { FakeSyncServer } from '../../test/fake-sync-server';
import {
  setSimulatedOffline,
  simulatedOffline,
  subscribeSimulatedOffline,
  withOfflineSwitch,
} from '../offline-switch';

const request = {
  device_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  cursor: 0,
  app_version: '0',
  changes: [],
};

afterEach(() => setSimulatedOffline(false));

describe('simulated offline', () => {
  it('stops requests before they leave the phone, as a real cut would', async () => {
    const server = new FakeSyncServer();
    const transport = withOfflineSwitch(server);
    setSimulatedOffline(true);
    expect(await transport.send(request)).toMatchObject({ ok: false, kind: 'offline' });
    expect(server.requests).toEqual([]);

    setSimulatedOffline(false);
    expect((await transport.send(request)).ok).toBe(true);
    expect(server.requests).toHaveLength(1);
  });

  it('tells its listeners only when it changes', () => {
    const listener = jest.fn();
    const stop = subscribeSimulatedOffline(listener);
    setSimulatedOffline(true);
    setSimulatedOffline(true);
    expect(simulatedOffline()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
});
