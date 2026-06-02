import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Gamepad2, Trophy, RotateCcw, HelpCircle, Check, Sparkles, 
  Dices, User, Moon, Eye, Play, Undo2, Award, Zap, ChevronRight,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ==========================================
// SUDOKU GAME CONFIG & PRESETS
// ==========================================
interface SudokuPreset {
  difficulty: 'Easy' | 'Medium' | 'Hard';
  board: number[][];
  solution: number[][];
}

const SUDOKU_PRESETS: SudokuPreset[] = [
  {
    difficulty: 'Easy',
    board: [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ],
    solution: [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9]
    ]
  },
  {
    difficulty: 'Medium',
    board: [
      [0, 0, 0, 2, 6, 0, 7, 0, 1],
      [6, 8, 0, 0, 7, 0, 0, 9, 0],
      [1, 9, 0, 0, 0, 4, 5, 0, 0],
      [8, 2, 0, 1, 0, 0, 0, 4, 0],
      [0, 0, 4, 6, 0, 2, 9, 0, 0],
      [0, 5, 0, 0, 0, 3, 0, 2, 8],
      [0, 0, 9, 3, 0, 0, 0, 7, 4],
      [0, 4, 0, 0, 5, 0, 0, 3, 6],
      [7, 0, 3, 0, 1, 8, 0, 0, 0]
    ],
    solution: [
      [4, 3, 5, 2, 6, 9, 7, 8, 1],
      [6, 8, 2, 5, 7, 1, 3, 9, 4],
      [1, 9, 7, 8, 3, 4, 5, 6, 2],
      [8, 2, 6, 1, 9, 5, 3, 4, 7],
      [3, 7, 4, 6, 8, 2, 9, 1, 5],
      [9, 5, 1, 7, 4, 3, 6, 2, 8],
      [5, 1, 9, 3, 2, 6, 8, 7, 4],
      [2, 4, 8, 9, 5, 7, 1, 3, 6],
      [7, 6, 3, 4, 1, 8, 2, 5, 9]
    ]
  },
  {
    difficulty: 'Hard',
    board: [
      [0, 0, 0, 6, 0, 0, 4, 0, 0],
      [7, 0, 0, 0, 0, 3, 6, 0, 0],
      [0, 0, 0, 0, 9, 1, 0, 8, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 5, 0, 1, 8, 0, 0, 0, 3],
      [0, 0, 0, 3, 0, 6, 0, 4, 5],
      [0, 4, 0, 2, 0, 0, 0, 6, 0],
      [9, 0, 3, 0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 0, 1, 0, 0]
    ],
    solution: [
      [5, 8, 1, 6, 7, 2, 4, 3, 9],
      [7, 9, 2, 8, 4, 3, 6, 5, 1],
      [3, 6, 4, 5, 9, 1, 7, 8, 2],
      [4, 3, 8, 9, 5, 7, 2, 1, 6],
      [6, 5, 9, 1, 8, 4, 7, 2, 3],
      [1, 7, 5, 3, 2, 6, 9, 4, 8],
      [8, 4, 5, 2, 1, 9, 3, 6, 7],
      [9, 1, 3, 7, 6, 5, 8, 2, 4],
      [2, 2, 5, 3, 7, 8, 1, 9, 4]
    ]
  }
];

// ==========================================
// SPIN SECTORS
// ==========================================
interface SpinSector {
  text: string;
  color: string;
  icon?: string;
}

const SPIN_SECTORS: SpinSector[] = [
  { text: "Sing a Song 🎤", color: "#EC4899" }, // Pink
  { text: "Send a Gift 🎁", color: "#8B5CF6" }, // Purple
  { text: "Tell a Secret 🤫", color: "#3B82F6" }, // Blue
  { text: "Truth or Dare 🔮", color: "#10B981" }, // Emerald
  { text: "Do 10 Pushups 💪", color: "#F59E0B" }, // Amber
  { text: "Recite Poem 📜", color: "#EF4444" }, // Red
  { text: "Compliment Nest 💖", color: "#06B6D4" }, // Cyan
  { text: "Double Spin 🌟", color: "#D946EF" }  // Fuchsia
];

