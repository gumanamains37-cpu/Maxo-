import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, setLogLevel, doc, getDocFromServer, getDocsFromServer } from 'firebase/firestore';
import firebaseConfig from '@/../firebase-applet-config.json';

// Silence internal Firestore warning logs and assertion messages from polluting console.error
try {
  setLogLevel('silent');
} catch (e) {
  // Gracefully skip if setter isn't supported in current bindings
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let dbInstance;
const dbId = (firebaseConfig as any).firestoreDatabaseId;
const globalForFirebase = globalThis as any;

if (globalForFirebase.firestoreDb) {
  dbInstance = globalForFirebase.firestoreDb;
} else {
  const settings = {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  };
  if (dbId && dbId !== '(default)' && dbId !== 'default') {
    dbInstance = initializeFirestore(app, settings, dbId);
  } else {
    dbInstance = initializeFirestore(app, settings);
  }
  globalForFirebase.firestoreDb = dbInstance;
}

export const db = dbInstance;
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Connection test succeeded unexpectedly.");
  } catch (error) {
    console.log("Connection test failure details:", error);
    if (error instanceof Error) {
      console.log("Error message text:", error.message);
      if (error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }
}

// Delay the execution to allow the Firestore client to establish initial network handshake,
// preventing false-positives during initial loading and fast crawler runs.
setTimeout(() => {
  testConnection();
}, 6000);

import { 
  getDocs, 
  getDoc, 
  DocumentReference, 
  Query, 
  CollectionReference,
  onSnapshot
} from 'firebase/firestore';

/**
 * A highly resilient, high-performance, and crash-proof alternative to onSnapshot.
 * Prefers the native Firestore SDK real-time subscription for zero-overhead, SSE/WebSocket updates,
 * and falls back elegantly to periodic REST polling ONLY if subscription fails or is blocked.
 * This completely eliminates CPU and battery draining periodic polling under normal operations.
 */
export function safeOnSnapshot(
  ref: any,
  ...args: any[]
): () => void {
  let onNext: any = null;
  let onError: any = null;

  if (typeof args[0] === 'function') {
    onNext = args[0];
    onError = args[1];
  } else if (typeof args[0] === 'object' && typeof args[1] === 'function') {
    onNext = args[1];
    onError = args[2];
  }

  let active = true;
  let timerId: any = null;
  let unsubReal: (() => void) | null = null;

  // Tailored safe polling interval as fallback
  let intervalMs = 6000;
  try {
    const pathStr = ref.path || (ref._query && ref._query.path && ref._query.path.toString()) || '';
    if (pathStr.includes('messages') || pathStr.includes('chat') || pathStr.includes('hand_raises')) {
      intervalMs = 3000;
    } else if (pathStr.includes('room')) {
      intervalMs = 4000;
    }
  } catch (e) {
    // Graceful fallback
  }

  const scheduleNext = () => {
    if (active) {
      timerId = setTimeout(performPollingFetch, intervalMs);
    }
  };

  const performPollingFetch = async () => {
    if (!active) return;
    try {
      if (ref instanceof DocumentReference || (ref.type === 'document')) {
        let snap;
        try {
          snap = await getDocFromServer(ref);
        } catch (e) {
          snap = await getDoc(ref);
        }
        if (active && onNext) {
          onNext(snap);
        }
      } else {
        let snap;
        try {
          snap = await getDocsFromServer(ref);
        } catch (e) {
          snap = await getDocs(ref);
        }
        if (active && onNext) {
          onNext(snap);
        }
      }
    } catch (err) {
      if (active) {
        if (onError) {
          onError(err);
        } else {
          console.warn("safeOnSnapshot fallback polling error captured:", err);
        }
      }
    } finally {
      scheduleNext();
    }
  };

  try {
    // Attempt native SDK onSnapshot first
    unsubReal = onSnapshot(ref, (snap) => {
      if (active && onNext) {
        onNext(snap);
      }
    }, (err) => {
      console.warn("Native onSnapshot subscription error, falling back to polling:", err);
      if (active) {
        if (unsubReal) {
          unsubReal();
          unsubReal = null;
        }
        // Immediately trigger first poll, then start polling cycle
        performPollingFetch();
      }
    });
  } catch (e) {
    console.warn("Failed to initialize native onSnapshot, using polling fallback:", e);
    performPollingFetch();
  }

  return () => {
    active = false;
    if (unsubReal) {
      unsubReal();
    }
    if (timerId) {
      clearTimeout(timerId);
    }
  };
}


