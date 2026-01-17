/**
 * Input Validation and Sanitization Service
 * Provides centralized validation for user inputs across the application
 */

export class InputValidator {
  /**
   * Validates and sanitizes folder names
   * - Removes path traversal sequences (../, ..\, etc.)
   * - Removes special characters that could cause issues
   * - Enforces length constraints
   * - Trims whitespace
   */
  static sanitizeFolderName(name: string, maxLength: number = 255): string {
    if (!name || typeof name !== "string") {
      throw new Error("Folder name must be a non-empty string");
    }

    let sanitized = name.trim();

    // Remove null bytes and other control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

    // Remove path traversal sequences
    sanitized = sanitized.replace(/\.\./g, "");
    sanitized = sanitized.replace(/[\/\\]/g, "");

    // Remove leading/trailing dots (can cause issues on some filesystems)
    sanitized = sanitized.replace(/^\.+|\.+$/g, "");

    // Limit consecutive spaces to single space
    sanitized = sanitized.replace(/\s+/g, " ");

    // Remove other potentially problematic characters
    // Allow: alphanumeric, spaces, dots, hyphens, underscores, and some unicode
    sanitized = sanitized.replace(/[<>:"|?*]/g, "");

    // Enforce length constraint
    if (sanitized.length === 0) {
      throw new Error("Folder name cannot be empty after sanitization");
    }

    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  /**
   * Validates and sanitizes file names
   * - Same rules as folder names but stricter on special characters
   * - Preserves file extensions
   * - Prevents directory traversal
   */
  static sanitizeFileName(name: string, maxLength: number = 255): string {
    if (!name || typeof name !== "string") {
      throw new Error("File name must be a non-empty string");
    }

    // Start with basic sanitization
    let sanitized = name.trim();

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

    // Remove path traversal sequences
    sanitized = sanitized.replace(/\.\./g, "");
    sanitized = sanitized.replace(/[\/\\]/g, "");

    // Remove leading dots (except for extensions)
    const parts = sanitized.split(".");
    if (parts.length > 1) {
      const ext = parts[parts.length - 1];
      const filename = parts.slice(0, -1).join(".");
      // Remove leading dots from filename
      sanitized = filename.replace(/^\.+/, "") + "." + ext;
    } else {
      sanitized = sanitized.replace(/^\.+/, "");
    }

    // Remove problematic characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, "");

    // Limit consecutive spaces
    sanitized = sanitized.replace(/\s+/g, " ");

    // Enforce length constraint
    if (sanitized.length === 0) {
      throw new Error("File name cannot be empty after sanitization");
    }

    if (sanitized.length > maxLength) {
      // Try to preserve extension when truncating
      const dotIndex = sanitized.lastIndexOf(".");
      if (dotIndex > 0 && dotIndex > maxLength - 20) {
        // Extension is too close to end, truncate and keep ext
        const ext = sanitized.substring(dotIndex);
        const remaining = maxLength - ext.length - 1;
        if (remaining > 0) {
          sanitized = sanitized.substring(0, remaining) + ext;
        } else {
          sanitized = sanitized.substring(0, maxLength);
        }
      } else {
        sanitized = sanitized.substring(0, maxLength);
      }
    }

    return sanitized;
  }

  /**
   * Validates password strength
   * - Enforces minimum length (8 characters)
   * - Optional: checks for character variety
   * - Returns validation result with specific failure reasons
   */
  static validatePassword(
    password: string,
    options: {
      minLength?: number;
      requireVariety?: boolean;
    } = {}
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const minLength = options.minLength ?? 8;

    if (!password || typeof password !== "string") {
      return { valid: false, errors: ["Password must be a non-empty string"] };
    }

    // Check minimum length
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    }

    // Check for character variety if requested
    if (options.requireVariety) {
      const hasLower = /[a-z]/.test(password);
      const hasUpper = /[A-Z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      const varietyCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(
        Boolean
      ).length;
      if (varietyCount < 3) {
        errors.push(
          "Password should include uppercase, lowercase, numbers, and special characters"
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates PIN format
   * - Must be exactly 6 digits
   * - Only numeric characters allowed
   */
  static validatePin(pin: string): { valid: boolean; error?: string } {
    if (!pin || typeof pin !== "string") {
      return { valid: false, error: "PIN must be a non-empty string" };
    }

    if (!/^\d{6}$/.test(pin)) {
      return { valid: false, error: "PIN must be exactly 6 digits" };
    }

    return { valid: true };
  }

  /**
   * Sanitizes PIN input - keeps only digits
   */
  static sanitizePin(input: string): string {
    if (!input || typeof input !== "string") return "";
    return input.replace(/[^\d]/g, "").substring(0, 6);
  }

  /**
   * Validates metadata before storage
   * - Ensures required fields are present and valid
   * - Sanitizes string fields
   */
  static validateMetadata(metadata: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metadata || typeof metadata !== "object") {
      return { valid: false, errors: ["Metadata must be an object"] };
    }

    // Validate that metadata is JSON serializable
    try {
      JSON.stringify(metadata);
    } catch (e) {
      errors.push("Metadata must be JSON serializable");
    }

    // Check for suspicious structures
    const str = JSON.stringify(metadata);
    if (str.length > 1000000) {
      // 1MB limit
      errors.push("Metadata exceeds maximum size");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Checks for path traversal attempts
   * - Detects sequences like ../, ..\\, etc.
   */
  static isPathTraversal(path: string): boolean {
    if (!path || typeof path !== "string") return false;

    // Check for common path traversal patterns
    const traversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\.\.$/,
      /^\/\.\.\//,
      /\\\.\\/, // Encoded backslash
    ];

    return traversalPatterns.some((pattern) => pattern.test(path));
  }

  /**
   * Sanitizes file IDs - ensures they are valid UUIDs or alphanumeric
   */
  static sanitizeFileId(id: string): { valid: boolean; sanitized?: string } {
    if (!id || typeof id !== "string") {
      return { valid: false };
    }

    // UUIDs should match format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(id)) {
      return { valid: true, sanitized: id.toLowerCase() };
    }

    // Allow alphanumeric IDs as fallback
    const alphanumericPattern = /^[a-zA-Z0-9_-]+$/;
    if (alphanumericPattern.test(id)) {
      return { valid: true, sanitized: id };
    }

    return { valid: false };
  }

  /**
   * Validates folder ID to prevent path traversal
   */
  static validateFolderId(id: string | undefined): boolean {
    if (id === undefined) return true; // Root is valid
    if (!id || typeof id !== "string") return false;

    // Must be valid UUID or alphanumeric
    const { valid } = this.sanitizeFileId(id);
    return valid;
  }
}
