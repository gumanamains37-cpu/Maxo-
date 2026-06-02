import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Users, ShieldCheck, Trophy, Sparkles, MessageSquare, Plus, UserCheck, Flame, Gift } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const SAMPLE_FAMILIES = [
  { id: 'fam_1', name: 'Empire Kings 👑', leader: 'Zack_Pro', members: 48, maxMembers: 100, level: 8, exp: 8400, desc: 'Dominating mic battles and daily room check-ins! Group power!' },
  { id: 'fam_2', name: 'Sweet Harmonies 🎙️', leader: 'Maya_Singer', members: 32, maxMembers: 50, level: 4, exp: 3200, desc: 'Singers, musicians & chill talk listeners always active.' }
];

export default function FamilyPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'clans' | 'missions' | 'perks'>('clans');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clanName, setClanName] = useState('');
  const [clanDesc, setClanDesc] = useState('');
  const [myGuild, setMyGuild] = useState<any>(null); // State indicating if user joined a guild

  const handleCreateClan = () => {
    if (!clanName.trim()) {
      toast.error('Please enter a valid family name!');
      return;
    }
    const cost = 30000;
    if ((profile?.coins ?? 0) < cost) {
      toast.error(`Insufficient Gold Coins! Creating a Family Guild costs 30,000 Coins. (Your Balance: ${profile?.coins ?? 0})`);
      return;
    }
    
    // Simulate creation
    setMyGuild({
      id: 'fam_user',
      name: `${clanName} ✨`,
      leader: profile?.displayName || 'Me',
      members: 1,
      maxMembers: 50,
      level: 1,
      exp: 0,
      desc: clanDesc || 'Welcome to our premium family branch!'
    });
    setShowCreateModal(false);
    toast.success(`🎉 Congratulations! ${clanName} has been officially recorded in the Family Registry!`);
  };

  const handleJoin = (cName: string) => {
    setMyGuild({
      id: 'fam_joined',
      name: cName,
      leader: 'Leader',
      members: 33,
      maxMembers: 100,
      level: 5,
      exp: 4200,
      desc: 'Joined active clan!'
    });
    toast.success(`Successfully joined ${cName}! Wave to other family members!`);
  };

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Sticky Top Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-[#0C101A]/95 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
          <ChevronLeft size={20} />
        </Button>
        <Users size={22} className="text-pink-500 animate-pulse" />
        <h1 className="text-lg font-black uppercase tracking-wider">Family Guilds</h1>
      </div>

      <div className="px-5 space-y-6 pt-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-900/10 to-indigo-950/40 border border-indigo-500/15 p-5 rounded-[28px] relative overflow-hidden flex justify-between items-center">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-indigo-300">Family Guild System</h2>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
              Assemble friends into powerful Family Guilds. Win weekly match cycles and earn exclusive chat bubbles!
            </p>
          </div>
          {!myGuild && (
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-xl text-[10px] uppercase font-black tracking-widest h-9 px-3 shrink-0 active:scale-95 transition-all"
            >
              <Plus size={12} className="mr-1" /> Create
            </Button>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 pb-0.5 gap-4">
          {[
            { id: 'clans', label: 'Active Families' },
            { id: 'missions', label: 'Clans Missions' },
            { id: 'perks', label: 'VIP Perks' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === t.id 
                  ? 'border-pink-500 text-pink-400 font-extrabold' 
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Current lists */}
        {activeTab === 'clans' && (
          <div className="space-y-4">
            {myGuild && (
              <div className="bg-[#13192B]/50 border border-green-500/25 p-5 rounded-[28px] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-[8px] uppercase tracking-widest mb-1 font-black">YOUR GUILD MEMBERSHIP</Badge>
                    <h3 className="text-base font-black text-white">{myGuild.name}</h3>
                  </div>
                  <Badge className="bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-black">Level {myGuild.level}</Badge>
                </div>
                <p className="text-[10px] text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-xl italic">
                  "{myGuild.desc}"
                </p>
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <p>👑 Leader: <span className="font-extrabold text-white">{myGuild.leader}</span></p>
                  <p>👥 Members: <span className="font-extrabold text-white">{myGuild.members}/{myGuild.maxMembers}</span></p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setMyGuild(null)} className="w-full text-red-400 hover:text-red-300 border-red-500/20 hover:bg-red-500/5 text-[10px] uppercase font-black tracking-wider rounded-xl">
                  Leave Clan
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-[9px] uppercase font-black text-gray-500 tracking-wider">Top Recruiter Families</p>
              {SAMPLE_FAMILIES.map(item => (
                <div key={item.id} className="bg-[#121624] border border-white/5 p-4 rounded-2xl space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-extrabold text-white flex items-center gap-2">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Leader: {item.leader}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-pink-400 font-black">Level {item.level}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">{item.members}/{item.maxMembers} mems</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 italic bg-black/25 p-2.5 rounded-lg">
                    "{item.desc}"
                  </p>
                  <Button 
                    size="sm"
                    disabled={!!myGuild}
                    onClick={() => handleJoin(item.name)}
                    className="w-full bg-white/5 text-white hover:bg-white/10 rounded-xl text-[10px] uppercase font-black"
                  >
                    Send Join Request
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: family tasks */}
        {activeTab === 'missions' && (
          <div className="space-y-3 bg-[#121624] border border-white/5 p-4 rounded-2xl">
            <h4 className="text-[10px] font-black uppercase text-pink-400 tracking-widest text-center mt-1">Today Clan Workouts</h4>
            {[
              { task: 'Family Room Check-in', desc: '5 members join same mic room for 15 minutes', coins: '+500 EXP', done: false },
              { task: 'Send 3 Guild Gifts', desc: 'Family members gift stars or coins to broadcaster', coins: '+1,200 EXP', done: false },
              { task: 'Global Recruits', desc: 'Add 1 new active level-3 member', coins: '+800 EXP', done: true }
            ].map((t, idx) => (
              <div key={idx} className="p-3 bg-black/40 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-black text-white">{t.task}</p>
                  <p className="text-[9px] text-gray-500 mt-1">{t.desc}</p>
                </div>
                {t.done ? (
                  <span className="text-[8px] bg-green-500/15 text-green-400 font-black px-2 py-0.5 rounded uppercase">Verified</span>
                ) : (
                  <span className="text-[8px] bg-amber-500/15 text-amber-500 font-black px-2 py-0.5 rounded uppercase">{t.coins}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Perks */}
        {activeTab === 'perks' && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: MessageSquare, title: 'Visual Bubble', desc: 'Personalized exclusive cyan chat framing bubble' },
              { icon: FlagCheckIcon, title: 'Battle Emblem', desc: 'Customizable matching badge logo next to name' },
              { icon: Gift, title: 'Weekly Chest', desc: 'Weekly coins allowance drops directly in wallet' },
              { icon: ShieldCheck, title: 'Guild Ingress', desc: 'Special neon join notifications inside rooms' }
            ].map((p, idx) => (
              <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center flex flex-col justify-between items-center h-28">
                <p.icon className="text-pink-400 w-6 h-6" />
                <div>
                  <h5 className="text-[10px] font-black text-white uppercase">{p.title}</h5>
                  <p className="text-[8px] text-gray-500 mt-0.5 leading-normal">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md">
          <div className="w-full max-w-sm bg-[#121624] border border-white/10 p-6 rounded-[28px] space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-widest text-center">CREATE GUILD CLAN</h3>
            <p className="text-[9px] text-amber-500 font-extrabold uppercase text-center">Requirements: 30,000 Coins fee</p>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 uppercase font-black ml-1">Clan Name</label>
                <Input 
                  value={clanName}
                  onChange={e => setClanName(e.target.value)}
                  placeholder="e.g. Red Vipers"
                  className="h-11 rounded-xl bg-[#0C101A] border-white/10 text-white font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 uppercase font-black ml-1">Signature Description</label>
                <textarea 
                  value={clanDesc}
                  onChange={e => setClanDesc(e.target.value)}
                  placeholder="e.g. Aiming for the global leaderboard..."
                  className="rounded-xl bg-[#0C101A] border border-white/10 text-white font-bold resize-none h-16 text-xs p-3 w-full"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1 rounded-xl hover:bg-white/5 text-white font-bold h-11 text-xs uppercase">
                  Cancel
                </Button>
                <Button onClick={handleCreateClan} className="flex-1 bg-gradient-to-r from-pink-500 to-indigo-500 text-white font-bold h-11 rounded-xl text-xs uppercase">
                  Create Clan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick placeholder fallback for FlagCheck icon
const FlagCheckIcon = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);
