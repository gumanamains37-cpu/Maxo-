import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Gift, Share2, Copy, Trophy, Check, UserPlus, Users } from 'lucide-react';
import { motion } from 'motion/react';

export default function InvitePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [partnerCode, setPartnerCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [referrerProfile, setReferrerProfile] = useState<any | null>(null);
  
  // Custom user referral code: derived from their short UID slice
  const inviteCode = profile?.uid ? profile.uid.slice(0, 8).toUpperCase() : '...';

  useEffect(() => {
    async function checkExistingReferrer() {
      if (!profile?.uid) return;
      const rId = (profile as any)?.referredBy;
      if (rId) {
        try {
          const rSnap = await getDoc(doc(db, 'users', rId));
          if (rSnap.exists()) {
            setReferrerProfile(rSnap.data());
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }
    checkExistingReferrer();
  }, [profile]);

  const copyReferral = () => {
    const link = `${window.location.origin}/login?ref=${inviteCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied to clipboard!');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Referral code copied!');
  };

  const handleApplyReferral = async () => {
    if (!profile) return;
    if (!partnerCode.trim()) {
      toast.error('Please enter a valid referral code!');
      return;
    }

    const cleanCode = partnerCode.trim().toUpperCase();
    if (cleanCode === inviteCode) {
      toast.error('You cannot refer yourself!');
      return;
    }

    if (referrerProfile || (profile as any)?.referredBy) {
      toast.error('You have already applied a referral code!');
      return;
    }

    setClaiming(true);
    try {
      // Find user matching partner Code by searching users collection
      const usersRef = collection(db, 'users');
      const allUsersQuery = await getDocs(usersRef);
      
      let matchedUid = '';
      let matchedUserCoins = 0;
      let matchedUserName = '';

      allUsersQuery.forEach(docSnap => {
        const id = docSnap.id;
        if (id.slice(0, 8).toUpperCase() === cleanCode) {
          matchedUid = id;
          matchedUserCoins = docSnap.data().coins || 0;
          matchedUserName = docSnap.data().displayName || 'Friend';
        }
      });

      if (!matchedUid) {
        toast.error('Invalid referral code! User not found.');
        return;
      }

      // Update both users with +50 coins
      const myRef = doc(db, 'users', profile.uid);
      const partnerRef = doc(db, 'users', matchedUid);

      await updateDoc(myRef, {
        coins: (profile.coins || 0) + 50,
        referredBy: matchedUid
      });

      await updateDoc(partnerRef, {
        coins: matchedUserCoins + 50
      });

      // Save a record of this referral
      const referralDocId = `${matchedUid}_${profile.uid}`;
      await setDoc(doc(db, 'referrals', referralDocId), {
        referrerId: matchedUid,
        referredId: profile.uid,
        referredName: profile.displayName,
        referredPhoto: profile.photoURL || '',
        timestamp: new Date().toISOString()
      });

      setReferrerProfile({ displayName: matchedUserName });
      toast.success(`Succesfully linked referred! Received +50 Coins bonus bonus!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to link referral. Check network connection.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white font-sans pb-32">
      {/* Sticky Header */}
      <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-bg-dark/50 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full">
            <ChevronLeft size={24} />
          </Button>
          <Gift size={22} className="text-pink-500" />
          <h1 className="text-xl font-black">Invite Partners</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-pink-500/20 via-purple-600/10 to-transparent p-6 rounded-[32px] border border-pink-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 text-7xl opacity-15 select-none animate-pulse">🎁</div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] bg-pink-500/15 border border-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full uppercase font-black tracking-widest inline-block">Double Cash Reward</span>
            <h2 className="text-lg font-black tracking-tight leading-tight">Link Friends, Get Coins!</h2>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[240px]">Invite any matching user to connect, and both accounts instantly unlock +50 Coins into their wallets.</p>
          </div>
        </div>

        {/* Share Code Card */}
        <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Your Invitation Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center space-y-1.5 relative group">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Referral Code</span>
              <p className="text-xl font-black tracking-wider text-pink-500">{inviteCode}</p>
              <Button size="icon" variant="ghost" onClick={copyCode} className="absolute top-1 right-1 h-7 w-7 text-gray-400 hover:text-white rounded-full">
                <Copy size={12} />
              </Button>
            </div>

            <button 
              onClick={copyReferral}
              className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center space-y-1.5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
            >
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Share Option</span>
              <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-400">
                <Share2 size={12} /> Copy Link
              </div>
            </button>
          </div>
        </div>

        {/* Input referral code block */}
        <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Apply Friend's Code</h3>

          {referrerProfile ? (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex gap-3.5 items-center">
              <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl">
                <Check size={20} strokeWidth={3} />
              </div>
              <div>
                <p className="text-xs font-black text-white">Referred Applied Successfully</p>
                <p className="text-[10px] text-gray-400">Referred by {referrerProfile.displayName || 'Friend'}. Enjoy your starting +50 coin bonus!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input 
                value={partnerCode}
                onChange={e => setPartnerCode(e.target.value)}
                placeholder="Enter 8-digit invite code (e.g. A1B2C3D4)"
                className="h-12 rounded-2xl bg-white/5 border-white/10 font-bold placeholder-gray-500 text-white focus-visible:ring-pink-500 text-center uppercase tracking-wider"
              />
              <Button
                disabled={claiming || !partnerCode.trim()}
                onClick={handleApplyReferral}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 font-extrabold text-xs uppercase tracking-wider shadow-md border-none"
              >
                {claiming ? 'Linking...' : 'Connect and Claim Reward'}
              </Button>
            </div>
          )}
        </div>

        {/* Friends referral list info */}
        <div className="bg-white/5 border border-white/5 rounded-[32px] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Users size={14} className="text-pink-400" /> Referred Friends History
            </h3>
          </div>

          <div className="text-center py-6 text-xs text-gray-500 space-y-1">
            <UserPlus className="mx-auto text-gray-600 mb-1" size={24} />
            <p className="font-extrabold text-gray-400">Refer accounts to unlock badges</p>
            <p className="text-[10px] max-w-[200px] mx-auto text-gray-500">Every account that applies your referral code will appear here with double coins rewarded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
