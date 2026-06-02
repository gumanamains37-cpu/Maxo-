import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  doc, setDoc, deleteDoc, onSnapshot, collection, getDocs, updateDoc, writeBatch
} from 'firebase/firestore';

interface WebRTCHookProps {
  roomId: string;
  currentUserId: string | undefined;
  seats: any[];
  isLocalMuted: boolean;
}

/**
 * Adjusts Session Description Protocol (SDP) configurations to force maximum
 * Opus audio clarity, low-latency, inband FEC, stereo, and low-bandwidth resilience.
 */
function optimizeSdpAudio(sdp: string): string {
  let lines = sdp.split('\r\n');
  lines = lines.map(line => {
    if (line.startsWith('a=fmtp:') && (line.includes('111') || line.includes('opus'))) {
      // Low-latency crisp mono voice: useinbandfec=1 to correct package loss, stereo=0, and voice-optimized bitrate to reduce CPU load.
      return line + ';useinbandfec=1;stereo=0;maxaveragebitrate=32000;sprop-maxcapturerate=48000';
    }
    return line;
  });
  return lines.join('\r\n');
}

export function useWebRTC({ roomId, currentUserId, seats, isLocalMuted }: WebRTCHookProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [activeSpeakerStreams, setActiveSpeakerStreams] = useState<Record<string, MediaStream>>({});
  
  // Refs to avoid state re-triggering loop
  const pConnections = useRef<Record<string, RTCPeerConnection>>({}); // publisher connection (sending to subscriber target)
  const sConnections = useRef<Record<string, RTCPeerConnection>>({}); // subscriber connection (receiving from publisher target)
  const pUnsubs = useRef<Record<string, () => void>>({});
  const sUnsubs = useRef<Record<string, () => void>>({});
  const audioElements = useRef<Record<string, HTMLAudioElement>>({});
  
  const localStreamRef = useRef<MediaStream | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef<Record<string, {
    source: MediaStreamAudioSourceNode;
    compressor: DynamicsCompressorNode;
    gainNode: GainNode;
  }>>({});

  // Configuration for WebRTC ICE servers
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Determine if local user is currently on any seat
  const isLocalSpeaker = seats && currentUserId ? seats.some(seat => seat.uid === currentUserId) : false;

  // 1. Manage capture of Local Microphone Stream
  useEffect(() => {
    if (!currentUserId) return;

    const requestUserMedia = async () => {
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: { ideal: true },
              noiseSuppression: { ideal: true },
              autoGainControl: { ideal: true },
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48000 },
              sampleSize: { ideal: 16 }
            }
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
        }
        
        // Apply local mute state to mic tracks
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !isLocalMuted;
          });
        }
      } catch (err) {
        console.warn('Microphone permission blocked or failed:', err);
      }
    };

    const stopUserMedia = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
    };

    if (isLocalSpeaker) {
      requestUserMedia();
    } else {
      stopUserMedia();
    }

    return () => {
      // Don't stop immediately on minor changes, let cleanup effect handle main tear downs
    };
  }, [isLocalSpeaker, isLocalMuted, currentUserId]);

  // Handle local track enabling when localStream changes
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isLocalMuted;
      });
    }
  }, [localStream, isLocalMuted]);

  // 2. React to Seat and Participant changes for Publishing & Subscribing
  useEffect(() => {
    if (!currentUserId || !roomId) return;

    // Get all speakers in the room (excluding self)
    const otherSpeakers = seats
      ? seats.filter(seat => seat.uid && seat.uid !== currentUserId).map(seat => seat.uid as string)
      : [];

    // --- SUB VIEW: CONNECT TO OTHER ACTIVE SPEAKERS (RECEIVE AUDIO) ---
    // Identify who we need to connect to, and who we need to disconnect from
    const currentSubscribers = Object.keys(sConnections.current);
    
    // Close connections to users who are no longer on seats
    currentSubscribers.forEach(speakerId => {
      if (!otherSpeakers.includes(speakerId)) {
        closeSubscriberConnection(speakerId);
      }
    });

    // Establish subscription connections to new speakers
    otherSpeakers.forEach(speakerId => {
      if (!sConnections.current[speakerId]) {
        connectToSpeaker(speakerId);
      }
    });

    // --- PUB VIEW: LISTEN FOR SUBSCRIBERS WHO WANT TO HEAR US ---
    let unsubPubList: () => void = () => {};
    if (isLocalSpeaker) {
      const pubPath = `rooms/${roomId}/streams/${currentUserId}/subscribers`;
      unsubPubList = onSnapshot(collection(db, pubPath), (snapshot) => {
        // Track current peer connections we have running
        snapshot.docChanges().forEach(change => {
          const subscriberId = change.doc.id;
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (data.offer && !pConnections.current[subscriberId]) {
              handleSubscriberOffer(subscriberId, data.offer);
            }
          } else if (change.type === 'removed') {
            closePublisherConnection(subscriberId);
          }
        });
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, pubPath);
      });
    } else {
      // If we are no longer a speaker, clean up all publisher RTCPeerConnections
      Object.keys(pConnections.current).forEach(subId => {
        closePublisherConnection(subId);
      });
      // Delete our publisher node from firestore
      const streamRef = doc(db, `rooms/${roomId}/streams`, currentUserId);
      deleteDoc(streamRef).catch(() => {});
    }

    return () => {
      unsubPubList();
    };
  }, [JSON.stringify(seats.map(s => `${s.uid}_${s.isMuted}`)), isLocalSpeaker, currentUserId, roomId]);

  // Cleanup all connections on component unmount
  useEffect(() => {
    return () => {
      // Clean up subscribers
      Object.keys(sConnections.current).forEach(id => closeSubscriberConnection(id));
      // Clean up publishers
      Object.keys(pConnections.current).forEach(id => closePublisherConnection(id));
      // Stop local audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []);

  // --- BUSINESS LOGIC HELPERS: SUBSCRIBER (RECEIVER) PORTION ---
  async function connectToSpeaker(speakerId: string) {
    if (!currentUserId || !roomId) return;
    try {
      const pc = new RTCPeerConnection(rtcConfig);
      sConnections.current[speakerId] = pc;

      // Add transceiver to receive audio only
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Handle receiving tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          
          // Store stream in local list to show visual volume bars or wave animations
          setActiveSpeakerStreams(prev => ({
            ...prev,
            [speakerId]: remoteStream
          }));

          // 1. Keep standard HTML Audio element muted, but playing to trigger stream consumption reliably in all web engines
          if (!audioElements.current[speakerId]) {
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.muted = true; // Muted to prevent raw double-playback, only outputting processed audio from AudioContext
            audio.autoplay = true;
            // Prevent browsers from blocking sound playback
            audio.play().catch(pErr => {
              console.log("Audio autoplay deferred for interaction:", pErr);
              // Trigger play on next document click/interaction to ensure autoplay keeps flowing
              const playOnTap = () => {
                audio.play().catch(() => {});
                document.removeEventListener('click', playOnTap);
              };
              document.addEventListener('click', playOnTap);
            });
            audioElements.current[speakerId] = audio;
          } else {
            audioElements.current[speakerId].srcObject = remoteStream;
          }

          // 2. Setup processed Web Audio API node graph for Compressor, AGC & Normalization
          try {
            if (!audioCtxRef.current) {
              audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }

            // Cleanup existing nodes for this speaker if any
            if (audioNodesRef.current[speakerId]) {
              try {
                audioNodesRef.current[speakerId].source.disconnect();
                audioNodesRef.current[speakerId].compressor.disconnect();
                audioNodesRef.current[speakerId].gainNode.disconnect();
              } catch (err) {}
            }

            const source = ctx.createMediaStreamSource(remoteStream);
            const compressor = ctx.createDynamicsCompressor();
            const gainNode = ctx.createGain();

            // Set compressor values for strict vocal matching and spike protection
            // Threshold = -24dB compresses high volumes. Knee = 30 for smooth curve.
            // Ratio = 4 (standard vocal normalization compression). Attack = 0.003s (instant level limit).
            // Release = 0.25 (keeps natural vocal decay).
            compressor.threshold.setValueAtTime(-24, ctx.currentTime);
            compressor.knee.setValueAtTime(30, ctx.currentTime);
            compressor.ratio.setValueAtTime(4, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.25, ctx.currentTime);

            // Set vocal makeup gain adjustment to amplify quiet callers
            gainNode.gain.setValueAtTime(1.4, ctx.currentTime);

            // Connect the Web Audio chain
            source.connect(compressor);
            compressor.connect(gainNode);
            gainNode.connect(ctx.destination);

            audioNodesRef.current[speakerId] = { source, compressor, gainNode };
          } catch (audioErr) {
            console.error('Failed to initialize local Web Audio node graph, falling back to raw audio element playback:', audioErr);
            // Fallback: If AudioContext fails or is blocked on this device, unmute standard element
            if (audioElements.current[speakerId]) {
              audioElements.current[speakerId].muted = false;
            }
          }
        }
      };

      // Handle local ICE candidates and post to Firestore
      const iceCandidatesList: any[] = [];
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidatesList.push(event.candidate.toJSON());
          const subDocRef = doc(db, `rooms/${roomId}/streams/${speakerId}/subscribers`, currentUserId);
          setDoc(subDocRef, { candidatesS: iceCandidatesList }, { merge: true }).catch(() => {});
        }
      };

      // Create local Description Offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      const optimizedSdp = optimizeSdpAudio(offer.sdp || '');
      await pc.setLocalDescription(new RTCSessionDescription({
        type: offer.type,
        sdp: optimizedSdp
      }));

      const subDocRef = doc(db, `rooms/${roomId}/streams/${speakerId}/subscribers`, currentUserId);
      await setDoc(subDocRef, {
        offer: {
          sdp: optimizedSdp,
          type: offer.type
        },
        id: currentUserId,
        joinedAt: new Date().toISOString()
      }, { merge: true });

      // Clean up previous listeners if any
      if (sUnsubs.current[speakerId]) sUnsubs.current[speakerId]();

      let appliedAnswer = false;
      const candidateBuffer: any[] = [];

      // Listen for the publisher's answer
      sUnsubs.current[speakerId] = onSnapshot(subDocRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data && data.answer && !appliedAnswer && pc.signalingState !== 'stable') {
          appliedAnswer = true;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            while (candidateBuffer.length > 0) {
              const cand = candidateBuffer.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          } catch (descError) {
            console.error("Set remote offer error:", descError);
            appliedAnswer = false;
          }
        }
        // Listen for candidates from publisher
        if (data && data.candidatesP && Array.isArray(data.candidatesP)) {
          data.candidatesP.forEach((candidate: any) => {
            if (appliedAnswer && pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            } else {
              candidateBuffer.push(candidate);
            }
          });
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/streams/${speakerId}/subscribers/${currentUserId}`);
      });

    } catch (err) {
      console.error(`WebRTC Connection to speaker ${speakerId} failed:`, err);
    }
  }

  function closeSubscriberConnection(speakerId: string) {
    if (sUnsubs.current[speakerId]) {
      sUnsubs.current[speakerId]();
      delete sUnsubs.current[speakerId];
    }
    const pc = sConnections.current[speakerId];
    if (pc) {
      pc.close();
      delete sConnections.current[speakerId];
    }
    const audio = audioElements.current[speakerId];
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      delete audioElements.current[speakerId];
    }

    // Clean up Web Audio node graph for this subscriber
    const nodes = audioNodesRef.current[speakerId];
    if (nodes) {
      try {
        nodes.source.disconnect();
        nodes.compressor.disconnect();
        nodes.gainNode.disconnect();
      } catch (err) {}
      delete audioNodesRef.current[speakerId];
    }

    setActiveSpeakerStreams(prev => {
      const copy = { ...prev };
      delete copy[speakerId];
      return copy;
    });

    // Delete my subscriber node from their stream in db
    if (currentUserId && roomId) {
      const subDocRef = doc(db, `rooms/${roomId}/streams/${speakerId}/subscribers`, currentUserId);
      deleteDoc(subDocRef).catch(() => {});
    }
  }

  // --- BUSINESS LOGIC HELPERS: PUBLISHER (SENDER) PORTION ---
  async function handleSubscriberOffer(subscriberId: string, offer: any) {
    if (!currentUserId || !roomId) return;
    try {
      // If we already have a connection for this sub, close it first to re-establish clean state
      if (pConnections.current[subscriberId]) {
        pConnections.current[subscriberId].close();
      }

      const pc = new RTCPeerConnection(rtcConfig);
      pConnections.current[subscriberId] = pc;

      // Add our local microphone stream tracks if they are active
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Sync ICE candidates
      const iceCandidatesList: any[] = [];
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidatesList.push(event.candidate.toJSON());
          const subDocRef = doc(db, `rooms/${roomId}/streams/${currentUserId}/subscribers`, subscriberId);
          setDoc(subDocRef, { candidatesP: iceCandidatesList }, { merge: true }).catch(() => {});
        }
      };

      let remoteDescSet = false;
      const candidateBuffer: any[] = [];

      // Set subscriber's Offer as Remote Description
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSet = true;
      while (candidateBuffer.length > 0) {
        const cand = candidateBuffer.shift();
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }

      // Create Answer and set Local Description
      const answer = await pc.createAnswer();
      const optimizedAnswerSdp = optimizeSdpAudio(answer.sdp || '');
      await pc.setLocalDescription(new RTCSessionDescription({
        type: answer.type,
        sdp: optimizedAnswerSdp
      }));

      // Save answer back to Firestore
      const subDocRef = doc(db, `rooms/${roomId}/streams/${currentUserId}/subscribers`, subscriberId);
      await setDoc(subDocRef, {
        answer: {
          sdp: optimizedAnswerSdp,
          type: answer.type
        }
      }, { merge: true });

      // Listen to Subscriber's ICE candidates
      if (pUnsubs.current[subscriberId]) pUnsubs.current[subscriberId]();
      pUnsubs.current[subscriberId] = onSnapshot(subDocRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data && data.candidatesS && Array.isArray(data.candidatesS)) {
          data.candidatesS.forEach((candObj: any) => {
            if (remoteDescSet && pc.remoteDescription) {
              pc.addIceCandidate(new RTCIceCandidate(candObj)).catch(() => {});
            } else {
              candidateBuffer.push(candObj);
            }
          });
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomId}/streams/${currentUserId}/subscribers/${subscriberId}`);
      });

    } catch (err) {
      console.error(`Failed to handle subscriber offer from ${subscriberId}:`, err);
    }
  }

  function closePublisherConnection(subscriberId: string) {
    if (pUnsubs.current[subscriberId]) {
      pUnsubs.current[subscriberId]();
      delete pUnsubs.current[subscriberId];
    }
    const pc = pConnections.current[subscriberId];
    if (pc) {
      pc.close();
      delete pConnections.current[subscriberId];
    }
  }

  return {
    localStream,
    activeSpeakerStreams
  };
}
