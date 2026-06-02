import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, increment } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
  ChevronLeft, ShoppingBag, Coins, Gem, Sparkles, Plus, 
  Check, Search, Filter, History, Calendar, HelpCircle, ArrowUpDown 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MASTER_GIFTS, STORE_ITEMS, StoreItem, StoreGift, StoreItemType } from '@/data/storeItems';

interface PurchaseLog {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  price: number;
  priceType: 'coins' | 'diamonds';
  timestamp: any;
}

export default function StorePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  // Tab management: 7 categories + History
  const [activeTab, setActiveTab] = useState<'gifts' | StoreItemType | 'history'>('gifts');
  const [searchQuery, setSearchQuery] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'rarity'>('price-asc');
  
  // Purchase logs for History tab
  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>([]);
  const [fetchingLogs, setFetchingLogs] = useState(false);

  // Modal display states
  const [selectedGift, setSelectedGift] = useState<StoreGift | null>(null);
  const [giftQuantity, setGiftQuantity] = useState(1);

  // Fetch purchase logs when changing to the history tab
  useEffect(() => {
    if (activeTab === 'history' && profile?.uid) {
      fetchLogs();
    }
  }, [activeTab, profile?.uid]);

  const fetchLogs = async () => {
    if (!profile?.uid) return;
    setFetchingLogs(true);
    try {
      const q = query(
        collection(db, 'store_logs'),
        where('userId', '==', profile.uid),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      const logs: PurchaseLog[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseLog[];
      setPurchaseLogs(logs);
    } catch (e) {
      console.error("Error fetching purchase logs:", e);
    } finally {
      setFetchingLogs(false);
    }
  };

  const ownedItems = profile?.badges || [];

  // Sort and filter utilities
  const getGiftsList = () => {
    return MASTER_GIFTS.filter(gift => 
      gift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gift.category.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return b.price - a.price; // default to desc for prestige
    });
  };

  const getStoreItemsList = (type: StoreItemType) => {
    return STORE_ITEMS.filter(item => 
      item.type === type && 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return 0;
    });
  };

  const formatRarityClass = (rarity: string) => {
    switch (rarity) {
      case 'mythic': return 'from-red-500 to-rose-600 font-extrabold text-[#09090B] shadow-[0_0_12px_rgba(244,63,94,0.6)]';
      case 'legendary': return 'from-yellow-400 to-amber-500 font-extrabold text-[#09090B] shadow-[0_0_10px_rgba(245,158,11,0.5)]';
      case 'epic': return 'from-purple-500 to-indigo-600 font-extrabold text-white';
      case 'rare': return 'from-cyan-400 to-blue-500 text-white';
      default: return 'from-zinc-500 to-zinc-600 text-white';
    }
  };

  // Complete purchase logic supporting Coins / Diamonds & transactional updates
  const handlePurchase = async (item: StoreItem | StoreGift, qty = 1) => {
    if (!profile) {
      toast.error('You must log in to buy elite decorations!');
      return;
    }

    const price = item.price * qty;
    const priceType = 'priceType' in item ? item.priceType : 'coins';

    // Verification check for non-gift elements
    if (item.id.includes('frame') || item.id.includes('bubble') || item.id.includes('avatar') || item.id.includes('entrance') || item.id.includes('room_dec') || item.id.includes('vip')) {
      if (ownedItems.includes(item.id)) {
        toast.error('You already own this exquisite badge or decor!');
        return;
      }
    }

    // Currency verification checks
    if (priceType === 'coins' && profile.coins < price) {
      toast.error('Insufficient Coins! Buy more in the top-up section.');
      navigate('/wallet');
      return;
    }

    if (priceType === 'diamonds' && (profile.diamonds || 0) < price) {
      toast.error('Insufficient Diamonds! Receive gifts from other members to earn them.');
      return;
    }

    setBuyingId(item.id);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: Record<string, any> = {};

      if (priceType === 'coins') {
        updates.coins = profile.coins - price;
      } else {
        updates.diamonds = (profile.diamonds || 0) - price;
      }

      // Add to inventory store/array representing general item unlocking
      updates.badges = arrayUnion(item.id);

      // Dedicated VIP activation upgrades
      if ('type' in item && item.type === 'vip_item') {
        updates.isVIP = true;
        // Elevate levels or premium fields based on package tier purchased
        if (item.id === 'vip_royal') {
          updates.level = Math.max(profile.level, 10); // Start VIPs higher
          updates.activeBadge = 'badge_rich';
        } else if (item.id === 'vip_gold') {
          updates.activeBadge = 'badge_superstar';
        }
      }

      // Direct Firestore transaction updates
      await updateDoc(userRef, updates);

      // Create log document to track transactions transparently
      await addDoc(collection(db, 'store_logs'), {
        userId: profile.uid,
        itemId: item.id,
        itemName: item.name,
        itemType: 'category' in item ? `gift-${item.category}` : item.type,
        price,
        priceType,
        qty,
        timestamp: serverTimestamp()
      });

      // Special item catalog count adjustments (Optionally store counts of specific gifts inside profile inventory object map)
      const inventoryCountPath = `giftInventory.${item.id}`;
      await updateDoc(userRef, {
        [inventoryCountPath]: increment(qty)
      });

      toast.success(`Successfully unlocked ${qty}x ${item.name}! Check your Me page & Backpack.`);
      setSelectedGift(null);
      setGiftQuantity(1);
    } catch (error) {
      console.error("Purhcase error:", error);
      toast.error('Gifting transaction failed. Please retry.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090B11] text-white font-sans pb-32">
      {/* Dynamic Header */}
      <div className="px-6 pt-12 pb-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-bg-dark/60 backdrop-blur-2xl sticky top-0 z-40 border-b border-white/5 shadow-lg">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 border border-white/10 active:scale-90 transition-transform">
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingBag size={24} className="text-yellow-400 animate-pulse" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">Nobility Palace</h1>
              <p className="text-[9px] text-gray-500 font-black tracking-widest uppercase mt-0.5">Prestige Virtual Store</p>
            </div>
          </div>
        </div>

        {/* Dynamic Dual Balance Indicators */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Coin Topup Indicator */}
          <div 
            onClick={() => navigate('/wallet')}
            className="flex-1 md:flex-none bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-2xl px-3.5 py-1.5 flex items-center justify-between md:justify-start gap-2 cursor-pointer hover:border-yellow-400/40 hover:from-yellow-500/20 transition-all group"
          >
            <div className="flex items-center gap-1.5">
              <Coins size={14} className="text-yellow-400 group-hover:rotate-12 transition-transform" />
              <span className="text-xs font-black text-yellow-400">{(profile?.coins ?? 0).toLocaleString()}</span>
            </div>
            <div className="w-5 h-5 bg-yellow-500 text-bg-dark rounded-lg flex items-center justify-center text-[10px] font-black shadow-md shadow-yellow-500/20">
              <Plus size={10} strokeWidth={3} />
            </div>
          </div>

          {/* Diamond Balance Indicator */}
          <div className="flex-1 md:flex-none bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-2xl px-3.5 py-1.5 flex items-center justify-between md:justify-start gap-2">
            <div className="flex items-center gap-1.5">
              <Gem size={14} className="text-purple-400 animate-pulse" />
              <span className="text-xs font-black text-purple-400">{(profile?.diamonds ?? 0).toLocaleString()}</span>
            </div>
            <div className="text-[8px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
              Earned
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Elite Promotions Banner */}
        <div className="bg-gradient-to-br from-purple-900/30 via-indigo-950/10 to-transparent p-6 rounded-[32px] border border-purple-500/10 relative overflow-hidden shadow-2xl">
          <div className="absolute -right-6 -bottom-6 text-9xl opacity-10 pointer-events-none select-none">💎</div>
          <div className="relative z-10 space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full"><Sparkles size={11} /> Sovereign status awaits</span>
            <h2 className="text-xl font-black text-white leading-tight tracking-tight">Luxury Avatars & Exclusive VIP Rooms</h2>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[340px]">Equip premium halos, stunning hypercar entry actions, and custom chat bubbles that dynamically highlight your wealth in speaker rooms.</p>
          </div>
        </div>

        {/* 8 Horizontal Nav Categories */}
        <div className="flex bg-[#0C101A]/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-1 shadow-inner">
          {[
            { id: 'gifts', label: 'Gifts', icon: '🎁' },
            { id: 'frame', label: 'Frames', icon: '💫' },
            { id: 'entrance', label: 'Entrances', icon: '⚡' },
            { id: 'bubble', label: 'Bubbles', icon: '💬' },
            { id: 'avatar_dec', label: 'Decors', icon: '🐱' },
            { id: 'room_dec', label: 'Room Dec', icon: '🏟️' },
            { id: 'vip_item', label: 'Memberships', icon: '👑' },
            { id: 'history', label: 'History Logs', icon: '📜' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all cursor-pointer whitespace-nowrap px-4 flex items-center justify-center gap-1.5 ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-tr from-yellow-500 to-amber-600 text-bg-dark shadow-lg font-black' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Navigation Filters */}
        {activeTab !== 'history' && (
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-[#070A0F] p-3 rounded-2xl border border-white/5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search collection items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111520] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs font-bold text-white focus:outline-none focus:border-yellow-500/30 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-wider flex items-center gap-1"><ArrowUpDown size={11} /> Sort:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#111520] border border-white/5 rounded-xl py-2 px-3 text-xs font-black text-yellow-500 focus:outline-none cursor-pointer"
              >
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rarity">Prestige Rarity</option>
              </select>
            </div>
          </div>
        )}

        {/* Catalog Displays */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* 1. MASTER GIFTS TAB */}
            {activeTab === 'gifts' && (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {getGiftsList().map(gift => (
                  <motion.div
                    whileHover={{ y: -3 }}
                    onClick={() => setSelectedGift(gift)}
                    key={gift.id}
                    className="bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-[28px] p-4 flex flex-col items-center justify-between text-center cursor-pointer relative overflow-hidden group transition-all"
                  >
                    {/* Rarity Tag */}
                    <div className="absolute top-2 right-2">
                      <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-gradient-to-r ${formatRarityClass(gift.rarity)}`}>
                        {gift.rarity}
                      </span>
                    </div>

                    <div className="text-4xl my-4 group-hover:scale-120 transition-transform duration-200">
                      {gift.icon}
                    </div>

                    <div className="w-full space-y-1">
                      <p className="font-extrabold text-xs text-white truncate">{gift.name}</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wide">{gift.category}</p>
                    </div>

                    <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full flex items-center justify-center gap-1 w-full">
                      <Coins size={11} className="text-yellow-400" />
                      <span className="text-[10px] font-black text-yellow-400">{gift.price}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* 2. STATIONARY STORE ITEMS PAGES (Frames, bubbles, decors, etc.) */}
            {activeTab !== 'gifts' && activeTab !== 'history' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {getStoreItemsList(activeTab as StoreItemType).map(item => {
                  const isOwned = ownedItems.includes(item.id);
                  return (
                    <motion.div 
                      key={item.id}
                      whileHover={{ y: -3 }}
                      className="bg-[#0C101A]/60 border border-white/5 hover:border-white/10 rounded-3xl p-5 flex gap-4 items-center relative overflow-hidden"
                    >
                      {/* Avatar decoration visualizers */}
                      <div className="w-16 h-16 shrink-0 bg-white/5 rounded-2xl flex items-center justify-center relative shadow-inner">
                        <div className={`w-12 h-12 flex items-center justify-center text-3xl ${item.previewClass}`}>
                          {item.previewClass.includes('border') ? (
                            <div className="w-8 h-8 rounded-full bg-[#141B2E] flex items-center justify-center text-[10px] font-black text-sky-300">USER</div>
                          ) : (
                            item.previewIcon
                          )}
                        </div>
                        {item.previewClass.includes('border') && (
                          <span className="absolute -top-1.5 -right-1.5 text-sm">{item.previewIcon}</span>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div>
                          <h3 className="font-extrabold text-sm text-white">{item.name}</h3>
                          <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-1">{item.description}</p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1 text-yellow-400">
                            {item.priceType === 'coins' ? <Coins size={12} className="text-yellow-400 animate-spin-slow" /> : <Gem size={12} className="text-purple-400 animate-pulse" />}
                            <span className="text-xs font-black">{item.price}</span>
                          </div>

                          <Button 
                            size="sm"
                            disabled={buyingId === item.id}
                            onClick={() => handlePurchase(item)}
                            className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase border-none ${
                              isOwned 
                                ? 'bg-white/10 text-gray-400 hover:bg-white/10' 
                                : 'bg-gradient-to-tr from-yellow-500 to-amber-600 hover:opacity-90 text-bg-dark shadow-[0_4px_15px_rgba(245,158,11,0.25)]'
                            }`}
                          >
                            {buyingId === item.id ? (
                              'Buying...'
                            ) : isOwned ? (
                              <span className="flex items-center gap-1"><Check size={10} strokeWidth={3} /> Owned</span>
                            ) : (
                              'Unlock'
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {getStoreItemsList(activeTab as StoreItemType).length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500 font-bold text-xs">
                    No active items found matching the constraints
                  </div>
                )}
              </div>
            )}

            {/* 3. TRANSACTION logs tab */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5"><History size={14} /> Personal Purchase Records</h3>
                  <Button variant="ghost" size="xs" onClick={fetchLogs} className="text-xs text-yellow-500 hover:text-yellow-400">Refresh</Button>
                </div>

                {fetchingLogs ? (
                  <div className="text-center py-12 text-gray-500 text-xs font-medium">Fetching history ledger data...</div>
                ) : purchaseLogs.length === 0 ? (
                  <div className="text-center py-16 bg-[#0C101A]/60 border border-white/5 rounded-3xl p-6">
                    <p className="text-sm font-extrabold text-white">No transactions recorded yet</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-[280px] mx-auto leading-relaxed">Purchases or gift unlocks executed inside this palace are persistently tracked here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {purchaseLogs.map(log => (
                      <div 
                        key={log.id}
                        className="bg-[#0C101A]/60 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-lg shadow-inner">
                            {log.itemType.includes('gift') ? '🎁' : log.itemType.includes('frame') ? '💫' : log.itemType.includes('bubble') ? '💬' : '👑'}
                          </div>
                          <div>
                            <p className="font-extrabold text-xs text-white">{log.itemName}</p>
                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-0.5">{log.itemType}</p>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-1 justify-end font-black text-xs text-yellow-400">
                            {log.priceType === 'coins' ? <Coins size={11} className="text-yellow-400" /> : <Gem size={11} className="text-purple-400" />}
                            <span>{log.price}</span>
                          </div>
                          <p className="text-[8px] text-gray-500 flex items-center gap-1 justify-end"><Calendar size={8} /> {new Date(log.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* GIFT QUANTITY DIALOG MODAL */}
      <AnimatePresence>
        {selectedGift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGift(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#0D101E] border border-white/10 p-6 rounded-[34px] w-full max-w-sm relative z-10 space-y-5 shadow-2xl overflow-hidden"
            >
              {/* Luxury Accent Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />

              <div className="text-center space-y-1.5 pt-2">
                <div className="text-5xl animate-bounce mb-3">{selectedGift.icon}</div>
                <h3 className="text-lg font-black text-white">{selectedGift.name}</h3>
                <span className="inline-block text-[8px] font-black tracking-widest uppercase bg-yellow-500/10 text-yellow-500 px-3 py-0.5 rounded border border-yellow-500/20">
                  {selectedGift.rarity} Rarity
                </span>
                <p className="text-xs text-gray-400 mt-1">{selectedGift.description}</p>
              </div>

              {/* Quantity Changer */}
              <div className="bg-[#141A2E] p-1.5 rounded-2xl flex items-center justify-between border border-white/5">
                <button 
                  onClick={() => setGiftQuantity(Math.max(1, giftQuantity - 1))}
                  className="w-10 h-10 bg-white/5 rounded-xl hover:bg-white/10 active:scale-90 transition-all font-extrabold text-white text-sm"
                >
                  -
                </button>
                <span className="text-sm font-black text-white">{giftQuantity}</span>
                <button 
                  onClick={() => setGiftQuantity(giftQuantity + 1)}
                  className="w-10 h-10 bg-white/5 rounded-xl hover:bg-white/10 active:scale-90 transition-all font-extrabold text-white text-sm"
                >
                  +
                </button>
              </div>

              {/* Summary Cost */}
              <div className="flex items-center justify-between text-xs px-2">
                <span className="text-gray-500 font-black uppercase tracking-wider">Total Value</span>
                <div className="flex items-center gap-1.5 font-black text-yellow-400 text-sm">
                  <Coins size={14} className="text-yellow-400" />
                  <span>{(selectedGift.price * giftQuantity).toLocaleString()}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedGift(null)} 
                  className="rounded-xl border border-white/5 text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  disabled={buyingId === selectedGift.id}
                  onClick={() => handlePurchase(selectedGift, giftQuantity)}
                  className="rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-600 text-bg-dark font-black hover:opacity-90 shadow-md shadow-yellow-500/20 uppercase text-xs"
                >
                  {buyingId === selectedGift.id ? 'Buying...' : 'Confirm'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
