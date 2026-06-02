import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, doc, getDoc, updateDoc, where, getDocs, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Calendar, Sparkles, Clock, MapPin, UserCheck, Plus, Check, Award, Gift, Star } from 'lucide-react';
import { toast } from 'sonner';

interface PartyEvent {
  id: string;
  title: string;
  description: string;
  hostName: string;
  hostId: string;
  createdAt: string;
  scheduledTime: string;
  roomId: string;
  joinedCount: number;
  attendedIds?: string[];
  category?: 'Daily' | 'Weekly' | 'Seasonal' | 'Ranking';
}

export default function EventCenterPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs filters
  const [activeTab, setActiveTab] = useState<'Daily' | 'Weekly' | 'Seasonal' | 'Ranking'>('Weekly');
  
  // Schedule form state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [targetRoomId, setTargetRoomId] = useState('');
  const [scheduling, setScheduling] = useState(false);

  // Daily Tasks state indicators
  const [dailyMicTimer, setDailyMicTimer] = useState(false);
  const [dailyGiftClaimed, setDailyGiftClaimed] = useState(false);

  useEffect(() => {
    // Read and listen to room events
    const q = query(
      collection(db, 'room_events'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const unsub = safeOnSnapshot(q, (snapshot) => {
      const evs: PartyEvent[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        evs.push({
          id: docSnap.id,
          title: d.title,
          description: d.description || '',
          hostName: d.hostName || 'Host',
          hostId: d.hostId,
          createdAt: d.createdAt,
          scheduledTime: d.scheduledTime,
          roomId: d.roomId,
          joinedCount: d.joinedCount || 0,
          attendedIds: d.attendedIds || [],
          category: d.category || 'Weekly'
        });
      });
      setEvents(evs);
      setLoading(false);
    }, (err) => {
      console.warn("Offline or missing events index fallback:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Lazy-retrieves any valid room hosted by user or falls back to 'default'
  useEffect(() => {
    async function loadMyRoomId() {
      if (!profile?.uid) return;
      try {
        const cachedRoomId = localStorage.getItem(`persistent_room_${profile.uid}`);
        if (cachedRoomId) {
          setTargetRoomId(cachedRoomId);
          return;
        }

        const q = query(collection(db, 'rooms'), where('hostId', '==', profile.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setTargetRoomId(snap.docs[0].id);
        } else {
          setTargetRoomId('global_lounge');
        }
      } catch (e) {
        setTargetRoomId('global_lounge');
      }
    }
    loadMyRoomId();
  }, [profile]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !scheduledTime) {
      toast.error('Event title and schedule time are required!');
      return;
    }

    setScheduling(true);
    try {
      await addDoc(collection(db, 'room_events'), {
        title: title.trim(),
        description: description.trim(),
        hostName: profile.displayName,
        hostId: profile.uid,
        createdAt: new Date().toISOString(),
        scheduledTime: new Date(scheduledTime).toISOString(),
        roomId: targetRoomId || 'global_lounge',
        joinedCount: 1,
        attendedIds: [profile.uid],
        category: activeTab
      });

      toast.success('Dynamic party room event created under ' + activeTab + ' schedule!');
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setScheduledTime('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule party event.');
    } finally {
      setScheduling(false);
    }
  };

  const joinEventRoom = async (item: PartyEvent) => {
    if (!profile?.uid) return;
    try {
      const eventRef = doc(db, 'room_events', item.id);
      const hasJoined = item.attendedIds?.includes(profile.uid);
      
      if (!hasJoined) {
        const currentAttendedList = item.attendedIds || [];
        await updateDoc(eventRef, {
          attendedIds: [...currentAttendedList, profile.uid],
          joinedCount: (item.joinedCount || 0) + 1
        }).catch(() => {});
      }
      
      toast.success(`Entering Party: ${item.title}`);
      navigate(`/room/${item.roomId}`);
    } catch (e) {
      navigate(`/room/${item.roomId}`);
    }
  };

  // Perform automated claimed event participation rewards
  const claimReward = async (taskId: string, coinsVal: number) => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        coins: increment(coinsVal)
      });
      if (taskId === 'daily_mic') setDailyMicTimer(true);
      if (taskId === 'daily_gift') setDailyGiftClaimed(true);
      toast.success(`Success! Claimed +${coinsVal} Coins task reward! 🌟`);
    } catch (e) {
      toast.error('Failed to claim reward');
    }
  };

  // Filter events based on selected tab
  const filteredEvents = events.filter(e => e.category === activeTab);

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Sticky Header navbar */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-[#0C101A]/80 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
            <ChevronLeft size={18} />
          </Button>
          <Calendar size={18} className="text-pink-500" />
          <h1 className="text-sm font-black uppercase tracking-wider">EVENT CENTER</h1>
        </div>

        <Button 
          size="sm" 
          onClick={() => setShowCreate(!showCreate)} 
          className="h-8 rounded-xl text-[9px] font-black uppercase text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 px-3 border border-pink-500/20"
        >
          <Plus size={12} className="mr-1" /> Add Event
        </Button>
      </div>

      <div className="px-5 py-6 space-y-6">
        
        {/* Form to Plan/Schedule Event */}
        {showCreate && (
          <div className="bg-[#121624] border border-pink-500/20 p-5 rounded-[24px] space-y-4">
            <h3 className="text-xs font-black text-pink-400 flex items-center gap-2">
              <Sparkles size={14} /> Schedule New Live Party
            </h3>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs text-gray-300">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Party Title</label>
                <Input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Midnight Acoustics Session 🎧"
                  className="rounded-xl h-12 bg-white/5 border-white/10 font-bold focus-visible:ring-pink-500 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Event Description</label>
                <Input 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Gala coin prizes and mic time checks!"
                  className="rounded-xl h-12 bg-white/5 border-white/10 font-bold focus-visible:ring-pink-500 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Scheduled Date & Time</label>
                <Input 
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="rounded-xl h-12 bg-white/5 border-white/10 font-bold focus-visible:ring-pink-500 text-white"
                />
              </div>

              <Button 
                type="submit"
                disabled={scheduling}
                className="w-full h-12 bg-gradient-to-r from-pink-500 to-indigo-500 hover:from-pink-400 hover:to-indigo-400 text-white font-black uppercase text-xs rounded-xl shadow-md border-none"
              >
                {scheduling ? 'Scheduling...' : 'Announce Event Listing'}
              </Button>
            </form>
          </div>
        )}

        {/* Promo and Tracker summary */}
        <div className="bg-gradient-to-r from-pink-500/20 via-rose-600/10 to-transparent p-5 rounded-[28px] border border-pink-500/25 relative overflow-hidden">
          <div className="absolute right-0 top-0 text-7xl opacity-5 pointer-events-none select-none">🎸</div>
          <div className="relative z-10 space-y-1">
            <span className="flex items-center gap-1 text-[9px] font-black text-pink-400 uppercase tracking-wider"><Sparkles size={11} className="animate-spin [animation-duration:10s]" /> Dynamic Rewards Hub</span>
            <h2 className="text-base font-black text-white leading-tight">PARTICIPATION CHESTS</h2>
            <p className="text-[10px] text-gray-400 leading-relaxed max-w-[210px] mt-1.5">Earn VIP assets by completing daily micro-tasks right now.</p>
          </div>
        </div>

        {/* COMPREHENSIVE REWARDS & PARTICIPATION CHESTS TRACKER */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Participation Milestones</h3>
          
          <div className="space-y-2.5">
            {/* Task 1 */}
            <div className="bg-[#121624] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/15 flex items-center justify-center">
                  <Star size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-none">Complete 10 Mins seat time</h4>
                  <p className="font-extrabold text-[#FFE066] text-[9px] mt-1 uppercase">Gives +50 Coins bounty</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => claimReward('daily_mic', 50)}
                disabled={dailyMicTimer}
                className={`h-8 px-3 text-[9px] font-black uppercase rounded-lg border-none ${
                  dailyMicTimer 
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                    : 'bg-orange-500 hover:bg-orange-400 text-black shadow-md'
                }`}
              >
                {dailyMicTimer ? 'Claimed' : 'Claim'}
              </Button>
            </div>

            {/* Task 2 */}
            <div className="bg-[#121624] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/15 flex items-center justify-center">
                  <Gift size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-none">Send 1 Rose under any Gala</h4>
                  <p className="font-extrabold text-[#FFE066] text-[9px] mt-1 uppercase font-black">Gives +100 Coins chest</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => claimReward('daily_gift', 100)}
                disabled={dailyGiftClaimed}
                className={`h-8 px-3 text-[9px] font-black uppercase rounded-lg border-none ${
                  dailyGiftClaimed 
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed' 
                    : 'bg-[#FF4D67] hover:bg-[#FF8F9C] text-white shadow-md'
                }`}
              >
                {dailyGiftClaimed ? 'Claimed' : 'Claim'}
              </Button>
            </div>
          </div>
        </div>

        {/* Dynamic Categorized list Filter buttons */}
        <div className="space-y-4">
          <div className="flex border-b border-white/5 pb-0.5 overflow-x-auto no-scrollbar">
            {(['Daily', 'Weekly', 'Seasonal', 'Ranking'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 pb-2 text-xs font-black uppercase tracking-wider border-b-2 shrink-0 transition-all ${
                  activeTab === tab 
                    ? 'border-pink-500 text-pink-400' 
                    : 'border-transparent text-gray-500 hover:text-white'
                }`}
              >
                {tab} Events
              </button>
            ))}
          </div>

          {/* Categorized List of Active Events */}
          <div className="space-y-3.5">
            {loading ? (
              <div className="text-center text-xs text-gray-500 py-10">Searching dynamic events table...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center space-y-3">
                <Calendar size={28} className="text-gray-600 mx-auto" />
                <div>
                  <p className="font-extrabold text-xs text-white">No active {activeTab} schedule matches</p>
                  <p className="text-[9px] text-gray-550 mt-1 max-w-[200px] mx-auto">Create a custom voice rooms party list and select matching categorized tags on the flyers board!</p>
                </div>
              </div>
            ) : (
              filteredEvents.map(item => {
                const alreadyRegistered = item.attendedIds?.includes(profile?.uid || '');
                const formattedDate = new Date(item.scheduledTime).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={item.id}
                    className="bg-white/5 border border-white/5 rounded-2xl p-4.5 space-y-4 hover:border-pink-500/20 transition-all"
                  >
                    <div className="flex gap-4 items-start justify-between">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 px-2 py-0.5 rounded font-black tracking-widest inline-block select-none leading-none uppercase">
                          {item.category || 'Gala'}
                        </span>
                        <h4 className="font-black text-xs text-zinc-100 truncate">{item.title}</h4>
                        <p className="text-[10px] text-gray-500 leading-normal line-clamp-2">{item.description}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-pink-400 font-black">{formattedDate}</p>
                        <p className="text-[8px] text-gray-600 uppercase font-black tracking-tighter mt-1">Host: {item.hostName}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-4 bg-[#121624] px-4 py-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-extrabold">
                        <Clock size={11} />
                        <span>RSVP List: <b className="text-white">{item.joinedCount} active</b></span>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => joinEventRoom(item)}
                        className="h-8 rounded-xl text-[9px] bg-gradient-to-tr from-pink-500 to-indigo-500 hover:from-pink-400 hover:to-indigo-400 text-white font-black uppercase px-3 border-none shadow-md"
                      >
                        {alreadyRegistered ? (
                          <span className="flex items-center gap-0.5"><Check size={8} strokeWidth={3} /> ENTER</span>
                        ) : (
                          'RSVP & GO'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
