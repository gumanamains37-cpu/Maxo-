import { useEffect, useState } from 'react';
import { collection, query, where, limit } from 'firebase/firestore';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { Room } from '@/types';
import { motion } from 'motion/react';
import { Crown, Sparkles, Users, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

export default function VIPRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Safest, index-free real-time sub. Pulls rooms and filters cleanly client-side
    const q = query(collection(db, 'rooms'), limit(50));

    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      
      // Filter for high luxury, active social, or party categories client-side
      const filtered = allRooms.filter(r => 
        r.isLive !== false && 
        (r.backgroundTheme === 'luxury' || 
         ['luxury', 'social', 'party', 'singing', 'gaming'].includes(r.category || '') ||
         r.memberCount >= 5)
      );

      setRooms(filtered);
    }, (error) => {
      console.warn("VIP rooms snapshot listener issue or offline:", error);
    });

    return () => unsubscribe();
  }, []);

  if (profile && !profile.isVIP) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-6">
        <div className="w-20 h-20 bg-brand-accent/20 rounded-full flex items-center justify-center text-brand-accent">
          <Lock size={40} />
        </div>
        <h2 className="text-2xl font-bold">VIP Access Only</h2>
        <p className="text-gray-400 max-w-xs">
          Exclusive rooms are reserved for our VIP members. Upgrade your status to join the elite clubs.
        </p>
        <Button onClick={() => navigate('/vip')} className="bg-brand-accent text-bg-dark font-bold px-8 py-6 rounded-2xl">
          Upgrade to VIP
        </Button>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-8 pb-32">
      <header className="flex items-center gap-4 px-2">
        <div className="bg-brand-accent p-2 rounded-xl">
          <Crown size={24} className="text-bg-dark" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">VIP Rooms</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Exclusive Lounges</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.length > 0 ? (
          rooms.map((room) => (
            <motion.div
              key={room.id}
              whileHover={{ y: -5 }}
              onClick={() => navigate(`/room/${room.id}`)}
              className="glass-card overflow-hidden group cursor-pointer border-brand-accent/20 bg-gradient-to-br from-brand-accent/5 to-transparent"
            >
              <div className="h-40 bg-zinc-800 relative overflow-hidden">
                <img 
                  src={`https://images.unsplash.com/photo-1566417713940-db791f46b99c?q=80&w=2070&auto=format&fit=crop`} 
                  className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-brand-accent text-bg-dark border-none font-bold">
                    VIP LOUNGE
                  </Badge>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                   <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-bg-dark bg-zinc-700 overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=user${i}${room.id}`} />
                        </div>
                      ))}
                   </div>
                   <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                      {room.memberCount} ONLINE
                   </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-bold text-lg group-hover:text-brand-accent transition-colors">{room.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-1">{room.description}</p>
                <div className="pt-2 flex items-center gap-2">
                   <Sparkles size={14} className="text-brand-accent" />
                   <span className="text-[10px] text-brand-accent font-bold uppercase tracking-wider">Premium Experience</span>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
             <Users size={48} className="mx-auto text-gray-700" />
             <p className="text-gray-500">No VIP events currently active. Check back later!</p>
          </div>
        )}
      </div>
    </div>
  );
}
