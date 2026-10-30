import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceGate } from '../../src/lib/voice-gate.js';

test('voice gate attenuates room noise while preserving speech and pauses between words', () => {
  const gate = new VoiceGate(48000),
    output = new Float32Array(128);
  const noise = new Float32Array(128).fill(0.0008);
  for (let i = 0; i < 500; i++) gate.process(noise, output);
  assert.ok(output[127] < 0.00008, 'Background noise should be attenuated by at least 20 dB');
  const speech = new Float32Array(128).fill(0.04);
  for (let i = 0; i < 15; i++) gate.process(speech, output);
  assert.ok(output[127] > 0.039, 'Speech should pass without volume loss');
  for (let i = 0; i < 20; i++) gate.process(noise, output);
  assert.ok(gate.gain > 0.95, 'Keep the gate open across short pauses');
  for (let i = 0; i < 800; i++) gate.process(noise, output);
  assert.ok(output[127] < 0.00008);
  gate.process(new Float32Array(128), output);
  assert.ok(output.every((value) => Number.isFinite(value)));
});
