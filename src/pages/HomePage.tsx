import React, { useEffect, useState, useMemo, useRef } from 'react';
import { collection, query, limit, setDoc, doc, getDoc, updateDoc, getDocs, increment, deleteDoc, where, getDocsFromServer, orderBy } from 'firebase/firestore';
import { db, auth, safeOnSnapshot } from '@/lib/firebase';
import { Room, UserProfile } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Users, Mic2, BarChart3, FlaskConical, X, Sparkles, Home, 
  ChevronRight, Trophy, Landmark, MessageSquare, Heart, Check, Calendar, 
  ArrowRight, Flame, UserPlus, Crown, Gift, Music, Play, Radio, Sparkle, Zap, Shield, HelpCircle, Video,
  RotateCw, Share2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/Logo';
import { toast } from 'sonner';
import { getPremiumAvatar, getPremiumRoomCover } from '@/utils/avatar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RoomCache } from '@/lib/roomCache';

// Premium interactive promo banners content
const PREMIUM_BANNERS = [
  {
    id: 'ramadan_tourney',
    title: 'Ramadan Star Mic Tournament',
    subtitle: '🎙️ LIVE CHANNEL COMPETITION',
    badge: 'COMMUNITY EVENT',
    desc: 'Battle live in voice rooms to crown the ultimate Voice Star! Gather listeners, receive royal gifts, and secure the unique Golden Crescent profile border + 10,000 extra diamond multiplier rewards.',
    duration: 'June 1 - June 15, 2026',
    reward: 'Exclusive Golden Crescent Avatar Border & 10k Diamonds Guild Pool',
    actionText: 'Register Star Mic',
    gradient: 'from-indigo-900 via-purple-900 to-emerald-950 border-emerald-500/30',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    icon: '🌙'
  },
  {
    id: 'crown_sale',
    title: 'Prestige VIP Golden Crown',
    subtitle: '👑 ROYALS DISCOUNTS AVAILABLE',
    badge: 'FLASH VIP DEALS',
    desc: 'Unlock maximum nobility prestige badges in an exclusive 72-hour flash sale. Save up to 50% on Gold Chat bubbles, customized room banner broadcasters, and instant Level-up VIP level packages.',
    duration: 'Limited 72H Sale',
    reward: 'Instant Aristocrat Crown Rank & 50% Gifting Coin Bonus',
    actionText: 'Upgrade Nobility Now',
    gradient: 'from-amber-950 via-yellow-950 to-orange-950 border-amber-500/30',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
    icon: '👑'
  },
  {
    id: 'battle_hosts',
    title: 'Streamers PK Battle Arena',
    subtitle: '⚔️ GLADIATOR SOUND SHOWDOWN',
    badge: 'COMPETITION',
    desc: 'The ultimate sound duel is now active! Streamers engage in head-to-head audio battles. High-capacity real-time volume meters tracking gifts received in a 5-minute combat countdown. Winners get featured on the server banner for a week.',
    duration: 'Weekly - Every Friday Night',
    reward: 'Featured Homepage Banner for 7 Days & 5,000 Coins Base Reward',
    actionText: 'Enter Clan War Arena',
    gradient: 'from-red-950 via-pink-900 to-rose-950 border-rose-500/30',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
    icon: '⚔️'
  },
  {
    id: 'summer_solstice',
    title: 'Starlight Summer Solstice Session',
    subtitle: '🎵 COSMIC DANCE BEATS LOUNGE',
    badge: 'SEASONAL ACTIVITY',
    desc: 'Immerse yourself in stellar deep-house, acoustic, and techno beats under the stars in the official Neon Pool party channel. Celebrate the summer solstice with unique beach reactions and firework gifting effects.',
    duration: 'Tonight @ 9:00 PM UTC',
    reward: 'Neon Beach Ball Chat Bubbles & Commemorative Sunset Medal',
    actionText: 'Reserve Lounge Seat',
    gradient: 'from-cyan-950 via-blue-900 to-indigo-950 border-blue-500/30',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
    icon: '🎧'
  }
];

/**
 * Dynamic Trending Recommendation Algorithm
 * Prioritizes rooms based on a weighted combination of:
 * 1. Real-time active user count (memberCount) -> high weight
 * 2. Recent user growth (based on room age and hourly joins) -> high weight
 * 3. Engagement metrics (giftVolume / diamonds sent) -> premium multiplier weight
 * 4. Duration of activity (age of room in hours) -> solid longevity health weight
 */
export function calculateTrendingScore(room: Room): number {
  const memberCount = room.memberCount ?? (room as any).activeCount ?? 0;
  
  // 1. Calculate duration of activity (room age in hours)
  const createdTime = room.createdAt ? new Date(room.createdAt).getTime() : Date.now();
  const ageInHours = Math.max(0.05, (Date.now() - createdTime) / 3600000); // lowerbound of 3 minutes
  
  // 2. Real-time active user count score
  const activeCountScore = memberCount * 12.5; 
  
  // 3. Recent user growth rate: Ratio of active members to active age (growth speed)
  // Plus we incorporate any explicitly tracked hourly join count (recent growth spike)
  const averageGrowthRatio = (memberCount / ageInHours) * 15.0;
  const trackedHourlyJoin = ((room as any).hourlyJoinCount ?? 0) * 8.5;
  const growthScore = averageGrowthRatio + trackedHourlyJoin;
  
  // 4. Engagement Score from gifts sent in the lounge
  const giftVolume = (room as any).giftVolume ?? 0;
  const giftScore = giftVolume * 1.8;
  
  // 5. Activity duration bonus: Reward sustained activity up to 12 hours
  // This supports organic and long-lived active stages
  const durationBonus = Math.min(12, ageInHours) * 4.5;
  
  // 6. NEWLY LAUNCHED ROOM BOOST
  // Give newly created rooms (within 2 hours) a massive high-priority score kick so they secure top positioning instantly.
  const timeSinceCreationMs = Date.now() - createdTime;
  const isRecentLounge = timeSinceCreationMs > 0 && timeSinceCreationMs < 7200000; // 2 hours window
  const recentLoungeBoost = isRecentLounge ? 50000 : 0;
  
  // Sum weights up cleanly
  const score = activeCountScore + growthScore + giftScore + durationBonus + recentLoungeBoost;
  return Math.round(score * 10) / 10; // 1 decimal point precision
}

export const DEV_DEMO_ROOMS: Room[] = [];

const HOT_SEARCHES = ['Siddharth', 'Anya ✨', 'Gaming Room', 'VIP Space', 'DJ Beats', 'Agencies'];