// ==========================================
// TAROT CARDS DETAILS
// ==========================================
interface TarotCard {
  name: string;
  type: 'Major Arcana';
  uprightMeanings: string;
  description: string;
  imageUrl: string;
}

const TAROT_CARDS: TarotCard[] = [
  {
    name: "The Sun",
    type: 'Major Arcana',
    uprightMeanings: "Joy, Success, Brilliance, Vitality, Star Presence",
    description: "The Sun represents complete cosmic radiance, creative energy, and dynamic leadership. Drawing this card suggests an abundant aura of joy, warmth, and incoming noble gifts in the room!",
    imageUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop"
  },
  {
    name: "The Moon",
    type: 'Major Arcana',
    uprightMeanings: "Intuition, Celestial Dreams, Subconscious Vibes, Mystery",
    description: "The Moon illuminates standard astrology charts, secrets, and beautiful intuitive whispers. A fantastic card indicating Mercury alignment, psychic sensitivity, and mysterious magnetic allure.",
    imageUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=400&auto=format&fit=crop"
  },
  {
    name: "The Magician",
    type: 'Major Arcana',
    uprightMeanings: "Manifestation, Power, Skill, Cosmic Resourcefulness",
    description: "The Magician sits upon the cosmic throne, aligning elemental tools to create magic of high caliber. You hold master keys to direct any action and transform the energy of the crowd.",
    imageUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=400&auto=format&fit=crop"
  },
  {
    name: "The Lovers",
    type: 'Major Arcana',
    uprightMeanings: "Harmony, Pure Attraction, Deep Chat Connection, Choice",
    description: "The Lovers inspire beautiful union, shared heartbeats, and supportive bonds. Inside this voice room, it points to deep, meaningful relationships and perfect voice harmony.",
    imageUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=400&auto=format&fit=crop"
  },
  {
    name: "The Star",
    type: 'Major Arcana',
    uprightMeanings: "Hope, Serenity, Noble Inspiration, Generosity, Healing",
    description: "The Star reigns supreme! It promises celestial inspiration, spiritual healing, and brilliant hope. When this card appears, gift rainfall and immense popularity are destined for you.",
    imageUrl: "https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=400&auto=format&fit=crop"
  },
  {
    name: "Wheel of Fortune",
    type: 'Major Arcana',
    uprightMeanings: "Cycles, Destiny Call, Breakthrough, Sudden Wealth",
    description: "The Wheel spins constantly! It represents destiny, changes in status, and miraculous turns. Your luck is soaring, making active room participation highly fruitful.",
    imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=400&auto=format&fit=crop"
  }
];

interface GameCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSpinActiveChange: (active: boolean) => void;
  currentUser: any;
  soundEffectsEnabled?: boolean;
}

