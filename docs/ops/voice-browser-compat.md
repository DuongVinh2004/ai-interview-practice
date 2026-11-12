# Báo Cáo & Hướng Dẫn Tương Thích Trình Duyệt Cho Voice Streaming

Tài liệu chi tiết về độ tương thích của các trình duyệt web phổ biến với pipeline truyền phát âm thanh hai chiều thời gian thực (Web Audio API, AudioWorklet, MediaRecorder, WebSocket) trong hệ thống `AI Interview Practice`.

---

## 1. Bảng Ma Trận Tương Thích Trình Duyệt

| Trình Duyệt                 |   Web Audio API    |     AudioWorklet      |    MediaRecorder     | WebSocket Binary (ArrayBuffer) | Trạng Thái Đánh Giá                  |
| :-------------------------- | :----------------: | :-------------------: | :------------------: | :----------------------------: | :----------------------------------- |
| **Chrome Desktop (v90+)**   |       Đầy đủ       |        Đầy đủ         |        Đầy đủ        |             Đầy đủ             | **Khuyến nghị nhất** (Tối ưu nhất)   |
| **Chrome Android (v90+)**   |       Đầy đủ       |        Đầy đủ         |        Đầy đủ        |             Đầy đủ             | **Hỗ trợ chính thức**                |
| **Edge Chromium (v90+)**    |       Đầy đủ       |        Đầy đủ         |        Đầy đủ        |             Đầy đủ             | **Khuyến nghị**                      |
| **Firefox Desktop (v90+)**  |       Đầy đủ       |        Đầy đủ         | ⚠️ Cần ép MIME type  |             Đầy đủ             | **Hỗ trợ** (Lưu ý Ogg container)     |
| **Firefox Android (v100+)** |       Đầy đủ       |        Đầy đủ         | ⚠️ Cần ép MIME type  |             Đầy đủ             | **Hỗ trợ**                           |
| **Safari macOS (v14.1+)**   |       Đầy đủ       |        Đầy đủ         |        Đầy đủ        |             Đầy đủ             | **Hỗ trợ**                           |
| **Safari iOS (v14.5+)**     | ⚠️ Bị chặn gesture | ⚠️ Cần resume gesture | ⚠️ Hạn chế bit depth |             Đầy đủ             | **Cần xử lý đặc biệt (Workarounds)** |

---

## 2. Vấn Đề Đặc Thù & Cách Khắc Phục Trên iOS Safari

### 2.1 Chính sách chặn âm thanh tự động (Autoplay Policy & User Gesture)

- **Vấn đề**: Trên iOS Safari (cả Safari và các trình duyệt bên thứ ba trên iOS như Chrome/Edge vốn chạy trên nền WebKit), `AudioContext` được tạo ở trạng thái `suspended` nếu không kích hoạt trực tiếp từ một sự kiện chạm của người dùng (`click` hoặc `touchend`).
- **Giải pháp xử lý (Workaround)**:
  Bắt buộc gọi hàm `audioContext.resume()` ngay trong `onClick` handler của nút "Bắt đầu phỏng vấn" hoặc "Bật micro", trước khi bất kỳ luồng ghi âm nào diễn ra:

  ```typescript
  async function handleStartVoiceSession() {
    if (!audioContext) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtxClass();
    }

    // Đánh thức AudioContext thông qua gesture của người dùng
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Sau khi context active, tiến hành kết nối WebSocket và ghi âm
    initiateStreamingSession();
  }
  ```

### 2.2 Tần số lấy mẫu mặc định (Sample Rate) 48,000 Hz trên iOS

