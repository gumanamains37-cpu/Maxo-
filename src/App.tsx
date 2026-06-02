/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Wallet, MessageCircle, Plus, Search, Trophy, Settings, MessageSquare, Mic2, Sparkles, Star, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Toaster, toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from '@/components/Logo';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Pages
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RoomPage from '@/pages/RoomPage';
import ProfilePage from '@/pages/ProfilePage';
import WalletPage from '@/pages/WalletPage';
import AgencyPage from '@/pages/AgencyPage';
import AdminPage from '@/pages/AdminPage';
import MomentsPage from '@/pages/MomentsPage';
import RoomsPage from '@/pages/RoomsPage';
import VIPPage from '@/pages/VIPPage';
import VIPRoomsPage from '@/pages/VIPRoomsPage';
import MessagesPage from '@/pages/MessagesPage';
import CreateRoomPage from '@/pages/CreateRoomPage';
import GiftsPage from '@/pages/GiftsPage';

// Newly Audited Me Sub-pages
import SettingsPage from '@/pages/SettingsPage';
import StorePage from '@/pages/StorePage';
import BackpackPage from '@/pages/BackpackPage';
import LevelPage from '@/pages/LevelPage';
import InvitePage from '@/pages/InvitePage';
import CustomerServicePage from '@/pages/CustomerServicePage';
import EventCenterPage from '@/pages/EventCenterPage';
import AstrologyPage from '@/pages/AstrologyPage';
import FamilyPage from '@/pages/FamilyPage';
import HostCenterPage from '@/pages/HostCenterPage';
import VerificationPage from '@/pages/VerificationPage';

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isActive = (path: string) => {
    if (path === '/rooms') {
      return location.pathname === '/rooms' || location.pathname.startsWith('/room');
    }
    return location.pathname === path;
  };

  // Render luxurious styled icons with distinctive seamless color mapping
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#07080E] via-[#0E101E] to-[#07080E] backdrop-blur-3xl border-t border-white/10 py-3.5 px-6 flex justify-between items-center z-50 shadow-[0_-12px_45px_rgba(0,0,0,0.85)]">
      {/* 1. Home tab */}
      <Link 
        to="/" 
        className="flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 active:scale-90 group"
      >
        <motion.div 
          whileHover={{ scale: 1.15, rotate: 5 }}
          className={`p-1.5 rounded-2xl transition-all duration-300 ${
            isActive('/') 
              ? 'bg-amber-400/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)] border border-amber-400/20' 
              : 'text-gray-500 hover:text-amber-400 group-hover:text-amber-400/80'
          }`}
        >
          <Home size={20} className={isActive('/') ? 'stroke-[2.5] fill-amber-400/10' : 'stroke-[2]'} />
        </motion.div>
        <span className={`text-[8.5px] font-black tracking-widest uppercase transition-colors duration-300 ${isActive('/') ? 'text-amber-400 font-extrabold' : 'text-gray-500'}`}>Home</span>
      </Link>

      {/* 2. Room tab */}
      <Link 
        to="/rooms" 
        className="flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 active:scale-90 group"
      >
        <motion.div 
          whileHover={{ scale: 1.15, rotate: -5 }}
          className={`p-1.5 rounded-2xl transition-all duration-300 ${
            isActive('/rooms') 
              ? 'bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/20' 
              : 'text-gray-500 hover:text-purple-400 group-hover:text-purple-400/80'
          }`}
        >
          <Mic2 size={20} className={isActive('/rooms') ? 'stroke-[2.5] fill-purple-500/10' : 'stroke-[2]'} />
        </motion.div>
        <span className={`text-[8.5px] font-black tracking-widest uppercase transition-colors duration-300 ${isActive('/rooms') ? 'text-purple-400 font-extrabold' : 'text-gray-500'}`}>Room</span>
      </Link>

      {/* 3. Message tab */}
      <Link 
        to="/messages" 
        className="flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 active:scale-90 group relative"
      >
        <motion.div 
          whileHover={{ scale: 1.15, rotate: -5 }}
          className={`p-1.5 rounded-2xl transition-all duration-300 ${
            isActive('/messages') 
              ? 'bg-cyan-400/10 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)] border border-cyan-400/20' 
              : 'text-gray-500 hover:text-cyan-400 group-hover:text-cyan-400/80'
          }`}
        >
          <MessageSquare size={20} className={isActive('/messages') ? 'stroke-[2.5] fill-cyan-400/10' : 'stroke-[2]'} />
        </motion.div>
        <span className={`text-[8.5px] font-black tracking-widest uppercase transition-colors duration-300 ${isActive('/messages') ? 'text-cyan-400 font-extrabold' : 'text-gray-500'}`}>Message</span>
      </Link>

      {/* 4. Me (Profile) tab */}
      <Link 
        to="/profile" 
        className="flex flex-col items-center gap-1.5 flex-1 transition-all duration-300 active:scale-90 group"
      >
        <motion.div 
          whileHover={{ scale: 1.15, rotate: 5 }}
          className={`p-1.5 rounded-2xl transition-all duration-300 ${
            isActive('/profile') 
              ? 'bg-pink-400/10 text-pink-400 shadow-[0_0_15px_rgba(244,114,182,0.2)] border border-pink-400/20' 
              : 'text-gray-500 hover:text-pink-400 group-hover:text-pink-400/80'
          }`}
        >
          <User size={20} className={isActive('/profile') ? 'stroke-[2.5] fill-pink-400/10' : 'stroke-[2]'} />
        </motion.div>
        <span className={`text-[8.5px] font-black tracking-widest uppercase transition-colors duration-300 ${isActive('/profile') ? 'text-pink-400 font-extrabold' : 'text-gray-500'}`}>Me</span>
      </Link>
    </div>
  );
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const noHeaderPaths = ['/profile', '/', '/messages'];
  const isNoHeader = noHeaderPaths.some(path => location.pathname === path) || location.pathname.startsWith('/profile/');

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  React.useEffect(() => {
    if (location.pathname.startsWith('/room/')) {
      const parts = location.pathname.split('/');
      const rId = parts[2];
      if (rId && rId !== 'create') {
        setActiveRoomId(rId);
      }
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen pb-24 relative overflow-x-hidden bg-bg-dark text-white">
      {!isNoHeader && (
        <header className="px-6 py-4 flex justify-between items-center sticky top-0 bg-bg-dark/50 backdrop-blur-md z-40">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-gray-300">
              <Search size={22} />
            </Button>
            <Button variant="ghost" size="icon" className="text-gray-300">
              <Trophy size={22} />
            </Button>
          </div>
        </header>
      )}
      
      <main className={isNoHeader ? '' : 'px-6'}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="w-full"
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Persistent Audio/Video Room Core View with Smooth Handshake Transition */}
      <AnimatePresence>
        {activeRoomId && (
          <ErrorBoundary>
            <RoomPage 
              props={{
                roomId: activeRoomId,
                isMinimized: activeRoomId ? !location.pathname.startsWith('/room/' + activeRoomId) : false,
                onCloseRoom: () => setActiveRoomId(null)
              }}
            />
          </ErrorBoundary>
        )}
      </AnimatePresence>

      <BottomNav />
      <Toaster position="top-center" expand={true} richColors />
    </div>
  );
}

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090B]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.05, 1], opacity: 1 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-8"
        >
          <Logo size="xl" showText={true} />
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          user ? (
            <MainLayout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/moments" element={<MomentsPage />} />
                <Route path="/room/create" element={<CreateRoomPage />} />
                <Route path="/room/:roomId" element={<div className="min-h-screen bg-[#0C101A] flex items-center justify-center p-8 text-center text-sm font-semibold text-gray-500">Entering VIP lounge room...</div>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:userId" element={<MessagesPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/vip" element={<VIPPage />} />
                <Route path="/vip-rooms" element={<VIPRoomsPage />} />
                <Route path="/agency" element={<AgencyPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/gifts/:userId" element={<GiftsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/store" element={<StorePage />} />
                <Route path="/backpack" element={<BackpackPage />} />
                <Route path="/level" element={<LevelPage />} />
                <Route path="/invite" element={<InvitePage />} />
                <Route path="/support" element={<CustomerServicePage />} />
                <Route path="/events" element={<EventCenterPage />} />
                <Route path="/astrology" element={<AstrologyPage />} />
                <Route path="/family" element={<FamilyPage />} />
                <Route path="/host" element={<HostCenterPage />} />
                <Route path="/verification" element={<VerificationPage />} />
              </Routes>
            </MainLayout>
          ) : (
            <LoginPage />
          )
        } />
      </Routes>
    </Router>
  );
}
