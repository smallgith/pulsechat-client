import { captureCallMedia, releaseCallMedia } from './microphone';

const getIceConfig = () => {
  try { const configured = JSON.parse(import.meta.env.VITE_ICE_SERVERS || 'null'); if (Array.isArray(configured) && configured.length) return { iceServers: configured }; } catch { /* Use STUN for local development. */ }
  return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
};

export class CallSession {
  constructor({ callId, peerId, type, onIce, onRemoteStream, onEnded, onConnected }) {
    Object.assign(this, { callId, peerId, type, onIce, onRemoteStream, onEnded, onConnected });
    this.pc = null; this.localStream = null; this.ownsLocal = true; this.remoteStream = null; this.iceQueue = []; this.destroyed = false;
  }
  async startLocal() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Calls need HTTPS or localhost and microphone permission.');
    if (navigator.audioSession) { this.previousAudioType = navigator.audioSession.type; try { navigator.audioSession.type = 'play-and-record'; } catch {} }
    const stream = await captureCallMedia(this.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false);
    if (this.destroyed) { releaseCallMedia(stream); throw new Error('Call cancelled'); }
    this.localStream = stream; return stream;
  }
  createPeer() {
    if (this.destroyed) throw new Error('Call cancelled');
    const pc = new RTCPeerConnection(getIceConfig()); this.pc = pc; this.remoteStream = new MediaStream();
    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
    pc.ontrack = ({ track }) => {
      if (!this.remoteStream.getTrackById(track.id)) this.remoteStream.addTrack(track);
      const publish = () => { if (!this.destroyed) this.onRemoteStream?.(new MediaStream(this.remoteStream.getTracks())); };
      track.onunmute = publish; publish();
    };
    pc.onicecandidate = ({ candidate }) => { if (candidate && !this.destroyed) this.onIce?.(candidate.toJSON ? candidate.toJSON() : candidate); };
    pc.onconnectionstatechange = () => {
      if (this.destroyed) return;
      if (pc.connectionState === 'connected') { clearTimeout(this.connectTimer); clearTimeout(this.disconnectTimer); this.onConnected?.(); }
      else if (pc.connectionState === 'failed') this.onEnded?.();
      else if (pc.connectionState === 'disconnected') { clearTimeout(this.disconnectTimer); this.disconnectTimer = setTimeout(() => { if (!this.destroyed && pc.connectionState === 'disconnected') this.onEnded?.(); }, 15000); }
    };
    return pc;
  }
  async createOffer() { const pc = this.createPeer(); await pc.setLocalDescription(await pc.createOffer()); return pc.localDescription.toJSON(); }
  async acceptOffer(offer) {
    const pc = this.createPeer(); await pc.setRemoteDescription(offer); this.armConnectionTimeout(); await this.flushIce(); await pc.setLocalDescription(await pc.createAnswer()); return pc.localDescription.toJSON();
  }
  async acceptAnswer(answer) { if (!this.pc || this.destroyed) return; await this.pc.setRemoteDescription(answer); this.armConnectionTimeout(); await this.flushIce(); }
  armConnectionTimeout() { clearTimeout(this.connectTimer); this.connectTimer = setTimeout(() => { if (!this.destroyed && this.pc?.connectionState !== 'connected') this.onEnded?.(); }, 35000); }
  async addIce(candidate) {
    if (!candidate || this.destroyed) return;
    if (!this.pc?.remoteDescription) { this.iceQueue.push(candidate); return; }
    try { await this.pc.addIceCandidate(candidate); } catch (e) { console.warn('Could not add ICE candidate:', e.name); }
  }
  async flushIce() { const queue = this.iceQueue.splice(0); for (const candidate of queue) await this.addIce(candidate); }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true; clearTimeout(this.connectTimer); clearTimeout(this.disconnectTimer);
    if (this.ownsLocal) releaseCallMedia(this.localStream); this.remoteStream?.getTracks().forEach((t) => t.stop());
    if (this.pc) { this.pc.onconnectionstatechange = null; this.pc.onicecandidate = null; this.pc.ontrack = null; this.pc.close(); }
    if (navigator.audioSession && this.previousAudioType) { try { navigator.audioSession.type = this.previousAudioType; } catch {} }
    this.pc = null; this.localStream = null; this.ownsLocal = true; this.remoteStream = null; this.iceQueue = [];
  }
}
