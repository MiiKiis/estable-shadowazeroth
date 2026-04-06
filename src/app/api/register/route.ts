import { NextRequest, NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { generateSrp6Data } from '@/lib/srp6';
import crypto from 'crypto';
import { sendPinReminderEmail } from '@/lib/email';

// Validation constants
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 16;
const ACCOUNT_PIN_REGEX = /^\d{4}$/;

// reCAPTCHA v3 secret key (set in .env.local)
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_MIN_SCORE = 0.5;

function normalizeEmail(email: string): string {
    const [user = '', domain = ''] = String(email).toLowerCase().split('@');
    const cleanUser = user.split('+')[0];
    return `${cleanUser}@${domain}`;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username: string): boolean {
    if (
        username.length < MIN_USERNAME_LENGTH ||
        username.length > MAX_USERNAME_LENGTH
    ) {
        return false;
    }
    return /^[a-zA-Z0-9]+$/.test(username);
}

function isValidPassword(password: string): boolean {
    if (
        password.length < MIN_PASSWORD_LENGTH ||
        password.length > MAX_PASSWORD_LENGTH
    ) {
        return false;
    }
    return true;
}

// ─── Get real client IP (behind proxy / Cloudflare / nginx) ──────────────────
function getClientIp(request: NextRequest): string {
    const headers = request.headers;
    
    // Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For > request.ip
    const cfIp = headers.get('cf-connecting-ip');
    if (cfIp) return cfIp.trim();

    const realIp = headers.get('x-real-ip');
    if (realIp) return realIp.trim();

    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
        // First IP in the chain is the real client
        const first = forwardedFor.split(',')[0]?.trim();
        if (first && first !== '127.0.0.1' && first !== '::1') return first;
    }

    // Next.js specific connection IP
    const nextIp = (request as any).ip;
    if (nextIp && nextIp !== '127.0.0.1' && nextIp !== '::1') return nextIp;

    // Fallback
    return '0.0.0.0';
}

