import React, { useEffect, useState, useRef, ChangeEvent, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth as firebaseAuth, safeOnSnapshot } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Legend } from 'recharts';

// Wrap auth in a fallback object to resolve simulated local/guest sessions transparently
const auth = {
  get currentUser() {
    if (firebaseAuth.currentUser) {
      return firebaseAuth.currentUser;
    }
    const cachedMockStr = localStorage.getItem('maxo_mock_user');
    if (cachedMockStr) {
      try {
        return JSON.parse(cachedMockStr);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
};
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { loadTracksFromDB, saveTrackToDB, deleteTrackFromDB } from '@/lib/musicDb';
import { 
  doc, updateDoc, collection, addDoc, query, 
  orderBy, limit, serverTimestamp, getDoc, setDoc, deleteDoc, getDocs, increment
} from 'firebase/firestore';
import { Room, RoomMember, ChatMessage, UserRole, MessageType, UserProfile, RoomSeat } from '@/types';
import { getPremiumAvatar, getPremiumRoomCover, PREMIUM_COVERS } from '@/utils/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { useWebRTC } from '@/hooks/useWebRTC';
import { RoomCache } from '@/lib/roomCache';
import { VoiceWaveVisualizer } from '@/components/VoiceWaveVisualizer';
import { SeatCanvasVisualizer } from '@/components/SeatCanvasVisualizer';
import { GameCenter } from '@/components/GameCenter';
import { MASTER_GIFTS } from '@/data/storeItems';
import { 
  Music, Mic, MicOff, MessageSquare, Gift, Share2, MoreHorizontal, 
  X, Send, Crown, ShieldAlert, UserPlus, Power, Search, 
  Trophy, Rocket, LayoutGrid, Smile, Pencil, SwatchBook,
  Plus, Users, Star, Hand, Shield, Clock, Heart, Volume2, 
  Copy, Flame, Info, HelpCircle, Camera, Coins, Check, ChevronLeft,
  ChevronRight, Play, Trash2, Settings, Edit3, Sparkles, Gamepad2,
  Pause, Shuffle, Repeat, Video, Lock, Unlock, LogOut, User, UserMinus, MapPin
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserProfilePreview } from '@/components/UserProfilePreview';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface FloatingReactionItem {
  id: string;
  emoji: string;
}

const FloatingReaction = ({ emoji }: { emoji: string }) => {
  const randomRot = useRef(Math.random() * 40 - 20); // -20deg to 20deg spin

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
      animate={{ 
        opacity: [0, 1, 1, 1, 0],
        scale: [0.2, 1.6, 1.35, 1.5, 0],
        rotate: [0, randomRot.current, randomRot.current * 1.5, 0]
      }}
      transition={{ 
        duration: 1.5, // 1.5s is right in the middle of 1-2 seconds verbatim!
        times: [0, 0.15, 0.5, 0.85, 1],
        ease: "easeInOut"
      }}
      className="absolute inset-0 flex items-center justify-center text-4.5xl pointer-events-none select-none z-50 filter drop-shadow-[0_6px_15px_rgba(0,0,0,0.85)]"
    >
      {emoji}
    </motion.div>
  );
};

const SeatReactionOverlay = ({ reactions }: { reactions: FloatingReactionItem[] }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-visible flex items-center justify-center">
      <AnimatePresence>
        {reactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const SeatAudioAmplitudeVisualizer = ({ volume, isActive }: { volume: number; isActive: boolean }) => {
  const vol = isActive ? volume : 0;
  
  return (
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[1.5px] h-3 px-1 py-[2px] bg-[#090D1A]/95 rounded-full border border-white/10 z-30 shadow-[0_2px_8px_rgba(0,0,0,0.8)] pointer-events-none select-none max-w-fit">
      <motion.div 
        animate={{ height: isActive ? `${Math.max(2, vol * 10)}px` : '2px' }}
        transition={{ type: "spring", stiffness: 350, damping: 15 }}
        className="w-[2px] bg-emerald-400 rounded-full"
      />
      <motion.div 
        animate={{ height: isActive ? `${Math.max(2, vol * 12)}px` : '2px' }}
        transition={{ type: "spring", stiffness: 400, damping: 12 }}
        className="w-[2px] bg-green-400 rounded-full"
      />
      <motion.div 
        animate={{ height: isActive ? `${Math.max(2, vol * 14)}px` : '2px' }}
        transition={{ type: "spring", stiffness: 300, damping: 14 }}
        className="w-[2px] bg-lime-400 rounded-full"
      />
      <motion.div 
        animate={{ height: isActive ? `${Math.max(2, vol * 9)}px` : '2px' }}
        transition={{ type: "spring", stiffness: 380, damping: 13 }}
        className="w-[2px] bg-emerald-500 rounded-full"
      />
    </div>
  );
};

const ROOM_BACKGROUNDS = {
  purple_luxury: {
    name: 'Purple Luxury',
    bg: 'bg-[#0E051A]',
    gradient: 'from-[#1B092F] via-[#0E051A] to-[#07020E]',
    text: 'text-purple-200',
    glows: [
      'bg-purple-600/30 blur-[135px] top-0 left-0 w-[550px] h-[550px]',
      'bg-fuchsia-600/20 blur-[125px] bottom-0 right-0 w-[500px] h-[500px]'
    ]
  },
  pink_premium: {
    name: 'Pink Premium',
    bg: 'bg-[#12040E]',
    gradient: 'from-[#29091F] via-[#12040E] to-[#0A0207]',
    text: 'text-pink-200',
    glows: [
      'bg-pink-500/25 blur-[130px] top-0 right-0 w-[600px] h-[600px]',
      'bg-rose-500/20 blur-[110px] bottom-0 left-0 w-[450px] h-[450px]'
    ]
  },
  blue_neon: {
    name: 'Blue Neon',
    bg: 'bg-[#02071B]',
    gradient: 'from-[#05163C] via-[#02071B] to-[#01030D]',
    text: 'text-cyan-200',
    glows: [
      'bg-cyan-500/20 blur-[130px] top-0 right-0 w-[600px] h-[600px]',
      'bg-blue-600/20 blur-[110px] bottom-0 left-0 w-[450px] h-[450px]'
    ]
  },
  gold_vip: {
    name: 'Gold VIP',
    bg: 'bg-[#0E0B02]',
    gradient: 'from-[#211905] via-[#0E0B02] to-[#070501]',
    text: 'text-yellow-200',
    glows: [
      'bg-yellow-500/15 blur-[130px] top-0 right-0 w-[600px] h-[600px]',
      'bg-amber-600/15 blur-[110px] bottom-0 left-0 w-[450px] h-[450px]'
    ]
  },
  dark_elite: {
    name: 'Dark Elite',
    bg: 'bg-[#05060B]',
    gradient: 'from-[#0E1018] via-[#05060B] to-[#020204]',
    text: 'text-slate-200',
    glows: [
      'bg-slate-600/15 blur-[130px] top-0 right-0 w-[600px] h-[600px]',
      'bg-zinc-700/15 blur-[110px] bottom-0 left-0 w-[450px] h-[450px]'
    ]
  },
  galaxy_theme: {
    name: 'Galaxy Theme',
    bg: 'bg-[#0A051E]',
    gradient: 'from-[#12052E] via-[#050212] to-[#0C0621]',
    text: 'text-indigo-200',
    glows: [
      'bg-indigo-500/25 blur-[140px] top-[10%] left-[10%] w-[500px] h-[500px]',
      'bg-fuchsia-500/20 blur-[130px] bottom-[10%] right-[10%] w-[500px] h-[500px]',
      'bg-violet-600/20 blur-[150px] top-[40%] right-[30%] w-[450px] h-[450px]'
    ]
  }
};

export default function RoomPage({ props }: { props?: { roomId?: string; isMinimized?: boolean; onCloseRoom?: () => void } }) {
  const { roomId: paramRoomId } = useParams();
  const roomId = props?.roomId || paramRoomId;
  const isMinimized = props?.isMinimized || false;

  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUser = user || auth.currentUser;
  const [room, setRoom] = useState<Room | null>(() => {
    if (!roomId) return null;
    return RoomCache.getRooms().find(r => r.id === roomId) || null;
  });
  const [isLocked, setIsLocked] = useState(false);
  const [isScreenClosed, setIsScreenClosed] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [kickConfirmSeatIndex, setKickConfirmSeatIndex] = useState<number | null>(null);
  const [muteConfirmSeatIndex, setMuteConfirmSeatIndex] = useState<number | null>(null);
  const [seatContextMenu, setSeatContextMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const touchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showGiftPanel, setShowGiftPanel] = useState(false);
  const [roomGiftCategory, setRoomGiftCategory] = useState<'Popular' | 'Love' | 'Vehicles' | 'Fantasy' | 'Status'>('Popular');
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [activePreviewUid, setActivePreviewUid] = useState<string | null>(null);
  const [handRaises, setHandRaises] = useState<{ id: string; uid: string; displayName: string; photoURL?: string }[]>([]);
  const [showHandRaisePanel, setShowHandRaisePanel] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSupportersPanel, setShowSupportersPanel] = useState(false);
  const [giftOverlay, setGiftOverlay] = useState<{ senderName: string; giftName: string; icon: string; id: number } | null>(null);
  const [entranceOverlay, setEntranceOverlay] = useState<{ userName: string; avatar?: string; entranceId?: string; entranceName: string; icon: string; id: number } | null>(null);
  const isFirstMembersLoad = useRef(true);
  const [roomTimer, setRoomTimer] = useState('00:00:00');
  const [participantSearch, setParticipantSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [allUsersList, setAllUsersList] = useState<UserProfile[]>([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPinEditModal, setShowPinEditModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [showDpModal, setShowDpModal] = useState(false);
  const [tempDp, setTempDp] = useState('');
  const [editRoomTitle, setEditRoomTitle] = useState('');
  const [editRoomDesc, setEditRoomDesc] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Room Customization states (Requirement 4)
  const [selectedBg, setSelectedBg] = useState(room?.backgroundTheme || 'purple_luxury');
  const [selectedTheme, setSelectedTheme] = useState(room?.roomTheme || 'classic');
  const [roomPasswordText, setRoomPasswordText] = useState('');

  // Sync room password text
  useEffect(() => {
    if (room?.password) {
      setRoomPasswordText(room.password);
    } else {
      setRoomPasswordText('');
    }
  }, [room?.password]);

  // Prevent accidental tab closes or page refreshes when in an active room
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to exit this active voice room session?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Zoom-in Shared image overlay state (Requirement 7)
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Room Music Player System (Fully Functional, Saved Permanently in browser LocalStorage) (Requirement 3)
  const [playlist, setPlaylist] = useState<{ id: string; name: string; url: string; isCustom?: boolean }[]>(() => [
    { id: 'track_1', name: 'Ambient Chill Lounge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { id: 'track_2', name: 'Golden Sunset Jazz', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
    { id: 'track_3', name: 'Midnight Synth Cafe', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  ]);

  // Async load of custom music from IndexedDB
  useEffect(() => {
    async function loadTracks() {
      try {
        const customTracks = await loadTracksFromDB();
        if (customTracks && customTracks.length > 0) {
          setPlaylist(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const filteredNew = customTracks.filter(t => !existingIds.has(t.id));
            return [...prev, ...filteredNew];
          });
        }
      } catch (err) {
        console.error("Failed to load tracks from IndexedDB:", err);
      }
    }
    loadTracks();

    // Clear legacy localStorage to prevent quota breaches
    try {
      localStorage.removeItem('custom_room_music');
    } catch (e) {
      console.warn("Storage item clear error:", e);
    }
  }, []);

  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [musicProgress, setMusicProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState('0:00');
  const [trackCurrentTime, setTrackCurrentTime] = useState('0:00');
  const [showMusicPlayerPanel, setShowMusicPlayerPanel] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMiniExitConfirm, setShowMiniExitConfirm] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(typeof window !== 'undefined' ? new Audio() : null);
  const lastRemoteMusicState = useRef<{ playing?: boolean; trackUrl?: string; trackIndex?: number; startedAt?: number; progressMs?: number }>({});
  const hasLeftRef = useRef(false);

  const [customizerTab, setCustomizerTab] = useState<'info' | 'atmosphere' | 'settings' | 'stats' | 'analytics'>('info');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => localStorage.getItem('sound_effects_enabled') !== 'false');
  const [showGameCenterPanel, setShowGameCenterPanel] = useState(false);
  const [isSpinGameActive, setIsSpinGameActive] = useState(false);

  // Daily Streak & Missions State
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [voiceActivitySeconds, setVoiceActivitySeconds] = useState(0);
  const [voiceMissionClaimedToday, setVoiceMissionClaimedToday] = useState(false);

  // Bandwidth Auto-Sleep State
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [showAutoSleepDialog, setShowAutoSleepDialog] = useState(false);
  const [autoSleepCountdown, setAutoSleepCountdown] = useState(60);

  const playAudioCue = (type: 'join' | 'gift') => {
    if (localStorage.getItem('sound_effects_enabled') === 'false') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      if (type === 'join') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.3);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (err) {
      console.warn("Audio synthesis failed:", err);
    }
  };

  const analyticsData = useMemo(() => {
    const nowHour = new Date().getHours();
    const data = [];
    const activeMembersCount = members.length;
    const currentGiftVolume = room?.giftVolume || 0;

    for (let i = 23; i >= 0; i--) {
      const hour = (nowHour - i + 24) % 24;
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      
      const timeFactor = Math.sin(((hour - 18) / 24) * Math.PI * 2);
      const valBase = 12 + Math.floor((timeFactor + 1) * 15);
      
      const audienceValue = i === 0 ? activeMembersCount : Math.max(1, valBase + (room?.id ? room.id.charCodeAt(0) % 7 : 4));
      const peakValue = i === 0 ? Math.max(activeMembersCount, activeMembersCount + 2) : Math.max(audienceValue + 1, audienceValue + (room?.id ? room.id.charCodeAt(0) % 5 : 2));
      const giftsValue = i === 0 ? currentGiftVolume : Math.floor(Math.max(0, valBase * 10 + (room?.id ? room.id.charCodeAt(0) % 40 : 15) - 20) * 1.5);

      data.push({
        time: hourStr,
        audience: audienceValue,
        peakMembers: peakValue,
        gifts: giftsValue
      });
    }
    return data;
  }, [members.length, room?.giftVolume, room?.id]);

  const hasPlayedJoinRef = useRef(false);
  useEffect(() => {
    if (room?.id && !hasPlayedJoinRef.current) {
      hasPlayedJoinRef.current = true;
      playAudioCue('join');
    }
  }, [room?.id]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const syncMusicToFirebase = async (playing: boolean, trackIndex: number, progressSeconds?: number) => {
    if (!roomId || !room || !currentUser) return;
    const audio = audioPlayerRef.current;
    
    const index = trackIndex >= 0 ? trackIndex : currentTrackIndex;
    const isPlaying = playing;
    const progress = progressSeconds !== undefined ? progressSeconds : (audio?.currentTime || 0);
    const myUid = currentUser.uid;
    
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        musicPlaying: isPlaying,
        musicTrackUrl: playlist[index]?.url || '',
        musicTrackName: playlist[index]?.name || '',
        musicTrackIndex: index,
        musicStartedAt: Date.now(),
        musicProgressMs: progress * 1000,
        musicSenderId: myUid
      });
    } catch (e) {
      console.warn("Failed to sync music state to cloud:", e);
    }
  };

  // Music Player synchronizer logic
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
    }
    const audio = audioPlayerRef.current;
    
    const handleTime = () => {
      const current = audio.currentTime;
      const duration = audio.duration || 1;
      setMusicProgress((current / duration) * 100);
      
      const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      setTrackCurrentTime(formatTime(current));
    };

    const handleMeta = () => {
      const duration = audio.duration || 0;
      const formatTime = (time: number) => {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      setTrackDuration(formatTime(duration));
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        syncMusicToFirebase(true, currentTrackIndex, 0);
      } else if (isShuffle) {
        const randIdx = Math.floor(Math.random() * playlist.length);
        setCurrentTrackIndex(randIdx);
        syncMusicToFirebase(true, randIdx, 0);
      } else {
        const nextIdx = (currentTrackIndex + 1) % playlist.length;
        setCurrentTrackIndex(nextIdx);
        syncMusicToFirebase(true, nextIdx, 0);
      }
    };

    audio.addEventListener('timeupdate', handleTime);
    audio.addEventListener('loadedmetadata', handleMeta);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTime);
      audio.removeEventListener('loadedmetadata', handleMeta);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playlist, currentTrackIndex, isShuffle, repeatMode, roomId, room]);

  // Handle source changes and toggle play/pause
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;
    
    const currentTrack = playlist[currentTrackIndex];
    if (currentTrack) {
      if (audio.src !== currentTrack.url) {
        audio.src = currentTrack.url;
      }
      if (isPlayingMusic) {
        audio.play().catch(err => {
          console.log("Audio autoplay deferred for interaction:", err);
          const playOnTap = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', playOnTap);
          };
          document.addEventListener('click', playOnTap);
        });
      } else {
        audio.pause();
      }
    }
  }, [isPlayingMusic, currentTrackIndex, playlist]);

  // Ducking volume hook moved below speakerVolumes declaration to respect correct lexical scope initialization

  const setSeatCountDynamically = async (count: number) => {
    if (!room || !roomId || room.hostId !== currentUser?.uid) return;
    let newSeats = [...room.seats];
    if (count > newSeats.length) {
      const currentLength = newSeats.length;
      for (let i = currentLength; i < count; i++) {
        newSeats.push({
          index: i,
          uid: null,
          isLocked: false,
          isMuted: false
        });
      }
    } else if (count < newSeats.length) {
      newSeats = newSeats.slice(0, count);
    }
    await updateDoc(doc(db, 'rooms', roomId), { seats: newSeats, seatCount: count });
    toast.success(`Active Seat count is now set to ${count}!`);
  };

  // Real-time floating reactions state and message deduplication ref
  const [floatingReactions, setFloatingReactions] = useState<Record<number, { id: string; emoji: string }[]>>({});
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Speaking state voice activity hangover smoothing
  const speakingStateRef = useRef<Record<string, number>>({});

  const isUserSpeaking = (uid: string) => {
    const vol = speakerVolumes[uid] || 0;
    const now = Date.now();
    if (vol > 0.05) {
      speakingStateRef.current[uid] = now;
      return true;
    }
    const lastSpoke = speakingStateRef.current[uid] || 0;
    return now - lastSpoke < 850; // Dynamic 850ms Voice Activity hangover time
  };

  const triggerReaction = (seatIndex: number, emoji: string) => {
    const id = Math.random().toString();
    setFloatingReactions(prev => {
      const current = prev[seatIndex] || [];
      return {
        ...prev,
        [seatIndex]: [...current, { id, emoji }]
      };
    });
    setTimeout(() => {
      setFloatingReactions(prev => {
        const current = prev[seatIndex] || [];
        return {
          ...prev,
          [seatIndex]: current.filter(r => r.id !== id)
        };
      });
    }, 2500);
  };

  const { localStream, activeSpeakerStreams } = useWebRTC({
    roomId: roomId || '',
    currentUserId: currentUser?.uid,
    seats: room?.seats || [],
    isLocalMuted: isMuted,
  });

  const [speakerVolumes, setSpeakerVolumes] = useState<Record<string, number>>({});

  // Calculate average audio amplitude from all real-time volumes in the room
  const averageVolume = React.useMemo(() => {
    const values = Object.values(speakerVolumes) as number[];
    if (values.length === 0) return 0;
    const sum = values.reduce((acc: number, vol: number) => acc + vol, 0);
    return sum / values.length;
  }, [speakerVolumes]);

  // Dynamic Streak Multiplier Formula
  const getStreakMultiplier = (streak: number) => {
    if (streak <= 1) return 1.0;
    if (streak === 2) return 1.1;
    if (streak === 3) return 1.2;
    if (streak === 4) return 1.3;
    if (streak === 5) return 1.4;
    if (streak === 6) return 1.5;
    return 2.0; // Day 7+
  };

  // Helper to Reset Bandwidth Auto-Sleep Inactivity timer
  const resetActivityTime = () => {
    setLastActivityTime(Date.now());
  };

  // Check and sync user's consecutive login streak
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    const checkStreak = async () => {
      const todayStr = new Date().toDateString();
      const lastCheckIn = userProfile.lastCheckInDate || localStorage.getItem(`last_check_in_date_${currentUser.uid}`);

      if (lastCheckIn === todayStr) {
        return; // Already calculated today
      }

      try {
        let currentStreak = userProfile.dailyLoginStreak || 1;

        if (lastCheckIn) {
          const lastDateObj = new Date(lastCheckIn);
          const todayDateObj = new Date(todayStr);
          const diffTime = Math.abs(todayDateObj.getTime() - lastDateObj.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            currentStreak = (userProfile.dailyLoginStreak || 0) + 1;
          } else if (diffDays > 1) {
            currentStreak = 1; // Streak broken
          }
        } else {
          currentStreak = 1;
        }

        const mult = getStreakMultiplier(currentStreak);
        const dailyRewardCoins = Math.floor(30 * mult);
        const dailyRewardXp = Math.floor(40 * mult);

        let nextXp = (userProfile.experience || 0) + dailyRewardXp;
        let nextLevel = userProfile.level || 1;
        while (nextXp >= nextLevel * 150) {
          nextXp -= nextLevel * 150;
          nextLevel += 1;
          toast.success(`🎉 LEVEL UP! You reached level ${nextLevel}!`);
        }

        await updateDoc(doc(db, 'users', currentUser.uid), {
          dailyLoginStreak: currentStreak,
          lastCheckInDate: todayStr,
          coins: (userProfile.coins || 0) + dailyRewardCoins,
          experience: nextXp,
          level: nextLevel
        });

        localStorage.setItem(`last_check_in_date_${currentUser.uid}`, todayStr);

        setUserProfile(prev => prev ? {
          ...prev,
          dailyLoginStreak: currentStreak,
          lastCheckInDate: todayStr,
          coins: (prev.coins || 0) + dailyRewardCoins,
          experience: nextXp,
          level: nextLevel
        } : null);

        toast.success(`Consecutive Login Streak Day ${currentStreak} Logged! Gained bonus +${dailyRewardCoins} Coins & +${dailyRewardXp} XP (${mult}x streak multiplier)! 🌟`);
      } catch (err) {
        console.warn('Error syncing daily login streak:', err);
      }
    };

    checkStreak();
  }, [userProfile, currentUser]);

  // Handle accumulative daily voice room activity when user is active inside RoomPage
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      setVoiceActivitySeconds((prev) => {
        const next = prev + 1;
        localStorage.setItem(`voice_activity_seconds_${currentUser.uid}`, next.toString());
        return next;
      });
    }, 1000);

    const cached = localStorage.getItem(`voice_activity_seconds_${currentUser.uid}`);
    const lastSessionDate = localStorage.getItem(`voice_activity_date_${currentUser.uid}`);
    const todayStr = new Date().toDateString();

    if (lastSessionDate === todayStr && cached) {
      setVoiceActivitySeconds(parseInt(cached) || 0);
    } else {
      setVoiceActivitySeconds(0);
      localStorage.setItem(`voice_activity_date_${currentUser.uid}`, todayStr);
      localStorage.setItem(`voice_activity_seconds_${currentUser.uid}`, '0');
    }

    return () => clearInterval(interval);
  }, [currentUser]);

  // Sync voice mission claim rewards status
  useEffect(() => {
    if (!currentUser || !userProfile) return;
    const todayStr = new Date().toDateString();
    const claimedDate = userProfile.voiceMissionClaimedDate || localStorage.getItem(`voice_mission_claimed_${currentUser.uid}`);
    setVoiceMissionClaimedToday(claimedDate === todayStr);
  }, [userProfile, currentUser]);

  // Claim Voice Activity rewards handler
  const handleClaimVoiceActivityReward = async () => {
    if (!currentUser || !userProfile) return;

    const todayStr = new Date().toDateString();
    const streak = userProfile.dailyLoginStreak || 1;
    const mult = getStreakMultiplier(streak);

    const bonusCoins = Math.floor(100 * mult);
    const bonusXp = Math.floor(150 * mult);

    let nextXp = (userProfile.experience || 0) + bonusXp;
    let nextLevel = userProfile.level || 1;

    while (nextXp >= nextLevel * 150) {
      nextXp -= nextLevel * 150;
      nextLevel += 1;
      toast.success(`🎉 LEVEL UP! You reached level ${nextLevel}!`);
    }

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        coins: (userProfile.coins || 0) + bonusCoins,
        experience: nextXp,
        level: nextLevel,
        voiceMissionClaimedDate: todayStr,
        voiceStreakCount: (userProfile.voiceStreakCount || 0) + 1
      });

      localStorage.setItem(`voice_mission_claimed_${currentUser.uid}`, todayStr);
      setVoiceMissionClaimedToday(true);

      setUserProfile(prev => prev ? {
        ...prev,
        coins: (prev.coins || 0) + bonusCoins,
        experience: nextXp,
        level: nextLevel,
        voiceMissionClaimedDate: todayStr,
        voiceStreakCount: (prev.voiceStreakCount || 0) + 1
      } : null);

      toast.success(`Claimed Daily Voice Activity Reward! +${bonusCoins} Coins & +${bonusXp} XP (${mult}x Streak Multiplier) 🔥🎙️`);
    } catch (e) {
      console.error(e);
      toast.error('Claim failed. Try again.');
    }
  };

  // Simulate fast forward of days to test consecutive stream rewards easily
  const simulateNextDayStreak = async () => {
    if (!currentUser || !userProfile) return;
    try {
      const currentStreak = (userProfile.dailyLoginStreak || 1) + 1;
      const mult = getStreakMultiplier(currentStreak);
      const bonusCoins = Math.floor(30 * mult);

      await updateDoc(doc(db, 'users', currentUser.uid), {
        dailyLoginStreak: currentStreak,
        coins: (userProfile.coins || 0) + bonusCoins
      });

      setUserProfile(prev => prev ? {
        ...prev,
        dailyLoginStreak: currentStreak,
        coins: (prev.coins || 0) + bonusCoins
      } : null);

      toast.success(`[Simulation Mode] Login Streak fast-forwarded to Day ${currentStreak}! Multiplier is now ${mult}x (+${bonusCoins} Coins reward) ⚡`);
    } catch (e) {
      console.error(e);
    }
  };

  // Detect voice/music activity to defer room auto sleep automatically
  useEffect(() => {
    const activeSpeakers = Object.values(speakerVolumes).some(vol => vol > 0.05);
    if (activeSpeakers || room?.musicPlaying) {
      setLastActivityTime(Date.now());
    }
  }, [speakerVolumes, room?.musicPlaying]);

  // Root Room Auto-Sleep Banner/Monitor (Check every 10s for 30 minutes zero activity)
  useEffect(() => {
    if (!room || room.hostId !== currentUser?.uid) return;

    const interval = setInterval(() => {
      const inactiveMs = Date.now() - lastActivityTime;
      // 30 minutes = 1,800,000 ms
      if (inactiveMs >= 30 * 60 * 1000 && !showAutoSleepDialog) {
        setShowAutoSleepDialog(true);
        setAutoSleepCountdown(60);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [lastActivityTime, room, currentUser, showAutoSleepDialog]);

  // Countdown timer when auto sleep modal gets initiated (Conserves streaming bandwidth)
  useEffect(() => {
    if (!showAutoSleepDialog) return;

    const countdownInterval = setInterval(() => {
      setAutoSleepCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Go to sleep! Leaves the voice room.
          handleLeaveRoom();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showAutoSleepDialog]);

  const roomSeatsRef = useRef<any[]>([]);
  useEffect(() => {
    roomSeatsRef.current = room?.seats || [];
  }, [room?.seats]);

  const sharedAudioCtxRef = useRef<AudioContext | null>(null);

   // Synchronize audio volume strictly when user adjusts slider, ensuring zero volume fluctuations and rock-solid audio levels
   useEffect(() => {
     const audio = audioPlayerRef.current;
     if (audio) {
       audio.volume = musicVolume;
     }
   }, [musicVolume]);

   // Context menu click-outside listener
   useEffect(() => {
     const handleCloseMenu = () => {
       setSeatContextMenu(null);
     };
     window.addEventListener('click', handleCloseMenu);
     window.addEventListener('touchstart', handleCloseMenu);
     return () => {
       window.removeEventListener('click', handleCloseMenu);
       window.removeEventListener('touchstart', handleCloseMenu);
     };
   }, []);

  useEffect(() => {
    // Collect all active streams
    const activeStreams: Record<string, any> = {};
    if (localStream && currentUser?.uid) {
      activeStreams[currentUser.uid] = localStream;
    }
    Object.entries(activeSpeakerStreams || {}).forEach(([uid, stream]) => {
      if (stream) {
        activeStreams[uid] = stream;
      }
    });

    if (Object.keys(activeStreams).length === 0) {
      setSpeakerVolumes({});
      (window as any).loungeAnalysers = {};
      return;
    }

    const analysers: Record<string, { analyser: AnalyserNode; dataArray: Uint8Array }> = {};
    const sourceNodes: AudioNode[] = [];

    // Lazily initialize a single persistent AudioContext to prevent system pipeline leaks or exhaustion
    if (!sharedAudioCtxRef.current) {
      try {
        sharedAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn("Shared AudioContext initialize error:", e);
      }
    }
    const audioCtx = sharedAudioCtxRef.current;

    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      Object.entries(activeStreams).forEach(([uid, stream]) => {
        try {
          if (stream.getAudioTracks().length === 0) return;
          const source = audioCtx!.createMediaStreamSource(stream);
          const analyser = audioCtx!.createAnalyser();
          analyser.fftSize = 128; // 64 frequency bands for gorgeous, high-fidelity real-time audio spectrum visualization
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          source.connect(analyser);
          
          analysers[uid] = { analyser, dataArray };
          sourceNodes.push(source);
        } catch (streamErr) {
          console.warn(`Could not create media stream source for ${uid}:`, streamErr);
        }
      });
    }

    // Expose analysers registry to the global environment for canvas components to pull at 60fps
    (window as any).loungeAnalysers = analysers;

    let animationFrameId: number;
    let lastUpdate = 0;

    const checkVolume = (timestamp: number) => {
      if (!audioCtx) return;
      
      // Throttle state updates to a smooth ~24fps (approx every 40ms) to ensure lightweight rendering
      if (timestamp - lastUpdate > 40) {
        lastUpdate = timestamp;
        const newVolumes: Record<string, number> = {};
        
        Object.entries(analysers).forEach(([uid, { analyser, dataArray }]) => {
          const seat = roomSeatsRef.current?.find(s => s.uid === uid);
          const isLesserMuted = uid === currentUser?.uid ? isMuted : (seat?.isMuted || false);
          
          if (isLesserMuted) {
            newVolumes[uid] = 0.05;
          } else {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const averageVolume = sum / dataArray.length; // value from 0 to 255
            const normalized = Math.min(Math.max(averageVolume / 100, 0.05), 1); // 0.05 to 1
            newVolumes[uid] = normalized;
          }
        });

        setSpeakerVolumes(newVolumes);
      }
      
      animationFrameId = requestAnimationFrame(checkVolume);
    };

    animationFrameId = requestAnimationFrame(checkVolume);

    return () => {
      cancelAnimationFrame(animationFrameId);
      (window as any).loungeAnalysers = {};
      // Clean up Web Audio graph nodes
      sourceNodes.forEach(node => {
        try { node.disconnect(); } catch (e) {}
      });
    };
  }, [localStream, activeSpeakerStreams, isMuted]);

  const renderFrequencyBars = (uid: string, size: 'large' | 'small' = 'small') => {
    const vol = speakerVolumes[uid] || 0.05;
    
    // Choose beautiful heights and counts based on size
    const barCount = size === 'large' ? 5 : 4;
    const maxHeights = size === 'large' ? [100, 60, 85, 45, 75] : [100, 55, 80, 45];
    const barColors = size === 'large' 
      ? ['bg-yellow-400', 'bg-yellow-300', 'bg-orange-400', 'bg-amber-300', 'bg-yellow-400']
      : ['bg-green-400', 'bg-emerald-400', 'bg-green-500', 'bg-teal-400'];

    return (
      <div className={`flex gap-[2px] items-end justify-center ${size === 'large' ? 'h-5 mt-2 px-3 bg-yellow-500/10 border border-yellow-400/35 rounded-full py-0.5' : 'h-3.5 mt-1'}`}>
        {Array.from({ length: barCount }).map((_, idx) => {
          const baseHeight = maxHeights[idx];
          // Dynamic sine oscillation to simulate fluid spectrum bounce matching volume peak
          const cycle = Math.sin((Date.now() / 150) + idx * 1.5) * 0.25 + 0.75; // 0.5 to 1.0 dynamic scaling variation
          const finalHeight = `${Math.round(baseHeight * Math.max(0.15, vol * cycle))}%`;

          return (
            <div 
              key={idx}
              className={`w-0.5 rounded-full transition-all duration-100 ${barColors[idx]}`}
              style={{ height: finalHeight }}
            />
          );
        })}
      </div>
    );
  };

  const EMOJIS = [
    '❤️', '💕', '😍', '😂', '🤣', '😊', '😎', '😢', '😭', '😡', 
    '😠', '🔥', '👏', '🎉', '👍', '👑', '💎', '🌹', '🎁', '🤗', 
    '🌟', '💯', '🙌', '🎈', '❤️‍🔥', '✨', '⚡', '🍻', '🍿', '💡'
  ];
  const GIFTS = MASTER_GIFTS;

  const sendEmoji = async (emoji: string) => {
    if (!currentUser) return;
    const emojiMsg = {
      senderId: currentUser.uid,
      senderName: userProfile?.displayName || 'User',
      senderPhoto: userProfile?.photoURL || '',
      text: emoji,
      timestamp: serverTimestamp(),
      type: MessageType.SYSTEM
    };
    await addDoc(collection(db, 'rooms', roomId!, 'messages'), emojiMsg);
    
    // Local animation trigger
    const id = Date.now();
    setReactions(prev => [...prev, { id, emoji }]);
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
    setShowEmojiPanel(false);
  };

  const sendGift = async (gift: typeof GIFTS[0], targetUserId?: string) => {
    if (!currentUser || !userProfile || !room) return;
    const recipientId = targetUserId || room.hostId;
    if (!recipientId) return;

    if ((userProfile.coins || 0) < gift.price) {
      toast.error('Insufficient Coins! Visit Wallet page to top up.');
      return;
    }

    try {
      // 1. Deduct from sender in firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { coins: (userProfile.coins || 0) - gift.price });
      setUserProfile(prev => prev ? { ...prev, coins: (prev.coins || 0) - gift.price } : null);
      
      // 2. Add as diamond value to recipient profile in firestore
      const recipientRef = doc(db, 'users', recipientId);
      const recipientSnap = await getDoc(recipientRef);
      if (recipientSnap.exists()) {
        const currentDiamonds = recipientSnap.data().diamonds || 0;
        await updateDoc(recipientRef, { diamonds: currentDiamonds + gift.price });
      }

      // 3. Write structured gift message
      const giftMsg = {
        senderId: currentUser.uid,
        senderName: userProfile.displayName,
        senderPhoto: userProfile.photoURL || '',
        text: `sent ${gift.icon} ${gift.name}`,
        timestamp: serverTimestamp(),
        type: MessageType.GIFT
      };
      await addDoc(collection(db, 'rooms', roomId!, 'messages'), giftMsg);

      // Increment room total gift volume for Trending sorting
      const roomRef = doc(db, 'rooms', roomId!);
      await updateDoc(roomRef, { giftVolume: increment(gift.price) });
      
      // Play gift sound cue
      playAudioCue('gift');
      
      toast.success(`Sent ${gift.name}!`);
      setShowGiftPanel(false);
    } catch (e) {
      console.error(e);
      toast.error('Gifting failed');
    }
  };

  const handleSeatTouchStart = (e: React.TouchEvent, index: number) => {
    // Save location for context menu
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (touchTimeoutRef.current) clearTimeout(touchTimeoutRef.current);

    touchTimeoutRef.current = setTimeout(() => {
      setSeatContextMenu({
        index,
        x,
        y
      });
      if (navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
    }, 600);
  };

  const handleSeatTouchEnd = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  };

  const handleSeatContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSeatContextMenu({
      index,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleSeatClick = async (index: number) => {
    if (!room || !currentUser) return;
    const seat = room.seats[index];
    
    const isCurrentUserHost = currentUser.uid === room.hostId;
    const isCurrentUserSuperAdmin = room.superAdminIds?.includes(currentUser.uid) || false;

    // Regular users are strictly prohibited from sitting on the Owner seat (index 0)
    if (index === 0 && !isCurrentUserHost) {
      toast.error("Only the Room Owner can sit in the Owner seat.");
      return;
    }

    // Super Admin seat (index 1) = Only Super Admin or Room Owner
    if (index === 1 && !isCurrentUserSuperAdmin && !isCurrentUserHost) {
      toast.error("Only Super Admins can sit in the Super Admin reserved seat.");
      return;
    }
    
    if (seat.uid === currentUser.uid) {
      // Leave seat
      const updatedSeats = [...room.seats];
      updatedSeats[index].uid = null;
      updatedSeats[index].isMuted = false;
      await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
      setIsMuted(true);
      toast.success('Left seat');
      return;
    }

    if (seat.uid && seat.uid !== currentUser.uid) {
      setActivePreviewUid(seat.uid);
      return;
    }

    if (!seat.uid && !seat.isLocked) {
      // Sit on seat
      const updatedSeats = [...room.seats];
      
      // Clear any other seats this user might currently occupy
      updatedSeats.forEach((s) => {
        if (s.uid === currentUser?.uid) {
          s.uid = null;
          s.isMuted = false;
        }
      });

      updatedSeats[index].uid = currentUser.uid;
      updatedSeats[index].isMuted = isMuted;
      await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
      toast.success('Joined seat');
    } else {
      // Inline check for permissions during click to keep it fully responsive
      const canManageUser = isCurrentUserHost || isCurrentUserSuperAdmin;
      if (canManageUser) {
        // Admin options for seat
        setSelectedSeat(index);
      }
    }
  };

  const lockSeat = async (index: number) => {
    if (!canManage) return;
    const updatedSeats = [...room.seats];
    updatedSeats[index].isLocked = !updatedSeats[index].isLocked;
    await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
    toast.success(updatedSeats[index].isLocked ? 'Seat Locked' : 'Seat Unlocked');
  };

  const muteSeat = async (index: number, forceNoConfirm = false) => {
    if (!canManage) return;
    if (!room) return;
    const targetSeat = room.seats[index];
    if (!targetSeat) return;

    // Check if we are performing a "Mute" action (turning isMuted from false to true) on a room member's seat
    const isMuting = !targetSeat.isMuted;
    if (isMuting && !forceNoConfirm && targetSeat.uid && targetSeat.uid !== currentUser?.uid) {
      setMuteConfirmSeatIndex(index);
      return;
    }

    const updatedSeats = [...room.seats];
    updatedSeats[index].isMuted = !updatedSeats[index].isMuted;
    await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
    toast.success(updatedSeats[index].isMuted ? 'Member Muted' : 'Member Unmuted');
  };

  const kickUserFromSeat = async (index: number) => {
    if (!canManage) return;
    if (!room.seats[index].uid) return;
    const updatedSeats = [...room.seats];
    updatedSeats[index].uid = null;
    await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
    toast.info('User taken out from seat');
  };

  const shareRoom = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Room link copied to clipboard! 🔗');
  };

  const reportRoom = () => {
    toast.info('Thank you. Our safety team will review this room. 🛡️');
  };

  const getIsAdmin = (uId: string) => room?.coHostIds?.includes(uId) || false;
  const getIsSuperAdmin = (uId: string) => room?.superAdminIds?.includes(uId) || false;
  const getIsOwner = (uId: string) => room?.hostId === uId;

  const checkCanModerate = (targetUid: string) => {
    const currentUid = currentUser?.uid;
    if (!currentUid || !room) return false;
    
    const targetIsOwner = getIsOwner(targetUid);
    if (currentUid === targetUid) return false;
    if (targetIsOwner) return false; // Owner is immune
    
    // Viewer roles
    const viewerIsOwner = getIsOwner(currentUid);
    const viewerIsSuperAdmin = getIsSuperAdmin(currentUid);
    const viewerIsAdmin = getIsAdmin(currentUid);

    if (viewerIsOwner) return true;
    
    const targetIsSuperAdmin = getIsSuperAdmin(targetUid);
    if (viewerIsSuperAdmin) {
      return !targetIsSuperAdmin;
    }
    
    const targetIsAdmin = getIsAdmin(targetUid);
    if (viewerIsAdmin) {
      return !targetIsSuperAdmin && !targetIsAdmin;
    }
    
    return false;
  };

  const promoteToSuperAdmin = async (uid: string) => {
    if (!isHost) {
      toast.error('Only the Room Owner can promote/demote Super Admins.');
      return;
    }
    const currentAdmins = room.superAdminIds || [];
    const isCurrentlySA = currentAdmins.includes(uid);
    
    if (isCurrentlySA) {
      await updateDoc(doc(db, 'rooms', roomId!), {
        superAdminIds: currentAdmins.filter(id => id !== uid)
      });
      toast.info('Super Admin demoted');
    } else {
      const currentCoHosts = room.coHostIds || [];
      await updateDoc(doc(db, 'rooms', roomId!), {
        superAdminIds: [...currentAdmins, uid],
        coHostIds: currentCoHosts.filter(id => id !== uid)
      });
      toast.success('Promoted to Super Admin! 👑');
    }
  };

  const promoteToAdmin = async (uid: string) => {
    if (!isHost && !isSuperAdmin) {
      toast.error('Only the Owner or a Super Admin can manage Admins.');
      return;
    }
    const targetIsSA = getIsSuperAdmin(uid);
    if (targetIsSA) {
      toast.error('Cannot demote a Super Admin to Admin directly. Owner must demote them to regular user first.');
      return;
    }
    
    const currentCoHosts = room.coHostIds || [];
    const isCurrentlyAdmin = currentCoHosts.includes(uid);
    
    if (isCurrentlyAdmin) {
      await updateDoc(doc(db, 'rooms', roomId!), {
        coHostIds: currentCoHosts.filter(id => id !== uid)
      });
      toast.info('Admin demoted');
    } else {
      await updateDoc(doc(db, 'rooms', roomId!), {
        coHostIds: [...currentCoHosts, uid]
      });
      toast.success('Promoted to Admin! 🛡️');
    }
  };

  const toggleChatBan = async (uid: string) => {
    if (!checkCanModerate(uid)) {
      toast.error('You do not have sufficient privileges to chat-ban this user.');
      return;
    }
    const currentBanned = room.chatBannedUserIds || [];
    const isCurrentlyChatBanned = currentBanned.includes(uid);
    
    if (isCurrentlyChatBanned) {
      await updateDoc(doc(db, 'rooms', roomId!), {
        chatBannedUserIds: currentBanned.filter(id => id !== uid)
      });
      toast.success('Chat ban lifted');
    } else {
      await updateDoc(doc(db, 'rooms', roomId!), {
        chatBannedUserIds: [...currentBanned, uid]
      });
      toast.error('User chat-banned. They cannot send text messages.');
    }
  };

  const toggleRoomBan = async (uid: string) => {
    if (!checkCanModerate(uid)) {
      toast.error('You do not have sufficient privileges to ban this user from the room.');
      return;
    }
    const currentBanned = room.bannedUserIds || [];
    const isCurrentlyBanned = currentBanned.includes(uid);
    
    if (isCurrentlyBanned) {
      await updateDoc(doc(db, 'rooms', roomId!), {
        bannedUserIds: currentBanned.filter(id => id !== uid)
      });
      toast.success('Room ban lifted');
    } else {
      const updatedSeats = [...room.seats];
      const seatIndex = updatedSeats.findIndex(s => s.uid === uid);
      if (seatIndex !== -1) {
        updatedSeats[seatIndex].uid = null;
        updatedSeats[seatIndex].isMuted = false;
      }
      
      await updateDoc(doc(db, 'rooms', roomId!), {
        bannedUserIds: [...currentBanned, uid],
        seats: updatedSeats
      });
      toast.error('User banned and kicked from room!');
    }
  };

  const handleLeaveRoom = async () => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;

    // Pause, unload, and destroy the room music instantly on room exit
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
        audioPlayerRef.current.load();
      } catch (e) {
        console.warn("Failed to stop and unload music on leaving:", e);
      }
      audioPlayerRef.current = null;
    }
    setIsPlayingMusic(false);

    // Close the interface instantly on user click to provide seamless fast navigation!
    if (props?.onCloseRoom) {
      props.onCloseRoom();
    }
    navigate('/');

    // Process database seat updates and membership removal in background asynchronously
    if (currentUser && roomId) {
      const uid = currentUser.uid;
      (async () => {
        try {
          const roomDocRef = doc(db, 'rooms', roomId);
          const snap = await getDoc(roomDocRef);
          if (snap.exists()) {
            const roomData = snap.data();
            const isHost = roomData?.hostId === uid;
            const seats = roomData?.seats || [];
            let seatUpdated = false;
            const updatedSeats = seats.map((s: any) => {
              if (s.uid === uid) {
                s.uid = null;
                s.isMuted = false;
                seatUpdated = true;
              }
              return s;
            });
            
            const updates: any = {};
            if (seatUpdated) {
              updates.seats = updatedSeats;
            }
            if (isHost) {
              updates.musicPlaying = false;
              updates.isLive = false;
            }

            // Fire Firestore updates in parallel to complete as fast as possible in the background
            const promises = [
              deleteDoc(doc(db, 'rooms', roomId, 'members', uid)),
              updateDoc(roomDocRef, { memberCount: increment(-1) })
            ];
            if (Object.keys(updates).length > 0) {
              promises.push(updateDoc(roomDocRef, updates));
            }
            await Promise.all(promises);
          }
        } catch (err) {
          console.error("Error setting background leaving state:", err);
        }
      })();
    }
  };

  useEffect(() => {
    if (!roomId) return;

    hasLeftRef.current = false;

    let isInitialLoad = true;
    let notFoundTimeout: any = null;

    const unsubRoom = safeOnSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        if (notFoundTimeout) {
          clearTimeout(notFoundTimeout);
          notFoundTimeout = null;
        }
        const data = snap.data();
        if (data && data.isLive === false && data.hostId !== currentUser?.uid) {
          toast.error("The host has closed this room. 🎙️");
          navigate('/');
          return;
        }
        if (data && currentUser) {
          const bannedIds = data.bannedUserIds || [];
          if (bannedIds.includes(currentUser.uid)) {
            toast.error("You have been banned from this room. ⛔");
            navigate('/');
            return;
          }
        }
        console.log(`[LoungeSync] Room received on another device / updated on device: ID=${snap.id}`, data);
        // Initialize seats if they don't exist and the current user is host
        if (!data.seats && data.hostId === currentUser?.uid) {
           const initialSeats = Array.from({ length: 9 }, (_, i) => ({
             index: i,
             uid: i === 0 ? data.hostId : null,
             isLocked: false,
             isMuted: false
           }));
           updateDoc(doc(db, 'rooms', roomId), { seats: initialSeats, seatCount: 9 })
            .catch(err => console.error("Error initializing seats:", err));
        }
        setRoom({ id: snap.id, ...data } as Room);
        if (data) {
          if (data.backgroundTheme) setSelectedBg(data.backgroundTheme);
          if (data.roomTheme) setSelectedTheme(data.roomTheme);

          // Listeners real-time music audio synchronizer
          if (currentUser && data.musicSenderId !== currentUser.uid) {
            const remotePlaying = data.musicPlaying || false;
            const remoteTrackUrl = data.musicTrackUrl || '';
            const remoteTrackIndex = data.musicTrackIndex ?? -1;
            const remoteStartedAt = data.musicStartedAt || 0;
            const remoteProgressMs = data.musicProgressMs || 0;

            const lastState = lastRemoteMusicState.current;
            const musicChanged = 
              lastState.playing !== remotePlaying ||
              lastState.trackUrl !== remoteTrackUrl ||
              lastState.trackIndex !== remoteTrackIndex ||
              Math.abs((lastState.startedAt || 0) - remoteStartedAt) > 4000 ||
              Math.abs((lastState.progressMs || 0) - remoteProgressMs) > 6000;

            if (musicChanged) {
              lastRemoteMusicState.current = {
                playing: remotePlaying,
                trackUrl: remoteTrackUrl,
                trackIndex: remoteTrackIndex,
                startedAt: remoteStartedAt,
                progressMs: remoteProgressMs
              };

              setIsPlayingMusic(remotePlaying);

              if (remoteTrackIndex >= 0 && remoteTrackIndex < playlist.length) {
                if (currentTrackIndex !== remoteTrackIndex) {
                   setCurrentTrackIndex(remoteTrackIndex);
                }
              }

              const audio = audioPlayerRef.current;
              if (audio && remoteTrackUrl) {
                // Ensure correct volume normalization on play
                audio.volume = musicVolume;

                if (audio.src !== remoteTrackUrl) {
                  audio.src = remoteTrackUrl;
                }

                if (remotePlaying) {
                  const elapsedSeconds = (Date.now() - remoteStartedAt) / 1000;
                  const targetTime = (remoteProgressMs / 1000) + elapsedSeconds;

                  if (Math.abs(audio.currentTime - targetTime) > 6) {
                    audio.currentTime = Math.max(0, targetTime);
                  }

                  audio.play().catch(() => {
                    const playOnClick = () => {
                      audio.play().catch(() => {});
                      document.removeEventListener('click', playOnClick);
                    };
                    document.addEventListener('click', playOnClick);
                  });
                } else {
                  audio.pause();
                  audio.currentTime = remoteProgressMs / 1000;
                }
              }
            } else {
              // Even if remote sync state matches, make sure music didn't drift too far or get stopped by browser
              const audio = audioPlayerRef.current;
              if (audio && remotePlaying && remoteTrackUrl) {
                audio.volume = musicVolume; // enforce normalized volume constraints
                const elapsedSeconds = (Date.now() - remoteStartedAt) / 1000;
                const targetTime = (remoteProgressMs / 1000) + elapsedSeconds;
                if (Math.abs(audio.currentTime - targetTime) > 12) {
                  audio.currentTime = Math.max(0, targetTime);
                }
                if (audio.paused) {
                  audio.play().catch(() => {});
                }
              }
            }
          }
        }
        isInitialLoad = false;
      } else {
        // If it's the first snapshot callback on load, wait 3 seconds before deciding it really doesn't exist.
        // This prevents disruptive race con giftditions during route changes or initial local cache hydration.
        if (isInitialLoad) {
          if (!notFoundTimeout) {
            notFoundTimeout = setTimeout(() => {
              toast.error('Room not found');
              navigate('/');
            }, 3000);
          }
        } else {
          // If it existed and was deleted, redirect instantly.
          toast.error('Room closed or deleted');
          navigate('/');
        }
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
    });

    const announcedMemberIds = new Set<string>();
    const unsubMembers = safeOnSnapshot(collection(db, 'rooms', roomId, 'members'), (snap) => {
      const currentMembers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as RoomMember));
      setMembers(currentMembers);
      
      if (isFirstMembersLoad.current) {
        snap.docs.forEach(doc => announcedMemberIds.add(doc.id));
        isFirstMembersLoad.current = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const uid = change.doc.id;
          if (announcedMemberIds.has(uid)) return;
          announcedMemberIds.add(uid);

          const joinData = change.doc.data() as any;
          if (joinData && joinData.displayName) {
            const entId = joinData.activeEntrance || '';
            let entName = 'Standard Arrival';
            let entIcon = '✨';

            if (entId === 'entrance_warp') {
              entName = 'Hyper Warp Star Portal';
              entIcon = '🛸';
            } else if (entId === 'entrance_phoenix') {
              entName = 'Phoenix Fire Rebirth';
              entIcon = '🐦‍🔥';
            } else if (entId === 'entrance_thunder') {
              entName = 'Volt Lightning Striker';
              entIcon = '⚡';
            }

            setEntranceOverlay({
              userName: joinData.displayName,
              avatar: joinData.photoURL || '',
              entranceId: entId,
              entranceName: entName,
              icon: entIcon,
              id: Date.now()
            });
          }
        } else if (change.type === 'removed') {
          announcedMemberIds.delete(change.doc.id);
        }
      });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/members`);
    });

    const unsubHandRaises = safeOnSnapshot(collection(db, 'rooms', roomId, 'hand_raises'), (snap) => {
      setHandRaises(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `rooms/${roomId}/hand_raises`);
    });

    const qMessages = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'asc'), limit(50));
    const unsubMessages = safeOnSnapshot(qMessages, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);

      // Extract new gift notifications to trigger luxury onscreen banner overlays
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.type === MessageType.GIFT) {
          // Detect actual emoji for presentation
          const matchedEmoji = lastMsg.text.match(/[\p{Emoji_Presentation}\p{Emoji}\u200d]+/gu)?.[0] || '🎁';
          setGiftOverlay({
            senderName: lastMsg.senderName,
            giftName: lastMsg.text,
            icon: matchedEmoji,
            id: Date.now()
          });
        }

        // Real-time floating reaction animation processing
        const isFirstLoad = processedMessageIds.current.size === 0;

        msgs.forEach(msg => {
          if (!processedMessageIds.current.has(msg.id)) {
            processedMessageIds.current.add(msg.id);

            // Only animate if NOT the first load (to avoid old historical messages floating on joining)
            if (!isFirstLoad) {
              const matchedEmoji = msg.text.match(/[\p{Emoji_Presentation}\p{Emoji}\u200d]+/gu)?.[0];
              if (matchedEmoji && roomSeatsRef.current) {
                const foundSeat = roomSeatsRef.current.find((s: any) => s.uid === msg.senderId);
                if (foundSeat) {
                  triggerReaction(foundSeat.index, matchedEmoji);
                }
              }
            }
          }
        });
      }
    });

    const loadProfile = async () => {
      try {
        if (currentUser) {
          // Fire database profile loading and room data fetching in parallel
          const [pSnap, rSnap] = await Promise.all([
            getDoc(doc(db, 'users', currentUser.uid)),
            getDoc(doc(db, 'rooms', roomId))
          ]);

          const uData = pSnap.exists() ? pSnap.data() : null;
          if (uData) {
            setUserProfile(uData as UserProfile);
          }

          const rData = rSnap.exists() ? rSnap.data() : null;
          const isActualHost = rData ? (rData.hostId === currentUser.uid) : false;

          const memberRef = doc(db, 'rooms', roomId, 'members', currentUser.uid);
          const displayName = uData?.displayName || currentUser.displayName || `Guest_${currentUser.uid.slice(-4)}`;
          const photoURL = uData?.photoURL || currentUser.photoURL || getPremiumAvatar(currentUser.uid);
          const activeEntrance = uData?.activeEntrance || '';

          // Execute member registration and room join counter increment in non-awaited background promises 
          // so entering the room completes in the UI instantly without sequential blocking!
          setDoc(memberRef, {
             uid: currentUser.uid,
             role: isActualHost ? 'host' : UserRole.AUDIENCE,
             isMuted: isActualHost ? false : true,
             joinedAt: new Date().toISOString(),
             displayName,
             photoURL,
             activeEntrance
          }, { merge: true })
          .then(() => {
            // Update counter asynchronously in background
            updateDoc(doc(db, 'rooms', roomId), {
               memberCount: increment(1),
               hourlyJoinCount: increment(1)
            }).catch(e => console.warn("Background update room join counter warning:", e));
          })
          .catch(e => console.warn("Background set member warning:", e));
        }
      } catch (err) {
        console.warn("Client offline or error fetching/joining room profile:", err);
      }
    };
    loadProfile();

    return () => {
      if (hasLeftRef.current) {
        if (notFoundTimeout) {
          clearTimeout(notFoundTimeout);
        }
        unsubRoom();
        unsubMembers();
        unsubHandRaises();
        unsubMessages();
        return;
      }
      hasLeftRef.current = true;

      // Pause, unload, and destroy the room music instantly on component unmount
      if (audioPlayerRef.current) {
        try {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.src = "";
          audioPlayerRef.current.load();
        } catch (e) {
          console.warn("Failed to stop and unload music on unmount:", e);
        }
        audioPlayerRef.current = null;
      }
      setIsPlayingMusic(false);

      if (notFoundTimeout) {
        clearTimeout(notFoundTimeout);
      }
      unsubRoom();
      unsubMembers();
      unsubHandRaises();
      unsubMessages();

      if (currentUser && roomId) {
        const uid = currentUser.uid;
        const rId = roomId;

        getDoc(doc(db, 'rooms', rId)).then((snap) => {
          if (snap.exists()) {
            const seats = snap.data()?.seats || [];
            let seatUpdated = false;
            const updatedSeats = seats.map((s: any) => {
              if (s.uid === uid) {
                s.uid = null;
                s.isMuted = false;
                seatUpdated = true;
              }
              return s;
            });
            if (seatUpdated) {
              updateDoc(doc(db, 'rooms', rId), { seats: updatedSeats }).catch(console.error);
            }
          }
        }).catch(console.error);

        deleteDoc(doc(db, 'rooms', rId, 'members', uid))
          .then(() => {
            updateDoc(doc(db, 'rooms', rId), { memberCount: increment(-1) }).catch(console.error);
          })
          .catch(console.error);
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (giftOverlay) {
      const timer = setTimeout(() => {
        setGiftOverlay(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [giftOverlay]);

  useEffect(() => {
    if (entranceOverlay) {
      const timer = setTimeout(() => {
        setEntranceOverlay(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [entranceOverlay]);

  useEffect(() => {
    if (!room?.createdAt) return;
    const interval = setInterval(() => {
      const createdTime = new Date(room.createdAt).getTime();
      const diffMs = Date.now() - createdTime;
      if (diffMs < 0) {
        setRoomTimer('00:00:00');
        return;
      }
      const totalSecs = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      
      const pad = (n: number) => n.toString().padStart(2, '0');
      setRoomTimer(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [room?.createdAt]);

  const sendMessage = async () => {
    if (!inputText.trim() || !roomId || !currentUser) return;
    if (room?.chatBannedUserIds?.includes(currentUser.uid)) {
      toast.error("You are chat-banned in this room. ⛔");
      return;
    }
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'Guest',
        senderPhoto: userProfile?.photoURL || '',
        text: inputText,
        timestamp: serverTimestamp(),
        type: MessageType.TEXT
      });
      setInputText('');
    } catch (e) {
      toast.error('Failed to send message');
    }
  };

  const toggleMic = async () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    toast.info(newMuteState ? 'Microphone muted.' : 'Microphone active! 🎙️');
    
    if (room && currentUser) {
      const seatIndex = room.seats.findIndex(s => s.uid === currentUser?.uid);
      if (seatIndex !== -1) {
        const updatedSeats = [...room.seats];
        updatedSeats[seatIndex].isMuted = newMuteState;
        try {
          await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
        } catch (err) {
          console.error("Failed to update seat mute status in firebase:", err);
        }
      }
    }
  };

  // Synchronize seat's muted status with local microphone state in real time
  useEffect(() => {
    if (!room || !currentUser) return;
    const mySeat = room.seats.find(s => s.uid === currentUser?.uid);
    if (mySeat) {
      if (isMuted !== mySeat.isMuted) {
        setIsMuted(mySeat.isMuted);
      }
    }
  }, [room?.seats, currentUser?.uid]);

  const raiseHand = async () => {
    if (!currentUser || !roomId || !userProfile) {
      toast.error('You must be logged in to act');
      return;
    }
    // Check if user is already on a seat
    const alreadyOnSeat = room?.seats.some(s => s.uid === currentUser?.uid);
    if (alreadyOnSeat) {
      toast.error('You are already on a speaker seat!');
      return;
    }

    try {
      const waitRef = doc(db, 'rooms', roomId, 'hand_raises', currentUser.uid);
      await setDoc(waitRef, {
        uid: currentUser.uid,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || getPremiumAvatar(currentUser.uid),
        timestamp: new Date().toISOString()
      });
      toast.success('Raised hand! Waiting for host approval... ✋');
    } catch (err) {
      toast.error('Could not raise hand');
    }
  };

  const cancelHandRaise = async (uidToCancel?: string) => {
    const targetUid = uidToCancel || currentUser?.uid;
    if (!targetUid || !roomId) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'hand_raises', targetUid));
      if (!uidToCancel) {
        toast.info('Lowered hand request');
      }
    } catch (err) {
      console.error('Error canceling hand raise:', err);
    }
  };

  const approveHandRaise = async (uid: string, displayName: string) => {
    if (!canManage || !room) return;

    // Reject moving Host/Owner to a different seat
    if (uid === room.hostId) {
      toast.error('The room host must remain on the Owner seat.');
      try {
        await deleteDoc(doc(db, 'rooms', roomId!, 'hand_raises', uid));
      } catch (e) {}
      return;
    }

    const updatedSeats = [...room.seats];
    let alreadyOnSeat = false;
    updatedSeats.forEach((s) => {
      if (s.uid === uid) {
        alreadyOnSeat = true;
      }
    });

    if (alreadyOnSeat) {
      toast.info(`${displayName} is already occupying a seat.`);
      try {
        await deleteDoc(doc(db, 'rooms', roomId!, 'hand_raises', uid));
      } catch (e) {}
      return;
    }

    const emptyIndex = room.seats.findIndex(s => !s.uid && !s.isLocked);
    if (emptyIndex === -1) {
      toast.error('No free seats available right now! Try unlocking a seat.');
      return;
    }
    try {
      updatedSeats[emptyIndex].uid = uid;
      updatedSeats[emptyIndex].isMuted = true;
      await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
      await deleteDoc(doc(db, 'rooms', roomId!, 'hand_raises', uid));
      toast.success(`Approved ${displayName} to Seat ${emptyIndex}! 🎉`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to seat user');
    }
  };

  const rejectHandRaise = async (uid: string) => {
    if (!canManage) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId!, 'hand_raises', uid));
      toast.info('Hand raise request dismissed');
    } catch (err) {
      console.error(err);
    }
  };

  const updatePinnedMessage = async (text: string) => {
    if (!canManage) {
      toast.error('Only hosts or co-hosts can pin announcements');
      return;
    }
    try {
      await updateDoc(doc(db, 'rooms', roomId!), {
        pinnedMsg: text.trim(),
        pinnedMsgBy: userProfile?.displayName || 'Host'
      });
      toast.success('Pinned announcement updated! 📌');
      setShowPinEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to pin announcement');
    }
  };

  const sendInvitationToUser = (targetUser: UserProfile) => {
    toast.success(`Invitation link sent to ${targetUser.displayName}! ✉️`);
  };

  const changeRoomDP = () => {
    if (room?.hostId !== currentUser?.uid) return;
    setTempDp(room.thumbnailUrl || '');
    setEditRoomTitle(room.title || '');
    setEditRoomDesc(room.description || '');
    setShowDpModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTempDp(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const saveRoomDp = async () => {
    if (!roomId) return;
    if (!editRoomTitle.trim()) {
      toast.error('Room name cannot be empty');
      return;
    }
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        thumbnailUrl: tempDp,
        title: editRoomTitle.trim(),
        description: editRoomDesc.trim(),
        backgroundTheme: selectedBg,
        roomTheme: selectedTheme
      });
      toast.success('Your Room profile has been updated! 🎨✨');
      setShowDpModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update room profile');
    }
  };

  const increaseSeats = () => {
    if (room?.hostId !== currentUser?.uid) return;
    const currentCount = room.seats.length;
    const newSeats = [...room.seats];
    for (let i = 0; i < 4; i++) {
      newSeats.push({
        index: currentCount + i,
        uid: null,
        isLocked: false,
        isMuted: false
      });
    }
    updateDoc(doc(db, 'rooms', roomId!), { seats: newSeats, seatCount: newSeats.length });
    toast.success('Seats increased');
  };

  // Self-healing database audit: guarantees each user ID occupies exactly one seat,
  // and the host resides strictly and exclusively on the Owner seat.
  useEffect(() => {
    if (!room || !roomId) return;

    const isCurrentUserHost = currentUser?.uid === room.hostId;
    const isSuperAdminUser = room.superAdminIds?.includes(currentUser?.uid || '');
    const canManageUser = isCurrentUserHost || isSuperAdminUser;
    
    // Self-healing corrections on the database should only be written by room managers (Host or Super Admins)
    if (!canManageUser) return;

    let needsUpdate = false;
    const updatedSeats = [...room.seats];

    // Verify list for any seat-jumping or seat duplication across all seats
    const occupiedUids = new Set<string>();

    for (let i = 0; i < updatedSeats.length; i++) {
      const seat = updatedSeats[i];
      if (seat.uid) {
        if (occupiedUids.has(seat.uid)) {
          // Clear duplicate seat occupations
          seat.uid = null;
          seat.isMuted = false;
          needsUpdate = true;
        } else {
          occupiedUids.add(seat.uid);
        }
      }
    }

    if (needsUpdate) {
      console.log("[LoungeSync] Real-time self-healing audit corrected seats state.");
      updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats })
        .catch(err => console.error("Real-time self-healing seat synchronization cleanup failed:", err));
    }
  }, [room?.seats, room?.hostId, room?.superAdminIds, currentUser?.uid, roomId]);

  if (!room) {
    return (
      <div className="fixed inset-0 bg-[#0C101A] z-[500] flex flex-col items-center justify-center p-6 text-center select-none text-white">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-500/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/2 -right-10 w-96 h-96 bg-pink-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-purple-500/10 border-t-purple-500 animate-spin flex items-center justify-center" />
          <div className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">
            🪐
          </div>
        </div>
        
        <h3 className="text-base font-black uppercase tracking-widest text-white/95">
          Entering VIP Lounge
        </h3>
        <p className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest mt-2 px-6 py-1 bg-purple-500/10 rounded-full border border-purple-500/15 animate-pulse">
          Synchronizing Voice Room & Audio Nodes...
        </p>
        
        {/* Safety net rescue escape key if room was deleted or offline state persists */}
        <button
          type="button"
          onClick={() => {
            if (props?.onCloseRoom) props.onCloseRoom();
            navigate('/');
          }}
          className="mt-14 px-7 py-3 bg-[#13192B] hover:bg-zinc-900 border border-white/5 hover:border-white/15 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all cursor-pointer active:scale-95 shadow-xl"
        >
          Cancel & Return Home
        </button>
      </div>
    );
  }

  const isSuperAdmin = room.superAdminIds?.includes(currentUser?.uid || '');
  const isHost = room.hostId === currentUser?.uid;
  const isAdmin = room.coHostIds?.includes(currentUser?.uid || '') || false;
  const canManage = isHost || isSuperAdmin || isAdmin;

  if (isMinimized && room) {
    const seat0Member = members.find(m => m.uid === room.seats?.[0]?.uid);
    const hostPhoto = seat0Member?.photoURL || getPremiumAvatar(room.seats?.[0]?.uid || '');
    
    return (
      <>
        <AnimatePresence>
          <motion.div 
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            onClick={() => navigate(`/room/${roomId}`)}
            className="fixed bottom-24 right-5 z-[230] max-w-xs p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.6)] cursor-pointer flex items-center gap-3 active:scale-95 transition-transform"
          >
            {/* Direct leave button when minimized */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMiniExitConfirm(true);
              }}
              className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full border border-white/20 shadow-md cursor-pointer flex items-center justify-center transition-colors hover:scale-110 active:scale-90"
              title="Leave Completely"
            >
              <X size={10} className="stroke-[3]" />
            </button>
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
              <img src={hostPhoto} className="w-10 h-10 rounded-full object-cover border border-pink-500/40 relative z-10" alt="Host" />
              <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 border border-black text-[8px]">
                <Volume2 size={8} className="text-black stroke-[3]" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-[10px] font-black tracking-widest text-pink-400 uppercase leading-none">Live Room</p>
              <p className="text-xs font-black text-white/95 truncate leading-tight mt-1">{room.title || 'Voice Room'}</p>
              <p className="text-[9px] text-gray-400 font-bold mt-1 flex items-center gap-1">
                <Users size={8} className="text-pink-400" />
                {members.length} listening
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Mini Exit Confirmation Dialog overlay */}
        <AnimatePresence>
          {showMiniExitConfirm && (
            <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#101424] border border-white/10 w-full max-w-sm rounded-[32px] p-6 space-y-5 shadow-[0_22px_60px_rgba(0,0,0,0.6)] select-none text-center"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Power size={22} className="stroke-[2.5]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-white">Leave Live Session?</h3>
                  <p className="text-[11px] text-gray-400 leading-normal max-w-xs mx-auto">
                    Are you sure you want to exit completely? You will lose active listening and stop stream consumption.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setShowMiniExitConfirm(false)}
                    className="h-10 rounded-full border border-white/15 text-white/80 hover:text-white hover:bg-white/5 active:scale-95 transition-all font-bold text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setShowMiniExitConfirm(false);
                      await handleLeaveRoom();
                    }}
                    className="h-10 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg active:scale-95 transition-all font-black text-xs uppercase cursor-pointer"
                  >
                    Yes, Exit
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Retrieve current active background presets
  const bgStyle = ROOM_BACKGROUNDS[selectedBg as keyof typeof ROOM_BACKGROUNDS] || ROOM_BACKGROUNDS.purple_luxury;

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100vh', scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: '100vh', scale: 0.95 }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className={`fixed inset-0 ${bgStyle.bg} flex flex-col z-[100] text-white overflow-hidden`}
    >
      {/* Dynamic Luxury Ambient Gradient Atmosphere */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute inset-0 bg-gradient-to-b ${bgStyle.gradient}`} />
        
        {/* Glowing floating decorative ambient orbs */}
        {bgStyle.glows.map((glowClass, i) => (
          <div key={i} className={`absolute rounded-full -z-10 pointer-events-none opacity-40 animate-pulse ${glowClass}`} style={{ animationDuration: `${6 + i * 4}s` }} />
        ))}
      </div>

      {/* Custom Theme Atmosphere Overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Style block for scoped animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes raindrop-fall {
            0% { transform: translateY(-120px) rotate(15deg); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            100% { transform: translateY(105vh) rotate(15deg); opacity: 0; }
          }
          @keyframes glow-lamp {
            0%, 100% { opacity: 0.15; filter: blur(80px); }
            50% { opacity: 0.4; filter: blur(120px); }
          }
          @keyframes neon-grid-scroll {
            0% { background-position: 0 0; }
            100% { background-position: 0 40px; }
          }
          @keyframes laser-sweep-1 {
            0% { transform: rotate(-45deg) translateX(-100%); opacity: 0; }
            10% { opacity: 0.4; }
            50% { opacity: 0.8; }
            90% { opacity: 0.4; }
            100% { transform: rotate(-45deg) translateX(150%); opacity: 0; }
          }
          @keyframes laser-sweep-2 {
            0% { transform: rotate(45deg) translateX(150%); opacity: 0; }
            10% { opacity: 0.4; }
            50% { opacity: 0.8; }
            90% { opacity: 0.4; }
            100% { transform: rotate(45deg) translateX(-100%); opacity: 0; }
          }
          @keyframes aurora-wave {
            0%, 100% { transform: scale(1) translate(0px, 0px) rotate(0deg); filter: blur(100px); }
            33% { transform: scale(1.15) translate(40px, -30px) rotate(6deg); filter: blur(120px); }
            66% { transform: scale(0.9) translate(-25px, 50px) rotate(-10deg); filter: blur(100px); }
          }
          @keyframes ripple-shadow {
            0%, 100% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(1.15); opacity: 0.55; }
          }
          .raindrop-elem {
            position: absolute;
            width: 1px;
            height: 60px;
            background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(147,197,253,0.4));
            animation: raindrop-fall linear infinite;
          }
        `}} />

        {/* 1. RAINY CAFE THEME */}
        {selectedTheme === 'rainy_cafe' && (
          <div className="absolute inset-0 bg-yellow-950/15 mix-blend-color-burn">
            {/* Ambient table lamp warm overlay */}
            <div className="absolute top-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-amber-500/20 blur-[100px] pointer-events-none" style={{ animation: 'glow-lamp 4s ease-in-out infinite' }} />
            <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-yellow-600/10 blur-[130px] pointer-events-none" style={{ animation: 'glow-lamp 5s ease-in-out infinite' }} />
            
            {/* Cozier glass window panel lines */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
            <div className="absolute inset-y-0 left-1/3 w-[1.5px] bg-white/[0.03]" />
            <div className="absolute inset-y-0 right-1/3 w-[1.5px] bg-white/[0.03]" />
            <div className="absolute inset-x-0 top-1/2 h-[1.5px] bg-white/[0.03]" />
            
            {/* Elegant falling raindrop lines */}
            {Array.from({ length: 22 }).map((_, i) => (
              <div 
                key={`rain-${i}`}
                className="raindrop-elem" 
                style={{ 
                  left: `${(i * 4.7) + 2}%`, 
                  top: `-${Math.random() * 80 + 40}px`,
                  animationDuration: `${1.2 + Math.random() * 0.8}s`,
                  animationDelay: `${Math.random() * 2}s`
                }} 
              />
            ))}
          </div>
        )}

        {/* 2. NEON TECHNO THEME */}
        {selectedTheme === 'neon_techno' && (
          <div className="absolute inset-0">
            {/* Retro grid background */}
            <div 
              className="absolute inset-0 opacity-[0.07]" 
              style={{ 
                backgroundImage: 'linear-gradient(to right, #ec4899 1px, transparent 1px), linear-gradient(to bottom, #ec4899 1px, transparent 1px)', 
                backgroundSize: '40px 40px',
                animation: 'neon-grid-scroll 3s linear infinite'
              }} 
            />
            {/* Rotating glowing lasers */}
            <div 
              className="absolute top-0 -left-[20%] w-[80%] h-[3px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px]" 
              style={{ animation: 'laser-sweep-1 4.5s linear infinite' }} 
            />
            <div 
              className="absolute bottom-[40%] -right-[20%] w-[80%] h-[3px] bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent blur-[1px]" 
              style={{ animation: 'laser-sweep-2 5.5s linear infinite', animationDelay: '1s' }} 
            />
            <div 
              className="absolute top-[30%] -left-[20%] w-[80%] h-[3.5px] bg-gradient-to-r from-transparent via-violet-500 to-transparent blur-[1px]" 
              style={{ animation: 'laser-sweep-1 6.5s linear infinite', animationDelay: '2s' }} 
            />

            {/* Neon scanner overlay vibes */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#111827]/10 via-[#030712]/5 to-[#111827]/10" />
          </div>
        )}

        {/* 3. COSMIC AURORA THEME */}
        {selectedTheme === 'cosmic_aurora' && (
          <div className="absolute inset-0">
            {/* Aurora swirling lights */}
            <div 
              className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] bg-gradient-to-br from-emerald-500/10 via-fuchsia-500/10 to-indigo-500/15 pointer-events-none opacity-85 mix-blend-screen"
              style={{ animation: 'aurora-wave 15s ease-in-out infinite' }}
            />
            <div 
              className="absolute -bottom-[20%] -right-[10%] w-[120%] h-[120%] bg-gradient-to-tr from-cyan-500/8 via-violet-600/12 to-purple-500/10 pointer-events-none opacity-85 mix-blend-screen"
              style={{ animation: 'aurora-wave 18s ease-in-out infinite', animationDelay: '3s' }}
            />

            {/* Glowing stars */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={`star-${i}`}
                className="absolute w-1 h-1 bg-white rounded-full animate-ping pointer-events-none opacity-40"
                style={{ 
                  left: `${Math.random() * 95 + 2}%`, 
                  top: `${Math.random() * 85 + 5}%`,
                  animationDuration: `${2.5 + Math.random() * 3}s`
                }}
              />
            ))}
          </div>
        )}

        {/* 4. SUNSET BEACH THEME */}
        {selectedTheme === 'sunset_beach' && (
          <div className="absolute inset-0">
            {/* Sunset colored gradient sky atmosphere on top */}
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/15 via-rose-500/10 to-yellow-500/10 pointer-events-none mix-blend-color-dodge" />
            
            {/* Sun ball glow */}
            <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-orange-600/15 blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />

            {/* Ripple reflections overlay */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            <div 
              className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-4/5 h-[150px] rounded-[100%] bg-yellow-400/5 blur-[50px] pointer-events-none"
              style={{ animation: 'ripple-shadow 6s ease-in-out infinite' }}
            />
          </div>
        )}
      </div>

      {/* Floating Celebrate Gift Overlay */}
      <AnimatePresence>
        {giftOverlay && (
          <motion.div 
            initial={{ y: -100, x: '-50%', opacity: 0 }}
            animate={{ y: 20, x: '-50%', opacity: 1 }}
            exit={{ y: -100, x: '-50%', opacity: 0 }}
            className="fixed top-12 left-1/2 z-[350] bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500 p-[1px] rounded-full shadow-2xl shadow-purple-500/35"
          >
            <div className="bg-[#12141C]/95 rounded-full px-6 py-2.5 flex items-center gap-2.5 border border-white/5">
              <span className="text-2xl animate-bounce">{giftOverlay.icon}</span>
              <p className="text-[11px] font-extrabold text-white whitespace-nowrap">
                <span className="text-yellow-400 font-black">{giftOverlay.senderName}</span> sent <span className="text-pink-400 font-black">{giftOverlay.giftName}</span>! 🎉
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Noble Entrance Toast Overlay */}
      <AnimatePresence>
        {entranceOverlay && (() => {
          const id = entranceOverlay.entranceId;
          
          let glowColor = 'shadow-[0_0_20px_rgba(244,114,182,0.35)]';
          let borderGradient = 'from-pink-500 via-purple-600 to-indigo-505';
          let textAccent = 'text-pink-400';
          let alertLabel = 'MEMBER ARRIVED';

          if (id === 'entrance_warp') {
            glowColor = 'shadow-[0_0_25px_rgba(99,102,241,0.65)]';
            borderGradient = 'from-blue-600 via-indigo-600 to-purple-500';
            textAccent = 'text-indigo-400';
            alertLabel = 'WARP SPEEDS ACTIVE';
          } else if (id === 'entrance_phoenix') {
            glowColor = 'shadow-[0_0_25px_rgba(249,115,22,0.65)]';
            borderGradient = 'from-red-500 via-orange-500 to-yellow-500';
            textAccent = 'text-orange-400';
            alertLabel = 'PHOENIX FLAME';
          } else if (id === 'entrance_thunder') {
            glowColor = 'shadow-[0_0_25px_rgba(6,182,212,0.7)]';
            borderGradient = 'from-blue-500 via-cyan-500 to-teal-400';
            textAccent = 'text-cyan-400';
            alertLabel = 'SKYSTRIKE LIGHTNING';
          }

          // Choose Framer Motion animation configuration dynamically matching energy of the entrance
          let animProps: any = {
            initial: { x: "-120%", opacity: 0 },
            animate: { x: 0, opacity: 1, transition: { type: 'spring', damping: 18, stiffness: 120 } },
            exit: { x: "120%", opacity: 0, transition: { duration: 0.25 } }
          };

          if (id === 'entrance_warp') {
            animProps = {
              initial: { scale: 0.1, y: -200, rotate: -180, opacity: 0 },
              animate: { scale: 1, y: 0, rotate: 0, opacity: 1, transition: { type: 'spring', damping: 14, stiffness: 100 } },
              exit: { scale: 0.5, y: -100, rotate: 90, opacity: 0, transition: { duration: 0.25 } }
            };
          } else if (id === 'entrance_phoenix') {
            animProps = {
              initial: { scale: 1.6, y: -250, opacity: 0, filter: 'brightness(3)' },
              animate: { scale: [1.6, 0.9, 1], y: 0, opacity: 1, filter: 'brightness(1)', transition: { duration: 0.6, ease: 'easeOut' } },
              exit: { scale: 0.8, y: -120, opacity: 0, transition: { duration: 0.25 } }
            };
          } else if (id === 'entrance_thunder') {
            animProps = {
              initial: { y: -700, scaleY: 2.2, opacity: 0 },
              animate: { y: [0, -10, 0], scaleY: 1, opacity: 1, transition: { type: 'spring', damping: 8, stiffness: 180 } },
              exit: { scaleY: 0.1, opacity: 0, transition: { duration: 0.2 } }
            };
          }

          return (
            <div className="fixed top-24 left-0 right-0 z-[360] flex justify-center pointer-events-none px-4 select-none">
              <motion.div 
                {...animProps}
                className={`pointer-events-auto bg-gradient-to-r ${borderGradient} p-[1.5px] rounded-[24px] shadow-2xl ${glowColor} max-w-sm w-full md:max-w-md`}
              >
                <div className="bg-[#10121C]/96 rounded-[24px] px-4 py-3 flex items-center gap-3.5 border border-white/5 relative overflow-hidden">
                  
                  {/* Subtle pulsing ambient background light */}
                  <div className={`absolute -right-10 -bottom-10 w-24 h-24 rounded-full bg-gradient-to-tr ${borderGradient} opacity-20 blur-xl animate-pulse`} />

                  {/* Avatar wrapper with colored portal ring */}
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-full p-[1.5px] bg-gradient-to-tr ${borderGradient}`}>
                      <Avatar className="w-full h-full border border-black/80 bg-zinc-900">
                        <AvatarImage src={entranceOverlay.avatar || getPremiumAvatar(entranceOverlay.userName)} className="object-cover" />
                        <AvatarFallback className="bg-zinc-800 text-white font-extrabold text-xs">{entranceOverlay.userName?.[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="absolute -bottom-1 -right-1 text-xs">{entranceOverlay.icon}</span>
                  </div>

                  {/* Text Details & Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[8px] font-black tracking-widest uppercase bg-white/5 px-2 py-0.5 rounded border border-white/10 ${textAccent}`}>
                        {alertLabel}
                      </span>
                      {id && (
                        <span className="text-[7px] text-gray-400 font-extrabold uppercase bg-white/5 px-1 rounded">
                          Noble Slot
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-black text-white mt-1 select-text truncate">
                      {entranceOverlay.userName} <span className="text-gray-400 font-normal">joined</span>
                    </h4>
                    <p className="text-[9px] text-[#26D97E] font-extrabold flex items-center gap-1 mt-0.5 select-text">
                      <span>Equipped:</span> 
                      <span className="underline decoration-dotted">{entranceOverlay.entranceName}</span>
                    </p>
                  </div>

                  {/* Glowing Icon indicator */}
                  <div className="shrink-0 flex items-center justify-center w-10 h-10 bg-white/5 border border-white/5 rounded-2xl animate-pulse">
                    <span className="text-xl">{entranceOverlay.icon}</span>
                  </div>

                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Top Header Section (Redesigned as a Premium Glassmorphism Card) */}
      <div className="px-5 pt-6 pb-2 relative z-50 select-none shrink-0 w-full">
        <header className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[30px] px-5 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            {/* Back / Minimize Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitModal(true)}
              className="h-10 w-10 text-gray-300 hover:text-white rounded-full bg-white/5 border border-white/10 hover:bg-white/10 shrink-0 shadow-md active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
              title="Minimize & Go Back"
            >
              <ChevronLeft size={20} className="stroke-[2.5]" />
            </Button>

            <div 
              onClick={() => {
                setTempDp(room.thumbnailUrl || getPremiumRoomCover(room.id));
                setEditRoomTitle(room.title);
                setEditRoomDesc(room.description || '');
                setShowProfileMenu(true);
              }}
              className="flex items-center gap-3.5 cursor-pointer hover:opacity-95 transition-opacity min-w-0 flex-1"
            >
            {/* Room DP */}
            <div className="relative shrink-0">
              <Avatar 
                className="w-12 h-12 border border-yellow-400/50 p-0.5 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-2xl cursor-pointer shadow-lg hover:rotate-3 transition-transform"
                onClick={() => setActivePreviewUid(room.hostId)}
              >
                <AvatarImage src={room.thumbnailUrl || getPremiumRoomCover(room.id)} className="rounded-2xl object-cover" />
                <AvatarFallback className="rounded-2xl">R</AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>

            {/* Room Details */}
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-white text-base sm:text-lg leading-tight tracking-tight truncate max-w-[180px] sm:max-w-[220px]">
                {room.title}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-[10px] font-mono font-bold text-gray-400 flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg">
                  <span>ID:</span>
                  <span className="text-white select-text">{room.id?.slice(0, 8).toUpperCase() || '...'}</span>
                  <Copy 
                    size={10} 
                    className="text-gray-400 hover:text-white ml-0.5" 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(room.id || '');
                      toast.success("Room ID copied to clipboard!");
                    }} 
                  />
                </p>

                {/* Online Users Count */}
                <span className="bg-pink-500/10 border border-pink-500/20 text-pink-400 font-extrabold text-[9px] px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                  <Users size={10} />
                  <span>{members.length} Online</span>
                </span>
                
                {/* Timer Clock */}
                <span className="bg-black/30 text-yellow-400 font-mono text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-yellow-500/10">
                  <Clock size={10} className="animate-spin [animation-duration:12s]" />
                  <span>{roomTimer}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

          {/* Action Row: Settings Button, Share Button, Power Button */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {/* Share Button */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => { shareRoom(); }}
              className="h-10 w-10 border-white/10 bg-white/5 text-white/90 hover:bg-white/15 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer"
              title="Share Room URL"
            >
              <Share2 size={16} />
            </Button>

            {/* Daily Mission Streak Flame Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowStreakModal(true)} 
              className="h-10 px-3 border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-full flex items-center gap-1.5 transition-all cursor-pointer font-black text-xs uppercase shadow-[0_0_15px_rgba(249,115,22,0.15)]"
              title="Daily Missions & Consecutive Login Streaks"
            >
              <Flame size={15} className="animate-pulse text-orange-500 stroke-[2.5]" />
              <span className="leading-none">{userProfile?.dailyLoginStreak || 1}D STREAK</span>
            </Button>

            {/* Room Settings Customizer Button */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => {
                setTempDp(room.thumbnailUrl || getPremiumRoomCover(room.id));
                setEditRoomTitle(room.title);
                setEditRoomDesc(room.description || '');
                setShowProfileMenu(true);
              }}
              className="h-10 w-10 border-white/10 bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20 rounded-full flex items-center justify-center transition-all cursor-pointer"
              title="Room Settings & Customizer Panel"
            >
              <Settings size={16} />
            </Button>

            {/* Stats Dashboard */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowStatsModal(true)} 
              className="h-10 w-10 border-white/10 bg-white/5 text-gray-300 hover:text-white rounded-full flex items-center justify-center transition-all cursor-pointer"
              title="Room Analytics"
            >
              <Info size={16} />
            </Button>

            {/* Power Exit Button */}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowExitModal(true)} 
              className="h-10 w-10 border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-full flex items-center justify-center transition-all cursor-pointer"
              title="Leave Room"
            >
              <Power size={16} />
            </Button>
          </div>
        </header>
      </div>

      {/* Live Symphony Broadcast stream indicator */}
      {room.musicPlaying && (
        <div className="mx-5 mb-3.5 relative z-10 shrink-0 select-none animate-fade-in">
          <div className="bg-gradient-to-r from-pink-900/40 via-purple-950/30 to-black/35 border border-pink-500/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-md shadow-pink-500/5 backdrop-blur-md">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="bg-pink-500/15 border border-pink-500/30 p-2.5 rounded-xl text-pink-400 shrink-0 animate-spin [animation-duration:8s]">
                <Volume2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[7.5px] font-black tracking-widest uppercase bg-pink-500 text-white px-2 py-0.5 rounded leading-none block">
                    LIVE STREAM BROADCAST
                  </span>
                  <span className="text-[7.5px] font-extrabold text-pink-300 uppercase bg-pink-950/40 border border-pink-500/10 px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                    <Users size={8} /> {members.length} listening
                  </span>
                </div>
                <h4 className="text-[11px] font-extrabold text-white mt-1.5 select-text truncate flex items-center gap-1">
                  <span>Playing:</span>
                  <span className="text-pink-300 underline underline-offset-2">{room.musicTrackName || 'Live Symphony Backing Track'}</span>
                </h4>
              </div>
            </div>

            {/* Tap here to unmute and play/sync button */}
            <button
              onClick={() => {
                const audio = audioPlayerRef.current;
                if (audio) {
                  audio.volume = musicVolume;
                  audio.play().then(() => {
                    toast.success("Soundtrack stream synchronized with local device! 🎧📡");
                  }).catch(() => {
                    toast.error("Browser speech block. Please click unblock.");
                  });
                }
              }}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold text-[8px] uppercase tracking-widest px-3.5 py-2.5 rounded-full border border-white/10 active:scale-95 transition-all shadow-glow flex items-center gap-1 cursor-pointer shrink-0"
            >
              Unmute & Sync 🎧
            </button>
          </div>
        </div>
      )}

      {/* Pinned Announcement Banner */}
      <div className="mx-5 mb-3.5 relative z-10 shrink-0">
        <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-black/30 border border-white/5 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="bg-yellow-400/10 border border-yellow-400/20 p-2 rounded-xl text-yellow-400 shrink-0">
              <Star size={12} className="fill-yellow-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-widest text-[#FFD700] font-black">Room Pin Announcement</p>
              <p className="text-xs font-bold text-white/80 truncate leading-tight">
                {room.pinnedMsg || `Welcome to Maxo! Sit down, speak, send gifts and earn diamond rewards! 👑✨`}
              </p>
            </div>
          </div>
          {canManage && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setPinInput(room.pinnedMsg || '');
                setShowPinEditModal(true);
              }}
              className="h-8 w-8 text-white/40 hover:text-white rounded-full hover:bg-white/5 shrink-0"
            >
              <Pencil size={12} />
            </Button>
          )}
        </div>
      </div>

      {/* Utility/Supporter High-Fidelity Ribbons */}
      <div className="px-5 flex gap-2.5 relative z-10 mb-4 overflow-x-auto no-scrollbar shrink-0">
         {/* Live Hand Raise Queue for Admins / Audience Queue Status */}
         {canManage ? (
           <Button 
             variant="outline"
             onClick={() => setShowHandRaisePanel(true)}
             className={`h-7 rounded-full border-teal-500/35 text-[9px] font-black tracking-tight uppercase shrink-0 flex items-center gap-1.5 px-3.5 ${
               handRaises.length > 0
                 ? 'bg-teal-500/15 text-teal-400 hover:bg-teal-500/20 shadow-[0_0_10px_rgba(20,184,166,0.25)] animate-pulse'
                 : 'bg-[#12141C]/60 text-white/60 hover:bg-[#12141C]'
             }`}
           >
             <Hand size={10} className={handRaises.length > 0 ? 'animate-bounce' : ''} />
             {handRaises.length > 0 ? `${handRaises.length} Raised Hands` : 'Queue Empty'}
           </Button>
         ) : (
           <Button 
             variant="outline"
             onClick={raiseHand}
             className="h-7 rounded-full bg-indigo-500/10 border-indigo-500/25 text-[9px] font-black tracking-tight uppercase shrink-0 text-indigo-300 hover:bg-indigo-500/20 px-3.5 flex items-center gap-1.5"
           >
             <Hand size={10} />
             Raise Hand ✋
           </Button>
         )}

      </div>

      {/* Floating Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ y: '80vh', x: `${40 + Math.random() * 20}vw`, opacity: 0, scale: 0.5 }}
              animate={{ y: '20vh', opacity: [0, 1, 1, 0], scale: [0.5, 1.5, 1.5, 2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: 'easeOut' }}
              className="absolute text-4xl"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 px-5 overflow-y-auto no-scrollbar relative z-10">

        {/* Seats Tiered Layout with Dynamic Backdrop Blur scaling with average audio amplitude */}
        <ErrorBoundary>
        <motion.div 
          className="py-6 flex flex-col items-center w-full max-w-2xl mx-auto my-4 relative transition-all duration-300"
        >
          
          {/* Symmetrical Throne Row: Redesigned Premium Luxury Nodes (Owner and Super Admin Areas) */}
          <div className="flex flex-col sm:flex-row gap-10 sm:gap-14 justify-center items-center mb-10 w-full px-5 border-b border-white/5 pb-10 select-none">
            
            {/* 1. Sovereign Owner Area - Top Custom Center Node */}
            {(() => {
              const seat0 = room.seats[0];
              const seat0Uid = seat0?.uid;
              const isSeat0Occupied = !!seat0Uid;
              const isSeat0Speaking = isSeat0Occupied ? isUserSpeaking(seat0Uid) && !seat0.isMuted : false;
              const isSeat0MusicActive = isSeat0Occupied && room?.musicPlaying && room?.musicSenderId === seat0Uid;
              const isSeat0VisualizerActive = isSeat0Speaking || isSeat0MusicActive;
              const seat0Volume = isSeat0Speaking 
                ? (speakerVolumes[seat0Uid] || 0.15) 
                : (isSeat0MusicActive ? 0.35 + Math.sin(Date.now() / 120) * 0.15 : 0.05);

              const seat0Member = isSeat0Occupied ? members.find(m => m.uid === seat0Uid) : null;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    backgroundColor: isSeat0Speaking ? [
                      "rgba(250, 204, 21, 0.03)", 
                      "rgba(250, 204, 21, 0.15)", 
                      "rgba(250, 204, 21, 0.03)"
                    ] : "rgba(250, 204, 21, 0)"
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 25px rgba(234, 179, 8, 0.45)",
                    borderColor: "rgba(234, 179, 8, 0.55)"
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 350, 
                    damping: 25,
                    backgroundColor: isSeat0Speaking ? {
                      repeat: Infinity,
                      duration: 1.8,
                      ease: "easeInOut"
                    } : undefined
                  }}
                  className={`seat-slot relative flex flex-col items-center transition-all duration-300 border border-transparent p-2 rounded-2xl ${isSeat0Speaking ? 'ring-2 ring-yellow-400/80 shadow-[0_0_20px_rgba(234,179,8,0.4)]' : ''}`}
                  onContextMenu={(e) => handleSeatContextMenu(e, 0)}
                  onTouchStart={(e) => handleSeatTouchStart(e, 0)}
                  onTouchEnd={handleSeatTouchEnd}
                  onTouchCancel={handleSeatTouchEnd}
                  onTouchMove={handleSeatTouchEnd}
                >
                  {/* Premium Crown Badge above Owner */}
                  <div className="absolute -top-7 z-30 drop-shadow-lg scale-105">
                    <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-300 text-black text-[9px] font-black px-3.5 py-1 rounded-full border border-yellow-300 shadow-[0_4px_15px_rgba(234,179,8,0.45)] flex items-center gap-1.5 leading-none">
                      <Crown size={12} className="fill-black animate-pulse" />
                      <span className="tracking-widest uppercase">{isSeat0MusicActive ? "🎵 ON WAVE" : "OWNER"}</span>
                    </div>
                  </div>

                  <SeatReactionOverlay reactions={floatingReactions[0] || []} />

                  <motion.div 
                    className="relative cursor-pointer group mt-2"
                    onClick={() => handleSeatClick(0)}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    {isSeat0Occupied ? (
                      <motion.div 
                        animate={{
                          scale: isSeat0VisualizerActive ? 1.05 : 1,
                          boxShadow: isSeat0VisualizerActive 
                            ? "0 0 35px rgba(234, 179, 8, 0.75)" 
                            : "0 0 20px rgba(234, 179, 8, 0.35)"
                        }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full p-[3px] bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-300 relative border border-yellow-400/40 shadow-[0_0_20px_rgba(234,179,8,0.5)]`}
                      >
                        {/* Dynamic Vocal Bubble Ripple Effect (Gold Theme) */}
                        {isSeat0VisualizerActive && (
                          <div className="absolute inset-0 -z-10 pointer-events-none">
                            {/* Outer Vocal Bubble Ripple 1 */}
                            <motion.div
                              animate={{ 
                                scale: [1, 1.25 + seat0Volume * 1.5, 1],
                                opacity: [0.65, 0, 0.65],
                                rotate: [0, 180, 360]
                              }}
                              transition={{ 
                                duration: 1.8, 
                                ease: "easeInOut", 
                                repeat: Infinity 
                              }}
                              className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500/30 via-amber-400/10 to-transparent border border-yellow-400/40"
                            />
                            {/* Inner Vocal Bubble Ripple 2 (Reacting aggressively to volume) */}
                            <motion.div
                              animate={{ 
                                scale: 1 + seat0Volume * 1.8,
                                opacity: [0.8, 0.3, 0.8]
                              }}
                              transition={{ 
                                type: "spring",
                                stiffness: 280,
                                damping: 14
                              }}
                              className="absolute -inset-2.5 rounded-full bg-yellow-500/15 border-2 border-yellow-400/30 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                            />
                            {/* Expanding Orbit Bubbles */}
                            {[1, 2, 3].map((idx) => (
                              <motion.div
                                key={`seat0-orb-${idx}`}
                                animate={{
                                  x: [0, (idx % 2 === 0 ? 1 : -1) * (18 + seat0Volume * 35)],
                                  y: [0, -1 * (25 + seat0Volume * 45)],
                                  scale: [0.5, 1 + seat0Volume, 0],
                                  opacity: [0.8, 0.4, 0]
                                }}
                                transition={{
                                  duration: 1.4 + idx * 0.4,
                                  repeat: Infinity,
                                  ease: "easeOut",
                                  delay: idx * 0.25
                                }}
                                className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-300 shadow-[0_0_8px_rgba(234,179,8,0.7)]"
                                style={{ top: '25%', left: '42%' }}
                              />
                            ))}
                          </div>
                        )}

                        <SeatCanvasVisualizer 
                          uid={seat0Uid} 
                          isSpeaking={isSeat0Speaking} 
                          isMusicActive={isSeat0MusicActive} 
                          size="large" 
                        />
                        {isSeat0VisualizerActive && (
                          <SeatAudioAmplitudeVisualizer 
                            volume={seat0Volume} 
                            isActive={isSeat0VisualizerActive} 
                          />
                        )}
                        <Avatar className="w-full h-full border-4 border-[#0A051D] bg-[#0E0B1F] relative z-10 shadow-inner">
                          <AvatarImage src={seat0Member?.photoURL || getPremiumAvatar(seat0Uid)} className="rounded-full object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-amber-600 font-extrabold text-black">HOST</AvatarFallback>
                        </Avatar>

                        {/* Status Indicator Badge to distinguish roles */}
                        {isSeat0Occupied && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider uppercase z-30 shadow-md border bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-yellow-300 shadow-[0_2px_8px_rgba(245,158,11,0.4)] whitespace-nowrap leading-none">
                            Host
                          </div>
                        )}

                        {/* Video Camera Scanline Overlay verbatim for video lounges */}
                        {room?.roomType === 'video' && (
                          <div className="absolute inset-0 bg-[#3B82F6]/15 hover:bg-[#3B82F6]/5 ring-2 ring-indigo-400/85 animate-pulse pointer-events-none rounded-full z-20 flex flex-col items-center justify-center overflow-hidden">
                            <span className="text-[6.5px] bg-[#1E1B4B] border border-indigo-500/30 px-1 py-0.5 rounded text-white font-black uppercase tracking-widest absolute bottom-2.5 z-20 shadow-[0_0_8px_rgba(99,102,241,0.5)]">🔴 WEBCAM HD</span>
                          </div>
                        )}

                        {/* Speaking visualizer badge */}
                        {isSeat0VisualizerActive && (
                          <div className="absolute bottom-1 right-1 bg-yellow-400 border border-[#0A051D] p-1.5 rounded-full z-20 shadow-[0_0_12px_rgba(234,179,8,0.8)] flex items-center justify-center">
                            {isSeat0Speaking ? (
                              <Volume2 size={13} className="text-black stroke-[3.5]" />
                            ) : (
                              <Music size={13} className="text-black stroke-[3.5]" />
                            )}
                          </div>
                        )}

                        {isSeat0Occupied && (
                          <button
                            type="button"
                            disabled={!(canManage || seat0Uid === currentUser?.uid)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManage || seat0Uid === currentUser?.uid) {
                                muteSeat(0);
                              }
                            }}
                            className={`absolute bottom-1.5 -left-1.5 rounded-full p-1.5 border border-white/20 shadow-xl z-30 flex items-center justify-center transition-all ${
                              canManage || seat0Uid === currentUser?.uid ? 'cursor-pointer hover:scale-115 active:scale-90' : 'cursor-not-allowed opacity-80'
                            } ${
                              seat0?.isMuted 
                                ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                                : 'bg-emerald-500 text-black border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                            }`}
                            style={{ width: '24px', height: '24px' }}
                            title={
                              !(canManage || seat0Uid === currentUser?.uid) 
                                ? (seat0?.isMuted ? 'Muted' : 'Speaking Active') 
                                : (seat0?.isMuted ? 'Unmute microphone' : 'Mute microphone')
                            }
                          >
                            <Mic size={12} className={seat0?.isMuted ? 'text-white' : 'text-black stroke-[3]'} />
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <div className="w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full border-2 border-dashed border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500/80 transition-all duration-300 flex flex-col items-center justify-center shadow-[0_0_22px_rgba(234,179,8,0.3),inset_0_0_15px_rgba(234,179,8,0.25)] relative">
                        <Crown size={24} className="text-yellow-500/30 group-hover:scale-110 group-hover:text-yellow-500/60 transition-all animate-pulse" />
                      </div>
                    )}
                  </motion.div>

                  <div className="mt-3 flex flex-col items-center max-w-full select-none">
                    <span className="text-xs font-black text-yellow-400 truncate max-w-[90px] text-center tracking-tight transition-colors flex items-center gap-1 justify-center">
                      {isSeat0MusicActive && <Music size={10} className="text-green-400 animate-bounce shrink-0" />}
                      <span>{isSeat0Occupied ? (seat0Member?.displayName || 'Owner') : 'Open Throne'}</span>
                    </span>
                    <span className="text-[9px] font-bold text-yellow-500/80 tracking-wide mt-0.5 uppercase">
                      Seat 0 (Host)
                    </span>
                  </div>
                </motion.div>
              );
            })()}

            {/* 2. Symmetrical Super Admin Area - Next to Owner Node */}
            {(() => {
              const seat1 = room.seats?.[1];
              const seat1Uid = seat1?.uid;
              const isSeat1Occupied = !!seat1Uid;
              const isSeat1Speaking = isSeat1Occupied ? isUserSpeaking(seat1Uid) && !seat1.isMuted : false;
              const isSeat1MusicActive = isSeat1Occupied && room?.musicPlaying && room?.musicSenderId === seat1Uid;
              const isSeat1VisualizerActive = isSeat1Speaking || isSeat1MusicActive;
              const seat1Volume = isSeat1Speaking 
                ? (speakerVolumes[seat1Uid] || 0.15) 
                : (isSeat1MusicActive ? 0.35 + Math.sin(Date.now() / 120) * 0.15 : 0.05);

              const seat1Member = isSeat1Occupied ? members.find(m => m.uid === seat1Uid) : null;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    backgroundColor: isSeat1Speaking ? [
                      "rgba(168, 85, 247, 0.03)", 
                      "rgba(168, 85, 247, 0.15)", 
                      "rgba(168, 85, 247, 0.03)"
                    ] : "rgba(168, 85, 247, 0)"
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 25px rgba(168, 85, 247, 0.45)",
                    borderColor: "rgba(168, 85, 247, 0.55)"
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 350, 
                    damping: 25,
                    backgroundColor: isSeat1Speaking ? {
                      repeat: Infinity,
                      duration: 1.8,
                      ease: "easeInOut"
                    } : undefined
                  }}
                  className={`seat-slot relative flex flex-col items-center transition-all duration-300 border border-transparent p-2 rounded-2xl ${isSeat1Speaking ? 'ring-2 ring-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : ''}`}
                  onContextMenu={(e) => handleSeatContextMenu(e, 1)}
                  onTouchStart={(e) => handleSeatTouchStart(e, 1)}
                  onTouchEnd={handleSeatTouchEnd}
                  onTouchCancel={handleSeatTouchEnd}
                  onTouchMove={handleSeatTouchEnd}
                >
                  {/* Premium Super Admin Authority Badge */}
                  <div className="absolute -top-7 z-30 drop-shadow-lg scale-105">
                    <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white text-[9px] font-black px-3.5 py-1 rounded-full border border-purple-400 shadow-[0_4px_15px_rgba(168,85,247,0.45)] flex items-center gap-1.5 leading-none">
                      <Shield size={12} className="fill-white text-purple-200 animate-pulse" />
                      <span className="tracking-widest uppercase text-purple-200">SUPER ADMIN</span>
                    </div>
                  </div>

                  <SeatReactionOverlay reactions={floatingReactions[1] || []} />

                  <motion.div 
                    className="relative cursor-pointer group mt-2"
                    onClick={() => handleSeatClick(1)}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.5 }}
                  >
                    {isSeat1Occupied ? (
                      <motion.div 
                        animate={{
                          scale: isSeat1VisualizerActive ? 1.05 : 1,
                          boxShadow: isSeat1VisualizerActive 
                            ? "0 0 35px rgba(168, 85, 247, 0.75)" 
                            : "0 0 20px rgba(168, 85, 247, 0.35)"
                        }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full p-[3px] bg-gradient-to-tr from-fuchsia-600 via-purple-500 to-indigo-500 relative border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.5)]`}
                      >
                        {/* Dynamic Vocal Bubble Ripple Effect (Purple Theme) */}
                        {isSeat1VisualizerActive && (
                          <div className="absolute inset-0 -z-10 pointer-events-none">
                            {/* Outer Vocal Bubble Ripple 1 */}
                            <motion.div
                              animate={{ 
                                scale: [1, 1.25 + seat1Volume * 1.5, 1],
                                opacity: [0.65, 0, 0.65],
                                rotate: [0, 180, 360]
                              }}
                              transition={{ 
                                duration: 1.8, 
                                ease: "easeInOut", 
                                repeat: Infinity 
                              }}
                              className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500/30 via-fuchsia-400/10 to-transparent border border-purple-400/40"
                            />
                            {/* Inner Vocal Bubble Ripple 2 (Reacting aggressively to volume) */}
                            <motion.div
                              animate={{ 
                                scale: 1 + seat1Volume * 1.8,
                                opacity: [0.8, 0.3, 0.8]
                              }}
                              transition={{ 
                                type: "spring",
                                stiffness: 280,
                                damping: 14
                              }}
                              className="absolute -inset-2.5 rounded-full bg-purple-500/15 border-2 border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                            />
                            {/* Expanding Orbit Bubbles */}
                            {[1, 2, 3].map((idx) => (
                              <motion.div
                                key={`seat1-orb-${idx}`}
                                animate={{
                                  x: [0, (idx % 2 === 0 ? 1 : -1) * (18 + seat1Volume * 35)],
                                  y: [0, -1 * (25 + seat1Volume * 45)],
                                  scale: [0.5, 1 + seat1Volume, 0],
                                  opacity: [0.8, 0.4, 0]
                                }}
                                transition={{
                                  duration: 1.4 + idx * 0.4,
                                  repeat: Infinity,
                                  ease: "easeOut",
                                  delay: idx * 0.25
                                }}
                                className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-300 shadow-[0_0_8px_rgba(168,85,247,0.7)]"
                                style={{ top: '25%', left: '42%' }}
                              />
                            ))}
                          </div>
                        )}

                        <SeatCanvasVisualizer 
                          uid={seat1Uid} 
                          isSpeaking={isSeat1Speaking} 
                          isMusicActive={isSeat1MusicActive} 
                          size="large" 
                        />
                        {isSeat1VisualizerActive && (
                          <SeatAudioAmplitudeVisualizer 
                            volume={seat1Volume} 
                            isActive={isSeat1VisualizerActive} 
                          />
                        )}
                        <Avatar className="w-full h-full border-4 border-[#0A051D] bg-[#0E0B1F] relative z-10 shadow-inner">
                          <AvatarImage src={seat1Member?.photoURL || getPremiumAvatar(seat1Uid)} className="rounded-full object-cover" />
                          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-600 font-extrabold text-white">CO</AvatarFallback>
                        </Avatar>

                        {/* Status Indicator Badge to distinguish roles */}
                        {isSeat1Occupied && (
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-wider uppercase z-30 shadow-md border bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white border-purple-400 shadow-[0_2px_8px_rgba(147,51,234,0.4)] whitespace-nowrap leading-none">
                            Super Admin
                          </div>
                        )}

                        {/* Video Camera Scanline Overlay verbatim for video lounges */}
                        {room?.roomType === 'video' && (
                          <div className="absolute inset-0 bg-[#3B82F6]/15 hover:bg-[#3B82F6]/5 ring-2 ring-fuchsia-400 animate-pulse pointer-events-none rounded-full z-20 flex flex-col items-center justify-center overflow-hidden">
                            <span className="text-[6.5px] bg-[#1E1B4B] border border-fuchsia-500/30 px-1 py-0.5 rounded text-white font-black uppercase tracking-widest absolute bottom-2.5 z-20 shadow-[0_0_8px_rgba(217,70,239,0.5)]">🔴 WEBCAM HD</span>
                          </div>
                        )}

                        {/* Speaking badge overlay */}
                        {isSeat1VisualizerActive && (
                          <div className="absolute bottom-1 right-1 bg-purple-500 border border-[#0A051D] p-1.5 rounded-full z-20 shadow-[0_0_12px_rgba(168,85,247,0.8)] flex items-center justify-center">
                            {isSeat1Speaking ? (
                              <Volume2 size={13} className="text-white stroke-[3.5]" />
                            ) : (
                              <Music size={13} className="text-white stroke-[3.5]" />
                            )}
                          </div>
                        )}

                        {isSeat1Occupied && (
                          <button
                            type="button"
                            disabled={!(canManage || seat1Uid === currentUser?.uid)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManage || seat1Uid === currentUser?.uid) {
                                muteSeat(1);
                              }
                            }}
                            className={`absolute bottom-1.5 -left-1.5 rounded-full p-1.5 border border-white/20 shadow-xl z-30 flex items-center justify-center transition-all ${
                              canManage || seat1Uid === currentUser?.uid ? 'cursor-pointer hover:scale-115 active:scale-90' : 'cursor-not-allowed opacity-80'
                            } ${
                              seat1?.isMuted 
                                ? 'bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                                : 'bg-emerald-500 text-black border-emerald-400/40 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                            }`}
                            style={{ width: '24px', height: '24px' }}
                            title={
                              !(canManage || seat1Uid === currentUser?.uid) 
                                ? (seat1?.isMuted ? 'Muted' : 'Speaking Active') 
                                : (seat1?.isMuted ? 'Unmute microphone' : 'Mute microphone')
                            }
                          >
                            <Mic size={12} className={seat1?.isMuted ? 'text-white' : 'text-black stroke-[3]'} />
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <div className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] rounded-full border-2 ${seat1?.isLocked ? 'border-red-500/50 bg-red-950/20' : 'border-dashed border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/80'} transition-all duration-300 flex flex-col items-center justify-center shadow-[0_0_22px_rgba(168,85,247,0.3),inset_0_0_15px_rgba(168,85,247,0.25)] relative`}>
                        {seat1?.isLocked ? (
                          <ShieldAlert size={24} className="text-red-500 animate-pulse" />
                        ) : (
                          <Shield size={24} className="text-purple-500/30 group-hover:scale-110 group-hover:text-purple-500/60 transition-all animate-pulse" />
                        )}
                      </div>
                    )}
                  </motion.div>

                  <div className="mt-3 flex flex-col items-center max-w-full select-none">
                    <span className="text-xs font-black text-purple-400 truncate max-w-[90px] text-center tracking-tight transition-colors flex items-center gap-1 justify-center">
                      {isSeat1MusicActive && <Music size={10} className="text-green-400 animate-bounce shrink-0" />}
                      <span>{isSeat1Occupied ? (seat1Member?.displayName || 'Admin') : seat1?.isLocked ? 'Locked' : 'Available'}</span>
                    </span>
                    <span className="text-[9px] font-bold text-purple-500/80 tracking-wide mt-0.5 uppercase">
                      Seat 1 (Co-Host)
                    </span>
                  </div>
                </motion.div>
              );
            })()}
          </div>
 
          {/* Symmetrical Grid Seats - Balanced 4x2 Layout (Highly Centered, Beautiful Negative Spacing) */}
          <div className="w-full max-w-xl grid grid-cols-4 gap-y-12 sm:gap-y-14 gap-x-3 sm:gap-x-6 justify-center items-center mx-auto">
            {(isSpinGameActive ? room.seats?.slice(2, 4) : room.seats?.slice(2)).map((seat) => {
              const isOccupied = !!seat.uid;
              const isSpeaking = isOccupied ? isUserSpeaking(seat.uid!) && !seat.isMuted : false;
              const isMusicActive = isOccupied && room?.musicPlaying && room?.musicSenderId === seat.uid;
              const isVisualizerActive = isSpeaking || isMusicActive;
              const seatVolume = isSpeaking 
                ? (speakerVolumes[seat.uid!] || 0.15) 
                : (isMusicActive ? 0.35 + Math.sin(Date.now() / 120) * 0.15 : 0.05);

              const memberData = isOccupied ? members.find(m => m.uid === seat.uid) : null;
              const isCoHost = memberData?.role === UserRole.CO_HOST;

              return (
                <motion.div 
                  layout
                  key={`seat-${seat.index}`} 
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 0 20px rgba(168, 85, 247, 0.3)",
                    borderColor: "rgba(168, 85, 247, 0.4)"
                  }}
                  animate={{ 
                    backgroundColor: isSpeaking ? [
                      "rgba(16, 185, 129, 0.03)", 
                      "rgba(16, 185, 129, 0.15)", 
                      "rgba(16, 185, 129, 0.03)"
                    ] : "rgba(16, 185, 129, 0)"
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 350, 
                    damping: 25,
                    backgroundColor: isSpeaking ? {
                      repeat: Infinity,
                      duration: 1.8,
                      ease: "easeInOut"
                    } : undefined
                  }}
                  className={`seat-slot flex flex-col items-center relative group select-none cursor-pointer transition-all duration-300 border border-transparent p-1.5 rounded-2xl ${isSpeaking ? 'ring-2 ring-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]' : ''}`}
                  onClick={() => handleSeatClick(seat.index)}
                  onContextMenu={(e) => handleSeatContextMenu(e, seat.index)}
                  onTouchStart={(e) => handleSeatTouchStart(e, seat.index)}
                  onTouchEnd={handleSeatTouchEnd}
                  onTouchCancel={handleSeatTouchEnd}
                  onTouchMove={handleSeatTouchEnd}
                >
                  {/* Seniority Role Badge above Seat Slot */}
                  <div className="absolute -top-3.5 z-30 drop-shadow-md scale-90 transition-all select-none">
                    <div className={`text-[7.5px] font-[900] px-2 py-0.5 rounded-full border leading-none shadow-[0_2px_8px_rgba(0,0,0,0.35)] tracking-widest uppercase ${
                      seat.uid === room.hostId
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300 shadow-[0_1px_5px_rgba(234,179,8,0.3)]'
                        : room.superAdminIds?.includes(seat.uid!) || isCoHost
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow-[0_1px_5px_rgba(168,85,247,0.3)]'
                        : isOccupied
                        ? 'bg-[#121624]/90 text-gray-300 border-gray-600/50'
                        : 'bg-black/40 text-gray-500 border-dashed border-gray-700/60'
                    }`}>
                      {seat.uid === room.hostId
                        ? 'OWNER'
                        : room.superAdminIds?.includes(seat.uid!) || isCoHost
                        ? 'CO-HOST'
                        : isOccupied
                        ? 'SPEAKER'
                        : seat.isLocked
                        ? 'LOCKED'
                        : 'GUEST'}
                    </div>
                  </div>

                  {/* Tooltip on Hover for Seat Status */}
                  <div className="absolute bottom-full mb-2 scale-90 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 bg-[#0C101A]/95 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.5)] border border-white/10 whitespace-nowrap z-50 flex flex-col items-center mb-3">
                    <span className={isOccupied ? 'text-white' : seat.isLocked ? 'text-rose-400 font-extrabold' : 'text-emerald-400 font-extrabold'}>
                      {isOccupied ? (memberData?.displayName || 'Occupied') : seat.isLocked ? '🔒 Locked' : '✨ Vacant'}
                    </span>
                    <div className="w-1.5 h-1.5 bg-[#0C101A] rotate-45 -mt-[3px] border-r border-b border-white/10" />
                  </div>

                  {/* Visual Reaction Overlay Layer */}
                  <SeatReactionOverlay reactions={floatingReactions[seat.index] || []} />

                  <div className="relative w-14 h-14 sm:w-[68px] sm:h-[68px]">
                    {isOccupied ? (
                      <motion.div 
                        animate={{
                          scale: isVisualizerActive ? 1.05 : 1,
                          boxShadow: isVisualizerActive 
                            ? "0 0 20px rgba(16, 185, 129, 0.65)" 
                            : "0 0 8px rgba(0,0,0,0.2)"
                        }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full h-full rounded-full p-[2px] transition-all duration-300 hover:scale-105 relative bg-white/[0.04] border border-white/10" 
                      >
                        
                        {/* Dynamic Vocal Bubble Ripple Effect */}
                        {isVisualizerActive && (
                          <div className="absolute inset-0 -z-10 pointer-events-none">
                            {/* Outer Vocal Bubble Ripple 1 */}
                            <motion.div
                              animate={{ 
                                scale: [1, 1.25 + seatVolume * 1.5, 1],
                                opacity: [0.6, 0, 0.6],
                                rotate: [0, 180, 360]
                              }}
                              transition={{ 
                                duration: 1.8, 
                                ease: "easeInOut", 
                                repeat: Infinity 
                              }}
                              className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#10B981]/30 via-emerald-500/10 to-transparent border border-[#10B981]/40"
                            />
                            {/* Inner Vocal Bubble Ripple 2 (Reacting aggressively to speaking volume) */}
                            <motion.div
                              animate={{ 
                                scale: 1 + seatVolume * 1.8,
                                opacity: [0.75, 0.25, 0.75]
                              }}
                              transition={{ 
                                type: "spring",
                                stiffness: 280,
                                damping: 14
                              }}
                              className="absolute -inset-1.5 rounded-full bg-emerald-500/15 border-2 border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                            />
                            {/* Expanding Orbit Bubbles */}
                            {[1, 2].map((idx) => (
                              <motion.div
                                key={`seat-grid-${seat.index}-orb-${idx}`}
                                animate={{
                                  x: [0, (idx % 2 === 0 ? 1 : -1) * (15 + seatVolume * 25)],
                                  y: [0, -1 * (20 + seatVolume * 35)],
                                  scale: [0.5, 1 + seatVolume, 0],
                                  opacity: [0.8, 0.4, 0]
                                }}
                                transition={{
                                  duration: 1.3 + idx * 0.4,
                                  repeat: Infinity,
                                  ease: "easeOut",
                                  delay: idx * 0.3
                                }}
                                className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                                style={{ top: '30%', left: '40%' }}
                              />
                            ))}
                          </div>
                        )}

                        <SeatCanvasVisualizer 
                          uid={seat.uid!} 
                          isSpeaking={isSpeaking} 
                          isMusicActive={isMusicActive} 
                          size="small" 
                        />
                        {isVisualizerActive && (
                          <SeatAudioAmplitudeVisualizer 
                            volume={seatVolume} 
                            isActive={isVisualizerActive} 
                          />
                        )}
                        <Avatar className="w-full h-full border-2 border-[#0A051E] bg-[#0E0B1F] relative z-10 shadow-md">
                          <AvatarImage src={memberData?.photoURL || getPremiumAvatar(seat.uid || '')} className="rounded-full object-cover" />
                          <AvatarFallback className="bg-[#1C1F2A] text-white/50 text-xs">?</AvatarFallback>
                        </Avatar>

                        {/* Status Indicator Badge to distinguish roles */}
                        {isOccupied && (
                          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[7px] font-extrabold tracking-wider uppercase z-20 shadow-md border whitespace-nowrap leading-none ${
                            seat.uid === room.hostId
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-amber-300 shadow-[0_2px_8px_rgba(245,158,11,0.4)]'
                              : room.superAdminIds?.includes(seat.uid!)
                              ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white border-purple-400 shadow-[0_2px_8px_rgba(147,51,234,0.4)]'
                              : 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.4)]'
                          }`}>
                            {seat.uid === room.hostId
                              ? 'Host'
                              : room.superAdminIds?.includes(seat.uid!)
                              ? 'Super Admin'
                              : 'Speaker'}
                          </div>
                        )}

                        {/* Video Camera Scanline Overlay verbatim for video lounges */}
                        {room?.roomType === 'video' && (
                          <div className="absolute inset-0 bg-[#3B82F6]/15 hover:bg-[#3B82F6]/5 ring-1.5 ring-teal-400 animate-pulse pointer-events-none rounded-full z-20 flex flex-col items-center justify-center overflow-hidden">
                            <span className="text-[5.5px] bg-[#111827] border border-teal-500/35 px-1 rounded text-teal-300 font-extrabold uppercase tracking-widest absolute bottom-1.5 z-20">🔴 LIVE HD</span>
                          </div>
                        )}
 
                        {/* Muted indicator badge */}
                        {seat.isMuted && !canManage && (
                          <div className="absolute -bottom-1 -right-1 bg-red-600 border border-[#0A051E] p-1 rounded-full z-20 shadow-md">
                            <MicOff size={10} className="text-white" />
                          </div>
                        )}
 
                        {/* Volume/speaking indicator badge */}
                        {isVisualizerActive && (
                          <div className="absolute -bottom-1 -right-1 bg-green-500 border border-[#0A051E] p-1 rounded-full z-20 shadow-md">
                            {isSpeaking ? (
                              <Volume2 size={10} className="text-black stroke-[3]" />
                            ) : (
                              <Music size={10} className="text-black stroke-[3]" />
                            )}
                          </div>
                        )}
 
                        {/* Dedicated Quick Mute/Unmute Toggle Button */}
                        {isOccupied && (
                          <button
                            type="button"
                            disabled={!(canManage || seat.uid === currentUser?.uid)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canManage || seat.uid === currentUser?.uid) {
                                muteSeat(seat.index);
                              }
                            }}
                            className={`absolute bottom-1 -left-1 rounded-full p-1 border border-white/20 shadow-lg z-30 flex items-center justify-center transition-all ${
                              canManage || seat.uid === currentUser?.uid ? 'cursor-pointer hover:scale-115 active:scale-90' : 'cursor-not-allowed opacity-80'
                            } ${
                              seat.isMuted 
                                ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]' 
                                : 'bg-emerald-500 text-black border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            }`}
                            style={{ width: '20px', height: '20px' }}
                            title={
                              !(canManage || seat.uid === currentUser?.uid) 
                                ? (seat.isMuted ? 'Muted' : 'Speaking Active') 
                                : (seat.isMuted ? 'Unmute Speaker' : 'Mute Speaker')
                            }
                          >
                            <Mic size={10} className={seat.isMuted ? 'text-white' : 'text-black stroke-[3]'} />
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <div className={`w-full h-full rounded-full flex items-center justify-center transition-all ${
                        seat.isLocked 
                          ? 'border border-red-500/40 bg-red-950/20 hover:bg-red-950/30' 
                          : 'border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
                      }`}>
                        {seat.isLocked ? (
                          <ShieldAlert size={16} className="text-red-500 animate-pulse" />
                        ) : (
                          <Plus size={16} className="text-white/20 group-hover:text-white/50" />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Name label */}
                  <div className="mt-3 flex flex-col items-center max-w-full select-none">
                    <span className="text-xs font-black text-white/95 truncate max-w-[80px] text-center tracking-tight group-hover:text-yellow-300 transition-colors flex items-center gap-1 justify-center flex-row">
                      {isMusicActive && <Music size={10} className="text-green-400 animate-bounce shrink-0 mr-1" />}
                      <span>{isOccupied ? (memberData?.displayName || 'Guest') : `Seat ${seat.index}`}</span>
                    </span>
                    
                    {/* Seat number underneath */}
                    <span className="text-[9px] font-bold text-gray-400/90 tracking-wide mt-0.5 uppercase">
                      Seat {seat.index}
                    </span>

                    {/* Activity line indicators with real frequency bars, enclosed in layout-preserved container of constant height */}
                    <div className="h-4 flex items-center justify-center mt-1 w-full overflow-hidden">
                      {isVisualizerActive ? (
                        renderFrequencyBars(seat.uid!, 'small')
                      ) : (
                        <div className={`w-8 h-0.5 rounded-full transition-colors ${isOccupied ? 'bg-purple-500/50' : 'bg-white/15'}`} />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {/* Passenger seat add handle */}
            {isHost && (
              <div 
                onClick={increaseSeats}
                className="flex flex-col items-center relative cursor-pointer"
              >
                <div className="w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-full bg-[#FF4D67]/10 border border-dashed border-[#FF4D67]/35 flex flex-col items-center justify-center group hover:bg-[#FF4D67]/20 hover:border-[#FF4D67]/60 hover:scale-105 transition-all shadow-inner">
                   <Plus size={18} className="text-[#FF4D67] animate-pulse" />
                   <span className="text-[8px] font-black text-[#FF4D67] tracking-tight mt-0.5 text-center uppercase">Add Seat</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
        </ErrorBoundary>

        {/* Audience Count Widget */}
        <div className="flex justify-end pr-2 pt-6">
           <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl px-4 py-2 flex items-center gap-3">
              <Users size={16} className="text-gray-400" />
              <div className="w-[1px] h-4 bg-white/10" />
              <span className="text-lg font-black tracking-tighter">8</span>
           </div>
        </div>

        {/* Chat Area - Scrollable */}
        <ErrorBoundary>
        <div className="mt-8 space-y-4 pb-12">
          {messages.filter(msg => {
            if (!msg.text) return true;
            const cleaned = msg.text.replace(/[\s\uFE0F]/g, '');
            if (!cleaned) return true;
            const emojiRegex = /^[\p{Emoji_Presentation}\p{Emoji}\u200d]+$/gu;
            return !emojiRegex.test(cleaned);
          }).map((msg) => (
             <motion.div 
               initial={{ opacity: 0, x: -10 }} 
               animate={{ opacity: 1, x: 0 }}
               key={msg.id} 
               className="flex items-start gap-2 max-w-[85%] cursor-pointer group"
               onClick={() => msg.senderId && navigate(`/profile/${msg.senderId}`)}
             >
                <Avatar className="w-8 h-8 rounded-full border border-white/10 shrink-0 mt-1 transition-transform group-hover:scale-110">
                  <AvatarImage src={msg.senderPhoto} />
                </Avatar>
                <div className="flex-1 flex flex-col gap-0.5">
                   <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-gray-400 group-hover:text-white transition-colors">{msg.senderName}</span>
                      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-sm px-1 py-0.5 flex items-center gap-0.5">
                         <Star size={8} fill="white" className="text-white" />
                         <span className="text-[7px] font-black">VIP6</span>
                      </div>
                      <div className="bg-[#26D97E] rounded-sm px-1 py-0.5">
                         <span className="text-[7px] font-black">3</span>
                      </div>
                   </div>
                   <div className={`p-3 rounded-2xl rounded-tl-none shadow-sm shadow-black/20 backdrop-blur-lg border ${msg.type === MessageType.SYSTEM ? 'bg-gradient-to-r from-[#FF4D67]/20 to-transparent border-[#FF4D67]/30' : 'bg-[#1A1D24]/60 border-white/5'}`}>
                      <p className={`text-sm font-bold leading-normal ${msg.type === MessageType.SYSTEM ? 'text-[#FF4D67]' : 'text-gray-100'}`}>
                        {msg.text}
                      </p>
                   </div>
                </div>
             </motion.div>
          ))}
          <div ref={scrollRef} />
        </div>
        </ErrorBoundary>
      </div>

      {/* Floating Action Menu (Like DP Change) */}
      <AnimatePresence>
        {isHost && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed top-24 right-5 flex flex-col gap-3 z-50"
          >
             <Button 
               size="icon" 
               onClick={changeRoomDP}
               className="bg-black/60 backdrop-blur-xl border border-white/10 w-12 h-12 rounded-2xl shadow-xl hover:bg-[#FF4D67]/20"
             >
               <SwatchBook size={20} className="text-[#FF4D67]" />
             </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lounge Profile Management Center Modal */}
      <AnimatePresence>
        {showProfileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[360] flex items-center justify-center bg-black/85 backdrop-blur-md px-4"
            onClick={() => setShowProfileMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="w-full max-w-sm bg-gradient-to-br from-[#180A2B] via-[#0B091B] to-[#2B0927] border-2 border-[#D946EF]/25 rounded-[36px] p-6 space-y-5 shadow-[0_0_60px_-10px_rgba(217,70,239,0.25)] relative"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-xs font-black text-white italic uppercase tracking-tight flex items-center gap-1.5 font-display">
                    <Sparkles size={14} className="text-pink-500 fill-pink-500/20 animate-pulse" />
                    <span>Lounge Desk</span>
                  </h3>
                  <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">VIP Space Control Center</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowProfileMenu(false)}
                  className="rounded-full h-8 w-8 text-white/50 hover:text-white hover:bg-white/5"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Cover Summary Card */}
              <div className="flex gap-3.5 items-center bg-[#1E0D36]/40 p-3 rounded-2xl border border-white/5 shadow-inner">
                <img 
                  src={room.thumbnailUrl || getPremiumRoomCover(room.id)} 
                  className="w-14 h-14 rounded-xl object-cover border border-[#D946EF]/20 shrink-0 shadow-lg" 
                  alt="Room Cover"
                />
                <div className="text-left flex-1 min-w-0">
                  <h4 className="font-extrabold text-white text-xs truncate">{room.title}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">UID: {room.id.slice(0, 8).toUpperCase()}</span>
                    <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${room.roomType === 'video' ? 'bg-gradient-to-r from-red-500 to-indigo-500 text-white animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                      {room.roomType === 'video' ? '🎥 VIDEO STAGE' : '🎤 AUDIO LOUNGE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed buttons matrix with custom color coding and brand styles */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Change Room Background */}
                <button
                  disabled={!canManage}
                  onClick={() => {
                    setCustomizerTab('atmosphere');
                    setShowProfileMenu(false);
                    setShowDpModal(true);
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                    canManage 
                      ? 'bg-pink-500/[0.04] border-pink-500/20 text-pink-300 hover:border-pink-500 hover:bg-pink-500/10 shadow-[0_2px_10px_rgba(236,72,153,0.05)]' 
                      : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-35'
                  }`}
                >
                  <SwatchBook size={18} className={canManage ? 'text-pink-400 animate-bounce' : ''} />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Change Background</span>
                </button>

                {/* 2. Change Room Cover Image */}
                <button
                  disabled={!canManage}
                  onClick={() => {
                    setCustomizerTab('info');
                    setShowProfileMenu(false);
                    setShowDpModal(true);
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                    canManage 
                      ? 'bg-amber-500/[0.04] border-amber-500/20 text-amber-300 hover:border-amber-500 hover:bg-amber-500/10 shadow-[0_2px_10px_rgba(245,158,11,0.05)]' 
                      : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-35'
                  }`}
                >
                  <Camera size={18} className={canManage ? 'text-amber-400 animate-pulse' : ''} />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Change Cover</span>
                </button>

                {/* 3. Change Room Name */}
                <button
                  disabled={!canManage}
                  onClick={() => {
                    setCustomizerTab('info');
                    setShowProfileMenu(false);
                    setShowDpModal(true);
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                    canManage 
                      ? 'bg-cyan-500/[0.04] border-cyan-500/20 text-cyan-300 hover:border-cyan-500 hover:bg-cyan-500/10 shadow-[0_2px_10px_rgba(6,182,212,0.05)]' 
                      : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-35'
                  }`}
                >
                  <Pencil size={18} className={canManage ? 'text-cyan-400' : ''} />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Change Name</span>
                </button>

                {/* 4. Share Room */}
                <button
                  onClick={() => {
                    shareRoom();
                    setShowProfileMenu(false);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300 hover:border-emerald-500 hover:bg-emerald-500/10 text-center transition-all shadow-[0_2px_10px_rgba(16,185,129,0.05)]"
                >
                  <Share2 size={18} className="text-emerald-400" />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Share Room</span>
                </button>

                {/* 5. LIVE VIDEO SWITCH TRIGGER (Conversion Feature) */}
                <button
                  disabled={!canManage}
                  onClick={async () => {
                    try {
                      const updatedType = room.roomType === 'video' ? 'standard' : 'video';
                      await updateDoc(doc(db, 'rooms', room.id), { roomType: updatedType });
                      toast.success(updatedType === 'video' 
                        ? 'Lounge upgraded to Video Stream Space! 🎥✨' 
                        : 'Lounge converted back to classic Voice lounge. 🎤'
                      );
                      setShowProfileMenu(false);
                    } catch (err) {
                      console.error("Error setting video/audio roomType:", err);
                      toast.error("Could not switch room type. Check layout configurations.");
                    }
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all col-span-2 ${
                    canManage 
                      ? 'bg-gradient-to-r from-violet-900/40 to-indigo-900/40 border-violet-500/30 text-violet-300 hover:border-fuchsia-500 hover:shadow-fuchsia-500/25 shadow-[0_2px_15px_rgba(139,92,246,0.15)] font-black' 
                      : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-35'
                  }`}
                >
                  <Video size={20} className={canManage ? 'text-purple-400 animate-pulse' : ''} />
                  <span className="text-[8px] font-black uppercase tracking-wide mt-1">
                    {room.roomType === 'video' ? '🎥 Convert to Audio' : '🎥 Change to Video Room'}
                  </span>
                </button>

                {/* 6. Room Settings */}
                <button
                  disabled={!canManage}
                  onClick={() => {
                    setCustomizerTab('settings');
                    setShowProfileMenu(false);
                    setShowDpModal(true);
                  }}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border text-center transition-all ${
                    canManage 
                      ? 'bg-purple-500/[0.04] border-purple-500/20 text-purple-300 hover:border-purple-500 hover:bg-purple-500/10 shadow-[0_2px_10px_rgba(168,85,247,0.05)]' 
                      : 'bg-white/5 border-white/5 text-gray-600 cursor-not-allowed opacity-35'
                  }`}
                >
                  <Settings size={18} className={canManage ? 'text-purple-400' : ''} />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Room Settings</span>
                </button>

                {/* 7. Room Information */}
                <button
                  onClick={() => {
                    setCustomizerTab('stats');
                    setShowProfileMenu(false);
                    setShowDpModal(true);
                  }}
                  className="flex flex-col items-center justify-center p-3.5 rounded-2xl border border-teal-500/20 bg-teal-500/[0.04] text-teal-300 hover:border-teal-500 hover:bg-teal-500/10 text-center transition-all shadow-[0_2px_10px_rgba(20,184,166,0.05)]"
                >
                  <Info size={18} className="text-teal-400" />
                  <span className="text-[8px] font-black uppercase tracking-wider mt-1.5">Room Information</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Luxury Room DP & Theme Customizer Modal */}
      <AnimatePresence>
        {showDpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[350] flex items-center justify-center bg-black/85 backdrop-blur-md px-4"
            onClick={() => setShowDpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="w-full max-w-sm bg-[#12141C] border border-white/10 rounded-[36px] p-5 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center shrink-0 border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white italic uppercase tracking-tight flex items-center gap-1.5">
                    <Crown size={14} className="text-yellow-400 fill-yellow-400" />
                    <span>Room Dashboard</span>
                  </h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Room Customization &amp; Information</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowDpModal(false)}
                  className="rounded-full h-8 w-8 text-white/50 hover:text-white hover:bg-white/5"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* VIP Custom Navigation Tabs */}
              <div className="grid grid-cols-5 gap-0.5 shrink-0 bg-white/5 p-1 rounded-2xl border border-white/5">
                {[
                  { id: 'info', label: 'Cover' },
                  { id: 'atmosphere', label: 'Vibe BG' },
                  { id: 'settings', label: 'Controls' },
                  { id: 'stats', label: 'VIP Info' },
                  { id: 'analytics', label: 'Analytics' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCustomizerTab(tab.id as any)}
                    className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-tight text-center transition-all ${
                      customizerTab === tab.id
                        ? 'bg-gradient-to-r from-pink-500/20 to-purple-600/25 border border-pink-500/30 text-pink-300 shadow-md shadow-pink-500/5'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable Contents */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar my-2">
                
                {/* TAB 1: COVER & BIO */}
                {customizerTab === 'info' && (
                  <div className="space-y-4">
                    {/* Live Preview */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-lg">
                      <img 
                        src={tempDp || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600"} 
                        className="w-full h-full object-cover" 
                        alt="Preview" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3 justify-between">
                        <div className="text-left">
                          <p className="text-[8px] font-black uppercase text-yellow-400 tracking-wider">PREVIEW COVER</p>
                          <p className="text-xs font-black text-white truncate max-w-[170px]">{editRoomTitle || room.title}</p>
                        </div>
                      </div>
                    </div>

                    {/* Change Cover Details */}
                    {canManage ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Change Cover Image</p>
                          <div className="grid grid-cols-2 gap-2">
                            {/* Upload Custom File */}
                            <label className="flex items-center justify-center gap-1.5 h-10 bg-white/5 border border-white/10 rounded-xl cursor-pointer text-[10px] font-black uppercase text-pink-400 hover:bg-pink-500/10 transition-all">
                              <Camera size={13} />
                              <span>Device Storage</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                className="hidden" 
                              />
                            </label>
                            {/* Quick Presets Carousel overlay */}
                            <Button
                              variant="outline"
                              onClick={() => {
                                const randomPreset = PREMIUM_COVERS[Math.floor(Math.random() * PREMIUM_COVERS.length)];
                                setTempDp(randomPreset);
                                toast.success("Set randomized VIP wallpaper preset");
                              }}
                              className="h-10 text-[10px] border-white/10 hover:bg-white/10 uppercase font-black tracking-wider text-yellow-400 animate-pulse"
                            >
                              Shuffle Preset
                            </Button>
                          </div>
                        </div>

                        {/* Paste URL */}
                        <div className="space-y-1.5">
                          <label className="text-[8px] font-black uppercase text-white/50 tracking-wider block px-1">Custom Image URL</label>
                          <Input 
                            value={tempDp}
                            onChange={(e) => setTempDp(e.target.value)}
                            placeholder="Paste direct high-res image link..."
                            className="h-10 bg-white/5 border-white/10 rounded-xl px-3 text-xs font-bold text-white/80 placeholder:text-gray-700 focus-visible:ring-1 focus-visible:ring-pink-500"
                          />
                        </div>

                        {/* Change Name and Bio */}
                        <div className="space-y-3 pt-2 border-t border-white/5">
                          <div className="space-y-1.5 text-left">
                            <label className="text-[8px] font-black uppercase text-white/50 tracking-wider block px-1">Room Name</label>
                            <Input 
                              value={editRoomTitle}
                              onChange={(e) => setEditRoomTitle(e.target.value)}
                              placeholder="Enter exquisite lounge name..."
                              className="h-10 bg-white/5 border-white/10 rounded-xl px-3 text-xs font-black text-white focus-visible:ring-1 focus-visible:ring-pink-500"
                            />
                          </div>

                          <div className="space-y-1.5 text-left">
                            <label className="text-[8px] font-black uppercase text-white/50 tracking-wider block px-1">Room Tagline</label>
                            <textarea 
                              value={editRoomDesc}
                              onChange={(e) => setEditRoomDesc(e.target.value)}
                              placeholder="Describe the vibes, music, or rules..."
                              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs font-bold text-white focus:outline-none focus:border-pink-500 resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl text-center">
                        <p className="text-xs text-slate-400 font-bold">Only Room Owner &amp; Admins can edit details and covers.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: ATMOSPHERE */}
                {customizerTab === 'atmosphere' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest leading-none flex items-center gap-1">
                        <Sparkles size={10} className="text-white/40" />
                        <span>Select Premium Gradient Background</span>
                      </p>
                      {canManage ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {Object.entries(ROOM_BACKGROUNDS).map(([key, item]) => (
                            <button
                              key={key}
                              onClick={() => setSelectedBg(key)}
                              className={`h-10 px-3 flex items-center justify-between rounded-xl border font-black text-[10px] uppercase tracking-wide transition-all ${
                                selectedBg === key 
                                  ? 'bg-gradient-to-r from-pink-500/25 to-purple-600/25 border-pink-500 text-pink-300 shadow-md shadow-pink-500/5' 
                                  : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              <span className="truncate">{item.name}</span>
                              {selectedBg === key && <Check size={11} className="text-pink-400 shrink-0 ml-1" />}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-center">
                          <p className="text-xs text-slate-400 font-bold">Only Room Owner &amp; Admins can edit background layout.</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-white/10">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest leading-none flex items-center gap-1">
                        <Sparkles size={10} className="text-white/40" />
                        <span>Room Theme Atmosphere</span>
                      </p>
                      {canManage ? (
                        <div className="grid grid-cols-1 gap-1.5">
                          {[
                            { id: 'classic', name: 'Classic Standard', desc: 'Sleek premium gradient environment' },
                            { id: 'rainy_cafe', name: 'Rainy Cafe ☕🌧️', desc: 'Warm table lamp illumination & falling window raindrops' },
                            { id: 'neon_techno', name: 'Neon Techno ⚡🪩', desc: 'Retro animated wireframe grid & scanning lasers' },
                            { id: 'cosmic_aurora', name: 'Cosmic Aurora 🌌✨', desc: 'Swirling celestial northern lights & pulsing stars' },
                            { id: 'sunset_beach', name: 'Sunset Beach 🌅🏖️', desc: 'Warm horizontal sun-glow & golden water reflections' }
                          ].map((themeOpt) => (
                            <button
                              key={themeOpt.id}
                              onClick={() => setSelectedTheme(themeOpt.id)}
                              className={`px-3.5 py-2.5 flex items-start gap-2.5 rounded-xl border text-left transition-all ${
                                selectedTheme === themeOpt.id 
                                  ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500 shadow-lg text-white' 
                                  : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider leading-none">{themeOpt.name}</p>
                                <p className="text-[9px] text-slate-400 font-bold mt-1 leading-normal">{themeOpt.desc}</p>
                              </div>
                              {selectedTheme === themeOpt.id && (
                                <div className="self-center bg-pink-500 p-0.5 rounded-full shrink-0">
                                  <Check size={10} className="text-black stroke-[3]" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white/5 border border-white/5 p-3 rounded-2xl text-center">
                          <p className="text-xs text-slate-400 font-bold">Only Room Owner &amp; Admins can apply atmospheric lighting.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: CONTROLS & SEATS */}
                {customizerTab === 'settings' && (
                  <div className="space-y-4">
                    {/* Sound Effects Toggle Control (Accessible to all users inside Controls & Seats section) */}
                    <div className="space-y-2 bg-white/5 border border-white/5 p-4 rounded-3xl text-left">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-black text-rose-300 italic uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Volume2 size={13} className="text-rose-400" />
                            <span>Room Sound Effects</span>
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold mt-1">Play short audio cues for 'Room Join' and 'Gift Send' actions</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextState = !soundEffectsEnabled;
                            setSoundEffectsEnabled(nextState);
                            localStorage.setItem('sound_effects_enabled', nextState ? 'true' : 'false');
                            toast.success(nextState ? "Sound effects enabled 🎵" : "Sound effects muted 🤫");
                          }}
                          className={`w-10 h-6 rounded-full p-0.5 transition-colors duration-300 relative border cursor-pointer ${
                            soundEffectsEnabled 
                              ? 'bg-[#10B981] border-[#10B981]' 
                              : 'bg-white/10 border-white/10'
                          }`}
                        >
                          <motion.div 
                            layout
                            className="bg-white w-4 h-4 rounded-full shadow-md"
                            animate={{ x: soundEffectsEnabled ? 16 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    </div>

                    {room.hostId === currentUser?.uid ? (
                      <div className="space-y-3.5">
                        <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Room Seat Scaling</p>
                        <div className="flex justify-between items-center bg-white/5 border border-white/5 p-4 rounded-2xl">
                          <div>
                            <p className="text-xs font-black text-white/90">Room Seat Count</p>
                            <p className="text-[9px] text-gray-400 font-bold">Instantly increases or decreases seat grid</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSeatCountDynamically(Math.max(5, room.seats.length - 4))}
                              disabled={room.seats.length <= 5}
                              className="h-8 w-8 rounded-full border-white/10 bg-white/5 font-black text-white p-0"
                            >
                              -
                            </Button>
                            <span className="text-sm font-mono font-black text-[#FFD700] px-1">{room.seats.length}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSeatCountDynamically(Math.min(17, room.seats.length + 4))}
                              disabled={room.seats.length >= 17}
                              className="h-8 w-8 rounded-full border-white/10 bg-white/5 font-black text-white p-0"
                            >
                              +
                            </Button>
                          </div>
                        </div>

                         {/* Lock Room entirely & Change Password */}
                        <div className="space-y-3.5 border-t border-white/5 pt-4">
                          <p className="text-[9px] font-black uppercase text-white/40 tracking-widest font-sans">Security Control</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={async () => {
                                const newLockState = !room.isLocked;
                                await updateDoc(doc(db, 'rooms', roomId!), { isLocked: newLockState });
                                toast.success(newLockState ? "PIN Access restriction active" : "Room open to public");
                              }}
                              className={`flex-1 h-11 rounded-xl text-xs font-black uppercase ${room.isLocked ? 'border border-red-500 bg-red-950/20 text-red-400' : 'border border-white/10 bg-white/5'}`}
                            >
                              {room.isLocked ? '🔒 Access: Locked' : '🔓 Access: Public'}
                            </Button>
                          </div>

                          {room.isLocked && (
                            <div className="space-y-1.5 animate-bounce-once">
                              <label className="text-[8px] font-black uppercase text-yellow-400 tracking-wider block px-1">Room Admission PIN / Password</label>
                              <div className="flex gap-2">
                                <Input 
                                  value={roomPasswordText}
                                  onChange={(e) => setRoomPasswordText(e.target.value)}
                                  placeholder="Enter 4-character secure PIN..."
                                  className="h-10 bg-white/5 border-white/10 rounded-xl px-3 text-xs font-mono font-bold text-white focus-visible:ring-1 focus-visible:ring-yellow-400"
                                />
                                <Button 
                                  onClick={async () => {
                                    if (!roomPasswordText.trim()) {
                                      toast.error("Please enter a valid password or unlock the room");
                                      return;
                                    }
                                    await updateDoc(doc(db, 'rooms', roomId!), { password: roomPasswordText.trim() });
                                    toast.success(`Access PIN set to: ${roomPasswordText.trim()}`);
                                  }}
                                  className="h-10 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold uppercase text-[10px] rounded-xl px-4"
                                >
                                  Save PIN
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Admin & Super Admin Management console */}
                        <div className="space-y-3.5 border-t border-white/5 pt-4">
                          <p className="text-[9px] font-black uppercase text-[#FFD700] tracking-widest block font-sans">Role Management ({members.length - 1} Online Participant(s))</p>
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar text-left">
                            {members.filter(m => m.uid !== room.hostId).map(member => {
                              const isSA = room.superAdminIds?.includes(member.uid) || false;
                              const isCo = room.coHostIds?.includes(member.uid) || false;

                              return (
                                <div key={member.uid} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <Avatar className="w-8 h-8 border border-white/10 shrink-0">
                                      <AvatarImage src={member.photoURL || getPremiumAvatar(member.uid)} />
                                      <AvatarFallback>{member.displayName?.[0] || '?'}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 text-left">
                                      <p className="text-xs font-bold text-white truncate max-w-[80px] sm:max-w-[100px]">{member.displayName}</p>
                                      <p className="text-[8px] text-gray-400 font-extrabold uppercase tracking-tight">
                                        {isSA ? '👑 Super Admin' : isCo ? '🛡️ Admin' : 'Audience'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5 shrink-0">
                                    {/* Promote Super Admin */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => promoteToSuperAdmin(member.uid)}
                                      className={`h-7 text-[8px] font-black rounded-lg uppercase px-2 hover:bg-purple-500/10 ${isSA ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400'}`}
                                    >
                                      {isSA ? 'Demote Super' : 'Promote Super'}
                                    </Button>
                                    {/* Promote Admin */}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => promoteToAdmin(member.uid)}
                                      className={`h-7 text-[8px] font-black rounded-lg uppercase px-2 hover:bg-blue-500/10 ${isCo ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'}`}
                                      disabled={isSA}
                                    >
                                      {isCo ? 'Demote Admin' : 'Promote Admin'}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            {members.filter(m => m.uid !== room.hostId).length === 0 && (
                              <p className="text-[10px] text-gray-500 font-medium italic text-center py-2">No other online members to promote yet.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/5 border border-white/5 p-3.5 rounded-2xl text-center">
                        <p className="text-xs text-slate-400 font-bold">Only the main Room Owner can edit seat counts or change security settings.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: VIP INFO & COPIED SHARE LINK */}
                {customizerTab === 'stats' && (
                  <div className="space-y-4">
                    {/* Share Action */}
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Share Room</p>
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href);
                          toast.success("Room invitation link copied to clipboard! Invite friends instantly 🌟");
                        }}
                        className="w-full h-11 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-black text-xs rounded-xl gap-2 shadow-lg"
                      >
                        <Share2 size={14} className="stroke-[3]" />
                        <span>COPY SHARE LINK</span>
                      </Button>
                    </div>

                    <div className="space-y-2 pb-2">
                      <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">Room Metadata</p>
                      <div className="bg-white/5 rounded-2xl border border-white/5 p-3.5 space-y-2 text-left">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Room Unique ID</span>
                          <span className="text-white font-black font-mono select-all text-[10px] bg-black/40 px-2 py-0.5 rounded">{room.id?.toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">VIP Host</span>
                          <span className="text-[#FFD700] font-black text-[10px]">{room.hostName || 'Supreme Host'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Active Audience</span>
                          <span className="text-emerald-400 font-black">{members.length} Online</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">VIP Seats Available</span>
                          <span className="text-blue-400 font-black">{room.seats?.length || 9} Panel Seats</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Party Category</span>
                          <span className="text-purple-400 font-black text-[10px] uppercase">{room.category || 'Music'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: ROOM ANALYTICS */}
                {customizerTab === 'analytics' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-[#FFD700] tracking-widest flex items-center gap-1.5">
                        <Star size={12} className="text-yellow-400 fill-yellow-400 animate-pulse" />
                        <span>Room Analytics</span>
                      </p>
                      <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">Performance &amp; Engagement Index (24h)</p>
                    </div>

                    {/* Stats overview boxes */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-2.5 text-center">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Growth</p>
                        <p className="text-sm font-black text-pink-400 mt-1">+{members.length + 12}%</p>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-2.5 text-center">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Peak Users</p>
                        <p className="text-sm font-black text-purple-400 mt-1">{Math.max(members.length + 1, 14)}</p>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-2xl p-2.5 text-center">
                        <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Coins Vol</p>
                        <p className="text-sm font-black text-amber-400 mt-1">{(room?.giftVolume || 0) + 120} 🪙</p>
                      </div>
                    </div>

                    {/* Recharts chart representation */}
                    <div className="bg-black/30 border border-white/10 rounded-2xl p-3 h-[240px] flex flex-col justify-between mt-1 select-none overflow-hidden">
                      <ResponsiveContainer width="100%" height={210}>
                        <LineChart data={analyticsData} margin={{ top: 8, right: 10, left: -32, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis 
                            dataKey="time" 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={8} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="rgba(255,255,255,0.3)" 
                            fontSize={8} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartsTooltip 
                            content={({ active, payload, label }: any) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-slate-900/95 border border-white/10 p-3 rounded-xl shadow-2xl text-left">
                                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider mb-1">{label}</p>
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                        Audience: {payload[0]?.value}
                                      </p>
                                      <p className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                        Peak Members: {payload[1]?.value}
                                      </p>
                                      <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Gifts Vol: {payload[2]?.value} 🪙
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            height={25} 
                            iconSize={6} 
                            wrapperStyle={{ fontSize: '7px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.05em' }} 
                          />
                          <Line 
                            name="Audience" 
                            type="monotone" 
                            dataKey="audience" 
                            stroke="#EC4899" 
                            strokeWidth={2}
                            dot={{ r: 0 }}
                            activeDot={{ r: 3 }}
                          />
                          <Line 
                            name="Peak Members" 
                            type="monotone" 
                            dataKey="peakMembers" 
                            stroke="#8B5CF6" 
                            strokeWidth={1.5}
                            strokeDasharray="3 3"
                            dot={{ r: 0 }}
                            activeDot={{ r: 3 }}
                          />
                          <Line 
                            name="Gifts Vol" 
                            type="monotone" 
                            dataKey="gifts" 
                            stroke="#F59E0B" 
                            strokeWidth={2}
                            dot={{ r: 0 }}
                            activeDot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-white/5 border border-blue-500/10 bg-blue-500/5 rounded-2xl p-3 flex items-start gap-2 text-left">
                      <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-slate-300 font-semibold leading-relaxed">
                        Analytics track traffic fluctuation and coin volumes recorded dynamically. View peaks to schedule themed visual broadcasts! 🎙️💎
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Apply / Cancel Footer Buttons (Only showed for Customization tab selections) */}
              {canManage && (customizerTab === 'info' || customizerTab === 'atmosphere') && (
                <div className="flex gap-2.5 pt-3 border-t border-white/5 shrink-0 flex-row">
                  <Button 
                    onClick={() => setShowDpModal(false)}
                    variant="outline" 
                    className="flex-1 h-11 rounded-xl border-white/10 bg-white/5 uppercase font-black text-[9px] tracking-wider text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={async () => {
                      await saveRoomDp();
                      setShowDpModal(false);
                    }}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 uppercase font-black text-[9px] tracking-wider text-black font-extrabold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-transform"
                  >
                    Apply Theme
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seat Slot Right-Click / Long-Press Role-Specific Context Menu */}
      <AnimatePresence>
        {seatContextMenu && (() => {
          const { index, x, y } = seatContextMenu;
          const seat = room?.seats?.[index];
          if (!seat) return null;

          const targetUid = seat.uid;
          const isOccupied = !!targetUid;
          const targetMember = isOccupied ? members.find(m => m.uid === targetUid) : null;
          const targetDisplayName = targetMember?.displayName || (targetUid === room.hostId ? 'Owner' : 'Guest');

          // Status Badge calculation
          const targetRole = targetUid === room.hostId 
            ? 'Host' 
            : room.superAdminIds?.includes(targetUid!) 
            ? 'Super Admin' 
            : 'Speaker';

          const isSelf = targetUid === currentUser?.uid;
          const canModerateTarget = targetUid ? checkCanModerate(targetUid) : false;

          // Render context menu at fixed position
          const menuWidth = 210;
          const menuHeight = 260; 
          const posX = Math.min(x, window.innerWidth - menuWidth - 10);
          const posY = Math.min(y, window.innerHeight - menuHeight - 10);

          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed z-[999] bg-[#0A051D]/95 border border-indigo-500/30 text-white rounded-2xl p-2 w-[210px] backdrop-blur-xl shadow-[0_15px_40px_rgba(0,0,0,0.85),0_0_15px_rgba(99,102,241,0.2)] flex flex-col gap-1.5 focus:outline-none text-left"
              style={{ left: `${posX}px`, top: `${posY}px` }}
              onClick={(e) => e.stopPropagation()} // Keep overlay open if they click menu body
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Header section with status badge info */}
              <div className="px-3 py-2 border-b border-white/10 flex flex-col gap-1">
                <span className="text-[9px] font-black text-indigo-400 tracking-widest uppercase">
                  Seat {index} Slot Info
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  {isOccupied ? (
                    <>
                      <Avatar className="w-5 h-5 ring-1 ring-indigo-400 shrink-0">
                        <AvatarImage src={targetMember?.photoURL || getPremiumAvatar(targetUid)} />
                        <AvatarFallback className="text-[8px]">?</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-black truncate max-w-[120px] text-white">
                        {targetDisplayName}
                        {isSelf && <span className="text-[8px] text-[#FFD700] ml-1">(You)</span>}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">Vacant Slot</span>
                  )}
                </div>
                <div className="mt-1">
                  {isOccupied ? (
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-extrabold tracking-wider uppercase leading-none whitespace-nowrap inline-block ${
                      targetRole === 'Host'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black border border-yellow-300 shadow-[0_2px_8px_rgba(245,158,11,0.35)]'
                        : targetRole === 'Super Admin'
                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white border border-purple-400 shadow-[0_2px_8px_rgba(147,51,234,0.35)]'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white border border-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.35)]'
                    }`}>
                      {targetRole}
                    </span>
                  ) : seat.isLocked ? (
                    <span className="bg-rose-500/10 text-rose-400 text-[8.5px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full border border-rose-500/25">
                      Locked
                    </span>
                  ) : (
                    <span className="bg-emerald-500/10 text-emerald-400 text-[8.5px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full border border-emerald-400/25">
                      Vacant
                    </span>
                  )}
                </div>
              </div>

              {/* Role specific actions */}
              <div className="flex flex-col gap-0.5 p-1 overflow-y-auto max-h-[220px] no-scrollbar">
                {isOccupied ? (
                  <>
                    {/* 1. Mute Action (Self or Mod Action) */}
                    {isSelf ? (
                      <button
                        onClick={async () => {
                          const updatedSeats = [...room.seats];
                          updatedSeats[index].isMuted = !updatedSeats[index].isMuted;
                          await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
                          toast.success(updatedSeats[index].isMuted ? 'Muted self' : 'Unmuted self');
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-white/10 transition-colors text-white"
                      >
                        {seat.isMuted ? <Mic size={13} className="text-emerald-400" /> : <MicOff size={13} className="text-rose-400" />}
                        <span>{seat.isMuted ? 'Unmute Self' : 'Mute Self'}</span>
                      </button>
                    ) : canModerateTarget ? (
                      <button
                        onClick={async () => {
                          await muteSeat(index);
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-white/10 transition-colors text-amber-300"
                      >
                        {seat.isMuted ? <Mic size={13} className="text-emerald-400" /> : <MicOff size={13} className="text-amber-400" />}
                        <span>{seat.isMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                      </button>
                    ) : null}

                    {/* 2. Promote/Demote Super Admin (Owner Only) */}
                    {isHost && !isSelf && (
                      <button
                        onClick={async () => {
                          await promoteToSuperAdmin(targetUid!);
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-white/10 transition-colors text-purple-300"
                      >
                        <Crown size={13} className="text-purple-400 animate-pulse" />
                        <span>{room.superAdminIds?.includes(targetUid!) ? 'Demote Badge' : 'Admin Badge'}</span>
                      </button>
                    )}

                    {/* 3. Take out / Kick from seat */}
                    {isSelf ? (
                      <button
                        onClick={async () => {
                          const updatedSeats = [...room.seats];
                          updatedSeats[index].uid = null;
                          updatedSeats[index].isMuted = false;
                          await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
                          setIsMuted(true);
                          toast.success('Left seat successfully');
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-rose-500/20 text-rose-400 transition-colors"
                      >
                        <LogOut size={13} />
                        <span>Leave Seat</span>
                      </button>
                    ) : canModerateTarget ? (
                      <button
                        onClick={() => {
                          setKickConfirmSeatIndex(index);
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-rose-500/20 text-rose-400 transition-colors"
                      >
                        <UserMinus size={13} />
                        <span>Kick Seat Occupant</span>
                      </button>
                    ) : null}

                    {/* 4. Send Gift */}
                    {!isSelf && (
                      <button
                        onClick={() => {
                          navigate('/gifts/' + targetUid);
                          setSeatContextMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-yellow-500/10 text-yellow-400 transition-colors"
                      >
                        <Gift size={13} className="animate-bounce" />
                        <span>Send Premium Gift</span>
                      </button>
                    )}

                    {/* 5. View Profile */}
                    <button
                      onClick={() => {
                        setActivePreviewUid(targetUid);
                        setSeatContextMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold hover:bg-white/10 transition-colors text-gray-300"
                    >
                      <User size={13} />
                      <span>Inspect Profile</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Vacant seat actions block */}
                    <button
                      disabled={seat.isLocked}
                      onClick={async () => {
                        // Sit down / Join seat
                        // Checking permissions
                        const isCurrentUserHost = currentUser?.uid === room.hostId;
                        const isCurrentUserSuperAdmin = room.superAdminIds?.includes(currentUser?.uid || '') || false;
                        
                        if (index === 0 && !isCurrentUserHost) {
                          toast.error("Only the Room Owner can sit in the Owner seat.");
                          setSeatContextMenu(null);
                          return;
                        }
                        if (index === 1 && !isCurrentUserSuperAdmin && !isCurrentUserHost) {
                          toast.error("Only Super Admins can sit in the Super Admin reserved seat.");
                          setSeatContextMenu(null);
                          return;
                        }

                        // Carry out join seat
                        const updatedSeats = [...room.seats];
                        updatedSeats.forEach((s) => {
                          if (s.uid === currentUser?.uid) {
                            s.uid = null;
                            s.isMuted = false;
                          }
                        });
                        updatedSeats[index].uid = currentUser?.uid || '';
                        updatedSeats[index].isMuted = isMuted;
                        await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
                        toast.success('Joined seat successfully!');
                        setSeatContextMenu(null);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold transition-colors ${
                        seat.isLocked 
                          ? 'text-gray-500 cursor-not-allowed opacity-50' 
                          : 'hover:bg-emerald-500/15 text-emerald-400'
                      }`}
                    >
                      <MapPin size={13} />
                      <span>{seat.isLocked ? 'Seat is Locked 🔒' : 'Take Vacant Seat'}</span>
                    </button>

                    {/* Toggle lock seat (Mod only) */}
                    {(isHost || isSuperAdmin) && (
                      <button
                        onClick={async () => {
                          const updatedSeats = [...room.seats];
                          updatedSeats[index].isLocked = !updatedSeats[index].isLocked;
                          await updateDoc(doc(db, 'rooms', roomId!), { seats: updatedSeats });
                          toast.success(updatedSeats[index].isLocked ? 'Seat Locked' : 'Seat Unlocked');
                          setSeatContextMenu(null);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-extrabold transition-colors ${
                          seat.isLocked ? 'hover:bg-emerald-500/10 text-emerald-400' : 'hover:bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {seat.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                        <span>{seat.isLocked ? 'Unlock Seat Space' : 'Lock Seat Space'}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Seat Options Modal */}
      <AnimatePresence>
        {selectedSeat !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center px-4 pb-8 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedSeat(null)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="w-full max-w-md bg-[#1A1D24] rounded-[40px] p-8 space-y-6 border border-white/10"
              onClick={e => e.stopPropagation()}
            >
               <h3 className="text-xl font-bold text-center">Seat {selectedSeat + 1} Management</h3>
               <div className="grid grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-[24px] border-white/10 bg-white/5 font-bold gap-3"
                    onClick={() => { lockSeat(selectedSeat); setSelectedSeat(null); }}
                  >
                    <ShieldAlert size={20} className="text-orange-500" />
                    {room.seats[selectedSeat].isLocked ? 'Unlock Seat' : 'Lock Seat'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-[24px] border-white/10 bg-white/5 font-bold gap-3"
                    onClick={() => { muteSeat(selectedSeat); setSelectedSeat(null); }}
                  >
                    <MicOff size={20} className={room.seats[selectedSeat].isMuted ? 'text-gray-400' : 'text-red-500'} />
                    {room.seats[selectedSeat].isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-[24px] border-white/10 bg-white/5 font-bold gap-3"
                    onClick={() => { 
                      setKickConfirmSeatIndex(selectedSeat); 
                      setSelectedSeat(null); 
                    }}
                  >
                    <X size={20} className="text-red-500" />
                    Kick
                  </Button>
                  {isHost && room.seats[selectedSeat].uid && (
                    <Button 
                      variant="outline" 
                      className="h-16 rounded-[24px] border-white/10 bg-white/5 font-bold gap-3 col-span-2"
                      onClick={() => { promoteToSuperAdmin(room.seats[selectedSeat].uid!); setSelectedSeat(null); }}
                    >
                      <ShieldAlert size={20} className="text-blue-400" />
                      {room.superAdminIds?.includes(room.seats[selectedSeat].uid!) ? 'Demote Super Admin' : 'Promote Super Admin'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    className="h-16 rounded-[24px] border-white/10 bg-white/5 font-bold gap-3"
                    onClick={() => setSelectedSeat(null)}
                  >
                    Cancel
                  </Button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kick Confirmation Modal */}
      <AnimatePresence>
        {kickConfirmSeatIndex !== null && (() => {
          const seatToKick = room?.seats[kickConfirmSeatIndex];
          const kickedMember = seatToKick?.uid ? members.find(m => m.uid === seatToKick.uid) : null;
          const kickedDisplayName = kickedMember?.displayName || 'Guest';

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setKickConfirmSeatIndex(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[#1A1D24] p-6 rounded-[28px] border border-red-500/20 text-center space-y-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <ShieldAlert size={24} className="animate-pulse" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Confirm Deliberate Action</h3>
                  <p className="text-xs text-gray-400 text-center">
                    Are you sure you want to kick <span className="font-extrabold text-red-400">{kickedDisplayName}</span> from <span className="font-bold text-white font-mono">Seat {kickConfirmSeatIndex + 1}</span>?
                  </p>
                  <p className="text-[10px] text-gray-500 italic text-center">
                    They will be removed from the speaker panel.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-11 border-white/10 bg-white/5 font-black uppercase text-[10px] tracking-wider text-gray-300 hover:bg-white/10"
                    onClick={() => setKickConfirmSeatIndex(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl h-11 bg-red-600 hover:bg-red-500 font-black uppercase text-[10px] tracking-wider text-white shadow-lg shadow-red-500/10 border-none"
                    onClick={async () => {
                      await kickUserFromSeat(kickConfirmSeatIndex);
                      setKickConfirmSeatIndex(null);
                    }}
                  >
                    Confirm Kick
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Mute Confirmation Modal */}
      <AnimatePresence>
        {muteConfirmSeatIndex !== null && (() => {
          const seatToMute = room?.seats[muteConfirmSeatIndex];
          const mutedMember = seatToMute?.uid ? members.find(m => m.uid === seatToMute.uid) : null;
          const mutedDisplayName = mutedMember?.displayName || 'Guest';

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setMuteConfirmSeatIndex(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-[#1A1D24] p-6 rounded-[28px] border border-amber-500/20 text-center space-y-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <MicOff size={22} className="stroke-[2.5] animate-pulse" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Mute Seat Member</h3>
                  <p className="text-xs text-gray-400 text-center">
                    Are you sure you want to mute <span className="font-extrabold text-amber-400">{mutedDisplayName}</span> on <span className="font-bold text-white font-mono">Seat {muteConfirmSeatIndex + 1}</span>?
                  </p>
                  <p className="text-[10px] text-gray-500 italic text-center">
                    They will be silenced until unmuted by a host.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl h-11 border-white/10 bg-white/5 font-black uppercase text-[10px] tracking-wider text-gray-300 hover:bg-white/10"
                    onClick={() => setMuteConfirmSeatIndex(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 rounded-xl h-11 bg-[#F59E0B] hover:bg-amber-500 font-black uppercase text-[10px] tracking-wider text-black font-extrabold shadow-lg shadow-amber-500/10 border-none"
                    onClick={async () => {
                      const idx = muteConfirmSeatIndex;
                      setMuteConfirmSeatIndex(null);
                      await muteSeat(idx, true);
                    }}
                  >
                    Mute Member
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Emoji Panel */}
      <AnimatePresence>
        {showEmojiPanel && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-[250] bg-[#1A1D24]/95 backdrop-blur-2xl rounded-t-[40px] p-8 border-t border-white/10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Express Yourself</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowEmojiPanel(false)}>
                <X size={24} />
              </Button>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-4 max-h-[320px] overflow-y-auto no-scrollbar py-2">
              {EMOJIS.map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => sendEmoji(emoji)}
                  className="text-3xl sm:text-4xl hover:scale-125 transition-all duration-200 active:scale-95 p-1 flex items-center justify-center cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Panel */}
      <AnimatePresence>
        {showGiftPanel && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-[250] bg-[#0E121E]/95 backdrop-blur-2xl rounded-t-[40px] p-6 pb-8 border-t border-white/10 shadow-3xl text-white max-h-[85vh] overflow-y-auto flex flex-col"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent flex items-center gap-1.5 animate-pulse">
                  <Gift size={18} className="text-yellow-400" /> Send Premium Gift
                </h3>
                <p className="text-xs text-gray-400 font-extrabold flex items-center gap-1 mt-0.5">
                  <Coins size={12} className="text-yellow-400 animate-bounce" /> Balance: {(userProfile?.coins || 0).toLocaleString()} Coins
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowGiftPanel(false)} className="rounded-full bg-white/5 border border-white/10 text-white">
                <X size={20} />
              </Button>
            </div>

            {/* Horizontal Categories Row */}
            <div className="flex bg-[#141A2E] p-1 rounded-xl gap-0.5 mb-4 border border-white/5 overflow-x-auto no-scrollbar">
              {(['Popular', 'Love', 'Vehicles', 'Fantasy', 'Status'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setRoomGiftCategory(cat)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer px-3 whitespace-nowrap ${
                    roomGiftCategory === cat 
                      ? 'bg-yellow-500 text-[#090B11] shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable grid container */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
              {GIFTS.filter(g => g.category === roomGiftCategory).map(gift => (
                <button 
                  key={gift.id}
                  onClick={() => sendGift(gift)}
                  className="flex flex-col items-center bg-[#13192B]/80 border border-white/5 hover:border-white/15 p-3.5 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 group relative"
                >
                  <span className="text-3xl mb-1.5 group-hover:scale-115 transition-transform">{gift.icon}</span>
                  <span className="text-[10px] font-extrabold text-white truncate w-full text-center leading-tight">{gift.name}</span>
                  <span className="text-[9px] font-black text-yellow-400 mt-1 flex items-center gap-0.5"><Coins size={9} />{gift.price}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] text-gray-500">
              <span>* Receiving gifts rewards active speakers with exchangeable diamonds.</span>
              <span onClick={() => { setShowGiftPanel(false); navigate('/wallet'); }} className="text-yellow-400 font-black cursor-pointer hover:underline uppercase">Top Up Wallet</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel (Enhanced Dashboard from video) */}
      <AnimatePresence>
        {showSettingsPanel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setShowSettingsPanel(false)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-sm bg-[#1A1D24] rounded-t-[40px] p-6 border-t border-white/10 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center mb-4">
                 <div className="w-12 h-1 bg-white/10 rounded-full" />
              </div>
              
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden">
                       <img src={room.thumbnailUrl || getPremiumRoomCover(room.id)} alt="room" />
                    </div>
                    <div>
                       <div className="flex items-center gap-1.5">
                          <h3 className="font-black text-sm tracking-tight">{room.title}</h3>
                          <button onClick={() => { changeRoomDP(); setShowSettingsPanel(false); }} className="text-white/40 hover:text-[#FF4D67]">
                            <Pencil size={12} />
                          </button>
                       </div>
                       <p className="text-[10px] text-gray-400 font-bold">Room ID: {room.id?.slice(0, 8)}</p>
                    </div>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => setShowSettingsPanel(false)} className="rounded-full">
                    <X size={20} />
                 </Button>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 mb-6">
                 <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1.5">Room Description</p>
                 <p className="text-[11px] font-bold text-white/70 leading-relaxed italic">
                   {room.description || "Welcome to the party! Be respectful and have fun! 🥂✨"}
                 </p>
              </div>

              {/* Action Grid */}
              <div className="space-y-3">
                 <button 
                   onClick={() => { shareRoom(); setShowSettingsPanel(false); }}
                   className="flex items-center justify-between w-full h-14 px-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
                 >
                    <span className="text-[11px] font-black uppercase tracking-tight text-white/70 italic">Share Room invitation</span>
                    <Share2 size={16} className="text-blue-500" />
                 </button>
                 <button 
                  onClick={() => { reportRoom(); setShowSettingsPanel(false); }}
                  className="flex items-center justify-between w-full h-14 px-5 bg-white/5 rounded-2xl border border-white/10 hover:bg-[#FF4D67]/10 hover:border-[#FF4D67]/40 transition-colors"
                 >
                    <span className="text-[11px] font-black uppercase tracking-tight text-white/70 italic">Report Room issues</span>
                    <ShieldAlert size={16} className="text-red-500" />
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="px-5 py-4 bg-gradient-to-t from-[#0B0E14] to-transparent relative z-20 shrink-0">
        <div className="flex items-center gap-4">
          {/* Input Toggle */}
          <div className="flex-1 relative flex items-center bg-white/5 border border-white/10 rounded-full px-4 h-12">
            <div className="mr-2 text-white/50">
              <Pencil size={16} />
            </div>
            <Input 
              ref={chatInputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Say something..." 
              className="bg-transparent border-none h-full text-xs font-bold placeholder:text-gray-500 focus-visible:ring-0 px-0 flex-1 text-white border-0 outline-none"
            />
            {inputText.trim() && (
              <button 
                onClick={sendMessage}
                className="bg-gradient-to-r from-teal-400 to-emerald-500 hover:scale-105 transition-all text-black p-1.5 rounded-full"
              >
                <Send size={12} className="stroke-[3]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowEmojiPanel(true)}
              className="text-white/60 hover:text-white transition-colors"
              title="Express Emoji"
            >
              <Smile size={24} />
            </button>
            <button 
              onClick={toggleMic} 
              className={`${isMuted ? 'text-white/40' : 'text-[#26D97E]'} hover:scale-110 active:scale-95 transition-all`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button 
              onClick={() => chatInputRef.current?.focus()}
              className="text-white/60 hover:text-white hover:scale-110 active:scale-95 transition-all"
              title="Focus Chat Input"
            >
              <MessageSquare size={24} />
            </button>
            <button 
              onClick={() => setShowMusicPlayerPanel(true)}
              className={`${isPlayingMusic ? 'text-pink-400 animate-spin [animation-duration:6s]' : 'text-white/60 hover:text-white'} hover:scale-110 active:scale-95 transition-all`}
              title="Symphony Soundtrack Player"
            >
              <Volume2 size={24} />
            </button>
            <button 
              onClick={() => setShowGameCenterPanel(true)}
              className={`${showGameCenterPanel || isSpinGameActive ? 'text-amber-400 animate-pulse' : 'text-white/60 hover:text-white'} hover:scale-110 active:scale-95 transition-all`}
              title="Interactive Game Center"
            >
              <Gamepad2 size={24} />
            </button>
            <button 
              onClick={() => canManage && setShowSettingsPanel(true)}
              className="text-white/60 hover:text-white transition-colors"
              title="Room Actions"
            >
              <LayoutGrid size={24} />
            </button>
            <button 
              onClick={() => setShowGiftPanel(true)} 
              className="p-0.5 rounded-full bg-gradient-to-tr from-[#8E2DE2] to-[#4A00E0] shadow-glow hover:scale-110 active:scale-95 transition-all"
              title="Send Gift"
            >
              <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-full">
                <Gift size={20} className="text-white" />
              </div>
            </button>
          </div>
        </div>
      </footer>

      {/* Luxury Room Music Player Panel (Fully authorative & persistent) */}
      <AnimatePresence>
        {showMusicPlayerPanel && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-[250] bg-[#0E121E]/95 backdrop-blur-2xl rounded-t-[40px] p-6 pb-8 border-t border-white/10 shadow-3xl text-white max-h-[85vh] overflow-y-auto flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-1.5">
                  🎵 Room Symphony Player
                </h3>
                <p className="text-xs text-gray-400 font-bold">Manage high-fidelity backing track broadcast</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowMusicPlayerPanel(false)} className="rounded-full bg-white/5 border border-white/10 text-white">
                <X size={20} />
              </Button>
            </div>

            {/* Simulated CD Player Visualizer */}
            <div className="flex flex-col items-center bg-[#13192B]/80 border border-white/5 p-6 rounded-[32px] mb-6 shadow-inner text-center">
              <div className="relative mb-4">
                {/* Vinyl Record Visual */}
                <motion.div 
                  animate={isPlayingMusic ? { rotate: 360 } : {}}
                  transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                  className="w-32 h-32 rounded-full bg-gradient-to-tr from-pink-600 via-indigo-950 to-purple-600 flex items-center justify-center shadow-2xl relative border-4 border-[#07090F]"
                >
                  <div className="w-10 h-10 rounded-full bg-[#13192B] border-4 border-black flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-pulse" />
                  </div>
                </motion.div>
                {/* Music Note Badge */}
                <div className="absolute -bottom-1 -right-1 bg-pink-500 rounded-full p-2 border border-black animate-bounce shadow-lg">
                  <Volume2 size={14} className="text-black" />
                </div>
              </div>

              <h4 className="text-sm font-black text-white/95 truncate w-full max-w-xs">{playlist[currentTrackIndex]?.name || 'No Track Loaded'}</h4>
              <p className="text-[10px] text-pink-400 font-black tracking-widest uppercase mt-1">
                {isPlayingMusic ? 'BROADCAST ACTIVE' : 'LOBBY PAUSED'}
              </p>

              {/* Progress Bar slider info */}
              <div className="w-full mt-4">
                <div className="h-1 bg-white/10 rounded-full w-full overflow-hidden relative">
                  <div className="bg-pink-505 h-full transition-all" style={{ width: `${musicProgress}%`, backgroundColor: '#ec4899' }} />
                </div>
                <div className="flex justify-between items-center text-[9px] text-gray-400 font-extrabold mt-2 px-1">
                  <span>{trackCurrentTime}</span>
                  <span>{trackDuration}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-5 mt-4">
                {/* Shuffle Button */}
                <button 
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`transition-colors active:scale-95 ${isShuffle ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                  title="Shuffle Playlist"
                >
                  <Shuffle size={16} strokeWidth={2.5} />
                </button>

                {/* Previous Button */}
                <button 
                  onClick={() => {
                    const prevIdx = (currentTrackIndex - 1 + playlist.length) % playlist.length;
                    setCurrentTrackIndex(prevIdx);
                    setIsPlayingMusic(true);
                    syncMusicToFirebase(true, prevIdx, 0);
                  }}
                  className="text-gray-400 hover:text-white transition-colors active:scale-90"
                  title="Previous Track"
                >
                  <ChevronLeft size={24} />
                </button>
                
                {/* Play / Pause Toggle Button */}
                <button 
                  onClick={() => {
                    const newState = !isPlayingMusic;
                    setIsPlayingMusic(newState);
                    syncMusicToFirebase(newState, currentTrackIndex);
                  }}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shadow-pink-500/20"
                  title={isPlayingMusic ? "Pause" : "Play"}
                >
                  {isPlayingMusic ? <Pause size={20} className="text-black stroke-[3]" /> : <Play size={20} className="text-black fill-black ml-1" />}
                </button>

                {/* Next Button */}
                <button 
                  onClick={() => {
                    const nextIdx = (currentTrackIndex + 1) % playlist.length;
                    setCurrentTrackIndex(nextIdx);
                    setIsPlayingMusic(true);
                    syncMusicToFirebase(true, nextIdx, 0);
                  }}
                  className="text-gray-400 hover:text-white transition-colors active:scale-90"
                  title="Next Track"
                >
                  <ChevronRight size={24} />
                </button>

                {/* Repeat Button */}
                <button 
                  onClick={() => {
                    setRepeatMode(prev => {
                      if (prev === 'none') return 'all';
                      if (prev === 'all') return 'one';
                      return 'none';
                    });
                  }}
                  className={`transition-colors active:scale-95 text-xs flex items-center gap-0.5 relative ${repeatMode !== 'none' ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                  title={`Repeat: ${repeatMode}`}
                >
                  <Repeat size={16} strokeWidth={2.5} />
                  {repeatMode === 'one' && <span className="absolute -top-1.5 -right-1 text-[8px] bg-pink-500 text-black px-0.5 rounded-full leading-none font-black scale-75">1</span>}
                </button>
              </div>

              {/* Volume Slider controls */}
              <div className="w-full mt-6 flex items-center gap-3 bg-black/20 p-2.5 rounded-2xl border border-white/5">
                <Volume2 size={14} className="text-pink-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <span className="text-[10px] font-mono text-gray-400 w-8">{Math.round(musicVolume * 100)}%</span>
              </div>
            </div>

            {/* Playlist Queue Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black tracking-widest text-[#FFD700] uppercase">Symphony Soundtrack Queue</p>
                {canManage && (
                  <label className="text-[9px] font-black text-pink-400 hover:text-pink-300 uppercase cursor-pointer tracking-wider flex items-center gap-1 active:scale-95 transition-transform">
                    <Plus size={10} /> Add Audio Files
                    <input 
                      type="file" 
                      accept="audio/*" 
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        const toastId = toast.loading(`Uploading ${files.length} audio backing tracks...`);
                        try {
                          const uploadedTracks = [];
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const dataUrl = await new Promise<string>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = (evt) => resolve(evt.target?.result as string);
                              reader.onerror = (err) => reject(err);
                              reader.readAsDataURL(file);
                            });
                            const newTrack = {
                              id: `custom_${Date.now()}_${i}`,
                              name: file.name.replace(/\.[^/.]+$/, ""),
                              url: dataUrl,
                              isCustom: true
                            };
                            await saveTrackToDB(newTrack);
                            uploadedTracks.push(newTrack);
                          }
                          setPlaylist(prev => [...prev, ...uploadedTracks]);
                          toast.success(`Successfully uploaded ${files.length} track(s)! 🎵✨`, { id: toastId });
                        } catch (err) {
                          console.error("Multi upload failed: ", err);
                          toast.error(`Audio storage failed`, { id: toastId });
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 no-scrollbar block">
                {playlist.map((track, idx) => (
                  <div 
                    key={track.id}
                    onClick={() => {
                      setCurrentTrackIndex(idx);
                      setIsPlayingMusic(true);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      currentTrackIndex === idx 
                        ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/40' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] font-mono ${currentTrackIndex === idx ? 'text-pink-400 font-black' : 'text-gray-500'}`}>
                        {idx + 1 < 10 ? '0' : ''}{idx + 1}
                      </span>
                      <p className={`text-xs truncate font-black ${currentTrackIndex === idx ? 'text-pink-300' : 'text-gray-300'}`}>
                        {track.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {track.isCustom && canManage && (
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            const backupPlaylist = playlist.filter(t => t.id !== track.id);
                            setPlaylist(backupPlaylist);
                            try {
                              await deleteTrackFromDB(track.id);
                            } catch (dbErr) {
                              console.error(dbErr);
                            }
                            if (currentTrackIndex >= idx) {
                              setCurrentTrackIndex(prev => Math.max(0, prev - 1));
                            }
                            toast.success(`Track removed from catalog`);
                          }}
                          className="p-1 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      
                      {currentTrackIndex === idx && isPlayingMusic ? (
                        <div className="flex gap-0.5 items-end h-3">
                          <div className="w-0.5 h-full bg-pink-400 rounded-full animate-[pulse_1s_infinite]"></div>
                          <div className="w-0.5 h-[60%] bg-pink-400 rounded-full animate-[pulse_1s_infinite_100ms]"></div>
                          <div className="w-0.5 h-full bg-pink-400 rounded-full animate-[pulse_1s_infinite_200ms]"></div>
                        </div>
                      ) : (
                        <Play size={12} className="text-gray-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Game Arcade Modal */}
      <AnimatePresence>
        {showGameCenterPanel && (
          <GameCenter
            isOpen={showGameCenterPanel}
            onClose={() => setShowGameCenterPanel(false)}
            onSpinActiveChange={(active) => setIsSpinGameActive(active)}
            currentUser={currentUser}
            soundEffectsEnabled={soundEffectsEnabled}
          />
        )}
      </AnimatePresence>

      {/* Premium Luxury Overlay Modal Sheets */}

      {/* User Profile Preview Overlay */}
      {activePreviewUid && (
        <UserProfilePreview
          userId={activePreviewUid}
          onClose={() => setActivePreviewUid(null)}
          canManage={canManage}
          onKick={async () => {
            const seatIdx = room.seats.findIndex(s => s.uid === activePreviewUid);
            if (seatIdx !== -1) {
              setKickConfirmSeatIndex(seatIdx);
            }
            setActivePreviewUid(null);
          }}
          onMuteToggle={async () => {
            const seatIdx = room.seats.findIndex(s => s.uid === activePreviewUid);
            if (seatIdx !== -1) {
              await muteSeat(seatIdx);
            }
          }}
          isMutedOnSeat={room.seats.some(s => s.uid === activePreviewUid && s.isMuted)}
          onPromoteSuperAdmin={async () => {
            await promoteToSuperAdmin(activePreviewUid);
          }}
          isSuperAdmin={getIsSuperAdmin(activePreviewUid)}
          onPromoteAdmin={async () => {
            await promoteToAdmin(activePreviewUid);
          }}
          isAdmin={getIsAdmin(activePreviewUid)}
          onDirectGift={() => {
            setShowGiftPanel(true);
          }}
          isChatBanned={room.chatBannedUserIds?.includes(activePreviewUid)}
          onChatBanToggle={async () => {
            await toggleChatBan(activePreviewUid);
          }}
          isRoomBanned={room.bannedUserIds?.includes(activePreviewUid)}
          onRoomBannedToggle={async () => {
            await toggleRoomBan(activePreviewUid);
          }}
          viewerIsOwner={isHost}
          viewerIsSuperAdmin={isSuperAdmin}
          viewerIsAdmin={isAdmin}
          roomHostId={room.hostId}
        />
      )}

      {/* PIN Edit Modal */}
      {showPinEditModal && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 w-full max-w-sm rounded-[32px] p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black uppercase text-yellow-500 tracking-wider">Update Pin Message</span>
              <button onClick={() => setShowPinEditModal(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <Input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter pinned update text..."
              className="bg-white/5 border-white/10 h-10 select-all"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPinEditModal(false)} className="flex-1 rounded-full border-white/5 bg-white/5 font-bold">Discard</Button>
              <Button onClick={() => updatePinnedMessage(pinInput)} className="flex-1 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold">Pin 📌</Button>
            </div>
          </div>
        </div>
      )}

      {/* Room statistics & live VIP analytics info */}
      {showStatsModal && (
        <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12141C] border border-white/10 w-full max-w-md rounded-[32px] p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="text-yellow-400 stroke-[2.5]" size={18} />
                <span className="font-sans font-black text-sm uppercase tracking-widest text-[#FFD700]">Room VIP Stats</span>
              </div>
              <button onClick={() => setShowStatsModal(false)} className="text-white/40 hover:text-white bg-white/5 p-1 rounded-full">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-white/45 tracking-wider">Gifts Received</p>
                <p className="text-2xl font-black text-yellow-500 font-mono mt-1">12,450 💎</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-white/45 tracking-wider">Total Members</p>
                <p className="text-2xl font-black text-[#26D97E] font-mono mt-1">{members.length} Users</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center col-span-2">
                <p className="text-[10px] uppercase font-bold text-white/45 tracking-wider">Active Party Time</p>
                <p className="text-3xl font-black text-purple-400 font-mono mt-1">{roomTimer}</p>
              </div>
            </div>
            <div className="bg-indigo-950/20 border border-indigo-500/15 rounded-2xl p-4">
              <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <ShieldAlert size={12} fill="indigo" className="text-indigo-400" /> Room Rules
              </p>
              <p className="text-[10px] text-white/70 leading-relaxed font-bold">
                1. Be respectful to hosts, moderators, and callers.<br />
                2. No spamming reactions or unrequested audio broadcasts.<br />
                3. Enjoy premium luxury party battles! 🥂✨
              </p>
            </div>
            <Button onClick={() => setShowStatsModal(false)} className="w-full h-11 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 font-bold hover:opacity-90">Close</Button>
          </div>
        </div>
      )}

      {/* Daily Missions & Streak System Modal */}
      {showStreakModal && (
        <div className="fixed inset-0 z-[450] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121420] border border-white/10 w-full max-w-md rounded-[32px] p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Flame className="text-orange-500 animate-bounce" size={20} />
                <span className="font-sans font-black text-sm uppercase tracking-widest text-orange-400">Daily Missions & Streaks</span>
              </div>
              <button 
                onClick={() => setShowStreakModal(false)} 
                className="text-white/40 hover:text-white bg-white/5 p-1 rounded-full transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Subtitle / Explanation */}
            <p className="text-xs text-gray-400 leading-relaxed">
              Maintain consecutive daily login streaks to earn massive **XP & Coin Multipliers**! Complete daily voice missions to maximize rewards.
            </p>

            {/* Streak Progress Row (7 Days) */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2.5xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">7-Day Check-in Streak Tracker</span>
                <span className="text-[10px] font-black text-orange-400 font-mono">
                  {getStreakMultiplier(userProfile?.dailyLoginStreak || 1).toFixed(1)}x Current Multiplier
                </span>
              </div>
              
              <div className="grid grid-cols-7 gap-1.5 pt-2">
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  const currentStreak = userProfile?.dailyLoginStreak || 1;
                  const isPassed = dayNum <= currentStreak;
                  const isCurrent = dayNum === currentStreak;
                  const mult = getStreakMultiplier(dayNum);

                  return (
                    <div 
                      key={`chk-${dayNum}`}
                      className={`flex flex-col items-center justify-between py-2.5 rounded-xl border transition-all ${
                        isCurrent 
                          ? 'bg-orange-500/20 border-orange-500 shadow-md shadow-orange-500/10' 
                          : isPassed 
                            ? 'bg-orange-500/10 border-orange-500/20 text-orange-300' 
                            : 'bg-white/5 border-white/5 text-slate-500'
                      }`}
                    >
                      <span className="text-[8px] font-black uppercase">Day {dayNum}</span>
                      <div className="my-1.5">
                        {isPassed ? (
                          <Check size={12} className="text-orange-400 stroke-[3]" />
                        ) : (
                          <Flame size={12} className="opacity-25" />
                        )}
                      </div>
                      <span className="text-[7.5px] font-mono font-black">{mult.toFixed(1)}x</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Missions List */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Today's Voice Lounge Missions</span>
              
              {/* Mission 1: Consecutive Check-In Reward */}
              <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
                  <Coins size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white/90">Daily Check-In Streak Reward</p>
                  <p className="text-[9px] text-orange-400 font-black mt-0.5 uppercase tracking-wide">
                    +{Math.floor(30 * getStreakMultiplier(userProfile?.dailyLoginStreak || 1))} Coins &amp; +{Math.floor(40 * getStreakMultiplier(userProfile?.dailyLoginStreak || 1))} XP
                  </p>
                </div>
                <div className="bg-teal-500/20 border border-teal-500/30 px-2 py-1 rounded-lg">
                  <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest">CLAIMED</span>
                </div>
              </div>

              {/* Mission 2: Live Voice Room Activity */}
              <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Mic size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white/90">Voice Seat Inhabitant Mission</p>
                    <p className="text-[9px] text-gray-400 leading-relaxed font-bold mt-0.5">Stay active inside voice seat for at least 2 minutes (120s)</p>
                  </div>
                  {voiceMissionClaimedToday ? (
                    <div className="bg-teal-500/20 border border-teal-500/30 px-2 py-1 rounded-lg self-center">
                      <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest">CLAIMED</span>
                    </div>
                  ) : voiceActivitySeconds >= 120 ? (
                    <Button 
                      onClick={handleClaimVoiceActivityReward}
                      size="sm"
                      className="bg-gradient-to-r from-orange-500 to-amber-600 text-black font-extrabold px-3 py-1.5 h-auto text-[9px] rounded-lg uppercase shadow-lg shadow-orange-500/20 antialiased"
                    >
                      Claim
                    </Button>
                  ) : (
                    <div className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ACTIVE</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                    <span>Progress Meter ({Math.min(100, Math.floor((voiceActivitySeconds / 120) * 100))}%)</span>
                    <span>{Math.min(voiceActivitySeconds, 120)}s / 120s</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        voiceActivitySeconds >= 120 
                          ? 'bg-gradient-to-r from-[#26D97E] to-teal-400' 
                          : 'bg-gradient-to-r from-purple-500 to-pink-500'
                      }`}
                      style={{ width: `${Math.min(100, (voiceActivitySeconds / 120) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center bg-purple-950/25 border border-purple-900/40 p-2 rounded-xl text-[9px] font-bold text-purple-300 leading-snug">
                  <span>Base Mission Value: 100 Coins &amp; 150 XP. With your multiplier, claim up to: {Math.floor(100 * getStreakMultiplier(userProfile?.dailyLoginStreak || 1))} Coins &amp; {Math.floor(150 * getStreakMultiplier(userProfile?.dailyLoginStreak || 1))} XP! 🔥</span>
                </div>
              </div>
            </div>

            {/* Simulated Debug Multipliers */}
            <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
              <button 
                type="button"
                onClick={simulateNextDayStreak}
                className="w-full py-2.5 rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 text-orange-400 font-bold hover:bg-orange-500/10 text-[9px] uppercase tracking-wide transition-all pointer-events-auto"
              >
                ⚡ Fast-Forward Streak +1 Day (Simulation Mode)
              </button>
              
              <Button 
                onClick={() => setShowStreakModal(false)}
                className="w-full h-11 rounded-xl bg-white/5 text-white/80 font-black text-[10px] uppercase tracking-wider hover:bg-white/10"
              >
                Close Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bandwidth Auto-Sleep Inactivity Countdown Danger Prompt */}
      {showAutoSleepDialog && (
        <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 select-none">
          <div className="bg-[#120D1E] border-2 border-rose-500/40 w-full max-w-sm rounded-[32px] p-6 space-y-6 shadow-[0_0_50px_rgba(239,68,68,0.25)] text-center animate-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-500 animate-bounce">
              <Clock size={24} />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-sans font-black text-md text-white uppercase tracking-wider">Lounge Auto-Sleep Alert</h3>
              <p className="text-xs text-rose-300 font-bold px-2 leading-relaxed">
                We detected no host microphone, chat activity, or media streams inside this room in the last 30 minutes. 
              </p>
            </div>

            {/* Big circular or bar countdown display to conserve backend bandwidth */}
            <div className="relative mx-auto w-24 h-24 bg-rose-500/10 rounded-full flex flex-col items-center justify-center border border-rose-500/30">
              <span className="text-3xl font-mono font-black text-rose-400">{autoSleepCountdown}</span>
              <span className="text-[8px] font-black text-rose-500 uppercase mt-0.5">SECONDS</span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">
              This dialog suspends and safely exits the room to conserve background bandwidth. Or extend to keep playing!
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button 
                onClick={handleLeaveRoom}
                className="py-3 px-4 rounded-xl border border-white/10 bg-white/5 uppercase font-black text-[10px] tracking-wide text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                Exit Now
              </button>
              <button 
                onClick={() => {
                  resetActivityTime();
                  setShowAutoSleepDialog(false);
                }}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 uppercase font-black text-[10px] tracking-wide text-black font-extrabold shadow-lg hover:scale-[1.01] transition-transform"
              >
                Extend Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Exit Room Options Confirmation Dialogue */}
      {showExitModal && (
        <div className="fixed inset-0 z-[500] bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-[#101424] border border-white/10 w-full max-w-sm rounded-[32px] p-6 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 select-none">
            <div className="text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                <Power size={22} className="stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-white/95">Exit Voice Room?</h3>
              <p className="text-xs text-gray-400 leading-relaxed max-w-xs mx-auto">
                Keep the room active in the background to continue listening, or close and leave the session completely.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Option A: Minimize / Background Playback */}
              <button
                onClick={() => {
                  setShowExitModal(false);
                  navigate('/');
                }}
                className="w-full h-11 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all shadow-md shadow-pink-500/10 cursor-pointer"
              >
                <span>Minimize Room</span>
              </button>

              {/* Option B: Leave Completely */}
              <button
                onClick={async () => {
                  setShowExitModal(false);
                  await handleLeaveRoom();
                }}
                className="w-full h-11 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
              >
                <span>Leave Completely</span>
              </button>

              {/* Cancel Button */}
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full h-10 rounded-full text-white/50 hover:text-white font-extrabold text-xs uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hand Raise List Waiting Queue */}
      {showHandRaisePanel && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowHandRaisePanel(false)}>
          <div className="w-full max-w-sm bg-[#12141C] border-t border-white/10 rounded-t-[40px] p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <UserPlus className="text-teal-400" size={18} />
                <span className="font-extrabold text-sm uppercase text-teal-400 tracking-wider">Wait Queue ({handRaises.length})</span>
              </div>
              <button onClick={() => setShowHandRaisePanel(false)} className="text-white/40 hover:text-white bg-white/5 p-1.5 rounded-full">
                <X size={16} />
              </button>
            </div>
            <ScrollArea className="h-60 pr-1 select-none">
              {handRaises.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-xs font-black uppercase">No active requests ✋</div>
              ) : (
                <div className="space-y-3">
                  {handRaises.map(hr => (
                    <div key={hr.id} className="flex items-center justify-between bg-white/5 border border-white/5 p-3 rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-9 h-9 border border-white/10">
                          <AvatarImage src={hr.photoURL || getPremiumAvatar(hr.uid)} />
                        </Avatar>
                        <p className="text-xs font-black truncate max-w-[130px]">{hr.displayName}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => rejectHandRaise(hr.uid)} 
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[10px] font-black h-8 px-2.5 rounded-full"
                        >
                          Dismiss
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => approveHandRaise(hr.uid, hr.displayName)} 
                          className="bg-[#26D97E] hover:bg-emerald-400 text-black text-[10px] font-black h-8 px-3 rounded-full"
                        >
                          Seat
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Top Supporters Panel */}
      {showSupportersPanel && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowSupportersPanel(false)}>
          <div className="w-full max-w-sm bg-[#12141C] border-t border-white/10 rounded-t-[40px] p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="text-[#FFD700]" size={18} />
                <span className="font-extrabold text-sm uppercase text-[#FFD700] tracking-wider">Top Supporters</span>
              </div>
              <button onClick={() => setShowSupportersPanel(false)} className="text-white/40 hover:text-white bg-white/5 p-1.5 rounded-full">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-yellow-400/5 border border-yellow-400/20 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-yellow-400">🥇</span>
                  <Avatar className="w-8 h-8 border border-yellow-400/30">
                    <AvatarImage src={getPremiumAvatar('VIP1')} />
                  </Avatar>
                  <span className="text-xs font-black">Alex King</span>
                </div>
                <span className="text-xs font-mono font-black text-yellow-500">55,200 Coins</span>
              </div>
              <div className="bg-slate-400/5 border border-slate-400/20 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-slate-300">🥈</span>
                  <Avatar className="w-8 h-8 border border-white/10">
                    <AvatarImage src={getPremiumAvatar('VIP2')} />
                  </Avatar>
                  <span className="text-xs font-black">Serene Voice</span>
                </div>
                <span className="text-xs font-mono font-black text-slate-300">32,100 Coins</span>
              </div>
              <div className="bg-amber-600/5 border border-amber-600/20 p-3 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-amber-500">🥉</span>
                  <Avatar className="w-8 h-8 border border-white/10">
                    <AvatarImage src={getPremiumAvatar('VIP3')} />
                  </Avatar>
                  <span className="text-xs font-black">CoinMaster PK</span>
                </div>
                <span className="text-xs font-mono font-black text-amber-500">18,500 Coins</span>
              </div>
            </div>
            <Button onClick={() => setShowSupportersPanel(false)} className="w-full h-11 rounded-full bg-[#1A1D24] text-white hover:bg-white/10 font-bold mt-2">Awesome</Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
