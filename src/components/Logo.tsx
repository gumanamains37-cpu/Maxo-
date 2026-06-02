import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', showText = true }) => {
  const sizes = {
    sm: { box: 'w-8 h-8', text: 'text-lg' },
    md: { box: 'w-10 h-10', text: 'text-xl' },
    lg: { box: 'w-16 h-16', text: 'text-2xl' },
    xl: { box: 'w-32 h-32', text: 'text-4xl' },
  };

  const currentSize = sizes[size];
  const logoUrl = "https://storage.googleapis.com/stately-flow-437517-j4-bucket/artifacts/6be2eb77-1607-4402-998e-f1ae8376f9d3/ye_lo_logo.png?v=2";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`${currentSize.box} relative flex items-center justify-center group`}>
        {/* Multi-layered Vibrant Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 via-magenta-500 to-yellow-500 opacity-20 blur-2xl rounded-full animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 opacity-20 blur-xl rounded-full" />
        
        {/* Main Logo Emblem Container */}
        <div className="relative w-full h-full rounded-[24%] overflow-hidden shadow-2xl flex items-center justify-center bg-gradient-to-br from-zinc-900 to-black border border-white/20 ring-1 ring-white/10">
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-50" />
          
          {/* Stylized 'M' with Vibrant Gradient */}
          <svg viewBox="0 0 100 100" className="w-4/5 h-4/5 relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            <defs>
              <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FACC15" /> {/* Yellow-400 */}
                <stop offset="50%" stopColor="#EC4899" /> {/* Pink-500 */}
                <stop offset="100%" stopColor="#8B5CF6" /> {/* Violet-500 */}
              </linearGradient>
            </defs>
            <path 
              d="M20 80 L20 20 L50 50 L80 20 L80 80" 
              fill="none" 
              stroke="url(#logo-grad)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          </svg>

          {/* Shimmer Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-1000 pointer-events-none" />
        </div>
      </div>
      
      {showText && (
        <span className={`${currentSize.text} font-black tracking-tighter uppercase italic py-1`}>
          <span className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            Maxo
          </span>
        </span>
      )}
    </div>
  );
};
