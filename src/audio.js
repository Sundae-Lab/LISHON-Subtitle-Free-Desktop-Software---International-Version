import { t, localeTag } from "./i18n";
function wav(samples, rate) {
  const length = Math.round(samples.length * 16000 / rate),
    buffer = new ArrayBuffer(44 + length * 2),
    view = new DataView(buffer);
  const str = (o, s) => [...s].forEach((v, i) => view.setUint8(o + i, v.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, length * 2, true);
  // Average the source interval to reduce aliasing when downsampling desktop audio.
  for (let i = 0; i < length; i++) {
    let sum = 0,
      count = 0;
    for (let j = Math.floor(i * rate / 16000); j < Math.min(samples.length, Math.floor((i + 1) * rate / 16000)); j++) {
      sum += samples[j];
      count++;
    }
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sum / Math.max(1, count))) * 32767, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export async function startAudio({
  source,
  seconds,
  api,
  onLevel,
  onResult,
  onError
}) {
  await api.call('audio', {
    action: 'arm'
  });
  const stream = source === 'system' ? await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  }) : await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false
    },
    video: false
  });
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach(t => t.stop());
    throw new Error(t("未获得音频轨道。请检查 Windows 声音设备和录音权限。"));
  }
  // Keep the display video track alive for Windows loopback, but never read its frames.
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
  } catch (e) {
    stream.getTracks().forEach(t => t.stop());
    await context.close();
    await api.call('audio', {
      action: 'stop'
    });
    throw e;
  }
  const input = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  const processor = new AudioWorkletNode(context, 'lingua-pcm');
  const mute = context.createGain();
  mute.gain.value = 0;
  input.connect(processor);
  processor.connect(mute);
  mute.connect(context.destination);
  let chunks = [],
    size = 0,
    busy = false,
    stopped = false,
    queued = null,
    dropped = 0;
  async function process(samples) {
    if (stopped) return;
    if (busy) {
      queued = samples;
      dropped++;
      return;
    }
    busy = true;
    try {
      const result = await api.call('audio', {
        audio: wav(samples, context.sampleRate)
      });
      if (!stopped) onResult({
        ...result,
        dropped
      });
    } catch (e) {
      if (!stopped) onError(e);
    } finally {
      busy = false;
      if (queued && !stopped) {
        const next = queued;
        queued = null;
        process(next);
      }
    }
  }
  processor.port.onmessage = event => {
    if (stopped) return;
    const data = event.data;
    chunks.push(data);
    size += data.length;
    let sum = 0;
    for (const v of data) sum += v * v;
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 8));
    if (size >= context.sampleRate * seconds) {
      const samples = new Float32Array(size);
      let offset = 0;
      for (const c of chunks) {
        samples.set(c, offset);
        offset += c.length;
      }
      chunks = [];
      size = 0;
      process(samples);
    }
  };
  const stop = () => {
    stopped = true;
    queued = null;
    processor.port.onmessage = null;
    processor.disconnect();
    input.disconnect();
    stream.getTracks().forEach(t => t.stop());
    context.close();
    api.call('audio', {
      action: 'stop'
    });
    onLevel(0);
  };
  // A language swap keeps the device open but must not submit buffered old-language audio.
  stop.reset = () => {
    chunks = [];
    size = 0;
    queued = null;
  };
  stream.getAudioTracks()[0].onended = () => {
    if (!stopped) {
      stop();
      onError(new Error(t("音频设备已断开，请重新开始监听。")));
    }
  };
  await api.call('audio',{action:'started'});
  return stop;
}
