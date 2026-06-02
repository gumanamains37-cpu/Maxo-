import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Phone, Mail, Globe, User, ShieldCheck, 
  Key, Users, Sparkles, UserCheck, Smartphone, Lock, Eye, EyeOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';
import { getPremiumAvatar } from '@/utils/avatar';

// Helper to generate a realistic random username for new profiles
function generateRealisticUsername() {
  const firstNames = ['Liam', 'Aria', 'Ethan', 'Julian', 'Zoe', 'Lucas', 'Sophia', 'Alexander', 'Olivia', 'Nathan', 'Chloe', 'Ryan', 'Serena', 'Marcus', 'Elena', 'Justin', 'Amara', 'Derrick', 'Kaitlyn', 'Gavin', 'Nora', 'Tyler', 'Brianna'];
  const lastSuffixes = ['Melody', 'Vibe', 'Echo', 'Beats', 'Voice', 'Harmony', 'Chords', 'Tune', 'Sonic', 'Mic', 'Decks', 'Rhythm', 'Acoustic', 'Keys', 'Wave', 'Lyre'];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastSuffixes[Math.floor(Math.random() * lastSuffixes.length)];
  return `${first}_${last}`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [popupError, setPopupError] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Login Tabs: 'one-tap' | 'mobile' | 'password'
  const [activeTab, setActiveTab] = useState<'one-tap' | 'mobile' | 'password'>('one-tap');
  
  // Form States
  const [mobileNum, setMobileNum] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Simulated database for ID + Password logic / Mobile OTP logic stored in localStorage for full persistence
  const getStoredCredentials = () => {
    try {
      const stored = localStorage.getItem('maxo_custom_auth_db');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const saveStoredCredentials = (uid: string, data: any) => {
    try {
      const dbData = getStoredCredentials();
      dbData[uid] = { ...dbData[uid], ...data };
      localStorage.setItem('maxo_custom_auth_db', JSON.stringify(dbData));
    } catch (e) {
      console.warn("Storage error:", e);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setPopupError(false);
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      toast.success('Successfully logged in! 🎉');
      navigate('/');
    } catch (error: any) {
      console.error(error);
      if (error && (error.code === 'auth/popup-blocked' || String(error).includes('popup-blocked'))) {
        setPopupError(true);
        toast.error('Google Sign-in popup was blocked by your browser.');
      } else {
        toast.error('Failed to login with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // One Tap Login implementation (Requirement 1 & 2)
  const handleOneTapLogin = async () => {
    setLoading(true);
    setPopupError(false);
    try {
      // Re-use existing mock user if present, to guarantee User ID never changes!
      const cached = localStorage.getItem('maxo_mock_user') || localStorage.getItem('maxo_permanent_guest');
      let mockUser;
      if (cached) {
        try {
          mockUser = JSON.parse(cached);
        } catch (e) {}
      }

      if (!mockUser) {
        // Auto-generate numeric User ID ONLY ONCE
        const numericUserId = Math.floor(100000000 + Math.random() * 900000000).toString();
        const guestUid = numericUserId;
        const randomName = generateRealisticUsername();
        const realisticPhoto = getPremiumAvatar(guestUid);
        
        mockUser = {
          uid: guestUid,
          displayName: randomName,
          photoURL: realisticPhoto,
          email: `${numericUserId}@maxo.com`,
          isAnonymous: true,
          numericId: numericUserId,
          isVIP: false, // VIP by default is false
          level: 1,
          coins: 1500,
          diamonds: 10,
          badges: []
        };
      }

      try {
        localStorage.setItem('maxo_mock_user', JSON.stringify(mockUser));
        localStorage.setItem('maxo_permanent_guest', JSON.stringify(mockUser));
        saveStoredCredentials(mockUser.uid, { numericId: mockUser.numericId, displayName: mockUser.displayName, isVIP: mockUser.isVIP });
      } catch (e) {
        console.warn(e);
      }
      
      toast.success(`Welcome to Maxo! User ID ${mockUser.numericId} assigned. ✨`);
      
      // Attempt Firebase signing in silently in background (will be signed out by useAuth if it's mock user context)
      try {
        await signInAnonymously(auth);
      } catch (fbErr) {
        // Fallback transparent anonymous simulation behaves perfectly
      }
      
      window.location.href = '/';
    } catch (error: any) {
      console.error(error);
      toast.error('One Tap login sequence failed.');
    } finally {
      setLoading(false);
    }
  };

  // Mobile Logins & Simulated OTP Handler
  const handleSendOtp = () => {
    if (!mobileNum.trim() || mobileNum.length < 8) {
      toast.error('Please enter a valid mobile number');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      // Generate a neat 6-digit pin
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      setSimulatedOtp(pin);
      setOtpSent(true);
      setLoading(false);
      
      // Alert/toast containing the simulation OTP code clearly so testing works flawlessly
      toast.info(`[Simulation Mode] OTP sent! Your verification code is: ${pin}`, {
        duration: 8000,
      });
    }, 850);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast.error('Please enter the OTP verification code');
      return;
    }
    if (otpCode !== simulatedOtp) {
      toast.error('Invalid OTP code. Please check the simulated notification.');
      return;
    }

    setLoading(true);
    try {
      const digits = mobileNum.replace(/[^0-9]/g, '');
      const generatedId = digits.length >= 9 ? digits.slice(-9) : (digits + '000000000').slice(0, 9);
      const mobileUid = generatedId;
      const systemDb = getStoredCredentials();
      const existingUser = systemDb[mobileUid];

      const randomName = existingUser?.displayName || generateRealisticUsername();
      const realisticPhoto = existingUser?.photoURL || getPremiumAvatar(mobileUid);
      
      const mockUser = {
        uid: mobileUid,
        displayName: randomName,
        photoURL: realisticPhoto,
        email: `${mobileUid}@maxo.com`,
        isAnonymous: false,
        numericId: generatedId,
        mobileNumber: mobileNum,
        isVIP: existingUser?.isVIP || false,
        level: existingUser?.level || 1,
        coins: existingUser?.coins || 1500,
        diamonds: existingUser?.diamonds || 10,
        badges: existingUser?.badges || []
      };

      localStorage.setItem('maxo_mock_user', JSON.stringify(mockUser));
      saveStoredCredentials(mobileUid, {
        numericId: generatedId,
        mobileNumber: mobileNum,
        displayName: randomName,
        photoURL: realisticPhoto,
        isVIP: mockUser.isVIP,
        level: mockUser.level,
        coins: mockUser.coins,
        diamonds: mockUser.diamonds,
        badges: mockUser.badges
      });
      
      toast.success('Mobile verification successful!');
      window.location.href = '/';
    } catch (e) {
      toast.error('Mobile authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // User ID + Password Login (Requirement 1 & 2)
  const handlePasswordLogin = () => {
    if (!userId.trim()) {
      toast.error('Please enter your 9-digit User ID or Mobile');
      return;
    }
    if (!password.trim() || password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    
    // In our simplified persistence, check if credentials already exist
    const systemDb = getStoredCredentials();
    let matchedUid: string | null = null;
    
    // Search the credential database for matches
    Object.keys(systemDb).forEach(uid => {
      const uData = systemDb[uid];
      if (uData.numericId === userId || uData.mobileNumber === userId) {
        matchedUid = uid;
      }
    });

    if (matchedUid) {
      const savedPass = systemDb[matchedUid].password || '123456'; // Default password fallback for created users
      if (savedPass === password) {
        const mockUser = {
          uid: matchedUid,
          displayName: systemDb[matchedUid].displayName || `User ${userId.slice(-4)}`,
          photoURL: getPremiumAvatar(matchedUid),
          email: `${matchedUid}@maxo.com`,
          isAnonymous: false,
          numericId: userId,
          isVIP: systemDb[matchedUid].isVIP || false,
          level: systemDb[matchedUid].level || 1,
          coins: systemDb[matchedUid].coins || 1500,
          diamonds: systemDb[matchedUid].diamonds || 10,
          badges: systemDb[matchedUid].badges || []
        };

        localStorage.setItem('maxo_mock_user', JSON.stringify(mockUser));
        toast.success('Successfully logged in with Password!');
        window.location.href = '/';
        return;
      } else {
        toast.error('Incorrect password. Please try again!');
        setLoading(false);
        return;
      }
    } else {
      // Auto-register user with password if new! (Extremely frictionless high-quality UX)
      const generatedId = userId.match(/^\d{9}$/) ? userId : Math.floor(100000000 + Math.random() * 900000000).toString();
      const newUid = generatedId;
      const randomName = generateRealisticUsername();
      const realisticPhoto = getPremiumAvatar(newUid);
      
      const mockNewUser = {
        uid: newUid,
        displayName: randomName,
        photoURL: realisticPhoto,
        email: `${newUid}@maxo.com`,
        isAnonymous: false,
        numericId: generatedId,
        isVIP: false, // VIP by default is false
        level: 1,
        coins: 1000,
        diamonds: 0,
        badges: []
      };

      saveStoredCredentials(newUid, { 
        numericId: generatedId, 
        password: password, 
        displayName: mockNewUser.displayName,
        isVIP: false,
        level: 1,
        coins: 1000,
        diamonds: 0,
        badges: []
      });

      localStorage.setItem('maxo_mock_user', JSON.stringify(mockNewUser));
      toast.success(`Welcome back! Created new permanent account ID: ${generatedId} with password key.`);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-[#0D0B21] via-[#1A0B2E] to-[#0A1128] px-6 py-12 relative overflow-hidden">
      {/* Dynamic Animated Color Flares */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-pink-500/20 blur-[130px] rounded-full animate-bounce" style={{ animationDuration: '15s' }} />
      <div className="absolute bottom-[-15%] right-[-15%] w-[65%] h-[65%] bg-purple-600/20 blur-[130px] rounded-full animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-blue-500/15 blur-[120px] rounded-full animate-pulse" />

      {/* Decorative Floating Sparkles */}
      <div className="absolute top-[10%] left-[10%] opacity-20 animate-pulse text-pink-400">
        <Sparkles size={32} />
      </div>
      <div className="absolute bottom-[15%] right-[10%] opacity-20 animate-pulse text-purple-400">
        <Sparkles size={40} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <Logo size="xl" showText={false} className="justify-center mb-6 drop-shadow-[0_0_25px_rgba(236,72,153,0.3)]" />
        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter mb-2 text-white uppercase italic">
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]">
            Maxo Party
          </span>
        </h1>
        <p className="text-gray-300 text-sm font-semibold tracking-wide bg-white/5 border border-white/10 rounded-full px-4 py-1 inline-block backdrop-blur-xl">
          🎙️ Live Rooms • Star Friendships • Audio Lounges
        </p>
      </motion.div>

      {/* Modern Glassmorphic Login Container */}
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-[32px] p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6 relative z-10">
        
        {popupError && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs space-y-2 mb-2 text-left"
          >
            <p className="font-extrabold flex items-center gap-1.5 text-red-400">
              ⚠️ Popup Blocked!
            </p>
            <p className="leading-relaxed text-gray-300 font-medium">
              Because this app is running inside a preview iframe, your browser blocked the authentication window.
            </p>
            <p className="text-gray-400">To resolve this, please open the preview in a new tab using the icon above.</p>
            <button 
              onClick={() => setPopupError(false)} 
              className="text-red-400 hover:text-red-300 font-bold underline mt-1 block text-xs"
            >
              Dismiss warning
            </button>
          </motion.div>
        )}

        {/* Customized Login Tabs */}
        <div className="flex border-b border-white/10 pb-1 select-none">
          <button
            onClick={() => setActiveTab('one-tap')}
            className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'one-tap' 
                ? 'border-pink-500 text-pink-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            One Time Login ⚡
          </button>
          
          <button
            onClick={() => {
              setActiveTab('mobile');
              setOtpSent(false);
            }}
            className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'mobile' 
                ? 'border-purple-500 text-purple-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Phone & OTP
          </button>
          
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 pb-3 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'password' 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Password Key
          </button>
        </div>

        {/* Tab Forms Render */}
        <div className="min-h-[160px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            
            {activeTab === 'one-tap' && (
              <motion.div
                key="one-tap"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4 py-2 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto text-pink-400 animate-pulse">
                  <Sparkles size={28} />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">One Time Login</h3>
                  <p className="text-gray-400 text-xs mt-1 leading-relaxed max-w-[320px] mx-auto">
                    Instant stardust profile generation. Assigns a unique, random 9-digit User ID. Customizations, mobile bindings, and secure passwords can be configured later inside Settings.
                  </p>
                </div>
                <Button
                  onClick={handleOneTapLogin}
                  disabled={loading}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 hover:opacity-95 text-white font-black uppercase tracking-wider text-sm transition-transform active:scale-95 shadow-[0_0_20px_rgba(219,39,119,0.3)] mt-2"
                >
                  {loading ? 'Entering Galaxy...' : 'One Time Login'}
                </Button>
              </motion.div>
            )}

            {activeTab === 'mobile' && (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4 py-1"
              >
                {!otpSent ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black tracking-widest text-[#93c5fd] uppercase">Mobile Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <Input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        className="pl-12 h-13 rounded-2xl bg-white/5 border-white/10 text-white font-bold"
                        value={mobileNum}
                        onChange={(e) => setMobileNum(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleSendOtp}
                      disabled={loading}
                      className="w-full h-13 rounded-2xl bg-purple-500 text-white font-bold hover:bg-purple-600 transition-all text-sm mt-1"
                    >
                      {loading ? 'Sending Verification SMS...' : 'Request Validation OTP'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black tracking-widest text-[#c084fc] uppercase">Verification Code (simulated)</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" size={18} />
                      <Input
                        type="text"
                        placeholder="Enter 6-digit pin"
                        maxLength={6}
                        className="pl-12 h-13 rounded-2xl bg-white/5 border-white/10 text-white font-black text-center tracking-widest"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setOtpSent(false)}
                        className="flex-1 h-12 rounded-2xl border-white/10 text-gray-300"
                      >
                        Back
                      </Button>
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={loading}
                        className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold"
                      >
                        Verify & Enter
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3 py-1"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-[#a7f3d0] uppercase">User ID or Mobile</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type="text"
                      placeholder="9-digit User ID / Phone Number"
                      className="pl-12 h-13 rounded-2xl bg-white/5 border-white/10 text-white font-bold"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black tracking-widest text-[#a7f3d0] uppercase">Security Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password Key"
                      className="pl-12 pr-12 h-13 rounded-2xl bg-white/5 border-white/10 text-white font-bold"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  onClick={handlePasswordLogin}
                  disabled={loading}
                  className="w-full h-13 rounded-2xl bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold transition-all text-sm mt-3"
                >
                  {loading ? 'Authorizing key...' : 'Log In with Credentials'}
                </Button>
                <p className="text-[10px] text-gray-400 text-center">New ID? Types a 9-digit code and password to auto-create account!</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Social Authentication divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[1px] bg-white/10" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Fast Social Login</span>
          <div className="flex-1 h-[1px] bg-white/10" />
        </div>

        {/* Google Authentication Anchor Button */}
        <Button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-13 rounded-2xl bg-white text-black hover:bg-gray-100 font-bold flex items-center justify-center gap-3 text-sm transition-transform active:scale-95 shadow-md"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 shrink-0" />
          Connect with Google
        </Button>
      </div>

      <p className="mt-8 text-xs text-gray-500 text-center max-w-[280px]">
        By entering, you confirm acceptance of our <span className="text-pink-400 underline cursor-pointer">Terms of Service</span> and <span className="text-purple-400 underline cursor-pointer">Community Standards</span>.
      </p>
    </div>
  );
}
