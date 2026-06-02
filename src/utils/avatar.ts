// Curated, ultra-stylish premium high-elevation profile portraits
const PREMIUM_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&q=80', // Female Neon
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&q=80', // Male Studio
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&q=80', // Female Light
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&q=80', // Male Cool
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&q=80', // Female Elegant
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&q=80', // Male Casual
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&h=150&fit=crop&q=80', // Female GoldenHour
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&h=150&fit=crop&q=80', // Male Light Warm
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150&h=150&fit=crop&q=80', // Female Sunset
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&q=80', // Male Professional
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&q=80', // Female Cyberpunk
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&q=80', // Female Bright Studio
];

// Curated ultra-stylish premium high-elevation party room wallpapers / covers
const PREMIUM_COVERS = [
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop', // Concert Cyber Neon
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop', // DJ Deck Fire Neon
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop', // Neon Stage Lights
  'https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=600&auto=format&fit=crop', // Pink Gold Fluid Design
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop', // Premium Studio Microphone
  'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop', // Luxury Velvet Sunset Lit Canopy
];

/**
 * Returns a stable premium luxury avatar photo based on the seed string.
 */
export function getPremiumAvatar(seed?: string): string {
  if (!seed) return PREMIUM_AVATARS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PREMIUM_AVATARS.length;
  return PREMIUM_AVATARS[index];
}

/**
 * Returns a stable premium luxury room wallpaper cover based on the seed string.
 */
export function getPremiumRoomCover(seed?: string): string {
  if (!seed) return PREMIUM_COVERS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PREMIUM_COVERS.length;
  return PREMIUM_COVERS[index];
}

export { PREMIUM_AVATARS, PREMIUM_COVERS };
