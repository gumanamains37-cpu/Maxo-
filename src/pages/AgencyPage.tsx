import { Building2, Users, TrendingUp, Search, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AgencyPage() {
  return (
    <div className="py-6 space-y-8 pb-32">
      <div className="glass-card p-6 gaming-gradient">
         <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
               <Building2 size={32} className="text-white" />
            </div>
            <div>
               <h2 className="text-2xl font-bold">Star Agency</h2>
               <p className="text-white/60 text-sm">Rank: #12 Global</p>
            </div>
         </div>
         <div className="grid grid-cols-3 gap-2">
            <div className="bg-black/20 p-3 rounded-xl text-center">
               <p className="text-lg font-bold">124</p>
               <p className="text-[8px] opacity-60 uppercase">Members</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl text-center">
               <p className="text-lg font-bold">45.2K</p>
               <p className="text-[8px] opacity-60 uppercase">Monthly Dms</p>
            </div>
            <div className="bg-black/20 p-3 rounded-xl text-center">
               <p className="text-lg font-bold">$1,200</p>
               <p className="text-[8px] opacity-60 uppercase">Pool</p>
            </div>
         </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
                <Users size={18} className="text-brand-primary" />
                Agency Members
            </h3>
            <Button size="sm" variant="ghost" className="text-brand-secondary">
                <UserPlus size={16} className="mr-2" /> Invite
            </Button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search members..." className="bg-glass border-glass-border pl-12 h-12 rounded-2xl" />
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-4">
               <Avatar>
                  <AvatarImage src={`https://api.dicebear.com/7.x/adventurer/svg?seed=member${i}`} />
                  <AvatarFallback>M</AvatarFallback>
               </Avatar>
               <div className="flex-1">
                  <p className="font-bold text-sm">Star Creator {i}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Top Contributor</p>
               </div>
               <div className="text-right">
                  <p className="text-xs font-bold text-brand-secondary">+4,500</p>
                  <TrendingUp size={12} className="ml-auto text-brand-secondary" />
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
