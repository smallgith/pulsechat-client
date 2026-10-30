import { test, expect } from '@playwright/test';
import { stubGoogle } from './support/google-login';

test('call cleanup attenuates background noise, passes speech and releases the microphone', async ({
  page,
}) => {
  await stubGoogle(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const { captureCallMedia, releaseCallMedia } = await import('/src/lib/microphone.js');
    const sourceContext = new AudioContext();
    await sourceContext.resume();
    const oscillator = sourceContext.createOscillator(),
      volume = sourceContext.createGain();
    oscillator.frequency.value = 440;
    volume.gain.value = 0.0008;
    const destination = sourceContext.createMediaStreamDestination();
    oscillator.connect(volume).connect(destination);
    oscillator.start();
    let constraints;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (requested) => {
      constraints = requested;
      return destination.stream;
    };
    const cleaned = await captureCallMedia(false);
    navigator.mediaDevices.getUserMedia = original;
    if (cleaned === destination.stream)
      throw new Error('Expected the AudioWorklet cleanup pipeline');
    const analyser = (stream) => {
      const node = sourceContext.createAnalyser();
      node.fftSize = 2048;
      sourceContext.createMediaStreamSource(stream).connect(node);
      const samples = new Float32Array(node.fftSize);
      return () => {
        node.getFloatTimeDomainData(samples);
        return Math.sqrt(
          samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length
        );
      };
    };
    const input = analyser(destination.stream),
      output = analyser(cleaned);
    window.audioFixture = {
      constraints,
      ratio: () => output() / Math.max(0.000001, input()),
      speech: () => {
        volume.gain.value = 0.04;
      },
      silence: () => {
        volume.gain.value = 0.0008;
      },
      release: async () => {
        releaseCallMedia(cleaned);
        oscillator.stop();
        await sourceContext.close();
        return [...destination.stream.getTracks(), ...cleaned.getTracks()].map(
          (track) => track.readyState
        );
      },
    };
  });
  expect(await page.evaluate(() => window.audioFixture.constraints.audio)).toMatchObject({
    noiseSuppression: { ideal: true },
    echoCancellation: { ideal: true },
    autoGainControl: { ideal: false },
  });
  await expect.poll(() => page.evaluate(() => window.audioFixture.ratio())).toBeLessThan(0.15);
  await page.evaluate(() => window.audioFixture.speech());
  await expect.poll(() => page.evaluate(() => window.audioFixture.ratio())).toBeGreaterThan(0.8);
  await page.evaluate(() => window.audioFixture.silence());
  await expect.poll(() => page.evaluate(() => window.audioFixture.ratio())).toBeLessThan(0.15);
  expect(await page.evaluate(() => window.audioFixture.release())).toEqual(['ended', 'ended']);
});
