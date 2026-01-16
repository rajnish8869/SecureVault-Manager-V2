import type {
  EncryptionPlugin,
  VaultItem,
  LockType,
  IntruderSession,
  IntruderSettings,
} from "../types";
import { CryptoService } from "../services/CryptoService";
import { StorageService } from "../services/StorageService";
import { AuthService } from "../services/AuthService";
import { CameraService } from "../services/CameraService";
import { ChunkedFileService } from "../services/ChunkedFileService";
import { Capacitor } from "@capacitor/core";
class SecureVaultFacade implements EncryptionPlugin {
  private currentKey: CryptoKey | null = null;
  private currentMode: "REAL" | "DECOY" = "REAL";
  private sessionActive = false;
  private vaultCache: VaultItem[] = [];
  private generateUUID(): string {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
  async isInitialized(): Promise<{ initialized: boolean }> {
    const initialized = await AuthService.isInitialized();
    return { initialized };
  }
  async initializeVault(options: {
    password: string;
    type: LockType;
  }): Promise<{ success: boolean }> {
    await StorageService.initDirectory();
    const { salt } = await AuthService.initializeVault(
      options.password,
      options.type
    );
    const key = await CryptoService.deriveKey(options.password, salt);
    await StorageService.saveMetadata("REAL", [], key);
    return { success: true };
  }
  async getLockType(): Promise<{ type: LockType }> {
    const type = await AuthService.getLockType();
    return { type };
  }
  async unlockVault(
    password: string
  ): Promise<{ success: boolean; mode: "REAL" | "DECOY" }> {
    const result = await AuthService.verifyCredentials(password);
    if (!result.success || !result.salt || !result.mode) {
      throw new Error("Invalid Credentials");
    }
    this.currentMode = result.mode;
    this.currentKey = await CryptoService.deriveKey(password, result.salt);
    this.sessionActive = true;
    this.vaultCache = await StorageService.loadMetadata(
      this.currentMode,
      this.currentKey
    );
    this.vaultCache = this.vaultCache.map((i) => ({
      ...i,
      type: i.type || "FILE",
      parentId: i.parentId || undefined,
    }));
    return { success: true, mode: this.currentMode };
  }
  async lockVault(): Promise<void> {
    this.currentKey = null;
    this.sessionActive = false;
    this.vaultCache = [];
  }
  async importFile(options: {
    fileBlob: Blob;
    fileName: string;
    password: string;
    parentId?: string;
  }): Promise<VaultItem> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const id = this.generateUUID();
    const newItem: VaultItem = {
      id: id,
      parentId: options.parentId,
      type: "FILE",
      originalName: options.fileName,
      originalPath: "encrypted_storage",
      mimeType: options.fileBlob.type || "application/octet-stream",
      size: options.fileBlob.size,
      importedAt: Date.now(),
    };
    if (ChunkedFileService.shouldChunk(options.fileBlob.size)) {
      console.debug(
        `[SecureVaultPlugin] Importing large file ${options.fileName} using chunked method`
      );
      await ChunkedFileService.importFileChunked(
        options.fileBlob,
        options.fileName,
        id,
        this.currentKey
      );
    } else {
      await StorageService.saveFile(id, options.fileBlob, this.currentKey);
    }
    this.vaultCache.unshift(newItem);
    await StorageService.saveMetadata(
      this.currentMode,
      this.vaultCache,
      this.currentKey
    );
    return newItem;
  }
  async createFolder(options: {
    name: string;
    parentId?: string;
  }): Promise<VaultItem> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const id = this.generateUUID();
    const folder: VaultItem = {
      id,
      parentId: options.parentId,
      type: "FOLDER",
      originalName: options.name,
      originalPath: "virtual_folder",
      mimeType: "application/vnd.google-apps.folder",
      size: 0,
      importedAt: Date.now(),
    };
    this.vaultCache.unshift(folder);
    await StorageService.saveMetadata(
      this.currentMode,
      this.vaultCache,
      this.currentKey
    );
    return folder;
  }
  async moveItems(options: {
    itemIds: string[];
    targetParentId?: string;
  }): Promise<{ success: boolean }> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const targetPath = new Set<string>();
    let curr = options.targetParentId;
    while (curr) {
      targetPath.add(curr);
      const parent = this.vaultCache.find((i) => i.id === curr);
      curr = parent?.parentId;
    }
    for (const id of options.itemIds) {
      if (targetPath.has(id)) throw new Error("Cannot move folder into itself");
    }
    let modified = false;
    this.vaultCache = this.vaultCache.map((item) => {
      if (options.itemIds.includes(item.id)) {
        modified = true;
        return { ...item, parentId: options.targetParentId };
      }
      return item;
    });
    if (modified) {
      await StorageService.saveMetadata(
        this.currentMode,
        this.vaultCache,
        this.currentKey
      );
    }
    return { success: true };
  }
  async copyItems(options: {
    itemIds: string[];
    targetParentId?: string;
    password: string;
  }): Promise<{ success: boolean }> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const copies: VaultItem[] = [];
    for (const id of options.itemIds) {
      const item = this.vaultCache.find((i) => i.id === id);
      if (!item) continue;
      if (item.type === "FOLDER") {
        await this.recursiveCopy(item, options.targetParentId);
      } else {
        const newId = this.generateUUID();
        try {
          await StorageService.copyFile(item.id, newId);
          const copy: VaultItem = {
            ...item,
            id: newId,
            parentId: options.targetParentId,
            importedAt: Date.now(),
            originalName: `${item.originalName} (Copy)`,
          };
          copies.push(copy);
        } catch (e) {
          console.error("Copy failed", e);
        }
      }
    }
    this.vaultCache.push(...copies);
    await StorageService.saveMetadata(
      this.currentMode,
      this.vaultCache,
      this.currentKey
    );
    return { success: true };
  }
  private async recursiveCopy(folder: VaultItem, parentId?: string) {
    const newFolderId = this.generateUUID();
    const newFolder: VaultItem = {
      ...folder,
      id: newFolderId,
      parentId: parentId,
      originalName: `${folder.originalName} (Copy)`,
      importedAt: Date.now(),
    };
    this.vaultCache.push(newFolder);
    const children = this.vaultCache.filter((i) => i.parentId === folder.id);
    for (const child of children) {
      if (child.type === "FOLDER") {
        await this.recursiveCopy(child, newFolderId);
      } else {
        const newFileId = this.generateUUID();
        try {
          await StorageService.copyFile(child.id, newFileId);
          const copy: VaultItem = {
            ...child,
            id: newFileId,
            parentId: newFolderId,
            importedAt: Date.now(),
          };
          this.vaultCache.push(copy);
        } catch (e) {}
      }
    }
  }
  async getVaultFiles(): Promise<VaultItem[]> {
    if (!this.sessionActive) throw new Error("Vault Locked");
    return this.vaultCache.filter(
      (item) => !item.originalName.startsWith("intruder_")
    );
  }
  async deleteVaultFile(options: {
    id: string;
  }): Promise<{ success: boolean }> {
    return this.deleteVaultItems({ ids: [options.id] });
  }
  async deleteVaultItems(options: {
    ids: string[];
  }): Promise<{ success: boolean }> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const idsToDelete = new Set(options.ids);
    let added = true;
    while (added) {
      added = false;
      for (const item of this.vaultCache) {
        if (
          !idsToDelete.has(item.id) &&
          item.parentId &&
          idsToDelete.has(item.parentId)
        ) {
          idsToDelete.add(item.id);
          added = true;
        }
      }
    }
    for (const id of idsToDelete) {
      const item = this.vaultCache.find((i) => i.id === id);
      if (item && item.type === "FILE") {
        await StorageService.deleteChunkedFile(id);
      }
    }
    this.vaultCache = this.vaultCache.filter((i) => !idsToDelete.has(i.id));
    await StorageService.saveMetadata(
      this.currentMode,
      this.vaultCache,
      this.currentKey
    );
    return { success: true };
  }
  async exportFile(options: {
    id: string;
    password: string;
  }): Promise<{ success: boolean; exportedPath: string }> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const item = this.vaultCache.find((i) => i.id === options.id);
    if (!item || item.type === "FOLDER")
      throw new Error("Cannot export folder directly");
    let blob: Blob;
    if (ChunkedFileService.shouldChunk(item.size)) {
      blob = await ChunkedFileService.loadFileChunked(
        options.id,
        this.currentKey
      );
    } else {
      blob = await StorageService.loadFile(options.id, this.currentKey);
    }
    const filename = `Restored_${item.originalName}`;
    if (!Capacitor.isNativePlatform()) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, exportedPath: "Browser Downloads" };
    }
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res.split(",")[1]);
      };
      reader.readAsDataURL(blob);
    });
    const base64Data = await base64Promise;
    try {
      const path = await StorageService.writePublicFile(filename, base64Data);
      return { success: true, exportedPath: path };
    } catch (e) {
      throw new Error("Failed to export to public storage");
    }
  }
  async previewFile(options: {
    id: string;
    password: string;
  }): Promise<{ uri: string }> {
    if (!this.sessionActive || !this.currentKey)
      throw new Error("Vault Locked");
    const item = this.vaultCache.find((i) => i.id === options.id);
    if (!item) throw new Error("File not found");
    let blob: Blob;
    if (ChunkedFileService.shouldChunk(item.size)) {
      blob = await ChunkedFileService.loadFileChunked(
        options.id,
        this.currentKey
      );
    } else {
      blob = await StorageService.loadFile(options.id, this.currentKey);
    }
    return { uri: URL.createObjectURL(blob) };
  }
  async updateCredentials(options: {
    oldPassword: string;
    newPassword: string;
    newType: LockType;
  }): Promise<{ success: boolean }> {
    if (this.currentMode === "DECOY")
      throw new Error("Cannot change credentials in Decoy mode");
    const result = await AuthService.verifyCredentials(options.oldPassword);
    if (!result.success || !result.salt)
      throw new Error("Old password incorrect");
    const oldKey = await CryptoService.deriveKey(
      options.oldPassword,
      result.salt
    );
    const allItems = await StorageService.loadMetadata("REAL", oldKey);
    const newSalt = await CryptoService.generateSalt();
    const newVerifier = await CryptoService.hashForVerification(
      options.newPassword,
      newSalt
    );
    const newKey = await CryptoService.deriveKey(options.newPassword, newSalt);
    await StorageService.saveMetadata("REAL", allItems, newKey);
    for (const item of allItems) {
      if (item.type === "FOLDER") continue;
      try {
        let fileBlob: Blob;
        if (ChunkedFileService.shouldChunk(item.size)) {
          fileBlob = await ChunkedFileService.loadFileChunked(item.id, oldKey);
        } else {
          fileBlob = await StorageService.loadFile(item.id, oldKey);
        }
        if (ChunkedFileService.shouldChunk(item.size)) {
          await ChunkedFileService.importFileChunked(
            fileBlob,
            item.originalName,
            item.id,
            newKey
          );
        } else {
          await StorageService.saveFile(item.id, fileBlob, newKey);
        }
      } catch (e) {
        console.error("Failed to re-encrypt file", item.id, e);
      }
    }
    await AuthService.updateCredentials(newSalt, newVerifier, options.newType);
    await StorageService.deleteFile("meta_decoy.json").catch(() => {});
    this.currentKey = newKey;
    return { success: true };
  }
  async enablePrivacyScreen(options: { enabled: boolean }): Promise<void> {
    console.log(`[Privacy] Flag Secure: ${options.enabled}`);
  }
  async checkBiometricAvailability(): Promise<{ available: boolean }> {
    const available = await AuthService.checkBiometricAvailability();
    return { available };
  }
  async getBiometricStatus(): Promise<{ enabled: boolean }> {
    const enabled = await AuthService.getBiometricEnabled();
    return { enabled };
  }
  async setBiometricStatus(options: {
    enabled: boolean;
    password?: string;
  }): Promise<void> {
    await AuthService.setBiometricEnabled(options.enabled, options.password);
  }
  async authenticateBiometric(): Promise<{
    success: boolean;
    password?: string;
    error?: string;
  }> {
    const result = await AuthService.authenticateBiometric();
    return {
      success: result.success,
      password: result.password,
      error: result.error,
    };
  }
  async setDecoyCredential(options: {
    decoyPassword: string;
    masterPassword: string;
  }): Promise<{ success: boolean }> {
    const salt = await AuthService.getSalt();
    if (!salt) throw new Error("Vault error");
    await AuthService.setDecoyCredential(options.decoyPassword, salt);
    const key = await CryptoService.deriveKey(options.decoyPassword, salt);
    await StorageService.saveMetadata("DECOY", [], key);
    return { success: true };
  }
  async removeDecoyCredential(password: string): Promise<{ success: boolean }> {
    await AuthService.removeDecoyCredential();
    await StorageService.deleteFile("meta_decoy.json").catch(() => {});
    return { success: true };
  }
  async hasDecoy(): Promise<{ hasDecoy: boolean }> {
    const hasDecoy = await AuthService.hasDecoy();
    return { hasDecoy };
  }
  async resetVault(password: string): Promise<{ success: boolean }> {
    const result = await AuthService.verifyCredentials(password);
    if (!result.success) throw new Error("Incorrect Password");
    await AuthService.wipeAll();
    await StorageService.wipeVault();
    this.currentKey = null;
    this.sessionActive = false;
    this.vaultCache = [];
    return { success: true };
  }
  async getIntruderSettings(): Promise<IntruderSettings> {
    return await AuthService.getIntruderSettings();
  }
  async setIntruderSettings(settings: IntruderSettings): Promise<void> {
    await AuthService.setIntruderSettings(settings);
  }
  async checkCameraPermission(): Promise<{ granted: boolean }> {
    return await CameraService.checkPermission();
  }
  async captureIntruderEvidence(): Promise<void> {
    const settings = await AuthService.getIntruderSettings();
    if (!settings.enabled) return;
    const strategies: ("user" | "environment")[] = [];
    if (settings.source === "FRONT") {
      for (let i = 0; i < settings.photoCount; i++) strategies.push("user");
    } else if (settings.source === "BACK") {
      for (let i = 0; i < settings.photoCount; i++)
        strategies.push("environment");
    } else {
      strategies.push("user");
      if (settings.photoCount >= 2) strategies.push("environment");
      if (settings.photoCount >= 3) strategies.push("user");
    }
    const sessionId = Date.now();
    for (let i = 0; i < strategies.length; i++) {
      const mode = strategies[i];
      const blob = await CameraService.takePhoto(mode);
      if (blob) {
        const filename = `intruder_${sessionId}_${i}_${mode}.jpg`;
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(",")[1];
            await StorageService.savePendingIntruder(filename, base64);
            resolve();
          };
          reader.readAsDataURL(blob);
        });
      }
    }
  }
  async getIntruderLogs(): Promise<IntruderSession[]> {
    if (!this.sessionActive || this.currentMode !== "REAL" || !this.currentKey)
      return [];
    try {
      await StorageService.initDirectory();
      const pendingFiles = await StorageService.getPendingIntruders();
      for (const file of pendingFiles) {
        try {
          const byteCharacters = atob(file.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "image/jpeg" });
          await this.importFile({
            fileBlob: blob,
            fileName: file.name,
            password: "",
          });
          await StorageService.deletePendingIntruder(file.name);
        } catch (err) {
          console.error(
            `Failed to import pending intruder file ${file.name}`,
            err
          );
          // Optional: Delete corrupted file to prevent blocking future logs?
          // await StorageService.deletePendingIntruder(file.name);
        }
      }
    } catch (e) {
      console.log("Error importing pending intruders", e);
    }
    const intruderFiles = this.vaultCache.filter((i) =>
      i.originalName.startsWith("intruder_")
    );
    const sessionsMap = new Map<number, VaultItem[]>();
    intruderFiles.forEach((file) => {
      const parts = file.originalName.split("_");
      if (parts.length >= 2) {
        const ts = parseInt(parts[1]);
        if (!isNaN(ts)) {
          if (!sessionsMap.has(ts)) sessionsMap.set(ts, []);
          sessionsMap.get(ts)?.push(file);
          return;
        }
      }
      const ts = file.importedAt;
      if (!sessionsMap.has(ts)) sessionsMap.set(ts, []);
      sessionsMap.get(ts)?.push(file);
    });
    const sessions: IntruderSession[] = [];
    sessionsMap.forEach((files, ts) => {
      sessions.push({
        id: ts.toString(),
        timestamp: ts,
        attempts: 1,
        images: files,
      });
    });
    return sessions.sort((a, b) => b.timestamp - a.timestamp);
  }
  async deleteIntruderSession(options: {
    timestamp: number;
  }): Promise<{ success: boolean }> {
    const logs = await this.getIntruderLogs();
    const session = logs.find((s) => s.timestamp === options.timestamp);
    if (session) {
      await this.deleteVaultItems({ ids: session.images.map((i) => i.id) });
    }
    return { success: true };
  }
}
export const SecureVault = new SecureVaultFacade();