// ─── Verify reCAPTCHA token (supports v2 and v3) ────────────────────────────
async function verifyRecaptcha(token: string): Promise<{ success: boolean; score: number; errorCodes?: any }> {
    if (!RECAPTCHA_SECRET) {
        // If not configured, allow registration (dev mode)
        console.warn('RECAPTCHA_SECRET_KEY not set, skipping verification');
        return { success: true, score: 1.0 };
    }

    if (!token || token.trim() === '') {
        console.warn('reCAPTCHA: No token provided');
        return { success: false, score: 0, errorCodes: 'missing-input-response' };
    }

    try {
        const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
        });
        const data = await res.json();
        console.log('reCAPTCHA verify response:', JSON.stringify(data));

        // v3 returns a score (0.0 to 1.0), v2 only returns success: true/false
        const hasScore = typeof data.score === 'number';
        const isSuccess = Boolean(data.success);
        const score = Number(data.score || 0);
        const errorCodes = data['error-codes']?.join(',') || '';

        if (hasScore) {
            // v3 mode: check score threshold
            return {
                success: isSuccess && score >= RECAPTCHA_MIN_SCORE,
                score,
                errorCodes,
            };
        } else {
            // v2 mode: just check success boolean
            return {
                success: isSuccess,
                score: isSuccess ? 1.0 : 0,
                errorCodes,
            };
        }
    } catch (err) {
        console.error('reCAPTCHA fetch error:', err);
        return { success: false, score: 0 };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password, email, pin, recaptchaToken } = body;
        const originalEmail = String(email || '').trim();
        const normalizedEmail = normalizeEmail(originalEmail);

        // ── 0. reCAPTCHA verification ────────────────────────────
        if (RECAPTCHA_SECRET) {
            const captchaResult = await verifyRecaptcha(String(recaptchaToken || ''));
            if (!captchaResult.success) {
                const debugStr = `T:${recaptchaToken ? 'Si' : 'No'} | S:${captchaResult.score} | E:${captchaResult.errorCodes || 'N/A'}`;
                return NextResponse.json(
                    {
                        success: false,
                        message: `Verificación anti-bot fallida (${debugStr}). Recarga la página e intenta de nuevo.`,
                        score: captchaResult.score,
                    },
                    { status: 403 }
                );
            }
        }

        // 1. Validate required fields
        if (!username || !password || !email || !pin) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Username, password, email and PIN are required'
                },
                { status: 400 }
            );
        }

        // 2. Validate username format
        if (!isValidUsername(username)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters and contain only letters and numbers`
                },
                { status: 400 }
            );
        }

        // 3. Validate password strength
        if (!isValidPassword(password)) {
            return NextResponse.json(
                {
                    success: false,
                    message: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`
                },
                { status: 400 }
            );
        }

        if (!isValidEmail(originalEmail)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Email format is invalid'
                },
                { status: 400 }
            );
        }

        const normalizedPin = String(pin).trim();
        if (!ACCOUNT_PIN_REGEX.test(normalizedPin)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'PIN must be exactly 4 digits'
                },
                { status: 400 }
            );
        }

        // ── 3.5. Get real IP for anti-spam ───────────────────────
        const clientIp = getClientIp(request);

        // 4. Check if user already exists + IP anti-spam
        const connection = await authPool.getConnection();
        try {
            // ── IP ANTI-SPAM: Max 1 account per IP per 24h ───────
            // Ensure last_ip column exists
            try {
                await connection.query('ALTER TABLE account ADD COLUMN last_ip VARCHAR(45) NULL');
            } catch { /* already exists */ }
            // Ensure reg_ip column exists (used specifically for registration tracking)
            try {
                await connection.query('ALTER TABLE account ADD COLUMN reg_ip VARCHAR(45) NULL');
            } catch { /* already exists */ }

            if (clientIp && clientIp !== '0.0.0.0') {
                const [ipCheckRows]: any = await connection.query(
                    `SELECT COUNT(*) AS cnt FROM account
                     WHERE last_ip = ? AND joindate >= NOW() - INTERVAL 1 DAY`,
                    [clientIp]
                );
                const recentRegistrations = Number(ipCheckRows?.[0]?.cnt || 0);
                if (recentRegistrations >= 3) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: 'Has alcanzado el límite de 3 cuentas por día para tu conexión (IP).'
                        },
                        { status: 429 }
                    );
                }
            }

            let existing: any[] = [];
            try {
                const [rows]: any = await connection.query(
                    'SELECT id FROM account WHERE UPPER(username) = UPPER(?) OR LOWER(email) = LOWER(?)',
                    [username, originalEmail]
                );
                existing = rows;

                const [emailCountRows]: any = await connection.query(
                    `SELECT COUNT(*) AS total
                     FROM account
                     WHERE LOWER(
                        CONCAT(
                            SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(email, ''), '@', 1), '+', 1),
                            '@',
                            SUBSTRING_INDEX(COALESCE(email, ''), '@', -1)
                        )
                     ) = ?`,
                    [normalizedEmail]
                );

                const totalByBaseEmail = Number(emailCountRows?.[0]?.total || 0);
                if (totalByBaseEmail >= 3) {
                    return NextResponse.json(
                        {
                            success: false,
                            message: 'Solo se permiten 2 cuentas adicionales por correo principal'
                        },
                        { status: 409 }
                    );
                }
            } catch (checkError: any) {
                if (checkError.code !== 'ER_BAD_FIELD_ERROR') {
                    throw checkError;
                }

                const [rows]: any = await connection.query(
                    'SELECT id FROM account WHERE UPPER(username) = UPPER(?)',
                    [username]
                );
                existing = rows;
            }

            if (existing.length > 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'Username or email already exists'
                    },
                    { status: 409 }
                );
            }

            // 5. Generate SRP6 credentials
            const { salt, verifier } = generateSrp6Data(username, password);

            // 6. Insert into account table
            // ── NO INITIAL VP/DP — Estelas se ganan por niveles, DP por donación ──
            let accountId: number | null = null;
            try {
                const [insertResult]: any = await connection.query(
                    'INSERT INTO account (username, salt, verifier, email, expansion, dp, vp, reg_ip, last_ip, joindate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                    [
                        username.toUpperCase(),
                        salt,
                        verifier,
                        String(originalEmail).toLowerCase(),
                        2, // 2 = WotLK expansion (3.3.5a)
                        0,  // dp = 0 (only via real donations)
                        0,  // vp = 0 (earned by leveling up)
                        clientIp, // reg_ip
                        clientIp  // last_ip
                    ]
                );
                accountId = Number(insertResult?.insertId || 0) || null;
            } catch (insertError: any) {
                if (insertError.code !== 'ER_BAD_FIELD_ERROR') {
                    throw insertError;
                }

                const [insertResult]: any = await connection.query(
                    'INSERT INTO account (username, salt, verifier, expansion, dp, vp, joindate) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                    [
                        username.toUpperCase(),
                        salt,
                        verifier,
                        2,
                        0,  // dp = 0
                        0   // vp = 0
                    ]
                );
                accountId = Number(insertResult?.insertId || 0) || null;
            }

            if (!accountId) {
                throw new Error('Could not resolve new account ID');
            }

            // Update reg_ip (best effort, silently fail if column doesn't exist)
            try {
                await connection.query(
                    'UPDATE account SET reg_ip = ?, last_ip = ? WHERE id = ?',
                    [clientIp, clientIp, accountId]
                );
            } catch { /* column may not exist in some schemas */ }

            await connection.query(`
                CREATE TABLE IF NOT EXISTS account_security_pin (
                    account_id INT UNSIGNED NOT NULL,
                    pin_salt VARBINARY(32) NOT NULL,
                    pin_hash VARBINARY(32) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (account_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);

            const pinSalt = crypto.randomBytes(32);
            const pinHash = crypto
                .createHash('sha256')
                .update(pinSalt)
                .update(normalizedPin)
                .digest();

            await connection.query(
                'INSERT INTO account_security_pin (account_id, pin_salt, pin_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pin_salt = VALUES(pin_salt), pin_hash = VALUES(pin_hash)',
                [accountId, pinSalt, pinHash]
            );

            try {
                await sendPinReminderEmail(
                    originalEmail,
                    String(username).toUpperCase(),
                    normalizedPin
                );
            } catch (mailError) {
                console.error('PIN reminder email error:', mailError);
            }

            return NextResponse.json(
                {
                    success: true,
                    message: 'Account created successfully! You can now login with your credentials.'
                },
                { status: 201 }
            );
        } finally {
            connection.release();
        }
    } catch (error: any) {
        console.error('Registration Error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Username or email already exists'
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: `Internal server error: ${error.message || 'Unknown error'}`
            },
            { status: 500 }
        );
    }
}
