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
    <div className="fixed inset-0 bg-black z-[60] flex flex-col animate-in zoom-in-95 duration-200">
      <div className="pt-safe bg-vault-950/90 backdrop-blur-md border-b border-vault-800 z-10 flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <div className="p-2 bg-vault-800 rounded-lg text-vault-400 border border-vault-700 flex-shrink-0">
              {getFileIcon(item.mimeType, item.originalName)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white truncate text-sm leading-tight">
                {item.originalName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-[10px] text-green-400 flex items-center gap-1 font-mono uppercase tracking-wide">
                  <Icons.Lock /> Secure View
                </p>
                <span className="text-[10px] text-vault-500">
                  {FileTypeDetector.formatFileSize(item.size)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {!FileTypeDetector.canPreviewInApp(category) && onOpenNative && (
              <button
                onClick={onOpenNative}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium text-xs border border-blue-500"
                title="Open with system app"
              >
                Open
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-vault-800 text-white hover:bg-vault-700 transition font-medium text-sm border border-vault-700"
            >
              Close
            </button>
          </div>
        </div>
        {/* Loading progress bar */}
        {loadingProgress > 0 && loadingProgress < 100 && (
          <div className="h-1 bg-vault-900">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        )}
      </div>
      {/* Content Body */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-black p-4 relative pb-safe">
        {/* Error State */}
        {error && (
          <div className="w-full max-w-sm bg-red-950 p-6 rounded-xl border border-red-800 shadow-xl text-center">
            <div className="w-12 h-12 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
              <Icons.Alert />
            </div>
            <h3 className="text-white font-bold mb-2">Error Loading File</h3>
            <p className="text-red-300 text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-lg bg-red-900 text-white hover:bg-red-800 transition text-sm"
            >
              Close
            </button>
          </div>
        )}
        {/* Image Preview */}
        {isImage && !error && (
          <img
            src={uri}
            alt="Secure Preview"
            className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-lg"
            onError={() => setError("Failed to load image")}
          />
        )}
        {/* Video Preview */}
        {isVideo && !error && (
          <div className="w-full max-w-4xl">
            <video
              src={uri}
              controls
              autoPlay
              className="w-full h-auto rounded-lg shadow-2xl bg-vault-950"
              onError={() => setError("Failed to load video")}
            />
          </div>
        )}
        {/* Audio Player */}
        {isAudio && !error && (
          <div className="w-full max-w-md bg-vault-900 p-8 rounded-2xl border border-vault-800 shadow-2xl">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
                <Icons.Volume2 />
              </div>
            </div>
            <h3 className="text-white font-bold text-center mb-2">
              {item.originalName}
            </h3>
            <audio
              src={uri}
              controls
              className="w-full"
              onError={() => setError("Failed to load audio")}
            />
          </div>
        )}
        {/* Text Preview */}
        {isText && !error && (
          <div className="w-full max-w-4xl mx-auto h-full bg-white text-black p-6 rounded-lg overflow-auto font-mono text-xs md:text-sm whitespace-pre-wrap shadow-xl">
            {loadingProgress < 100 ? (
              <div className="text-center text-gray-500">Loading...</div>
            ) : (
              textContent
            )}
          </div>
        )}
        {/* PDF Preview */}
        {isPdf && !error && (
          <iframe
            src={uri}
            className="w-full h-full bg-white border-none rounded-lg shadow-2xl"
            title="PDF Viewer"
            onError={() => setError("Failed to load PDF")}
          />
        )}
        {/* APK Info */}
        {isApk && !error && (
          <div className="w-full max-w-sm bg-vault-900 p-8 rounded-3xl border border-vault-800 text-center space-y-6 shadow-2xl">
            <div className="w-24 h-24 mx-auto bg-green-500/10 rounded-3xl flex items-center justify-center text-green-500 border border-green-500/20">
              <Icons.Android />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {item.originalName}
              </h2>
              <p className="text-sm text-vault-400">
                Android Application Package
              </p>
            </div>
            <div className="bg-vault-950 rounded-xl p-4 text-left space-y-3 text-sm border border-vault-800">
              <div className="flex justify-between border-b border-vault-800 pb-2">
                <span className="text-vault-500">Size</span>
                <span className="text-white font-mono">
                  {FileTypeDetector.formatFileSize(item.size)}
                </span>
              </div>
              <div className="flex justify-between border-b border-vault-800 pb-2">
                <span className="text-vault-500">Type</span>
                <span className="text-white">APK Package</span>
              </div>
              <div className="flex justify-between">
                <span className="text-vault-500">Status</span>
                <span className="text-orange-400">Not Installable</span>
              </div>
            </div>
            <p className="text-xs text-amber-500/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/10">
              Installation from secure vault is restricted for security. Export
              to install.
            </p>
          </div>
        )}
        {/* Archive Preview */}
        {isArchive && !error && (
          <div className="w-full max-w-md bg-vault-900 rounded-2xl border border-vault-800 flex flex-col max-h-[80vh] shadow-2xl">
            <div className="p-4 border-b border-vault-800 flex items-center gap-3 bg-vault-800/50 rounded-t-2xl">
              <div className="text-yellow-500 text-xl">
                <Icons.Zip />
              </div>
              <div>
                <h4 className="font-bold text-white">Archive</h4>
                <p className="text-xs text-vault-400">Preview not available</p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
              <div className="text-center text-vault-400">
                <p className="mb-3">
                  Archives must be extracted to view contents
                </p>
                <p className="text-xs text-vault-500">
                  Export this file to view its contents
                </p>
              </div>
            </div>
          </div>
        )}
        {/* Unsupported File Type */}
        {isUnsupported && !error && (
          <div className="text-center p-8 bg-vault-900 rounded-xl border border-vault-800 shadow-xl max-w-sm">
            <div className="w-16 h-16 bg-vault-800 rounded-full flex items-center justify-center mx-auto mb-4 text-vault-400">
              <Icons.Alert />
            </div>
            <h3 className="text-white font-bold mb-2">Preview Not Supported</h3>
            <p className="text-vault-400 text-sm mb-6">
              This file type cannot be previewed in the app.
            </p>
            <p className="text-xs text-vault-500 mb-4">
              File: {item.originalName}
              <br />
              Size: {FileTypeDetector.formatFileSize(item.size)}
              <br />
              Type: {item.mimeType}
            </p>
            {onOpenNative && (
              <button
                onClick={onOpenNative}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium text-sm mb-2"
              >
                Open with App
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg bg-vault-800 text-white hover:bg-vault-700 transition font-medium text-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