- **Vấn đề**: Trình điều khiển phần cứng của iOS ép `AudioContext.sampleRate` về `48000 Hz` (thay vì `16000 Hz` theo tiêu chuẩn tối ưu của Deepgram STT). Việc truyền trực tiếp luồng 48kHz gây tốn gấp 3 lần băng thông mạng và tăng độ trễ STT.
- **Giải pháp xử lý (Downsampling)**:
  Sử dụng module `AudioWorkletNode` để downsample luồng PCM từ 48,000 Hz xuống 16,000 Hz (tỷ lệ 3:1) trực tiếp trên Audio Thread của trình duyệt trước khi đóng gói gửi qua WebSocket:

  ```javascript
  // audio-resampler-worklet.js
  class ResamplerProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      if (!input || !input[0]) return true;
      const inputChannel = input[0]; // 48kHz float32
      const step = 3; // 48000 / 16000
      const outputLength = Math.floor(inputChannel.length / step);
      const resampledInt16 = new Int16Array(outputLength);

      for (let i = 0, j = 0; i < inputChannel.length && j < outputLength; i += step, j++) {
        // Chuyển đổi Float32 [-1.0, 1.0] sang Linear PCM 16-bit
        const s = Math.max(-1, Math.min(1, inputChannel[i]));
        resampledInt16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(resampledInt16.buffer, [resampledInt16.buffer]);
      return true;
    }
  }
  registerProcessor('resampler-processor', ResamplerProcessor);
  ```

---

## 3. Vấn Đề Định Dạng MediaRecorder Trên Mozilla Firefox

### 3.1 Mặc định định dạng container Ogg (`audio/ogg`)

- **Vấn đề**: Khác với Chromium vốn sử dụng `audio/webm;codecs=opus`, trình duyệt Firefox mặc định tạo blob âm thanh với MIME type `audio/ogg;codecs=opus`. Các dịch vụ STT realtime (bao gồm Deepgram streaming) cần biết chính xác container hoặc yêu cầu raw PCM stream để phân tích gói tin.
- **Giải pháp xử lý**:
  Kiểm tra danh sách codec hỗ trợ qua `MediaRecorder.isTypeSupported` theo thứ tự ưu tiên, ép dùng `audio/webm;codecs=opus` nếu khả dụng:

  ```typescript
  function getOptimalMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Fallback về native PCM qua AudioWorklet
  }
  ```

---

## 4. Tối Ưu Hóa Hiệu Năng Trên Thiết Bị Di Động (Mobile Performance)

### 4.1 Khuyến nghị kích thước Buffer (Buffer Size Recommendation)

- **Trên Desktop**: Khuyến nghị kích thước buffer từ `1024` đến `2048` samples (tương đương 64ms - 128ms ở tần số 16kHz) để tối thiểu hóa độ trễ (latency).
- **Trên Mobile**: Nên sử dụng buffer `2048` hoặc `4096` samples. Buffer quá nhỏ (< 512 samples) sẽ gây quá tải context-switching và drop audio frame trên các CPU di động tầm trung/giá rẻ.

### 4.2 Tác động của Chế độ Tiết kiệm Pin (Power Saving / Low Power Mode)

- **Hành vi**:
  - Khi bật Low Power Mode trên iOS hoặc Android, hệ thống giảm tần số xung nhịp CPU, giảm băng thông background network và throttle các timer (`setInterval`, `setTimeout`) xuống chu kỳ 1000ms.
  - Luồng ghi âm chạy trong main thread bị khựng tiếng (jitter) và đứt quãng âm thanh (crackling).
- **Giải pháp kiến trúc**:
  1. **Tuyệt đối không dùng `setInterval` để đọc âm thanh**: Bắt buộc xử lý âm thanh trong `AudioWorkletNode` độc lập trên Audio Rendering Thread riêng biệt của trình duyệt.
  2. **WebSocket Keep-Alive Heartbeat**: Gửi ping nhỏ (1 byte) mỗi 5 giây để ngăn trình duyệt di động đóng kết nối WebSocket khi màn hình tắt hoặc app chạy ngầm.
  3. **Cảnh báo UI**: Phát hiện hiện tượng trễ khung âm thanh bằng cách theo dõi timestamp giữa các chunk và hiển thị cảnh báo người dùng tắt chế độ tiết kiệm pin nếu phát hiện hiện tượng sụt giảm hiệu năng.
