import React, { useEffect, useRef, useState } from "react";
import { SecureVault } from "../../plugins/SecureVaultPlugin";

interface StreamableVideoProps {
  id: string;
  mimeType: string;
  onError: (msg: string) => void;
}

export const StreamableVideo: React.FC<StreamableVideoProps> = ({ id, mimeType, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const isMountedRef = useRef(true);
  const totalChunksRef = useRef(0);
  const chunksLoadedRef = useRef(0);
  const bufferFullRetries = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      try {
        const info = await SecureVault.getFileInfo({ id });
        if (!isMountedRef.current) return;
        
        totalChunksRef.current = info.totalChunks;

        const ms = new MediaSource();
        mediaSourceRef.current = ms;
        
        const onSourceOpen = async () => {
          if (!isMountedRef.current || mediaSourceRef.current?.readyState !== 'open') return;
          
          // Prevent multiple source buffers
          if (ms.sourceBuffers.length > 0) return;

          try {
            // Determine the best supported mime type
            let selectedType = mimeType;
            // Basic codec string for common mp4 as fallback
            const fallbackType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';

            if (!MediaSource.isTypeSupported(selectedType)) {
               if (MediaSource.isTypeSupported('video/mp4')) {
                   selectedType = 'video/mp4';
               } else if (MediaSource.isTypeSupported(fallbackType)) {
                   selectedType = fallbackType;
               } else {
                   // This is a soft error, we will try anyway or let it fail downstream, 
                   // but best to warn
                   console.warn(`MIME type ${mimeType} might not be supported for streaming.`);
               }
            }
            
            const sb = ms.addSourceBuffer(selectedType);
            sourceBufferRef.current = sb;
            
            sb.addEventListener('updateend', () => {
                // Reset retries on successful update
                bufferFullRetries.current = 0;
                loadNextChunk();
            });
            
            sb.addEventListener('error', (e: Event) => {
                // SourceBuffer errors are generic events. 
                // Usually means decode error or invalid format.
                console.warn("SourceBuffer error occurred (likely format incompatibility).");
                if (isMountedRef.current) {
                    // Abort streaming and trigger fallback
                    onError("Streaming decode error");
                }
            });
            
            loadNextChunk();
          } catch (e: any) {
            console.error("Streaming init failed", e);
            onError("Streaming init failed: " + e.message);
          }
        };

        ms.addEventListener('sourceopen', onSourceOpen);

        if (videoRef.current) {
          videoRef.current.src = URL.createObjectURL(ms);
        }
      } catch (e: any) {
        if (isMountedRef.current) onError("Failed to load video info: " + e.message);
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
      const ms = mediaSourceRef.current;
      if (ms) {
        if (ms.readyState === 'open') {
            try { 
                const sb = sourceBufferRef.current;
                // Only end stream if buffer isn't busy
                if (sb && !sb.updating) {
                    ms.endOfStream(); 
                }
            } catch(e) {}
        }
      }
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src);
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, [id, mimeType]);

  const cleanupBuffer = () => {
      // Try to free up space in the buffer if we hit quota
      const video = videoRef.current;
      const sb = sourceBufferRef.current;
      if (!video || !sb || sb.updating) return false;

      try {
          const currentTime = video.currentTime;
          let removed = false;
          
          // Remove played segments older than 30s
          // Loop backwards or check specific ranges
          const buffered = sb.buffered;
          for (let i = 0; i < buffered.length; i++) {
              const start = buffered.start(i);
              const end = buffered.end(i);
              
              if (end < currentTime - 30) {
                  sb.remove(start, end);
                  removed = true;
                  break; // Can only do one remove at a time usually
              } else if (start < currentTime - 30) {
                  sb.remove(start, currentTime - 30);
                  removed = true;
                  break;
              }
          }
          return removed;
      } catch (e) {
          console.warn("Failed to cleanup buffer", e);
          return false;
      }
  };

  const loadNextChunk = async () => {
    if (!isMountedRef.current) return;

    // Check if streaming is complete
    if (chunksLoadedRef.current >= totalChunksRef.current) {
      const ms = mediaSourceRef.current;
      const sb = sourceBufferRef.current;
      if (ms && ms.readyState === 'open' && sb && !sb.updating) {
        try { ms.endOfStream(); } catch(e){}
      }
      setLoading(false);
      return;
    }

    try {
      // Throttle: if we have plenty buffered, wait
      if (videoRef.current && sourceBufferRef.current && videoRef.current.buffered.length > 0) {
         const buffered = videoRef.current.buffered;
         const lastEnd = buffered.end(buffered.length - 1);
         if (lastEnd - videoRef.current.currentTime > 30) {
             setTimeout(loadNextChunk, 1000);
             return;
         }
      }

      if (sourceBufferRef.current?.updating) return; 

      const idx = chunksLoadedRef.current;
      const { data } = await SecureVault.getFileChunk({ id, index: idx });
      
      if (!isMountedRef.current) return;

      appendData(data);
      
    } catch (e) {
      console.error("Chunk load error", e);
      onError("Network/Decrypt error");
    }
  };

  const appendData = (data: Uint8Array) => {
    if (!isMountedRef.current) return;
    
    const sb = sourceBufferRef.current;
    const ms = mediaSourceRef.current;

    if (!sb || !ms || ms.readyState !== 'open' || sb.updating) return;

    try {
      sb.appendBuffer(data);
      chunksLoadedRef.current++;
      setProgress(Math.round((chunksLoadedRef.current / totalChunksRef.current) * 100));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
          console.warn("Buffer full, attempting cleanup...");
          bufferFullRetries.current++;
          
          if (bufferFullRetries.current > 5) {
              console.error("Buffer permanently full, stopping stream");
              return;
          }

          const cleaned = cleanupBuffer();
          if (cleaned) {
              // Retry append after a short delay to allow 'updateend' from remove() to fire?
              // Actually remove() fires updateend, so we should wait for that. 
              // But cleanupBuffer calls remove() which sets updating=true.
              // So we shouldn't manually retry immediately, we should let the event handler loop handle it?
              // Re-check: cleanupBuffer returns true if remove() was called.
              // If remove() was called, sb.updating is true. The 'updateend' listener will fire and call loadNextChunk.
              // However, loadNextChunk fetches NEW data. We need to retry appending CURRENT data.
              
              // Simplification: Just wait and recursive call with timeout, checking updating flag.
              setTimeout(() => appendData(data), 500);
          } else {
              // Wait longer if we couldn't clean anything
              setTimeout(() => appendData(data), 2000);
          }
      } else {
          console.error("SourceBuffer append error:", e);
          onError("Append Error: " + (e.message || "Unknown"));
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black relative">
        <video 
            ref={videoRef} 
            controls 
            autoPlay 
            className="w-full h-full" 
            playsInline
        />
        {loading && progress < 100 && (
            <div className="absolute top-4 right-4 bg-black/60 px-3 py-1 rounded-full text-xs font-mono text-blue-400 border border-blue-500/30 flex items-center gap-2 pointer-events-none">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Stream: {progress}%
            </div>
        )}
    </div>
  );
};