// Speech-friendly hysteresis and a soft release reduce room noise between words.
export class VoiceGate {
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    this.gain = 0.05;
    this.floor = 0.0005;
    this.hold = 0;
  }
  process(input, output) {
    let energy = 0;
    for (const sample of input) energy += sample * sample;
    const rms = Math.sqrt(energy / Math.max(1, input.length));
    const open = Math.max(0.003, this.floor * 3);
    const close = Math.max(0.0015, this.floor * 1.8);
    if (rms > open || (this.hold > 0 && rms > close)) this.hold = this.sampleRate * 0.25;
    else this.hold = Math.max(0, this.hold - input.length);
    if (this.hold === 0) this.floor += (Math.min(rms, 0.003) - this.floor) * 0.015;
    const target = this.hold > 0 ? 1 : 0.05;
    const smoothing = 1 - Math.exp(-1 / (this.sampleRate * (target > this.gain ? 0.004 : 0.15)));
    for (let i = 0; i < output.length; i++) {
      this.gain += (target - this.gain) * smoothing;
      output[i] = (input[i] || 0) * this.gain;
    }
  }
}
