import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
// 型定義は ../types.ts から import
import { JWTPayload } from '../types';

// JWT設定
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN: string | number = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// 環境変数の検証
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set in environment variables. Using default value.');
}

// パスワード設定
const SALT_ROUNDS = 12;

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return { hash, salt };
}

/**
 * パスワードを検証
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * JWTトークンを生成
 */
export function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret?: string): string {
  const jwtSecret = secret || JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };

  return jwt.sign(payload, jwtSecret, options);
}

/**
 * JWTトークンを検証
 */
export function verifyJWT(token: string, secret?: string): JWTPayload | null {
  try {
    const jwtSecret = secret || JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * リフレッシュトークンを生成
 */
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret?: string): string {
  const jwtSecret = secret || JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const options: jwt.SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  };

  return jwt.sign({ ...payload, type: 'refresh' }, jwtSecret, options);
}

/**
 * リフレッシュトークンを検証
 */
export function verifyRefreshToken(token: string, secret?: string): JWTPayload | null {
  try {
    const jwtSecret = secret || JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
    }) as JWTPayload & { type: string };

    // リフレッシュトークンかどうかを確認
    if (decoded.type !== 'refresh') {
      return null;
    }

    // typeプロパティを除去して返す
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type, ...payload } = decoded;
    return payload;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * セッションIDを生成
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * パスワード強度をチェック
 */
export function validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('小文字を含む必要があります');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を含む必要があります');
  }

  if (!/\d/.test(password)) {
    errors.push('数字を含む必要があります');
  }

  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const hasSpecialChar = password.split('').some((char) => specialChars.includes(char));
  if (!hasSpecialChar) {
    errors.push('特殊文字を含む必要があります');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * ランダムパスワードを生成
 */
export function generateRandomPassword(length = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // 各カテゴリから最低1文字を保証
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // 残りの文字をランダムに生成
  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // パスワードをシャッフル
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * 認証用APIレスポンスを生成（セキュリティヘッダー付き）
 */
export function createAuthResponse(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  const origin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

/**
 * 認証用エラーレスポンスを生成
 */
export function createAuthErrorResponse(statusCode: number, message: string, code?: string) {
  return createAuthResponse(statusCode, {
    error: {
      code: code || 'UNKNOWN_ERROR',
      message,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * メールアドレスの形式を検証
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 入力値をサニタイズ
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * リクエストボディを検証
 */
export function validateRequestBody(body: unknown, requiredFields: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    errors.push('リクエストボディが必要です');
    return { isValid: false, errors };
  }

  const bodyObj = body as Record<string, unknown>;
  for (const field of requiredFields) {
    if (!bodyObj[field] || (typeof bodyObj[field] === 'string' && (bodyObj[field] as string).trim() === '')) {
      errors.push(`${field}は必須項目です`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
