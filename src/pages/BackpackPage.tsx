import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, ShieldCheck, Sparkles, AlertCircle, ShoppingBag, 
  Check, Archive, Grid, Heart, Crown, Award, User, HelpCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MASTER_GIFTS, STORE_ITEMS, lookupStoreItem, StoreItem, StoreGift } from '@/data/storeItems';

export default function BackpackPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Tab control: Closet (Frames, Bubbles, Decors, Entrances, Room Decs) vs Vault (Gifts stock)
  const [activeSegment, setActiveSegment] = useState<'closet' | 'vault'>('closet');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const ownedIds = profile?.badges || [];
  
  // Filter owned fashion items from central catalog
  const ownedFashionItems = STORE_ITEMS.filter(item => ownedIds.includes(item.id));

  // Determine active custom profile properties (default empty if none)
  const activeFrame = (profile as any)?.activeFrame || '';
  const activeBubble = (profile as any)?.activeBubble || '';
  const activeBadge = (profile as any)?.activeBadge || '';
  const activeEntrance = (profile as any)?.activeEntrance || '';
  const activeAvatarDec = (profile as any)?.activeAvatarDec || '';
  const activeRoomDec = (profile as any)?.activeRoomDec || '';

  // Extract gifts stock from profile.giftInventory map
  const giftInventory = (profile as any)?.giftInventory || {};
  const ownedGiftKeys = Object.keys(giftInventory).filter(key => giftInventory[key] > 0);
  const ownedGiftsList = ownedGiftKeys.map(key => {
    const giftObj = MASTER_GIFTS.find(g => g.id === key);
    return giftObj ? { ...giftObj, qty: giftInventory[key] } : null;
  }).filter(Boolean) as (StoreGift & { qty: number })[];

  const handleEquipFashion = async (item: StoreItem) => {
    if (!profile?.uid) return;
    setUpdatingId(item.id);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: Record<string, any> = {};

      if (item.type === 'frame') {
        const isEquipped = activeFrame === item.id;
        updates.activeFrame = isEquipped ? '' : item.id;
      } else if (item.type === 'bubble') {
        const isEquipped = activeBubble === item.id;
        updates.activeBubble = isEquipped ? '' : item.id;
      } else if (item.type === 'badge') {
        const isEquipped = activeBadge === item.id;
        updates.activeBadge = isEquipped ? '' : item.id;
      } else if (item.type === 'entrance') {
        const isEquipped = activeEntrance === item.id;
        updates.activeEntrance = isEquipped ? '' : item.id;
      } else if (item.type === 'avatar_dec') {
        const isEquipped = activeAvatarDec === item.id;
        updates.activeAvatarDec = isEquipped ? '' : item.id;
      } else if (item.type === 'room_dec') {
        const isEquipped = activeRoomDec === item.id;
        updates.activeRoomDec = isEquipped ? '' : item.id;
      }

      await updateDoc(userRef, updates);
      toast.success(`${item.name} equipment status toggled!`);
    } catch (e) {
      console.error("Equipping error:", e);
      toast.error('Failed to change your equipped tools.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Find active decoration visual representation 
  const getAvatarDecorationOverlay = () => {
    if (activeAvatarDec === 'avatar_catears') return '🐱';
    if (activeAvatarDec === 'avatar_halo') return '😇';
    if (activeAvatarDec === 'avatar_goggles') return '🕶️';
    return null;
  };

  const getFrameStylingBorderClass = () => {
    if (activeFrame === 'frame_neon') return 'border-4 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.7)] animate-pulse';
    if (activeFrame === 'frame_gold') return 'border-4 border-amber-400 shadow-[0_0_15px_rgba(250,204,21,0.7)]';
    if (activeFrame === 'frame_flame') return 'border-4 border-rose-600 shadow-[0_0_20px_rgba(225,29,72,0.85)]';
    if (activeFrame === 'frame_sakura') return 'border-4 border-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.6)]';
    if (activeFrame === 'frame_void') return 'border-4 border-purple-600 shadow-[0_0_22px_rgba(147,51,234,0.8)]';
    return 'border border-white/10';
  };

  return (
    <div className="min-h-screen bg-[#090B11] text-white font-sans pb-32">
      {/* Sticky Top Navigation */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-[#090B11]/50 backdrop-blur-md sticky top-0 z-30 border-b border-white/5 shadow-lg">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 border border-white/10">
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-400" />
            <h1 className="text-lg font-black uppercase tracking-tight">Royal Backpack</h1>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        
        {/* Dynamic Interactive Preview Card */}
        {profile && (
          <div className="bg-gradient-to-b from-[#111625] to-transparent rounded-[32px] p-6 border border-white/5 flex flex-col items-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0,transparent_75%)]" />
            
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5 relative z-10">Active Showcase Preview</h3>
            
            {/* Real-time Layered Avatar Rendering */}
            <div className="relative flex items-center justify-center p-3 relative z-10">
              {/* Dynamic Avatar Decoration (Ears, Halo, Visors) */}
              {getAvatarDecorationOverlay() && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl z-20 animate-bounce">
                  {getAvatarDecorationOverlay()}
                </div>
              )}

              {/* Dynamic Borders (Frames) */}
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${getFrameStylingBorderClass()}`}>
                <img 
                  src={profile.photoURL} 
                  className="w-20 h-20 rounded-full object-cover" 
                  alt="My Profile Picture" 
                />

                {/* Corner Star Badge Overlay */}
                {activeBadge && (
                  <div className="absolute -bottom-1 -right-1 bg-black/80 border border-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md animate-spin-slow">
                    {activeBadge === 'badge_superstar' ? '🌟' : '💎'}
                  </div>
                )}
              </div>
            </div>

            {/* Profile detail listings */}
            <div className="text-center space-y-1.5 relative z-10">
              <p className="font-extrabold text-base text-white">{profile.displayName}</p>
              
              <div className="flex flex-wrap gap-1.5 justify-center">
                {activeFrame ? (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-400/20">Frame</span>
                ) : (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-white/5 text-gray-500 px-2.5 py-0.5 rounded-full">No Frame</span>
                )}
                {activeAvatarDec && (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-500 px-2.5 py-0.5 rounded-full border border-yellow-500/20">Decor</span>
                )}
                {activeBubble && (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-400/20">Bubble</span>
                )}
                {activeEntrance && (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20">Entrance</span>
                )}
                {activeRoomDec && (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-400/20">Themes</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2 segmented tab controls: Closet vs Stock */}
        <div className="grid grid-cols-2 bg-[#0C101A]/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 gap-1 shadow-inner">
          <button 
            onClick={() => setActiveSegment('closet')}
            className={`py-3.5 text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSegment === 'closet'
                ? 'bg-gradient-to-tr from-yellow-500 to-amber-600 text-bg-dark shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Grid size={13} />
            <span>Fashion Closet</span>
          </button>
          
          <button 
            onClick={() => setActiveSegment('vault')}
            className={`py-3.5 text-xs font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSegment === 'vault'
                ? 'bg-gradient-to-tr from-yellow-500 to-amber-600 text-bg-dark shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Archive size={13} />
            <span>My Gifts Stock</span>
          </button>
        </div>

        {/* CLOSET SEGMENT LAYOUT COMPONENT */}
        {activeSegment === 'closet' && (
          <div className="space-y-4">
            {ownedFashionItems.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white/[0.02] rounded-[32px] border border-white/5 space-y-4 shadow-xl">
                <AlertCircle size={40} className="text-gray-600 mx-auto animate-bounce" />
                <div>
                  <p className="font-extrabold text-white text-base">Your closet is empty</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1 max-w-[260px] mx-auto">Purchase frames, chat waves, animated entrances, and status badges from the Nobility Palace.</p>
                </div>
                <Button 
                  onClick={() => navigate('/store')} 
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs px-6 py-4 rounded-xl flex mx-auto gap-1.5 items-center uppercase"
                >
                  <ShoppingBag size={14} /> Go to Store
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Equipments Inventory ({ownedFashionItems.length})</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ownedFashionItems.map(item => {
                    const isEquipped = 
                      (item.type === 'frame' && activeFrame === item.id) ||
                      (item.type === 'bubble' && activeBubble === item.id) ||
                      (item.type === 'badge' && activeBadge === item.id) ||
                      (item.type === 'entrance' && activeEntrance === item.id) ||
                      (item.type === 'avatar_dec' && activeAvatarDec === item.id) ||
                      (item.type === 'room_dec' && activeRoomDec === item.id);

                    return (
                      <div 
                        key={item.id}
                        className={`bg-[#0C101A]/60 border rounded-2xl p-4 flex gap-4 items-center justify-between transition-all hover:border-white/10 ${
                          isEquipped ? 'border-amber-500/40 bg-amber-500/[0.03]' : 'border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 shrink-0 bg-white/5 rounded-xl flex items-center justify-center text-lg relative">
                            <div className={`${item.previewClass} w-9 h-9 flex items-center justify-center`}>
                              {item.previewIcon}
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <h4 className="font-extrabold text-sm text-white">{item.name}</h4>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-extrabold">{item.type.replace('_', ' ')}</p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          disabled={updatingId === item.id}
                          onClick={() => handleEquipFashion(item)}
                          className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase border-none transition-all ${
                            isEquipped 
                              ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/20' 
                              : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                          }`}
                        >
                          {updatingId === item.id ? (
                            'Updating...'
                          ) : isEquipped ? (
                            'Unequip'
                          ) : (
                            'Equip'
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VAULT SEGMENT LAYOUT COMPONENT */}
        {activeSegment === 'vault' && (
          <div className="space-y-4">
            {ownedGiftsList.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white/[0.02] rounded-[32px] border border-white/5 space-y-4 shadow-xl">
                <Heart size={40} className="text-gray-600 mx-auto" />
                <div>
                  <p className="font-extrabold text-white text-base">Your vault stock is empty</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-1 max-w-[260px] mx-auto">Purchase copies of unique interactive gifts inside the Nobility store to stockpile and keep in reserve.</p>
                </div>
                <Button 
                  onClick={() => navigate('/store')} 
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs px-6 py-4 rounded-xl flex mx-auto gap-1.5 items-center uppercase"
                >
                  <ShoppingBag size={14} /> Buy Gifts
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Stockpile Vault Ledger ({ownedGiftsList.length})</h3>

                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
                  {ownedGiftsList.map(item => (
                    <div 
                      key={item.id}
                      className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 flex flex-col items-center justify-between text-center relative overflow-hidden"
                    >
                      {/* Floating Quantity Tag */}
                      <div className="absolute top-2 right-2 bg-yellow-500 text-bg-dark text-[9px] font-black h-5 px-1.5 rounded flex items-center justify-center shadow-md">
                        x{item.qty}
                      </div>

                      <div className="text-4xl my-4 animate-float">{item.icon}</div>

                      <div className="space-y-0.5">
                        <p className="font-extrabold text-xs text-white truncate max-w-[100px]">{item.name}</p>
                        <span className="text-[8px] font-black uppercase text-gray-500 tracking-wider">
                          Valued: {item.price} Coins
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
