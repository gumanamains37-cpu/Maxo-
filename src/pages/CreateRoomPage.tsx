import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { collection, doc, setDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, Camera, Shield, Music, Gamepad2, Users, 
  Lock, Globe, Sparkles, MessageSquare, Tag, Check, Sliders
} from 'lucide-react';
import { getPremiumAvatar, getPremiumRoomCover } from '@/utils/avatar';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { RoomCache } from '@/lib/roomCache';
import { Room } from '@/types';

// Premium background library presets (Requirement Replace with Room Background Selector + Premium Background Library)
const PREMIUM_BACKGROUNDS = [
  { id: 'purple_luxury', name: 'Purple Luxury', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop' },
  { id: 'pink_premium', name: 'Pink Premium', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=600&auto=format&fit=crop' },
  { id: 'blue_neon', name: 'Blue Neon', url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=600&auto=format&fit=crop' },
  { id: 'gold_vip', name: 'Gold VIP', url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=600&auto=format&fit=crop' },
  { id: 'dark_elite', name: 'Dark Elite', url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600&auto=format&fit=crop' },
  { id: 'galaxy_theme', name: 'Galaxy Cosmic', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=600&auto=format&fit=crop' }
];

// Room Categories (Requirement 4)
const CATEGORIES = [
  { key: 'social', name: 'Social Lounge' },
  { key: 'music', name: 'Music Party' },
  { key: 'friendship', name: 'Friendship Room' },
  { key: 'gaming', name: 'Gaming Zone' },
  { key: 'vip', name: 'VIP Lounge' },
  { key: 'fan_club', name: 'Fan Club' },
  { key: 'community', name: 'Community Hub' },
  { key: 'entertainment', name: 'Entertainment Room' },
  { key: 'couple', name: 'Couple Room' }
];

// Room Types (Requirement 4)
const ROOM_TYPES = [
  { key: 'standard', name: 'Standard Room' },
  { key: 'premium', name: 'Premium Room' },
  { key: 'vip', name: 'VIP Room' },
  { key: 'event', name: 'Event Room' },
  { key: 'private', name: 'Private Room' }
];

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Sourced with multiple layers of redundancy: Firebase session -> Context User -> Local Session directly
  const getFallbackUser = () => {
    if (auth.currentUser) return auth.currentUser;
    if (user) return user;
    
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('maxo_mock_user');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  };

  const currentUser = getFallbackUser();

  // Enforce one active room per host
  useEffect(() => {
    if (!currentUser) return;
    const checkActiveRoom = async () => {
      try {
        const q = query(
          collection(db, 'rooms'),
          where('hostId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        const activeRoomDoc = snap.docs.find(d => d.data().isLive !== false);
        if (activeRoomDoc) {
          toast.info("Note: Creating a new room will close your previous active room. 🎙️");
        }
      } catch (err) {
        console.warn("Failed checking for user active room:", err);
      }
    };
    checkActiveRoom();
  }, [currentUser]);

  // Debug logs
  useEffect(() => {
    console.log("[LoungeSync] Auth Loading:", authLoading);
    if (!authLoading || currentUser) {
      console.log("[LoungeSync] Auth Ready");
      if (currentUser) {
        console.log("[LoungeSync] User Logged In:", currentUser.displayName || 'Guest');
        console.log("[LoungeSync] User UID Found:", currentUser.uid);
      } else {
        console.warn("[LoungeSync] No logged-in user detected.");
      }
    }
  }, [authLoading, currentUser]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Custom states replacing live wallpaper url (Requirement 3)
  const [thumbnailUrl, setThumbnailUrl] = useState(PREMIUM_BACKGROUNDS[0].url);
  const [selectedBackground, setSelectedBackground] = useState('purple_luxury');
  
  // High fidelity custom specifications (Requirement 3)
  const [roomCategory, setRoomCategory] = useState('social');
  const [roomType, setRoomType] = useState('standard');
  const [roomLanguage, setRoomLanguage] = useState('English');
  const [roomPassword, setRoomPassword] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome! Please tap a seat to join the mic & vibe in respect ✨');
  const [roomTags, setRoomTags] = useState('#Social #Vibe #Music');
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [seatCount, setSeatCount] = useState('8');
  const [userLimit, setUserLimit] = useState('100');
  
  const [loading, setLoading] = useState(false);
  const [creationPhase, setCreationPhase] = useState<'idle' | 'initiating' | 'creating' | 'joining' | 'completing'>('idle');

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0C101A] text-white">
        <div className="text-sm font-semibold text-gray-400 animate-pulse">
          Verifying authentication state...
        </div>
      </div>
    );
  }

  const handleBackgroundSelect = (bgId: string, bgUrl: string) => {
    setSelectedBackground(bgId);
    setThumbnailUrl(bgUrl);
    toast.success(`Dynamic theme set to: ${PREMIUM_BACKGROUNDS.find(b => b.id === bgId)?.name}`);
  };

  const handleSimulatedUpload = () => {
    // Gallery Simulated Upload trigger
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        // Create an object URL to preview locally
        const previewUrl = URL.createObjectURL(file);
        setThumbnailUrl(previewUrl);
        setSelectedBackground('custom_upload');
        toast.success('Gallery photo loaded into Room Cover preview! 📸');
      }
    };
    input.click();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Please enter an incredible Room Title');
      return;
    }
    if (!currentUser) {
      toast.error('You must be logged in to construct a live room.');
      return;
    }

    // Set light loading state for the button context
    setLoading(true);
    setCreationPhase('creating');

    const generatedId = Math.floor(100000000 + Math.random() * 900000000).toString();
    const roomsRef = collection(db, 'rooms');
    const newRoomRef = doc(roomsRef, generatedId);

    // 1. Clean up active old rooms in a separate non-blocking microtask to make creation instant
    try {
      const cleanupQuery = query(
        collection(db, 'rooms'),
        where('hostId', '==', currentUser.uid)
      );
      getDocs(cleanupQuery).then((snap) => {
        const activeRooms = snap.docs.filter(d => d.data().isLive !== false);
        for (const rDoc of activeRooms) {
          console.log("[LoungeSync] Asynchronously deactivating pre-existing host room:", rDoc.id);
          setDoc(doc(db, 'rooms', rDoc.id), { isLive: false }, { merge: true }).catch(() => {});
        }
      }).catch((e) => {
        console.warn("Background pre-create room check cleanup error:", e);
      });
    } catch (e) {
      console.warn("Background pre-create room cleanup scheduling error:", e);
    }

    // Prepare room configurations
    const tagsList = roomTags
      .split(' ')
      .filter(t => t.startsWith('#'))
      .map(t => t.trim());

    const chosenCover = thumbnailUrl || getPremiumRoomCover(generatedId);
    const nowISO = new Date().toISOString();
    const parsedSeatsCount = Number(seatCount) || 8;

    const newRoom = {
      id: generatedId,
      title: title.trim(),
      description: description.trim(),
      thumbnailUrl: chosenCover,
      hostId: currentUser.uid,
      hostName: currentUser.displayName || 'Guest',
      hostPhoto: currentUser.photoURL || getPremiumAvatar(currentUser.uid),
      memberCount: 1, 
      createdAt: nowISO,
      category: roomCategory, 
      roomType: roomType,
      language: roomLanguage,
      password: roomPassword.trim(),
      welcomeMessage: welcomeMessage.trim(),
      tags: tagsList,
      musicEnabled: musicEnabled,
      seatCount: parsedSeatsCount,
      userLimit: Number(userLimit) || 100,
      backgroundTheme: selectedBackground,
      isLive: true,
      giftVolume: 0,
      hourlyJoinCount: 1,
      trendingScore: 0,
      lastTrendingUpdate: Date.now(),
      seats: Array.from({ length: parsedSeatsCount }, (_, i) => ({
        index: i,
        uid: i === 0 ? currentUser?.uid : null, // host automatically sits on Seat #0
        isLocked: false,
        isMuted: false,
        role: i === 0 ? 'owner' : null
      })),
      superAdminIds: [],
      coHostIds: []
    };

    console.log("[LoungeSync] Launching room and waiting for server synchronization...", generatedId);

    try {
      // 2. Perform synchronized concurrent writes to guarantee server storage before navigation
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

      // 3. Force-synchronize cache manager in background immediately on write acknowledgement to eliminate stale client lists
      RoomCache.forceSynchronize(newRoom as unknown as Room).catch((cacheErr) => {
        console.warn("[LoungeSync] Non-blocking cache-manager sync warning:", cacheErr);
      });

      toast.success('Your live customized audio room is official! 🎉🎙️');
      localStorage.setItem(`persistent_room_${currentUser.uid}`, generatedId);
      
      setLoading(false);
      setCreationPhase('idle');
      navigate(`/room/${generatedId}`);

    } catch (error) {
      console.error("[LoungeSync] Room launch synchronization error:", error);
      toast.error('Failed to create customized party room. Please check your network connection.');
      setLoading(false);
      setCreationPhase('idle');
      handleFirestoreError(error, OperationType.CREATE, `rooms/${generatedId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C101A] pb-32 text-white relative overflow-hidden font-sans">
      {/* Background glow templates */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-pink-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 -right-10 w-96 h-96 bg-[#3b82f6]/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Sticky elegant header */}
      <header className="px-6 pt-12 pb-5 flex items-center justify-between bg-[#0C101A]/95 sticky top-0 z-30 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all text-white border-none"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-base font-black uppercase italic tracking-tight">Create Room</h2>
            <p className="text-[9px] text-pink-500 uppercase tracking-widest font-extrabold">Configuring Custom Universe</p>
          </div>
        </div>
        <div className="bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-full px-3 py-1 text-[8.5px] font-black uppercase tracking-wider">
          👑 Premium Config
        </div>
      </header>

      <div className="px-5 space-y-7 pt-5 max-w-2xl mx-auto">
        
        {/* ROOM DP (Requirement 1: Lounge Canvas -> Room DP) */}
        <div className="bg-[#13192B]/40 border border-white/5 rounded-[28px] p-5 flex flex-col items-center gap-4 text-center">
          <span className="text-[10px] font-black uppercase text-pink-400 tracking-widest block">Room DP Preview</span>
          
          <div className="w-40 h-40 rounded-[36px] bg-black/40 border-[2.5px] border-dashed border-white/10 flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="DP preview" />
            ) : (
              <div className="text-center p-4">
                <Camera size={28} className="text-pink-500 mx-auto mb-2 animate-bounce" />
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Default Wallpaper Loaded</span>
              </div>
            )}
          </div>

          {/* Room Background Selector Presets & Gallery Upload (Requirement REPLACE with Background Selector, Gallery Upload, Premium Background Library) */}
          <div className="w-full space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Premium Background Library</span>
              <Button 
                size="xs" 
                variant="outline"
                onClick={handleSimulatedUpload}
                className="bg-white/5 border-white/10 text-pink-400 hover:text-white rounded-xl text-[9px] uppercase font-black h-8 px-3"
              >
                📸 Gallery Upload
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PREMIUM_BACKGROUNDS.map(bg => {
                const isSelected = selectedBackground === bg.id;
                return (
                  <button 
                    key={bg.id}
                    onClick={() => handleBackgroundSelect(bg.id, bg.url)}
                    className={`h-14 rounded-xl overflow-hidden relative border transition-all ${
                      isSelected 
                        ? 'border-pink-500 ring-2 ring-pink-500/30' 
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <p className="text-[8px] font-black text-white px-1 leading-tight line-clamp-2 uppercase">{bg.name}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-pink-500 text-white rounded-full p-0.5">
                        <Check size={8} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BASIC PARAMETERS */}
        <div className="bg-[#13192B]/40 border border-white/5 rounded-[28px] p-5 space-y-4 text-left">
          {/* Room Title */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Room Title</label>
            <Input 
              placeholder="E.g. VIP Moonlight Tea Chat ☕" 
              className="h-12 rounded-xl bg-white/5 border-white/10 font-bold text-white focus:ring-1 focus:ring-pink-500 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={45}
            />
          </div>

          {/* Room Description */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Room Description</label>
            <textarea 
              placeholder="Keep the room dynamic & respectful..." 
              className="w-full h-24 rounded-xl bg-white/5 border-white/10 p-3 font-semibold text-xs focus:ring-1 focus:ring-pink-500 focus:outline-none placeholder:text-gray-500 text-white resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={150}
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Welcome Message banner</label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <Input 
                placeholder="Message displayed in chat upon user entry..." 
                className="pl-10 h-10 rounded-xl bg-white/5 border-white/10 text-xs font-semibold text-white focus:ring-1 focus:ring-pink-500"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
              />
            </div>
          </div>

          {/* Room Tags */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Room Tags</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-500" size={14} />
              <Input 
                placeholder="E.g. #Social #Chill #Party" 
                className="pl-10 h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold text-zinc-200 focus:ring-1 focus:ring-pink-500"
                value={roomTags}
                onChange={(e) => setRoomTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* METRICS & PARAMETERS MAP */}
        <div className="bg-[#13192B]/40 border border-white/5 rounded-[28px] p-5 space-y-4 text-left">
          
          <div className="grid grid-cols-2 gap-4">
            {/* Room Language */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1">
                <Globe size={11} className="text-[#3b82f6]" /> Room Language
              </label>
              <select
                value={roomLanguage}
                onChange={e => setRoomLanguage(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-xs font-bold text-white focus:outline-none"
              >
                <option value="English">🇬🇧 English</option>
                <option value="Vietnamese">🇻🇳 Vietnamese</option>
                <option value="Indonesian">🇮🇩 Indonesian</option>
                <option value="Thai">🇹🇭 Thai</option>
                <option value="Spanish">🇪🇸 Spanish</option>
                <option value="Portuguese">🇧🇷 Portuguese</option>
                <option value="Arabic">🇸🇦 Arabic</option>
              </select>
            </div>

            {/* Room Password */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1">
                <Lock size={11} className="text-yellow-500" /> Room Password
              </label>
              <Input 
                placeholder="Leave blank for public"
                type="password"
                className="h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold"
                value={roomPassword}
                onChange={e => setRoomPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Seat Count Selector */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Seat Count Selector</label>
              <select
                value={seatCount}
                onChange={e => setSeatCount(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border-white/10 px-3 text-xs font-bold text-white focus:outline-none"
              >
                <option value="4">4 Mic Seats</option>
                <option value="8">8 Mic Seats (Standard)</option>
                <option value="12">12 Mic Seats</option>
                <option value="16">16 Mic Seats (VIP)</option>
              </select>
            </div>

            {/* User Limit Selector */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">User Limit Selector</label>
              <select
                value={userLimit}
                onChange={e => setUserLimit(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/5 border-white/10 px-3 text-xs font-bold text-white focus:outline-none"
              >
                <option value="50">50 Max Admits</option>
                <option value="100">100 Max Admits</option>
                <option value="200">200 Max Admits</option>
                <option value="500">500 Elite Members</option>
              </select>
            </div>
          </div>

          {/* Music default enabled */}
          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <div>
              <p className="text-xs font-black text-white uppercase tracking-wider">Enable Room Music Engine</p>
              <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">Let seat occupants play custom mp3 tracks natively</p>
            </div>
            <button 
              type="button"
              onClick={() => setMusicEnabled(!musicEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${musicEnabled ? 'bg-pink-600' : 'bg-white/15'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${musicEnabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* CATEGORIES MAP (Requirement 5: Add Categories) */}
        <div className="bg-[#13192B]/40 border border-white/5 rounded-[28px] p-5 space-y-4 text-left">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 block">SELECT ROOM CATEGORY</span>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map(cat => {
              const isSelected = roomCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setRoomCategory(cat.key)}
                  className={`h-11 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    isSelected 
                      ? 'bg-pink-600/15 border-pink-500 text-pink-400' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* ROOM TYPES (Requirement 5: Add Room Types) */}
        <div className="bg-[#13192B]/40 border border-white/5 rounded-[28px] p-5 space-y-4 text-left">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1 block font-extrabold">CHOOSE ROOM TYPE PRIVILEGE</span>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ROOM_TYPES.map(type => {
              const isSelected = roomType === type.key;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setRoomType(type.key)}
                  className={`h-11 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    isSelected 
                      ? 'bg-purple-600/20 border-purple-500 text-purple-400' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* SUBMIT BUTTON (Requirement 1: Create Lounge -> Create Room) */}
        <Button 
          onClick={handleCreate}
          disabled={loading}
          className="w-full h-15 rounded-3xl bg-gradient-to-r from-pink-500 via-red-500 to-purple-600 hover:opacity-95 text-white font-black uppercase tracking-widest text-xs transition-transform active:scale-95 shadow-[0_0_20px_rgba(219,39,119,0.3)] border-2 border-white/10 block mt-6"
        >
          {loading ? 'Creating Voice Room...' : 'Create Room 🚀'}
        </Button>
      </div>

      {/* Beautiful visual fullscreen progression overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[999] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full border-4 border-pink-500/10 border-t-pink-500 animate-spin flex items-center justify-center" />
              <div className="absolute inset-0 flex items-center justify-center text-3xl animate-bounce">
                🎙️
              </div>
            </div>
            
            <h3 className="text-xl font-black uppercase tracking-widest text-white mb-2">
              Launching Universe
            </h3>
            
            {/* Progression phases text */}
            <p className="text-xs font-black text-pink-400 animate-pulse uppercase tracking-widest h-6">
              {creationPhase === 'initiating' && '⚡ Pre-checking Host Credentials...'}
              {creationPhase === 'creating' && '🏗️ Building Custom Firestore Room...'}
              {creationPhase === 'joining' && '👑 Seat Allocation & Owner Sign-in...'}
              {creationPhase === 'completing' && '🚀 Warping into VIP Lounge...'}
            </p>
            
            <div className="max-w-xs w-full mt-6 space-y-1.5">
              <p className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest">
                VoiceStar Realtime Grid
              </p>
              <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500"
                  style={{
                    width: 
                      creationPhase === 'initiating' ? '25%' :
                      creationPhase === 'creating' ? '55%' :
                      creationPhase === 'joining' ? '80%' :
                      creationPhase === 'completing' ? '100%' : '5%'
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
