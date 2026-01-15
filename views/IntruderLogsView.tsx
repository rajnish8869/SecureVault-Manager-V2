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
      className="relative aspect-[3/4] bg-vault-950 rounded-lg overflow-hidden border border-vault-800 cursor-pointer group hover:border-red-500/50 transition-all shadow-md"
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
              <Icons.Eye /> PREVIEW
            </span>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-vault-600 gap-2">
          <div className="animate-pulse">
            <Icons.Camera />
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
    <div className="animate-in fade-in slide-in-from-right-8 duration-300 min-h-dvh bg-vault-950 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-vault-950/80 backdrop-blur-xl border-b border-vault-800 pt-safe px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-full text-vault-400 hover:text-white hover:bg-vault-800 transition-colors"
          >
            <Icons.ArrowLeft />
          </button>
          <div>
            <h2 className="font-bold text-lg text-white leading-none">
              Security Log
            </h2>
            <p className="text-[10px] text-vault-500 font-mono mt-1 tracking-wider">
              INTRUSION EVIDENCE
            </p>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full border text-xs font-bold font-mono ${
            logs.length > 0
              ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
              : "bg-vault-800 border-vault-700 text-vault-500"
          }`}
        >
          {logs.length} EVENTS
        </div>
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto pb-safe">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-vault-600 space-y-4">
            <div className="w-24 h-24 rounded-full bg-vault-900 flex items-center justify-center border border-vault-800">
              <Icons.Shield />
            </div>
            <div className="text-center">
              <h3 className="text-white font-medium">System Secure</h3>
              <p className="text-sm text-vault-500 mt-1">
                No unauthorized access attempts detected.
              </p>
            </div>
          </div>
        ) : (
          logs.map((session, index) => (
            <div
              key={session.id}
              className="relative pl-6 pb-6 last:pb-0 before:absolute before:left-[11px] before:top-8 before:bottom-0 before:w-px before:bg-vault-800 last:before:hidden"
            >
              <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-vault-900 border-2 border-red-500/50 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </div>
              <div className="bg-vault-800/50 rounded-2xl border border-vault-700 overflow-hidden shadow-lg transition-all hover:border-vault-600">
                <div className="px-4 py-3 border-b border-vault-700/50 flex justify-between items-center bg-vault-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-red-400 text-sm tracking-wide">
                        ACCESS DENIED
                      </h3>
                      <span className="px-1.5 py-0.5 rounded bg-vault-700 text-[10px] text-vault-300 font-mono">
                        #{logs.length - index}
                      </span>
                    </div>
                    <p className="text-xs text-vault-400 font-mono mt-0.5">
                      {new Date(session.timestamp).toLocaleDateString(
                        undefined,
                        { weekday: "short", month: "short", day: "numeric" }
                      )}{" "}
                      • {new Date(session.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(session.timestamp)}
                    className="p-2 text-vault-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Log"
                  >
                    <Icons.Trash />
                  </button>
                </div>
                <div className="p-4 bg-black/20">
                  <div className="grid grid-cols-3 gap-3">
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
                      <Icons.Camera />
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
