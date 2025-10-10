import crypto, { CipherGCM, DecipherGCM } from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';
import { AppError } from './errors';


type CharsetType = 'alphanumeric' | 'numeric' | 'alphabetic' | 'hex' | 'base64';
/**
 * Encryption and hashing utilities
 */
export class CryptoUtils {
    private algorithm = 'aes-256-gcm';
    private keyLength = 32;
    private ivLength = 16;
    private tagLength = 16;
    private saltLength = 64;

    /**
     * Hash password using bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        try {
            return await bcrypt.hash(password, config.security.bcryptRounds);
        } catch (error) {
            throw new AppError('Password hashing failed', 500, 'HASHING_ERROR');
        }
    }

    /**
     * Compare password with hash
     */
    async comparePassword(password: string, hash: string): Promise<boolean> {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            throw new AppError('Password comparison failed', 500, 'COMPARISON_ERROR');
        }
    }

    /**
     * Generate secure random token
     */
    generateToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate cryptographically secure random string
     */
    generateSecureString(length: number = 32, charset: CharsetType = 'alphanumeric'): string {
        const charsets: Record<CharsetType, string> = {
            alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            numeric: '0123456789',
            alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            hex: '0123456789abcdef',
            base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        };

        const chars = charsets[charset];
        const bytes = crypto.randomBytes(length);
        const result = [];

        for (let i = 0; i < length; i++) {
            result.push(chars[bytes[i] % chars.length]);
        }

        return result.join('');
    }

    /**
     * Encrypt data using AES-256-GCM
     */
    encrypt(text: string, key?: string): { encrypted: string; iv: string; tag: string } {
        try {
            const encryptionKey = key
                ? Buffer.from(this.deriveKey(key), 'hex')
                : Buffer.from(this.getEncryptionKey(), 'utf8');

            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(
                this.algorithm,
                encryptionKey,
                iv
            ) as CipherGCM;

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const tag = cipher.getAuthTag();

            return {
                encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
            };
        } catch (error) {
            throw new AppError('Encryption failed', 500, 'ENCRYPTION_ERROR');
        }
    }

    /**
     * Decrypt data using AES-256-GCM
     */
    decrypt(encryptedData: string, iv: string, tag: string, key?: string): string {
        try {
            const encryptionKey = key
                ? Buffer.from(this.deriveKey(key), 'hex')
                : Buffer.from(this.getEncryptionKey(), 'utf8');

            const decipher = crypto.createDecipheriv(
                this.algorithm,
                encryptionKey,
                Buffer.from(iv, 'hex')
            ) as unknown as DecipherGCM; // 👈 Cast to DecipherGCM

            decipher.setAuthTag(Buffer.from(tag, 'hex'));

            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            throw new AppError('Decryption failed', 500, 'DECRYPTION_ERROR');
        }
    }

    /**
     * Create HMAC signature
     */
    createHmac(data: string, secret?: string): string {
        try {
            const hmacSecret = secret || config.security.jwtSecret;
            return crypto
                .createHmac('sha256', hmacSecret)
                .update(data)
                .digest('hex');
        } catch (error) {
            throw new AppError('HMAC creation failed', 500, 'HMAC_ERROR');
        }
    }

    /**
     * Verify HMAC signature
     */
    verifyHmac(data: string, signature: string, secret?: string): boolean {
        try {
            const expectedSignature = this.createHmac(data, secret);
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Create SHA-256 hash
     */
    createHash(data: string): string {
        try {
            return crypto.createHash('sha256').update(data).digest('hex');
        } catch (error) {
            throw new AppError('Hash creation failed', 500, 'HASH_ERROR');
        }
    }

    /**
     * Create MD5 hash (for non-security purposes)
     */
    createMD5(data: string): string {
        try {
            return crypto.createHash('md5').update(data).digest('hex');
        } catch (error) {
            throw new AppError('MD5 creation failed', 500, 'MD5_ERROR');
        }
    }

    /**
     * Generate RSA key pair
     */
    generateRSAKeyPair(modulusLength: number = 2048): crypto.KeyPairSyncResult<string, string> {
        try {
            return crypto.generateKeyPairSync('rsa', {
                modulusLength,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem',
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem',
                },
            });
        } catch (error) {
            throw new AppError('RSA key pair generation failed', 500, 'RSA_GENERATION_ERROR');
        }
    }

    /**
     * RSA encrypt with public key
     */
    rsaEncrypt(data: string, publicKey: string): string {
        try {
            const buffer = Buffer.from(data, 'utf8');
            const encrypted = crypto.publicEncrypt(publicKey, buffer);
            return encrypted.toString('base64');
        } catch (error) {
            throw new AppError('RSA encryption failed', 500, 'RSA_ENCRYPTION_ERROR');
        }
    }

    /**
     * RSA decrypt with private key
     */
    rsaDecrypt(encryptedData: string, privateKey: string): string {
        try {
            const buffer = Buffer.from(encryptedData, 'base64');
            const decrypted = crypto.privateDecrypt(privateKey, buffer);
            return decrypted.toString('utf8');
        } catch (error) {
            throw new AppError('RSA decryption failed', 500, 'RSA_DECRYPTION_ERROR');
        }
    }

    /**
     * Generate secure API key
     */
    generateApiKey(): string {
        const prefix = 'ak_'; // API key prefix
        const randomPart = this.generateSecureString(32, 'alphanumeric');
        return prefix + randomPart;
    }

    /**
     * Generate secure session ID
     */
    generateSessionId(): string {
        const prefix = 'sess_';
        const randomPart = this.generateSecureString(24, 'alphanumeric');
        return prefix + randomPart;
    }

    /**
     * Generate secure reset token
     */
    generateResetToken(): string {
        return this.generateToken(32);
    }

    /**
     * Generate secure email verification token
     */
    generateEmailVerificationToken(): string {
        return this.generateToken(16);
    }

    /**
     * Generate secure 2FA secret
     */
    generate2FASecret(): string {
        return this.generateSecureString(32, 'alphanumeric');
    }

    /**
     * Generate secure file name
     */
    generateSecureFilename(originalName: string): string {
        const extension = originalName.split('.').pop() || '';
        const timestamp = Date.now().toString();
        const randomPart = this.generateSecureString(8, 'alphanumeric');
        return `${timestamp}-${randomPart}.${extension}`;
    }

    /**
     * Create password reset hash
     */
    createPasswordResetHash(userId: string, timestamp: number): string {
        const data = `${userId}:${timestamp}:${config.security.jwtSecret}`;
        return this.createHash(data);
    }

    /**
     * Verify password reset hash
     */
    verifyPasswordResetHash(userId: string, timestamp: number, hash: string): boolean {
        const expectedHash = this.createPasswordResetHash(userId, timestamp);
        return crypto.timingSafeEqual(
            Buffer.from(hash, 'hex'),
            Buffer.from(expectedHash, 'hex')
        );
    }

    /**
     * Generate secure nonce
     */
    generateNonce(length: number = 16): string {
        return crypto.randomBytes(length).toString('base64');
    }

    /**
     * Create PBKDF2 hash
     */
    async createPBKDF2(password: string, salt: string, iterations: number = 100000): Promise<string> {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
                if (err) {
                    reject(new AppError('PBKDF2 hashing failed', 500, 'PBKDF2_ERROR'));
                } else {
                    resolve(derivedKey.toString('hex'));
                }
            });
        });
    }

    /**
     * Create salt
     */
    createSalt(length: number = this.saltLength): string {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Derive key from password
     */
    deriveKey(password: string, salt?: string): string {
        const saltValue = salt || this.createSalt();
        return crypto.pbkdf2Sync(password, saltValue, 100000, this.keyLength, 'sha512').toString('hex');
    }

    /**
     * Get encryption key from config
     */
    private getEncryptionKey(): string {
        // In production, this should be securely stored and retrieved
        return config.security.jwtSecret.substring(0, this.keyLength);
    }

    /**
     * Create digital signature
     */
    createSignature(data: string, privateKey: string): string {
        try {
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(data);
            return sign.sign(privateKey, 'hex');
        } catch (error) {
            throw new AppError('Signature creation failed', 500, 'SIGNATURE_ERROR');
        }
    }

    /**
     * Verify digital signature
     */
    verifySignature(data: string, signature: string, publicKey: string): boolean {
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(data);
            return verify.verify(publicKey, signature, 'hex');
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate cryptographically secure random bytes
     */
    randomBytes(size: number): Buffer {
        return crypto.randomBytes(size);
    }

    /**
     * Timing-safe string comparison
     */
    timingSafeEqual(a: string, b: string): boolean {
        try {
            return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
        } catch (error) {
            return false;
        }
    }
}

export const cryptoUtils = new CryptoUtils();

/**
 * Password strength checker
 */
export const checkPasswordStrength = (password: string): {
    score: number;
    feedback: string[];
    isStrong: boolean;
} => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('Password should be at least 8 characters long');

    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Add lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Add uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Add numbers');

    if (/[@$!%*?&]/.test(password)) score += 1;
    else feedback.push('Add special characters');

    // Common patterns check
    if (/(.)\\1{2,}/.test(password)) {
        score -= 1;
        feedback.push('Avoid repeated characters');
    }

    if (/123|abc|qwe/i.test(password)) {
        score -= 1;
        feedback.push('Avoid common patterns');
    }

    return {
        score: Math.max(0, score),
        feedback,
        isStrong: score >= 4,
    };
};

/**
 * Generate secure random integer
 */
export const secureRandomInt = (min: number, max: number): number => {
    if (min >= max) throw new Error('Min must be less than max');

    const range = max - min;
    const randomBytes = crypto.randomBytes(4);
    const randomInt = randomBytes.readUInt32BE(0);

    return min + (randomInt % range);
};

/**
 * Simple XOR encryption (for non-sensitive data)
 */
export const xorEncrypt = (text: string, key: string): string => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return Buffer.from(result).toString('base64');
};

/**
 * Simple XOR decryption
 */
export const xorDecrypt = (encrypted: string, key: string): string => {
    const decoded = Buffer.from(encrypted, 'base64').toString();
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
};

export default cryptoUtils;