const PREMIUM_BACKGROUNDS_PRESET = [
  { id: 'purple_luxury', name: 'Purple Luxury Theme', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop' },
  { id: 'pink_premium', name: 'Pink Premium Theme', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop' },
  { id: 'blue_neon', name: 'Blue Neon Theme', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=600&auto=format&fit=crop' },
  { id: 'gold_vip', name: 'Gold VIP Theme', url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=600&auto=format&fit=crop' },
  { id: 'dark_elite', name: 'Dark Elite Theme', url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop' },
  { id: 'galaxy_theme', name: 'Galaxy Cosmic Theme', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=600&auto=format&fit=crop' }
];

const INSTANT_ROOM_PRESETS = [
  {
    id: 'music_party',
    name: '🎵 Elite Karaoke & Music Cafe',
    title: 'Vibe & Beats Music Lounge 🎧',
    desc: 'Listen to custom high-fidelity music tracks, host karaoke sessions and sing with active star guests.',
    category: 'music',
    cover: 'blue_neon'
  },
  {
    id: 'social_chat',
    name: '💬 Late Night Tea & Chat',
    title: 'Moonlight Cozy Fireside Chat ☕',
    desc: 'A serene place to talk, share warm stories, consult stars, and vibe with supportive friends.',
    category: 'social',
    cover: 'purple_luxury'
  },
  {
    id: 'gaming_zone',
    name: '🎮 Gamer\'s Squad Guild',
    title: 'Legends Assembly Gaming Lounge ⚔️',
    desc: 'Join your squad for live pro gaming discussions, PK tournaments, and dynamic clan voice channels.',
    category: 'gaming',
    cover: 'dark_elite'
  },
  {
    id: 'vip_lounge',
    name: '👑 Royals Exclusive VIP Lounge',
    title: 'Prestige Stars Grand VIP Hall 🛡️',
    desc: 'High nobility elite lounge for custom star badges, precious gift exchange, and guild events.',
    category: 'vip',
    cover: 'gold_vip'
  },
  {
    id: 'astrology',
    name: '✨ Cosmic Constellation Hub',
    title: 'Celestial Astro & Tarot Space 🌙',
    desc: 'Verify Mercury retrograde transits and share planetary alignment maps under the starry cosmic void.',
    category: 'social',
    cover: 'galaxy_theme'
  }
];

const RoomThumbnail = ({ src, alt }: { src: string; alt: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative w-full h-full bg-neutral-900">
      {!isLoaded && (
        <div className="absolute inset-0 bg-zinc-900/90 animate-pulse flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-pink-500/20 animate-spin border-t-pink-500" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover group-hover:scale-[1.05] transition-all duration-700 select-none pointer-events-none ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default function HomePage() {
  const { user, profile } = useAuth();
  const currentUser = auth.currentUser || user;
  const navigate = useNavigate();

  // Instant Room Creation Modal States
  const [showInstantCreate, setShowInstantCreate] = useState(false);
  const [instantTitle, setInstantTitle] = useState('');
  const [instantDesc, setInstantDesc] = useState('');
  const [instantCategory, setInstantCategory] = useState('social');
  const [instantCover, setInstantCover] = useState('neon_party');
  const [instantCreating, setInstantCreating] = useState(false);

  // Core Real-time Firebase data states
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const myActiveRoom = useMemo(() => {
    if (!currentUser) return null;
    return rooms.find(r => r.hostId === currentUser.uid && r.isLive !== false);
  }, [rooms, currentUser]);

  // Page active tabs for Room Filters
  const [activeTab, setActiveTab] = useState<'Popular' | 'My Room' | 'Game'>('Popular');
  const [sortBy, setSortBy] = useState<'Trending' | 'Most Recent' | 'Most Popular' | 'High Value Gifts'>('Trending');
  const [onlyActive, setOnlyActive] = useState(true);

  // Interactive Promo Banner states
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showBannerModal, setShowBannerModal] = useState<typeof PREMIUM_BANNERS[0] | null>(null);

  // Leaderboard states
  const [leaderboardTab, setLeaderboardTab] = useState<'hosts' | 'gifters'>('hosts');

  // Search Engine States
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTab, setSearchTab] = useState<'all' | 'users' | 'rooms' | 'agencies' | 'hosts'>('all');
  const [searchUsers, setSearchUsers] = useState<UserProfile[]>([]);
  const [searchAgencies, setSearchAgencies] = useState<any[]>([]);
  const [searchRooms, setSearchRooms] = useState<Room[]>([]);
  const [searchPosts, setSearchPosts] = useState<any[]>([]);

  // Followed tracking list loaded from localStorage for ultra-fast UX & DB syncing
  const [followedUids, setFollowedUids] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('followed_uids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Subscribe to real-time follows from Firestore 'follows' collection
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'follows'), where('followerId', '==', currentUser.uid));
    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const uids = snapshot.docs.map(doc => doc.data().targetId);
      setFollowedUids(uids);
      localStorage.setItem('followed_uids', JSON.stringify(uids));
    }, (error) => {
      console.warn("Follows snapshot offline:", error);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Safe seeding flags to completely prevent parallel execution during rapid snapshot cycles
  const communitySeededRef = useRef(false);
  const roomsSeededRef = useRef(false);

  // Automated Banner Auto-Scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % PREMIUM_BANNERS.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  // 1. Subscribe to the 'force-synchronize' local state room cache manager
  useEffect(() => {
    // Subscribe to centralized RoomCache manager so that updates from any page format
    // or manual trigger are immediately mirrored here in real-time.
    const unsubscribeCache = RoomCache.subscribe((newRooms) => {
      setRooms(newRooms);
    });

    // Also mount safe real-time snapshot subscription to auto-feed our central cache
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeSnapshot = safeOnSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      // Feed into the cache manager to broadcast to all active listeners
      RoomCache.setRooms(roomData);
    }, (error) => {
      console.warn("Rooms live onSnapshot error:", error);
    });

    return () => {
      unsubscribeCache();
      unsubscribeSnapshot();
    };
  }, []);

  // Force-fetch newest rooms from server for manual/cross-device updating
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Syncing latest lounges directly with cloud... 🎙️⚡");
    try {
      await RoomCache.forceSynchronize();
      toast.success("Database rooms fully synchronized with cloud! 🧬", { id: toastId });
    } catch (e) {
      console.warn("Failed to update rooms on user refresh request:", e);
      toast.error("Failed to force update rooms", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  // 1a. Background Hourly Trending Score DB Checker/Updater (Requirement dynamic hourly updates)
  useEffect(() => {
    if (rooms.length === 0) return;
    
    const updateStaleTrendingScores = async () => {
      const now = Date.now();
      const ONE_HOUR_MS = 3600000;
      
      for (const room of rooms) {
        if (room.isLive === false) continue;
        
        const lastUpdate = (room as any).lastTrendingUpdate || 0;
        if (now - lastUpdate > ONE_HOUR_MS) {
          try {
            const currentScore = calculateTrendingScore(room);
            const roomRef = doc(db, 'rooms', room.id);
            await updateDoc(roomRef, {
              trendingScore: currentScore,
              lastTrendingUpdate: now,
              // Rolling joins counter remains intact for the ongoing window
              hourlyJoinCount: (room as any).hourlyJoinCount || 0
            });
            console.log(`[TrendingAlgo] Dynamically updated trending score in Firestore for room ${room.id}: ${currentScore}`);
          } catch (err) {
            console.warn(`[TrendingAlgo] Failed to save trending score to database for room ${room.id}:`, err);
          }
        }
      }
    };

    updateStaleTrendingScores();
  }, [rooms]);

  // 1b. Background Database Sanitizer and Duplicate/Ghost Cleaner (ISSUE 6)
  useEffect(() => {
    if (!currentUser) return;
    const cleanDatabaseRecords = async () => {
      try {
        const roomsRef = collection(db, 'rooms');
        const snap = await getDocs(roomsRef);
        const allRooms = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
        
        // Group rooms by host ID
        const hostRoomsMap: { [hostId: string]: Room[] } = {};
        const SEED_ROOM_IDS = new Set([
          'room_star_mic',
          'room_gaming_arena',
          'room_cozy_chat',
          'room_summer_solstice',
          'room_astrology'
        ]);

        allRooms.forEach(room => {
          if (SEED_ROOM_IDS.has(room.id)) return;
          if (!room.hostId) return;
          if (room.hostId !== currentUser.uid) return; // Only process our own rooms to avoid permission errors
          
          if (!hostRoomsMap[room.hostId]) {
            hostRoomsMap[room.hostId] = [];
          }
          hostRoomsMap[room.hostId].push(room);
        });

        // Resolve Host duplicates: Keep only the single newest room per host
        for (const hostId in hostRoomsMap) {
          const rooms = hostRoomsMap[hostId];
          if (rooms.length > 1) {
            // Sort by createdAt descending (newest first)
            rooms.sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime;
            });
            
            const newestRoom = rooms[0];
            const duplicateRooms = rooms.slice(1);
            
            console.log(`Database Validation: Host ${hostId} has ${rooms.length} rooms. Keeping newest room ${newestRoom.id}, purging others:`, duplicateRooms.map(r => r.id));
            
            for (const dupRoom of duplicateRooms) {
              try {
                await deleteDoc(doc(db, 'rooms', dupRoom.id));
              } catch (err) {
                console.warn(`Failed to delete duplicate room record ${dupRoom.id}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Database Validation Sanitizer error:", err);
      }
    };

    // Run once on load/authenticate
    cleanDatabaseRecords();
  }, [currentUser]);

  // 2. Subscribe to real-time community users
  useEffect(() => {
    const q = query(collection(db, 'users'), limit(100));
    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(list);
    }, (error) => {
      console.warn("Users snapshot offline:", error);
    });
    return () => unsubscribe();
  }, []);

  // 3. Automated Seeder to eliminate blank star and room boards - ENABLED FOR STABLE DEMO CONTENT
  useEffect(() => {
    // If the database is initially empty or only has the logged-in user, seed high-fidelity records
    if (users.length > 1 || communitySeededRef.current) return;
    communitySeededRef.current = true;

    async function seedCommunityData() {
      try {
        const seedUsersList = [
          {
            uid: 'siddharth_royal',
            displayName: 'Siddharth Malhotra 🇮🇳',
            numericId: '984501239',
            gender: 'male',
            age: 26,
            photoURL: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
            bio: 'Elite Diamond Gifter 💎 | Music enthusiast and tech startup founder in Bangalore.',
            coins: 18500,
            diamonds: 3200,
            level: 15,
            experience: 85000,
            followersCount: 1450,
            followingCount: 380,
            visitorsCount: 2200,
            isVIP: false,
            badges: ['Top King 👑', 'Elite Gifter'],
            country: 'India',
            language: 'Hindi',
            lastLogin: new Date().toISOString()
          },
          {
            uid: 'anya_star',
            displayName: 'Anya Sharma ✨',
            numericId: '102394850',
            gender: 'female',
            age: 22,
            photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
            bio: 'Vocal Musician & Hindustani Classical Podcaster. Mumbai local. 🎙️ Melody is life!',
            coins: 2500,
            diamonds: 18900,
            level: 12,
            experience: 49000,
            followersCount: 3120,
            followingCount: 420,
            visitorsCount: 5400,
            isVIP: false,
            badges: ['Star DJ 🎧', 'Vocal Queen'],
            country: 'India',
            language: 'Hindi',
            lastLogin: new Date(Date.now() - 3600000).toISOString()
          },
          {
            uid: 'zara_beats',
            displayName: 'Zoya Khan 🎧',
            numericId: '293840192',
            gender: 'female',
            age: 24,
            photoURL: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop',
            bio: 'Deep Tech & Melodic House DJ. Streaming summer Bollywood acoustic mashups daily! ⚡',
            coins: 4500,
            diamonds: 12400,
            level: 13,
            experience: 72000,
            followersCount: 4890,
            followingCount: 210,
            visitorsCount: 8900,
            isVIP: false,
            badges: ['Room Legend', 'Sound Waves'],
            country: 'India',
            language: 'English',
            lastLogin: new Date(Date.now() - 3600000 * 3).toISOString()
          },
          {
            uid: 'kabir_vocals',
            displayName: 'Kabir Sen Sufi 🎙️',
            numericId: '839201948',
            gender: 'male',
            age: 28,
            photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
            bio: 'Classical Sufi Singer & Retro Soundscape lover. Join my room for late-night chai and ghazals.',
            coins: 900,
            diamonds: 4500,
            level: 10,
            experience: 31000,
            followersCount: 1980,
            followingCount: 540,
            visitorsCount: 2100,
            isVIP: false,
            badges: ['Golden Voice 🎙️', 'Acoustic Poet'],
            country: 'India',
            language: 'Hindi',
            lastLogin: new Date(Date.now() - 3600000 * 12).toISOString()
          },
          {
            uid: 'mia_chat',
            displayName: 'Diya Iyer 🌸',
            numericId: '473829102',
            gender: 'female',
            age: 21,
            photoURL: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
            bio: 'Bilingual conversationalist. Exploring poetry, regional literature, and general sweet chats! 👋',
            coins: 1250,
            diamonds: 1800,
            level: 7,
            experience: 15000,
            followersCount: 920,
            followingCount: 650,
            visitorsCount: 1100,
            isVIP: false,
            badges: ['Rising Star', 'Active Chatter'],
            country: 'India',
            language: 'Tamil',
            lastLogin: new Date(Date.now() - 3600000 * 24).toISOString()
          }
        ];

        for (const u of seedUsersList) {
          const userRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, u);
          }
        }
      } catch (err) {
        console.warn("Failing seeding community", err);
      }
    }
    seedCommunityData();
  }, [users.length]);

  useEffect(() => {
    if (rooms.length > 0 || roomsSeededRef.current) return;
    roomsSeededRef.current = true;

    async function seedLoungeRooms() {
      try {
        const sampleRoomsList = [
          {
            id: 'room_star_mic',
            title: '⭐️ Bollywood Retro Starlight Nights 🎤',
            description: 'Official voice tournament show! Jump in and showcase your singing talents under golden sparkles.',
            hostId: 'anya_star',
            hostName: 'Anya Sharma ✨',
            coHostIds: [],
            superAdminIds: [],
            memberCount: 26,
            category: 'singing',
            backgroundTheme: 'mystical_star',
            thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop',
            isLive: true,
            createdAt: new Date().toISOString(),
            seatCount: 8,
            seats: [
              { index: 0, uid: 'anya_star', isLocked: false, isMuted: false },
              { index: 1, uid: 'kabir_vocals', isLocked: false, isMuted: false },
              { index: 2, uid: null, isLocked: false, isMuted: false },
              { index: 3, uid: null, isLocked: false, isMuted: false },
              { index: 4, uid: null, isLocked: false, isMuted: false },
              { index: 5, uid: null, isLocked: false, isMuted: false },
              { index: 6, uid: null, isLocked: false, isMuted: false },
              { index: 7, uid: null, isLocked: false, isMuted: false }
            ]
          },
          {
            id: 'room_gaming_arena',
            title: '🎮 Battlegrounds India Clan Meetup ⚡',
            description: 'Sound-synced combat strategy forum. Seats open for clan tire matches.',
            hostId: 'zara_beats',
            hostName: 'Zoya Khan 🎧',
            coHostIds: [],
            superAdminIds: [],
            memberCount: 38,
            category: 'gaming',
            backgroundTheme: 'neon_cyberpunk',
            thumbnailUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=600&auto=format&fit=crop',
            isLive: true,
            createdAt: new Date().toISOString(),
            seatCount: 8,
            seats: [
              { index: 0, uid: 'zara_beats', isLocked: false, isMuted: false },
              { index: 1, uid: 'siddharth_royal', isLocked: false, isMuted: false },
              { index: 2, uid: null, isLocked: false, isMuted: false },
              { index: 3, uid: null, isLocked: false, isMuted: false },
              { index: 4, uid: null, isLocked: false, isMuted: false },
              { index: 5, uid: null, isLocked: false, isMuted: false },
              { index: 6, uid: null, isLocked: false, isMuted: false },
              { index: 7, uid: null, isLocked: false, isMuted: false }
            ]
          },
          {
            id: 'room_cozy_chat',
            title: '💬 Late Night Chai & Ghazal Talks ☕',
            description: 'Chill vibes, cozy lofi music, regional poetry, and warm check-ins over tea.',
            hostId: 'mia_chat',
            hostName: 'Diya Iyer 🌸',
            coHostIds: [],
            superAdminIds: [],
            memberCount: 15,
            category: 'chat',
            backgroundTheme: 'mystical_star',
            thumbnailUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop',
            isLive: true,
            createdAt: new Date().toISOString(),
            seatCount: 8,
            seats: [
              { index: 0, uid: 'mia_chat', isLocked: false, isMuted: false },
              { index: 1, uid: null, isLocked: false, isMuted: false },
              { index: 2, uid: null, isLocked: false, isMuted: false },
              { index: 3, uid: null, isLocked: false, isMuted: false },
              { index: 4, uid: null, isLocked: false, isMuted: false },
              { index: 5, uid: null, isLocked: false, isMuted: false },
              { index: 6, uid: null, isLocked: false, isMuted: false },
              { index: 7, uid: null, isLocked: false, isMuted: false }
            ]
          },
          {
            id: 'room_summer_solstice',
            title: '🌅 Goa Sunset Lounge Beats & DJ Remixes 🎧',
            description: 'Relax with chill-house acoustic sets and starlight dance sounds. Cozy beach vibes.',
            hostId: 'zara_beats',
            hostName: 'Zoya Khan 🎧',
            coHostIds: [],
            superAdminIds: [],
            memberCount: 18,
            category: 'singing',
            backgroundTheme: 'sunset_glow',
            thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
            isLive: true,
            createdAt: new Date().toISOString(),
            seatCount: 8,
            seats: [
              { index: 0, uid: 'zara_beats', isLocked: false, isMuted: false },
              { index: 1, uid: null, isLocked: false, isMuted: false },
              { index: 2, uid: null, isLocked: false, isMuted: false },
              { index: 3, uid: null, isLocked: false, isMuted: false },
              { index: 4, uid: null, isLocked: false, isMuted: false },
              { index: 5, uid: null, isLocked: false, isMuted: false },
              { index: 6, uid: null, isLocked: false, isMuted: false },
              { index: 7, uid: null, isLocked: false, isMuted: false }
            ]
          },
          {
            id: 'room_astrology',
            title: '🪐 Vedic Astrology Aura & Kundli Readings 🔮',
            description: 'Aligning your zodiac vibration with customized kundli compatibility. Live tarot sessions!',
            hostId: 'siddharth_royal',
            hostName: 'Siddharth Malhotra 🇮🇳',
            coHostIds: [],
            superAdminIds: [],
            memberCount: 12,
            category: 'chat',
            backgroundTheme: 'mystical_star',
            thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
            isLive: true,
            createdAt: new Date().toISOString(),
            seatCount: 8,
            seats: [
              { index: 0, uid: 'siddharth_royal', isLocked: false, isMuted: false },
              { index: 1, uid: null, isLocked: false, isMuted: false },
              { index: 2, uid: null, isLocked: false, isMuted: false },
              { index: 3, uid: null, isLocked: false, isMuted: false },
              { index: 4, uid: null, isLocked: false, isMuted: false },
              { index: 5, uid: null, isLocked: false, isMuted: false },
              { index: 6, uid: null, isLocked: false, isMuted: false },
              { index: 7, uid: null, isLocked: false, isMuted: false }
            ]
          }
        ];

        for (const r of sampleRoomsList) {
          const roomRef = doc(db, 'rooms', r.id);
          const snap = await getDoc(roomRef);
          if (!snap.exists()) {
            await setDoc(roomRef, r);
          }
        }
      } catch (err) {
        console.warn("Failing seeding rooms", err);
      }
    }
    seedLoungeRooms();
  }, [rooms.length]);

  // Real-time prefetch setup for multi-class instant Search suggestions
  useEffect(() => {
    if (!showSearchOverlay) return;

    async function prefetchSearchAssets() {
      try {
        const uSnap = await getDocs(query(collection(db, 'users'), limit(100)));
        setSearchUsers(uSnap.docs.map(d => d.data() as UserProfile));

        const rSnap = await getDocs(query(collection(db, 'rooms'), limit(40)));
        setSearchRooms(rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));

        // Agencies prefetch (safely handles missing collection gracefully)
        const aSnap = await getDocs(query(collection(db, 'agencies'), limit(20)));
        setSearchAgencies(aSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Moments posts matches
        const pSnap = await getDocs(query(collection(db, 'posts'), limit(30)));
        setSearchPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn("Seeding or fetching search index error:", err);
      }
    }
    prefetchSearchAssets();
  }, [showSearchOverlay]);

  // Derived filtered rooms list using selected state filters
  const filteredAndSortedRooms = useMemo(() => {
    // Keep only one active room per unique hostId to guarantee absolute room-owner uniqueness
    const uniqueHostRooms: Room[] = [];
    const seenHosts = new Set<string>();

    const sortedAllRooms = [...rooms].sort((a, b) => {
      const getMs = (r: Room) => (r.createdAt ? new Date(r.createdAt).getTime() : 0);
      return getMs(b) - getMs(a);
    });

    for (const r of sortedAllRooms) {
      if (onlyActive && r.isLive === false) continue; // Skip closed or non-live rooms if onlyActive is enabled
      if (!r.hostId) {
        uniqueHostRooms.push(r);
      } else if (!seenHosts.has(r.hostId)) {
        seenHosts.add(r.hostId);
        uniqueHostRooms.push(r);
      }
    }

    return uniqueHostRooms
      .filter(room => {
        if (onlyActive && room.isLive === false) return false;
        if (activeTab === 'My Room') {
          return room.hostId === currentUser?.uid;
        }
        if (activeTab === 'Game') {
          return room.category === 'gaming';
        }
        return true; 
      })
      .sort((a, b) => {
        if (sortBy === 'Trending') {
          return calculateTrendingScore(b) - calculateTrendingScore(a);
        } else if (sortBy === 'Most Popular') {
          return (b.memberCount || 0) - (a.memberCount || 0);
        } else if (sortBy === 'High Value Gifts') {
          const giftA = (a as any).giftVolume || 0;
          const giftB = (b as any).giftVolume || 0;
          return giftB - giftA;
        } else {
          // Most Recent
          const getMs = (r: Room) => {
            if (!r.createdAt) return 0;
            return new Date(r.createdAt).getTime();
          };
          return getMs(b) - getMs(a);
        }
      });
  }, [rooms, activeTab, sortBy, currentUser, onlyActive]);

  // Derived Trending Users data based on dynamic algorithmic parameters (Requirement 3)
  const trendingUsersData = useMemo(() => {
    return [...users]
      .map(u => {
        const giftCount = u.diamonds || 0;
        const followers = u.followersCount || 0;
        const experience = u.experience || 0;
        const activityScore = (followers * 15) + (giftCount * 4) + (u.level * 350) + (experience / 100);
        const achievementsList = [
          'Microphone Master 🎙️', 'Top Diamond Gifter 💎', 'Prestige Host ⭐', 'Rising Voice Star 📈', 'Lounge Sovereign 👑'
        ];
        return {
          ...u,
          activityScore,
          achievement: u.badges?.[0] || achievementsList[u.level % achievementsList.length]
        };
      })
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);
  }, [users]);

  // Derived New Users welcome list recently registered (Requirement 2)
  const newUsersData = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const timeA = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const timeB = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return timeB - timeA;
      })
      .filter(u => u.uid !== currentUser?.uid)
      .slice(0, 10);
  }, [users]);

  // Derived real-time following feed item compute (Requirement 1 & 10)
  const followingFeedItems = useMemo(() => {
    if (!currentUser) return [];
    
    const items = followedUids.map(uid => {
      const uProfile = users.find(u => u.uid === uid);
      if (!uProfile) return null;
      
      // Look for any live room hosted by this followed user
      const liveRoom = rooms.find(r => r.hostId === uid && r.isLive !== false);
      
      return {
        profile: uProfile,
        liveRoom: liveRoom || null,
        isLive: !!liveRoom
      };
    })
    .filter(Boolean) as { profile: UserProfile; liveRoom: Room | null; isLive: boolean }[];
    
    return items.sort((a, b) => {
      // Sort live users first
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return 0;
    });
  }, [followedUids, users, rooms, currentUser]);

  // Leaderboard data derived dynamically (Requirement 5)
  const hostsLeaderboardData = useMemo(() => {
    return [...users]
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 10);
  }, [users]);

  const giftersLeaderboardData = useMemo(() => {
    return [...users]
      .sort((a, b) => (b.coins || 0) - (a.coins || 0))
      .slice(0, 10);
  }, [users]);

  // Follow and Unfollow syncing toggle directly with Firestore (Requirement 2 & 10)
  const handleFollowUser = async (targetUid: string) => {
    if (!currentUser) {
      toast.error('Log in first to connect with other voice star nobles!');
      return;
    }
    if (currentUser.uid === targetUid) {
      toast.error('You cannot follow your own royal star channel!');
      return;
    }

    const isFollowing = followedUids.includes(targetUid);
    const updated = isFollowing 
      ? followedUids.filter(x => x !== targetUid)
      : [...followedUids, targetUid];

    setFollowedUids(updated);
    localStorage.setItem('followed_uids', JSON.stringify(updated));

    try {
      const followDocId = `${currentUser.uid}_${targetUid}`;
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followDocId));
      } else {
        await setDoc(doc(db, 'follows', followDocId), {
          followerId: currentUser.uid,
          targetId: targetUid,
          timestamp: new Date().toISOString()
        });
      }

      const targetUserRef = doc(db, 'users', targetUid);
      const differenceVal = isFollowing ? -1 : 1;
      await updateDoc(targetUserRef, {
        followersCount: increment(differenceVal)
      });

      if (isFollowing) {
        toast.info('No longer following this star profile.');
      } else {
        toast.success('Successfully added to your follow deck! ✨');
      }
    } catch (err) {
      console.error("DB Follow Sync Error:", err);
      toast.error('Error saving follow status to cloud database.');
    }
  };

  // Quick Action triggers (Requirement 7)
  const handleCreateRoom = () => {
    if (myActiveRoom) {
      toast.success('Navigating to your active live room! 🎙️');
      navigate(`/room/${myActiveRoom.id}`);
    } else {
      setShowInstantCreate(true);
    }
  };

  const handleInstantCreateRoom = async () => {
    if (!currentUser) {
      toast.error('You must be logged in to create a room.');
      return;
    }
    if (!instantTitle.trim()) {
      toast.error('Please enter a Room Title.');
      return;
    }

    setInstantCreating(true);
    const toastId = toast.loading('Constructing space instantly... 🚀🎙️');

    try {
      const generatedId = Math.floor(100000000 + Math.random() * 900000000).toString();
      const roomsRef = collection(db, 'rooms');
      const newRoomRef = doc(roomsRef, generatedId);

      const chosenCover = PREMIUM_BACKGROUNDS_PRESET.find(b => b.id === instantCover)?.url || PREMIUM_BACKGROUNDS_PRESET[0].url;
      const nowISO = new Date().toISOString();
      const parsedSeatsCount = 8;

      const newRoom = {
        id: generatedId,
        title: instantTitle.trim(),
        description: instantDesc.trim(),
        thumbnailUrl: chosenCover,
        hostId: currentUser.uid,
        hostName: currentUser.displayName || 'Guest',
        hostPhoto: currentUser.photoURL || getPremiumAvatar(currentUser.uid),
        memberCount: 1, 
        createdAt: nowISO,
        category: instantCategory, 
        roomType: 'standard',
        language: 'English',
        password: '',
        welcomeMessage: 'Welcome! Tap a seat to join the mic & vibe together in harmony! ✨🎙️',
        tags: ['#Instant', `#${instantCategory.toUpperCase()}`, '#SoulLink'],
        musicEnabled: true,
        seatCount: parsedSeatsCount,
        userLimit: 100,
        backgroundTheme: instantCover,
        isLive: true,
        giftVolume: 0,
        hourlyJoinCount: 1,
        trendingScore: 0,
        lastTrendingUpdate: Date.now(),
        seats: Array.from({ length: parsedSeatsCount }, (_, i) => ({
          index: i,
          uid: i === 0 ? currentUser.uid : null, // Host automatically occupies seat #0
          isLocked: false,
          isMuted: false,
          role: i === 0 ? 'owner' : null
        })),
        superAdminIds: [],
        coHostIds: []
      };

      // Concurrent setDoc writes to Firestore to guarantee immediate consistency
      const memberRef = doc(db, 'rooms', generatedId, 'members', currentUser.uid);
      await Promise.all([
        setDoc(newRoomRef, newRoom),
        setDoc(memberRef, {
          uid: currentUser.uid,
          role: 'host',
          displayName: currentUser.displayName || 'Guest',
          photoURL: currentUser.photoURL || getPremiumAvatar(currentUser.uid),
          joinedAt: nowISO
        })
      ]);

      // Force Sync Cache so it immediately displays correctly on list without delay
      RoomCache.forceSynchronize(newRoom as unknown as Room).catch((cacheErr) => {
        console.warn("Ignoring cache synchronization exception:", cacheErr);
      });

      localStorage.setItem(`persistent_room_${currentUser.uid}`, generatedId);
      
      toast.success('Your room is live instantly! 🎙️✨', { id: toastId });
      setShowInstantCreate(false);
      navigate(`/room/${generatedId}`);
    } catch (error) {
      console.error("Instant Room creation error:", error);
      toast.error('Failed to create room. Please verify your connection.', { id: toastId });
    } finally {
      setInstantCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string, designRoom?: any) => {
    if (roomId.startsWith('demo_room_')) {
      // Seed the demo room in Firestore before loading so RoomPage handles it organically (No 404 Room not found timeouts!)
      try {
        const roomRef = doc(db, 'rooms', roomId);
        const snap = await getDoc(roomRef);
        if (!snap.exists() && designRoom) {
          const initialSeats = Array.from({ length: 9 }, (_, i) => ({
            index: i,
            uid: i === 0 ? designRoom.hostId : null,
            isLocked: false,
            isMuted: false
          }));
          await setDoc(roomRef, {
            ...designRoom,
            seats: initialSeats,
            seatCount: 9,
            createdAt: new Date().toISOString(),
            isLive: true,
            memberCount: 1,
            userLimit: designRoom.userLimit || 25,
            giftVolume: 0
          });
        }
      } catch (e) {
        console.warn("Failed to auto-seed demo room layout on Firestore:", e);
      }
    }
    navigate(`/room/${roomId}`);
  };

  const handlePartyHop = () => {
    const liveRooms = rooms.filter(r => r.isLive !== false);
    if (liveRooms.length === 0) {
      toast.error('No live party lounges online right now. Let us build your custom vocal stage!');
      navigate('/room/create');
      return;
    }
    // Join the absolute busiest live room in real-time
    const sorted = [...liveRooms].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    const target = sorted[0];
    toast.success(`Leaping into popular station: "${target.title}"! 🚀`);
    navigate(`/room/${target.id}`);
  };

  const handleShareRoom = async (e: React.MouseEvent, room: Room) => {
    e.stopPropagation();
    const inviteLink = `${window.location.origin}/room/${room.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: room.title,
          text: `Join the live party lounge "${room.title}" on SoulLink! 🎙️✨`,
          url: inviteLink
        });
        toast.success("Shared successfully! 🚀");
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          copyRoomLinkToClipboard(inviteLink);
        }
      }
    } else {
      copyRoomLinkToClipboard(inviteLink);
    }
  };

  const copyRoomLinkToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          toast.success("Direct invite link copied to clipboard! 📋✨");
        })
        .catch(() => {
          toast.error("Failed to copy invite link.");
        });
    } else {
      toast.error("Sharing or clipboard not supported by your browser.");
    }
  };

  const handleQuickJoin = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    // Overriding any current room context by simply initiating immediate route traversal
    toast.success("Quick Joined - leaping directly into lounge! ⚡🚀");
    navigate(`/room/${roomId}`);
  };

  const handleFindCompanions = () => {
    setShowSearchOverlay(true);
    // Instant input focusing
    setTimeout(() => {
      const el = document.getElementById('search-hub-input');
      if (el) el.focus();
    }, 150);
  };

  const handleInviteNobles = () => {
    const inviteLink = window.location.origin;
    const message = `👑 Join my premium circle on the Maxo Social-Audio Lounge! Meet elite voice stars and join high-fidelity audio rooms. Experience live starlight vocals here: ${inviteLink}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message)
        .then(() => {
          toast.success('Royal Invitation copied to clipboard! Share it with friends. 🎖️');
        })
        .catch(() => {
          toast.error('Failed to copy. Share current URL to invite!');
        });
    } else {
      toast.error('Share current URL to invite your core circle!');
    }
  };

  // Improved Advanced Search suggestions filtering (Requirement 8)
  const filteredUsers = useMemo(() => {
    return searchUsers.filter(u => 
      u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchUsers, searchTerm]);

  const filteredRooms = useMemo(() => {
    return searchRooms.filter(r => 
      r.isLive !== false &&
      (r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.category && r.category.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [searchRooms, searchTerm]);

  const filteredAgencies = useMemo(() => {
    return searchAgencies.filter(a => 
      a.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchAgencies, searchTerm]);

  const filteredHosts = useMemo(() => {
    return searchUsers.filter(u => 
      (u.isHostApproved || u.level >= 5) && 
      (u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchUsers, searchTerm]);

  const activePromoBanner = PREMIUM_BANNERS[currentBanner];

  return (
    <div className="bg-[#030303] min-h-screen text-white pb-32 font-sans antialiased relative overflow-x-hidden">
      
      {/* Background Star Ambient Glow */}
      <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-[#200B1A] via-[#0D0B16] to-[#030303] -z-10 animate-fade-in" />
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* TOP COMPONENT HEADER MATCHING SCREENSHOT 1 */}
      <header className="sticky top-0 z-40 bg-[#030303]/90 backdrop-blur-md border-b border-white/5 py-4 px-5 flex justify-between items-center transition-all">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/')}
            className="text-xl font-black uppercase tracking-tight relative transition-all text-white bg-transparent border-none outline-none cursor-pointer"
          >
            SoulLink
            <span className="absolute -bottom-1.5 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-[#FF4D67] rounded-full" />
          </button>
        </div>

        <div className="flex items-center gap-3.5">
          <button 
            onClick={handleFindCompanions}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-white bg-transparent border-none cursor-pointer"
            title="Search companions"
          >
            <Search size={22} className="stroke-[2.5]" />
          </button>

          <button 
            onClick={() => {
              const element = document.getElementById('leaderboards-showcase');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              } else {
                toast.info("Winner board is displayed below! 🏆");
              }
            }}
            className="p-1 hover:bg-white/10 rounded-full transition-colors text-amber-400 hover:text-amber-300 bg-transparent border-none cursor-pointer"
            title="Winner Leaderboards"
          >
            <Trophy size={22} className="stroke-[2.5]" />
          </button>

          <div 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full border-[1.5px] border-[#FF4D67] p-[1.5px] cursor-pointer hover:border-amber-400 transition-all shadow-md overflow-hidden bg-white shrink-0 flex items-center justify-center relative z-10"
            title="My Account Profile"
          >
            <img 
              src={profile?.photoURL || getPremiumAvatar(profile?.uid || 'user')} 
              alt="me avatar" 
              className="w-full h-full object-cover rounded-full" 
            />
          </div>
        </div>
      </header>

      {/* CORE WRAPPED CONTENT PANEL */}
      <main className="max-w-xl mx-auto px-5 pt-4 space-y-6 select-none">
        
        {/* PREMIUM PROMOTIONAL BANNER CAROUSEL (Requirement 6) */}
        <ErrorBoundary>
          <section id="promo-carousel" className="relative group">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePromoBanner.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.5 }}
              onClick={() => setShowBannerModal(activePromoBanner)}
              className={`w-full aspect-[21/9] sm:aspect-[24/8] md:aspect-[30/8] rounded-[24px] bg-gradient-to-r ${activePromoBanner.gradient} p-[1.5px] border cursor-pointer relative overflow-hidden shadow-2xl transition-all duration-300 hover:scale-[1.015]`}
            >
              <div className="bg-[#0C0F19]/90 rounded-[24px] w-full h-full p-4.5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 h-full pointer-events-none">
                  <img src={activePromoBanner.image} className="w-full h-full object-cover rounded-r-[24px] mix-blend-luminosity brightness-75 select-none" alt="" />
                </div>
                <div className="absolute left-0 right-0 bottom-0 top-0 bg-gradient-to-r from-[#0C0F19] via-[#0C0F19]/80 to-transparent pointer-events-none z-0" />

                {/* Banner Header Tag */}
                <div className="z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#F43F5E] rounded-full animate-ping" />
                    <span className="text-[8px] sm:text-[9px] font-black tracking-widest text-[#F43F5E] uppercase bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                      {activePromoBanner.badge}
                    </span>
                  </div>
                  <span className="text-xl sm:text-2xl">{activePromoBanner.icon}</span>
                </div>

                {/* Banner Titles */}
                <div className="z-10 mt-2 sm:mt-4 space-y-1">
                  <h4 className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                    {activePromoBanner.subtitle}
                  </h4>
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight leading-snug font-display line-clamp-1">
                    {activePromoBanner.title}
                  </h2>
                </div>

                {/* Bottom Action Footer */}
                <div className="z-10 flex items-center justify-between text-[9px] sm:text-xs pt-2 border-t border-white/5">
                  <span className="text-gray-400 font-bold flex items-center gap-1.5 shrink-0">
                    <Calendar size={12} className="text-amber-500 shrink-0" /> {activePromoBanner.duration}
                  </span>
                  <div className="flex items-center gap-1 font-black text-amber-400 uppercase tracking-wider group-hover:text-white transition-colors">
                    <span>{activePromoBanner.actionText}</span>
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Carousel dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {PREMIUM_BANNERS.map((banner, index) => (
              <span 
                key={banner.id}
                onClick={() => setCurrentBanner(index)}
                className={`w-6 h-1 rounded-full transition-all duration-300 cursor-pointer ${currentBanner === index ? 'bg-pink-500' : 'bg-white/15 hover:bg-white/35'}`}
              />
            ))}
          </div>
        </section>

        {/* HIGH-FIDELITY INTERACTIVE BANNER DETAIL MODAL */}
        <AnimatePresence>
          {showBannerModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#06080C]/80 backdrop-blur-lg z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 30 }}
                className={`glass-card max-w-lg w-full bg-gradient-to-b ${showBannerModal.gradient} p-[1.5px] shadow-2xl relative overflow-hidden`}
              >
                <div className="bg-[#0D101C]/96 p-6 rounded-2xl relative space-y-6">
                  <button 
                    onClick={() => setShowBannerModal(null)}
                    className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center border border-white/10 transition-transform active:scale-90"
                  >
                    <X size={16} />
                  </button>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-[#F43F5E] uppercase bg-rose-500/10 px-2.5 py-1 rounded">
                      {showBannerModal.badge}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white font-display mt-2 leading-snug">
                      {showBannerModal.title}
                    </h3>
                    <p className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Duration: {showBannerModal.duration}
                    </p>
                  </div>

                  <p className="text-xs text-gray-300 font-semibold leading-relaxed">
                    {showBannerModal.desc}
                  </p>

                  <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Trophy size={14} className="text-yellow-500" />
                      <span className="text-[10px] font-black text-yellow-400 tracking-wider uppercase">EXCLUSIVE REWARDS POOL</span>
                    </div>
                    <p className="text-xs text-white font-black leading-snug">
                      {showBannerModal.reward}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={() => setShowBannerModal(null)}
                      className="flex-1 h-11 bg-white/5 border border-white/10 hover:bg-white/10 font-black text-xs uppercase rounded-xl transition-all active:scale-95"
                    >
                      Close Detail
                    </Button>
                    <Button 
                      onClick={() => {
                        setShowBannerModal(null);
                        toast.success(`You registered successfully for the ${showBannerModal.title}! Complete daily objectives to claim rewards. 🎉`);
                      }}
                      className="flex-1 h-11 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 hover:opacity-90 font-black text-xs uppercase rounded-xl shadow-xl shadow-pink-500/10 transition-all active:scale-95 text-white border-0"
                    >
                      {showBannerModal.actionText}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </ErrorBoundary>
        {/* 2 COLUMN GRID layout on widescreen devices, block stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT 7 PANELS: ROOM BOARD */}
          <div className="lg:col-span-8 space-y-10">

            {/* POPULAR VOICE LOBBIES (Requirement 4) */}
            <ErrorBoundary>
            <section id="popular-rooms-dashboard" className="space-y-4 transition-all duration-300 hover:scale-[1.005] hover:shadow-[0_12px_45px_rgba(236,72,153,0.06)] rounded-[24px] p-2 hover:bg-white/[0.005]">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-pink-500 font-extrabold tracking-widest uppercase">REAL-TIME PUBLIC BROADCASTS</span>
                  <div className="flex items-center gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 font-sans tracking-tight">
                      Popular Voice Rooms <Radio size={16} className="text-green-500 animate-pulse shrink-0" />
                    </h3>
                    <button
                      onClick={() => navigate('/room/create')}
                      className="text-[8.5px] font-black text-amber-400 border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 rounded-full uppercase tracking-wider hover:bg-amber-400/10 transition-colors flex items-center gap-1 shrink-0 scale-90"
                      title="Launch custom voice party room"
                    >
                      <Plus size={8} className="stroke-[3]" /> Launch Room
                    </button>
                  </div>
                </div>

                {/* Categories Tab Selector & real database controls */}
                <div className="flex items-center gap-1.5 overflow-x-auto select-none max-w-[200px] sm:max-w-xs no-scrollbar shrink-0">
                  {(['Popular', 'Game'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 text-[10px] font-black rounded-full border transition-all ${
                        activeTab === tab 
                          ? 'bg-white text-black border-white' 
                          : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sorting filters */}
              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {(['Trending', 'Most Recent', 'Most Popular', 'High Value Gifts'] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setSortBy(opt)}
                      className={`px-3.5 py-1 text-[9px] font-bold rounded-xl border flex items-center gap-1 shrink-0 transition-all ${
                        sortBy === opt 
                          ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white border-transparent' 
                          : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                      }`}
                    >
                      <span>{opt === 'Trending' ? '📈' : opt === 'Most Recent' ? '⏳' : opt === 'Most Popular' ? '🔥' : '🎁'}</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>

                {/* Filter toggle button & Force Cloud Sync Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setOnlyActive(!onlyActive)}
                    className={`px-2.5 py-1 rounded-xl border flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all select-none cursor-pointer ${
                      onlyActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-white/5 text-gray-400 border-white/5 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${onlyActive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span>{onlyActive ? 'Active Live' : 'All Rooms'}</span>
                  </button>

                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="p-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 hover:border-pink-500/20 text-pink-400 hover:text-pink-300 hover:bg-white/10 active:scale-95 transition-all shrink-0 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
                    title="Direct Database Cloud Sync"
                  >
                    <RotateCw size={9} className={`stroke-[3] ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>
              </div>

              {/* Real Database Rooms renderer */}
              {filteredAndSortedRooms.length === 0 ? (
                <div className="glass-card py-16 text-center space-y-4">
                  <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-500 border border-white/5">
                    <Mic2 size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 font-extrabold text-xs uppercase tracking-wider">No Active Rooms</p>
                    <p className="text-[10px] text-gray-500 font-medium">Be the first to secure a custom live sound stage!</p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={handleCreateRoom}
                    className="bg-gradient-to-r from-pink-500 to-indigo-500 font-black uppercase text-[10px] rounded-xl border-0 h-9 px-4 text-white hover:opacity-90 active:scale-95"
                  >
                    Discover Rooms
                  </Button>
                </div>
              ) : (
                <motion.div 
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: {
                        staggerChildren: 0.08,
                      }
                    }
                  }}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  {filteredAndSortedRooms.map((room, index) => {
                    const hostDetails = users.find(u => u.uid === room.hostId);
                    const hostDisplayName = hostDetails?.displayName || room.hostName || 'Lounge Host';
                    const isRoomLive = room.isLive !== false; // Active rooms are live by default if listed

                    return (
                      <motion.div
                        key={room.id}
                        variants={{
                          hidden: { opacity: 0, y: 16 },
                          show: { 
                            opacity: 1, 
                            y: 0,
                            transition: {
                              type: "spring",
                              stiffness: 300,
                              damping: 24
                            }
                          }
                        }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 450,
                          damping: 25,
                          y: { duration: 0.2 },
                          scale: { duration: 0.2 }
                        }}
                        onClick={() => handleJoinRoom(room.id, room)}
                        className={`group relative rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] border p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 cursor-pointer select-none shadow-xl transition-all ${
                          isRoomLive 
                            ? 'border-emerald-500/15 hover:border-emerald-400/40 hover:shadow-[0_4px_30px_rgba(16,185,129,0.08)]' 
                            : 'border-white/5 hover:border-amber-400/30 hover:shadow-[0_4px_30px_rgba(234,179,8,0.1)]'
                        }`}
                      >
                        {/* Real-time Member Count Pill Badge in Top Right */}
                        <div className="absolute top-2.5 right-2 flex items-center gap-1 bg-[#09090C]/80 border border-emerald-500/30 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-emerald-400 backdrop-blur-sm z-20 transition-transform group-hover:scale-105 shadow-md">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse animate-ping" />
                          <span className="w-1 h-1 rounded-full bg-emerald-500 absolute" />
                          <span>{room.memberCount || 1} online</span>
                        </div>

                        {/* Compact Rounded Thumbnail & Status badges on top of it */}
                        <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/10 shadow-inner">
                          <RoomThumbnail 
                            src={room.thumbnailUrl || `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop`} 
                            alt={room.title}
                          />
                          {/* Ambient live voice pulses on top of thumbnail */}
                          {isRoomLive && (
                            <div className="absolute right-1.2 bottom-1.2 bg-emerald-500/90 text-white backdrop-blur-md px-1.5 py-0.5 rounded-md flex items-center gap-1 z-20 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse">
                              <span className="w-1.5 h-1.5 bg-white rounded-full" />
                              <span className="text-[7px] font-black tracking-wider uppercase">LIVE</span>
                            </div>
                          )}
                        </div>
 
                        {/* Details Column */}
                        <div className="flex-1 min-w-0 pr-4 flex flex-col justify-between h-full space-y-2">
                          <div className="space-y-0.5">
                            {/* LIVE & Category badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded leading-none shrink-0">
                                #{room.id?.substring(0, 5).toUpperCase() || 'STAGE'}
                              </span>
                              <span className="bg-pink-500/10 border border-pink-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide text-pink-400 leading-none">
                                {room.category || 'Voice Lounge'}
                              </span>
                              {sortBy === 'Trending' && (
                                <span className="bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/35 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide text-orange-400 leading-none flex items-center gap-0.5 animate-pulse shrink-0">
                                  📈 {calculateTrendingScore(room)} INDEX
                                </span>
                              )}
                            </div>
 
                            {/* Room Name */}
                            <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-amber-400 transition-colors leading-snug tracking-tight line-clamp-1 truncate block pr-2 mt-1">
                              {room.title}
                            </h3>
                          </div>
 
                          {/* Host Column */}
                          <div className="flex items-center justify-between gap-2 select-none">
                            {/* Host info details */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-4 h-4 rounded-full border border-white/10 overflow-hidden shrink-0 bg-white/5">
                                <img src={getPremiumAvatar(room.hostId)} className="w-full h-full object-cover" alt="" />
                              </div>
                              <span className="text-[9px] font-bold text-gray-400 truncate max-w-[70px] sm:max-w-[90px]">
                                {hostDisplayName}
                              </span>
                            </div>
 
                            {/* Upgrade to Video Room capability for actual Hosts verbatim */}
                            {currentUser && room.hostId === currentUser.uid && room.roomType !== 'video' && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await updateDoc(doc(db, 'rooms', room.id), { roomType: 'video' });
                                    toast.success("Successfully upgraded this room to a luxury Video Lounge! 🎥🔮");
                                  } catch (err) {
                                    console.error("Error converting room to video:", err);
                                    toast.error("Could not upgrade room. Please try again.");
                                  }
                                }}
                                className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:opacity-95 text-white font-black text-[7px] uppercase tracking-widest px-2 py-1 rounded-lg border border-white/10 shadow-lg cursor-pointer transform hover:scale-105 active:scale-95 transition-all mt-1 shrink-0 flex items-center gap-1 z-25 animate-pulse"
                                title="Instantly Convert to Video Lounge"
                              >
                                <Video size={8} />
                                <span>Go Video</span>
                              </button>
                            )}
                          </div>

                          {/* Quick Interactive Tool Actions bar */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                            <button
                              onClick={(e) => handleShareRoom(e, room)}
                              className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border border-white/5 transition-all active:scale-95 cursor-pointer z-25 shrink-0"
                              title="Share Invite Link"
                            >
                              <Share2 size={10} className="text-pink-400" />
                              <span>Share</span>
                            </button>

                            <button
                              onClick={(e) => handleQuickJoin(e, room.id)}
                              className="bg-gradient-to-r from-orange-500 to-[#FF4D67] hover:opacity-90 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer z-25 shrink-0"
                              title="Quick-join bypassing status checks"
                            >
                              <Zap size={10} className="fill-current" />
                              <span>Quick Join</span>
                            </button>
                          </div>
                        </div>
 
                        {/* Interactive entry card micro-decor pill */}
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0 bg-amber-400 text-black p-1 rounded-full shadow-lg">
                          <ArrowRight size={10} strokeWidth={3.5} />
                        </div>
 
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </section>
            </ErrorBoundary>

            {/* DUAL HIGH-FIDELITY LEADERBOARDS (Requirement 5 & 10) */}
            <ErrorBoundary>
            <section id="leaderboards-showcase" className="glass-card p-5 border-white/5 bg-[#121421]/35 backdrop-blur-xl space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-amber-500 font-extrabold tracking-widest uppercase">WEEKLY COMMUNITY PILLARS</span>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 font-sans tracking-tight">
                    Server Leaderboards <Trophy size={16} className="text-amber-500" />
                  </h3>
                </div>

                {/* Board Tab Switch controls */}
                <div className="flex p-0.5 bg-white/5 border border-white/5 rounded-xl self-start sm:self-auto select-none shrink-0">
                  <button 
                    onClick={() => setLeaderboardTab('hosts')}
                    className={`px-4.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      leaderboardTab === 'hosts' ? 'bg-amber-500 text-black shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Top Hosts 🎤
                  </button>
                  <button 
                    onClick={() => setLeaderboardTab('gifters')}
                    className={`px-4.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      leaderboardTab === 'gifters' ? 'bg-[#F43F5E] text-white shadow-md' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Top Gifters 💎
                  </button>
                </div>
              </div>

              {/* Renders Selected Leaderboard lists */}
              <div className="space-y-5">
                
                {/* Visual Podium (Rank 1, 2, 3) */}
                <div className="grid grid-cols-3 gap-2.5 items-end pt-4 max-w-md mx-auto select-none">
                  
                  {/* Podium Rank 2 */}
                  {((leaderboardTab === 'hosts' ? hostsLeaderboardData[1] : giftersLeaderboardData[1])) && (() => {
                    const r2 = leaderboardTab === 'hosts' ? hostsLeaderboardData[1] : giftersLeaderboardData[1];
                    return (
                      <div 
                        onClick={() => navigate(`/profile/${r2.uid}`)}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div className="relative">
                          <Crown size={18} className="text-slate-400 absolute -top-4.5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" />
                          <div className="w-13 h-13 rounded-full border-2 border-slate-300 p-0.5 bg-[#0C0F19]">
                            <img src={r2.photoURL || getPremiumAvatar(r2.uid)} className="w-full h-full object-cover rounded-full" alt="" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 bg-slate-300 text-black text-[7.5px] font-black rounded-full w-4.5 h-4.5 flex items-center justify-center">2</span>
                        </div>
                        <h4 className="text-[10px] font-black text-gray-200 mt-2 text-center truncate w-full px-1">{r2.displayName}</h4>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                          {leaderboardTab === 'hosts' ? `Lv.${r2.level}` : `${r2.coins || 0}c`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Podium Rank 1 */}
                  {((leaderboardTab === 'hosts' ? hostsLeaderboardData[0] : giftersLeaderboardData[0])) && (() => {
                    const r1 = leaderboardTab === 'hosts' ? hostsLeaderboardData[0] : giftersLeaderboardData[0];
                    return (
                      <div 
                        onClick={() => navigate(`/profile/${r1.uid}`)}
                        className="flex flex-col items-center cursor-pointer group -translate-y-2 z-10"
                      >
                        <div className="relative">
                          <Crown size={22} className="text-yellow-400 absolute -top-5.5 left-1/2 -translate-x-1/2 animate-bounce flex drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]" />
                          <div className="w-16 h-16 rounded-full border-2 border-yellow-400 p-[2px] bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                            <img src={r1.photoURL || getPremiumAvatar(r1.uid)} className="w-full h-full object-cover rounded-full" alt="" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-[#09090C] text-[8px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center">1</span>
                        </div>
                        <h4 className="text-xs font-black text-white mt-2 text-center truncate w-full px-1">{r1.displayName}</h4>
                        <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest mt-0.5">
                          {leaderboardTab === 'hosts' ? `Lv.${r1.level}` : `${r1.coins || 0}c`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Podium Rank 3 */}
                  {((leaderboardTab === 'hosts' ? hostsLeaderboardData[2] : giftersLeaderboardData[2])) && (() => {
                    const r3 = leaderboardTab === 'hosts' ? hostsLeaderboardData[2] : giftersLeaderboardData[2];
                    return (
                      <div 
                        onClick={() => navigate(`/profile/${r3.uid}`)}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div className="relative">
                          <Crown size={16} className="text-amber-600 absolute -top-4.5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]" />
                          <div className="w-12 h-12 rounded-full border-2 border-amber-600 p-0.5 bg-[#0C0F19]">
                            <img src={r3.photoURL || getPremiumAvatar(r3.uid)} className="w-full h-full object-cover rounded-full" alt="" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 bg-amber-600 text-white text-[7.5px] font-black rounded-full w-4 h-4 flex items-center justify-center">3</span>
                        </div>
                        <h4 className="text-[10px] font-black text-gray-200 mt-2 text-center truncate w-full px-1">{r3.displayName}</h4>
                        <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
                          {leaderboardTab === 'hosts' ? `Lv.${r3.level}` : `${r3.coins || 0}c`}
                        </span>
                      </div>
                    );
                  })()}

                </div>

                {/* Leaderboard scroll rows (Ranks 4-10) */}
                <div className="space-y-2 pt-2 select-none border-t border-white/5">
                  {(leaderboardTab === 'hosts' ? hostsLeaderboardData : giftersLeaderboardData).slice(3, 10).map((r, index) => {
                    const overallRank = index + 4;
                    const followedState = followedUids.includes(r.uid);
                    return (
                      <div 
                        key={r.uid}
                        className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-colors"
                      >
                        <div 
                          onClick={() => navigate(`/profile/${r.uid}`)}
                          className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="text-xs font-black text-gray-400 w-5 text-center">#{overallRank}</span>
                          <Avatar className="w-9 h-9 border border-white/10">
                            <AvatarImage src={r.photoURL || getPremiumAvatar(r.uid)} />
                            <AvatarFallback className="bg-zinc-800 font-bold text-xs">{(r.displayName || '?')[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-black text-white truncate">{r.displayName}</h4>
                              {r.isVIP && (
                                <span className="bg-amber-400 text-black text-[7px] font-black px-1 rounded-sm">VIP</span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-500 font-extrabold uppercase mt-0.5 tracking-tight">
                              ID: {r.numericId || r.uid.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                        </div>

                        {/* Leader row end points */}
                        <div className="flex items-center gap-3.5 shrink-0">
                          <span className={`text-[10px] font-black text-right ${leaderboardTab === 'hosts' ? 'text-amber-400' : 'text-[#F43F5E]'}`}>
                            {leaderboardTab === 'hosts' ? `Level ${r.level}` : `${r.coins || 0} coins`}
                          </span>

                          <button
                            onClick={() => handleFollowUser(r.uid)}
                            className={`p-1.5 rounded-xl border flex items-center justify-center transition-colors ${
                              followedState 
                                ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' 
                                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                            title="Toggle Star Follow"
                          >
                            {followedState ? <Check size={12} /> : <UserPlus size={12} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </section>
            </ErrorBoundary>

          </div>

          {/* RIGHT 5 COLUMN PANEL: NEW REGISTRATIONS, TRENDING TRAIL */}
          <div className="lg:col-span-4 space-y-10">

            {/* NEW REGISTERED USERS WELCOME PANEL (Requirement 2) */}
            <ErrorBoundary>
            <section id="onboarding-new-users" className="glass-card p-5 border-white/5 space-y-4 bg-[#121421]/35 backdrop-blur-xl">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[9px] text-[#F43F5E] font-extrabold tracking-widest uppercase">STARLIGHT NEWCOMERS</span>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1 font-sans tracking-tight">
                  Newly Joined Star Nobles <Sparkles size={16} className="text-yellow-400 shrink-0" />
                </h3>
              </div>

              {/* Users list mapped from Firestore array */}
              {newUsersData.length === 0 ? (
                <p className="text-xs text-gray-500 font-bold text-center py-6">No new active members found in community.</p>
              ) : (
                <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 no-scrollbar select-none">
                  {newUsersData.map(u => {
                    const stateFollowed = followedUids.includes(u.uid);
                    return (
                      <div 
                        key={u.uid}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.015] hover:bg-white/5 border border-white/5 transition-all"
                      >
                        <div 
                          onClick={() => navigate(`/profile/${u.uid}`)}
                          className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                        >
                          {/* Avatar with live status pulse beacon (Requirement 2) */}
                          <div className="relative">
                            <Avatar className="w-10 h-10 border border-white/10">
                              <AvatarImage src={u.photoURL || getPremiumAvatar(u.uid)} />
                              <AvatarFallback className="bg-zinc-805 text-xs text-white uppercase font-bold">{(u.displayName || '?')[0]}</AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#121421] animate-pulse" />
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-white truncate max-w-[130px]">{u.displayName}</h4>
                            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-tight">
                              ID: #{u.numericId || u.uid.slice(0, 8).toUpperCase()}
                            </p>
                            
                            {/* Online indicators */}
                            <div className="flex items-center gap-1 mt-1 shrink-0">
                              <span className="w-1.2 h-1.2 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-[8px] text-[#10B981] font-extrabold uppercase">Online Now</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Follow sync button (Requirement 2 & 10) */}
                        <button
                          onClick={() => handleFollowUser(u.uid)}
                          className={`h-7 px-3 text-[9px] font-black rounded-lg border uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                            stateFollowed 
                              ? 'bg-transparent text-green-400 border-green-500/20 hover:bg-green-500/5' 
                              : 'bg-white text-black border-white hover:bg-white/95 shadow-lg active:scale-95'
                          }`}
                        >
                          {stateFollowed ? <Check size={10} /> : <UserPlus size={10} />}
                          <span>{stateFollowed ? 'Following' : 'Follow'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            </ErrorBoundary>

            {/* TRENDING INFLUENCER STARS PORTAL (Requirement 3) */}
            <ErrorBoundary>
            <section id="trending-deck" className="space-y-4">
              <div className="border-b border-white/5 pb-2">
                <span className="text-[9px] text-purple-400 font-extrabold tracking-widest uppercase">MOST COMPANION VALUE</span>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5 font-sans tracking-tight">
                  Trending Stars Now <Zap size={16} className="text-purple-400 animate-pulse shrink-0" />
                </h3>
              </div>

              <div className="space-y-3">
                {trendingUsersData.map((star, index) => {
                  const stateFollowed = followedUids.includes(star.uid);
                  const isTopSpot = index < 3;
                  const borderGlow = isTopSpot
                    ? 'border-pink-500/30 bg-gradient-to-tr from-[#121421]/90 to-pink-500/5'
                    : 'border-white/5 bg-[#121421]/35';

                  return (
                    <div
                      key={star.uid}
                      className={`p-4 rounded-3xl border flex items-center justify-between gap-3 relative overflow-hidden transition-transform hover:-translate-y-0.5 ${borderGlow} shadow-xl`}
                    >
                      {/* Left Block info details */}
                      <div 
                        onClick={() => navigate(`/profile/${star.uid}`)}
                        className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="w-11 h-11 border-2 border-purple-500/40">
                            <AvatarImage src={star.photoURL || getPremiumAvatar(star.uid)} />
                            <AvatarFallback className="bg-zinc-850 font-black text-xs text-white">{(star.displayName || '?')[0]}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -top-1.5 -left-1.5 bg-gradient-to-tr from-pink-500 to-violet-600 text-white text-[7px] font-black rounded px-1 flex items-center h-3.5 leading-none">
                            Lv.{star.level || 1}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-white truncate max-w-[150px] leading-snug">{star.displayName}</h4>
                          
                          {/* Diamonds Gifting Value Metrics */}
                          <div className="flex items-center gap-1.5 mt-1 select-none">
                            <span className="text-[9px] font-black text-gray-500 uppercase">Gifting:</span>
                            <span className="text-[9px] text-[#F33F5E] font-black flex items-center gap-0.5">
                              <Gift size={9} /> {star.diamonds || 0}
                            </span>
                            <span className="text-[9px] text-gray-400 font-bold">•</span>
                            <span className="text-[9px] text-[#A78BFA] font-black flex items-center gap-0.5">
                              <Users size={9} /> {star.followersCount || 10}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-[7.5px] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded text-purple-400">
                              {star.achievement}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Block Follow buttons */}
                      <button
                        onClick={() => handleFollowUser(star.uid)}
                        className={`h-7 w-7 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                          stateFollowed 
                            ? 'bg-transparent text-green-400 border-green-500/20' 
                            : 'bg-white text-black border-white hover:bg-white/95'
                        }`}
                        title="Quick Follow Star"
                      >
                        {stateFollowed ? <Check size={11} strokeWidth={2.5} /> : <UserPlus size={11} strokeWidth={2.5} />}
                      </button>

                    </div>
                  );
                })}
              </div>
            </section>
            </ErrorBoundary>

          </div>

        </div>

      </main>

      {/* INSTANT ROOM CREATION OVERLAY MODAL */}
      <AnimatePresence>
        {showInstantCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#030303]/95 backdrop-blur-xl z-50 overflow-y-auto px-5 py-10 font-sans flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-gradient-to-b from-[#13101E] to-[#0A0710] border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-pink-500 to-[#FF4D67]" />
              
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-pink-500 font-extrabold tracking-widest uppercase">SOULLINK LIGHTSPEED ENGINE</span>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Instant Room Creation</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstantCreate(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all active:scale-90"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Step Guide */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">1. Select a Room Option Preset</span>
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1 no-scrollbar">
                  {INSTANT_ROOM_PRESETS.map(preset => {
                    const isSelected = instantCategory === preset.category && instantTitle === preset.title;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setInstantTitle(preset.title);
                          setInstantDesc(preset.desc);
                          setInstantCategory(preset.category);
                          setInstantCover(preset.cover);
                          toast.success(`Loaded Preset: ${preset.name} ✨`);
                        }}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 group shrink-0 active:scale-[0.99] ${
                          isSelected
                            ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 border-pink-500/60 shadow-lg shadow-pink-500/5'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/15'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-white group-hover:text-pink-400 transition-colors">
                            {preset.name}
                          </p>
                          <p className="text-[9px] text-zinc-400 font-semibold line-clamp-1">
                            {preset.desc}
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                          isSelected ? 'border-pink-500 bg-pink-500 text-white' : 'border-white/20'
                        }`}>
                          {isSelected && <Check size={8} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Room details fields */}
              <AnimatePresence mode="popLayout">
                {instantTitle && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: 10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: 10 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3 pt-3 border-t border-white/5 overflow-hidden"
                  >
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">2. Confirm Customization</span>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block px-1">Lounge Room Title</label>
                      <Input
                        value={instantTitle}
                        onChange={(e) => setInstantTitle(e.target.value)}
                        placeholder="Customize room name..."
                        className="h-10 bg-white/5 hover:bg-white/10 text-white focus:bg-white/10 font-bold text-xs rounded-xl border-white/10 focus:border-pink-500"
                        maxLength={45}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block px-1">Host Description</label>
                      <textarea
                        value={instantDesc}
                        onChange={(e) => setInstantDesc(e.target.value)}
                        placeholder="Customize description..."
                        className="w-full h-15 bg-white/5 rounded-xl border border-white/10 p-2.5 font-semibold text-xs focus:ring-1 focus:ring-pink-500 focus:outline-none placeholder:text-gray-550 text-white resize-none"
                        maxLength={150}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Create/Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleInstantCreateRoom}
                  disabled={instantCreating || !instantTitle.trim()}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-400 via-pink-500 to-[#FF4D67] hover:opacity-95 text-white font-black uppercase tracking-widest text-xs transition-transform active:scale-95 shadow-[0_4px_25px_rgba(244,63,94,0.2)] border border-white/10 h-11"
                >
                  {instantCreating ? 'Launching Live Lounge...' : 'Launch Instant Room 🚀'}
                </Button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HIGH-PERFORMANCE MASTER MULTI-ENTITY SEARCH OVERLAY (Requirement 8 & 9) */}
      <AnimatePresence>
        {showSearchOverlay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#06080D]/98 backdrop-blur-xl z-50 overflow-y-auto px-5 pt-12 pb-32 font-sans"
          >
            {/* Search Top Panel Bar */}
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input 
                  id="search-hub-input"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Seach UIDs, names, lounges, agencies, hosts..."
                  className="w-full h-12.5 bg-white/5 hover:bg-white/10 focus:bg-white/10 text-sm font-bold pl-11 pr-10 rounded-2xl border-white/10 focus:border-pink-500 text-white placeholder:text-gray-550 tracking-wide focus:ring-0 focus:outline-none"
                  autoFocus
                />
                <AnimatePresence>
                  {searchTerm && (
                    <motion.button
                      id="search-clear-button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.23, ease: "easeOut" }}
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white hover:bg-white/15 active:scale-90 p-1.5 rounded-full cursor-pointer flex items-center justify-center hover:scale-105"
                      title="Clear search"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <Button 
                onClick={() => { setSearchTerm(''); setShowSearchOverlay(false); }}
                className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-white p-0 shrink-0 border border-white/10 flex items-center justify-center transition-transform active:scale-90"
              >
                <X size={18} />
              </Button>
            </div>

            {/* Classified Type Filters Tab control (Requirement 8) */}
            <div className="max-w-3xl mx-auto flex items-center gap-1.5 border-b border-white/5 pb-3 mb-6 overflow-x-auto no-scrollbar">
              {([
                { id: 'all', label: 'All Results' },
                { id: 'users', label: 'Users 👥' },
                { id: 'rooms', label: 'Rooms 🎧' },
                { id: 'agencies', label: 'Agencies 🏛️' },
                { id: 'hosts', label: 'Hosts Approved 🎙️' }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSearchTab(tab.id)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 border transition-all ${
                    searchTab === tab.id 
                      ? 'bg-gradient-to-r from-pink-500 to-indigo-500 border-0 text-white font-extrabold shadow-lg shadow-pink-500/10' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-w-3xl mx-auto space-y-8 select-none">
              
              {/* Hot search suggestions guide when empty */}
              {searchTerm.trim().length === 0 ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-amber-500" /> Hot Community searches
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {HOT_SEARCHES.map(term => (
                        <button 
                          key={term}
                          onClick={() => setSearchTerm(term.replace(' ✨', ''))}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold text-gray-300 transition-all active:scale-95 cursor-pointer"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-6 space-y-4">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Shield size={12} className="text-[#F43F5E]" /> Advanced Discovery System
                    </h4>
                    <ul className="space-y-3 text-xs text-gray-400 font-semibold leading-relaxed">
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-pink-500/15 text-pink-400 flex items-center justify-center font-extrabold shrink-0 text-[10px]">1</span>
                        <p>Search standard User Display Names or exact UIDs to instantly connect and read prestige badges.</p>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-400 flex items-center justify-center font-extrabold shrink-0 text-[10px]">2</span>
                        <p>Search active room categories (e.g. "gaming", "singing") to quickly filter live vocal lobbies.</p>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-700/15 text-cyan-400 flex items-center justify-center font-extrabold shrink-0 text-[10px]">3</span>
                        <p>Look up contracted Host Agencies to unlock prestige commission rates and VIP banners.</p>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                /* DYNAMIC CATEGORY CLASSIFIED SEARCH DATA (Requirement 8) */
                <div className="space-y-8">
                  
                  {/* Matching Users */}
                  {(searchTab === 'all' || searchTab === 'users') && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-pink-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                        Community Stars ({filteredUsers.length})
                      </h4>
                      {filteredUsers.length === 0 ? (
                        <p className="text-xs text-gray-500 font-bold px-1 py-1">No matching users...</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredUsers.map(user => (
                            <div 
                              key={user.uid}
                              onClick={() => { setShowSearchOverlay(false); navigate(`/profile/${user.uid}`); }}
                              className="flex items-center justify-between p-3.5 rounded-2.5xl bg-white/5 border border-white/5 hover:border-pink-500/40 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                                  <AvatarImage src={user.photoURL || getPremiumAvatar(user.uid)} />
                                  <AvatarFallback className="bg-zinc-800 font-black text-xs text-white">{(user.displayName || '?')[0]}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="text-xs font-black text-white truncate max-w-[170px]">{user.displayName}</h5>
                                    {user.isVIP && (
                                      <span className="bg-amber-400 text-black text-[7.5px] font-black px-1 rounded-sm">VIP</span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-gray-500 font-extrabold mt-0.5 uppercase tracking-wider">
                                    ID: #{user.numericId || user.uid.slice(0, 8).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-gray-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matching Rooms */}
                  {(searchTab === 'all' || searchTab === 'rooms') && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                        Vocal Rooms ({filteredRooms.length})
                      </h4>
                      {filteredRooms.length === 0 ? (
                        <p className="text-xs text-gray-500 font-bold px-1 py-1">No matching rooms found...</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredRooms.map(room => (
                            <div 
                              key={room.id}
                              onClick={() => { setShowSearchOverlay(false); navigate(`/room/${room.id}`); }}
                              className="flex items-center justify-between p-3.5 rounded-2.5xl bg-white/5 border border-white/5 hover:border-violet-500/40 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-500 flex items-center justify-center shrink-0 border border-white/10">
                                  <Mic2 size={16} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-black text-white truncate max-w-[180px]">{room.title}</h5>
                                  <p className="text-[9px] text-[#A78BFA] font-extrabold uppercase mt-1">
                                    Category: {room.category || 'General'}
                                  </p>
                                </div>
                              </div>
                              <div className="bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20 text-[8px] font-black tracking-widest uppercase px-2.5 py-1 rounded-xl shrink-0">
                                Quick Join
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matching Agencies */}
                  {(searchTab === 'all' || searchTab === 'agencies') && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                        Host Agencies ({filteredAgencies.length})
                      </h4>
                      {filteredAgencies.length === 0 ? (
                        <p className="text-xs text-gray-500 font-bold px-1 py-1">No matching host contract agencies...</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredAgencies.map(a => (
                            <div 
                              key={a.id}
                              onClick={() => { setShowSearchOverlay(false); navigate('/agency'); }}
                              className="flex items-center justify-between p-3.5 rounded-2.5xl bg-white/5 border border-white/5 hover:border-amber-500/40 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                                  <Landmark size={18} />
                                </div>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-black text-white truncate max-w-[185px]">{a.name || a.id}</h5>
                                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Contract ID: {a.id}</p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-gray-500 shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matching Approved Hosts */}
                  {(searchTab === 'all' || searchTab === 'hosts') && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-2">
                        Approved Community Hosts ({filteredHosts.length})
                      </h4>
                      {filteredHosts.length === 0 ? (
                        <p className="text-xs text-gray-500 font-bold px-1 py-1">No verified system hosts found matching conditions...</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {filteredHosts.map(host => (
                            <div 
                              key={host.uid}
                              onClick={() => { setShowSearchOverlay(false); navigate(`/profile/${host.uid}`); }}
                              className="flex items-center justify-between p-3.5 rounded-2.5xl bg-white/5 border border-white/5 hover:border-emerald-500/40 cursor-pointer transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                                  <AvatarImage src={host.photoURL || getPremiumAvatar(host.uid)} />
                                  <AvatarFallback className="bg-zinc-800 font-black text-xs text-white">{(host.displayName || '?')[0]}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="text-xs font-black text-white truncate max-w-[160px]">{host.displayName}</h5>
                                    <span className="bg-emerald-500/15 text-emerald-400 text-[7px] font-extrabold uppercase px-1 rounded-sm">Approved Host</span>
                                  </div>
                                  <p className="text-[9px] text-gray-550 font-bold mt-0.5">
                                    Level {host.level || 1} Elite Studio
                                  </p>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-gray-500 shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
