import { useSessionStore } from '@/stores/useSessionStore';
import { startNewSession } from './api';

/**
 * Discard the current count and start a fresh session immediately, without
 * exporting (client request). Scans clear instantly; a brand-new session row is
 * inserted (the DB trigger completes the previous active session, so the old
 * scans stay under that abandoned session rather than mixing into the new one).
 *
 * Callable from anywhere (e.g. Settings) — it drives the global store directly,
 * so it doesn't need the useSessionSync hook. If the network insert fails
 * (offline), it clears the session id and the Scanner's ensure-session effect
 * retries when connectivity returns.
 */
export async function startNewCount(userId: string): Promise<void> {
  // Clear the visible list immediately for instant feedback.
  useSessionStore.setState({ scans: [] });

  try {
    const session = await startNewSession(userId);
    useSessionStore.getState().setSessionId(session.id);
  } catch {
    useSessionStore.getState().setSessionId(null);
  }
}
