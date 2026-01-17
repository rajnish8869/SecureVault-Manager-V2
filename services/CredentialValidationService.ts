export interface CredentialStrength {
  score: 0 | 1 | 2 | 3; // 0: weak, 1: fair, 2: good, 3: strong
  feedback: string[];
}

export class CredentialValidationService {
  static readonly PIN_MIN_LENGTH = 6;
  static readonly PASSWORD_MIN_LENGTH = 8;

  private static readonly COMMON_PIN_PATTERNS = [
    /^(\d)\1{5}$/, // Repeated digits: 111111, 000000
    /^0123456$/, // Sequential ascending: 012345
    /^6543210$/, // Sequential descending: 654321
  ];

  private static readonly MNEMONIC_WORDS = [
    "able",
    "about",
    "above",
    "access",
    "accident",
    "account",
    "achieve",
    "acid",
    "acoustic",
    "acquire",
    "across",
    "act",
    "action",
    "actor",
    "actual",
    "acute",
    "add",
    "address",
    "adjust",
    "admit",
    "adult",
    "advance",
    "advice",
    "advise",
    "affair",
    "afford",
    "after",
    "again",
    "age",
    "agent",
    "agree",
    "agreement",
    "ahead",
    "aim",
    "air",
    "airport",
    "aisle",
    "alarm",
    "album",
    "alcohol",
  ];

  static validatePin(
    pin: string,
    options: { checkPattern?: boolean } = {}
  ): { valid: boolean; feedback: string[] } {
    const feedback: string[] = [];

    if (!pin || typeof pin !== "string") {
      return { valid: false, feedback: ["PIN must be a non-empty string"] };
    }

    if (!/^\d{6}$/.test(pin)) {
      feedback.push("PIN must be exactly 6 digits");
      return { valid: false, feedback };
    }

    if (options.checkPattern !== false) {
      if (this.hasCommonPinPattern(pin)) {
        feedback.push("PIN uses a common or sequential pattern");
        return { valid: false, feedback };
      }

      if (this.hasRepeatingSequence(pin)) {
        feedback.push("PIN has too many repeated digits");
        return { valid: false, feedback };
      }

      if (this.isSequentialPin(pin)) {
        feedback.push("PIN should not be sequential");
        return { valid: false, feedback };
      }
    }

    return { valid: true, feedback: [] };
  }

  static validatePassword(
    password: string,
    options: { requireComplexity?: boolean; minLength?: number } = {}
  ): { valid: boolean; feedback: string[] } {
    const feedback: string[] = [];
    const minLength = options.minLength ?? this.PASSWORD_MIN_LENGTH;

    if (!password || typeof password !== "string") {
      return {
        valid: false,
        feedback: ["Password must be a non-empty string"],
      };
    }

    if (password.length < minLength) {
      feedback.push(
        `Password must be at least ${minLength} characters (currently ${password.length})`
      );
    }

    if (options.requireComplexity !== false) {
      const hasLower = /[a-z]/.test(password);
      const hasUpper = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      if (!hasLower) feedback.push("Add lowercase letters (a-z)");
      if (!hasUpper) feedback.push("Add uppercase letters (A-Z)");
      if (!hasNumber) feedback.push("Add numbers (0-9)");
      if (!hasSpecial) feedback.push("Add special characters (!@#$%^&* etc.)");

      const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(
        Boolean
      ).length;
      if (varietyCount < 3) {
        return { valid: false, feedback };
      }
    }

    // Check for repeating characters
    if (this.hasExcessiveRepeatingChars(password)) {
      feedback.push("Avoid repeating characters");
    }

    return {
      valid: feedback.length === 0,
      feedback,
    };
  }

  static calculatePinStrength(pin: string): CredentialStrength {
    const feedback: string[] = [];
    let score: 0 | 1 | 2 | 3 = 3;

    const validation = this.validatePin(pin, { checkPattern: true });
    if (!validation.valid) {
      return { score: 0, feedback: validation.feedback };
    }

    if (this.hasRepeatingSequence(pin)) {
      feedback.push("Avoid repeated digits");
      score = Math.min(score, 1) as 0 | 1 | 2 | 3;
    }

    if (this.isSequentialPin(pin)) {
      feedback.push("Avoid sequential patterns");
      score = Math.min(score, 2) as 0 | 1 | 2 | 3;
    }

    if (feedback.length === 0) {
      feedback.push("Strong PIN");
    }

    return { score, feedback };
  }

  static calculatePasswordStrength(password: string): CredentialStrength {
    const feedback: string[] = [];
    let score: 0 | 1 | 2 | 3 = 0;

    const validation = this.validatePassword(password, {
      requireComplexity: true,
      minLength: this.PASSWORD_MIN_LENGTH,
    });

    if (!validation.valid) {
      return { score: 0, feedback: validation.feedback };
    }

    if (password.length < 8) {
      score = 1;
      feedback.push("Password is too short");
    } else if (password.length < 12) {
      score = 2;
      feedback.push("Password is good");
    } else {
      score = 3;
      feedback.push("Password is strong");
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(
      Boolean
    ).length;

    if (varietyCount === 4) {
      score = 3;
    } else if (varietyCount === 3 && password.length >= 12) {
      score = 3;
    } else if (varietyCount < 3) {
      score = Math.min(score, 2) as 0 | 1 | 2 | 3;
    }

    if (this.hasExcessiveRepeatingChars(password)) {
      score = Math.max(score - 1, 0) as 0 | 1 | 2 | 3;
      feedback.push("Reduce repeated characters");
    }

    return { score, feedback };
  }

  private static hasCommonPinPattern(pin: string): boolean {
    return this.COMMON_PIN_PATTERNS.some((pattern) => pattern.test(pin));
  }

  private static hasRepeatingSequence(pin: string): boolean {
    // Check if 4+ consecutive digits are the same
    for (let i = 0; i < pin.length - 3; i++) {
      if (
        pin[i] === pin[i + 1] &&
        pin[i + 1] === pin[i + 2] &&
        pin[i + 2] === pin[i + 3]
      ) {
        return true;
      }
    }
    return false;
  }

  private static isSequentialPin(pin: string): boolean {
    // Check for ascending or descending sequences (e.g., 123456, 654321)
    const digits = pin.split("").map(Number);

    let ascending = 0;
    let descending = 0;

    for (let i = 1; i < digits.length; i++) {
      if (digits[i] === digits[i - 1] + 1) ascending++;
      if (digits[i] === digits[i - 1] - 1) descending++;
    }

    return ascending >= 4 || descending >= 4;
  }

  private static hasExcessiveRepeatingChars(str: string): boolean {
    // Check for 3+ consecutive identical characters
    for (let i = 0; i < str.length - 2; i++) {
      if (str[i] === str[i + 1] && str[i + 1] === str[i + 2]) {
        return true;
      }
    }
    return false;
  }

  static getPasswordComplexityHint(): string {
    return "Password must include uppercase, lowercase, numbers, and symbols";
  }

  static getPinComplexityHint(): string {
    return "PIN should avoid common patterns like 111111 or 123456";
  }
}
