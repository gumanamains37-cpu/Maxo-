import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, BarChart2, Star, ShieldAlert, Award, Compass, Sparkles, Clock, Flame, ShieldCheck, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function HostCenterPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'analytics' | 'contract'>('analytics');

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-[#0C101A]/95 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
          <ChevronLeft size={20} />
        </Button>
        <Star size={22} className="text-yellow-400 animate-spin-slow" />
        <h1 className="text-lg font-black uppercase tracking-wider">Host Center</h1>
      </div>

      <div className="px-5 space-y-6 pt-4">
        {/* Verification Status */}
        <div className="bg-gradient-to-r from-amber-950/40 via-yellow-900/15 to-amber-950/40 border border-yellow-500/20 p-5 rounded-[28px] relative overflow-hidden">
          <div className="flex gap-4 items-center">
            <div className="w-11 h-11 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center border border-yellow-500/20">
              <Award size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Approved Broadcaster Agent</h3>
                <Badge className="bg-green-500/15 text-green-400 border border-green-500/25 text-[8px] h-3.5 font-bold">ACTIVE</Badge>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                Your host contract tier is verified under Agency ID: 3881. You receive 35% cash-out allocation dividends.
              </p>
            </div>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex border-b border-white/5 pb-0.5 gap-4">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'analytics' 
                ? 'border-yellow-500 text-yellow-400 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            Earnings Analytics
          </button>
          <button
            onClick={() => setActiveTab('contract')}
            className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'contract' 
                ? 'border-yellow-500 text-yellow-400 font-extrabold' 
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            Hosting Contract
          </button>
        </div>

        {/* Analytics Workspace */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest pl-1">Daily broad-hours tracker</p>
            
            {/* Stat row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#121624] border border-white/5 p-4 rounded-2xl">
                <p className="text-[9px] text-gray-500 uppercase font-black">Today Broad Hours</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock size={16} className="text-yellow-500" />
                  <p className="text-base font-black text-white">4.8 Hours</p>
                </div>
              </div>
              <div className="bg-[#121624] border border-white/5 p-4 rounded-2xl">
                <p className="text-[9px] text-gray-500 uppercase font-black">This Month Accumulated</p>
                <div className="flex items-center gap-2 mt-2">
                  <Clock size={16} className="text-yellow-500" />
                  <p className="text-base font-black text-white">42.5 Hours</p>
                </div>
              </div>
            </div>

            {/* Exp matching */}
            <div className="bg-[#121624] border border-white/5 p-4 rounded-2xl space-y-4">
              <p className="text-[10px] text-zinc-300 font-black text-center uppercase tracking-wider">MONTHLY EARNING DIAGNOSTICS</p>
              
              <div className="divide-y divide-white/5 bg-black/30 p-2.5 rounded-xl space-y-3.5">
                <div className="flex justify-between text-xs py-1">
                  <span className="text-gray-500 uppercase font-black text-[9px]">Gifts Recipient Revenue</span>
                  <span className="font-extrabold text-white">352,000 Coins Value</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-gray-500 uppercase font-black text-[9px]">Calculated Cashout Dividends</span>
                  <span className="font-black text-green-400">$123.20 USD</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span className="text-gray-500 uppercase font-black text-[9px]">Active room microphone streak</span>
                  <span className="font-extrabold text-white">12 Days</span>
                </div>
              </div>

              <Button 
                onClick={() => toast.success('Transferring host cash-out requests to verified bank systems... Wait details in mail')}
                className="w-full bg-[#1C223E] text-white hover:bg-[#252C50] text-[10px] uppercase font-black tracking-wider h-11 rounded-xl"
              >
                📥 Trigger Cash-out Settlement
              </Button>
            </div>
          </div>
        )}

        {/* Contract credentials */}
        {activeTab === 'contract' && (
          <div className="space-y-4 bg-[#121624] border border-white/5 p-5 rounded-[28px]">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <ShieldCheck size={16} className="text-yellow-500" />
              <span className="text-xs font-black uppercase tracking-wider text-yellow-300">Contract Agency ID Card</span>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300">
              <p>📍 Contract Status: <span className="font-black text-white">Approved Tier A</span></p>
              <p>👔 Agency Guild Name: <span className="font-black text-white">Hyper Star Media Inc.</span></p>
              <p>📅 Verification Date: <span className="font-black text-zinc-400">2026-05-12</span></p>
              <p>🛡️ Face ID Match Check: <span className="font-black text-green-400">PASSED</span></p>
              
              <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-[10px] text-yellow-300 leading-normal">
                Hosts are required to stick to community mic broadcast rules. Multi-stream violation attempts or unapproved sound effects filters result in automatic class deduction status.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
