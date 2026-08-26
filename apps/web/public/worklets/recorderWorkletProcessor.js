/**
 * AudioWorkletProcessor for recording PCM16 audio chunks with ultra-low latency.
 * Converts 32-bit Float samples into 16-bit signed Linear PCM integers.
 */
class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048; // ~128ms chunk at 16kHz
    this._bytesWritten = 0;
    this._buffer = new Int16Array(this.bufferSize);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      this._buffer[this._bytesWritten++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

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
