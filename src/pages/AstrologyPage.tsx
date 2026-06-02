import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Sparkles, Heart, Star, Compass, Info, Flame, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const ZODIACS = [
  { name: 'Aries', date: 'Mar 21 - Apr 19', symbol: '♈', element: 'Fire', trait: 'Ambitious & Courageous' },
  { name: 'Taurus', date: 'Apr 20 - May 20', symbol: '♉', element: 'Earth', trait: 'Reliable & Determined' },
  { name: 'Gemini', date: 'May 21 - Jun 20', symbol: '♊', element: 'Air', trait: 'Curious & Versatile' },
  { name: 'Cancer', date: 'Jun 21 - Jul 22', symbol: '♋', element: 'Water', trait: 'Intuitive & Protective' },
  { name: 'Leo', date: 'Jul 23 - Aug 22', symbol: '♌', element: 'Fire', trait: 'Generous & Charismatic' },
  { name: 'Virgo', date: 'Aug 23 - Sep 22', symbol: '♍', element: 'Earth', trait: 'Analytical & Loyal' },
  { name: 'Libra', date: 'Sep 23 - Oct 22', symbol: '♎', element: 'Air', trait: 'Charming & Harmonious' },
  { name: 'Scorpio', date: 'Oct 23 - Nov 21', symbol: '♏', element: 'Water', trait: 'Passionate & Intuitive' },
  { name: 'Sagittarius', date: 'Nov 22 - Dec 21', symbol: '♐', element: 'Fire', trait: 'Optimistic & Free-spirited' },
  { name: 'Capricorn', date: 'Dec 22 - Jan 19', symbol: '♑', element: 'Earth', trait: 'Disciplined & Resilient' },
  { name: 'Aquarius', date: 'Jan 20 - Feb 18', symbol: '♒', element: 'Air', trait: 'Innovative & Independent' },
  { name: 'Pisces', date: 'Feb 19 - Mar 20', symbol: '♓', element: 'Water', trait: 'Compassionate & Artistic' }
];

