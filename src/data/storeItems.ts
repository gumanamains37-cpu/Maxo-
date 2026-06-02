// Store & VIP System Item Inventories and Definitions

export interface StoreGift {
  id: string;
  name: string;
  icon: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  animation: 'pulse' | 'float' | 'spin' | 'bounce' | 'shake' | 'glow' | 'sparkle';
  category: 'Popular' | 'Love' | 'Vehicles' | 'Fantasy' | 'Status';
  description: string;
}

export type StoreItemType = 'frame' | 'badge' | 'bubble' | 'entrance' | 'avatar_dec' | 'room_dec' | 'vip_item';

export interface StoreItem {
  id: string;
  name: string;
  type: StoreItemType;
  description: string;
  price: number;
  priceType: 'coins' | 'diamonds';
  previewIcon: string;
  previewClass: string;
  vipRequiredLevel?: number;
}

// 50+ UNIQUE GIFTS 
export const MASTER_GIFTS: StoreGift[] = [
  // --- POPULAR (10 items) ---
  { id: 'rose', name: 'Rose', icon: '🌹', price: 10, rarity: 'common', animation: 'float', category: 'Popular', description: 'A classic symbol of affection' },
  { id: 'thumbs_up', name: 'Golden Clap', icon: '👏', price: 20, rarity: 'common', animation: 'bounce', category: 'Popular', description: 'Show your appreciation with golden applause' },
  { id: 'beer', name: 'Cheers Beer', icon: '🍻', price: 30, rarity: 'common', animation: 'shake', category: 'Popular', description: 'Let the conversation flow!' },
  { id: 'popcorn', name: 'Sweet Popcorn', icon: '🍿', price: 40, rarity: 'common', animation: 'pulse', category: 'Popular', description: 'Perfect snack for stream watchers' },
  { id: 'microphone', name: 'Golden Mic', icon: '🎤', price: 100, rarity: 'rare', animation: 'pulse', category: 'Popular', description: 'Honor the absolute best speaker' },
  { id: 'star', name: 'Superstar', icon: '⭐', price: 120, rarity: 'rare', animation: 'spin', category: 'Popular', description: 'Sparkle bright in the room' },
  { id: 'fire', name: 'Hot Chili', icon: '🔥', price: 150, rarity: 'rare', animation: 'bounce', category: 'Popular', description: 'This speaker is pure fire!' },
  { id: 'coffee', name: 'Latte Art', icon: '☕', price: 60, rarity: 'common', animation: 'float', category: 'Popular', description: 'Warm drink for cozy nights' },
  { id: 'lollipop', name: 'Sweet Candy', icon: '🍭', price: 50, rarity: 'common', animation: 'float', category: 'Popular', description: 'A cute sweet pop of flavor' },
  { id: 'crystal_ball', name: 'Oracle Ball', icon: '🔮', price: 200, rarity: 'rare', animation: 'glow', category: 'Popular', description: 'Predict a gorgeous future' },

  // --- LOVE (10 items) ---
  { id: 'heart', name: 'Ruby Heart', icon: '❤️', price: 50, rarity: 'common', animation: 'pulse', category: 'Love', description: 'Simple warm beacon of love' },
  { id: 'heart_fire', name: 'Heart Ablaze', icon: '❤️‍🔥', price: 150, rarity: 'rare', animation: 'pulse', category: 'Love', description: 'Our chemical connection is blazing' },
  { id: 'cupid_arrow', name: 'Cupid Bow', icon: '💘', price: 400, rarity: 'epic', animation: 'shake', category: 'Love', description: 'Shoot a heart straight through the air' },
  { id: 'chocolate', name: 'Luxury Truffles', icon: '🍫', price: 250, rarity: 'rare', animation: 'bounce', category: 'Love', description: 'Rich velvet dark chocolates' },
  { id: 'love_letter', name: 'Confession Mail', icon: '💌', price: 350, rarity: 'rare', animation: 'float', category: 'Love', description: 'Your secret love letter sent live' },
  { id: 'teddy_bear', name: 'Cuddly Bear', icon: '🧸', price: 450, rarity: 'epic', animation: 'shake', category: 'Love', description: 'A plush hugs friend' },
  { id: 'kiss', name: 'Kiss Blow', icon: '😘', price: 180, rarity: 'rare', animation: 'bounce', category: 'Love', description: 'Sends a sweet flying air kiss' },
  { id: 'diamond_ring', name: 'Solitaire Ring', icon: '💍', price: 2500, rarity: 'legendary', animation: 'sparkle', category: 'Love', description: 'An ultimate symbol of deep commitment' },
  { id: 'wedding', name: 'Heart Bouquet', icon: '💐', price: 1000, rarity: 'epic', animation: 'float', category: 'Love', description: 'Showering the room with beautiful petals' },
  { id: 'love_potion', name: 'Amour Elixir', icon: '🧪', price: 600, rarity: 'epic', animation: 'glow', category: 'Love', description: 'Charming magic brew to capture hearts' },

  // --- VEHICLES (10 items) ---
  { id: 'scooter', name: 'Vespa Scooter', icon: '🛵', price: 300, rarity: 'rare', animation: 'bounce', category: 'Vehicles', description: 'Draft through the streets in style' },
  { id: 'car', name: 'Sports Sedan', icon: '🚗', price: 800, rarity: 'epic', animation: 'shake', category: 'Vehicles', description: 'A sleek drive for everyday VIP transport' },
  { id: 'luxury_car', name: 'Super Hypercar', icon: '🏎️', price: 2000, rarity: 'legendary', animation: 'shake', category: 'Vehicles', description: 'Twin turbo engine that rumbles the room' },
  { id: 'yacht', name: 'Ocean Cruiser Yacht', icon: '🛥️', price: 5000, rarity: 'legendary', animation: 'float', category: 'Vehicles', description: 'Luxurious sail across pristine blue waves' },
  { id: 'private_jet', name: 'Mach-2 Jet Plane', icon: '🛩️', price: 15000, rarity: 'mythic', animation: 'float', category: 'Vehicles', description: 'Soar past boundaries into orbit' },
  { id: 'helicopter', name: 'Airforce Copter', icon: '🚁', price: 3500, rarity: 'legendary', animation: 'spin', category: 'Vehicles', description: 'Fly high over building tops with roaring blades' },
  { id: 'train', name: 'Bullet Express', icon: '🚄', price: 1200, rarity: 'epic', animation: 'shake', category: 'Vehicles', description: 'Fast transit speed to global capitals' },
  { id: 'submarine', name: 'Deep Diver Sub', icon: '🎛️', price: 4500, rarity: 'legendary', animation: 'glow', category: 'Vehicles', description: 'Explore hidden ocean treasures' },
  { id: 'hoverboard', name: 'Gravity Board', icon: '🛹', price: 250, rarity: 'rare', animation: 'float', category: 'Vehicles', description: 'Levitating platform for tech enthusiasts' },
  { id: 'space_shuttle', name: 'Apollo Orbiter', icon: '🚀', price: 25000, rarity: 'mythic', animation: 'sparkle', category: 'Vehicles', description: 'Unprecedented deep space cosmic voyage' },

  // --- FANTASY (10 items) ---
  { id: 'wand', name: 'Arcane Wand', icon: '🪄', price: 120, rarity: 'rare', animation: 'sparkle', category: 'Fantasy', description: 'Cast a magical glistening spell' },
  { id: 'potion', name: 'Mana Potion', icon: '🧪', price: 80, rarity: 'common', animation: 'float', category: 'Fantasy', description: 'Restore core vocal energy reserves' },
  { id: 'pegasus', name: 'Celestial Pegasus', icon: '🦄', price: 4000, rarity: 'legendary', animation: 'float', category: 'Fantasy', description: 'A mythic winged horse of starlight' },
  { id: 'phoenix', name: 'Eternal Phoenix', icon: '🪶', price: 8000, rarity: 'legendary', animation: 'glow', category: 'Fantasy', description: 'Reborn in golden flames of glory' },
  { id: 'dragon', name: 'Crimson Drake Dragon', icon: '🐉', price: 12000, rarity: 'mythic', animation: 'shake', category: 'Fantasy', description: 'Roars scorching fire breaths in room' },
  { id: 'genie_lamp', name: 'Wish Lantern Lamp', icon: '🪔', price: 1500, rarity: 'epic', animation: 'glow', category: 'Fantasy', description: 'Unlock three ultimate majestic wishes' },
  { id: 'fairy_dust', name: 'Pixie Dust Sparkle', icon: '✨', price: 400, rarity: 'rare', animation: 'sparkle', category: 'Fantasy', description: 'Sprinkle ethereal light and fairy dust' },
  { id: 'thor_hammer', name: 'Mjolnir Hammer', icon: '🔨', price: 1800, rarity: 'epic', animation: 'shake', category: 'Fantasy', description: 'Summons violent high voltage lightning streaks' },
  { id: 'crystal_castle', name: 'Stardust Keep', icon: '🏰', price: 9500, rarity: 'legendary', animation: 'pulse', category: 'Fantasy', description: 'Erect an impenetrable starlight fortress' },
  { id: 'dark_magic', name: 'Shadow Grimoire', icon: '📖', price: 2200, rarity: 'epic', animation: 'pulse', category: 'Fantasy', description: 'Summon forbidden dark dynamic energies' },

  // --- STATUS (10 items) ---
  { id: 'crown_gold', name: 'Imperial Crown', icon: '👑', price: 1000, rarity: 'epic', animation: 'bounce', category: 'Status', description: 'Rule peerless over social networks' },
  { id: 'diamond_gem', name: 'Pure Koh-i-Noor Diamond', icon: '💎', price: 1500, rarity: 'epic', animation: 'sparkle', category: 'Status', description: 'Pristine flawless gem cut with cosmic perfection' },
  { id: 'gold_bar', name: 'Swiss Gold Bar Bullion', icon: '🍫', price: 3000, rarity: 'legendary', animation: 'glow', category: 'Status', description: 'Stored investment standard of pure gold' },
  { id: 'money_rain', name: 'Cash Blizzard', icon: '💸', price: 1600, rarity: 'epic', animation: 'float', category: 'Status', description: 'Shower active speakers in absolute wealth' },
  { id: 'banknote', name: 'Grand Briefcase', icon: '💼', price: 500, rarity: 'rare', animation: 'shake', category: 'Status', description: 'Cash reserves from venture outcomes' },
  { id: 'vip_card', name: 'Platin Black Card', icon: '💳', price: 1100, rarity: 'epic', animation: 'pulse', category: 'Status', description: 'Limitless black card credential status' },
  { id: 'starlight', name: 'Nebula Stardust Trophy', icon: '🏆', price: 6500, rarity: 'legendary', animation: 'glow', category: 'Status', description: 'Awarded to absolute legends of Maxo' },
  { id: 'throne', name: 'Obsidian Velvet Throne', icon: '🛋️', price: 7500, rarity: 'legendary', animation: 'pulse', category: 'Status', description: 'Claim the central commander royal seat' },
  { id: 'planet_saturn', name: 'Chronos Planetary System', icon: '🪐', price: 10000, rarity: 'legendary', animation: 'spin', category: 'Status', description: 'Command cosmic orbits around your space' },
  { id: 'royal_seal', name: 'Sovereign Emblem Badge', icon: '⚜️', price: 350, rarity: 'rare', animation: 'sparkle', category: 'Status', description: 'Eminent royalty sigil of nobility' }
];

