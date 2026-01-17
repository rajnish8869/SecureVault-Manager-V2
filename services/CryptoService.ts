export class CryptoService {
  static async generateSalt(): Promise<string> {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return this.bufferToBase64(array);
  }
  static async deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );
    const salt = this.base64ToBuffer(saltBase64);
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }
  static async hashForVerification(password: string, saltBase64: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password + saltBase64);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
    return this.bufferToBase64(new Uint8Array(hashBuffer));
  }
  static async encryptBlob(data: Blob, key: CryptoKey): Promise<{ iv: string, content: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await data.arrayBuffer();
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      arrayBuffer
    );
    return {
      iv: this.bufferToBase64(iv),
      content: this.bufferToBase64(new Uint8Array(encrypted))
    };
  }
  static async decryptBlob(encryptedBase64: string, ivBase64: string, key: CryptoKey): Promise<ArrayBuffer> {
    const iv = this.base64ToBuffer(ivBase64);
    const data = this.base64ToBuffer(encryptedBase64);
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );
  }
  static bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    const chunkSize = 0x8000; // 32KB chunks to prevent stack overflow
    // Process in chunks to handle larger buffers efficiently
    for (let i = 0; i < len; i += chunkSize) {
      const subarray = buffer.subarray(i, Math.min(i + chunkSize, len));
      binary += String.fromCharCode.apply(null, Array.from(subarray));
    }
    return window.btoa(binary);
  }
  static base64ToBuffer(base64: string): Uint8Array {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }
}