import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crown, Sparkles, Zap, ShieldCheck, Star, MessageCircle, 
  ChevronLeft, Check, Coins, ShieldAlert, Award, Gem, Shield, Plus 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const VIP_TIERS = [
  {
    id: 'vip_silver',
    name: 'SILVER MONARCH VIP',
    price: 1000,
    priceType: 'coins' as const,
    colorClass: 'from-slate-400 via-zinc-500 to-slate-300 text-black',
    glowClass: 'shadow-[0_0_15px_rgba(156,163,175,0.4)]',
    badge: '🥈 Silver Noble Badge',
    badgeId: 'badge_superstar', // Unlock superstar badge
    frameId: 'frame_neon', // Unlock neon frame
    perks: [
      'Silver prestige badge beside profile name',
      'Exclusive holographic bubble text chats',
      '10% coin purchase bonus at checkout',
      'Automatic Neon border unlocked instantly'
    ]
  },
  {
    id: 'vip_gold',
    name: 'GOLDEN SOVEREIGN VIP',
    price: 2500,
    priceType: 'coins' as const,
    colorClass: 'from-amber-400 via-yellow-500 to-amber-350 text-black font-extrabold',
    glowClass: 'shadow-[0_0_25px_rgba(251,191,36,0.6)]',
    badge: '👑 Golden Crown Badge',
    badgeId: 'badge_superstar',
    frameId: 'frame_gold',
    perks: [
      'Imperial Golden Crown badge visible in all rooms',
      'Unlimited access to Golden Crown avatar frame',
      'Hyperspace star warp entrance effect unlocked',
      'Immunity to peer seat muting controls',
      '25% global top up coin rewards'
    ]
  },
  {
    id: 'vip_royal',
    name: 'ROYAL OVERLORD VIP',
    price: 7500,
    priceType: 'coins' as const,
    colorClass: 'from-indigo-500 via-purple-600 to-pink-500 text-white font-black',
    glowClass: 'shadow-[0_0_35px_rgba(168,85,247,0.7)]',
    badge: '💎 Royal Diamond Sovereign',
    badgeId: 'badge_rich',
    frameId: 'frame_void', // Dark celestial void Frame
    perks: [
      'Deep Purple Royal Diamond Badge visible on chat list',
      'Void Nebula Avatar cover activated dynamically',
      'Absolute protection/Immunity to Room Host kicks',
      'Phoenix fire rebirth room entrance announcement banner',
      '50% lifetime bonus coin allocations',
      'Ability to customize room layouts anytime'
    ]
  }
];

const GENERAL_PERKS = [
  { icon: Crown, title: 'Exclusive Hierarchy Badges', desc: 'Prestige VIP marks beside your username show supremacy.' },
  { icon: Sparkles, title: 'Animated Profile Border Frames', desc: 'Exquisite dynamic neon borders designed to radiate in voice grids.' },
  { icon: Zap, title: 'Epic Entrance Banner Broadcaster', desc: 'Blinding cinematic flashes announce your entrance in any room.' },
  { icon: ShieldCheck, title: 'Moderator / Host Kick Immunity', desc: 'Prevent standard co-hosts and members from kicking you from forums.' },
  { icon: Star, title: 'Dynamic Custom Background Themes', desc: 'Tailor active voice lounges with custom digital wallpapers.' },
  { icon: MessageCircle, title: 'Lounge Shoutout Broadcasting', desc: 'Send multi-recipient messages to friends simultaneously.' },
];