// FASHION ITEMS SYSTEM (Frames, entrance effects, bubbles, avatar decorations, room decors, VIP memberships)
export const STORE_ITEMS: StoreItem[] = [
  // --- Profile Frames ---
  { 
    id: 'frame_neon', 
    name: 'Cosmic Neon Frame', 
    type: 'frame', 
    description: 'Vibrant sci-fi glowing neon cyan energy field', 
    price: 150, 
    priceType: 'coins',
    previewIcon: '💫',
    previewClass: 'border-2 border-dashed border-cyan-400 p-0.5 animate-pulse rounded-full'
  },
  { 
    id: 'frame_gold', 
    name: 'Golden Crown Frame', 
    type: 'frame', 
    description: 'Elegant shimmering 24K gold royal avatar frame', 
    price: 350, 
    priceType: 'coins',
    previewIcon: '👑',
    previewClass: 'border-2 border-amber-400 p-0.5 shadow-[0_0_10px_rgba(251,191,36,0.5)] rounded-full'
  },
  { 
    id: 'frame_flame', 
    name: 'Eternal Flame Frame', 
    type: 'frame', 
    description: 'Passionate crimson animated core fire border', 
    price: 600, 
    priceType: 'coins',
    previewIcon: '🔥',
    previewClass: 'border-2 border-rose-600 p-0.5 shadow-[0_0_15px_rgba(225,29,72,0.8)] rounded-full'
  },
  { 
    id: 'frame_sakura', 
    name: 'Sakura Petals Frame', 
    type: 'frame', 
    description: 'Soft pink floating cherry blossom organic border', 
    price: 250, 
    priceType: 'coins',
    previewIcon: '🌸',
    previewClass: 'border-2 border-pink-400 p-0.5 rounded-full shadow-[0_0_8px_rgba(244,114,182,0.4)]'
  },
  { 
    id: 'frame_void', 
    name: 'Void Nebula Frame', 
    type: 'frame', 
    description: 'Exclusive dark gravity void consuming cosmic light', 
    price: 900, 
    priceType: 'coins',
    previewIcon: '🌌',
    previewClass: 'border-2 border-purple-600 p-0.5 rounded-full shadow-[0_0_20px_rgba(147,51,234,0.75)]'
  },

  // --- Entrance Effects ---
  { 
    id: 'entrance_warp', 
    name: 'Hyper Warp Star Portal', 
    type: 'entrance', 
    description: 'Epic hyperspace light warp speed entry animation', 
    price: 450, 
    priceType: 'coins',
    previewIcon: '🛸',
    previewClass: 'bg-indigo-500/10 text-indigo-400 rounded-full p-2 border border-indigo-500/20'
  },
  { 
    id: 'entrance_phoenix', 
    name: 'Phoenix Fire Rebirth', 
    type: 'entrance', 
    description: 'Explode in a blinding burst of fire bird rebirth', 
    price: 1200, 
    priceType: 'coins',
    previewIcon: '🐦‍🔥',
    previewClass: 'bg-orange-500/10 text-orange-400 rounded-full p-2 border border-orange-500/20'
  },
  { 
    id: 'entrance_thunder', 
    name: 'Volt Lightning Striker', 
    type: 'entrance', 
    description: 'Strike down from the skies in blue thermal thunderbolts', 
    price: 800, 
    priceType: 'coins',
    previewIcon: '⚡',
    previewClass: 'bg-blue-500/10 text-blue-400 rounded-full p-2 border border-blue-500/20'
  },

  // --- Chat Bubbles ---
  { 
    id: 'bubble_retro', 
    name: 'Retro Neon Wave Bubble', 
    type: 'bubble', 
    description: 'Custom text dialog box styled with vibrant vintage neon borders', 
    price: 200, 
    priceType: 'coins',
    previewIcon: '💬',
    previewClass: 'bg-emerald-500/10 text-emerald-400 rounded-full p-2 border border-emerald-500/20'
  },
  { 
    id: 'bubble_royal', 
    name: 'Baroque Gilded Bubble', 
    type: 'bubble', 
    description: 'An elegant imperial dialogue card framed in pure gold leafing', 
    price: 400, 
    priceType: 'coins',
    previewIcon: '✉️',
    previewClass: 'bg-amber-500/10 text-amber-400 rounded-full p-2 border border-amber-500/20'
  },
  { 
    id: 'bubble_cyber', 
    name: 'Cybernetic HUD Bubble', 
    type: 'bubble', 
    description: 'Sleek neon tech interface speech card directly from the future', 
    price: 350, 
    priceType: 'coins',
    previewIcon: '🤖',
    previewClass: 'bg-cyan-500/10 text-cyan-400 rounded-full p-2 border border-cyan-500/20'
  },

  // --- Avatar Decorations ---
  { 
    id: 'avatar_catears', 
    name: 'Cute Anime Neko Ears', 
    type: 'avatar_dec', 
    description: 'Equip adorable black cat ears on top of your avatar frame', 
    price: 180, 
    priceType: 'coins',
    previewIcon: '🐱',
    previewClass: 'bg-pink-500/15 text-pink-400 rounded-full p-2'
  },
  { 
    id: 'avatar_halo', 
    name: 'Angelic Celestial Halo', 
    type: 'avatar_dec', 
    description: 'Spinning radiant yellow circle of grace above your head', 
    price: 380, 
    priceType: 'coins',
    previewIcon: '😇',
    previewClass: 'bg-yellow-400/15 text-yellow-300 rounded-full p-2'
  },
  { 
    id: 'avatar_goggles', 
    name: 'Cyberpunk Visor Goggles', 
    type: 'avatar_dec', 
    description: 'Stylish luminous digital visor overlay across your profile photo', 
    price: 280, 
    priceType: 'coins',
    previewIcon: '🕶️',
    previewClass: 'bg-violet-500/15 text-violet-400 rounded-full p-2'
  },

  // --- Room Decorations ---
  { 
    id: 'room_stage', 
    name: 'Neon Concert Coliseum', 
    type: 'room_dec', 
    description: 'Vocal room backdrop themed after high-end neon concert stages', 
    price: 1500, 
    priceType: 'coins',
    previewIcon: '🏟️',
    previewClass: 'bg-red-500/15 text-red-400 rounded-full p-2'
  },
  { 
    id: 'room_beach', 
    name: 'Bora Bora Resort Palms', 
    type: 'room_dec', 
    description: 'An immersive relaxing ocean wave themed room layout with palm cards', 
    price: 1000, 
    priceType: 'coins',
    previewIcon: '🏖️',
    previewClass: 'bg-sky-500/15 text-sky-400 rounded-full p-2'
  },
  { 
    id: 'room_stars', 
    name: 'Stardust Cosmic Canopy', 
    type: 'room_dec', 
    description: 'Deep celestial background displaying galaxies and passing comets', 
    price: 2200, 
    priceType: 'coins',
    previewIcon: '☄️',
    previewClass: 'bg-purple-500/15 text-purple-400 rounded-full p-2'
  },

  // --- VIP Memberships ---
  { 
    id: 'vip_silver', 
    name: 'Silver Elite VIP Card', 
    type: 'vip_item', 
    description: 'Unlock entry benefits, exclusive silver badge, and 10% bonus coins', 
    price: 1000, 
    priceType: 'coins',
    previewIcon: '🥈',
    previewClass: 'bg-zinc-400 text-[#09090B] font-extrabold rounded-full p-2 shadow-[0_0_10px_rgba(156,163,175,0.4)]'
  },
  { 
    id: 'vip_gold', 
    name: 'Gold Monarch VIP Card', 
    type: 'vip_item', 
    description: 'Premium gold crown status badge, 4 customized entry effects, plus 25% coin rewards', 
    price: 2500, 
    priceType: 'coins',
    previewIcon: '🥇',
    previewClass: 'bg-yellow-400 text-[#09090B] font-extrabold rounded-full p-2 shadow-[0_0_15px_rgba(250,204,21,0.5)]'
  },
  { 
    id: 'vip_royal', 
    name: 'Royal Diamond VIP Card', 
    type: 'vip_item', 
    description: 'Immunity to standard host kicks, diamond rank badge, 50% coin bonuses, and infinite themes', 
    price: 7500, 
    priceType: 'coins',
    previewIcon: '💎',
    previewClass: 'bg-indigo-400 text-white font-extrabold rounded-full p-2 shadow-[0_0_20px_rgba(129,140,248,0.6)]'
  }
];

// Helper to look up an item of any type by ID
export const lookupStoreItem = (id: string): StoreItem | StoreGift | undefined => {
  const item = STORE_ITEMS.find(it => it.id === id);
  if (item) return item;
  return MASTER_GIFTS.find(g => g.id === id);
};
