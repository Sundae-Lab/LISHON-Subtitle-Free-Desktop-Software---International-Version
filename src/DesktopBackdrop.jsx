import React, { useEffect, useRef, useState } from 'react';
import { api } from './bridge';

// A bounded GPU video stream: no PNG encoding, polling screenshots, or frame queues.
export default function DesktopBackdrop({
  enabled,
  level
}) {
  const activeDisplay = useRef(),
    video = useRef(),
    [geometry, setGeometry] = useState(null),
    [display, setDisplay] = useState(null),
    [visible, setVisible] = useState(true);
  const running = enabled && visible;
  useEffect(() => api.on('overlay-visibility', setVisible), []);
  useEffect(() => api.on('overlay-position', value => {
    setGeometry(value);
    if (activeDisplay.current !== value.displayId) setDisplay(value.displayId);
  }), []);
  useEffect(() => {
    if (!running) {
      api.call('overlay-backdrop-stopped').catch(() => {});
      return;
    }
    let cancelled = false,
      stream;
    (async () => {
      const data = await api.call('overlay-backdrop');
      if (cancelled || !data) return;
      setGeometry(data);
      activeDisplay.current = data.displayId;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: data.sourceId,
            maxFrameRate: 30,
            maxWidth: 1920,
            maxHeight: 1920
          }
        }
      });
      if (cancelled) {
        stream.getTracks().forEach(targetRow => targetRow.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play();
    })().catch(() => {
      if (!cancelled) api.call('overlay-backdrop-error').catch(() => {});
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(targetRow => targetRow.stop());
      if (video.current) video.current.srcObject = null;
      api.call('overlay-backdrop-stopped').catch(() => {});
    };
  }, [running, display]);
  if (!running) return null;
  return <div className="desktop-backdrop-frame" style={{
    filter: `blur(${level * 2}px)`
  }}><video ref={video} className="desktop-backdrop" muted playsInline aria-hidden="true" style={geometry ? {
      width: geometry.display.width,
      height: geometry.display.height,
      left: geometry.display.x - geometry.window.x + 60,
      top: geometry.display.y - geometry.window.y + 60
    } : undefined} /></div>;
}
