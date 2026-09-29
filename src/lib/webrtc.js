/* ============================================================
   WebRTC — Production-grade with TURN fallback
   ============================================================ */

const ICE_SERVERS = {
  iceServers: [
    // Google STUN (free, reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },

    // OpenRelay free TURN (works behind NAT/carrier)
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
    this.type = type; // 'audio' | 'video'
    this.onIce = onIce;
    this.onRemoteStream = onRemoteStream;
    this.onEnded = onEnded;

    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceQueue = [];
    this.connected = false;
  }

  /* ---------- get user media ---------- */
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
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user',
            }
          : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // fallback: try without video constraints
      if (this.type === 'video') {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } else {
        throw err;
      }
    }
    return this.localStream;
  }

  /* ---------- create peer connection ---------- */
  createPeer() {
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    // add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // remote stream container
    this.remoteStream = new MediaStream();

    // on track — attach to remote stream
    this.pc.ontrack = (e) => {
      console.log('[WebRTC] track received:', e.track.kind);

      // add track to remote stream
      const existing = this.remoteStream.getTracks().find(
        (t) => t.id === e.track.id
      );
      if (!existing) {
        this.remoteStream.addTrack(e.track);
      }

      // force notify
      this.onRemoteStream?.(this.remoteStream);

      // listen to unmute (mobile Safari issue)
      e.track.onunmute = () => {
        console.log('[WebRTC] track unmuted:', e.track.kind);
        this.onRemoteStream?.(this.remoteStream);
      };
    };

    // ICE candidates
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.onIce?.(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
      }
    };

    // ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState;
      console.log('[WebRTC] ICE:', s);
      if (s === 'failed') {
        // try restart ICE
        this.pc.restartIce?.();
      }
    };

    // connection state
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      console.log('[WebRTC] Connection:', s);

      if (s === 'connected') {
        this.connected = true;
      } else if (s === 'failed' || s === 'closed') {
        this.onEnded?.();
      }
    };

    return this.pc;
  }

  /* ---------- caller: create offer ---------- */
  async createOffer() {
    this.createPeer();
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.type === 'video',
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /* ---------- receiver: accept offer ---------- */
  async acceptOffer(offer) {
    this.createPeer();
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // flush any queued ICE
    this._flushIce();
    return answer;
  }

  /* ---------- receiver of answer ---------- */
  async acceptAnswer(answer) {
    if (!this.pc) return;
    if (this.pc.signalingState === 'stable') return; // already set

    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this._flushIce();
  }

  /* ---------- add ICE candidate ---------- */
  async addIce(candidate) {
    if (!candidate) return;

    // queue ICE until remote description ready
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
        .catch((e) => console.warn('flush ice error', e));
    }
  }

  /* ---------- toggles ---------- */
  toggleMic(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleCam(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  /* ---------- cleanup ---------- */
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
    this.connected = false;
  }
}