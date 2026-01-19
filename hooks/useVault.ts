import { useState, useCallback, useMemo } from "react";
import { SecureVault } from "../plugins/SecureVaultPlugin";
import type { VaultItem } from "../types";
export const useVault = (password: string | null) => {
  const [allItems, setAllItems] = useState<VaultItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    undefined
  );
  const items = useMemo(() => {
    return allItems.filter((i) => i.parentId === currentFolderId);
  }, [allItems, currentFolderId]);
  const breadcrumbs = useMemo(() => {
    const path: { id?: string; name: string }[] = [
      { id: undefined, name: "Home" },
    ];
    let curr = currentFolderId;
    const stack = [];
    while (curr) {
      const folder = allItems.find((i) => i.id === curr);
      if (folder) {
        stack.unshift({ id: folder.id, name: folder.originalName });
        curr = folder.parentId;
      } else {
        break;
      }
    }
    return [...path, ...stack];
  }, [allItems, currentFolderId]);
  const loadFiles = useCallback(async () => {
    if (!password) return;
    try {
      const files = await SecureVault.getVaultFiles();
      setAllItems(files);
    } catch (e) {}
  }, [password]);
  const createFolder = async (name: string) => {
    const newFolder = await SecureVault.createFolder({
      name,
      parentId: currentFolderId,
    });
    setAllItems((prev) => [newFolder, ...prev]);
  };
  const importFile = async (file: File) => {
    if (!password) throw new Error("No session");
    const newItem = await SecureVault.importFile({
      fileBlob: file,
      fileName: file.name,
      password,
      parentId: currentFolderId,
    });
    setAllItems((prev) => [newItem, ...prev]);
    return newItem;
  };
  const deleteItems = async (ids: string[]) => {
    await SecureVault.deleteVaultItems({ ids });
    setAllItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    loadFiles();
  };
  const exportFile = async (id: string) => {
    if (!password) throw new Error("No session");
    return await SecureVault.exportFile({ id, password });
  };
  // Modified previewFile to be optional for streaming
  const previewFile = async (id: string) => {
    if (!password) throw new Error("No session");
    await SecureVault.enablePrivacyScreen({ enabled: true });
    return await SecureVault.previewFile({ id, password });
  };
  const moveItems = async (ids: string[], targetId?: string) => {
    await SecureVault.moveItems({ itemIds: ids, targetParentId: targetId });
    loadFiles();
  };
  const copyItems = async (ids: string[], targetId?: string) => {
    if (!password) return;
    await SecureVault.copyItems({
      itemIds: ids,
      targetParentId: targetId,
      password,
    });
    loadFiles();
  };
  return {
    items,
    breadcrumbs,
    currentFolderId,
    setCurrentFolderId,
    loadFiles,
    importFile,
    createFolder,
    deleteItems,
    exportFile,
    previewFile,
    moveItems,
    copyItems,
  };
};