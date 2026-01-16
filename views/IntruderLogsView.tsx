import React, { useEffect, useState } from "react";
import { Button, Icons } from "../components/UI";
import type { IntruderSession, VaultItem } from "../types";
import { SecureVault } from "../plugins/SecureVaultPlugin";

interface IntruderLogsProps {
  logs: IntruderSession[];
  onDelete: (timestamp: number) => void;
  onViewImage: (img: VaultItem) => void;
  onBack: () => void;
}

const EvidenceThumbnail: React.FC<{ item: VaultItem; onClick: () => void }> = ({
  item,
  onClick,
}) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { uri } = await SecureVault.previewFile({
          id: item.id,
          password: "",
        });
        if (active) setSrc(uri);
      } catch (e) {}
    };
    load();
    return () => {
      active = false;
    };
  }, [item.id]);

  return (
    <div
      onClick={onClick}
      className="relative aspect-[3/4] bg-vault-950 rounded-lg overflow-hidden border border-vault-800 cursor-pointer group hover:border-red-500/50 transition-all shadow-md active:scale-95"
    >
      {src ? (
        <>
          <img
            src={src}
            alt="Evidence"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
            <span className="text-[10px] font-bold text-white flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm border border-white/10">
              <Icons.Eye className="w-3 h-3" /> PREVIEW
            </span>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-vault-600 gap-2">
          <div className="animate-pulse">
            <Icons.Camera className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-mono">Loading...</span>
        </div>
      )}
    </div>
  );
};

export const IntruderLogsView: React.FC<IntruderLogsProps> = ({
  logs,
  onDelete,
  onViewImage,
  onBack,
}) => {
  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <header className="z-30 pt-safe flex-shrink-0 bg-vault-950/80 backdrop-blur-xl border-b border-vault-800 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 transition-colors"
            >
              <Icons.ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-bold text-lg text-white leading-none">
                Security Log
              </h2>
              <p className="text-[10px] text-vault-500 font-mono mt-1 tracking-wider uppercase">
                Intrusion Evidence
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full border text-xs font-bold font-mono tracking-tight ${
              logs.length > 0
                ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                : "bg-vault-800 border-vault-700 text-vault-500"
            }`}
          >
            {logs.length} EVENTS
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6 pb-safe">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-vault-600 space-y-4">
            <div className="w-24 h-24 rounded-full bg-vault-900 flex items-center justify-center border border-vault-800 shadow-inner">
              <Icons.Shield className="w-10 h-10 opacity-50" />
            </div>
            <div className="text-center">
              <h3 className="text-white font-medium text-lg">System Secure</h3>
              <p className="text-sm text-vault-500 mt-1">
                No unauthorized access attempts detected.
              </p>
            </div>
          </div>
        ) : (
          logs.map((session, index) => (
            <div
              key={session.id}
              className="relative pl-6 pb-6 last:pb-0 before:absolute before:left-[11px] before:top-8 before:bottom-0 before:w-px before:bg-vault-800 last:before:hidden animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Timeline Indicator */}
              <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-vault-900 border-2 border-red-500/50 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </div>

              {/* Card */}
              <div className="bg-vault-800 rounded-2xl border border-vault-700 overflow-hidden shadow-lg transition-all hover:border-vault-600">
                <div className="px-4 py-3 border-b border-vault-700/50 flex justify-between items-center bg-vault-850">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-red-400 text-sm tracking-wide flex items-center gap-1.5">
                        <Icons.Alert className="w-4 h-4" /> ACCESS DENIED
                      </h3>
                      <span className="px-1.5 py-0.5 rounded bg-vault-800 border border-vault-700 text-[10px] text-vault-400 font-mono">
                        #{logs.length - index}
                      </span>
                    </div>
                    <p className="text-xs text-vault-400 font-mono mt-1">
                      {new Date(session.timestamp).toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" }
                      )}{" "}
                      • {new Date(session.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(session.timestamp)}
                    className="w-8 h-8 flex items-center justify-center text-vault-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                    title="Delete Log"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 bg-black/20">
                  <div className="grid grid-cols-3 gap-2">
                    {session.images.map((img) => (
                      <EvidenceThumbnail
                        key={img.id}
                        item={img}
                        onClick={() => onViewImage(img)}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-vault-500 font-mono uppercase">
                      <Icons.Camera className="w-3 h-3" />
                      <span>Automated Capture</span>
                    </div>
                    <span className="text-[10px] text-vault-600 font-mono">
                      ID: {session.id.slice(-6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};