import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, MessageSquare, Send, Headphones, CheckCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface FormattedMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export default function CustomerServicePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<FormattedMsg[]>([]);
  const [newText, setNewText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch or subscribe to user support messages subcollection
    const colPath = `support_chats/${profile.uid}/messages`;
    const q = query(
      collection(db, colPath),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsub = safeOnSnapshot(q, (snapshot) => {
      const msgs: FormattedMsg[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        msgs.push({
          id: docSnap.id,
          senderId: d.senderId,
          senderName: d.senderName,
          text: d.text,
          createdAt: d.createdAt
        });
      });
      setMessages(msgs);
      setLoading(false);
      
      // Auto scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [profile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !newText.trim()) return;

    const textToSend = newText.trim();
    setNewText('');
    setSending(true);

    try {
      const colPath = `support_chats/${profile.uid}/messages`;
      
      // 1. Send User message to Firestore
      await addDoc(collection(db, colPath), {
        senderId: profile.uid,
        senderName: profile.displayName,
        text: textToSend,
        createdAt: serverTimestamp()
      });

      // 2. Automated AI Assistant replies realistic solutions based on keyword recognition!
      setTimeout(async () => {
        let responseText = "Hello! Thank you for contacting Yalla Party Chat Support. An agent has received your request and will address any issues soon. Feel free to explain more!";
        
        const lowerText = textToSend.toLowerCase();
        if (lowerText.includes('coin') || lowerText.includes('diamond') || lowerText.includes('wallet')) {
          responseText = "Understood. For currency, coin balances, or wallet additions: Go to your Wallet page, select a credit amount, and purchase. If your credit transaction fails, please attach your payment ID here.";
        } else if (lowerText.includes('agency') || lowerText.includes('join')) {
          responseText = "For Agency issues: You can create or join an Agency on your 'My Agency' page. If you are already an agent, you can start host activities in the Voice Rooms to earn monthly pool payouts!";
        } else if (lowerText.includes('badge') || lowerText.includes('frame') || lowerText.includes('backpack')) {
          responseText = "Personal Decor: Make sure to equip any badges or neon avatar frames that you purchased from the Nobility Store inside 'My Backpack' by clicking 'Equip'.";
        } else if (lowerText.includes('level') || lowerText.includes('xp')) {
          responseText = "Exp growth: Spend time active on microphone seats inside chat rooms to earn automatic social level experience (+5 XP/minute) or complete Check-In inside 'Elite Levels'.";
        } else if (lowerText.includes('mute') || lowerText.includes('seat')) {
          responseText = "Room seating: Room Hosts and Super Admins hold authority to mute users or lock seats. Please reach out to the room's Host or file a report if a seat moderator breaks guidelines.";
        }

        // Add Support Bot response to Firestore
        await addDoc(collection(db, colPath), {
          senderId: 'ai_support_bot',
          senderName: 'Yalla Help Assistant 🤖',
          text: responseText,
          createdAt: serverTimestamp()
        });
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.error('Could not send message. Check connectivity.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14] z-[100] flex flex-col text-white font-sans overflow-hidden">
      {/* Top Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-[#121620] border-b border-white/5 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full">
            <ChevronLeft size={24} />
          </Button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Headphones size={20} />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#121620] rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-1.5 leading-tight">Interactive Helpdesk</h1>
            <p className="text-[10px] text-green-400 uppercase font-black tracking-widest leading-none">Online & Responsive</p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 no-scrollbar bg-[#0B0E14]">
        {/* Help Banner card */}
        <div className="bg-gradient-to-r from-purple-500/10 to-[#121620] rounded-2xl p-4 border border-purple-500/15 flex gap-4 items-start mb-2">
          <Sparkles className="text-purple-400 shrink-0 mt-0.5 animate-bounce" size={16} />
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold text-white">How Can We Help You?</h4>
            <p className="text-[10px] text-gray-400 leading-relaxed">Ask about levels, coins, agency joins, cosmetic borders, or room moderating to get instant answers from our automated agent in real-time!</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 text-xs py-10">Starting support thread...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-10">No messages in ticket history. Write a message below to start support conversation!</div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === profile?.uid;
            return (
              <div 
                key={m.id} 
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <span className="text-[9px] text-gray-500 font-bold mb-1 px-1.5">{m.senderName}</span>
                
                <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-md ${
                  isMe 
                    ? 'bg-purple-600 text-white rounded-tr-none' 
                    : 'bg-[#121620]/80 border border-white/5 text-slate-200 rounded-tl-none'
                }`}>
                  {m.text}
                </div>
                
                <div className="flex items-center gap-1 mt-1 px-1.5">
                  <span className="text-[8px] text-gray-500">
                    {m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending'}
                  </span>
                  {isMe && <CheckCheck size={10} className="text-purple-400" />}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Message Footer bar */}
      <form 
        onSubmit={handleSend}
        className="p-4 bg-[#12161E] border-t border-white/5 flex gap-3 shrink-0 items-center relative z-20"
      >
        <Input 
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Ask assistance (coins, agency, level...)"
          className="flex-1 h-12 rounded-xl bg-white/5 border-white/10 placeholder-gray-500 text-white text-xs font-bold"
        />
        <Button 
          type="submit"
          disabled={!newText.trim() || sending}
          className="w-12 h-12 rounded-xl bg-purple-600 hover:bg-purple-500 text-white p-0 flex items-center justify-center shadow-lg cursor-pointer shrink-0 border-none"
        >
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}
