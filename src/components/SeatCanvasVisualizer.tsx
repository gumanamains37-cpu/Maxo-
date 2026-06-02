import React, { useEffect, useRef } from 'react';

interface SeatCanvasVisualizerProps {
  uid: string;
  isSpeaking: boolean;
  isMusicActive: boolean;
  size?: 'large' | 'small';
}

export const SeatCanvasVisualizer: React.FC<SeatCanvasVisualizerProps> = ({
  uid,
  isSpeaking,
  isMusicActive,
  size = 'small',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Keep states in refs for requestAnimationFrame 
  const isSpeakingRef = useRef(isSpeaking);
  const isMusicActiveRef = useRef(isMusicActive);
  const phaseRef = useRef(0);
  const particlesRef = useRef<Array<{ x: number; y: number; angle: number; r: number; speed: number; alpha: number; color: string }>>([]);
  const isLoopRunningRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    isMusicActiveRef.current = isMusicActive;
    
    // Trigger loop restart if talking or music starts and loop was idle
    if ((isSpeaking || isMusicActive) && !isLoopRunningRef.current) {
      isLoopRunningRef.current = true;
      startAnimation();
    }
  }, [isSpeaking, isMusicActive]);

  const startAnimation = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isLarge = size === 'large';
    const dpr = window.devicePixelRatio || 1;
    
    const updateSize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    updateSize();

    // Prepare procedural background sparkles to float around the seat when active
    const colors = isMusicActiveRef.current 
      ? ['rgba(236,72,153,0.8)', 'rgba(168,85,247,0.8)', 'rgba(244,63,94,0.8)'] 
      : ['rgba(34,197,94,0.8)', 'rgba(16,185,129,0.8)', 'rgba(20,184,166,0.8)'];
      
    particlesRef.current = Array.from({ length: 8 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      return {
        x: 0,
        y: 0,
        angle,
        r: 1.5 + Math.random() * 2,
        speed: 0.2 + Math.random() * 0.4,
        alpha: 0.1 + Math.random() * 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });

    const draw = () => {
      if (!canvas || !ctx) return;
      
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width / 2;
      const cy = height / 2;
      const speaking = isSpeakingRef.current;
      const music = isMusicActiveRef.current;
      const active = speaking || music;

      // Halt the requestAnimationFrame cycle if no audio stream/vocal/music is active
      if (!active) {
        ctx.clearRect(0, 0, width, height);
        isLoopRunningRef.current = false;
        animationFrameRef.current = null;
        console.log(`[SeatVisualizer] Inactive loop cancelled for ${uid} to conserve CPU energy ⚡`);
        return;
      }

      // Clear layout
      ctx.clearRect(0, 0, width, height);

      // Access WebRTC analyser if present on window context
      const analyserRegistry = (window as any).loungeAnalysers;
      const sessionObj = analyserRegistry?.[uid];
      
      let frequencyData: Uint8Array | null = null;
      let amp = 0;

      if (sessionObj && sessionObj.analyser) {
        const analyser = sessionObj.analyser;
        // Make sure data array matches analyzer size
        if (!sessionObj.dataArray || sessionObj.dataArray.length !== analyser.frequencyBinCount) {
          sessionObj.dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        frequencyData = sessionObj.dataArray;
        analyser.getByteFrequencyData(frequencyData);

        // Compute real aggregate vocal energy amplitude
        let total = 0;
        const len = frequencyData.length;
        for (let i = 0; i < len; i++) {
          total += frequencyData[i];
        }
        amp = len > 0 ? (total / len) / 255 : 0;
      } else {
        // Fallback smooth procedural amplitude if standard media element connects slowly
        amp = 0.15 + Math.sin(Date.now() / 150) * 0.1;
      }

      // Base radius of avatar
      const baseRadius = isLarge ? 58 : 34;
      phaseRef.current += 0.05 + amp * 0.1;

      // Draw: Visual WebRTC Frequency Spectrum Bars (Radiating Starburst)
      const barCount = isLarge ? 36 : 24;
      const maxBarHeight = isLarge ? 28 : 16;
      
      ctx.lineWidth = isLarge ? 2 : 1.5;
      ctx.lineCap = 'round';

      for (let i = 0; i < barCount; i++) {
        // Calculate polar angle for the ray
        const angle = (i / barCount) * Math.PI * 2 + phaseRef.current * 0.2;
        
        // Pull audio value from frequency spectrum if available, otherwise procedural noise
        let val = 0.2;
        if (frequencyData) {
          const dataIdx = Math.floor((i / barCount) * (frequencyData.length * 0.6));
          val = frequencyData[dataIdx] / 255;
        } else {
          val = 0.3 + Math.sin(phaseRef.current * 2.5 + i * 1.8) * 0.2;
        }

        const barLen = 2 + val * maxBarHeight;
        const startR = baseRadius + 1;
        const endR = startR + barLen;

        const x1 = cx + Math.cos(angle) * startR;
        const y1 = cy + Math.sin(angle) * startR;
        const x2 = cx + Math.cos(angle) * endR;
        const y2 = cy + Math.sin(angle) * endR;

        // Beautiful neon reactive coloring
        if (music) {
          const hue = (300 + (val * 60) + (i * 2)) % 360;
          ctx.strokeStyle = `hsla(${hue}, 95%, 65%, ${0.4 + val * 0.6})`;
        } else {
          const hue = (130 + (val * 40) + (i * 1.5)) % 360;
          ctx.strokeStyle = `hsla(${hue}, 90%, 55%, ${0.4 + val * 0.6})`;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw: Orbiting Orbit Sparkles (Star Energy)
      particlesRef.current.forEach((p) => {
        p.angle += p.speed * (0.8 + amp * 2.5) * 0.05;
        
        const orbitRadius = baseRadius + 12 + amp * 18 + Math.sin(phaseRef.current + p.angle) * 4;
        p.x = cx + Math.cos(p.angle) * orbitRadius;
        p.y = cy + Math.sin(p.angle) * orbitRadius;

        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = music ? '#EC4899' : '#10B981';
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + amp * 0.8), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0; // Reset shadow helper

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  useEffect(() => {
    // Start loop on mount if initially active
    if (isSpeaking || isMusicActive) {
      isLoopRunningRef.current = true;
      startAnimation();
    }

    const handleResize = () => {
      // Re-trigger size calculations if dimensions change
      if (isLoopRunningRef.current) {
        startAnimation();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="absolute -inset-10 w-[calc(100%+80px)] h-[calc(100%+80px)] pointer-events-none z-0 flex items-center justify-center">
      {/* Hardware-accelerated CSS Pulsating background aura */}
      {(isSpeaking || isMusicActive) && (
        <div 
          className={`absolute rounded-full pointer-events-none will-change-[transform,opacity] ${
            size === 'large' ? 'w-[140px] h-[140px]' : 'w-[84px] h-[84px]'
          } ${
            isMusicActive 
              ? 'bg-gradient-to-tr from-pink-500/20 to-purple-600/20 shadow-[0_0_50px_rgba(236,72,153,0.35)]' 
              : 'bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 shadow-[0_0_50px_rgba(16,185,129,0.35)]'
          }`}
          style={{
            animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
      )}

      {/* Hardware-accelerated CSS rotating outer tech ring boundary */}
      {(isSpeaking || isMusicActive) && (
        <div 
          className={`absolute rounded-full pointer-events-none will-change-transform border-[1.5px] border-dashed ${
            size === 'large' ? 'w-[124px] h-[124px]' : 'w-[76px] h-[76px]'
          } ${
            isMusicActive 
              ? 'border-pink-500/30' 
              : 'border-emerald-500/35 border-dashed'
          }`}
          style={{
            animation: 'spin 12s linear infinite',
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />
    </div>
  );
};
