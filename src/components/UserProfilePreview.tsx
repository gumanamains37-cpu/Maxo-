import React, { useEffect, useState } from 'react';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/types';
import { 
  X, UserPlus, UserMinus, MessageSquare, Coins, Sparkles, Star, ShieldAlert, Ban, ShieldCheck 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface UserProfilePreviewProps {
  userId: string;
  onClose: () => void;
  canManage: boolean;
  onKick?: () => void;
  onMuteToggle?: () => void;
  isMutedOnSeat?: boolean;
  onPromoteSuperAdmin?: () => void;
  isSuperAdmin?: boolean;
  onPromoteAdmin?: () => void;
  isAdmin?: boolean;
  onDirectGift?: () => void;
  isChatBanned?: boolean;
  onChatBanToggle?: () => void;
  isRoomBanned?: boolean;
  onRoomBannedToggle?: () => void;
  viewerIsOwner?: boolean;
  viewerIsSuperAdmin?: boolean;
  viewerIsAdmin?: boolean;
  roomHostId?: string;
}

export const UserProfilePreview: React.FC<UserProfilePreviewProps> = ({
  userId,
  onClose,
  canManage,
  onKick,
  onMuteToggle,
  isMutedOnSeat,
  onPromoteSuperAdmin,
  isSuperAdmin,
  onPromoteAdmin,
  isAdmin,
  onDirectGift,
  isChatBanned,
  onChatBanToggle,
  isRoomBanned,
  onRoomBannedToggle,
  viewerIsOwner = false,
  viewerIsSuperAdmin = false,
  viewerIsAdmin = false,
  roomHostId
}) => {
  const targetIsOwner = userId === roomHostId;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [selfCoins, setSelfCoins] = useState(100);
  const navigate = useNavigate();

  const { user } = useAuth();
  const currentUserId = auth.currentUser?.uid || user?.uid;

  useEffect(() => {
    if (!userId) return;

    const loadProfileData = async () => {
      try {
        setLoading(true);
        // Get user profile
        const pSnap = await getDoc(doc(db, 'users', userId));
        if (pSnap.exists()) {
          setProfile(pSnap.data() as UserProfile);
        }

        // Get follower status
        if (currentUserId && currentUserId !== userId) {
          const followDocId1 = `${currentUserId}_${userId}`;
          const followDocId2 = `${userId}_${currentUserId}`;
          
          const [snap1, snap2] = await Promise.all([
            getDoc(doc(db, 'follows', followDocId1)),
            getDoc(doc(db, 'follows', followDocId2))
          ]);
          
          setIsFollowing(snap1.exists());
          setIsMutualFollow(snap1.exists() && snap2.exists());
        }

        // Get current user's profile to read coins balance
        if (currentUserId) {
          const selfSnap = await getDoc(doc(db, 'users', currentUserId));
          if (selfSnap.exists()) {
            setSelfCoins(selfSnap.data().coins || 0);
          }
        }
      } catch (err) {
        console.error('Error loading profile preview data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [userId, currentUserId]);

  const handleFollow = async () => {
    if (!currentUserId || !profile || currentUserId === userId) return;
    const followDocId = `${currentUserId}_${userId}`;
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followDocId));
        setIsFollowing(false);
        setIsMutualFollow(false);
        toast.info(`Unfollowed ${profile.displayName}`);
        
        // Decrement counts
        await updateDoc(doc(db, 'users', userId), {
          followersCount: Math.max(0, (profile.followersCount || 0) - 1)
        });
      } else {
        await setDoc(doc(db, 'follows', followDocId), {
          followerId: currentUserId,
          targetId: userId,
          timestamp: new Date().toISOString()
        });
        setIsFollowing(true);
        
        // Check mutual
        const reverseSnap = await getDoc(doc(db, 'follows', `${userId}_${currentUserId}`));
        if (reverseSnap.exists()) {
          setIsMutualFollow(true);
        }
        
        toast.success(`Followed ${profile.displayName}! 💖`);
        
        // Increment count
        await updateDoc(doc(db, 'users', userId), {
          followersCount: (profile.followersCount || 0) + 1
        });
      }
    } catch (err) {
      toast.error('Follow action failed');
    }
  };

  const handleBlockUser = () => {
    toast.info(`User ${profile?.displayName || 'User'} is reported and blocked! 🛡️`);
    onClose();
  };

  const handleOpenConversation = () => {
    if (currentUserId === userId) return;
    if (!isMutualFollow) {
      toast.error('You can only message if you follow each other mutually!');
      return;
    }
    navigate(`/messages/${userId}`);
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-[#161922] border border-white/10 rounded-3xl p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mb-2"></div>
          <span className="text-xs text-white/60">Loading profile card...</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div 
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm bg-gradient-to-b from-[#1E2330] to-[#12141C] border border-white/10 rounded-[36px] overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Luxury Glowing Aura */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-yellow-500/10 to-transparent pointer-events-none" />

        {/* Top Banner Control */}
        <div className="absolute top-4 right-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-full bg-black/30 hover:bg-black/60 border border-white/10 text-white h-8 w-8"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Card Header Content */}
        <div className="p-6 pt-8 flex flex-col items-center text-center relative">
          <div className="relative mb-3 group">
            {profile.isVIP && (
              <div className="absolute -top-3 -right-3 z-10 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full p-1 border border-white/20 shadow-md">
                <Star size={12} className="text-black fill-black" />
              </div>
            )}
            {/* Elegant double-ring speak highlights */}
            <div className={`absolute -inset-2.5 rounded-full border-2 border-dashed ${profile.isVIP ? 'border-yellow-400/50 animate-spin [animation-duration:15s]' : 'border-purple-500/30'}`} />
            <Avatar className="w-20 h-20 border-4 border-[#1E2330] p-0.5 bg-gradient-to-br from-[#12141C] to-purple-600">
              <AvatarImage src={profile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.uid}`} />
              <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
            </Avatar>
          </div>

          <h3 className="font-extrabold text-lg text-white flex items-center gap-1.5 justify-center">
            {profile.displayName}
            {profile.isVIP && (
              <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-black text-[8px] font-black tracking-tight uppercase px-1 py-0 h-3.5">
                VIP
              </Badge>
            )}
            <Badge className="bg-[#26D97E] text-white text-[8px] h-3.5 px-1 font-bold">
              Lv.{profile.level}
            </Badge>
          </h3>
          <p className="text-[10px] text-white/40 font-mono mt-0.5">UID: {profile.uid.slice(0, 8).toUpperCase()}</p>

          {profile.bio ? (
            <p className="text-xs text-white/75 mt-3 max-w-[220px] italic leading-snug">
              "{profile.bio}"
            </p>
          ) : (
            <p className="text-xs text-white/40 mt-3 max-w-[220px] italic">
              "No bio written yet..."
            </p>
          )}

          {/* Social Stats Row */}
          <div className="grid grid-cols-3 gap-6 bg-white/5 border border-white/5 rounded-2xl w-full p-3.5 mt-5">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-white">{profile.followersCount || 0}</span>
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Followers</span>
            </div>
            <div className="flex flex-col items-center border-x border-white/5">
              <span className="text-sm font-black text-white">{profile.followingCount || 0}</span>
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Following</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-white">{profile.diamonds || 0}</span>
              <span className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Gifts Value</span>
            </div>
          </div>

          {/* Interactions Control Grid */}
          <div className="grid grid-cols-2 gap-3 w-full mt-5">
            {currentUserId !== userId && (
              <Button 
                onClick={handleFollow}
                className={`h-11 rounded-2xl font-bold text-xs gap-1.5 transition-all ${
                  isFollowing 
                    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' 
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg shadow-pink-500/20'
                }`}
              >
                {isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />}
                {isFollowing ? 'Unfollow' : 'Follow'}
              </Button>
            )}
            
            {currentUserId !== userId && (
              <Button 
                disabled={!isMutualFollow}
                onClick={handleOpenConversation}
                className={`h-11 rounded-2xl font-bold text-xs gap-1.5 text-white ${
                  isMutualFollow
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20'
                    : 'bg-white/5 border border-white/5 cursor-not-allowed text-white/40'
                }`}
              >
                <MessageSquare size={14} />
                DM Chat
              </Button>
            )}

            {currentUserId === userId && (
              <div className="col-span-2 py-1 text-center font-bold text-xs text-yellow-400 flex items-center justify-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                <Coins size={12} className="fill-yellow-400" /> This is your personal card!
              </div>
            )}
          </div>

          {/* Luxury Gifts Trigger */}
          {currentUserId !== userId && onDirectGift && (
            <Button 
              onClick={onDirectGift}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-500 to-red-500 hover:from-yellow-500 hover:to-red-600 text-black font-extrabold text-xs gap-1.5 mt-3 shadow-md shadow-amber-500/10"
            >
              <Coins size={14} className="fill-black text-black" />
              Quick Gift Send
            </Button>
          )}

          {/* Moderation section */}
          {currentUserId !== userId && !targetIsOwner && (viewerIsOwner || viewerIsSuperAdmin || viewerIsAdmin) && (
            <div className="w-full mt-5 pt-4 border-t border-white/5 space-y-2.5">
              <p className="text-[9px] uppercase tracking-widest text-[#FF4D67] font-extrabold text-left ml-1">Channel Moderation Control</p>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Seat management action (Mute microphone) */}
                {onMuteToggle && (() => {
                  const targetIsOwner = userId === roomHostId;
                  const targetIsSuperAdmin = !!isSuperAdmin;
                  const targetIsAdmin = !!isAdmin;
                  
                  const canMute = viewerIsOwner || 
                                  (viewerIsSuperAdmin && !targetIsSuperAdmin && !targetIsOwner) ||
                                  (viewerIsAdmin && !targetIsAdmin && !targetIsSuperAdmin && !targetIsOwner);
                  if (!canMute) return null;
                  return (
                    <Button 
                      variant="outline" 
                      className="h-9 rounded-xl border-white/10 bg-white/5 text-[10px] text-white hover:bg-white/10 gap-1.5 font-bold"
                      onClick={onMuteToggle}
                    >
                      <Star size={12} className="text-yellow-400" />
                      {isMutedOnSeat ? 'Unmute Mic' : 'Mute Mic'}
                    </Button>
                  );
                })()}

                {/* Seat kick action */}
                {onKick && (() => {
                  const targetIsOwner = userId === roomHostId;
                  const targetIsSuperAdmin = !!isSuperAdmin;
                  const targetIsAdmin = !!isAdmin;
                  
                  const canKickSeat = viewerIsOwner || 
                                      (viewerIsSuperAdmin && !targetIsSuperAdmin && !targetIsOwner) ||
                                      (viewerIsAdmin && !targetIsAdmin && !targetIsSuperAdmin && !targetIsOwner);
                  if (!canKickSeat) return null;
                  return (
                    <Button 
                      variant="outline" 
                      className="h-9 rounded-xl border-white/10 bg-white/5 text-[10px] text-red-400 hover:bg-white/10 gap-1.5 font-bold"
                      onClick={onKick}
                    >
                      <Ban size={12} />
                      Kick from Seat
                    </Button>
                  );
                })()}

                {/* Chat ban action */}
                {onChatBanToggle && (() => {
                  const targetIsOwner = userId === roomHostId;
                  const targetIsSuperAdmin = !!isSuperAdmin;
                  const targetIsAdmin = !!isAdmin;
                  
                  const canChatBan = viewerIsOwner || 
                                     (viewerIsSuperAdmin && !targetIsSuperAdmin && !targetIsOwner) ||
                                     (viewerIsAdmin && !targetIsAdmin && !targetIsSuperAdmin && !targetIsOwner);
                  if (!canChatBan) return null;
                  return (
                    <Button 
                      variant="outline" 
                      className={`h-9 rounded-xl border-white/10 bg-white/5 text-[10px] hover:bg-white/10 gap-1.5 font-bold ${isChatBanned ? 'text-green-400' : 'text-yellow-500'}`}
                      onClick={onChatBanToggle}
                    >
                      <Ban size={12} />
                      {isChatBanned ? 'Lift Chat Ban' : 'Chat Ban'}
                    </Button>
                  );
                })()}

                {/* Room kick/ban action */}
                {onRoomBannedToggle && (() => {
                  const targetIsOwner = userId === roomHostId;
                  const targetIsSuperAdmin = !!isSuperAdmin;
                  const targetIsAdmin = !!isAdmin;
                  
                  const canRoomBan = viewerIsOwner || 
                                     (viewerIsSuperAdmin && !targetIsSuperAdmin && !targetIsOwner) ||
                                     (viewerIsAdmin && !targetIsAdmin && !targetIsSuperAdmin && !targetIsOwner);
                  if (!canRoomBan) return null;
                  return (
                    <Button 
                      variant="outline" 
                      className={`h-9 rounded-xl border-white/10 bg-white/5 text-[10px] hover:bg-white/10 gap-1.5 font-bold ${isRoomBanned ? 'text-green-400' : 'text-red-400'}`}
                      onClick={onRoomBannedToggle}
                    >
                      <ShieldAlert size={12} />
                      {isRoomBanned ? 'Lift Room Ban' : 'Kick/Ban Room'}
                    </Button>
                  );
                })()}

                {/* Super Admin promotion control (Owner only) */}
                {viewerIsOwner && onPromoteSuperAdmin && (
                  <Button 
                    variant="outline" 
                    className={`h-9 rounded-xl border-white/10 bg-white/5 text-[10px] gap-1.5 font-bold col-span-2 ${isSuperAdmin ? 'text-blue-400' : 'text-emerald-400'}`}
                    onClick={onPromoteSuperAdmin}
                  >
                    {isSuperAdmin ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {isSuperAdmin ? 'Demote Super Admin' : 'Promote Super Admin'}
                  </Button>
                )}

                {/* Admin promotion control (Owner and Super Admin only) */}
                {(viewerIsOwner || viewerIsSuperAdmin) && onPromoteAdmin && !isSuperAdmin && (
                  <Button 
                    variant="outline" 
                    className={`h-9 rounded-xl border-white/10 bg-white/5 text-[10px] gap-1.5 font-bold col-span-2 ${isAdmin ? 'text-purple-400' : 'text-amber-400'}`}
                    onClick={onPromoteAdmin}
                  >
                    {isAdmin ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {isAdmin ? 'Demote Admin' : 'Promote Admin'}
                  </Button>
                )}
              </div>

              <button 
                onClick={handleBlockUser} 
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-red-500/10 rounded-xl hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/20 mt-2 transition-colors"
              >
                <span>Report & Block User Account</span>
                <ShieldAlert size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
