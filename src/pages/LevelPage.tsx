import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Trophy, Star, Sparkles, Check, Gift, ArrowUpRight, Award, Flame, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPremiumAvatar } from '@/utils/avatar';

interface RankedUser {
  rank: number;
  uid: string;
  displayName: string;
  level: number;
  photoURL?: string;
}

export default function LevelPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);
  const [rankings, setRankings] = useState<RankedUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Pull-to-refresh gesture states
  const [pullOffset, setPullOffset] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Experience progression rules: Level up threshold = level * 150 Experience points
  const currentLevel = profile?.level || 1;
  const currentXp = profile?.experience || 0;
  const xpNeeded = currentLevel * 150;
  const progressPercent = Math.min(100, Math.floor((currentXp / xpNeeded) * 100));

  // Milestone rewards list based on level
  const milestoneRewards = [
    { levelRequired: 2, coins: 50, claimedKey: 'reward_lvl_2_claimed' },
    { levelRequired: 5, coins: 150, claimedKey: 'reward_lvl_5_claimed' },
    { levelRequired: 10, coins: 400, claimedKey: 'reward_lvl_10_claimed' },
    { levelRequired: 15, coins: 1000, claimedKey: 'reward_lvl_15_claimed' }
  ];

  // Fetch real-time active user level rankings without Firestore index locks (Client Side Sorted)
  const fetchRankingsData = async (showToast = false) => {
    setRefreshing(true);
    try {
      const uSnap = await getDocs(query(collection(db, 'users'), limit(50)));
      const usersList = uSnap.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as any[];

      // Sort by level DESC
      usersList.sort((a, b) => (b.level || 0) - (a.level || 0));

      const ranked = usersList.slice(0, 10).map((u, idx) => ({
        rank: idx + 1,
        uid: u.uid,
        displayName: u.displayName || 'Anonymous Host',
        level: u.level || 1,
        photoURL: u.photoURL
      }));

      if (ranked.length === 0) {
        setRankings([
          { rank: 1, uid: 'sidd_test', displayName: 'Siddharth 👑', level: 12, photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop' },
          { rank: 2, uid: 'anya_test', displayName: 'Anya ✨', level: 5, photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop' },
          { rank: 3, uid: 'zara_dj', displayName: 'Zara 🎧', level: 4, photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop' }
        ]);
      } else {
        setRankings(ranked);
      }
      setSecondsToRefresh(60);
      if (showToast) {
        toast.success("Ranks updated!");
      }
    } catch (err) {
      console.warn("Could not load level ranking ladder", err);
      setRankings([
        { rank: 1, uid: 'sidd_test', displayName: 'Siddharth 👑', level: 12, photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop' },
        { rank: 2, uid: 'anya_test', displayName: 'Anya ✨', level: 5, photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop' },
        { rank: 3, uid: 'zara_dj', displayName: 'Zara 🎧', level: 4, photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop' }
      ]);
      if (showToast) {
        toast.error("Failed to fetch ranks");
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRankingsData(false);
  }, [profile]);

  // Handle auto refresh tick
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          fetchRankingsData(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Gestural pull mechanics
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      const offset = Math.min(80, diff * 0.45);
      setPullOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      setIsPulling(false);
      if (pullOffset >= 50) {
        fetchRankingsData(true);
      }
      setPullOffset(0);
    }
  };

  const hasClaimedMilestone = (key: string) => {
    return (profile as any)?.[key] === true;
  };

  const handleDailyCheckIn = async () => {
    if (!profile?.uid) return;
    
    const lastCheckIn = localStorage.getItem(`last_check_in_${profile.uid}`);
    const todayStr = new Date().toDateString();
    
    if (lastCheckIn === todayStr) {
      toast.info('You have already checked in today! Come back tomorrow for more rewards.');
      return;
    }

    setCheckingIn(true);
    try {
      const rewardCoins = 25;
      const gainedXp = 40;
      
      let nextXp = currentXp + gainedXp;
      let nextLevel = currentLevel;

      while (nextXp >= nextLevel * 150) {
        nextXp -= nextLevel * 150;
        nextLevel += 1;
        toast.success(`🎉 LEVEL UP! You reached level ${nextLevel}!`);
      }

      await updateDoc(doc(db, 'users', profile.uid), {
        coins: (profile.coins || 0) + rewardCoins,
        experience: nextXp,
        level: nextLevel
      });

      localStorage.setItem(`last_check_in_${profile.uid}`, todayStr);
      toast.success(`Check-in complete! Gained +${rewardCoins} Coins & +${gainedXp} XP!`);
    } catch (e) {
      console.error(e);
      toast.error('Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const claimMilestone = async (m: typeof milestoneRewards[0]) => {
    if (!profile?.uid) return;
    if (currentLevel < m.levelRequired) {
      toast.error(`You must reach Level ${m.levelRequired} to claim this milestone!`);
      return;
    }
    if (hasClaimedMilestone(m.claimedKey)) {
      toast.error('This milestone reward is already claimed!');
      return;
    }

    setClaimingMilestone(m.levelRequired);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        coins: (profile.coins || 0) + m.coins,
        [m.claimedKey]: true
      });
      toast.success(`Success! Claimed +${m.coins} Coins Level Milestone reward!`);
    } catch (e) {
      console.error(e);
      toast.error('Error claiming milestone reward.');
    } finally {
      setClaimingMilestone(null);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0C101A] text-white font-sans pb-32 relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sticky Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-[#0C101A]/80 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
            <ChevronLeft size={18} />
          </Button>
          <Trophy size={18} className="text-[#FFD700]" />
          <h1 className="text-sm font-black uppercase tracking-wider">ELITE PROGRESS</h1>
        </div>
      </div>

      {/* Dynamic Pull to Refresh Container */}
      <motion.div
        animate={{ height: pullOffset }}
        transition={{ type: "tween", duration: 0.15 }}
        className="overflow-hidden bg-purple-900/10 border-b border-white/5 w-full flex items-center justify-center text-xs font-black text-purple-400 gap-2 shrink-0"
        style={{ height: pullOffset }}
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        <span>
          {refreshing 
            ? "Syncing Rankings..." 
            : pullOffset >= 50 
              ? "Release to Sync ranks" 
              : "Pull down to refresh ranks"}
        </span>
      </motion.div>

      <div className="px-5 py-6 space-y-6">
        {/* Progress Card */}
        <div className="bg-gradient-to-br from-yellow-500/10 via-purple-600/10 to-[#0C101A] rounded-[28px] border border-yellow-500/20 p-6 relative overflow-hidden shadow-xl">
          <div className="absolute right-4 top-4 text-5xl opacity-5 font-bold select-none">🏆</div>
          
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-400/40 flex flex-col items-center justify-center shrink-0">
                <span className="text-[9px] uppercase font-black text-yellow-400">LV</span>
                <span className="text-xl font-black text-yellow-400 leading-none">{currentLevel}</span>
              </div>
              <div>
                <h3 className="font-black text-sm flex items-center gap-1">Broadcaster Level <Star size={12} className="text-yellow-400 fill-yellow-400" /></h3>
                <p className="text-[10px] text-gray-500">Earn XP on mic seats & via gifting, to boost social privileges.</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400 font-extrabold">{currentXp} / {xpNeeded} XP</span>
                <span className="text-yellow-400 font-black">{progressPercent}% COMPLETED</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Incentive Button */}
        <Button
          onClick={handleDailyCheckIn}
          disabled={checkingIn}
          className="w-full h-14 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest shadow-lg shadow-white/5 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-gray-100 border-none"
        >
          <Sparkles size={14} className="text-purple-600 animate-spin [animation-duration:12s]" />
          {checkingIn ? 'Checking In...' : 'CLAIM DAILY ATTENDANCE (+25 COINS)'}
        </Button>

        {/* Milestone Levels Section */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Level-Up Milestones</h3>

          <div className="space-y-2.5">
            {milestoneRewards.map((m) => {
              const claimed = hasClaimedMilestone(m.claimedKey);
              const eligible = currentLevel >= m.levelRequired;

              return (
                <div 
                  key={m.levelRequired}
                  className={`bg-white/5 border rounded-2xl p-4 flex gap-4 items-center justify-between transition-all ${
                    claimed ? 'border-white/5 opacity-60' : eligible ? 'border-yellow-400/40 bg-yellow-500/5' : 'border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/5 shrink-0">
                      <span className="text-[8px] uppercase text-gray-400 leading-none">LV</span>
                      <span className="text-base font-black leading-none">{m.levelRequired}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-zinc-100">Level {m.levelRequired} Bonus</h4>
                      <p className="text-[9px] text-yellow-400 flex items-center gap-1 mt-0.5 font-extrabold">
                        <Gift size={10} /> +{m.coins} Coins
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={claimingMilestone === m.levelRequired}
                    onClick={() => claimMilestone(m)}
                    className={`h-8 px-4 rounded-xl text-[9px] font-black uppercase border-none ${
                      claimed 
                        ? 'bg-white/5 text-gray-500 hover:bg-white/5 cursor-not-allowed' 
                        : eligible 
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-md' 
                          : 'bg-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {claimed ? 'Claimed' : 'Claim'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* COMPREHENSIVE LEVEL SPEED RANKINGS PROGRESSION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Award size={13} className="text-amber-500" /> ELITE LEVEL LADDER RUN
            </h3>
            <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500">
              <span>Auto-refresh in {secondsToRefresh}s</span>
              <button
                type="button"
                onClick={() => fetchRankingsData(true)}
                disabled={refreshing}
                className="p-1 rounded-md hover:bg-white/5 active:scale-90 transition-all text-gray-400 hover:text-white"
              >
                <RefreshCw size={11} className={refreshing ? "animate-spin text-pink-500" : ""} />
              </button>
            </div>
          </div>

          <div className="bg-[#121624] border border-white/5 rounded-2xl p-4 divide-y divide-white/5">
            {rankings.map((user) => (
              <div 
                key={user.uid} 
                onClick={() => navigate(`/profile/${user.uid}`)}
                className="flex items-center justify-between py-3 cursor-pointer group first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center">
                    {user.rank === 1 ? (
                      <span className="text-base">🥇</span>
                    ) : user.rank === 2 ? (
                      <span className="text-base">🥈</span>
                    ) : user.rank === 3 ? (
                      <span className="text-base">🥉</span>
                    ) : (
                      <span className="text-xs font-black text-gray-500">#{user.rank}</span>
                    )}
                  </div>

                  <Avatar className="w-8 h-8 border border-white/10">
                    <AvatarImage src={user.photoURL || getPremiumAvatar(user.uid)} />
                    <AvatarFallback className="bg-zinc-800 text-[10px] font-black">{user.displayName[0]}</AvatarFallback>
                  </Avatar>

                  <div>
                    <span className="text-xs font-black text-white group-hover:text-pink-400 transition-colors">{user.displayName}</span>
                    {user.uid === profile?.uid && (
                      <span className="text-[8px] bg-indigo-500/20 text-indigo-400 font-black px-1.5 py-0.5 rounded ml-1.5 uppercase">You</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Flame size={12} className="text-red-500" />
                  <span className="text-[10px] font-black text-red-400">LV {user.level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Learn Board rules */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-purple-400">Growth Rules</h4>
          <p className="text-[10px] leading-relaxed text-gray-400 font-medium">Keep mic active in any audio channel to gain XP automatically. Higher Levels unlock exclusive storefront badges, aristocrat entrance signals, and private-party creation permissions.</p>
        </div>
      </div>
    </div>
  );
}
