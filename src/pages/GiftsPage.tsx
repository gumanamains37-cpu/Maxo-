import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import { doc, getDoc, updateDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Gem } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'motion/react';

const GIFTS = [
  { id: 'rose', name: 'Rose', icon: '🌹', price: 10 },
  { id: 'heart', name: 'Heart', icon: '❤️', price: 50 },
  { id: 'car', name: 'Luxury Car', icon: '🏎️', price: 500 },
  { id: 'crown', name: 'Crown', icon: '👑', price: 1000 },
  { id: 'planet', name: 'Planet', icon: '🪐', price: 5000 },
  { id: 'castle', name: 'Castle', icon: '🏰', price: 10000 },
];

export default function GiftsPage() {
  const { userId: recipientId } = useParams();
  const { profile: selfProfile } = useAuth();
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!recipientId) return;
    async function fetchRecipient() {
      try {
        const snap = await getDoc(doc(db, 'users', recipientId!));
        if (snap.exists()) setRecipient(snap.data() as UserProfile);
      } catch (err) {
        console.warn("Offline or error fetching recipient:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecipient();
  }, [recipientId]);

  const sendGift = async (gift: typeof GIFTS[0]) => {
    if (!selfProfile || !recipient) return;

    if (selfProfile.coins < gift.price) {
      toast.error('Insufficient coins!');
      navigate('/wallet');
      return;
    }

    try {
      // Deduct from sender
      await updateDoc(doc(db, 'users', selfProfile.uid), {
        coins: selfProfile.coins - gift.price
      });

      // Add diamonds to recipient (usually gems/diamonds are earned by receiving gifts)
      const diamondReward = Math.floor(gift.price * 0.4); // 40% value
      await updateDoc(doc(db, 'users', recipient.uid), {
        diamonds: (recipient.diamonds || 0) + diamondReward
      });

      // Log the gift
      await addDoc(collection(db, 'gift_logs'), {
        senderId: selfProfile.uid,
        recipientId: recipient.uid,
        giftId: gift.id,
        price: gift.price,
        timestamp: serverTimestamp()
      });

      toast.success(`You sent a ${gift.name} to ${recipient.displayName}!`);
    } catch (e) {
      toast.error('Gifting failed');
    }
  };

  if (loading) return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-white">Loading...</div>;
  if (!recipient) return <div className="min-h-screen bg-bg-dark flex items-center justify-center text-white">User not found</div>;

  return (
    <div className="min-h-screen bg-bg-dark text-white font-sans p-6 pb-32">
      <header className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full text-white">
          <ChevronLeft size={24} />
        </Button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter">Send Gift</h1>
      </header>

      <div className="flex flex-col items-center mb-10">
        <Avatar className="w-24 h-24 border-4 border-white/10 mb-4 shadow-2xl">
          <AvatarImage src={recipient.photoURL} className="object-cover" />
          <AvatarFallback className="bg-zinc-800 text-2xl">{recipient.displayName[0]}</AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-black text-white">{recipient.displayName}</h2>
        <p className="text-gray-400 text-sm font-medium">Choose a gift to send</p>
      </div>

      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-[24px] p-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <Gem size={20} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Your Balance</p>
            <p className="text-lg font-black text-white">{selfProfile?.coins || 0} Coins</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/wallet')} className="rounded-full border-yellow-500/50 text-yellow-500">Top Up</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {GIFTS.map((gift) => (
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            key={gift.id}
            onClick={() => sendGift(gift)}
            className="bg-zinc-900 border border-white/5 rounded-[24px] p-4 flex flex-col items-center cursor-pointer hover:bg-white/5 transition-colors group"
          >
            <span className="text-4xl mb-3 group-hover:scale-125 transition-transform">{gift.icon}</span>
            <span className="text-[10px] font-bold text-gray-400 mb-1">{gift.name}</span>
            <div className="flex items-center gap-1 text-yellow-500 font-black text-sm">
              <Gem size={10} />
              {gift.price}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
