import React, { useEffect, useRef, useState } from "react";
import { SecureVault } from "../../plugins/SecureVaultPlugin";
import { Icons } from "../icons/Icons";

interface StreamableVideoProps {
  id: string;
  mimeType: string;
  onError: (msg: string) => void;
}

export const StreamableVideo: React.FC<StreamableVideoProps> = ({ id, mimeType, onError }) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing...");
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<Uint8Array[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();
    chunksRef.current = [];

    const loadVideo = async () => {
      try {
        // 1. Get File Info
        const info = await SecureVault.getFileInfo({ id });
        if (!isMountedRef.current) return;

        const totalChunks = info.totalChunks;
        
        // 2. Progressive Download Loop
        setStatus("Decrypting stream...");
        
        for (let i = 0; i < totalChunks; i++) {
          if (!isMountedRef.current) return;

          // Check memory pressure - safety limit (approx 600MB limit for browser safety)
          // 512KB chunk * 1200 ~= 600MB
          if (i > 1200) { 
             throw new Error("File too large for web playback. Please export to view.");
          }

          const { data } = await SecureVault.getFileChunk({ id, index: i });
          
          if (!isMountedRef.current) return;
          
          chunksRef.current.push(data);
          setProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        // 3. Assemble Blob
        if (!isMountedRef.current) return;
        setStatus("Assembling video...");
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setVideoSrc(url);
        
        // Clear memory reference
        chunksRef.current = [];

      } catch (e: any) {
        console.error("Video load error", e);
        if (isMountedRef.current) {
            onError(e.message || "Failed to load video");
        }
      }
    };

    loadVideo();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
      chunksRef.current = []; // Free memory immediately
    };
  }, [id, mimeType]);

  if (videoSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black animate-fade-in">
        <video 
          controls 
          autoPlay 
          className="w-full h-full max-h-screen" 
          src={videoSrc}
          playsInline
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8">
        <div className="w-full max-w-xs space-y-6 text-center">
            
            <div className="relative w-20 h-20 mx-auto">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-vault-800"
                    />
                    <circle
                        cx="40"
                        cy="40"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={226}
                        strokeDashoffset={226 - (226 * progress) / 100}
                        className="text-blue-500 transition-all duration-300 ease-linear"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold font-mono">{progress}%</span>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="font-bold text-lg animate-pulse">{status}</h3>
                <p className="text-xs text-vault-400">
                    Large files are decrypted locally before playback.
                </p>
            </div>

            {/* Cancel Button (handled by unmounting via parent close) */}
            <div className="pt-4">
                <div className="w-12 h-1 bg-vault-800 rounded-full mx-auto" />
            </div>
        </div>
    </div>
  );
};