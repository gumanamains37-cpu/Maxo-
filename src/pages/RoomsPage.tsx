import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { collection, query, limit, getDocs, getDocsFromServer, orderBy } from 'firebase/firestore';
import { Room } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Home as HomeIcon, Trophy, Sparkles, Plus, 
  Tv, Volume2, Flame, Users, Calendar, ArrowRight, Radio,
  RotateCw
} from 'lucide-react';
import { getPremiumAvatar } from '@/utils/avatar';
import { toast } from 'sonner';
import { RoomCache } from '@/lib/roomCache';

export function getRoomThumbnail(url?: string, title?: string, id?: string) {
  if (url && url.trim().length > 0) return url;
  
  // High-fidelity curated list of gorgeous crystal-clear Unsplash images for voice matching lobbies
  const fallbackImages = [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=400&auto=format&fit=crop', // KTV Studio
    'https://images.unsplash.com/photo-1511384699508-0474f51cd251?q=80&w=400&auto=format&fit=crop', // Pink Lounge
    'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=400&auto=format&fit=crop', // Golden light stage
    'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?q=80&w=400&auto=format&fit=crop', // Cozy cafe talk room
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=400&auto=format&fit=crop', // Gaming Neon lounge
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop', // Purple Star Universe
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop', // DJ Music Console
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=400&auto=format&fit=crop'  // Electric Festival
  ];
  
  // Pick an index stably using room id or title hash
  const stableId = id || title || 'fallback';
  let hash = 0;
  for (let i = 0; i < stableId.length; i++) {
    hash = stableId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % fallbackImages.length;
  return fallbackImages[index];
}

export default function RoomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'Recommend' | 'Video'>('Recommend');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pull-to-refresh touch tracking
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);

  // Force-fetch newest rooms from server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Syncing newest party rooms with cloud... 🎙️⚡");
    try {
      await RoomCache.forceSynchronize();
      toast.success("All live voice rooms fully synchronized! 🧬", { id: toastId });
    } catch (e) {
      console.warn("Failed to update rooms on user refresh request:", e);
      toast.error("Failed to force update rooms", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart;
    if (diff > 0 && diff < 150) {
      setPullProgress(diff);
    }
  };

  const handleTouchEnd = () => {
    if (pullProgress > 80 && !isRefreshing) {
      handleRefresh();
    }
    setTouchStart(null);
    setPullProgress(0);
  };

  // Real-time synchronization of voice rooms via RoomCache
  useEffect(() => {
    // Subscribe to centralized RoomCache manager so that updates from any page format
    // or manual trigger are immediately mirrored here in real-time.
    const unsubscribeCache = RoomCache.subscribe((newRooms) => {
      setRooms(newRooms);
      setLoading(false);
    });

    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeSnapshot = safeOnSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      RoomCache.setRooms(roomData);
      setLoading(false);
    }, (error) => {
      console.warn("Rooms loaded offline:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeCache();
      unsubscribeSnapshot();
    };
  }, []);

  const handleJoinOrCreate = (roomId: string) => {
    navigate(`/room/${roomId}`);
  };

  const handleCreateRoomClick = () => {
    if (!user) {
      toast.error("Please log in to create an audio lounge room");
      return;
    }
    navigate('/room/create');
  };

  // Aesthetic High-Fidelity Mock Rooms matching Screenshot 3
  const MOCK_ROOMS: any[] = [];

  // Sort real database live rooms by creation time descending so newly created rooms are at the absolute top
  const sortedRealRooms = [...rooms.filter(r => r.isLive !== false)].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  // Combine real database live rooms with the premium screenshot-recreated mock lounges
  const combinedRooms = [
    ...sortedRealRooms
  ];

  // Filter or augment rooms depending on the active subtab (Recommend/Video)
  const filteredRooms = combinedRooms.filter(room => {
    if (activeSubTab === 'Video') {
      // Return rooms of type 'video' or themed with visual focus
      return (room as any).roomType === 'video' || room.category === 'Gaming' || room.id.includes('game') || room.id.includes('anta');
    }
    // For Recommend, return all rooms
    return true;
  });

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="bg-[#0C0F1A] min-h-screen text-white pb-32 relative overflow-hidden font-sans"
    >
      {/* Pull-to-refresh dynamic status sliding indicator */}
      {pullProgress > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-transparent z-[150] transition-[height] duration-75 overflow-hidden"
          style={{ height: `${pullProgress}px` }}
        >
          <div className="flex items-center gap-2 text-[10px] font-black text-pink-400 uppercase tracking-widest bg-[#13192B]/95 px-4 py-2 rounded-full border border-pink-500/15 shadow-2 shadow-pink-500/5 mt-3 select-none">
            <RotateCw size={10} className={`text-pink-500 ${pullProgress > 80 ? 'rotate-180 animate-spin' : ''}`} />
            <span>{pullProgress > 80 ? 'Release to Sync Nodes' : 'Pull down to refresh'}</span>
          </div>
        </div>
      )}
      
      {/* Dynamic colorful aesthetic ambiance background for premium styling */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#1E112A] via-[#101323] to-[#0C0F1A] -z-10" />
 
      {/* Header Panel matching Screenshot 3 tab bar structure (Enhanced Dark Theme) */}
      <header className="px-5 pt-12 pb-4 sticky top-0 bg-[#0C0F1A]/85 backdrop-blur-md z-40 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 select-none">
          {/* Extremely Small Sub Tabs (Requirement: "recommend and video options keep them very small") */}
          <button 
            onClick={() => setActiveSubTab('Recommend')}
            className={`text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-300 relative cursor-pointer ${
              activeSubTab === 'Recommend' 
                ? 'bg-gradient-to-r from-orange-400 to-pink-500 text-white border-transparent shadow-[0_0_12px_rgba(249,115,22,0.3)] scale-100' 
                : 'bg-white/[0.04] text-gray-400 border-white/5 hover:bg-white/10 scale-95'
            }`}
          >
            Recommend
          </button>
          
          <button 
            onClick={() => setActiveSubTab('Video')}
            className={`text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border transition-all duration-300 relative cursor-pointer ${
              activeSubTab === 'Video' 
                ? 'bg-gradient-to-r from-orange-400 to-pink-500 text-white border-transparent shadow-[0_0_12px_rgba(249,115,22,0.3)] scale-100' 
                : 'bg-white/[0.04] text-gray-400 border-white/5 hover:bg-white/10 scale-95'
            }`}
          >
            Video
          </button>
        </div>
 
        {/* Global Action Toolbar conforming to Screenshot 3 */}
        <div className="flex items-center gap-3.5 text-gray-300">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-pink-400 hover:text-pink-300 active:scale-90"
            title="Force Update Feed"
          >
            <RotateCw size={18} className={`stroke-[2.5] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => {
              // Open quick search modal or toast search directions
              toast.info("Search filter is active below in the feed! 🔍");
            }}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <Search size={18} className="stroke-[2.5]" />
          </button>
          <button 
            onClick={() => navigate('/')}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Lounge Home"
          >
            <HomeIcon size={18} className="stroke-[2.5]" />
          </button>
          <button 
            onClick={() => navigate('/level')}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-amber-500 cursor-pointer"
            title="Winner Leaderboards"
          >
            <Trophy size={18} className="stroke-[2.5] fill-amber-500/20" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="px-5 pt-4 max-w-xl mx-auto space-y-5">
        
        {/* PREMIUM EXPERIENCE ACCELERATOR BANNER ("Event Center") matching Screenshot 3 */}
        <div className="bg-gradient-to-r from-orange-950/40 via-pink-950/20 to-purple-950/30 rounded-3xl p-5 relative overflow-hidden shadow-sm border border-orange-500/20 flex justify-between items-center group">
          <div className="space-y-1 relative z-10">
            <h3 className="text-orange-400 font-extrabold tracking-wide text-xs uppercase">Event Center</h3>
            <p className="text-gray-300 font-bold text-[10px] uppercase tracking-wider">More rewards & active tournaments awaits you →</p>
          </div>
          
          {/* Notepad Graphic asset representation */}
          <div className="relative w-16 h-16 shrink-0 z-10 flex items-center justify-center">
            <div className="w-12 h-14 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-xl relative p-1.5 flex flex-col gap-1.5">
              <div className="w-full h-1 bg-orange-400 rounded-full" />
              <div className="w-3/4 h-1 bg-white/20 rounded-full" />
              <div className="w-5/6 h-1 bg-white/20 rounded-full" />
              <div className="w-1/2 h-1 bg-white/20 rounded-full" />
              <div className="absolute -top-1.5 -left-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white/10 shadow-md flex items-center justify-center text-[6px] text-white">✓</div>
            </div>
          </div>
        </div>

        {/* Vocal Rooms Feed List with Farm Story Banner Insertion */}
        <div className="space-y-4">
          {filteredRooms.map((room, index) => {
            // Setup correct styles based on category matching Screenshot 3 badges
            const getTagColor = (cat: string) => {
              const ucat = cat?.toLowerCase() || '';
              if (ucat.includes('sing')) return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25';
              if (ucat.includes('music')) return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25';
              if (ucat.includes('chat')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/25';
              return 'bg-pink-500/10 text-pink-400 border border-pink-500/25';
            };

            const cardJSX = (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => handleJoinOrCreate(room.id)}
                className="bg-[#13192B]/80 backdrop-blur-md rounded-3xl border border-white/5 hover:border-orange-500/35 p-4 flex items-center gap-4 cursor-pointer select-none shadow-[0_4px_24px_rgba(0,0,0,0.2)] hover:shadow-xl hover:bg-[#13192B] transition-all duration-300 active:scale-98 text-white"
              >
                {/* Beautiful custom shaped thumbnail on left */}
                <div className="w-20 h-20 rounded-[28px] overflow-hidden shrink-0 relative bg-zinc-900 border border-white/10 shadow-inner">
                  <img src={getRoomThumbnail(room.thumbnailUrl, room.title, room.id)} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md text-[8px] font-black text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Live
                  </div>
                </div>

                {/* Info Center */}
                <div className="flex-1 min-w-0 pr-2">
                  <h3 className="text-sm sm:text-base font-bold text-white hover:text-orange-400 transition-colors leading-snug tracking-tight line-clamp-1 truncate block pr-2">
                    {room.title}
                  </h3>
                  
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold truncate">
                    {(room as any).welcomeMessage || 'Join voice lobby party & match vibes!'}
                  </p>

                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {/* Category tag */}
                    <span className={`text-[9px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full ${getTagColor(room.category || 'Chat')}`}>
                      {room.category || 'Chat'}
                    </span>

                    {/* Level marker matching Screenshot 3 */}
                    <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {(room as any).level || 'Lv.3'}
                    </span>
                  </div>
                </div>

                {/* Audiences live stats and equalizer bar visualizer */}
                <div className="flex flex-col items-end gap-1.5 shrink-0 select-none">
                  <div className="flex items-center gap-1.5 text-orange-400 font-extrabold text-xs">
                    {/* Tiny visual animated equalizer simulation */}
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-1 bg-orange-400 h-2 animate-pulse rounded-full" />
                      <span className="w-1 bg-orange-400 h-3 animate-pulse rounded-full" />
                      <span className="w-1 bg-orange-400 h-1.5 animate-pulse rounded-full" />
                    </div>
                    <span>{(room as any).activeCount || (room as any).memberCount || 1}</span>
                  </div>
                  <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider">in room</span>
                </div>
              </motion.div>
            );

            // Intersperse beautiful colorful advertisement banner ("Farm Story") in the middle of list
            if (index === 2) {
              return (
                <React.Fragment key="insertion_block">
                  {cardJSX}
                  
                  {/* FARM STORY SLIDING BANNER matching Screenshot 3 */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full h-24 rounded-3xl relative overflow-hidden shadow-md my-4 flex items-center justify-between border border-emerald-400/20 group cursor-pointer bg-[#92DE69]"
                    onClick={() => {
                      toast.success("Welcome to Farm Story! Planting magical seed bonus! 🌱🏆");
                    }}
                  >
                    {/* Landscape vector visual background */}
                    <img 
                      src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=800&auto=format&fit=crop" 
                      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-1000" 
                      alt="Farm Story" 
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 via-transparent to-black/35" />
                    
                    <div className="absolute left-6 z-10 space-y-0.5 text-white">
                      <h4 className="text-xl font-black italic tracking-wide font-display text-white drop-shadow-md drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        Farm Story
                      </h4>
                      <p className="text-[10px] text-emerald-100 drop-shadow-md font-bold uppercase tracking-widest leading-none">
                        Cultivate seeds & earn diamond dividends
                      </p>
                    </div>

                    <div className="mr-6 z-10 w-12 h-12 bg-white/20 backdrop-blur-md rounded-full border border-white/40 flex items-center justify-center animate-bounce">
                      <span className="text-xl">🌾</span>
                    </div>

                    {/* Pagination indicators conforming to the screen */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                      <span className="w-1.5 h-1.5 bg-white rounded-full" />
                      <span className="w-1.5 h-1.5 bg-white/45 rounded-full" />
                      <span className="w-1.5 h-1.5 bg-white/45 rounded-full" />
                    </div>
                  </motion.div>
                </React.Fragment>
              );
            }

            return cardJSX;
          })}
        </div>
      </div>

      {/* 
        PREMIUM CENTRAL CREATE ROOM ACCELERATOR BUTTON inside Rooms page!
        "room create ka option bich mein Hi rahega lekin kuchh alag tarike se add karke dena abaki bar room"
        This matches option 4 and keeps creation visually central & easily accessible for premium user flow
      */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
        <motion.button
          onClick={handleCreateRoomClick}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 font-extrabold text-xs uppercase tracking-widest text-white shadow-[0_0_24px_rgba(236,72,153,0.5)] px-7 py-4 rounded-full border-2 border-yellow-300 flex items-center gap-2.5 cursor-pointer relative"
        >
          {/* Glowing Aura ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 blur-lg opacity-60 -z-10 animate-pulse" />
          <Radio size={16} className="text-white animate-bounce" />
          <span className="font-sans font-black tracking-widest">🚀 Launch Voice Party Room</span>
        </motion.button>
      </div>

    </div>
  );
}
