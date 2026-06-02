import { useAuth } from '@/hooks/useAuth';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { UserProfile } from '@/types';
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, getDoc, getDocs, limit, writeBatch, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, Send, Phone, Video, MoreHorizontal, Image as ImageIcon, Smile, Search, Sparkles, MessageSquare, Flame, CheckCheck, Users, CornerDownRight, Bell, Trash2, Calendar, Gift, ArrowUpRight, RefreshCw, ChevronDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { getPremiumAvatar } from '@/utils/avatar';
import { toast } from 'sonner';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any;
}

interface ConversationItem {
  userId: string;
  displayName: string;
  photoURL: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  isOnline: boolean;
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'follow' | 'gift' | 'mention' | 'invite' | 'event' | 'system';
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  roomId?: string;
  createdAt: string;
  read: boolean;
}

export const AI_DEMO_USERS = [
  {
    uid: 'anya_test',
    displayName: 'Anya ✨',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    level: 5,
    experience: 2500,
    coins: 1000,
    diamonds: 500,
    badges: ['Official Guide'],
    followersCount: 1540,
    followingCount: 320,
    visitorsCount: 890,
    isVIP: true,
    bio: 'Official Maxo Guide. Let\'s chat about live match rules and acoustic lounges! 💖',
    country: 'Global',
    lastLogin: new Date().toISOString()
  },
  {
    uid: 'cosmo_ai_test',
    displayName: 'Cosmo AI 🌌',
    photoURL: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=400&fit=crop',
    level: 9,
    experience: 9900,
    coins: 4300,
    diamonds: 200,
    badges: ['Astrologer', 'Vibe Matcher'],
    followersCount: 3200,
    followingCount: 1,
    visitorsCount: 4500,
    isVIP: true,
    bio: 'Aligning your audio vibration with the perfect matches. Tell me your sign! 🔮🪐',
    country: 'Cosmos',
    lastLogin: new Date().toISOString()
  },
  {
    uid: 'dj_echo_test',
    displayName: 'DJ Echo 🎧',
    photoURL: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop',
    level: 7,
    experience: 4800,
    coins: 1200,
    diamonds: 80,
    badges: ['Sound Curator', 'Music Master'],
    followersCount: 2100,
    followingCount: 50,
    visitorsCount: 3100,
    isVIP: false,
    bio: 'Sourcing the ultimate beats for your rooms. Rock & Roll or Lofi? Let me know! 🎸🎶',
    country: 'Ibiza',
    lastLogin: new Date().toISOString()
  },
  {
    uid: 'buddy_ai_test',
    displayName: 'Buddy AI 🤝',
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop',
    level: 2,
    experience: 500,
    coins: 200,
    diamonds: 5,
    badges: ['Lounge Friend'],
    followersCount: 340,
    followingCount: 80,
    visitorsCount: 150,
    isVIP: false,
    bio: 'Your default lobby companion. Just hanging out here. Let\'s share warm vibe check-ins! ☕🎤',
    country: 'Lounge Vibe',
    lastLogin: new Date().toISOString()
  }
];

