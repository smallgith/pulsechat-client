/* ============================================================
   WebRTC — Production-grade with TURN + track handling
   ============================================================ */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export class CallSession {
  constructor({ socket, callId, peerId, type, onIce, onRemoteStream, onEnded }) {
    this.socket = socket;
    this.callId = callId;
    this.peerId = peerId;
    this.type = type;
    this.onIce = onIce;
    this.onRemoteStream = onRemoteStream;
    this.onEnded = onEnded;

    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceQueue = [];
    this.trackIds = new Set();
  }

  async startLocal() {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
      video:
        this.type === 'video'
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user',
            }
          : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err) {
      if (this.type === 'video') {
        // fallback
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        return this.localStream;
      }
      throw err;
    }
  }

  createPeer() {
    this.pc = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();
    this.trackIds = new Set();

    // add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        this.pc.addTrack(t, this.localStream);
      });
    }

    // ---------- on remote track ----------
    this.pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack:', event.track.kind, event.track.id);

      // Add track to remote stream if not already
      if (!this.trackIds.has(event.track.id)) {
        this.trackIds.add(event.track.id);
        this.remoteStream.addTrack(event.track);
      }

      // Force unmute (iOS Safari bug)
      event.track.enabled = true;

      // Notify with NEW reference (forces React re-render)
      const freshStream = new MediaStream(this.remoteStream.getTracks());
      this.onRemoteStream?.(freshStream);

      // Listen for mute/unmute
      event.track.onunmute = () => {
        console.log('[WebRTC] track unmuted:', event.track.kind);
        const s = new MediaStream(this.remoteStream.getTracks());
        this.onRemoteStream?.(s);
      };
    };

    // ---------- ICE candidates ----------
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const c = event.candidate.toJSON
          ? event.candidate.toJSON()
          : event.candidate;
        this.onIce?.(c);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      console.log('[WebRTC] ICE:', s);
      if (s === 'failed') {
        this.pc.restartIce?.();
      }
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      console.log('[WebRTC] Conn:', s);
      if (s === 'failed' || s === 'closed') {
        this.onEnded?.();
      }
    };

    return this.pc;
  }

  async createOffer() {
    this.createPeer();
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.type === 'video',
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async acceptOffer(offer) {
    this.createPeer();
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this._flushIce();
    return answer;
  }

  async acceptAnswer(answer) {
    if (!this.pc) return;
    if (this.pc.signalingState === 'stable') return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this._flushIce();
  }

  async addIce(candidate) {
    if (!candidate) return;
    if (!this.pc || !this.pc.remoteDescription) {
      this.iceQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] ICE add failed:', e);
    }
  }

  _flushIce() {
    while (this.iceQueue.length) {
      const c = this.iceQueue.shift();
      this.pc
        .addIceCandidate(new RTCIceCandidate(c))
        .catch((e) => console.warn('flush ICE err:', e));
    }
  }

  toggleMic(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleCam(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  destroy() {
    try {
      this.localStream?.getTracks().forEach((t) => t.stop());
      this.remoteStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceQueue = [];
    this.trackIds = new Set();
  }
}