import React, { useState, useEffect } from "react";
import type { VaultItem } from "../../types";
import { Icons, getFileIcon } from "../icons/Icons";
import { useLongPress } from "../../hooks/useLongPress";
import { SecureVault } from "../../plugins/SecureVaultPlugin";
import { Thumbnail } from "../../plugins/ThumbnailPlugin";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface VaultListItemProps {
  item: VaultItem;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onNavigate: (folder: VaultItem) => void;
  onView: (item: VaultItem) => void;
  onMenu: (item: VaultItem) => void;
}

export const VaultListItem: React.FC<VaultListItemProps> = ({
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

    const generateVideoPoster = (videoSrc: string, w = 96, h = 96) => {
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
        // previewFile returns a web-safe `uri` and may include `nativeUri` for native plugins
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
                width: 96,
                height: 96,
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
            const poster = await generateVideoPoster(webUri, 96, 96);
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
                path: nativeUri || uri,
                type: "apk",
                width: 96,
                height: 96,
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

  const handlePress = (e: any) => {
    // Prevent default to avoid ghost clicks or double firing if needed,
    // though usually handled by hook logic.
    if (selectionMode) {
      onSelect(item.id);
    } else {
      if (item.type === "FOLDER") onNavigate(item);
      else onView(item);
    }
  };

  const handleLongPress = async () => {
    if (!selectionMode) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {}
      onSelect(item.id);
    }
  };

  const longPressProps = useLongPress(handleLongPress, handlePress, {
    delay: 400,
  });

  return (
    <div
      {...longPressProps}
      className={`
        relative flex items-center p-3 mb-2 rounded-2xl transition-all duration-200 border select-none touch-pan-y
        ${
          isSelected
            ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            : "bg-vault-800 border-vault-700 hover:border-vault-600 active:scale-[0.98]"
        }
      `}
    >
      {/* Icon Area */}
      <div className="shrink-0 relative pointer-events-none">
        <div
          className={`
            w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all overflow-hidden
            ${
              item.type === "FOLDER"
                ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                : "bg-vault-900 text-vault-400 border border-vault-800"
            }
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
                absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-vault-800 transition-all
                ${
                  isSelected
                    ? "bg-blue-500 text-white scale-100"
                    : "bg-vault-600 text-transparent scale-90"
                }
            `}
          >
            <Icons.Check className="w-3 h-3 stroke-[4]" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0 px-4 pointer-events-none">
        <h4
          className={`text-sm font-semibold truncate leading-tight ${
            isSelected ? "text-blue-400" : "text-slate-200"
          }`}
        >
          {item.originalName}
        </h4>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-bold text-vault-500 bg-vault-900 px-1.5 py-0.5 rounded border border-vault-800/50">
            {item.type === "FOLDER"
              ? "DIR"
              : item.originalName.split(".").pop()?.toUpperCase().slice(0, 4) ||
                "FILE"}
          </span>
          <span className="text-xs text-vault-500 font-mono truncate">
            {item.type === "FOLDER"
              ? "Folder"
              : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
          </span>
        </div>
      </div>

      {/* Menu Button (Only non-selection mode) */}
      {!selectionMode && (
        <button
          className="w-10 h-10 flex items-center justify-center rounded-full text-vault-500 hover:text-white hover:bg-vault-700/50 active:bg-vault-700 transition-colors pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(item);
          }}
          // Prevent event bubbling for long press logic
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <Icons.MoreVertical className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};