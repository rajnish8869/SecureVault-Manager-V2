export interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  attemptCount: number;
  lockoutLevel: 0 | 1 | 2 | 3; // 0: no lockout, 1: 30s, 2: 2m, 3: 5m
  unlockTime?: number;
}

export class RateLimitService {
  static readonly ATTEMPT_THRESHOLD = 5;
  static readonly LOCKOUT_INTERVALS = {
    level1: 30 * 1000, // 30 seconds
    level2: 2 * 60 * 1000, // 2 minutes
    level3: 5 * 60 * 1000, // 5 minutes
  };

  private static lockoutState: LockoutState = {
    isLocked: false,
    remainingSeconds: 0,
    attemptCount: 0,
    lockoutLevel: 0,
  };

  private static lockoutTimer: NodeJS.Timeout | null = null;

  static getState(): LockoutState {
    return { ...this.lockoutState };
  }

  static recordFailedAttempt(): LockoutState {
    this.lockoutState.attemptCount++;

    if (this.lockoutState.attemptCount >= this.ATTEMPT_THRESHOLD) {
      this.determineLockoutLevel();
    }

    return this.getState();
  }

  static resetAttempts(): void {
    this.lockoutState.attemptCount = 0;
    this.lockoutState.lockoutLevel = 0;
    this.lockoutState.isLocked = false;
    this.lockoutState.remainingSeconds = 0;
    this.lockoutState.unlockTime = undefined;

    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = null;
    }
  }

  static isLockedOut(): boolean {
    if (!this.lockoutState.isLocked) {
      return false;
    }

    if (
      this.lockoutState.unlockTime &&
      Date.now() >= this.lockoutState.unlockTime
    ) {
      this.resetAttempts();
      return false;
    }

    return this.lockoutState.isLocked;
  }

  static getLockoutTimeRemaining(): number {
    if (!this.lockoutState.unlockTime) {
      return 0;
    }

    const remaining = Math.max(0, this.lockoutState.unlockTime - Date.now());
    return Math.ceil(remaining / 1000);
  }

  static startCountdown(callback?: (state: LockoutState) => void): void {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
    }

    this.lockoutTimer = setInterval(() => {
      const remaining = this.getLockoutTimeRemaining();
      this.lockoutState.remainingSeconds = remaining;

      if (remaining <= 0) {
        this.resetAttempts();
        if (this.lockoutTimer) {
          clearInterval(this.lockoutTimer);
          this.lockoutTimer = null;
        }
      }

      if (callback) {
        callback(this.getState());
      }
    }, 1000);
  }

  static stopCountdown(): void {
    if (this.lockoutTimer) {
      clearInterval(this.lockoutTimer);
      this.lockoutTimer = null;
    }
  }

  private static determineLockoutLevel(): void {
    const attempts = this.lockoutState.attemptCount;

    if (attempts < this.ATTEMPT_THRESHOLD) {
      this.lockoutState.lockoutLevel = 0;
      return;
    }

    if (attempts < this.ATTEMPT_THRESHOLD + 3) {
      this.lockoutState.lockoutLevel = 1;
      this.applyLockout(this.LOCKOUT_INTERVALS.level1);
    } else if (attempts < this.ATTEMPT_THRESHOLD + 6) {
      this.lockoutState.lockoutLevel = 2;
      this.applyLockout(this.LOCKOUT_INTERVALS.level2);
    } else {
      this.lockoutState.lockoutLevel = 3;
      this.applyLockout(this.LOCKOUT_INTERVALS.level3);
    }
  }

  private static applyLockout(duration: number): void {
    this.lockoutState.isLocked = true;
    this.lockoutState.unlockTime = Date.now() + duration;
    this.lockoutState.remainingSeconds = Math.ceil(duration / 1000);
  }

  static getLockoutMessage(): string {
    const remaining = this.getLockoutTimeRemaining();

    if (remaining <= 0) {
      return "";
    }

    if (remaining > 60) {
      const minutes = Math.ceil(remaining / 60);
      return `Too many failed attempts. Try again in ${minutes} minute${
        minutes > 1 ? "s" : ""
      }.`;
    }

    return `Too many failed attempts. Try again in ${remaining} second${
      remaining > 1 ? "s" : ""
    }.`;
  }

  static getProgressPercentage(): number {
    const remaining = this.getLockoutTimeRemaining();
    const total = this.lockoutState.unlockTime
      ? this.lockoutState.unlockTime - (Date.now() + 1000)
      : 0;

    if (total <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, (remaining / Math.ceil(total / 1000)) * 100)
    );
  }

  static canAttemptRecovery(maxRecoveryAttempts: number = 3): boolean {
    // Enforce stricter limits on recovery key attempts
    return this.lockoutState.attemptCount < maxRecoveryAttempts;
  }

  static serializeState(): string {
    return JSON.stringify(this.lockoutState);
  }

  static deserializeState(data: string): void {
    try {
      const state = JSON.parse(data) as LockoutState;
      this.lockoutState = state;

      if (this.lockoutState.isLocked && this.lockoutState.unlockTime) {
        if (Date.now() >= this.lockoutState.unlockTime) {
          this.resetAttempts();
        } else {
          this.startCountdown();
        }
      }
    } catch (e) {
      console.error("[RateLimitService] Failed to deserialize state:", e);
      this.resetAttempts();
    }
  }
}
