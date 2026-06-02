import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VoiceWaveVisualizerProps {
  volume: number; // Normalized real-time audio volume (0.05 to 1.0)
  isSpeaking: boolean;
  size?: 'large' | 'small';
  mode?: 'voice' | 'music';
}

export const VoiceWaveVisualizer: React.FC<VoiceWaveVisualizerProps> = ({
  volume,
  isSpeaking,
  size = 'small',
  mode = 'voice',
}) => {
  const containerRef = useRef<SVGSVGElement | null>(null);

  // Phases for animating waves independently over time
  const phase1 = useRef(0);
  const phase2 = useRef(1.2);
  const phase3 = useRef(2.5);

  // Store variables in refs so continuous loop can access latest values without triggering hook recreation
  const latestVolume = useRef(volume);
  const latestIsSpeaking = useRef(isSpeaking);
  const latestMode = useRef(mode);

  useEffect(() => {
    latestVolume.current = volume;
    latestIsSpeaking.current = isSpeaking;
    latestMode.current = mode;
  }, [volume, isSpeaking, mode]);

  useEffect(() => {
    if (!containerRef.current) return;

    const svg = d3.select(containerRef.current);
    
    // Select path elements
    const path1 = svg.select('.wave-path-1');
    const path2 = svg.select('.wave-path-2');
    const path3 = svg.select('.wave-path-3');

    // Number of coordinate points on the radial circle
    const numPoints = 48;
    const angles = d3.range(0, Math.PI * 2 + 0.1, (Math.PI * 2) / numPoints);

    // D3 Radial Line generator with cardiac-closed curves for liquid smooth waves
    const radialLine = d3.lineRadial<number>()
      .angle((_, i) => angles[i])
      .radius(d => d)
      .curve(d3.curveBasisClosed);

    let animationFrameId: number;

    const animate = () => {
      const vol = latestVolume.current;
      const speaking = latestIsSpeaking.current;
      const currentMode = latestMode.current;
      const isMusic = currentMode === 'music';

      // Dynamic scaling of voice energy
      const energy = speaking ? Math.max(vol, 0.25) : 0.03;
      
      // Speed up animation significantly if speaking or music for energetic fast responsive ripple waves
      const speedMultiplier = speaking ? (isMusic ? 3.4 : 2.6) : 0.25;
      phase1.current += 0.06 * speedMultiplier;
      phase2.current -= 0.04 * speedMultiplier;
      phase3.current += 0.05 * speedMultiplier;

      const baseRadius = 65; // Matches the standard visual border perimeter of the avatar inside 200x200 viewBox

      // WAVE 1 DATA: Emerald/Teal or Hot Pink fluid base
      const wave1Data = angles.map((theta, i) => {
        const sinPart = Math.sin(theta * 5 + phase1.current);
        const cosPart = Math.cos(theta * 3 - phase1.current * 0.8);
        const waveOffset = (sinPart * (isMusic ? 17 : 14) + cosPart * 8) * energy;
        return baseRadius + waveOffset;
      });

      // WAVE 2 DATA: Bright Green or Deep Fuchsia resonance
      const wave2Data = angles.map((theta, i) => {
        const sinPart = Math.sin(theta * 4 + phase2.current);
        const cosPart = Math.cos(theta * 2 + phase2.current * 1.2);
        const waveOffset = (sinPart * (isMusic ? 19 : 16) + cosPart * 6) * energy;
        return baseRadius + waveOffset;
      });

      // WAVE 3 DATA: Celestial Green or Purple spectrum
      const wave3Data = angles.map((theta, i) => {
        const sinPart = Math.sin(theta * 6 - phase3.current * 1.1);
        const cosPart = Math.cos(theta * 4 + phase3.current);
        const waveOffset = (sinPart * 12 + cosPart * 5) * energy;
        return baseRadius + waveOffset;
      });

      // Set D3 attributes on paths
      path1.attr('d', radialLine(wave1Data) || '');
      path2.attr('d', radialLine(wave2Data) || '');
      path3.attr('d', radialLine(wave3Data) || '');

      // Determine dynamic filters based on mode and speaking status
      const filter1Val = speaking ? (isMusic ? 'url(#glow-wave-music)' : 'url(#glow-wave-teal)') : 'none';
      const filter2Val = speaking ? (isMusic ? 'url(#glow-wave-music)' : 'url(#glow-wave-green)') : 'none';

      // Smoothly update attributes avoiding CSS transitions resets
      path1
        .style('filter', filter1Val)
        .style('opacity', speaking ? '0.85' : '0');
      
      path2
        .style('filter', filter2Val)
        .style('opacity', speaking ? '0.75' : '0');

      path3
        .style('opacity', speaking ? '0.65' : '0');

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const isMusic = mode === 'music';
  const stroke1 = isMusic ? '#F43F5E' : '#22C55E';
  const stroke2 = isMusic ? '#EC4899' : '#10B981';
  const stroke3 = isMusic ? '#A855F7' : '#4ADE80';
  const fill1 = isMusic ? 'url(#gradient-wave-music)' : 'url(#gradient-wave-teal)';
  const fill2 = isMusic ? 'url(#gradient-wave-music)' : 'url(#gradient-wave-green)';

  return (
    <svg
      ref={containerRef}
      viewBox="0 0 200 200"
      className="absolute inset-0 w-full h-full pointer-events-none z-0 scale-140 select-none overflow-visible"
    >
      <defs>
        {/* Glow Filters */}
        <filter id="glow-wave-teal" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-wave-green" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-wave-music" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradients */}
        <radialGradient id="gradient-wave-teal" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#22C55E" stopOpacity="0" />
          <stop offset="90%" stopColor="#22C55E" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0.45" />
        </radialGradient>

        <radialGradient id="gradient-wave-green" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#10B981" stopOpacity="0" />
          <stop offset="95%" stopColor="#10B981" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.35" />
        </radialGradient>

        <radialGradient id="gradient-wave-music" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#EC4899" stopOpacity="0" />
          <stop offset="90%" stopColor="#EC4899" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      {/* Layer 1: Vivid dynamic background wave */}
      <path
        className="wave-path-1"
        style={{ fill: fill1, stroke: stroke1, strokeWidth: 2, filter: isSpeaking ? (isMusic ? 'url(#glow-wave-music)' : 'url(#glow-wave-teal)') : 'none', opacity: isSpeaking ? 0.85 : 0 }}
        transform="translate(100, 100)"
      />

      {/* Layer 2: Midground wave */}
      <path
        className="wave-path-2"
        style={{ fill: fill2, stroke: stroke2, strokeWidth: 1.5, filter: isSpeaking ? (isMusic ? 'url(#glow-wave-music)' : 'url(#glow-wave-green)') : 'none', opacity: isSpeaking ? 0.75 : 0 }}
        transform="translate(100, 100)"
      />

      {/* Layer 3: Foreground wave outline */}
      <path
        className="wave-path-3"
        style={{ fill: 'none', stroke: stroke3, strokeWidth: 1, opacity: isSpeaking ? 0.65 : 0 }}
        transform="translate(100, 100)"
      />
    </svg>
  );
};
