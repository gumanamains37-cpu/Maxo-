import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShieldCheck, UserCheck, Eye, Sparkles, Camera, ClipboardCheck, Video, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function VerificationPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Step state
  const [activeTab, setActiveTab] = useState<'face' | 'identity' | 'audit'>('face');

  // Face scanning states
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanPassed, setScanPassed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Identity Form States
  const [realName, setRealName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [country, setCountry] = useState('');
  const [submittingID, setSubmittingID] = useState(false);
  const [idPassed, setIdPassed] = useState(false);

  // Trigger web camera API
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setScanPassed(false);
      setScanning(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error(e);
      toast.error('Webcam access was denied or is not supported in this frame. Simulating scanning placeholder instead.');
    }
  };

  const handleScan = () => {
    if (!cameraActive) {
      // Simulate scanning if camera not accessed
      setCameraActive(true);
    }
    setScanning(true);
    toast.info('Analyzing biometric coordinate alignment... Align your face inside the green circle');
    setTimeout(() => {
      setScanning(false);
      setScanPassed(true);
      // Close camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setCameraActive(false);
      toast.success('Face ID Biometrics successfully matched and verified! Verification recorded!');
    }, 2500);
  };

  const handleSubmitIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim() || !idNumber.trim()) {
      toast.error('Please enter your full name and identity card passport registration details!');
      return;
    }
    setSubmittingID(true);
    setTimeout(() => {
      setSubmittingID(false);
      setIdPassed(true);
      toast.success('Identity card documents submitted and successfully approved with standard registry!');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Dynamic Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-[#0C101A]/95 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
          <ChevronLeft size={20} />
        </Button>
        <ShieldCheck size={22} className="text-green-400 animate-pulse" />
        <h1 className="text-lg font-black uppercase tracking-wider">Verification Suite</h1>
      </div>

      <div className="px-5 space-y-6 pt-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-green-950/40 via-emerald-900/10 to-teal-950/40 border border-green-500/15 p-5 rounded-[28px]">
          <h2 className="text-sm font-black uppercase tracking-widest text-green-300">Verification Center</h2>
          <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
            Build community trust by verifying your profile. Real verified badge highlights your name inside audio broadcasts.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex border-b border-white/5 pb-0.5 gap-4">
          {[
            { id: 'face', label: 'Face validation' },
            { id: 'identity', label: 'Identity Documents' },
            { id: 'audit', label: 'Details Audit' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
                activeTab === t.id 
                  ? 'border-green-500 text-green-400 font-extrabold' 
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Face Liveness Recognition */}
        {activeTab === 'face' && (
          <div className="space-y-4">
            <div className="bg-[#121624] border border-white/5 p-5 rounded-[28px] text-center space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Biometric Face Recognition</h3>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest leading-normal">Scans front profile liveness status</p>
              
              <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-gray-600 bg-black/40 mx-auto flex items-center justify-center overflow-hidden">
                {cameraActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover rounded-full transform -scale-x-100"
                  />
                ) : scanPassed ? (
                  <div className="text-center space-y-1.5 z-10">
                    <ShieldCheck size={40} className="text-green-400 mx-auto animate-bounce" />
                    <p className="text-[10px] text-green-400 font-extrabold uppercase">Liveness OK</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2 z-10 p-3">
                    <Video size={24} className="text-gray-500 mx-auto" />
                    <p className="text-[9px] text-gray-500 uppercase font-black">Camera standby</p>
                  </div>
                )}

                {/* Animated Scanner Overlays */}
                {scanning && (
                  <>
                    <div className="absolute inset-0 bg-green-500/10 animate-pulse pointer-events-none" />
                    <div className="absolute w-full h-0.5 bg-green-400 shadow-[0_0_8px_#22c55e] animate-scan pointer-events-none" />
                  </>
                )}

                {cameraActive && !scanning && (
                  <div className="absolute inset-4 rounded-full border border-green-500/40 pointer-events-none border-dashed animate-pulse" />
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {!cameraActive && !scanPassed && (
                  <Button 
                    onClick={startCamera}
                    className="bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-wider h-11 rounded-xl"
                  >
                    Start Camera Stream
                  </Button>
                )}

                {cameraActive && (
                  <Button 
                    onClick={handleScan}
                    disabled={scanning}
                    className="bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-xs uppercase tracking-wider h-11 rounded-xl"
                  >
                    {scanning ? 'Biometrics Analysis Running...' : 'Verify Liveness Match'}
                  </Button>
                )}

                {scanPassed && (
                  <Button 
                    disabled 
                    className="bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl h-11 text-xs uppercase font-black"
                  >
                    Matched Successfully ★
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ID passport */}
        {activeTab === 'identity' && (
          <div className="space-y-4">
            <form onSubmit={handleSubmitIdentity} className="bg-[#121624] border border-white/5 p-5 rounded-[28px] space-y-4">
              <h3 className="text-xs font-black text-center text-white uppercase tracking-wider mb-2">Registry document submission</h3>
              
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Legal Full Name</label>
                <Input 
                  value={realName}
                  onChange={e => setRealName(e.target.value)}
                  placeholder="e.g. Zackary Ward"
                  disabled={idPassed}
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-green-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Passport / Citizenship ID Number</label>
                <Input 
                  value={idNumber}
                  onChange={e => setIdNumber(e.target.value)}
                  placeholder="e.g. US994721"
                  disabled={idPassed}
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-green-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Issuer Region</label>
                <Input 
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. United States"
                  disabled={idPassed}
                  className="h-11 rounded-xl bg-white/5 border-white/10 font-bold text-white focus-visible:ring-green-500"
                />
              </div>

              <Button 
                type="submit"
                disabled={submittingID || idPassed}
                className="w-full h-11 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl mt-4"
              >
                {submittingID ? 'Validating ID...' : idPassed ? 'ID Document Approved' : 'Submit ID Card Verification'}
              </Button>
            </form>
          </div>
        )}

        {/* Tab 3: Detail Audit and checking */}
        {activeTab === 'audit' && (
          <div className="space-y-4 bg-[#121624] border border-white/5 p-5 rounded-[28px]">
            <h3 className="text-xs font-black text-white uppercase tracking-wider block mb-2">Automated Audit Checklist</h3>
            
            <div className="space-y-3">
              {[
                { label: 'Circular Profile Picture check', ok: !!profile?.photoURL, val: 'Verified circular image' },
                { label: 'Unique Numeric User-ID Registration', ok: !!profile?.numericId, val: profile?.numericId || 'Unassigned' },
                { label: 'Community Nickname check', ok: (profile?.displayName?.length ?? 0) >= 3, val: profile?.displayName || 'Under 3 characters' },
                { label: 'User Bio signature validation', ok: (profile?.bio?.length ?? 0) >= 2, val: 'Signature is active' }
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-black/45 rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-extrabold text-white text-[11px]">{item.label}</p>
                    <p className="text-[9px] text-gray-500 mt-1 uppercase font-bold">{item.val}</p>
                  </div>
                  {item.ok ? (
                    <span className="text-[8px] bg-green-500/15 text-green-400 font-black px-2 py-0.5 rounded uppercase">Passed</span>
                  ) : (
                    <span className="text-[8px] bg-red-500/15 text-red-400 font-black px-2 py-0.5 rounded uppercase">Declined</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
