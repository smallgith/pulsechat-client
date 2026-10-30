import workletUrl from './voice-cleanup-worklet.js?worker&url';

const cleanups = new WeakMap();
export const speechConstraints = () => ({
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  // Automatic gain can amplify a fan/room noise during pauses.
  autoGainControl: { ideal: false },
  channelCount: { ideal: 1 },
});

export async function captureCallMedia(video = false) {
  const raw = await navigator.mediaDevices.getUserMedia({ audio: speechConstraints(), video });
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio || !window.AudioWorkletNode || !raw.getAudioTracks().length) return raw;
  let context;
  try {
    context = new Audio({ latencyHint: 'interactive' });
    if (!context.audioWorklet) throw new Error('Audio worklets unavailable');
    await context.audioWorklet.addModule(workletUrl);
    await context.resume();
    const source = context.createMediaStreamSource(raw);
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;
    highpass.Q.value = 0.707;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 10000;
    lowpass.Q.value = 0.707;
    const gate = new AudioWorkletNode(context, 'pulse-voice-cleanup', { outputChannelCount: [1] });
    const destination = context.createMediaStreamDestination();
    source.connect(highpass).connect(lowpass).connect(gate).connect(destination);
    // Only the cleaned audio is sent. Never connect local microphone audio to speakers.
    const stream = new MediaStream([
      ...destination.stream.getAudioTracks(),
      ...raw.getVideoTracks(),
    ]);
    cleanups.set(stream, () => {
      for (const node of [source, highpass, lowpass, gate, destination]) node.disconnect();
      raw.getTracks().forEach((track) => track.stop());
      context.close().catch(() => {});
    });
    return stream;
  } catch {
    context?.close().catch(() => {});
    // Keep calling available when a browser only supports native AEC/noise suppression.
    return raw;
  }
}

export function releaseCallMedia(stream) {
  if (!stream) return;
  cleanups.get(stream)?.();
  cleanups.delete(stream);
  stream.getTracks().forEach((track) => track.stop());
}
