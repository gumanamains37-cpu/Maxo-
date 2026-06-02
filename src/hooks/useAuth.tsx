import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, safeOnSnapshot } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { getPremiumAvatar } from '@/utils/avatar';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

export function getOrCreateNumericId(uid: string, providedId?: string): string {
  if (providedId && /^\d{9}$/.test(providedId)) {
    localStorage.setItem(`numeric_id_${uid}`, providedId);
    return providedId;
  }
  const key = `numeric_id_${uid}`;
  const cached = localStorage.getItem(key);
  if (cached && /^\d{9}$/.test(cached)) {
    return cached;
  }
  const generatedId = Math.floor(100000000 + Math.random() * 900000000).toString();
  localStorage.setItem(key, generatedId);
  return generatedId;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const cachedMockStr = localStorage.getItem('maxo_mock_user');
      if (cachedMockStr) {
        try {
          return JSON.parse(cachedMockStr);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const cachedMockStr = localStorage.getItem('maxo_mock_user');
      if (cachedMockStr) {
        try {
          const u = JSON.parse(cachedMockStr);
          const cachedProfile = localStorage.getItem(`profile_${u.uid}`);
          if (cachedProfile) {
            return JSON.parse(cachedProfile);
          }
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const cachedMockStr = localStorage.getItem('maxo_mock_user');
      if (cachedMockStr) {
        return false; // Initialize loading as false if we have a cached guest session for ultra-fast startup
      }
    }
    return true;
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const handleUserSession = async (currentUser: any) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (currentUser) {
        setUser(currentUser);
        // Hydrate from localStorage immediately to guarantee instant offline preview
        const cached = localStorage.getItem(`profile_${currentUser.uid}`);
        if (cached) {
          try {
            setProfile(JSON.parse(cached));
            setLoading(false);
          } catch (pErr) {
            // Ignore parse errors
          }
        }

        try {
          const profileRef = doc(db, 'users', currentUser.uid);
          
          // Register snapshot observer immediately
          // This will instantly resolve via local Firestore cache (if available) or wait for server feedback.
          unsubProfile = safeOnSnapshot(profileRef, async (docSnap: any) => {
            const generatedId = getOrCreateNumericId(currentUser.uid);
            if (docSnap.exists()) {
              const updatedProfile = docSnap.data() as UserProfile;
              // Secure the stable numeric ID from the remote profile if it exists, otherwise generate/retrieve it
              let stableId = updatedProfile.numericId;
              if (!stableId || !/^\d{9}$/.test(stableId)) {
                stableId = generatedId;
                await setDoc(profileRef, { numericId: stableId }, { merge: true }).catch(() => {});
              } else {
                // Persist/update the local cache with the authoritative Firestore ID
                localStorage.setItem(`numeric_id_${currentUser.uid}`, stableId);
              }

              updatedProfile.numericId = stableId;
              setProfile(updatedProfile);
              localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(updatedProfile));
              setLoading(false);
            } else {
              // Document doesn't exist
              // We only create it if we are certain (metadata.fromCache indicates if it's actual server confirmation)
              if (!docSnap.metadata.fromCache) {
                // Helper to generate a realistic random username
                const firstNames = ['Liam', 'Aria', 'Ethan', 'Julian', 'Zoe', 'Lucas', 'Sophia', 'Alexander', 'Olivia', 'Nathan', 'Chloe', 'Ryan', 'Serena', 'Marcus', 'Elena', 'Justin', 'Amara', 'Derrick'];
                const lastSuffixes = ['Melody', 'Vibe', 'Echo', 'Beats', 'Voice', 'Harmony', 'Chords', 'Tune', 'Sonic', 'Mic', 'Decks', 'Rhythm', 'Acoustic'];
                const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]}_${lastSuffixes[Math.floor(Math.random() * lastSuffixes.length)]}`;

                const newProfile: UserProfile = {
                  uid: currentUser.uid,
                  numericId: generatedId,
                  displayName: currentUser.displayName || randomName,
                  photoURL: currentUser.photoURL || getPremiumAvatar(currentUser.uid),
                  level: 1, // Start standard level 1
                  experience: 0,
                  coins: 1500, // Standard starting coins
                  diamonds: 10,
                  badges: [], // No VIP by default
                  followersCount: 5,
                  followingCount: 3,
                  visitorsCount: 17,
                  isVIP: false, // Default is NOT VIP
                  lastLogin: new Date().toISOString()
                };
                
                await setDoc(profileRef, newProfile)
                  .catch((writeError) => {
                    console.log("Could not write initial profile to firestore (offline/restricted):", writeError);
                  });
                
                setProfile(newProfile);
                localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(newProfile));
              } else {
                // If it's fromCache and docSnap doesn't exist, we might be offline with clean cache.
                // Do not overwrite, use standard fallback to prevent flashing.
                const cached = localStorage.getItem(`profile_${currentUser.uid}`);
                if (cached) {
                  try {
                    setProfile(JSON.parse(cached));
                  } catch (pErr) {
                    // Ignore
                  }
                } else {
                  // Helper to generate a realistic random username
                  const firstNames = ['Liam', 'Aria', 'Ethan', 'Julian', 'Zoe', 'Lucas', 'Sophia', 'Alexander', 'Olivia', 'Nathan', 'Chloe', 'Ryan', 'Serena', 'Marcus', 'Elena', 'Justin', 'Amara', 'Derrick'];
                  const lastSuffixes = ['Melody', 'Vibe', 'Echo', 'Beats', 'Voice', 'Harmony', 'Chords', 'Tune', 'Sonic', 'Mic', 'Decks', 'Rhythm', 'Acoustic'];
                  const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]}_${lastSuffixes[Math.floor(Math.random() * lastSuffixes.length)]}`;

                  const fallbackProfile: UserProfile = {
                    uid: currentUser.uid,
                    numericId: generatedId,
                    displayName: currentUser.displayName || randomName,
                    photoURL: currentUser.photoURL || getPremiumAvatar(currentUser.uid),
                    level: 1,
                    experience: 0,
                    coins: 1500,
                    diamonds: 10,
                    badges: [],
                    followersCount: 0,
                    followingCount: 0,
                    visitorsCount: 0,
                    isVIP: false,
                    lastLogin: new Date().toISOString()
                  };
                  setProfile(fallbackProfile);
                }
              }
              setLoading(false);
            }
          }, (err) => {
            setLoading(false);
            console.error("Profile subscription error:", err);
            try {
              handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
            } catch (th) {
              // Capture gracefully to prevent UI freeze/crash on startup
            }
          });
        } catch (error: any) {
          console.log("Profile hydration/listener notice:", error.message || error);
          setLoading(false);
        }
      } else {
        // Real user is null. Check if mock/local offline guest is active
        const cachedMockStr = localStorage.getItem('maxo_mock_user');
        if (cachedMockStr) {
          try {
            const mockUserVal = JSON.parse(cachedMockStr);
            handleUserSession(mockUserVal);
            return;
          } catch (e) {
            // Ignore invalid JSON strings
          }
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // If there is an active Firebase anonymous session but we have an active custom mock login represented
      // in localStorage, let's sign out of Firebase anonymously so we are pure guests on firestore.
      const cachedMockStr = localStorage.getItem('maxo_mock_user');
      if (u && u.isAnonymous && cachedMockStr) {
        try {
          const parsedMock = JSON.parse(cachedMockStr);
          if (parsedMock.uid && (parsedMock.uid.startsWith('guest_') || parsedMock.uid.startsWith('mobile_') || parsedMock.uid.startsWith('pass_user_') || /^\d+$/.test(parsedMock.uid))) {
            await auth.signOut();
            return;
          }
        } catch (e) {}
      }
      handleUserSession(u);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

