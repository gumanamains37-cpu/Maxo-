import { ShieldAlert, Users, MessageSquare, Gift, Ban, CheckCircle2, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminD3Chart from '@/components/AdminD3Chart';

export default function AdminPage() {
  return (
    <div className="py-6 space-y-6 pb-32">
      <div className="flex items-center gap-2 mb-2">
         <ShieldAlert size={24} className="text-red-500" />
         <h1 className="text-2xl font-bold font-display">Admin Panel</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 flex flex-col items-center gap-1">
             <TrendingUp size={24} className="text-red-500" />
             <p className="text-xs text-gray-400 uppercase tracking-widest">Reports</p>
             <p className="text-2xl font-bold text-white">24</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex flex-col items-center gap-1">
             <Users size={24} className="text-blue-500" />
             <p className="text-xs text-gray-400 uppercase tracking-widest">Active Users</p>
             <p className="text-2xl font-bold text-white">1,254</p>
          </CardContent>
        </Card>
      </div>

      {/* Modern D3 Telemetry Analytics Section */}
      <AdminD3Chart />

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-glass border border-glass-border p-1 rounded-2xl h-12">
          <TabsTrigger value="users" className="rounded-xl data-[state=active]:bg-brand-primary">Users</TabsTrigger>
          <TabsTrigger value="rooms" className="rounded-xl data-[state=active]:bg-brand-primary">Rooms</TabsTrigger>
          <TabsTrigger value="gifts" className="rounded-xl data-[state=active]:bg-brand-primary">Gifts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="relative">
            <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search user ID or email..." className="bg-glass border-glass-border pl-12 h-12 rounded-2xl" />
          </div>
          
          <div className="space-y-3">
             {[1,2,3].map(i => (
                <div key={i} className="glass-card p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700" />
                      <div>
                         <p className="font-bold text-sm">Suspicious User {i}</p>
                         <p className="text-[10px] text-gray-500 uppercase">Reports: {9 + i}</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="text-red-500 hover:bg-red-500/10 h-8 w-8">
                         <Ban size={18} />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-green-500 hover:bg-green-500/10 h-8 w-8">
                         <CheckCircle2 size={18} />
                      </Button>
                   </div>
                </div>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="pt-4">
           <div className="py-20 text-center text-gray-500 glass-card">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              <p>Room management console</p>
           </div>
        </TabsContent>

        <TabsContent value="gifts" className="pt-4">
           <div className="py-20 text-center text-gray-500 glass-card">
              <Gift size={48} className="mx-auto mb-4 opacity-20" />
              <p>Gift economy controls</p>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
