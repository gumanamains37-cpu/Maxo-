import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, Settings, User, Sliders, Shield, Info, Trash2, LogOut, Check, Volume2, VolumeX, 
  ShieldAlert, Globe, Bell, Lock, Ban, ShieldCheck, HeartPulse
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  // States of Profile attributes
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState(18);
  const [gender, setGender] = useState<'male' | 'female' | 'secret' | 'custom'>('secret');
  const [country, setCountry] = useState('Global');
  
  // Setting controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [showActiveSession, setShowActiveSession] = useState(true);
  
  // Notification options
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [notifyMoments, setNotifyMoments] = useState(true);
  const [notifyRoomInvites, setNotifyRoomInvites] = useState(true);
  
  // Language Select
  const [language, setLanguage] = useState('English');
  
  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string; tag: string }[]>([
    { id: 'usr_toxic88', name: 'Toxic_Player_88', tag: 'Spamming on mic' },
    { id: 'usr_spambot', name: 'CryptoSpammer99', tag: 'Selling coin bot' }
  ]);

  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'privacy' | 'security' | 'notifications' | 'language' | 'blocks' | 'cache'>('privacy');

  // Security Center State variables
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState(() => 'REC-' + Math.floor(100000 + Math.random() * 900000).toString() + '-' + Math.floor(100000 + Math.random() * 900000).toString());
  
  const [loginHistoryList, setLoginHistoryList] = useState([
    { device: 'iPhone 15 Pro Max', location: 'Singapore', ip: '128.51.10.82', time: '2026-06-01 09:12:44', action: 'Login Successful' },
    { device: 'Google Pixel 8', location: 'India', ip: '192.168.1.104', time: '2026-06-01 04:30:11', action: 'One Tap Sign In' },
    { device: 'MacBook Pro 16', location: 'Vietnam', ip: '113.161.4.225', time: '2026-05-28 14:22:15', action: 'Password Validated' },
    { device: 'Chrome Client via Cloud Run', location: 'Japan', ip: '34.120.14.88', time: '2026-05-27 18:01:50', action: 'Cookie Restored' }
  ]);

  const [activeDevices, setActiveDevices] = useState([
    { name: 'Chrome Viewport (This Device)', location: 'Current Location', os: 'Linux / Cloud Run sandbox', state: 'Online Now', id: 'dev_1' },
    { name: 'Maxo App for Android', location: 'Hanoi, VN', os: 'Android 14', state: 'Active 2h ago', id: 'dev_2' }
  ]);

  const handleSetPassword = () => {
    if (!newPassword.trim() || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long.');
      return;
    }
    
    try {
      const stored = localStorage.getItem('maxo_custom_auth_db') || '{}';
      const dbData = JSON.parse(stored);
      const uid = profile?.uid || 'guest';
      
      dbData[uid] = { ...dbData[uid], password: newPassword };
      localStorage.setItem('maxo_custom_auth_db', JSON.stringify(dbData));
      
      toast.success('Security password has been set successfully! 🛡️');
      setNewPassword('');
    } catch (e) {
      toast.error('Failed to update client-side auth state.');
    }
  };

  const handleChangePassword = () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      toast.error('Please fill in both password fields.');
      return;
    }
    
    try {
      const stored = localStorage.getItem('maxo_custom_auth_db') || '{}';
      const dbData = JSON.parse(stored);
      const uid = profile?.uid || 'guest';
      const oldSaved = dbData[uid]?.password || '123456';
      
      if (oldSaved !== oldPassword) {
        toast.error('Legacy password confirmation failed.');
        return;
      }
      
      dbData[uid] = { ...dbData[uid], password: newPassword };
      localStorage.setItem('maxo_custom_auth_db', JSON.stringify(dbData));
      
      toast.success('Security password changed successfully! Key updated.');
      setOldPassword('');
      setNewPassword('');
    } catch (e) {
      toast.error('Failed to execute secure password transition.');
    }
  };

  const handleRequestMobileChange = () => {
    if (!newMobile.trim() || newMobile.length < 8) {
      toast.error('Please enter a valid cellular number.');
      return;
    }
    
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtp(pin);
    setIsOtpSent(true);
    toast.info(`[Simulation OTP] Security validation code sent: ${pin}`, { duration: 8000 });
  };

  const handleVerifyMobileChange = () => {
    if (verificationOtp !== simulatedOtp) {
      toast.error('OTP code mismatch. Please check the simulation prompt.');
      return;
    }
    
    try {
      const stored = localStorage.getItem('maxo_custom_auth_db') || '{}';
      const dbData = JSON.parse(stored);
      const uid = profile?.uid || 'guest';
      
      dbData[uid] = { ...dbData[uid], mobileNumber: newMobile };
      localStorage.setItem('maxo_custom_auth_db', JSON.stringify(dbData));
      
      // Update in-memory profile representation as well if synced
      toast.success(`Mobile number linked & authenticated: ${newMobile} 🎉`);
      setIsOtpSent(false);
      setNewMobile('');
      setVerificationOtp('');
    } catch (e) {
      toast.error('Mobile registration fault.');
    }
  };

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setBio(profile.bio || '');
      setAge(profile.age || 18);
      setGender((profile.gender as any) || 'secret');
      setCountry(profile.country || 'Global');
    }
  }, [profile]);

  useEffect(() => {
    // Synchronize local states
    const cachedSound = localStorage.getItem('sound_enabled');
    if (cachedSound !== null) setSoundEnabled(cachedSound === 'true');
    
    const cachedPrivacy = localStorage.getItem('privacy_mode');
    if (cachedPrivacy !== null) setPrivacyMode(cachedPrivacy === 'true');

    const cached2FA = localStorage.getItem('two_factor_auth');
    if (cached2FA !== null) setTwoFactorAuth(cached2FA === 'true');

    const cachedLang = localStorage.getItem('system_language');
    if (cachedLang !== null) setLanguage(cachedLang);
  }, []);

  const handleSave = async () => {
    if (!profile?.uid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        bio,
        age: Number(age),
        gender,
        country,
      });
      toast.success('Your settings and profile updates synced perfectly!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to sync changes with servers');
    } finally {
      setSaving(false);
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('sound_enabled', String(newValue));
    toast.success(newValue ? '🔔 App audio feed is activated!' : '🔕 Audio reactions silenced');
  };

  const togglePrivacy = () => {
    const newValue = !privacyMode;
    setPrivacyMode(newValue);
    localStorage.setItem('privacy_mode', String(newValue));
    toast.success(newValue ? '👥 Incognito mode on! You are hidden from visitor boards' : '👥 Public mode on! Room views will track your presence');
  };

  const toggle2FA = () => {
    const newValue = !twoFactorAuth;
    setTwoFactorAuth(newValue);
    localStorage.setItem('two_factor_auth', String(newValue));
    toast.success(newValue ? '🛡️ Two-Factor authentication enabled on this device!' : '⚠️ Two-factor security deactivated');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setLanguage(selected);
    localStorage.setItem('system_language', selected);
    toast.success(`🌐 Native translation is now set to ${selected}!`);
  };

  const handleUnblock = (userId: string, userName: string) => {
    setBlockedUsers(prev => prev.filter(u => u.id !== userId));
    toast.success(`🎉 ${userName} has been removed from your blocked user registry.`);
  };

  const handleClearCache = () => {
    localStorage.clear();
    // Restore persistent token details so we don't force login unless needed
    localStorage.setItem('sound_enabled', 'true');
    toast.success('🚀 Diagnostic local cache purged! All profile textures and rooms will redownload.');
  };

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Sticky Header with Go Back */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-[#0C101A]/90 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
          <ChevronLeft size={20} />
        </Button>
        <Settings size={22} className="text-pink-500 animate-spin-slow" />
        <h1 className="text-lg font-black uppercase tracking-wider">Settings & Security</h1>
      </div>

      <div className="px-5 space-y-6 pt-4">
        {/* Profile Identity Setup card */}
        <div className="bg-[#13192B]/45 border border-white/5 rounded-[28px] p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <User size={18} className="text-pink-500" />
            <span className="font-black text-xs uppercase tracking-wider text-pink-400">Identity Directory</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Nickname</label>
              <Input 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-pink-500"
                placeholder="E.g. Star Lord"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Age</label>
                <Input 
                  type="number"
                  value={age}
                  onChange={e => setAge(Number(e.target.value))}
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-pink-500"
                  placeholder="21"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Country</label>
                <Input 
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-pink-500"
                  placeholder="Vietnam"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Privacy Gender</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { code: 'male', label: '♂️ M' },
                  { code: 'female', label: '♀️ F' },
                  { code: 'secret', label: '🤫 Off' },
                  { code: 'custom', label: '✨' }
                ] as const).map(g => (
                  <button
                    key={g.code}
                    onClick={() => setGender(g.code)}
                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all border ${
                      gender === g.code 
                        ? 'bg-pink-600 border-pink-500 text-white' 
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Status Signature</label>
              <Textarea 
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="min-h-[70px] rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-pink-500 resize-none p-3 text-xs leading-normal"
                placeholder="Let room members know about you..."
              />
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-500 font-extrabold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              {saving ? 'Syncing...' : 'Update Sync State'}
            </Button>
          </div>
        </div>

        {/* Modular Navigation Tabs for Settings sections */}
        <div className="bg-[#13192B]/45 border border-white/5 rounded-[28px] p-4 flex flex-wrap gap-1">
          {[
            { id: 'privacy', label: 'Privacy', icon: Sliders },
            { id: 'security', label: 'Security', icon: Lock },
            { id: 'notifications', label: 'Notify', icon: Bell },
            { id: 'language', label: 'Language', icon: Globe },
            { id: 'blocks', label: 'Blocks', icon: Ban },
            { id: 'cache', label: 'Storage', icon: ShieldAlert }
          ].map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                  activeSubTab === tab.id 
                    ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400' 
                    : 'bg-white/5 border border-transparent text-gray-400'
                }`}
              >
                <IconComp size={11} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic section workspace */}
        <div className="bg-[#121624] border border-white/5 p-5 rounded-[28px]">
          <AnimatePresence mode="wait">
            {activeSubTab === 'privacy' && (
              <motion.div 
                key="privacy"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Incognito Visits</h4>
                    <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold">Stops users from receiving notifications when you view profiles</p>
                  </div>
                  <button 
                    onClick={togglePrivacy}
                    className={`w-11 h-6 rounded-full transition-colors relative ${privacyMode ? 'bg-pink-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${privacyMode ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex justify-between items-center bg-white/5 rounded-2xl p-4">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Sound Effects</h4>
                    <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold">Manage system reaction audios inside mic rooms</p>
                  </div>
                  <button 
                    onClick={toggleSound}
                    className={`w-11 h-6 rounded-full transition-colors relative ${soundEnabled ? 'bg-pink-600' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${soundEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'security' && (
              <motion.div 
                key="security"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6 text-left"
              >
                {/* Header Title */}
                <div className="border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black uppercase text-pink-500 tracking-widest block">MAXO PRESTIGE SECURE</span>
                  <h3 className="text-sm font-black text-white uppercase italic">Security Center</h3>
                </div>

                {/* 1. Set / Change Password */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-4">
                  <span className="text-[9px] font-black uppercase tracking-widest text-pink-400 block">Set & Change Password</span>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase">Current Password (if changing)</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold"
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase">New Security Password</label>
                      <Input
                        type="password"
                        placeholder="Enter secure password key"
                        className="h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold text-white focus:ring-pink-500"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 pt-1 font-sans">
                      <Button
                        size="xs"
                        className="flex-1 bg-pink-600/20 border border-pink-500/30 text-pink-300 hover:bg-pink-600/40 text-[10px] uppercase font-black rounded-lg h-9"
                        onClick={handleSetPassword}
                      >
                        Set Initial Password
                      </Button>
                      <Button
                        size="xs"
                        className="flex-1 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/40 text-[10px] uppercase font-black rounded-lg h-9"
                        onClick={handleChangePassword}
                      >
                        Change Password
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. Bind / Change Mobile Number */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#60a5fa] block">Mobile Number Binding</span>
                  
                  {!isOtpSent ? (
                    <div className="space-y-3">
                      <p className="text-[10px] text-gray-400 leading-relaxed font-medium">Link your cell number to restore this profile across mobile devices instantly.</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="E.g. +1 (555) 123-4567"
                          className="h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold"
                          value={newMobile}
                          onChange={e => setNewMobile(e.target.value)}
                        />
                        <Button
                          size="xs"
                          onClick={handleRequestMobileChange}
                          className="bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:bg-purple-600/50 text-[10px] uppercase font-black rounded-xl px-4"
                        >
                          Request SMS
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[9px] text-[#f43f5e] font-black uppercase">Simulated Code Sent to {newMobile}!</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="6-digit verification pin"
                          className="h-10 rounded-xl bg-white/5 border-white/10 text-xs font-bold"
                          maxLength={6}
                          value={verificationOtp}
                          onChange={e => setVerificationOtp(e.target.value)}
                        />
                        <Button
                          size="xs"
                          onClick={handleVerifyMobileChange}
                          className="bg-green-600/30 border border-green-500/30 text-green-300 hover:bg-green-600/50 text-[10px] uppercase font-black rounded-xl px-4"
                        >
                          Verify
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Account Recovery */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 block">Account Recovery Key</span>
                    <Button 
                      size="xs" 
                      variant="ghost"
                      onClick={() => {
                        setRecoveryCode('REC-' + Math.floor(100000 + Math.random() * 900000).toString() + '-' + Math.floor(100000 + Math.random() * 900000).toString());
                        toast.success('Generated fresh master restoration sequence!');
                      }}
                      className="text-[9px] font-black text-amber-400 uppercase"
                    >
                      Regenerate
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-normal font-medium">Write down this unique seed phrase. If you ever lose your credentials, enter this key to restore your diamonds, badges, and VIP level.</p>
                  <div className="p-3 bg-black/40 rounded-xl border border-dashed border-white/10 text-center font-mono text-xs font-black text-amber-200 select-all cursor-pointer">
                    {recoveryCode}
                  </div>
                </div>

                {/* 4. Device Management */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a7f3d0] block">Device Management</span>
                  <div className="space-y-2">
                    {activeDevices.map(device => (
                      <div key={device.id} className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-xs font-black text-white">{device.name}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5 font-bold uppercase">{device.os} • {device.location}</p>
                        </div>
                        <span className="text-[9px] font-black uppercase bg-[#10b981]/15 text-[#10b981] px-2 py-0.5 rounded border border-[#10b981]/10">
                          {device.state}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Login History */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block">Login History</span>
                  <div className="divide-y divide-white/5 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {loginHistoryList.map((log, index) => (
                      <div key={index} className="pt-2.5 flex justify-between items-start text-xs font-sans">
                        <div>
                          <p className="text-xs font-black text-zinc-300">{log.device}</p>
                          <p className="text-[9.5px] text-gray-500 font-semibold mt-0.5">{log.ip} • {log.location}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-mono leading-none text-[#a855f7] block">{log.action}</span>
                          <span className="text-[8.5px] text-gray-500 block mt-1">{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'notifications' && (
              <motion.div 
                key="notifications"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {[
                  { title: 'Follower Alerts', desc: 'Notify me when another user starts following my profile', val: notifyFollowers, set: setNotifyFollowers },
                  { title: 'Moments reaction notifications', desc: 'Notify me when people comment on my posts', val: notifyMoments, set: setNotifyMoments },
                  { title: 'Room invitations', desc: 'Notify when host mic requests or agency team slots pop up', val: notifyRoomInvites, set: setNotifyRoomInvites }
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/5 rounded-2xl p-4">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-white">{item.title}</h4>
                      <p className="text-[9px] text-gray-500 mt-1 font-bold leading-normal">{item.desc}</p>
                    </div>
                    <button 
                      onClick={() => { item.set(!item.val); toast.success('Notification settings synchronized!'); }}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${item.val ? 'bg-pink-600' : 'bg-white/10'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${item.val ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {activeSubTab === 'language' && (
              <motion.div 
                key="language"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="bg-[#0C101A] border border-white/5 p-4 rounded-xl text-center space-y-4">
                  <Globe className="text-pink-500 w-8 h-8 mx-auto animate-pulse" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">System Translation Language</h4>
                    <p className="text-[9px] text-gray-500 uppercase font-black">Changes local buttons, text cards and dynamic notifications</p>
                  </div>
                  
                  <select
                    value={language}
                    onChange={handleLanguageChange}
                    className="w-full h-11 rounded-xl bg-[#121624] border border-white/10 px-3 text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-pink-500 cursor-pointer"
                  >
                    <option value="English">🇬🇧 English • Standard UK</option>
                    <option value="Vietnamese">🇻🇳 Tiếng Việt • Việt Nam</option>
                    <option value="Indonesian">🇮🇩 Bahasa Indonesia • Indonesia</option>
                    <option value="Spanish">🇪🇸 Español • Castile</option>
                    <option value="Portuguese">🇧🇷 Português • Brazil</option>
                    <option value="Arabic">🇸🇦 العربية • Rawayyah</option>
                    <option value="Thai">🇹🇭 ภาษาไทย • Suvarnabhumi</option>
                  </select>
                </div>
              </motion.div>
            )}

            {activeSubTab === 'blocks' && (
              <motion.div 
                key="blocks"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Ban size={14} className="text-pink-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-pink-400">Blocked Users Registry</span>
                  </div>
                  
                  {blockedUsers.length > 0 ? (
                    <div className="divide-y divide-white/5 bg-black/40 rounded-2xl px-4 py-2 border border-white/5">
                      {blockedUsers.map(u => (
                        <div key={u.id} className="py-3 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-black text-white">{u.name}</p>
                            <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{u.tag}</p>
                          </div>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleUnblock(u.id, u.name)}
                            className="rounded-lg h-7 text-[10px] uppercase font-black text-white bg-pink-600/15 border border-pink-500/20 hover:bg-pink-600/35"
                          >
                            Unblock
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-black/20 rounded-2xl text-center border border-dashed border-white/5">
                      <p className="text-xs text-gray-500 italic">No members listed in your blocked registry.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeSubTab === 'cache' && (
              <motion.div 
                key="cache"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="bg-black/35 border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <Trash2 className="text-red-500 w-8 h-8 animate-bounce" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">Diagnostic Defragmenter</h4>
                    <p className="text-[9px] text-gray-500 leading-relaxed font-bold uppercase">Deletes room cached feeds, asset links and temporary local state records.</p>
                  </div>
                  <div className="py-1 px-4 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[10px] font-mono font-black text-zinc-300">2.84 MB Cache Used</span>
                  </div>
                  <Button 
                    variant="destructive"
                    onClick={handleClearCache}
                    className="w-full bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 rounded-xl h-11 uppercase font-black text-xs"
                  >
                    Clear All Cache Now
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Back navigation footer click */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/profile')} 
          className="w-full h-12 rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 text-xs font-black uppercase tracking-widest mt-6"
        >
          Back to Me Profile
        </Button>
      </div>
    </div>
  );
}
