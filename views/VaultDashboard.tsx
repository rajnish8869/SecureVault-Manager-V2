import React, { useRef, useState } from "react";
import {
  Card,
  VaultList,
  FloatingActionButton,
  Icons,
  Button,
} from "../components/UI";
import type { VaultItem } from "../types";
import { DialogModal } from "../components/modals/DialogModal";
interface VaultHandle {
  items: VaultItem[];
  breadcrumbs: { id?: string; name: string }[];
  currentFolderId?: string;
  setCurrentFolderId: (id?: string) => void;
  createFolder: (name: string) => Promise<void>;
  importFile: (file: File) => Promise<any>;
  deleteItems: (ids: string[]) => Promise<void>;
  exportFile: (id: string) => Promise<any>;
  previewFile: (id: string) => Promise<any>;
  moveItems: (ids: string[], targetId?: string) => Promise<void>;
  copyItems: (ids: string[], targetId?: string) => Promise<void>;
}
export const VaultDashboard: React.FC<{
  vault: VaultHandle;
  isDecoy: boolean;
  onLock: () => void;
  onSettings: () => void;
  onPickStart: () => void;
  onView: (item: VaultItem) => void;
  onProcessing: (isLoading: boolean, status?: string) => void;
}> = ({
  vault,
  isDecoy,
  onLock,
  onSettings,
  onPickStart,
  onView,
  onProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{
    op: "MOVE" | "COPY";
    ids: string[];
  } | null>(null);
  const [menuItem, setMenuItem] = useState<VaultItem | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    variant?: "danger" | "info";
  }>({ isOpen: false, title: "", message: "", action: () => {} });
  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
    if (newSet.size === 0) setSelectionMode(false);
    else setSelectionMode(true);
  };
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };
  const handleBulkDelete = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Items?",
      message: `Permanently delete ${selectedIds.size} items? This cannot be undone.`,
      variant: "danger",
      action: async () => {
        onProcessing(true, "Deleting items...");
        try {
          await vault.deleteItems(Array.from(selectedIds));
          clearSelection();
        } catch (e) {
          alert("Delete failed");
        } finally {
          onProcessing(false);
        }
      },
    });
  };
  const handleBulkExport = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Export Files?",
      message: `Decrypt and export ${selectedIds.size} files to public storage?`,
      action: async () => {
        onProcessing(true, "Exporting files...");
        let count = 0;
        const ids = Array.from(selectedIds);
        try {
          for (let i = 0; i < ids.length; i++) {
            onProcessing(true, `Exporting ${i + 1}/${ids.length}`);
            try {
              await vault.exportFile(ids[i]);
              count++;
            } catch (e) {}
          }
          alert(`Exported ${count} files.`);
          clearSelection();
        } finally {
          onProcessing(false);
        }
      },
    });
  };
  const handleSingleDelete = () => {
    if (!menuItem) return;
    const id = menuItem.id;
    const name = menuItem.originalName;
    setMenuItem(null);
    setConfirmConfig({
      isOpen: true,
      title: "Delete Item?",
      message: `Permanently delete "${name}"?`,
      variant: "danger",
      action: async () => {
        onProcessing(true, "Deleting item...");
        try {
          await vault.deleteItems([id]);
        } catch (e) {
          alert("Delete failed");
        } finally {
          onProcessing(false);
        }
      },
    });
  };
  const handleSingleExport = async () => {
    if (!menuItem) return;
    const id = menuItem.id;
    setMenuItem(null);
    setConfirmConfig({
      isOpen: true,
      title: "Export File?",
      message: `Decrypt and export "${menuItem.originalName}"?`,
      action: async () => {
        onProcessing(true, "Decrypting & Exporting...");
        try {
          await vault.exportFile(id);
          alert("Exported successfully");
        } catch (e) {
          alert("Export failed");
        } finally {
          onProcessing(false);
        }
      },
    });
  };
  const handleCopy = () => {
    setClipboard({ op: "COPY", ids: Array.from(selectedIds) });
    clearSelection();
  };
  const handleMove = () => {
    setClipboard({ op: "MOVE", ids: Array.from(selectedIds) });
    clearSelection();
  };
  const handlePaste = async () => {
    if (!clipboard) return;
    onProcessing(
      true,
      clipboard.op === "MOVE" ? "Moving items..." : "Copying items..."
    );
    try {
      if (clipboard.op === "MOVE") {
        await vault.moveItems(clipboard.ids, vault.currentFolderId);
      } else {
        await vault.copyItems(clipboard.ids, vault.currentFolderId);
      }
      setClipboard(null);
    } catch (e) {
      alert("Operation failed");
    } finally {
      onProcessing(false);
    }
  };
  const handleImportInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    onPickStart();
    const files = Array.from(e.target.files);
    onProcessing(true, "Preparing import...");
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        onProcessing(
          true,
          `Encrypting & Importing...\n${f.name} (${i + 1}/${files.length})`
        );
        await vault.importFile(f);
      }
    } catch (e) {
      alert("Import failed: " + e);
    } finally {
      onProcessing(false);
      e.target.value = "";
    }
  };
  return (
    <div className="min-h-dvh bg-vault-950 flex flex-col">
      <header
        className={`sticky top-0 z-30 pt-safe backdrop-blur-xl border-b transition-colors flex flex-col shadow-sm ${
          isDecoy
            ? "bg-slate-900/90 border-slate-800"
            : "bg-vault-900/90 border-vault-800"
        }`}
      >
        {selectionMode ? (
          <div className="px-4 py-3 flex items-center justify-between bg-vault-800/50">
            <div className="flex items-center gap-4">
              <button
                onClick={clearSelection}
                className="p-2 -ml-2 rounded-full hover:bg-vault-700 transition-colors"
              >
                <Icons.X />
              </button>
              <span className="font-bold text-white">
                {selectedIds.size} Selected
              </span>
            </div>
            <button
              onClick={() => {
                const all = new Set(vault.items.map((i) => i.id));
                setSelectedIds(all);
              }}
              className="text-xs font-bold text-vault-accent hover:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-vault-800 transition-colors"
            >
              SELECT ALL
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {vault.breadcrumbs.length > 1 ? (
                <button
                  onClick={() =>
                    vault.setCurrentFolderId(
                      vault.breadcrumbs[vault.breadcrumbs.length - 2].id
                    )
                  }
                  className="p-1 -ml-1 text-vault-400 hover:text-white transition-colors"
                >
                  <Icons.ArrowLeft />
                </button>
              ) : (
                <div
                  className={`p-1 ${
                    isDecoy ? "text-slate-500" : "text-vault-accent"
                  }`}
                >
                  {vault.currentFolderId ? (
                    <Icons.FolderOpen />
                  ) : (
                    <Icons.Shield />
                  )}
                </div>
              )}
              <h2 className="font-bold text-lg truncate text-white">
                {vault.breadcrumbs[vault.breadcrumbs.length - 1].name}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {!isDecoy && (
                <button
                  onClick={onSettings}
                  className="p-2 text-vault-400 hover:text-white hover:bg-vault-800 rounded-full transition-colors"
                >
                  <Icons.Cog />
                </button>
              )}
              <button
                onClick={onLock}
                className="p-2 text-vault-400 hover:text-white hover:bg-vault-800 rounded-full transition-colors"
              >
                <Icons.Lock />
              </button>
            </div>
          </div>
        )}
        {clipboard && (
          <div className="bg-blue-600/90 backdrop-blur text-white py-2 px-4 text-xs font-medium flex justify-between items-center shadow-inner">
            <span className="truncate mr-2">
              {clipboard.ids.length} items to{" "}
              {clipboard.op === "MOVE" ? "Move" : "Copy"}
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setClipboard(null)}
                className="px-2 py-1 hover:bg-white/10 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePaste}
                className="px-3 py-1 bg-white text-blue-600 rounded shadow-sm font-bold hover:bg-blue-50 transition-colors"
              >
                Paste Here
              </button>
            </div>
          </div>
        )}
      </header>
      {/* Content */}
      <div className="px-4 pt-4 pb-32">
        <VaultList
          items={vault.items}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onNavigate={(folder) => vault.setCurrentFolderId(folder.id)}
          onView={onView}
          onMenu={setMenuItem}
        />
      </div>

      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-vault-900/95 backdrop-blur-xl border-t border-vault-800 pb-safe shadow-up animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-around items-center p-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex flex-col items-center gap-1 p-2 text-vault-400 hover:text-white hover:bg-vault-800 rounded-xl transition-all"
            >
              <Icons.Copy />{" "}
              <span className="text-[10px] font-medium">Copy</span>
            </button>
            <button
              onClick={handleMove}
              className="flex-1 flex flex-col items-center gap-1 p-2 text-vault-400 hover:text-white hover:bg-vault-800 rounded-xl transition-all"
            >
              <Icons.Move />{" "}
              <span className="text-[10px] font-medium">Move</span>
            </button>
            <button
              onClick={handleBulkExport}
              className="flex-1 flex flex-col items-center gap-1 p-2 text-vault-400 hover:text-white hover:bg-vault-800 rounded-xl transition-all"
            >
              <Icons.Download />{" "}
              <span className="text-[10px] font-medium">Export</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex-1 flex flex-col items-center gap-1 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
            >
              <Icons.Trash />{" "}
              <span className="text-[10px] font-medium">Delete</span>
            </button>
          </div>
        </div>
      )}
      {/* FAB & Menu (Normal Mode) */}
      {!selectionMode && (
        <>
          {showAddMenu && (
            <div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px] animate-in fade-in duration-200"
              onClick={() => setShowAddMenu(false)}
            />
          )}
          <div
            className={`fixed bottom-24 right-6 z-40 flex flex-col items-end gap-4 transition-all duration-300 ease-out pb-safe ${
              showAddMenu
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-8 scale-90 pointer-events-none"
            }`}
          >
            <div
              className="flex items-center gap-3 group cursor-pointer"
              onClick={() => {
                setShowFolderDialog(true);
                setShowAddMenu(false);
              }}
            >
              <span className="bg-white text-vault-900 text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                New Folder
              </span>
              <button className="w-14 h-14 rounded-full bg-vault-800 border border-vault-700 shadow-xl flex items-center justify-center text-yellow-500 hover:bg-vault-750 hover:scale-105 transition-all [&_svg]:!w-7 [&_svg]:!h-7">
                <Icons.Folder />
              </button>
            </div>
            <div
              className="flex items-center gap-3 group cursor-pointer"
              onClick={() => {
                onPickStart();
                fileInputRef.current?.click();
                setShowAddMenu(false);
              }}
            >
              <span className="bg-white text-vault-900 text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                Import Files
              </span>
              <button className="w-14 h-14 rounded-full bg-vault-800 border border-vault-700 shadow-xl flex items-center justify-center text-blue-500 hover:bg-vault-750 hover:scale-105 transition-all [&_svg]:!w-7 [&_svg]:!h-7">
                <Icons.File />
              </button>
            </div>
          </div>
          <FloatingActionButton
            onClick={() => setShowAddMenu(!showAddMenu)}
            isOpen={showAddMenu}
          />
        </>
      )}
      {/* Action Sheet Menu */}
      {menuItem && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="relative bg-vault-900 rounded-t-3xl border-t border-vault-700 p-4 space-y-2 pb-safe shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-vault-700 rounded-full mx-auto mb-4 opacity-50" />
            <div className="flex items-center gap-4 p-2 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-vault-800 flex items-center justify-center text-vault-400 border border-vault-700/50 shadow-sm shrink-0">
                {menuItem.type === "FOLDER" ? <Icons.Folder /> : <Icons.File />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white truncate text-lg leading-tight">
                  {menuItem.originalName}
                </h3>
                <p className="text-xs text-vault-500 mt-1 font-mono">
                  {new Date(menuItem.importedAt).toLocaleDateString()} •{" "}
                  {(menuItem.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {menuItem.type === "FILE" && (
                <button
                  onClick={handleSingleExport}
                  className="w-full p-4 rounded-2xl bg-vault-800 hover:bg-vault-750 flex items-center gap-4 text-white font-medium transition-all active:scale-[0.98]"
                >
                  <div className="p-2 bg-vault-700/50 rounded-full">
                    <Icons.Download />
                  </div>
                  Export to Device
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setClipboard({ op: "COPY", ids: [menuItem.id] });
                    setMenuItem(null);
                  }}
                  className="flex-1 p-4 rounded-2xl bg-vault-800 hover:bg-vault-750 flex flex-col items-center gap-2 text-white font-medium transition-all active:scale-[0.98]"
                >
                  <Icons.Copy /> <span className="text-xs">Copy</span>
                </button>
                <button
                  onClick={() => {
                    setClipboard({ op: "MOVE", ids: [menuItem.id] });
                    setMenuItem(null);
                  }}
                  className="flex-1 p-4 rounded-2xl bg-vault-800 hover:bg-vault-750 flex flex-col items-center gap-2 text-white font-medium transition-all active:scale-[0.98]"
                >
                  <Icons.Move /> <span className="text-xs">Move</span>
                </button>
              </div>
              <button
                onClick={handleSingleDelete}
                className="w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/10 flex items-center gap-4 text-red-400 font-medium transition-all active:scale-[0.98]"
              >
                <div className="p-2 bg-red-500/20 rounded-full">
                  <Icons.Trash />
                </div>
                Delete Permanently
              </button>
              <button
                onClick={() => setMenuItem(null)}
                className="w-full p-4 rounded-2xl bg-transparent hover:bg-vault-800 text-vault-400 font-medium mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleImportInput}
        className="hidden"
      />
      <DialogModal
        isOpen={showFolderDialog}
        type="PROMPT"
        title="New Folder"
        message="Enter folder name"
        inputProps={{ placeholder: "Folder Name" }}
        onConfirm={(name) => {
          if (name) vault.createFolder(name);
          setShowFolderDialog(false);
        }}
        onCancel={() => setShowFolderDialog(false)}
      />
      <DialogModal
        isOpen={confirmConfig.isOpen}
        type="CONFIRM"
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        onConfirm={() => {
          confirmConfig.action();
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() =>
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
};
