import { collection, query, limit, getDocsFromServer, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Room } from '@/types';

type RoomCacheListener = (rooms: Room[]) => void;

class RoomCacheManager {
  private static instance: RoomCacheManager;
  private cachedRooms: Room[] = [];
  private listeners: Set<RoomCacheListener> = new Set();
  private hasSyncedOnce: boolean = false;

  private constructor() {
    // Try to load any previously stored room state from local storage as initial cache
    try {
      const stored = localStorage.getItem('voice_star_client_room_cache');
      if (stored) {
        this.cachedRooms = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load room cache from localStorage:", e);
    }
  }

  public static getInstance(): RoomCacheManager {
    if (!RoomCacheManager.instance) {
      RoomCacheManager.instance = new RoomCacheManager();
    }
    return RoomCacheManager.instance;
  }

  /**
   * Returns current memory cached rooms
   */
  public getRooms(): Room[] {
    return this.cachedRooms;
  }

  /**
   * Subscribe to cache updates
   */
  public subscribe(listener: RoomCacheListener): () => void {
    this.listeners.add(listener);
    // Provide immediate initial cache value
    listener(this.cachedRooms);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Set cached rooms and notify all active listeners
   */
  public setRooms(rooms: Room[]) {
    const dummyIds = [
      'room_star_mic',
      'room_gaming_arena',
      'room_cozy_chat',
      'room_summer_solstice',
      'room_astrology'
    ];
    
    // Filter out dummy rooms and closed rooms from shown cache
    this.cachedRooms = (rooms || []).filter(room => {
      if (!room || !room.id) return false;
      if (dummyIds.includes(room.id)) return false;
      if (room.id.startsWith('mock_') || room.id.startsWith('demo_room_')) return false;
      return room.isLive !== false;
    });

    this.hasSyncedOnce = true;
    
    try {
      localStorage.setItem('voice_star_client_room_cache', JSON.stringify(this.cachedRooms));
    } catch (e) {
      console.warn("Failed to save room cache to localStorage:", e);
    }

    this.notifyListeners();
  }

  /**
   * Explicitly notify all registered listeners of the new state
   */
  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.cachedRooms);
      } catch (err) {
        console.error("Error notifying RoomCache listener:", err);
      }
    });
  }

  /**
   * Invalidates local/offline Firestore caches and force-synchronizes with the cloud server database.
   * If a newlyCreatedRoom is supplied during the transaction cycle, it is immediately prepended/injected 
   * into the list upon write acknowledgement, fully bypassing index and write replication latencies.
   */
  public async forceSynchronize(newlyCreatedRoom?: Room): Promise<Room[]> {
    console.log("[LoungeSync] Force-synchronizing rooms list cache from Firestore server...");
    
    if (newlyCreatedRoom) {
      // Intercept and update cache synchronously so the UI reacts on the spot
      const current = this.cachedRooms.filter(r => r.id !== newlyCreatedRoom.id);
      this.setRooms([newlyCreatedRoom, ...current]);
    }

    try {
      // Order by createdAt desc to prioritize and show newest active rooms first!
      const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocsFromServer(q);
      let roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));

      // Filter out duplicates if the newly created room is already in the returned list
      if (newlyCreatedRoom) {
        console.log(`[LoungeSync] Write acknowledgement received! Injecting new room: "${newlyCreatedRoom.title}" (${newlyCreatedRoom.id})`);
        
        // Remove from list if already there to prevent duplicates
        roomData = roomData.filter(r => r.id !== newlyCreatedRoom.id);
        
        // Prepend search/creation to top of active rooms list
        roomData.unshift(newlyCreatedRoom);
      }

      this.setRooms(roomData);
      return roomData;
    } catch (err) {
      console.error("[LoungeSync] Failed to force-synchronize with Firestore backend:", err);
      // In case server fetch fails but we have a newly created room, inject it into existing cache as fallback
      if (newlyCreatedRoom) {
        const fallbacked = [newlyCreatedRoom, ...this.cachedRooms.filter(r => r.id !== newlyCreatedRoom.id)];
        this.setRooms(fallbacked);
        return fallbacked;
      }
      throw err;
    }
  }
}

export const RoomCache = RoomCacheManager.getInstance();
