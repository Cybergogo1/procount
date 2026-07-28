import NetInfo from '@react-native-community/netinfo';

import { processSyncOp } from './api';
import { SyncQueue } from './syncQueue';

/**
 * App-lifetime sync queue singleton (brief Sections 7–8). Lives at module scope
 * so it survives screen unmounts and keeps flushing pending writes in the
 * background. Connectivity is driven by NetInfo.
 */
export const syncQueue = new SyncQueue({ process: processSyncOp });

let connectivityBound = false;

/** Bind the queue to NetInfo once. Safe to call repeatedly. */
export function bindConnectivity(): () => void {
  if (connectivityBound) return () => {};
  connectivityBound = true;

  const unsubscribe = NetInfo.addEventListener((state) => {
    // Treat a connected interface as online; if it's connected but the internet
    // isn't actually reachable, writes simply fail and retry with backoff.
    syncQueue.setOnline(state.isConnected === true);
  });

  return unsubscribe;
}
