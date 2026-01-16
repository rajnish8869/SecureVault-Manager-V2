import React, { useState, useEffect } from "react";
import type { VaultItem, FileTypeCategory } from "../../types";
import { Icons, getFileIcon } from "../icons/Icons";
import { FileTypeDetector } from "../../services/FileTypeDetector";

interface FileViewerProps {
  item: VaultItem;
  uri: string | null;
  onClose: () => void;
  onOpenNative?: () => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  item,
  uri,
  onClose,
  onOpenNative,
}) => {
  const [category, setCategory] = useState<FileTypeCategory>("UNKNOWN");
  const [textContent, setTextContent] = useState<string>("Loading...");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectType = async () => {
      try {
        const blob = new Blob([item.originalName], { type: item.mimeType });
        const detection = await FileTypeDetector.detectType(
          blob,
          item.originalName
        );
        setCategory(detection.category);
      } catch (err) {
        console.warn("Failed to detect file type:", err);
      }
    };
    detectType();
  }, [item.mimeType, item.originalName]);

  useEffect(() => {
    if (category === "TEXT" && uri) {
      setLoadingProgress(0);
      fetch(uri)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((text) => {
          setTextContent(text);
          setLoadingProgress(100);
          setError(null);
        })
        .catch((err) => {
          setError(`Failed to load file: ${err.message}`);
          setLoadingProgress(0);
          setTextContent("Error loading content");
        });
    }
  }, [category, uri]);

  if (!uri) return null;

  const isImage = category === "IMAGE";
  const isVideo = category === "VIDEO";
  const isAudio = category === "AUDIO";
  const isPdf = category === "PDF";
  const isText = category === "TEXT";
  const isArchive = category === "ARCHIVE";
  const isApk = category === "APK";
  const isUnsupported = category === "UNKNOWN";

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col h-dvh w-full animate-fade-in">
      
      {/* HEADER: Safe Area Top */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent pt-safe transition-all duration-300">
        <div className="px-4 py-3 flex items-center justify-between">
            <button
                onClick={onClose}
                className="w-10 h-10 -ml-2 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all border border-white/10"
            >
                <Icons.X className="w-6 h-6" />
            </button>
            
            {!FileTypeDetector.canPreviewInApp(category) && onOpenNative && (
                <button
                    onClick={onOpenNative}
                    className="px-4 py-2 rounded-full bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-lg flex items-center gap-2"
                >
                    <Icons.Download className="w-4 h-4" /> Open External
                </button>
            )}
        </div>
      </div>

      {/* CONTENT BODY: Fullscreen */}
      <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
        {/* Loading Bar */}
        {loadingProgress > 0 && loadingProgress < 100 && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-vault-900 z-40">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="max-w-xs text-center space-y-4 p-6 bg-vault-900 rounded-2xl border border-vault-800">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
              <Icons.Alert className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-white font-bold">Preview Error</h3>
                <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Image */}
        {isImage && !error && (
          <img
            src={uri}
            alt="Preview"
            className="w-full h-full object-contain"
            onError={() => setError("Failed to load image")}
          />
        )}

        {/* Video */}
        {isVideo && !error && (
          <video
            src={uri}
            controls
            autoPlay
            className="w-full max-h-full"
            onError={() => setError("Failed to load video")}
          />
        )}

        {/* Audio */}
        {isAudio && !error && (
          <div className="w-full max-w-sm bg-vault-900/80 backdrop-blur-xl p-8 rounded-3xl border border-vault-700 shadow-2xl mx-4">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-glow">
                <Icons.Volume2 className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-white font-bold text-center mb-4 truncate text-lg">
              {item.originalName}
            </h3>
            <audio src={uri} controls className="w-full" onError={() => setError("Failed to load audio")} />
          </div>
        )}

        {/* Text */}
        {isText && !error && (
          <div className="w-full h-full bg-white text-black overflow-auto pt-safe pb-safe px-4 md:px-8">
             <div className="max-w-3xl mx-auto py-8 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {loadingProgress < 100 ? "Loading..." : textContent}
             </div>
          </div>
        )}

        {/* PDF */}
        {isPdf && !error && (
          <iframe
            src={uri}
            className="w-full h-full bg-white"
            title="PDF"
            onError={() => setError("Failed to load PDF")}
          />
        )}

        {/* Generic Unsupported / Archive / APK */}
        {(isArchive || isApk || isUnsupported) && !error && (
          <div className="text-center p-8 max-w-sm w-full mx-auto">
            <div className="w-24 h-24 bg-vault-800 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-vault-700 shadow-xl">
               {getFileIcon(item.mimeType, item.originalName)}
            </div>
            <h3 className="text-white font-bold text-xl mb-2 break-words line-clamp-3">{item.originalName}</h3>
            <p className="text-vault-400 text-sm mb-6">
              {isArchive ? "Archive content cannot be previewed directly." : 
               isApk ? "APK packages cannot be installed from secure storage." : 
               "Preview not available for this file type."}
            </p>
            {onOpenNative && (
                <button
                    onClick={onOpenNative}
                    className="w-full px-6 py-3 rounded-xl bg-vault-800 hover:bg-vault-700 text-white font-bold border border-vault-700 transition-colors"
                >
                    Open with System App
                </button>
            )}
          </div>
        )}
      </div>

      {/* FOOTER METADATA: Safe Area Bottom */}
      {(isImage || isVideo) && !error && (
        <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-safe pt-12">
            <div className="px-6 pb-6 text-center">
                <h4 className="text-white font-medium text-sm truncate opacity-90">{item.originalName}</h4>
                <p className="text-xs text-white/50 font-mono mt-1">
                    {FileTypeDetector.formatFileSize(item.size)} • {item.mimeType}
                </p>
            </div>
        </div>
      )}
    </div>
  );
};