import { VoiceGate } from './voice-gate';

class VoiceCleanup extends AudioWorkletProcessor {
  constructor() {
    super();
    this.gate = new VoiceGate(sampleRate);
  }
  process(inputs, outputs) {
    const output = outputs[0]?.[0],
      input = inputs[0]?.[0];
    if (output && input) this.gate.process(input, output);
    else output?.fill(0);
    return true;
  }
}
registerProcessor('pulse-voice-cleanup', VoiceCleanup);