export function GameCenter({
  isOpen,
  onClose,
  onSpinActiveChange,
  currentUser,
  soundEffectsEnabled = true
}: GameCenterProps) {
  const [tab, setTab] = useState<'spin' | 'sudoku' | 'tarot'>('spin');

  // Propagate Spin Game Active whenever tab is 'spin' and Game Center is open
  useEffect(() => {
    if (isOpen && tab === 'spin') {
      onSpinActiveChange(true);
    } else {
      onSpinActiveChange(false);
    }
    // Cleanup on unmount or close
    return () => {
      onSpinActiveChange(false);
    };
  }, [tab, isOpen, onSpinActiveChange]);

  const triggerSound = (freq: number, type: 'sine' | 'square' | 'triangle' = 'sine', duration = 0.1) => {
    if (!soundEffectsEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Ignored
    }
  };

  // ==========================================
  // SPIN WHEEL GAME STATE & LOGIC
  // ==========================================
  const [wheelAngle, setWheelAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [spinHistory, setSpinHistory] = useState<{ id: string; user: string; text: string; time: string }[]>(() => [
    { id: '1', user: 'System', text: 'Welcome to VIP Spin Wheel! Start spinning!', time: 'Now' }
  ]);

  const spinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setSpinResult(null);
    triggerSound(440, 'triangle', 0.2);

    // Spin at least 5-8 full rotations plus a random offset
    const additionalRotations = 1800 + Math.floor(Math.random() * 1800);
    const targetAngle = wheelAngle + additionalRotations;
    setWheelAngle(targetAngle);

    // Play ticking sound while spinning
    let ticks = 0;
    const interval = setInterval(() => {
      if (ticks < 15) {
        triggerSound(600 + ticks * 40, 'sine', 0.05);
        ticks++;
      } else {
        clearInterval(interval);
      }
    }, 200);

    setTimeout(() => {
      setIsSpinning(false);
      clearInterval(interval);

      // Math for determining slice
      // Arrow is at the top (90 degrees or 270 degrees depending on offset). Let's calculate:
      const sectorSize = 360 / SPIN_SECTORS.length;
      // Normalise angle to [0, 360) and factor absolute rotational direction
      const finalIndex = Math.floor((360 - (targetAngle % 360)) / sectorSize) % SPIN_SECTORS.length;
      const winningSector = SPIN_SECTORS[finalIndex];
      setSpinResult(winningSector.text);

      triggerSound(880, 'sine', 0.3);

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSpinHistory((prev) => [
        {
          id: Date.now().toString(),
          user: currentUser?.displayName || 'Seat Companion',
          text: `spun the wheel and got: "${winningSector.text}"`,
          time: timestamp
        },
        ...prev
      ]);
    }, 4500); // Transitions with easing duration
  };

  // ==========================================
  // SUDOKU GAME STATE & LOGIC
  // ==========================================
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [sudokuBoard, setSudokuBoard] = useState<number[][]>(() => 
    JSON.parse(JSON.stringify(SUDOKU_PRESETS[0].board))
  );
  const [initialBoard, setInitialBoard] = useState<number[][]>(() => 
    JSON.parse(JSON.stringify(SUDOKU_PRESETS[0].board))
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [isSudokuSolved, setIsSudokuSolved] = useState(false);

  // Initialize Sudoku board on difficulty change
  const handleSudokuInit = (diff: 'Easy' | 'Medium' | 'Hard') => {
    const preset = SUDOKU_PRESETS.find(p => p.difficulty === diff) || SUDOKU_PRESETS[0];
    setDifficulty(diff);
    setSudokuBoard(JSON.parse(JSON.stringify(preset.board)));
    setInitialBoard(JSON.parse(JSON.stringify(preset.board)));
    setSelectedCell(null);
    setMistakes(0);
    setIsSudokuSolved(false);
    triggerSound(520, 'sine', 0.15);
  };

  const handleSudokuCellClick = (rowIndex: number, colIndex: number) => {
    if (isSudokuSolved) return;
    if (initialBoard[rowIndex][colIndex] !== 0) return; // locked/fixed cell
    setSelectedCell({ row: rowIndex, col: colIndex });
    triggerSound(350, 'sine', 0.05);
  };

  const handleKeyPressSudoku = (num: number) => {
    if (!selectedCell || isSudokuSolved) return;
    const { row, col } = selectedCell;

    const preset = SUDOKU_PRESETS.find(p => p.difficulty === difficulty) || SUDOKU_PRESETS[0];
    const correctValue = preset.solution[row][col];

    if (num === correctValue) {
      const newBoard = sudokuBoard.map((r, ri) => 
        r.map((c, ci) => (ri === row && ci === col) ? num : c)
      );
      setSudokuBoard(newBoard);
      triggerSound(660, 'sine', 0.1);

      // Check if board fully solved
      const isComplete = newBoard.every((r, rIdx) => 
        r.every((val, colIdx) => val === preset.solution[rIdx][colIdx])
      );
      if (isComplete) {
        setIsSudokuSolved(true);
        triggerSound(980, 'sine', 0.5);
        toast.success("Awesome! You completed the Sudoku puzzle perfectly! 🌟🏆");
      }
    } else {
      setMistakes((prev) => {
        const next = prev + 1;
        if (next >= 5) {
          toast.error("Sudoku Mistake limit (5) reached! Let's reboot the puzzle.");
          handleSudokuInit(difficulty);
          return 0;
        } else {
          toast.warning(`Incorrect value! Mistake ${next}/5`);
          triggerSound(200, 'square', 0.2);
        }
        return next;
      });
    }
  };

  const solveSudokuPuzzleProgressively = () => {
    const preset = SUDOKU_PRESETS.find(p => p.difficulty === difficulty) || SUDOKU_PRESETS[0];
    setSudokuBoard(JSON.parse(JSON.stringify(preset.solution)));
    setIsSudokuSolved(true);
    triggerSound(880, 'sine', 0.4);
    toast.success("Puzzle Solved! Great performance!");
  };

  // ==========================================
  // STAGGERED TAROT STATE & LOGIC
  // ==========================================
  const [tarotFlipped, setTarotFlipped] = useState<boolean[]>(new Array(TAROT_CARDS.length).fill(false));
  const [drawnTarot, setDrawnTarot] = useState<TarotCard | null>(null);
  const [isDrawingTarot, setIsDrawingTarot] = useState(false);

  const drawTarotCard = () => {
    if (isDrawingTarot) return;
    setIsDrawingTarot(true);
    setDrawnTarot(null);
    triggerSound(400, 'triangle', 0.15);

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * TAROT_CARDS.length);
      setDrawnTarot(TAROT_CARDS[randomIndex]);
      setIsDrawingTarot(false);
      triggerSound(700, 'sine', 0.25);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/60 backdrop-blur-sm relative">
      {/* Click Outside Container dismissal */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="relative z-10 w-full max-w-lg bg-[#0C0F19] border-t border-white/10 rounded-t-[32px] overflow-hidden flex flex-col text-slate-100 shadow-3xl max-h-[92vh]"
        style={{ height: '780px' }}
      >
        {/* Header Block with Tab layout */}
        <div className="p-5 border-b border-white/5 bg-[#121626] relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 border border-amber-500/20">
                <Gamepad2 size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight flex items-center gap-1.5 uppercase bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent italic">
                  Room Board-Game Arcade
                </h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-wide">Sit, Vibe & Play with Seats Companion</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all hover:scale-105 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Action Buttons tabbed */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#080B14] rounded-xl border border-white/5">
            <button
              onClick={() => { setTab('spin'); triggerSound(330, 'sine', 0.05); }}
              className={`py-2 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'spin' 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Award size={14} className={tab === 'spin' ? 'animate-bounce' : ''} />
              Spin Game
            </button>
            <button
              onClick={() => { setTab('sudoku'); triggerSound(330, 'sine', 0.05); }}
              className={`py-2 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'sudoku' 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Trophy size={14} className={tab === 'sudoku' ? 'animate-bounce' : ''} />
              Sudoku Table
            </button>
            <button
              onClick={() => { setTab('tarot'); triggerSound(330, 'sine', 0.05); }}
              className={`py-2 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                tab === 'tarot' 
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Moon size={14} className={tab === 'tarot' ? 'animate-pulse' : ''} />
              Tarot Fortunes
            </button>
          </div>
        </div>

        {/* Content Container scrolling */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* ======================================================== */}
          {/* TAB 1: VISUALLY PERFECT SPIN WHEEL GAME                 */}
          {/* ======================================================== */}
          {tab === 'spin' && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="text-center space-y-1">
                <span className="text-[10px] text-pink-500 font-extrabold tracking-widest uppercase bg-pink-900/10 border border-pink-500/20 px-2 py-0.5 rounded">
                  4 seats active mode enabled
                </span>
                <p className="text-xs text-gray-400 font-medium">While playing Spin Game, only 4 seats remain open in the room!</p>
              </div>

              {/* Graphical beautiful spin wheel */}
              <div className="relative w-64 h-64 flex items-center justify-center mt-2">
                {/* Pointer Arrow */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_2px_8px_rgba(236,72,153,0.6)]">
                  <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[20px] border-t-pink-500" />
                  <motion.div 
                    animate={{ y: [0, -4, 0] }} 
                    transition={{ repeat: Infinity, duration: 0.6 }} 
                    className="w-1.5 h-1.5 bg-white rounded-full mx-auto -mt-6"
                  />
                </div>

                {/* Outer spin rings */}
                <div className="absolute inset-0 rounded-full border-8 border-[#1A2035] bg-[#0E1222] shadow-[0_0_35px_rgba(236,72,153,0.3),inset_0_0_20px_rgba(0,0,0,0.8)] flex items-center justify-center scale-102" />

                {/* Rotating Inner Segment Board */}
                <motion.div 
                  className="w-56 h-56 rounded-full overflow-hidden relative shadow-inner select-none pointer-events-none"
                  style={{
                    transform: `rotate(${wheelAngle}deg)`,
                    transition: isSpinning ? 'transform 4.5s cubic-bezier(0.1, 0.8, 0.15, 1)' : 'none'
                  }}
                >
                  {/* Slices rendered using SVG path or elegant HTML conic gradient styling */}
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {SPIN_SECTORS.map((sector, idx) => {
                      const numSectors = SPIN_SECTORS.length;
                      const angle = 360 / numSectors;
                      const startAngle = idx * angle;
                      const endAngle = (idx + 1) * angle;
                      
                      // Convert coordinates for clean SVG slice
                      const radStart = ((startAngle - 90) * Math.PI) / 180;
                      const radEnd = ((endAngle - 90) * Math.PI) / 180;
                      
                      const x1 = 50 + 50 * Math.cos(radStart);
                      const y1 = 50 + 50 * Math.sin(radStart);
                      const x2 = 50 + 50 * Math.cos(radEnd);
                      const y2 = 50 + 50 * Math.sin(radEnd);

                      return (
                        <g key={idx}>
                          <path 
                            d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`} 
                            fill={sector.color}
                            stroke="#0F1223"
                            strokeWidth="1.2"
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Absolute Labels on the wheel segments */}
                  {SPIN_SECTORS.map((sector, idx) => {
                    const angle = 360 / SPIN_SECTORS.length;
                    const rotation = idx * angle + angle / 2;
                    return (
                      <div
                        key={idx}
                        className="absolute inset-0 flex items-center justify-center select-none"
                        style={{
                          transform: `rotate(${rotation}deg)`
                        }}
                      >
                        <span 
                          className="text-[8px] font-black tracking-tight text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] absolute"
                          style={{
                            transform: 'translateY(-62px) rotate(0deg)',
                            maxWidth: '56px',
                            textAlign: 'center',
                            lineHeight: '1.1'
                          }}
                        >
                          {sector.text}
                        </span>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Beautiful Gold central trigger dial */}
                <button
                  type="button"
                  disabled={isSpinning}
                  onClick={spinWheel}
                  className="absolute w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-300 via-amber-500 to-orange-500 p-[3px] shadow-[0_5px_15px_rgba(245,158,11,0.5)] z-20 hover:scale-105 active:scale-95 disabled:scale-95 transition-all text-black flex flex-col items-center justify-center"
                >
                  <div className="w-full h-full rounded-full bg-[#121528] flex flex-col items-center justify-center text-amber-400 hover:text-amber-300 transition-colors">
                    <Sparkles size={16} className={`${isSpinning ? 'animate-spin' : ''}`} />
                    <span className="text-[9px] font-black uppercase tracking-tight">SPIN</span>
                  </div>
                </button>
              </div>

              {/* Dynamic Display of spin results */}
              <div className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-3 text-center">
                {isSpinning ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-wider text-pink-400 animate-pulse italic">
                      The mystical wheel is spinning...
                    </span>
                  </div>
                ) : spinResult ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <Trophy size={16} className="text-yellow-400 animate-bounce" />
                    <span className="text-xs font-black text-white">
                      Outcome: <span className="text-pink-400 uppercase tracking-wide bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded">{spinResult}</span>
                    </span>
                  </motion.div>
                ) : (
                  <p className="text-xs font-bold text-gray-500 italic">Hit the SPIN button to command standard dare tasks!</p>
                )}
              </div>

              {/* Spin Log / History list */}
              <div className="w-full bg-[#080A12] border border-white/5 rounded-2xl p-4 space-y-2 max-h-[160px] overflow-y-auto">
                <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-widest flex items-center gap-1.5 leading-none">
                  <Info size={11} className="text-pink-500" /> Vibe Room Spinner Log
                </span>
                
                <div className="space-y-2 mt-2">
                  {spinHistory.map((item) => (
                    <div key={item.id} className="text-[10.5px] font-bold leading-relaxed border-b border-white/[0.02] pb-1.5 flex items-start gap-1 justify-between select-none">
                      <span className="text-gray-300">
                        <span className="text-pink-400 mr-1 font-black">{item.user}</span>
                        {item.text}
                      </span>
                      <span className="text-[8px] font-mono font-medium text-gray-600 shrink-0">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: INTERACTIVE PROFESSIONAL SUDOKU GAME              */}
          {/* ======================================================== */}
          {tab === 'sudoku' && (
            <div className="space-y-4 flex flex-col items-center">
              {/* Difficulty & mistake status toolbar */}
              <div className="w-full flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex gap-1">
                  {(['Easy', 'Medium', 'Hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => handleSudokuInit(diff)}
                      className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border transition-all ${
                        difficulty === diff 
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400' 
                          : 'bg-white/5 border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-gray-500">
                    Mistakes: <span className={mistakes > 2 ? 'text-red-500 font-black' : 'text-amber-400'}>{mistakes}/5</span>
                  </span>
                  <button 
                    onClick={() => handleSudokuInit(difficulty)}
                    className="p-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-gray-400 hover:text-white"
                    title="Reset Board"
                  >
                    <RotateCcw size={11} className="stroke-[3]" />
                  </button>
                </div>
              </div>

              {/* Sudoku Interactive Grid Board */}
              <div className="bg-[#121526]/40 p-2.5 border border-white/10 rounded-2xl">
                <div className="grid grid-cols-9 gap-0.5 max-w-[316px] mx-auto select-none">
                  {sudokuBoard.map((row, rIndex) => 
                    row.map((cellValue, cIndex) => {
                      const isInitial = initialBoard[rIndex][cIndex] !== 0;
                      const isSelected = selectedCell?.row === rIndex && selectedCell?.col === cIndex;
                      
                      // Highlight common grid blocks or current row/col
                      const isHighlighted = selectedCell 
                        ? selectedCell.row === rIndex || selectedCell.col === cIndex || 
                          (Math.floor(selectedCell.row / 3) === Math.floor(rIndex / 3) && 
                           Math.floor(selectedCell.col / 3) === Math.floor(cIndex / 3))
                        : false;

                      // Box block outline style indicators
                      const borderRight = (cIndex === 2 || cIndex === 5) ? 'border-r-2 border-slate-500/80' : '';
                      const borderBottom = (rIndex === 2 || rIndex === 5) ? 'border-b-2 border-slate-500/80' : '';

                      return (
                        <div
                          key={`cell-${rIndex}-${cIndex}`}
                          onClick={() => handleSudokuCellClick(rIndex, cIndex)}
                          className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs sm:text-sm font-black rounded-sm cursor-pointer transition-all ${borderRight} ${borderBottom} ${
                            isInitial 
                              ? 'bg-white/5 text-[#FFF]/80' 
                              : cellValue !== 0 
                              ? 'bg-amber-500/10 text-amber-400' 
                              : isSelected 
                              ? 'bg-amber-500 text-slate-950 shadow-glow' 
                              : isHighlighted 
                              ? 'bg-white/[0.03] text-gray-400' 
                              : 'bg-transparent text-gray-500 hover:bg-white/5'
                          }`}
                        >
                          {cellValue !== 0 ? cellValue : ''}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Number pad controls */}
              <div className="space-y-2.5 w-full">
                <div className="grid grid-cols-9 gap-1.5 max-w-[316px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleKeyPressSudoku(num)}
                      disabled={!selectedCell || isSudokuSolved}
                      className="h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-black transition-all text-white flex items-center justify-center hover:border-amber-500/50"
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between max-w-[316px] mx-auto gap-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={solveSudokuPuzzleProgressively} 
                    disabled={isSudokuSolved}
                    className="flex-1 bg-white/5 border-white/10 text-white font-black text-[10px] uppercase hover:bg-white/10"
                  >
                    <Check size={12} className="mr-1 text-emerald-400" /> Instantly Solve
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleSudokuInit(difficulty)}
                    className="flex-1 bg-white/5 border-white/10 text-white font-black text-[10px] uppercase hover:bg-white/10"
                  >
                    <RotateCcw size={12} className="mr-1 text-amber-400" /> Refresh Board
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: STARLIGHT TAROT ORACLE FORTUNE DRAW GAME          */}
          {/* ======================================================== */}
          {tab === 'tarot' && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="text-center space-y-1">
                <span className="text-[10px] text-indigo-400 font-extrabold tracking-widest uppercase bg-indigo-950/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                  Mystical Starlight Tarot Draw
                </span>
                <p className="text-xs text-gray-400 font-medium">Draw a card from the deck to reveal your daily room fortune aura!</p>
              </div>

              {/* Tarot display card deck or drawn card */}
              <div className="relative w-full flex flex-col items-center justify-center my-2">
                <AnimatePresence mode="wait">
                  {isDrawingTarot ? (
                    <motion.div
                      key="shuffling"
                      initial={{ scale: 0.9, rotateY: 0 }}
                      animate={{ scale: 1.05, rotate: [0, -10, 10, 0] }}
                      exit={{ scale: 0.9 }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-36 h-56 rounded-2xl border-2 border-indigo-500/40 bg-[#121630] shadow-[0_0_25px_rgba(99,102,241,0.25)] flex flex-col items-center justify-center"
                    >
                      <Moon size={36} className="text-indigo-400 animate-spin [animation-duration:4s]" />
                      <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mt-4">Shuffling Aura...</span>
                    </motion.div>
                  ) : drawnTarot ? (
                    <motion.div
                      key="drawn-card"
                      initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
                      animate={{ rotateY: 360, scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-48 rounded-2xl border-2 border-indigo-500 p-3.5 bg-gradient-to-b from-[#181C37] to-[#0D1022] shadow-[0_0_35px_rgba(99,102,241,0.45)] flex flex-col items-center border-indigo-500/80 relative text-center"
                    >
                      {/* Premium Image background banner */}
                      <div className="w-full h-32 rounded-lg overflow-hidden border border-white/10 relative">
                        <img 
                          src={drawnTarot.imageUrl} 
                          alt={drawnTarot.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover select-none pointer-events-none" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1022] to-transparent" />
                      </div>

                      <div className="mt-3 space-y-1 select-none">
                        <span className="text-[8px] font-black tracking-widest uppercase text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full bg-indigo-500/10">
                          {drawnTarot.type}
                        </span>
                        <h4 className="text-sm font-black text-amber-400 mt-1 uppercase italic tracking-tight">{drawnTarot.name}</h4>
                        <p className="text-[9px] font-bold text-slate-350 tracking-wider">Aura keywords: &quot;{drawnTarot.uprightMeanings}&quot;</p>
                      </div>

                      {/* Explanation box */}
                      <div className="bg-white/5 rounded-xl p-2.5 mt-3 select-none">
                        <p className="text-[10px] font-bold text-gray-300 leading-relaxed italic">{drawnTarot.description}</p>
                      </div>

                      <div className="absolute -top-2.5 -right-2 bg-gradient-to-tr from-amber-400 to-orange-500 text-black text-[7.5px] font-black px-2 py-0.5 rounded-full border border-yellow-300 uppercase shadow-md leading-none">
                        High Luck
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="card-deck-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-36 h-56 rounded-2xl border-2 border-indigo-500/40 bg-gradient-to-br from-[#12162E] to-[#0A0C1B] cursor-pointer hover:border-indigo-500 flex flex-col items-center justify-center p-4 shadow-[0_0_25px_rgba(99,102,241,0.15)] group relative"
                      onClick={drawTarotCard}
                    >
                      <div className="w-full h-full border border-indigo-500/10 rounded-xl flex flex-col items-center justify-center bg-white/[0.01]">
                        <Moon size={32} className="text-indigo-500/40 group-hover:scale-110 group-hover:text-indigo-400 transition-all animate-pulse" />
                        <span className="text-[9px] font-black text-indigo-400/80 uppercase tracking-widest mt-4">Draw Card</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Controls triggers */}
              {!isDrawingTarot && (
                <Button
                  onClick={drawTarotCard}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-xs uppercase transition-all px-8 rounded-full shadow-lg"
                >
                  {drawnTarot ? 'Draw Another Card' : 'Unveil Cosmic Card'}
                </Button>
              )}
            </div>
          )}

        </div>

        {/* Footer warning hint */}
        <div className="p-4 border-t border-white/5 bg-[#080A12] text-center select-none">
          <p className="text-[9px] text-gray-500 font-bold tracking-wide flex items-center justify-center gap-1">
            <Sparkles size={10} className="text-amber-500" /> Play responsibly and have fun with sitting companion guests!
          </p>
        </div>
      </motion.div>
    </div>
  );
}
