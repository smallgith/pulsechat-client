/* WebRTC helper — call lifecycle management */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
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
  }

  async startLocal() {
    const constraints =
      this.type === 'video'
        ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true, video: false };
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    return this.localStream;
  }

  createPeer() {
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.localStream?.getTracks().forEach((t) => this.pc.addTrack(t, this.localStream));

    this.remoteStream = new MediaStream();
    this.pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => this.remoteStream.addTrack(t));
      this.onRemoteStream?.(this.remoteStream);
    };

    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.onIce?.(e.candidate);
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') {
        this.onEnded?.();
      }
    };
    return this.pc;
  }

  async createOffer() {
    this.createPeer();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async acceptOffer(offer) {
    this.createPeer();
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async acceptAnswer(answer) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    // flush queued ICE
    while (this.iceQueue.length) {
      const c = this.iceQueue.shift();
      try { await this.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }

  async addIce(candidate) {
    if (!this.pc || !this.pc.remoteDescription) {
      this.iceQueue.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {}
  }

  toggleMic(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  toggleCam(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  destroy() {
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.remoteStream?.getTracks().forEach((t) => t.stop());
    try { this.pc?.close(); } catch {}
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
  }
}