export default function VIPPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const ownedItems = profile?.badges || [];

  const handleBuyVIP = async (tier: typeof VIP_TIERS[0]) => {
    if (!profile) {
      toast.error('You must log in to join the Nobility Guild!');
      return;
    }

    if (profile.coins < tier.price) {
      toast.error('Insufficient Coins! Visit the wallet to load coins.');
      navigate('/wallet');
      return;
    }

    // Checking if already unlocked
    if (ownedItems.includes(tier.id)) {
      toast.error('You already possess this premium VIP Status level!');
      return;
    }

    setBuyingId(tier.id);
    try {
      const userRef = doc(db, 'users', profile.uid);
      
      // Update fields
      const updates: Record<string, any> = {
        isVIP: true,
        coins: profile.coins - tier.price,
        // Awarding the VIP membership card ID inside badges array 
        badges: arrayUnion(tier.id, tier.badgeId, tier.frameId),
        // Instantly equip the upgraded frame as a bonus
        activeFrame: tier.frameId,
        activeBadge: tier.badgeId
      };

      // Set VIP tier levels or text directly on users doc
      updates.vipLevelName = tier.name;
      updates.vipDurationDays = 30; // 30 Days default validity

      await updateDoc(userRef, updates);

      // Create transaction log in store_logs
      await addDoc(collection(db, 'store_logs'), {
        userId: profile.uid,
        itemId: tier.id,
        itemName: tier.name,
        itemType: 'vip_membership',
        price: tier.price,
        priceType: tier.priceType,
        qty: 1,
        timestamp: serverTimestamp()
      });

      toast.success(`Welcome to Nobility status! Activated: ${tier.name}! Frame & badge auto-equipped.`);
    } catch (e) {
      console.error(e);
      toast.error('Error activating membership.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090B11] text-white font-sans pb-32">
      {/* Sticky Header info */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-[#090B11]/50 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 border border-white/10">
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </Button>
          <Crown size={22} className="text-yellow-400 animate-pulse" />
          <h1 className="text-lg font-black uppercase tracking-tight">VIP Prestige Hall</h1>
        </div>

        {/* Coin Indicator */}
        <div 
          onClick={() => navigate('/wallet')}
          className="bg-yellow-500/10 border border-yellow-400/30 rounded-full px-3.5 py-1 flex items-center gap-1.5 cursor-pointer hover:bg-yellow-500/20 transition-all shadow-inner"
        >
          <Coins size={13} className="text-yellow-400" />
          <span className="text-xs font-black text-yellow-400">{(profile?.coins ?? 0).toLocaleString()}</span>
          <Plus size={10} className="text-yellow-400 shrink-0" />
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* Dynamic Crown Animated Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-[36px] overflow-hidden bg-gradient-to-tr from-[#1E1B4B] via-[#311042] to-[#0F172A] p-8 border border-purple-500/15 shadow-2xl flex flex-col justify-center items-center text-center space-y-4"
        >
          {/* Cosmic Star Background Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15)_0,transparent_70%)] pointer-events-none" />
          
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500 rounded-full blur-xl opacity-30 animate-pulse" />
            <Crown size={60} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-bounce relative z-10" />
          </div>

          <div className="space-y-1 relative z-10">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase italic text-glow">The Elite Council</h2>
            <p className="text-xs text-gray-400 max-w-[280px] mx-auto leading-relaxed">
              Unlock ultimate authority over standard room bounds and showcase your cosmic value.
            </p>
          </div>

          {profile?.isVIP && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
              <Check size={11} strokeWidth={3} /> Verified Nobility Member
            </div>
          )}
        </motion.div>

        {/* TIER SELECTIONS MATRIX */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Award size={15} className="text-yellow-500 animate-spin-slow" />
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Noble Status Tiers</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VIP_TIERS.map((tier) => {
              const isPurchased = ownedItems.includes(tier.id);
              return (
                <motion.div
                  key={tier.id}
                  whileHover={{ y: -4 }}
                  className={`bg-[#0C101A]/80 border border-white/5 rounded-[32px] p-6 flex flex-col justify-between relative overflow-hidden transition-all shadow-xl hover:border-white/10 ${
                    isPurchased ? 'border-amber-500/20 shadow-amber-500/5' : ''
                  }`}
                >
                  {/* Subtle top background highlight */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${tier.colorClass}`} />

                  <div className="space-y-5">
                    {/* Badge Badge overlay */}
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-gradient-to-r ${tier.colorClass}`}>
                        {tier.id === 'vip_royal' ? '👑 OVERLORD' : tier.id === 'vip_gold' ? '🌟 SOVEREIGN' : '⭐ MONARCH'}
                      </span>
                      {isPurchased && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <Check size={10} strokeWidth={3} /> ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-lg font-black tracking-tight text-white mb-1 leading-none uppercase">{tier.name}</h4>
                      <p className="text-[9px] text-gray-500 font-extrabold flex items-center gap-1 uppercase tracking-wider"><Shield size={10} /> Perks & Accessories included:</p>
                    </div>

                    {/* Tier Benefits */}
                    <ul className="space-y-2 pt-2 border-t border-white/5">
                      {tier.perks.map((perk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[10px] text-gray-400 leading-relaxed font-semibold">
                          <span className="text-yellow-500 mt-1 shrink-0">•</span>
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Purchase Interactive button trigger */}
                  <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between gap-3">
                    <div className="text-left space-y-0.5">
                      <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider">30 Days Period</span>
                      <div className="flex items-center gap-1.5 text-yellow-400">
                        <Coins size={14} className="text-yellow-400 animate-bounce" />
                        <span className="text-sm font-black">{tier.price.toLocaleString()}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      disabled={buyingId === tier.id || isPurchased}
                      onClick={() => handleBuyVIP(tier)}
                      className={`px-5 rounded-xl uppercase text-[10px] font-black h-9 border-none transition-all ${
                        isPurchased 
                          ? 'bg-white/10 text-gray-500 cursor-not-allowed' 
                          : 'bg-gradient-to-tr from-yellow-500 to-amber-600 text-bg-dark font-black shadow-lg shadow-yellow-500/10'
                      }`}
                    >
                      {buyingId === tier.id ? (
                        'Joining...'
                      ) : isPurchased ? (
                        'UNLOCKED'
                      ) : (
                        'ACTIVATE'
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* GENERAL PERKS DETAILS LEDGER */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Sparkles size={15} className="text-purple-400 animate-pulse" />
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Privileges Specification Ledger</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {GENERAL_PERKS.map((perk, i) => (
              <Card key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden shadow-inner hover:bg-white/[0.04] transition-colors">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-md shrink-0">
                     <perk.icon size={22} className="stroke-[2.25]" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-xs text-white uppercase tracking-tight">{perk.title}</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">{perk.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
