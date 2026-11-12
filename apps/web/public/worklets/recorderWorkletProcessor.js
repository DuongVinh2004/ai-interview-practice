/**
 * AudioWorkletProcessor for recording PCM16 audio chunks with ultra-low latency.
 * Replaces deprecated ScriptProcessorNode per Plan B3 specification.
 * Converts 32-bit Float samples into 16-bit signed Linear PCM integers at 16kHz.
 */
class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // ~128ms chunk at 16kHz
    this._bytesWritten = 0;
    this._buffer = new Int16Array(this.bufferSize);
    this.stopped = false;

    this.port.onmessage = event => {
      if (event.data?.type === 'flush') {
        this.stopped = true;
        if (this._bytesWritten > 0) {
          const tail = this._buffer.slice(0, this._bytesWritten);
          this.port.postMessage(tail.buffer, [tail.buffer]);
          this._bytesWritten = 0;
        }
        this.port.postMessage({ type: 'flushed' });
      } else if (event.data?.type === 'start') {
        this.stopped = false;
        this._bytesWritten = 0;
      }
    };
  }

  process(inputs) {
    if (this.stopped) return true;
    if (!inputs || inputs.length === 0) return true;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    const numChannels = input.length;

    for (let i = 0; i < channelData.length; i++) {
      let sample = channelData[i];
      if (numChannels > 1) {
        let sum = sample;
        for (let ch = 1; ch < numChannels; ch++) {
          if (input[ch] && input[ch][i] !== undefined) {
            sum += input[ch][i];
          }
        }
        sample = sum / numChannels;
      }

      if (!Number.isFinite(sample)) {
        sample = 0;
      }

      const clamped = Math.max(-1, Math.min(1, sample));
      this._buffer[this._bytesWritten++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this._bytesWritten >= this.bufferSize) {
        this.port.postMessage(this._buffer.buffer, [this._buffer.buffer]);
        this._buffer = new Int16Array(this.bufferSize);
        this._bytesWritten = 0;
      }
    }

    return true;
  }
}

registerProcessor('recorder-worklet', RecorderWorkletProcessor);
