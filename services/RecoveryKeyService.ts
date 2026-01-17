import { CryptoService } from "./CryptoService";

export interface RecoveryKey {
  key: string;
  type: "ALPHANUMERIC" | "MNEMONIC";
}

export class RecoveryKeyService {
  static readonly RECOVERY_KEY_LENGTH = 20;
  static readonly MNEMONIC_WORD_COUNT = 12;

  private static readonly MNEMONIC_WORDS = [
    "ability",
    "able",
    "about",
    "above",
    "abroad",
    "absence",
    "absolute",
    "absorb",
    "abstract",
    "absurd",
    "access",
    "accident",
    "account",
    "accuse",
    "achieve",
    "acid",
    "acoustic",
    "acquire",
    "across",
    "act",
    "action",
    "actor",
    "actual",
    "acuate",
    "acute",
    "add",
    "addict",
    "address",
    "adjust",
    "admit",
    "adult",
    "advance",
    "advent",
    "advice",
    "advise",
    "affair",
    "afford",
    "afraid",
    "after",
    "again",
    "age",
    "agent",
    "agree",
    "ahead",
    "aim",
    "air",
    "airport",
    "aisle",
    "alarm",
    "album",
    "alcohol",
    "alert",
    "alike",
    "alive",
    "all",
    "allay",
    "alley",
    "allow",
    "alloy",
    "allure",
    "ally",
    "almost",
    "alone",
    "along",
    "alongside",
    "aloof",
    "aloud",
    "alpha",
    "already",
    "also",
    "alter",
    "always",
    "am",
    "amateur",
    "amaze",
    "ambiguous",
    "ambition",
    "amble",
    "ambush",
    "amend",
    "america",
    "among",
    "amount",
    "amour",
    "amuck",
    "amulet",
    "amuse",
    "analyst",
    "anchor",
    "ancient",
    "and",
    "android",
    "anecdote",
    "anew",
    "angel",
    "anger",
    "angle",
    "angry",
    "angst",
    "anguish",
  ];

  static generateRecoveryKey(
    type: "ALPHANUMERIC" | "MNEMONIC" = "ALPHANUMERIC"
  ): RecoveryKey {
    if (type === "MNEMONIC") {
      return this.generateMnemonicKey();
    }
    return this.generateAlphanumericKey();
  }

  private static generateAlphanumericKey(): RecoveryKey {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "";

    const randomValues = new Uint8Array(this.RECOVERY_KEY_LENGTH);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < this.RECOVERY_KEY_LENGTH; i++) {
      key += chars[randomValues[i] % chars.length];
    }

    // Format with dashes for readability: XXXX-XXXX-XXXX-XXXX-XXXX
    const formatted = key.replace(/(.{4})/g, "$1-").slice(0, -1);

    return { key: formatted, type: "ALPHANUMERIC" };
  }

  private static generateMnemonicKey(): RecoveryKey {
    const randomValues = new Uint8Array(this.MNEMONIC_WORD_COUNT);
    crypto.getRandomValues(randomValues);

    const words: string[] = [];
    for (let i = 0; i < this.MNEMONIC_WORD_COUNT; i++) {
      const index = randomValues[i] % this.MNEMONIC_WORDS.length;
      words.push(this.MNEMONIC_WORDS[index]);
    }

    return { key: words.join(" "), type: "MNEMONIC" };
  }

  static normalizeKey(key: string): string {
    return key.trim().toUpperCase().replace(/\s+/g, " ").replace(/-/g, "");
  }

  static async hashRecoveryKey(key: string, salt: string): Promise<string> {
    const normalized = this.normalizeKey(key);
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized + salt);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  static validateRecoveryKeyFormat(
    key: string,
    type: "ALPHANUMERIC" | "MNEMONIC"
  ): boolean {
    const normalized = this.normalizeKey(key);

    if (type === "ALPHANUMERIC") {
      const alphanumericPattern = /^[A-Z0-9]{20}$/;
      return alphanumericPattern.test(normalized);
    }

    if (type === "MNEMONIC") {
      const words = normalized.split(" ");
      if (words.length !== this.MNEMONIC_WORD_COUNT) {
        return false;
      }

      return words.every((word) =>
        this.MNEMONIC_WORDS.includes(word.toLowerCase())
      );
    }

    return false;
  }

  static formatRecoveryKeyForDisplay(
    key: string,
    type: "ALPHANUMERIC" | "MNEMONIC"
  ): string {
    if (type === "MNEMONIC") {
      const words = key.trim().split(" ");
      return words.map((w, i) => `${i + 1}. ${w}`).join("\n");
    }

    // ALPHANUMERIC: show in 4-char chunks
    return key
      .replace(/-/g, "")
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }

  static generateStorageKey(): string {
    const randomValues = new Uint8Array(16);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