export default function MessagesPage() {
  const { userId: recipientId } = useParams();
  const { profile: selfProfile } = useAuth();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [hasNewUnreadScrollPill, setHasNewUnreadScrollPill] = useState(false);

  // Switching tab
  const [activeSegment, setActiveSegment] = useState<'Chats' | 'Notifications'>('Chats');
  const [chatMode, setChatMode] = useState<'real' | 'ai'>('real');

  // Dashboard-specific states
  const [realUsers, setRealUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);

  // Pull-to-refresh gesture states
  const [pullOffset, setPullOffset] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic handshakes pull to refresh trigger
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !refreshing) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      const offset = Math.min(65, diff * 0.45);
      setPullOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      setIsPulling(false);
      if (pullOffset >= 45) {
        triggerRefreshMessages();
      } else {
        setPullOffset(0);
      }
    }
  };

  // Re-sync inbox messages, real/AI chats, alerts, and notifications lists asynchronously
  const triggerRefreshMessages = async () => {
    setRefreshing(true);
    setPullOffset(50);
    try {
      if (selfProfile) {
        // Query latest users list to rebuild active chat nodes
        const uSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        const usersList = uSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        const filtered = usersList.filter(u => u.uid !== selfProfile.uid);
        
        let lists: ConversationItem[] = [];
        filtered.forEach(c => {
          lists.push({
            userId: c.uid,
            displayName: c.displayName,
            photoURL: c.photoURL || getPremiumAvatar(c.uid),
            lastMessage: c.bio || 'Matched vibe checker! Start talking!',
            time: 'Just now',
            unread: false,
            isOnline: Math.random() > 0.4
          });
        });
        setConversations(lists);
      }
      toast.success("Inbox and notifications synced successfully!");
    } catch (e) {
      console.warn("Touch pull refresh warnings:", e);
      toast.success("Inbox synced!");
    } finally {
      setTimeout(() => {
        setRefreshing(false);
        setPullOffset(0);
      }, 700);
    }
  };

  // 1. Fetch recipient if chatting with a specific user
  useEffect(() => {
    if (!recipientId) {
      setRecipient(null);
      setLoading(false);
      return;
    }
    
    async function fetchRecipient() {
      setLoading(true);
      try {
        const foundAi = AI_DEMO_USERS.find(ai => ai.uid === recipientId);
        if (foundAi) {
          setRecipient(foundAi as any);
        } else {
          const snap = await getDoc(doc(db, 'users', recipientId!));
          if (snap.exists()) {
            setRecipient(snap.data() as UserProfile);
          } else {
            setRecipient(null);
          }
        }
      } catch (err) {
        console.warn("Offline or error fetching recipient profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecipient();
  }, [recipientId]);

  // 2. Fetch all real registered users for suggested/starter lists
  useEffect(() => {
    async function fetchAllUsers() {
      try {
        const q = query(collection(db, 'users'), limit(50));
        const snap = await getDocs(q);
        const users = snap.docs
          .map(doc => doc.data() as UserProfile)
          .filter(u => u.uid !== selfProfile?.uid);
        
        setRealUsers(users);

        // Prepopulate conversation list with registered users who have profiles
        const lists: ConversationItem[] = [];

        // Add other registered users found
        users.forEach((usr, idx) => {
          lists.push({
            userId: usr.uid,
            displayName: usr.displayName,
            photoURL: usr.photoURL || getPremiumAvatar(usr.uid),
            lastMessage: usr.bio || `Connect with me on Maxo audio panels! 🎤`,
            time: idx === 0 ? '5m ago' : '1h ago',
            unread: false,
            isOnline: Math.random() > 0.4
          });
        });

        setConversations(lists);
      } catch (err) {
        console.warn("Failed to fetch directory users", err);
      }
    }
    if (selfProfile) {
      fetchAllUsers();
    }
  }, [selfProfile]);

  // 3. Listen to Notifications
  useEffect(() => {
    if (!selfProfile) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetId', '==', selfProfile.uid),
      orderBy('createdAt', 'desc',),
      limit(40)
    );

    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const items: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
      });

      // Quick fallbacks to guarantee highly interactive visual guidelines
      if (items.length === 0) {
        setNotificationsList([
          {
            id: 'demo_n_1',
            title: 'Welcome to Maxo Elite 🌟',
            body: 'You have been added to our VIP program! Start checking out audio rooms and gain coins faster.',
            type: 'system',
            createdAt: new Date().toISOString(),
            read: false
          },
          {
            id: 'demo_n_2',
            title: 'Room Party Invitation 🎤',
            body: 'Anya ✨ has invited you to join "Acoustic Whispers KTV" lounge now!',
            type: 'invite',
            senderId: 'anya_test',
            senderName: 'Anya ✨',
            senderPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
            roomId: 'party_lounge_default',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            read: false
          }
        ]);
      } else {
        setNotificationsList(items);
      }
    }, (err) => {
      console.warn("Notifications real-time listener index wait fallback", err);
      // Fallback
      setNotificationsList([
        {
          id: 'demo_n_1',
          title: 'Welcome to Maxo Elite 🌟',
          body: 'You have been added to our VIP program! Start checking out audio rooms and gain coins faster.',
          type: 'system',
          createdAt: new Date().toISOString(),
          read: false
        }
      ]);
    });

    return () => unsubscribe();
  }, [selfProfile]);

  // 4. Sync messages for the active conversation with smooth anchoring
  useEffect(() => {
    if (!selfProfile || !recipientId) return;

    const chatId = [selfProfile.uid, recipientId].sort().join('_');
    const q = query(
      collection(db, 'private_chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      setMessages((prevMsgs) => {
        const isInitialLoad = prevMsgs.length === 0;
        const hasNewMessage = msgs.length > prevMsgs.length;

        if (hasNewMessage && !isInitialLoad) {
          const lastMsg = msgs[msgs.length - 1];
          const isFromMe = lastMsg.senderId === selfProfile.uid;

          if (isFromMe || isAtBottomRef.current) {
            // Smooth scroll to bottom immediately on our message, or if user is already at the bottom
            setTimeout(() => {
              if (messagesContainerRef.current) {
                messagesContainerRef.current.scrollTo({
                  top: messagesContainerRef.current.scrollHeight,
                  behavior: 'smooth'
                });
              }
            }, 50);
          } else {
            // User has scrolled up, show the unread badge to anchor them respectfully without jarring jumps
            setHasNewUnreadScrollPill(true);
          }
        } else if (isInitialLoad && msgs.length > 0) {
          // On absolute initial load, scroll instantly to bottom
          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }, 50);
        }

        return msgs;
      });
    }, (err) => {
      console.warn("Messages sync error, possibly offline", err);
    });

    return () => unsubscribe();
  }, [selfProfile, recipientId]);

  // Send message function
  const sendMessage = async () => {
    if (!newMessage.trim() || !selfProfile || !recipientId) return;

    const chatId = [selfProfile.uid, recipientId].sort().join('_');
    const textMsg = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        senderId: selfProfile.uid,
        text: textMsg,
        timestamp: serverTimestamp()
      });

      // Auto-reply simulation from Anya in case of developer testing
      if (recipientId === 'anya_test') {
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
              senderId: 'anya_test',
              text: `Thanks for messaging! I am fully synchronized in Maxo. Come say hi on the Live Radio and Audio Party rooms! 🎧💫`,
              timestamp: serverTimestamp()
            });
          } catch (e) {
            console.error("Auto-reply write failed", e);
          }
        }, 1500);
      } else if (recipientId === 'cosmo_ai_test') {
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
              senderId: 'cosmo_ai_test',
              text: `The stars indicate high vibing cosmic synergy! Tell me your zodiac sign, and let's match your acoustic aura to a perfect live voice panel. 🪐🔮`,
              timestamp: serverTimestamp()
            });
          } catch (e) {}
        }, 1500);
      } else if (recipientId === 'dj_echo_test') {
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
              senderId: 'dj_echo_test',
              text: `Yo! Drop the track specs – rock, synth, or chill lofi beats? Tell me your vibe and I'll match you to a room with active sound curation! 🎧🎸⚡`,
              timestamp: serverTimestamp()
            });
          } catch (e) {}
        }, 1500);
      } else if (recipientId === 'buddy_ai_test') {
        setTimeout(async () => {
          try {
            await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
              senderId: 'buddy_ai_test',
              text: `Hey buddy! Just chilling in the general lobby right now. Grab a mic, and let's check out some live audio panels together! ☕🎙️`,
              timestamp: serverTimestamp()
            });
          } catch (e) {}
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Automated notification handler (clear single and launch routing)
  const handleNotificationClick = async (item: AppNotification) => {
    try {
      // Clear notification
      if (!item.id.startsWith('demo_')) {
        await deleteDoc(doc(db, 'notifications', item.id));
      }
      
      if (item.type === 'follow' && item.senderId) {
        navigate(`/profile/${item.senderId}`);
      } else if (item.type === 'invite' && item.roomId) {
        toast.info('Joining Lounge Panel...');
        navigate(`/room/${item.roomId}`);
      } else if (item.type === 'gift') {
        navigate('/wallet');
      } else {
        toast.success('System Announcement Checked ✔');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const batchList = notificationsList.filter(n => !n.id.startsWith('demo_'));
      for (const item of batchList) {
        await deleteDoc(doc(db, 'notifications', item.id));
      }
      setNotificationsList([]);
      toast.success('Cleaned notification stack!');
    } catch (err) {
      toast.error('Clear failed');
    }
  };

  const realConversations = conversations.filter(c => 
    !c.userId.endsWith('_test') && 
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const aiConversations: ConversationItem[] = AI_DEMO_USERS.map(ai => ({
    userId: ai.uid,
    displayName: ai.displayName,
    photoURL: ai.photoURL,
    lastMessage: ai.bio,
    time: 'AI Companion',
    unread: true,
    isOnline: true
  })).filter(c => c.displayName.toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredConversations = chatMode === 'real' ? realConversations : aiConversations;

  // VIEW 1: Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C101A] flex flex-col items-center justify-center text-white pb-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-4" />
        <p className="text-xs font-black uppercase text-amber-500/80 tracking-widest leading-none">Loading Premium Chat Hub...</p>
      </div>
    );
  }

  // VIEW 2: Chat Detail Mode
  if (recipient) {
    return (
      <div className="flex flex-col h-screen bg-[#0C101A] text-white font-sans overflow-hidden">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-white/5 bg-[#0C101A]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-9 h-9">
              <ChevronLeft size={20} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10 border border-white/10">
                  <AvatarImage src={recipient.photoURL} className="object-cover" />
                  <AvatarFallback className="bg-zinc-800">{recipient.displayName[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0C101A] rounded-full shadow-sm" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white leading-tight flex items-center gap-1.5">
                  {recipient.displayName}
                  {recipient.isVIP && (
                    <span className="bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase">VIP</span>
                  )}
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Active Now</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border border-white/5 bg-white/5 rounded-full p-1 leading-none shrink-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/profile/${recipient.uid}`)} className="text-white hover:text-white rounded-full bg-white/5 w-8 h-8"><Users size={16} /></Button>
          </div>
        </header>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          onScroll={() => {
            const container = messagesContainerRef.current;
            if (!container) return;
            const isCloseToBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 100;
            isAtBottomRef.current = isCloseToBottom;
            if (isCloseToBottom) {
              setHasNewUnreadScrollPill(false);
            }
          }}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-hide relative"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-8 text-gray-500">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/30 mb-4 border border-white/5">
                <MessageSquare size={28} />
              </div>
              <p className="font-extrabold uppercase text-xs text-white/60 tracking-widest mb-1.5">No Messages Yet</p>
              <p className="text-[11px] leading-relaxed max-w-xs">Start the conversation by sending a warm message! Try sharing a voice room link or saying hello. 👋</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.senderId === selfProfile?.uid;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] px-4 py-3 rounded-[24px] text-sm font-medium ${
                    isMe 
                      ? 'bg-gradient-to-tr from-pink-500 to-indigo-600 text-white rounded-br-none shadow-lg shadow-pink-500/10 font-black' 
                      : 'bg-white/10 text-white rounded-bl-none border border-white/5'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={scrollRef} />

          {/* New Message Smooth Navigation Overlay Pill */}
          <AnimatePresence>
            {hasNewUnreadScrollPill && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={() => {
                  setHasNewUnreadScrollPill(false);
                  if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTo({
                      top: messagesContainerRef.current.scrollHeight,
                      behavior: 'smooth'
                    });
                  }
                }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-indigo-600 border border-white/20 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl shadow-pink-500/25 animate-bounce z-25 hover:scale-105 active:scale-95 transition-all text-xs"
              >
                New Messages <ChevronDown size={14} className="animate-pulse" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="px-4 pb-12 pt-4 border-t border-white/5 bg-[#0C101A]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 bg-white/5 rounded-[28px] p-1.5 pl-4 border border-white/10 group focus-within:border-pink-500/50 transition-all">
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white rounded-full shrink-0"><ImageIcon size={18} /></Button>
            <Input 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={`Message ${recipient.displayName}...`}
              className="border-none bg-transparent h-10 px-0 text-sm font-medium placeholder:text-gray-600 focus-visible:ring-0 text-white focus:outline-none"
            />
            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-white rounded-full shrink-0"><Smile size={18} /></Button>
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="w-10 h-10 rounded-full bg-pink-500 hover:bg-pink-400 text-white p-0 shrink-0 shadow-lg shadow-pink-500/20 disabled:opacity-50 transition-all"
            >
              <Send size={16} className="ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: Dashboard Mode (Chats or Real-time Notifications)
  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-[#0C101A] text-white font-sans pb-32 relative overflow-hidden"
    >
      {/* Premium Pull-Down Refresh Indicator */}
      <motion.div 
        style={{ height: pullOffset }}
        className="overflow-hidden flex items-center justify-center bg-zinc-950/40 border-b border-white/5 text-xs text-gray-400 gap-2 shrink-0 select-none"
        animate={{ height: pullOffset }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <motion.div 
          animate={{ rotate: refreshing || pullOffset >= 45 ? 360 : pullOffset * 6 }}
          transition={refreshing || pullOffset >= 45 ? { repeat: Infinity, duration: 1.2, ease: "linear" } : { duration: 0 }}
          className="flex items-center justify-center"
        >
          <RefreshCw size={14} className="text-pink-500 animate-pulse" />
        </motion.div>
        <span className="font-sans font-extrabold tracking-widest text-[9px] uppercase text-zinc-300">
          {refreshing ? "Synching Messages..." : pullOffset >= 45 ? "Release to Refresh" : "Swipe down to Refresh"}
        </span>
      </motion.div>

      {/* Header with Segment controller (Chats / Alerts) */}
      <header className="px-6 pt-12 pb-6 border-b border-white/5 bg-[#0C101A]/85 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex justify-between items-center mb-5">
          <div className="flex gap-4 select-none">
            <button 
              onClick={() => setActiveSegment('Chats')}
              className={`text-lg font-black transition-all uppercase tracking-wider flex items-center gap-2 cursor-pointer pb-1 relative ${
                activeSegment === 'Chats' ? 'text-white scale-102 font-extrabold' : 'text-gray-500 opacity-60 hover:opacity-100'
              }`}
            >
              Chats
              <span className="text-[9px] bg-[#FF4D67] text-white font-black px-1.5 py-0.5 rounded-full leading-none shadow-[0_0_8px_rgba(255,77,103,0.4)]">1</span>
              {activeSegment === 'Chats' && (
                <motion.div layoutId="msgSegmentInd" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full" />
              )}
            </button>
            <button 
              onClick={() => setActiveSegment('Notifications')}
              className={`text-lg font-black transition-all uppercase tracking-wider flex items-center gap-2 cursor-pointer pb-1 relative ${
                activeSegment === 'Notifications' ? 'text-white scale-102 font-extrabold' : 'text-gray-500 opacity-60 hover:opacity-100'
              }`}
            >
              Alerts
              <span className="text-[9px] bg-indigo-505 bg-indigo-500 text-white font-black px-1.5 py-0.5 rounded-full leading-none shadow-[0_0_8px_rgba(99,102,241,0.4)]">
                {notificationsList.length}
              </span>
              {activeSegment === 'Notifications' && (
                <motion.div layoutId="msgSegmentInd" className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full" />
              )}
            </button>
          </div>

          <Button 
            className="rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-black tracking-widest uppercase gap-1.5 px-3 h-8 text-gray-300"
            onClick={() => navigate('/')}
          >
            <ChevronLeft size={14} /> LOUNGE
          </Button>
        </div>

        {/* Real-time filters and buttons depending on segment */}
        {activeSegment === 'Chats' ? (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <Input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chat sessions..."
              className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border-white/5 focus:border-pink-500/30 rounded-2xl h-11 pl-11 text-xs font-bold text-white placeholder:text-gray-600 focus:outline-none"
            />
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest font-sans">Inbox notifications</span>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={clearAllNotifications}
              className="text-[10px] font-black text-red-400 hover:bg-red-500/10 h-7 rounded-lg"
            >
              <Trash2 size={12} className="mr-1" /> Clear All
            </Button>
          </div>
        )}
      </header>

      {/* SEGMENT 1: CHATS VIEW */}
      {activeSegment === 'Chats' && (
        <div className="space-y-6">
          {/* Suggested Partners horizontal scroll list */}
          <div className="pt-6 px-6">
            <h3 className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <Sparkles size={11} /> Suggested Audio hosts
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
              {filteredConversations.slice(0, 8).map(c => (
                <motion.div 
                  whileHover={{ scale: 1.05 }}
                  onClick={() => navigate(`/messages/${c.userId}`)}
                  key={c.userId} 
                  className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
                >
                  <div className="relative">
                    <div className={`p-0.5 rounded-full ${c.isOnline ? 'bg-gradient-to-tr from-[#FF4D67] to-indigo-500 p-0.5' : 'bg-white/10'}`}>
                      <div className="p-0.5 bg-[#0C101A] rounded-full font-sans">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={c.photoURL} className="object-cover" />
                          <AvatarFallback className="bg-zinc-805 text-[10px] font-bold">{c.displayName[0]}</AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    {c.isOnline && (
                      <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0C101A] rounded-full" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 truncate w-14 text-center">{c.displayName}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Conversations feed */}
          <div className="px-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Conversations</h3>
            </div>

            {/* Cleaned layout - only authentic user Conversations displayed */}

            <div className="space-y-3">
              {filteredConversations.length === 0 ? (
                <div id="no-chats-placeholder" className="flex flex-col items-center justify-center text-center py-16 px-6 bg-[#121624]/60 border border-white/5 rounded-[24px]">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-3">
                    <MessageSquare size={20} />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-300">No Messages Yet</h4>
                  <p className="text-[10px] text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                    {chatMode === 'real' 
                      ? 'No Messages Yet'
                      : 'No custom AI companions match your search terms.'}
                  </p>
                </div>
              ) : (
                filteredConversations.map((convo) => {
                  const isAiUser = convo.userId.endsWith('_test');
                  return (
                    <motion.div 
                      whileHover={{ x: 3 }}
                      onClick={() => navigate(`/messages/${convo.userId}`)}
                      key={convo.userId}
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer border transition-all ${
                        convo.unread 
                          ? 'bg-pink-500/5 hover:bg-pink-500/10 border-pink-500/20 shadow-md shadow-pink-500/5' 
                          : 'bg-[#121624] hover:bg-white/5 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative">
                          <Avatar className="w-11 h-11 border border-white/10">
                            <AvatarImage src={convo.photoURL} className="object-cover" />
                            <AvatarFallback className="bg-zinc-800 text-sm font-bold">{convo.displayName[0]}</AvatarFallback>
                          </Avatar>
                          {convo.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#0C101A] rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className={`text-xs font-black text-white leading-none ${convo.unread ? 'text-pink-400' : ''}`}>{convo.displayName}</h4>
                            {isAiUser && (
                              <span className="bg-gradient-to-r from-[#FF4D67] to-indigo-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded leading-none uppercase tracking-wider">AI Companion</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-1.5 leading-relaxed pr-2">
                            {convo.lastMessage}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        <span className="text-[9px] text-gray-600 font-extrabold uppercase">{convo.time}</span>
                        {convo.unread ? (
                          <span className="w-2 h-2 rounded-full bg-pink-500 shadow-md animate-pulse" />
                        ) : (
                          <CheckCheck size={11} className="text-gray-600" />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT 2: REAL-TIME NOTIFICATIONS VIEW */}
      {activeSegment === 'Notifications' && (
        <div className="px-6 py-6 space-y-4">
          <div className="space-y-3">
            {notificationsList.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className="bg-[#121624] border border-white/5 p-4 rounded-2xl flex items-start gap-3.5 cursor-pointer hover:border-indigo-500/20 hover:bg-white/5 transition-all group"
              >
                <div className="shrink-0 mt-0.5">
                  {notif.type === 'follow' ? (
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/15 flex items-center justify-center">
                      <Users size={16} />
                    </div>
                  ) : notif.type === 'gift' ? (
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/15 flex items-center justify-center">
                      <Gift size={16} />
                    </div>
                  ) : notif.type === 'invite' ? (
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/15 flex items-center justify-center">
                      <Bell size={16} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-xs font-black text-white leading-tight group-hover:text-indigo-400 transition-colors">{notif.title}</h4>
                    <span className="text-[8px] text-gray-600 font-extrabold uppercase shrink-0 mt-0.5">Alert</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-normal font-medium">{notif.body}</p>
                  
                  {notif.roomId && (
                    <div className="inline-flex items-center gap-1.5 bg-[#0C101A] px-2.5 py-1 rounded-lg border border-white/5 mt-1.5">
                      <span className="text-[8px] text-emerald-400 font-black uppercase">Enter Room</span>
                      <ArrowUpRight size={10} className="text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
