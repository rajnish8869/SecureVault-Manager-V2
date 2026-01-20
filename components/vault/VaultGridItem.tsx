import React, { useState, useEffect, useCallback } from "react";
import type { VaultItem } from "../../types";
import { Icons, getFileIcon } from "../icons/Icons";
import { useLongPress } from "../../hooks/useLongPress";
import { SecureVault } from "../../plugins/SecureVaultPlugin";
import { Thumbnail } from "../../plugins/ThumbnailPlugin";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface VaultGridItemProps {
  item: VaultItem;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
}

export const VaultGridItem: React.FC<VaultGridItemProps> = ({
  item,
  selectionMode,
  isSelected,
  onSelect,
  onNavigate,
  onView,
  onMenu,
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const isImage = item.mimeType.startsWith("image/");
  const isVideo =
    item.mimeType.startsWith("video/") ||
    item.originalName.endsWith(".mp4") ||
    item.originalName.endsWith(".mkv");
  const isApk =
    item.mimeType === "application/vnd.android.package-archive" ||
    item.originalName.endsWith(".apk");
  const isThumbnailable = isImage || isVideo || isApk;

  useEffect(() => {
    if (!isThumbnailable || item.type === "FOLDER") {
      setThumbnail(null);
      return;
    }

    let active = true;

    const generateVideoPoster = (videoSrc: string, w = 112, h = 112) => {
      return new Promise<string>((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = videoSrc;
        video.muted = true;
        video.playsInline = true;
        const cleanup = () => {
          video.pause();
          video.src = "";
        };

        const handleSeek = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No canvas context");
            ctx.drawImage(video, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/png");
            cleanup();
            resolve(dataUrl);
          } catch (err) {
            cleanup();
            reject(err);
          }
        };

        video.addEventListener("loadeddata", () => {
          try {
            if (video.duration > 0.5) video.currentTime = 0.5;
            else video.currentTime = 0;
          } catch (e) {
            setTimeout(() => handleSeek(), 250);
          }
        });

        video.addEventListener("seeked", handleSeek);
        video.addEventListener("error", (e) => reject(e));
      });
    };

    const loadThumbnail = async () => {
      try {
        const res = (await SecureVault.previewFile({
          id: item.id,
          password: "",
        })) as any;
        const uri = res.uri;
        const nativeUri = res.nativeUri;
        if (!active) return;

        if (isImage) {
          const webUri =
            Capacitor.isNativePlatform() && (Capacitor as any).convertFileSrc
              ? (Capacitor as any).convertFileSrc(uri)
              : uri;
          setThumbnail(webUri);
          return;
        }

        if (isVideo) {
          if (Capacitor.isNativePlatform()) {
            try {
              const res = await Thumbnail.getThumbnail({
                path: nativeUri || uri,
                type: "video",
                width: 112,
                height: 112,
              });
              if (active && res?.base64) {
                setThumbnail(res.base64);
                return;
              }
            } catch (e) {
              // fallthrough
            }
          }

          try {
            const webUri =
              Capacitor.isNativePlatform() && (Capacitor as any).convertFileSrc
                ? (Capacitor as any).convertFileSrc(uri)
                : uri;
            const poster = await generateVideoPoster(webUri, 112, 112);
            if (active) setThumbnail(poster);
            return;
          } catch (err) {
            console.warn("Video poster capture failed", err);
          }
        }

        if (isApk) {
          if (Capacitor.isNativePlatform()) {
            try {
              const res = await Thumbnail.getThumbnail({
                path: uri,
                type: "apk",
                width: 112,
                height: 112,
              });
              if (active && res?.base64) {
                setThumbnail(res.base64);
                return;
              }
            } catch (e) {
              console.warn("APK thumbnail native extraction failed", e);
            }
          }
        }

        if (active) setThumbnail(null);
      } catch (e) {
        console.warn("Failed to load thumbnail for", item.id, e);
        if (active) setThumbnail(null);
      }
    };

    loadThumbnail();
    return () => {
      active = false;
    };
  }, [item.id, isThumbnailable, item.type, isImage, isVideo, isApk]);

  const handlePress = useCallback((e: any) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (selectionMode) {
      onSelect(item.id);
    } else {
      if (item.type === "FOLDER") onNavigate(item);
      else onView(item);
    }
  }, [selectionMode, item, onSelect, onNavigate, onView]);

  const handleLongPress = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
    onSelect(item.id);
  }, [onSelect, item.id]);

  const longPressProps = useLongPress(handleLongPress, handlePress, {
    delay: 400,
  });

  return (
    <div
      {...longPressProps}
      className={`
        relative flex flex-col items-center p-3 rounded-2xl transition-all duration-200 border aspect-square justify-between select-none touch-pan-y
        ${
          isSelected
            ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            : "bg-vault-800 border-vault-700 hover:border-vault-600 active:scale-[0.98]"
        }
      `}
    >
      {/* Icon Area */}
      <div className="flex-1 flex items-center justify-center w-full relative pointer-events-none">
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all overflow-hidden
            ${item.type === "FOLDER" ? "text-yellow-500" : "text-vault-400"}
        `}
        >
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={item.originalName}
              className="w-full h-full object-cover"
            />
          ) : (
            getFileIcon(item.mimeType, item.originalName)
          )}
        </div>

        {/* Selection Checkmark Overlay */}
        {selectionMode && (
          <div
            className={`
                absolute top-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-vault-800 transition-all
                ${
                  isSelected
                    ? "bg-blue-500 text-white scale-100"
                    : "bg-vault-600 text-transparent scale-90"
                }
            `}
          >
            <Icons.Check className="w-3.5 h-3.5 stroke-[4]" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="w-full text-center mt-2 pointer-events-none">
        <h4
          className={`text-xs font-semibold truncate leading-tight w-full ${
            isSelected ? "text-blue-400" : "text-slate-200"
          }`}
        >
          {item.originalName}
        </h4>
        <div className="flex items-center justify-center gap-1 mt-1 opacity-70">
          <span className="text-[9px] text-vault-500 font-mono truncate">
            {item.type === "FOLDER"
              ? "Folder"
              : `${(item.size / 1024 / 1024).toFixed(1)} MB`}
          </span>
        </div>
      </div>

      {/* Menu Button (Only non-selection mode) - Floating top right */}
      {!selectionMode && (
        <button
          className="absolute top-1 right-1 w-8 h-8 flex items-center justify-center rounded-full text-vault-500 hover:text-white hover:bg-vault-700/50 active:bg-vault-700 transition-colors pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(item);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <Icons.MoreVertical className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};