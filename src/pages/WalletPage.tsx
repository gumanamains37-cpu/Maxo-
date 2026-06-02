import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingBag, CreditCard, Landmark, ArrowDownCircle, ArrowUpCircle, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function WalletPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const plans = [
    { coins: 1000, price: '$0.99', badge: '' },
    { coins: 5500, price: '$4.99', badge: 'Popular' },
    { coins: 12000, price: '$9.99', badge: 'Value' },
    { coins: 65000, price: '$49.99', badge: 'Mega' },
  ];

  const handleRecharge = async (coinsToAdd: number, priceStr: string) => {
    if (!profile?.uid) {
      toast.error('Log in first to recharge your wallet!');
      return;
    }
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        coins: (profile.coins || 0) + coinsToAdd
      });
      toast.success(`Purchase of ${priceStr} successful! Added ${coinsToAdd.toLocaleString()} Coins to your account. 🪙`);
    } catch (err) {
      console.error("Wallet recharge failed:", err);
      toast.error('Failed to process recharge');
    }
  };

  const handleExchange = async () => {
    if (!profile?.uid) return;
    const diamonds = profile.diamonds || 0;
    if (diamonds < 1000) {
      toast.error('Minimum amount to exchange is 1,000 Diamonds!');
      return;
    }
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        diamonds: 0,
        coins: (profile.coins || 0) + Math.floor(diamonds * 1) // 1-to-1 conversation rate
      });
      toast.success(`Exchanged ${diamonds.toLocaleString()} Diamonds for ${diamonds.toLocaleString()} Coins! 🪙`);
    } catch (err) {
      console.error("Wallet diamond exchange failed:", err);
      toast.error('Failed to exchange diamonds');
    }
  };

  return (
    <div className="py-6 space-y-8 pb-32 bg-bg-dark min-h-screen text-white">
      <div className="flex flex-col items-center py-6">
        <h2 className="text-gray-500 text-sm uppercase tracking-widest mb-1 font-bold">Coin Balance</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-white">{(profile?.coins || 0).toLocaleString()}</span>
          <img src="https://cdn-icons-png.flaticon.com/512/11502/11502424.png" className="w-6 h-6" alt="coin" />
        </div>
        <p className="text-[10px] text-purple-400 font-extrabold uppercase tracking-widest mt-1.5 flex items-center gap-1">
          💎 Diamond Balance: {(profile?.diamonds || 0).toLocaleString()}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 px-6">
        <Button variant="outline" className="h-20 flex flex-col gap-1 border-white/5 bg-white/5 text-white hover:bg-white/10 rounded-2xl">
          <ArrowDownCircle size={20} className="text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-tighter">Recharge</span>
        </Button>
        <Button variant="outline" className="h-20 flex flex-col gap-1 border-white/5 bg-white/5 text-white hover:bg-white/10 rounded-2xl">
          <ArrowUpCircle size={20} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-tighter">Withdraw</span>
        </Button>
      </div>

      <div className="space-y-4 px-6">
        <h3 className="font-black text-lg flex items-center gap-2 px-2 uppercase tracking-tight">
           <ShoppingBag size={18} className="text-blue-400" />
           Top Up Coins
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {plans.map((plan, i) => (
            <Card 
              key={i} 
              onClick={() => handleRecharge(plan.coins, plan.price)}
              className="bg-white/5 border-white/10 overflow-hidden hover:border-blue-500/50 transition-colors cursor-pointer rounded-3xl"
            >
              <CardContent className="p-6 text-center space-y-3 relative">
                {plan.badge && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-[8px] font-black px-2 py-1 rounded-bl-xl uppercase tracking-tighter text-white">
                    {plan.badge}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2">
                   <span className="font-black text-2xl text-white">{plan.coins.toLocaleString()}</span>
                   <img src="https://cdn-icons-png.flaticon.com/512/11502/11502424.png" className="w-5 h-5" alt="coin" />
                </div>
                <div className="bg-white text-black h-12 rounded-2xl flex items-center justify-center font-black text-sm active:scale-95 transition-transform hover:bg-gray-200">
                  {plan.price}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-6">
        <div className="bg-white/5 border border-white/5 p-6 rounded-[32px] space-y-4 shadow-xl">
          <div className="flex items-center gap-4">
             <Landmark size={24} className="text-blue-400" />
             <div className="flex-1">
               <p className="font-black text-white">Diamond Exchange</p>
               <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Rate: 1000 = 1,000 Coins</p>
             </div>
             <Button 
               size="sm" 
               onClick={handleExchange}
               className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-black px-4 cursor-pointer"
             >
               Exchange
             </Button>
          </div>
        </div>
      </div>

      {/* VIP Promo */}
      <div className="px-6 pb-12">
        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/vip')}
          className="bg-white p-6 rounded-[36px] flex items-center justify-between cursor-pointer group shadow-2xl shadow-blue-500/10"
        >
          <div className="flex items-center gap-4">
             <div className="bg-black p-3 rounded-2xl">
                <Crown size={32} className="text-white" />
             </div>
             <div>
                <p className="text-xl font-black text-black leading-tight">Join VIP</p>
                <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest">Exclusive Rewards</p>
             </div>
          </div>
          <div className="bg-black text-white px-6 py-2.5 rounded-full font-black text-sm group-hover:scale-105 transition-transform">
            View
          </div>
        </motion.div>
      </div>
    </div>
  );
}
