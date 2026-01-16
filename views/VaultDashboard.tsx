import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
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
  importFile: (file: File) => Promise<VaultItem>;
  deleteItems: (ids: string[]) => Promise<void>;
  exportFile: (id: string) => Promise<any>;
  previewFile: (id: string) => Promise<any>;
  moveItems: (ids: string[], targetId?: string) => Promise<void>;
  copyItems: (ids: string[], targetId?: string) => Promise<void>;
}

export interface VaultDashboardHandle {
  handleBack: () => boolean;
}

interface VaultDashboardProps {
  vault: VaultHandle;
  isDecoy: boolean;
  onLock: () => void;
  onSettings: () => void;
  onPickStart: () => void;
  onView: (item: VaultItem) => void;
  onProcessing: (isLoading: boolean, status?: string) => void;
}

export const VaultDashboard = forwardRef<VaultDashboardHandle, VaultDashboardProps>(({
  vault,
  isDecoy,
  onLock,
  onSettings,
  onPickStart,
  onView,
  onProcessing,
}, ref) => {
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
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('LIST');
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    variant?: "danger" | "info" | "success";
    type?: "ALERT" | "CONFIRM";
  }>({ isOpen: false, title: "", message: "", action: () => {} });

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      // Priority 1: Close Item Menu
      if (menuItem) {
        setMenuItem(null);
        return true;
      }
      // Priority 2: Close Add Menu (FAB)
      if (showAddMenu) {
        setShowAddMenu(false);
        return true;
      }
      // Priority 3: Close Local Dialogs
      if (showFolderDialog) {
        setShowFolderDialog(false);
        return true;
      }
      if (confirmConfig.isOpen) {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        return true;
      }
      // Priority 4: Exit Selection Mode
      if (selectionMode) {
        clearSelection();
        return true;
      }
      // Priority 5: Navigate Up Folder
      if (vault.breadcrumbs.length > 1) {
        // [Home, Folder A, Folder B] -> Go to Folder A (index 1, length-2)
        vault.setCurrentFolderId(
          vault.breadcrumbs[vault.breadcrumbs.length - 2].id
        );
        return true;
      }
      return false;
    }
  }), [menuItem, showAddMenu, showFolderDialog, confirmConfig.isOpen, selectionMode, vault.breadcrumbs, vault.setCurrentFolderId]);

  const showAlert = (title: string, message: string, variant: "info" | "danger" | "success" = "info") => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      variant,
      type: "ALERT",
      action: () => {}
    });
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
    if (newSet.size === 0) setSelectionMode(false);
    else setSelectionMode(true);
  };

  const handleBulkDelete = () => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Items?",
      message: `Permanently delete ${selectedIds.size} items? This cannot be undone.`,
      variant: "danger",
      type: "CONFIRM",
      action: async () => {
        onProcessing(true, "Deleting items...");
        try {
          await vault.deleteItems(Array.from(selectedIds));
          clearSelection();
        } catch (e) {
          showAlert("Error", "Delete failed", "danger");
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
      type: "CONFIRM",
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
          showAlert("Export Complete", `Exported ${count} files.`, "success");
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
      type: "CONFIRM",
      action: async () => {
        onProcessing(true, "Deleting item...");
        try {
          await vault.deleteItems([id]);
        } catch (e) {
          showAlert("Error", "Delete failed", "danger");
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
      type: "CONFIRM",
      action: async () => {
        onProcessing(true, "Decrypting & Exporting...");
        try {
          await vault.exportFile(id);
          showAlert("Success", "Exported successfully", "success");
        } catch (e) {
          showAlert("Error", "Export failed", "danger");
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
      showAlert("Error", "Operation failed", "danger");
    } finally {
      onProcessing(false);
    }
  };

  const handleImportInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    onPickStart();
    const files = Array.from(e.target.files || []) as File[];
    
    // Clear input immediately to ensure `onChange` fires again for same files
    e.target.value = "";

    let successCount = 0;
    let failCount = 0;
    const failedNames: string[] = [];

    onProcessing(true, "Initializing Import...");
    
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        onProcessing(
          true,
          `Encrypting & Importing...\n${f.name} (${i + 1}/${files.length})`
        );
        try {
            const item = await vault.importFile(f);
            if(item) successCount++;
        } catch (err: any) {
            console.error("Import error", err);
            failCount++;
            failedNames.push(f.name);
        }
      }
    } catch (err: any) {
      showAlert("Import Error", "Critical Import Error: " + err, "danger");
    } finally {
      onProcessing(false);
      
      // Determine Result Status
      const hasSuccess = successCount > 0;
      const hasFailures = failCount > 0;
      
      let message = "";
      if (hasSuccess) {
          message += `Successfully encrypted ${successCount} file(s) into the Vault.`;
          // Explicit Deletion Notice for Security
          message += `\n\n⚠️ SECURITY NOTICE:\nThe original files still exist in your device gallery/storage.\n\nAndroid security restrictions prevent automatic deletion of original files. Please delete them manually to complete the securing process.`;
      }
      if (hasFailures) {
          message += `\n\nFailed to import ${failCount} file(s):\n${failedNames.slice(0,3).join('\n')}${failedNames.length > 3 ? '\n...' : ''}`;
      }

      if (hasSuccess || hasFailures) {
          setConfirmConfig({
              isOpen: true,
              title: hasSuccess ? (hasFailures ? "Import Completed with Errors" : "Import Successful") : "Import Failed",
              message: message,
              variant: hasSuccess ? "success" : "danger",
              type: "ALERT",
              action: () => {}, // Just dismiss
          });
      }
    }
  };

  return (
    <div className="h-dvh w-full bg-vault-950 flex flex-col font-sans overflow-hidden relative">
      {/* 
        HEADER SECTION 
        Sticky to top, includes safe area padding
      */}
      <header
        className={`z-30 pt-safe flex flex-col shrink-0 border-b shadow-sm transition-colors duration-200 ${
          isDecoy
            ? "bg-slate-900/95 border-slate-800"
            : "bg-vault-900/95 border-vault-800"
        } backdrop-blur-md`}
      >
        {selectionMode ? (
          /* SELECTION MODE HEADER */
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 animate-fade-in">
              <button
                onClick={clearSelection}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-vault-800 active:bg-vault-700 transition-colors"
              >
                <Icons.X className="w-5 h-5 text-vault-400" />
              </button>
              <span className="font-semibold text-white text-lg">
                {selectedIds.size} Selected
              </span>
            </div>
            <button
              onClick={() => {
                const all = new Set(vault.items.map((i) => i.id));
                setSelectedIds(all);
              }}
              className="text-xs font-bold text-vault-accent hover:text-white px-3 py-1.5 rounded-lg hover:bg-vault-800 transition-colors tracking-wide"
            >
              SELECT ALL
            </button>
          </div>
        ) : (
          /* STANDARD HEADER */
          <div className="px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {vault.breadcrumbs.length > 1 ? (
                <button
                  onClick={() =>
                    vault.setCurrentFolderId(
                      vault.breadcrumbs[vault.breadcrumbs.length - 2].id
                    )
                  }
                  className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-vault-800 active:bg-vault-700 transition-colors text-vault-400 hover:text-white"
                >
                  <Icons.ArrowLeft className="w-6 h-6" />
                </button>
              ) : (
                <div
                  className={`w-10 h-10 -ml-2 flex items-center justify-center ${
                    isDecoy ? "text-slate-500" : "text-vault-accent"
                  }`}
                >
                  {vault.currentFolderId ? (
                    <Icons.FolderOpen className="w-6 h-6" />
                  ) : (
                    <Icons.Shield className="w-7 h-7" />
                  )}
                </div>
              )}
              <h2 className="font-bold text-lg truncate text-white tracking-tight">
                {vault.breadcrumbs[vault.breadcrumbs.length - 1].name}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode(prev => prev === 'LIST' ? 'GRID' : 'LIST')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 transition-colors"
              >
                {viewMode === 'LIST' ? <Icons.LayoutGrid className="w-6 h-6" /> : <Icons.LayoutList className="w-6 h-6" />}
              </button>
              {!isDecoy && (
                <button
                  onClick={onSettings}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 transition-colors"
                >
                  <Icons.Cog className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={onLock}
                className="w-10 h-10 rounded-full flex items-center justify-center text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 transition-colors"
              >
                <Icons.Lock className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* CLIPBOARD BANNER */}
        {clipboard && (
          <div className="bg-blue-600/95 backdrop-blur-sm text-white px-4 py-2 text-xs font-medium flex justify-between items-center shadow-inner animate-slide-up">
            <span className="truncate mr-2 flex items-center gap-2">
              <Icons.Copy className="w-3 h-3" />
              {clipboard.ids.length} items to{" "}
              {clipboard.op === "MOVE" ? "Move" : "Copy"}
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setClipboard(null)}
                className="px-3 py-1.5 hover:bg-white/10 rounded-md transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handlePaste}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-md shadow-sm font-bold hover:bg-blue-50 transition-colors"
              >
                Paste Here
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 
        MAIN CONTENT AREA 
        Scrollable, respects safe areas via padding-bottom
      */}
      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-safe" style={{ scrollPaddingBottom: '100px' }}>
        {/* Extra padding at bottom to clear FABs/Navigation bars */}
        <div className="pb-24">
            <VaultList
            items={vault.items}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelect={handleSelect}
            onNavigate={(folder) => vault.setCurrentFolderId(folder.id)}
            onView={onView}
            onMenu={setMenuItem}
            viewMode={viewMode}
            />
        </div>
      </div>

      {/* 
        FOOTER / ACTION SHEET (Selection Mode)
        Fixed bottom with safe area padding
      */}
      {selectionMode && (
        <div className="absolute bottom-0 left-0 right-0 z-40 bg-vault-900/95 backdrop-blur-xl border-t border-vault-800 pb-safe shadow-up animate-slide-up">
          <div className="flex justify-around items-center p-2">
            <button
              onClick={handleCopy}
              className="flex-1 flex flex-col items-center gap-1 p-3 text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 rounded-xl transition-all"
            >
              <Icons.Copy className="w-6 h-6" />
              <span className="text-[10px] font-medium">Copy</span>
            </button>
            <button
              onClick={handleMove}
              className="flex-1 flex flex-col items-center gap-1 p-3 text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 rounded-xl transition-all"
            >
              <Icons.Move className="w-6 h-6" />
              <span className="text-[10px] font-medium">Move</span>
            </button>
            <button
              onClick={handleBulkExport}
              className="flex-1 flex flex-col items-center gap-1 p-3 text-vault-400 hover:text-white hover:bg-vault-800 active:bg-vault-700 rounded-xl transition-all"
            >
              <Icons.Download className="w-6 h-6" />
              <span className="text-[10px] font-medium">Export</span>
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex-1 flex flex-col items-center gap-1 p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 rounded-xl transition-all"
            >
              <Icons.Trash className="w-6 h-6" />
              <span className="text-[10px] font-medium">Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        FAB & MENU (Normal Mode)
        Fixed bottom-right with safe area margin
      */}
      {!selectionMode && (
        <>
          {showAddMenu && (
            <div
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-[2px] animate-fade-in"
              onClick={() => setShowAddMenu(false)}
            />
          )}
          <div
            className={`absolute bottom-6 right-6 z-40 flex flex-col items-end gap-4 transition-all duration-300 ease-out mb-safe ${
              showAddMenu
                ? "opacity-100 translate-y-[-70px] scale-100"
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
              <button className="w-14 h-14 rounded-full bg-vault-800 border border-vault-700 shadow-xl flex items-center justify-center text-yellow-500 hover:bg-vault-750 active:scale-95 transition-all">
                <Icons.Folder className="w-7 h-7" />
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
              <button className="w-14 h-14 rounded-full bg-vault-800 border border-vault-700 shadow-xl flex items-center justify-center text-blue-500 hover:bg-vault-750 active:scale-95 transition-all">
                <Icons.File className="w-7 h-7" />
              </button>
            </div>
          </div>
          <FloatingActionButton
            onClick={() => setShowAddMenu(!showAddMenu)}
            isOpen={showAddMenu}
          />
        </>
      )}

      {/* ACTION SHEET MENU (Single Item) */}
      {menuItem && (
        <>
            <div className="absolute inset-0 bg-black/60 z-50 animate-fade-in backdrop-blur-sm" onClick={() => setMenuItem(null)} />
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-vault-900 rounded-t-3xl border-t border-vault-700 p-4 space-y-2 pb-safe shadow-2xl animate-slide-up">
                <div className="w-12 h-1.5 bg-vault-700 rounded-full mx-auto mb-4 opacity-50" />
                <div className="flex items-center gap-4 p-2 mb-4 bg-vault-850 rounded-2xl border border-vault-800">
                <div className="w-12 h-12 rounded-xl bg-vault-800 flex items-center justify-center text-vault-400 border border-vault-700/50 shadow-sm shrink-0">
                    {menuItem.type === "FOLDER" ? <Icons.Folder className="w-6 h-6" /> : <Icons.File className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                    <h3 className="font-bold text-white truncate text-base leading-tight">
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
                    className="w-full p-4 rounded-xl bg-vault-800 hover:bg-vault-750 active:bg-vault-700 flex items-center gap-4 text-white font-medium transition-all"
                    >
                    <div className="p-2 bg-vault-700/50 rounded-full">
                        <Icons.Download className="w-5 h-5" />
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
                    className="flex-1 p-4 rounded-xl bg-vault-800 hover:bg-vault-750 active:bg-vault-700 flex flex-col items-center gap-2 text-white font-medium transition-all"
                    >
                    <Icons.Copy className="w-6 h-6" /> <span className="text-xs">Copy</span>
                    </button>
                    <button
                    onClick={() => {
                        setClipboard({ op: "MOVE", ids: [menuItem.id] });
                        setMenuItem(null);
                    }}
                    className="flex-1 p-4 rounded-xl bg-vault-800 hover:bg-vault-750 active:bg-vault-700 flex flex-col items-center gap-2 text-white font-medium transition-all"
                    >
                    <Icons.Move className="w-6 h-6" /> <span className="text-xs">Move</span>
                    </button>
                </div>
                <button
                    onClick={handleSingleDelete}
                    className="w-full p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 border border-red-500/10 flex items-center gap-4 text-red-400 font-medium transition-all mt-2"
                >
                    <div className="p-2 bg-red-500/20 rounded-full">
                    <Icons.Trash className="w-5 h-5" />
                    </div>
                    Delete Permanently
                </button>
                <button
                    onClick={() => setMenuItem(null)}
                    className="w-full p-4 rounded-xl bg-transparent hover:bg-vault-800 active:bg-vault-750 text-vault-400 font-medium"
                >
                    Cancel
                </button>
                </div>
            </div>
        </>
      )}

      {/* HIDDEN INPUT & MODALS */}
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
        type={confirmConfig.type || (confirmConfig.variant === 'success' ? 'ALERT' : 'CONFIRM')}
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
});