export default function AstrologyPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [selectedZodiac, setSelectedZodiac] = useState('Leo');
  const [partnerZodiac, setPartnerZodiac] = useState('Aries');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<{ score: number; text: string; keywords: string[] } | null>(null);

  // Search Grounding States
  const [groundingQuery, setGroundingQuery] = useState('');
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingResult, setGroundingResult] = useState<{ text: string; metadata: any } | null>(null);

  const handleVerifyGrounding = async (queryTextText?: string) => {
    const qText = queryTextText || groundingQuery.trim();
    if (!qText) {
      toast.error("Please enter a fact or horoscope question to query");
      return;
    }

    if (queryTextText) {
      setGroundingQuery(queryTextText);
    }

    setGroundingLoading(true);
    setGroundingResult(null);

    const toastId = toast.loading("Invoking Gemini Google Search Grounding... 🪐🛰️");

    try {
      const response = await fetch("/api/astrology/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ queryText: qText }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setGroundingResult(data);
      toast.success("Aligned credentials with active search grounding! 🔮✨", { id: toastId });
    } catch (err: any) {
      console.error("Grounding verify error:", err);
      toast.error("Stellar alignments fluctuated. Try standard queries or check connection.", { id: toastId });
    } finally {
      setGroundingLoading(false);
    }
  };

  const currentZodiacDetail = ZODIACS.find(z => z.name === selectedZodiac);
  const partnerZodiacDetail = ZODIACS.find(z => z.name === partnerZodiac);

  const handleMatch = () => {
    setCalculating(true);
    setResult(null);
    setTimeout(() => {
      // Determinstic or funny pseudo matching
      const scores = [88, 92, 74, 95, 61, 85, 79, 97, 83];
      const selectedIndex = ZODIACS.findIndex(z => z.name === selectedZodiac);
      const partnerIndex = ZODIACS.findIndex(z => z.name === partnerZodiac);
      const compositeIndex = (selectedIndex + partnerIndex) % scores.length;
      
      const matchedScore = scores[compositeIndex];
      let matchText = '';
      let keywords: string[] = [];

      if (matchedScore >= 90) {
        matchText = "Absolute cosmic soulmates. Perfect alignment of emotional energy, mutual spark, and core elements. Broadcaster match level: Ultimate.";
        keywords = ["High Harmoniousness", "Spelling Sparks", "Magnetic Attraction"];
      } else if (matchedScore >= 80) {
        matchText = "Beautiful compatibility. Your elements blend dynamically, creating rich conversational chemistry in public micro rooms.";
        keywords = ["Strong Bond", "Playful Debates", "Resonating Waves"];
      } else {
        matchText = "Interesting astrological friction. Elements create dynamic, unpredictable sparks. Excellent for dramatic voice-room duets.";
        keywords = ["Fascinating Contrast", "Spontaneous Sparks", "Challenging Sync"];
      }

      setResult({ score: matchedScore, text: matchText, keywords });
      setCalculating(false);
      toast.success("Cosmic calculations complete!");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0C101A] text-white font-sans pb-32">
      {/* Navigation Header */}
      <div className="px-6 pt-12 pb-4 flex items-center gap-4 bg-[#0C101A]/95 backdrop-blur-md sticky top-0 z-30 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="text-gray-400 hover:text-white rounded-full bg-white/5 w-8 h-8">
          <ChevronLeft size={20} />
        </Button>
        <Compass size={22} className="text-purple-400 animate-spin-slow" />
        <h1 className="text-lg font-black uppercase tracking-wider">Astrology Matcher</h1>
      </div>

      <div className="px-5 space-y-6 pt-4">
        {/* Intro */}
        <div className="bg-gradient-to-r from-purple-950/40 via-pink-900/10 to-indigo-950/40 border border-purple-500/15 p-5 rounded-[28px] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
          <div className="flex gap-4 items-start">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-purple-300">Cosmic Room Alignment</h2>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                Align your celestial sign with room broadcasters or mutual followers to check chemistry compatibility percentages instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Selection Row */}
        <div className="bg-[#121624] border border-white/5 p-5 rounded-[28px] space-y-4">
          <p className="text-[10px] font-black tracking-widest uppercase text-center text-gray-500">Pick Celestial Signs</p>
          <div className="grid grid-cols-2 gap-4">
            {/* Self Zodiac selector */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-pink-400 uppercase tracking-widest ml-1">Your Sign</label>
              <select
                value={selectedZodiac}
                onChange={e => setSelectedZodiac(e.target.value)}
                className="w-full h-11 rounded-xl bg-[#0C101A] border border-white/10 px-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                {ZODIACS.map(z => (
                  <option key={z.name} value={z.name}>{z.symbol} {z.name}</option>
                ))}
              </select>
              {currentZodiacDetail && (
                <div className="p-2 bg-black/40 rounded-lg text-center mt-1">
                  <p className="text-[8px] uppercase font-black text-amber-500">{currentZodiacDetail.element} Element</p>
                  <p className="text-[10px] text-zinc-300 font-bold mt-0.5">{currentZodiacDetail.trait}</p>
                </div>
              )}
            </div>

            {/* Target Partner Zodiac */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-pink-400 uppercase tracking-widest ml-1">Partner Sign</label>
              <select
                value={partnerZodiac}
                onChange={e => setPartnerZodiac(e.target.value)}
                className="w-full h-11 rounded-xl bg-[#0C101A] border border-white/10 px-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
              >
                {ZODIACS.map(z => (
                  <option key={z.name} value={z.name}>{z.symbol} {z.name}</option>
                ))}
              </select>
              {partnerZodiacDetail && (
                <div className="p-2 bg-black/40 rounded-lg text-center mt-1">
                  <p className="text-[8px] uppercase font-black text-blue-400">{partnerZodiacDetail.element} Element</p>
                  <p className="text-[10px] text-zinc-300 font-bold mt-0.5">{partnerZodiacDetail.trait}</p>
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={handleMatch}
            disabled={calculating}
            className="w-full h-12 bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-600 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-pink-500/10 mt-3"
          >
            {calculating ? 'Syncing Celestial Coordinates...' : '✨ Calculate Compatibility ✨'}
          </Button>
        </div>

        {/* Compatibility Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#13192B]/50 border border-pink-500/20 p-6 rounded-[28px] text-center space-y-4"
            >
              <div className="relative inline-block">
                <Heart size={64} className="text-pink-500 fill-pink-500/20 animate-pulse mx-auto" />
                <span className="absolute inset-0 flex items-center justify-center font-black text-lg text-white font-mono mt-1">
                  {result.score}%
                </span>
              </div>

              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {selectedZodiac} meets {partnerZodiac}
                </h4>
                <p className="text-[11px] text-zinc-300 mt-2.5 leading-relaxed bg-[#0C101A] p-4 rounded-2xl italic">
                  "{result.text}"
                </p>
              </div>

              <div className="flex gap-2 justify-center flex-wrap">
                {result.keywords.map((kw, idx) => (
                  <span key={idx} className="text-[8px] font-black uppercase tracking-widest bg-pink-500/10 text-pink-400 border border-pink-500/20 py-1 px-2.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification & Grounding Engine Panel */}
        <div className="bg-[#121624] border border-purple-500/10 p-5 rounded-[28px] space-y-4">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-purple-400 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-widest text-[#a855f7]">Google Search Fact-Checker</h3>
          </div>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Verify celestial events, look up real-time planetary transits, or search today's trending daily horoscopes utilizing Gemini Google Search grounding.
          </p>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Input 
                placeholder="E.g., Mercury retrograde dates 2026..." 
                className="h-11 rounded-xl bg-[#0C101A] border-white/10 focus:ring-purple-500 text-xs text-white placeholder:text-gray-600 focus:outline-none"
                value={groundingQuery}
                onChange={e => setGroundingQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyGrounding()}
              />
              <Button
                onClick={() => handleVerifyGrounding()}
                disabled={groundingLoading}
                className="bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all text-xs font-black uppercase tracking-wider px-4 rounded-xl shrink-0 text-white"
              >
                {groundingLoading ? "Polling..." : "Search"}
              </Button>
            </div>

            {/* Quick Suggestion pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => handleVerifyGrounding("Mercury retrograde dates 2026")}
                className="text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 hover:border-violet-500/40 text-violet-300 py-1 px-2.5 rounded-full transition-transform active:scale-95"
              >
                🪐 Retrogrades
              </button>
              <button
                onClick={() => handleVerifyGrounding("Aries daily horoscope trend today")}
                className="text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 hover:border-violet-500/40 text-violet-300 py-1 px-2.5 rounded-full transition-transform active:scale-95"
              >
                ♈ Today's Horoscope
              </button>
              <button
                onClick={() => handleVerifyGrounding("What zodiac constellation is currently visible")}
                className="text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 hover:border-violet-500/40 text-violet-300 py-1 px-2.5 rounded-full transition-transform active:scale-95"
              >
                ✨ Constellations
              </button>
            </div>
          </div>

          {/* Results displaying panel */}
          <AnimatePresence>
            {groundingResult && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-[#0C101A] border border-purple-500/20 p-5 rounded-2xl space-y-3.5 text-left"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                    <span className="text-[9px] font-black uppercase text-green-400 tracking-wider">Search Grounded Active</span>
                  </div>
                  <Info size={11} className="text-zinc-500" />
                </div>

                <p className="text-[11.5px] leading-relaxed text-zinc-200 font-medium whitespace-pre-wrap">
                  {groundingResult.text}
                </p>

                {/* Sources & Citations if available from GroundingMetadata */}
                {groundingResult.metadata?.groundingChunks && groundingResult.metadata.groundingChunks.length > 0 && (
                  <div className="border-t border-white/5 pt-2.5 space-y-1.5">
                    <p className="text-[8.5px] font-black uppercase text-zinc-500 tracking-wider">Search Verification Sources:</p>
                    <div className="flex flex-col gap-1">
                      {groundingResult.metadata.groundingChunks.map((chunk: any, i: number) => {
                        const title = chunk.web?.title || `Result [${i + 1}]`;
                        const url = chunk.web?.uri || null;
                        return (
                          <div key={i} className="text-[10px] text-purple-400 font-bold hover:underline flex items-center gap-1">
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="truncate">
                                🌐 {title}
                              </a>
                            ) : (
                              <span>📖 {title}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
