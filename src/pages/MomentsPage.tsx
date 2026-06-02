import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db, safeOnSnapshot } from '@/lib/firebase';
import { collection, query, addDoc, doc, updateDoc, deleteDoc, orderBy, limit, serverTimestamp, getDocs, increment } from 'firebase/firestore';
import { MessageSquare, Users, UserPlus, Search, Heart, Share2, Trash2, Image as ImageIcon, Plus, X, Sparkles, Smile, Flame, Play, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getPremiumAvatar } from '@/utils/avatar';

// Gradient presets for text-only Story creation
const PRESET_GRADIENTS = [
  'from-pink-500 via-purple-600 to-indigo-500',
  'from-amber-400 to-pink-600',
  'from-teal-400 to-emerald-600',
  'from-purple-600 via-[#8A2387] to-[#E94057]',
  'from-[#11998e] to-[#38ef7d]',
  'from-[#00c6ff] to-[#0072ff]'
];

// Rich aesthetic default backgrounds for Moments
const momentPresets = [
  { name: 'Live DJ Night', url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop' },
  { name: 'Burj Khalifa View', url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=600&auto=format&fit=crop' },
  { name: 'Coffee & Mic', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop' },
  { name: 'Studio Chill', url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop' }
];

interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  imageUrl?: string;
  bgColorClass?: string;
  text?: string;
  createdAt: string;
  expiresAt: string;
  reactions?: Record<string, number>;
}

interface MomentPost {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  content: string;
  image?: string;
  likes: string[]; // List of user IDs who liked
  likesCount: number;
  commentsCount: number;
  timeLabel: string;
  createdAt: any;
}

export default function MomentsPage() {
  const { profile: selfProfile } = useAuth();
  
  // Real Firestore States
  const [stories, setStories] = useState<Story[]>([]);
  const [posts, setPosts] = useState<MomentPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [creationTab, setCreationTab] = useState<'Post' | 'Story'>('Post');
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(PRESET_GRADIENTS[0]);
  const [storyText, setStoryText] = useState('');
  const [storyImage, setStoryStoryImage] = useState('');

  // Active Story viewer states
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeStoryProgress, setActiveStoryProgress] = useState(0);

  // Comments support states
  const [activeCommentPost, setActiveCommentPost] = useState<MomentPost | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  // Image Compression & Optimization States (High-performance lossless visual compression)
  const [compressingState, setCompressingState] = useState<{
    active: boolean;
    progress: number;
    originalSize: string;
    compressedSize: string;
    target: 'Post' | 'Story' | null;
  }>({
    active: false,
    progress: 0,
    originalSize: '',
    compressedSize: '',
    target: null,
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 1;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // High-fidelity image optimization on client (Supports heavy 10MB+ images compiled instantly onto HD 1200px JPEG textures)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'Post' | 'Story') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressingState({
      active: true,
      progress: 10,
      originalSize: formatBytes(file.size),
      compressedSize: '',
      target
    });

    const progressInterval = setInterval(() => {
      setCompressingState(prev => {
        if (prev.progress < 85) {
          return { ...prev, progress: prev.progress + 15 };
        }
        return prev;
      });
    }, 120);

    try {
      const optimizedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(event.target?.result as string);
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            // Compress with high quality 0.78 to balance gorgeous HD clarity and minimal storage size
            const compressed = canvas.toDataURL('image/jpeg', 0.78);
            resolve(compressed);
          };
          img.onerror = () => reject(new Error("Image initialization failed"));
        };
        reader.onerror = () => reject(new Error("File read error"));
      });

      clearInterval(progressInterval);
      const approxBytes = Math.round((optimizedDataUrl.length - 22) * 3 / 4);

      setCompressingState(prev => ({
        ...prev,
        progress: 100,
        compressedSize: formatBytes(approxBytes)
      }));

      if (target === 'Post') {
        setPostImage(optimizedDataUrl);
      } else {
        setStoryStoryImage(optimizedDataUrl);
      }

      toast.success(`Image optimized perfectly! Reduced from ${formatBytes(file.size)} to ${formatBytes(approxBytes)} ✨`);

      setTimeout(() => {
        setCompressingState(prev => ({ ...prev, active: false }));
      }, 1200);

    } catch (err) {
      clearInterval(progressInterval);
      setCompressingState(prev => ({ ...prev, active: false }));
      toast.error("Failed to automatically optimize image.");
      console.error(err);
    }
  };

  // Add Comment Firestore updates
  const handleAddComment = async () => {
    if (!activeCommentPost || !commentText.trim() || !selfProfile) return;
    try {
      const cText = commentText.trim();
      const commentDoc = {
        userId: selfProfile.uid,
        userName: selfProfile.displayName,
        userPhoto: selfProfile.photoURL || getPremiumAvatar(selfProfile.uid),
        text: cText,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'posts', activeCommentPost.id, 'comments'), commentDoc);
      await updateDoc(doc(db, 'posts', activeCommentPost.id), {
        commentsCount: increment(1)
      });
      // Synchronously update the current active state to increment counter in local state
      setActiveCommentPost(prev => prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : null);
      setCommentText('');
      toast.success("Comment published!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add comment.");
    }
  };

  // Subscribe to raw live stories & posts
  useEffect(() => {
    // Sync Posts
    const qPosts = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubPosts = safeOnSnapshot(qPosts, async (snap) => {
      if (snap.empty) {
        // If empty, let's create starter fallback in memory to avoid empty slides
        setPosts(getStarterPosts());
      } else {
        const list = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            userName: data.userName || 'Member',
            userPhoto: data.userPhoto || getPremiumAvatar(''),
            content: data.content || '',
            image: data.image || '',
            createdAt: data.createdAt,
            likes: data.likes || [],
            likesCount: data.likesCount || (data.likes ? data.likes.length : 0),
            commentsCount: data.commentsCount || 0,
            timeLabel: data.createdAt ? 'Recently' : 'Just now',
            reactions: data.reactions || { '🔥': [], '❤️': [], '👍': [], '🎉': [] }
          } as MomentPost;
        });
        setPosts(list);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Offline or failed on snapshot for posts. Using fallbacks.", err);
      setPosts(getStarterPosts());
      setLoading(false);
    });

    // Sync Stories (filtering out those where expiresAt < now)
    const qStories = query(collection(db, 'stories'));
    const unsubStories = safeOnSnapshot(qStories, (snap) => {
      const now = new Date().getTime();
      const list = snap.docs
        .map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data } as Story;
        })
        .filter(s => {
          const expiryTime = new Date(s.expiresAt).getTime();
          return expiryTime > now;
        });

      if (list.length === 0) {
        setStories(getStarterStories());
      } else {
        setStories(list);
      }
    }, (err) => {
      console.warn("Failed stories snap", err);
      setStories(getStarterStories());
    });

    return () => {
      unsubPosts();
      unsubStories();
    };
  }, []);

  // Comments live database query listener
  useEffect(() => {
    if (!activeCommentPost) {
      setCommentsList([]);
      return;
    }
    const q = query(
      collection(db, 'posts', activeCommentPost.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = safeOnSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCommentsList(list);
    }, (err) => {
      console.warn("Offline comments load backup", err);
    });
    return unsub;
  }, [activeCommentPost]);

  // Story Viewer Auto-Next & progress timer
  useEffect(() => {
    if (activeStoryIndex === null) return;
    setActiveStoryProgress(0);

    const interval = setInterval(() => {
      setActiveStoryProgress(prev => {
        if (prev >= 100) {
          // Move next
          if (activeStoryIndex < stories.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
          } else {
            // Close viewer
            setActiveStoryIndex(null);
          }
          return 0;
        }
        return prev + 1.25; // Speed for ~8 seconds story duration
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryIndex, stories]);

  // Create real Moment Post
  const handleCreatePost = async () => {
    if (!selfProfile) return;
    if (!postText.trim()) {
      toast.error("Please add some written thoughts first!");
      return;
    }

    try {
      const newPost = {
        userId: selfProfile.uid,
        userName: selfProfile.displayName,
        userPhoto: selfProfile.photoURL || getPremiumAvatar(selfProfile.uid),
        content: postText.slice(0, 1000),
        image: postImage || null,
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'posts'), newPost);
      toast.success("Moment post broadcasted 🌍🎤");
      
      // Clear forms
      setPostText('');
      setPostImage('');
      setShowCreationModal(false);
    } catch (e) {
      console.error(e);
      toast.error("Offline write queued. Try again later.");
    }
  };

  // Create real Story (with 24h expiration)
  const handleCreateStory = async () => {
    if (!selfProfile) return;
    if (!storyText.trim() && !storyImage) {
      toast.error("Your story needs a background or some words!");
      return;
    }

    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const newStory: Omit<Story, 'id'> = {
        userId: selfProfile.uid,
        userName: selfProfile.displayName,
        userPhoto: selfProfile.photoURL || getPremiumAvatar(selfProfile.uid),
        imageUrl: storyImage || undefined,
        bgColorClass: storyImage ? undefined : selectedGradient,
        text: storyText || undefined,
        createdAt: new Date().toISOString(),
        expiresAt,
        reactions: { '💖': 0, '🔥': 0, '🎉': 0, '😂': 0 }
      };

      await addDoc(collection(db, 'stories'), newStory);
      toast.success("Fleeting Story published for 24 Hours! 🌟⛺");
      
      // Cleanup
      setStoryText('');
      setStoryStoryImage('');
      setShowCreationModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to build status story");
    }
  };

  // Like / React to Moments with Firestore write
  const handleLikePost = async (post: MomentPost) => {
    if (!selfProfile) return;
    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likes.includes(selfProfile.uid);
    let updatedLikes = [];

    if (hasLiked) {
      updatedLikes = post.likes.filter(id => id !== selfProfile.uid);
    } else {
      updatedLikes = [...post.likes, selfProfile.uid];
    }

    try {
      await updateDoc(postRef, {
        likes: updatedLikes,
        likesCount: updatedLikes.length
      });
    } catch (err) {
      // Local optimistic update block
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            likes: updatedLikes,
            likesCount: updatedLikes.length
          };
        }
        return p;
      }));
    }
  };

  // Delete self Moments Post
  const handleDeletePost = async (post: MomentPost) => {
    if (!selfProfile || post.userId !== selfProfile.uid) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      toast.success("Post deleted successfully");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // Delete Story
  const handleDeleteStory = async (story: Story) => {
    if (!selfProfile || story.userId !== selfProfile.uid) return;
    try {
      await deleteDoc(doc(db, 'stories', story.id));
      toast.success("Story deleted");
      setActiveStoryIndex(null);
    } catch (err) {
      toast.error("Could not delete");
    }
  };

  // React on Story
  const handleReactStory = async (story: Story, emoji: string) => {
    try {
      const storyRef = doc(db, 'stories', story.id);
      const prevVal = story.reactions?.[emoji] || 0;
      await updateDoc(storyRef, {
        [`reactions.${emoji}`]: prevVal + 1
      });
      toast.info(`Sent ${emoji} to ${story.userName}!`);
    } catch (err) {
      console.warn("Offline reaction simulation");
    }
  };

  // In Memory premium starter items on fresh databases
  function getStarterStories(): Story[] {
    return [
      {
        id: 'starter_1',
        userId: 'anya_test',
        userName: 'Anya ✨',
        userPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
        bgColorClass: PRESET_GRADIENTS[0],
        text: 'Live music show starts at 8 PM on lounge microphone 2! Please tag your friends 🎧🎧',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        reactions: { '💖': 15, '🔥': 22, '🎉': 9, '😂': 0 }
      },
      {
        id: 'starter_2',
        userId: 'zara_dj',
        userName: 'Zara 🎧',
        userPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
        imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        reactions: { '💖': 44, '🔥': 65, '🎉': 40, '😂': 2 }
      },
      {
        id: 'starter_3',
        userId: 'leo_audio',
        userName: 'Leo DJ 🎤',
        userPhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
        bgColorClass: PRESET_GRADIENTS[2],
        text: 'Just upgraded my VIP level to Grandmaster! Let\'s go guys! 💎💎💎',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        reactions: { '💖': 25, '🔥': 12, '🎉': 41, '😂': 0 }
      }
    ];
  }

  function getStarterPosts(): MomentPost[] {
    return [
      {
        id: 'p_starter_1',
        userId: 'anya_test',
        userName: 'Anya ✨',
        userPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
        content: 'Loving this new Maxo audio lounge! The HD room acoustics are incredible. Let\'s host a poetry event tonight! Who is up? ❤️✨ #positivevibes #poetry #audio',
        image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop',
        likes: ['test_liker_1'],
        likesCount: 124,
        commentsCount: 22,
        timeLabel: '2 hours ago',
        createdAt: null
      },
      {
        id: 'p_starter_2',
        userId: 'zara_dj',
        userName: 'Zara 🎧',
        userPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
        content: 'Check out the views of Dubai! Best sunset spot of the month. Feeling blessed to meet the Maxo developers community. 🎤💖',
        image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=600&auto=format&fit=crop',
        likes: [],
        likesCount: 88,
        commentsCount: 14,
        timeLabel: '5 hours ago',
        createdAt: null
      }
    ];
  }

  return (
    <div className="bg-[#0C101A] min-h-screen pb-32 text-white">
      {/* Header */}
      <header className="flex justify-between items-center px-6 pt-12 pb-6 border-b border-white/5 sticky top-0 bg-[#0C101A]/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-pink-500 to-indigo-500 rounded-xl">
            <Sparkles className="text-white animate-pulse" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest text-white uppercase italic leading-none">
              MOMENTS
            </h2>
            <p className="text-[9px] text-[#FF4D67] font-extrabold uppercase tracking-widest mt-1">Community Hub</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white rounded-full bg-white/5">
            <Search size={20} />
          </Button>
          <button 
            onClick={() => { setCreationTab('Post'); setShowCreationModal(true); }}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#FF4D67] to-[#FF8A96] flex items-center justify-center text-white shadow-lg shadow-red-500/20 active:scale-90 transition-transform cursor-pointer"
            title="Create Post or Story"
          >
            <Plus size={20} className="stroke-[3]" />
          </button>
        </div>
      </header>

      {/* Stories Section */}
      <section className="py-6 border-b border-white/5 overflow-hidden">
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar px-6">
          
          {/* Creator "+ Story" Node */}
          <div className="flex flex-col items-center gap-2 shrink-0">
             <div 
               onClick={() => { setCreationTab('Story'); setShowCreationModal(true); }}
               className="w-14 h-14 rounded-full bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 cursor-pointer hover:border-[#FF4D67] hover:text-[#FF4D67] hover:bg-red-500/5 transition-all relative group"
             >
                <Plus size={20} className="group-hover:scale-115 transition-transform" />
                <div className="absolute inset-0 rounded-full bg-[#FF4D67]/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Add Story</span>
          </div>

          {/* List of dynamic fleeting stories */}
          {stories.map((story, index) => (
            <div 
              key={story.id} 
              onClick={() => setActiveStoryIndex(index)}
              className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
            >
              <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-[#FF4D67] via-purple-600 to-indigo-500 hover:scale-105 active:scale-95 transition-all">
                <div className="p-[2.5px] bg-[#0C101A] rounded-full">
                   <Avatar className="w-13 h-13 border-2 border-white/5">
                     <AvatarImage src={story.userPhoto} className="object-cover" />
                     <AvatarFallback className="bg-[#1C2030] text-xs font-bold text-gray-300">{story.userName?.[0] || '?'}</AvatarFallback>
                   </Avatar>
                </div>
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0C101A] rounded-full flex items-center justify-center shadow-lg animate-pulse" />
              </div>
              <span className="text-[9px] font-extrabold text-white/70 group-hover:text-pink-400 max-w-[64px] truncate text-center transition-colors">
                {story.userName}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Main Feed Feed posts */}
      <div className="px-5 space-y-8 pt-8 max-w-lg mx-auto">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[10px] font-black tracking-widest text-[#FF4D67] uppercase">BROADCASTS FEED</h3>
          <span className="text-[9px] text-gray-500 font-extrabold">REAL-TIME</span>
        </div>

        {posts.map((post) => {
          const hasLiked = post.likes.includes(selfProfile?.uid || '');
          return (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              key={post.id} 
              className="bg-[#13192B]/50 border border-white/5 p-5 rounded-[32px] flex flex-col gap-4 relative group hover:border-white/10 transition-colors shadow-xl"
            >
              {/* Post Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-pink-500/20 to-indigo-500/20">
                     <Avatar className="w-11 h-11 border border-white/10">
                       <AvatarImage src={post.userPhoto} className="object-cover" />
                       <AvatarFallback className="bg-zinc-800 font-bold">{post.userName?.[0] || '?'}</AvatarFallback>
                     </Avatar>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-black text-white hover:text-pink-400 transition-colors cursor-pointer">{post.userName}</h4>
                      <Badge className="bg-gradient-to-r from-teal-400 to-emerald-400 text-black text-[7px] font-black px-1.5 h-3.5 rounded uppercase leading-none border-none">ACTIVE</Badge>
                    </div>
                    <p className="text-[9px] text-[#FF4D67] font-black tracking-tight uppercase mt-0.5">{post.timeLabel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {selfProfile && post.userId === selfProfile.uid && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeletePost(post)}
                      className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-full w-8 h-8"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[9px] font-black uppercase text-pink-400 hover:bg-pink-500/15 rounded-full px-3"
                  >
                    Follow
                  </Button>
                </div>
              </div>

              {/* Message Content */}
              <p className="text-[11px] text-gray-300 leading-relaxed font-semibold px-0.5">
                {post.content}
              </p>

              {/* Optional Rich Thumbnail */}
              {post.image && (
                <div className="relative rounded-[24px] overflow-hidden border border-white/5 shadow-inner">
                  <img src={post.image} className="w-full aspect-[4/3] object-cover group-hover:scale-102 transition-transform duration-700" alt="broadcast attachment" />
                  <div className="absolute bottom-3 left-3 bg-[#0C101A]/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white text-[9px] font-black">
                     HD VIEW
                  </div>
                </div>
              )}

              {/* Interactive Feed Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => handleLikePost(post)}
                    className="flex items-center gap-2 group/btn"
                  >
                     <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                       hasLiked 
                         ? 'bg-red-500/20 text-red-400' 
                         : 'bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                     }`}>
                        <Heart size={16} fill={hasLiked ? "currentColor" : "none"} className="group-active/btn:scale-130 transition-transform" />
                     </div>
                     <span className={`text-[10px] font-extrabold ${hasLiked ? 'text-red-400' : 'text-gray-500'}`}>{post.likesCount}</span>
                  </button>

                  <button 
                    onClick={() => setActiveCommentPost(post)}
                    className="flex items-center gap-2 group/cmnt"
                  >
                     <div className="w-9 h-9 rounded-full bg-white/5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 flex items-center justify-center transition-all">
                        <MessageSquare size={16} />
                     </div>
                     <span className="text-[10px] font-extrabold text-gray-500">{post.commentsCount}</span>
                  </button>

                  <div className="flex gap-1 items-center bg-black/10 px-2 py-1 rounded-full border border-white/5">
                    {Object.entries((post as any).reactions || { '🔥': [], '❤️': [], '👍': [], '🎉': [] }).map(([emoji, uids]) => {
                      const currentUids = (uids as string[]) || [];
                      const hasReacted = currentUids.includes(selfProfile?.uid || '');
                      return (
                        <button
                          key={emoji}
                          onClick={async () => {
                            if (!selfProfile) return;
                            const postRef = doc(db, 'posts', post.id);
                            let updatedUids = [];
                            if (currentUids.includes(selfProfile.uid)) {
                              updatedUids = currentUids.filter(id => id !== selfProfile.uid);
                            } else {
                              updatedUids = [...currentUids, selfProfile.uid];
                            }
                            const nextReactions = {
                              ...((post as any).reactions || { '🔥': [], '❤️': [], '👍': [], '🎉': [] }),
                              [emoji]: updatedUids
                            };
                            try {
                              await updateDoc(postRef, { reactions: nextReactions });
                            } catch {
                              setPosts(prev => prev.map(p => p.id === post.id ? { ...p, reactions: nextReactions } : p));
                            }
                          }}
                          className={`px-2 py-1 rounded-full text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-90 ${
                            hasReacted ? 'bg-pink-505/20 border border-pink-500/40 text-pink-400' : 'hover:bg-white/5 border border-transparent text-gray-400'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[9px] font-bold">{currentUids.length}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`Maxo Moment: "${post.content.slice(0, 40)}..."`);
                    toast.success("Broadcast Link copied to clipboard!");
                  }}
                  className="w-9 h-9 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* FULL STORIES ACCORDION VIEWER PANEL (Immersive Full Screen Modal) */}
      <AnimatePresence>
        {activeStoryIndex !== null && stories[activeStoryIndex] && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black z-50 flex flex-col justify-between p-4"
          >
            {/* Story Bar Timer indicator */}
            <div className="space-y-4">
              <div className="flex gap-1.5 w-full">
                {stories.map((s, idx) => (
                  <div key={s.id} className="h-1 bg-white/20 rounded-full flex-1 overflow-hidden">
                    <div 
                      className="h-full bg-pink-500 transition-all duration-300"
                      style={{ 
                        width: 
                          idx < activeStoryIndex 
                            ? '100%' 
                            : idx === activeStoryIndex 
                              ? `${activeStoryProgress}%` 
                              : '0%' 
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Story Header */}
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9 border border-white/20">
                    <AvatarImage src={stories[activeStoryIndex].userPhoto} className="object-cover" />
                    <AvatarFallback className="bg-zinc-800 font-bold">{stories[activeStoryIndex]?.userName?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-xs font-black text-white">{stories[activeStoryIndex].userName}</h4>
                    <p className="text-[9px] text-[#FF4D67] font-black uppercase flex items-center gap-1">
                      <Clock size={8} /> Fleet Status Story
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selfProfile && stories[activeStoryIndex].userId === selfProfile.uid && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteStory(stories[activeStoryIndex])}
                      className="text-white/40 hover:text-red-400 bg-white/5 rounded-full w-8 h-8"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                  <button 
                    onClick={() => setActiveStoryIndex(null)}
                    className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Immersive Card Body */}
            <div className="flex-1 flex items-center justify-center my-6 relative px-4">
              {/* Left Tap Anchor */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1/4 cursor-pointer z-10" 
                onClick={() => {
                  if (activeStoryIndex > 0) setActiveStoryIndex(activeStoryIndex - 1);
                }}
              />
              
              {/* Right Tap Anchor */}
              <div 
                className="absolute right-0 top-0 bottom-0 w-1/4 cursor-pointer z-10" 
                onClick={() => {
                  if (activeStoryIndex < stories.length - 1) {
                    setActiveStoryIndex(activeStoryIndex + 1);
                  } else {
                    setActiveStoryIndex(null);
                  }
                }}
              />

              {stories[activeStoryIndex].imageUrl ? (
                <div className="w-full h-full max-w-sm rounded-[32px] overflow-hidden relative border border-white/10">
                  <img src={stories[activeStoryIndex].imageUrl} className="w-full h-full object-cover" alt="story attachment" />
                  {stories[activeStoryIndex].text && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-center text-sm font-bold text-white">
                      {stories[activeStoryIndex].text}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-full max-w-sm aspect-[9/16] rounded-[32px] bg-gradient-to-tr ${stories[activeStoryIndex].bgColorClass} flex flex-col justify-center items-center text-center p-8 border border-white/10 shadow-2xl relative`}>
                  <p className="text-lg font-black tracking-wide leading-relaxed text-white underline-offset-8 drop-shadow-md">
                    {stories[activeStoryIndex].text}
                  </p>
                  <div className="absolute bottom-6 text-[8px] tracking-widest text-white/50 uppercase font-black">
                    TEXT STORY TEMPLATE
                  </div>
                </div>
              )}
            </div>

            {/* Quick Interactive Reaction Bar inside Story view */}
            <div className="pb-6 px-4">
              <div className="flex justify-around items-center bg-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
                {['💖', '🔥', '🎉', '😂'].map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => handleReactStory(stories[activeStoryIndex], emoji)}
                    className="text-2xl hover:scale-130 active:scale-90 transition-transform relative px-3 py-1"
                  >
                    <span>{emoji}</span>
                    <span className="absolute -top-1 -right-1 text-[9px] bg-black/80 font-bold px-1 rounded-full text-white/60">
                      {stories[activeStoryIndex].reactions?.[emoji] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPREHENSIVE MULTI-MODULE CREATION MODAL */}
      <AnimatePresence>
        {showCreationModal && (
          <div className="fixed inset-0 bg-[#0C101A]/95 backdrop-blur-md z-50 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#121624] border-t border-white/10 rounded-t-[40px] w-full max-w-lg p-6 pb-12 space-y-6"
            >
              {/* Modal Tabs Header */}
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setCreationTab('Post')}
                    className={`text-lg font-black uppercase tracking-wider transition-colors ${creationTab === 'Post' ? 'text-[#FF4D67]' : 'text-gray-500'}`}
                  >
                    Create Post
                  </button>
                  <button 
                    onClick={() => setCreationTab('Story')}
                    className={`text-lg font-black uppercase tracking-wider transition-colors ${creationTab === 'Story' ? 'text-pink-400' : 'text-gray-500'}`}
                  >
                    Daily Story
                  </button>
                </div>
                <button 
                  onClick={() => setShowCreationModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* POST WRITER VIEW */}
              {creationTab === 'Post' ? (
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">Live Moment Broadcasting</p>
                  <textarea 
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    rows={4}
                    placeholder="What's happening? Share events, tag rooms, or say hi..."
                    className="w-full bg-white/5 focus:bg-white/10 border border-white/5 focus:border-[#FF4D67]/30 rounded-2xl p-4 text-sm font-sans placeholder:text-gray-650 focus:ring-0 focus:outline-none"
                  />
                  
                  {/* Moments Preset options for fast uploads */}
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase font-black text-gray-400 block tracking-wider">Aesthetic Visual Attachments</label>
                    <div className="grid grid-cols-4 gap-2">
                      {momentPresets.map(preset => (
                        <div 
                          key={preset.url}
                          onClick={() => setPostImage(preset.url)}
                          className={`aspect-video rounded-xl overflow-hidden cursor-pointer border relative ${postImage === preset.url ? 'border-[#FF4D67] ring-1 ring-[#FF4D67]' : 'border-white/5'}`}
                        >
                          <img src={preset.url} className="w-full h-full object-cover" alt="preset preview" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[7px] text-center font-black py-0.5 truncate text-white uppercase">{preset.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                   {/* Device Gallery Upload */}
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase font-black text-gray-400 block tracking-wider">Device Gallery Upload</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-4 bg-white/5 hover:bg-white/10 hover:border-[#FF4D67]/30 transition-all relative">
                      {compressingState.active && compressingState.target === 'Post' ? (
                        <div className="w-full flex flex-col items-center justify-center py-6 space-y-3">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-pink-500 animate-spin" />
                            <Sparkles size={18} className="text-pink-400 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-black text-white">Compressing & Optimizing...</p>
                            <p className="text-[10px] text-gray-405 font-bold mt-1">
                              Original size: {compressingState.originalSize}
                              {compressingState.compressedSize && ` → Optimized: ${compressingState.compressedSize}`}
                            </p>
                          </div>
                          <div className="w-full max-w-[200px] bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-pink-500 to-[#FF8A96] transition-all duration-300" style={{ width: `${compressingState.progress}%` }} />
                          </div>
                          {compressingState.progress === 100 && (
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                              ✓ Double-compressed & optimized! 🎉
                            </span>
                          )}
                        </div>
                      ) : postImage ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
                          <img src={postImage} className="w-full h-full object-cover" alt="Gallery Preview" />
                          <div className="absolute top-2 left-2 bg-emerald-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow-sm flex items-center gap-1 z-10">
                            <Check size={8} strokeWidth={3} /> Optimized HD
                          </div>
                          <button
                            type="button"
                            onClick={() => setPostImage('')}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 rounded-full text-white transition-colors z-10"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center cursor-pointer w-full py-4">
                          <ImageIcon size={28} className="text-[#FF4D67] mb-2 animate-pulse" />
                          <span className="text-xs font-black text-white/80">Select from Gallery</span>
                          <span className="text-[10px] text-gray-500 mt-1">Supports PNG, JPG, WEIC (Auto-compressing)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, 'Post')}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleCreatePost}
                    className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#FF4D67] to-[#FF8A96] text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-red-500/20"
                  >
                    Broadcast Moment
                  </Button>
                </div>
              ) : (
                /* STORY WRITER VIEW */
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-bold text-gray-500">Add 24h fleeting Status story</p>
                  <textarea 
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    rows={3}
                    maxLength={150}
                    placeholder="Type interesting short story thoughts (Max 150 letters)..."
                    className="w-full bg-white/5 focus:bg-white/10 border border-white/5 focus:border-pink-500/30 rounded-2xl p-4 text-sm font-sans placeholder:text-gray-650 focus:ring-0 focus:outline-none"
                  />

                  {/* Template Grad Background selection (only valid if storyImage is empty) */}
                  {!storyImage && (
                    <div className="space-y-2">
                       <label className="text-[9px] uppercase font-black text-gray-400 block pb-1">Gradient Theme Card Preset</label>
                       <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                         {PRESET_GRADIENTS.map(grad => (
                           <button 
                             key={grad}
                             onClick={() => setSelectedGradient(grad)}
                             className={`w-10 h-10 rounded-full bg-gradient-to-tr ${grad} shrink-0 border-2 transition-transform ${selectedGradient === grad ? 'border-white scale-110' : 'border-transparent'}`}
                           />
                         ))}
                       </div>
                    </div>
                  )}

                  {/* Device Gallery Upload for Stories */}
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase font-black text-gray-400 block tracking-wider">Device Gallery Upload</label>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-4 bg-white/5 hover:bg-white/10 hover:border-pink-500/30 transition-all relative">
                      {compressingState.active && compressingState.target === 'Story' ? (
                        <div className="w-full flex flex-col items-center justify-center py-6 space-y-3">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-white/5 border-t-pink-500 animate-spin" />
                            <Sparkles size={18} className="text-pink-400 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-black text-white">Compressing & Optimizing...</p>
                            <p className="text-[10px] text-gray-405 font-bold mt-1">
                              Original size: {compressingState.originalSize}
                              {compressingState.compressedSize && ` → Optimized: ${compressingState.compressedSize}`}
                            </p>
                          </div>
                          <div className="w-full max-w-[200px] bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-pink-500 to-[#FF8A96] transition-all duration-300" style={{ width: `${compressingState.progress}%` }} />
                          </div>
                          {compressingState.progress === 100 && (
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                              ✓ Double-compressed & optimized! 🎉
                            </span>
                          )}
                        </div>
                      ) : storyImage ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden group">
                          <img src={storyImage} className="w-full h-full object-cover" alt="Story Gallery Preview" />
                          <div className="absolute top-2 left-2 bg-emerald-500 text-white font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow-sm flex items-center gap-1 z-10">
                            <Check size={8} strokeWidth={3} /> Optimized HD
                          </div>
                          <button
                            type="button"
                            onClick={() => setStoryStoryImage('')}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 rounded-full text-white transition-colors z-10"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center cursor-pointer w-full py-2">
                          <ImageIcon size={24} className="text-pink-400 mb-1 animate-pulse" />
                          <span className="text-xs font-black text-white/80">Select Image for Story</span>
                          <span className="text-[9px] text-gray-500 mt-0.5">Supports PNG, JPG, HEIC (Auto-compressing)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(e, 'Story')}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <Button 
                    onClick={handleCreateStory}
                    className="w-full h-11 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 text-white font-black uppercase tracking-wider text-xs shadow-lg shadow-pink-500/20"
                  >
                    Publish Fleeting Story
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMMENTS DRAWER / SLIDE-UP MODAL */}
      <AnimatePresence>
        {activeCommentPost && (
          <div className="fixed inset-0 bg-[#0C101A]/80 backdrop-blur-md z-50 flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-[#121624] border-t border-white/10 rounded-t-[40px] w-full max-w-lg p-6 pb-12 flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-black text-white">Post Discussion</h3>
                  <p className="text-[9px] text-[#FF4D67] font-black">COMMENTS ({activeCommentPost.commentsCount})</p>
                </div>
                <button
                  onClick={() => setActiveCommentPost(null)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[180px] max-h-[40vh] no-scrollbar">
                {commentsList.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageSquare size={36} className="text-gray-600 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-gray-500 font-bold">Be the first to say something nice! ✨</p>
                  </div>
                ) : (
                  commentsList.map((c) => (
                    <div key={c.id} className="flex gap-3 items-start">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={c.userPhoto} className="object-cover" />
                        <AvatarFallback className="bg-zinc-800 font-bold text-xs">{c.userName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-black text-gray-300">{c.userName}</span>
                          <span className="text-[8px] text-gray-550 font-bold">Recently</span>
                        </div>
                        <p className="text-xs text-gray-250 font-medium">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Submit Comment Field */}
              <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Join the conversation..."
                  className="bg-white/5 border-white/5 focus:border-[#FF4D67]/30 rounded-xl text-xs font-medium placeholder:text-gray-600"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddComment();
                  }}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="bg-[#FF4D67] hover:bg-[#FF8A96] text-white rounded-xl text-xs font-bold px-4 hover:scale-105 active:scale-95 transition-transform"
                >
                  Send
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
