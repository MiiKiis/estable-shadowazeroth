import { NextResponse } from 'next/server';
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

function normalizeEmail(email: string): string {
    const [user = '', domain = ''] = String(email).toLowerCase().split('@');
    const cleanUser = user.split('+')[0];
    return `${cleanUser}@${domain}`;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates username format (alphanumeric, no spaces)
 */
function isValidUsername(username: string): boolean {
    if (
        username.length < MIN_USERNAME_LENGTH ||
        username.length > MAX_USERNAME_LENGTH
    ) {
        return false;
    }
    // Only alphanumeric characters allowed (WoW standard)
    return /^[a-zA-Z0-9]+$/.test(username);
}

/**
 * Validates password strength
 */
function isValidPassword(password: string): boolean {
    if (
        password.length < MIN_PASSWORD_LENGTH ||
        password.length > MAX_PASSWORD_LENGTH
    ) {
        return false;
    }
    return true;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password, email, pin } = body;
        const originalEmail = String(email || '').trim();
        const normalizedEmail = normalizeEmail(originalEmail);

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

        // 4. Check if user already exists (case-insensitive)
        const connection = await authPool.getConnection();
        try {
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
                // Some AzerothCore schemas do not include email column.
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
            // Prefer storing email when column exists.
            let accountId: number | null = null;
            try {
                const [insertResult]: any = await connection.query(
                    'INSERT INTO account (username, salt, verifier, email, expansion, dp, joindate) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                    [
                        username.toUpperCase(),
                        salt,
                        verifier,
                        String(originalEmail).toLowerCase(),
                        2, // 2 = WotLK expansion (3.3.5a)
                        10 // dp inicial
                    ]
                );
                accountId = Number(insertResult?.insertId || 0) || null;
            } catch (insertError: any) {
                if (insertError.code !== 'ER_BAD_FIELD_ERROR') {
                    throw insertError;
                }

                const [insertResult]: any = await connection.query(
                    'INSERT INTO account (username, salt, verifier, expansion, dp, joindate) VALUES (?, ?, ?, ?, ?, NOW())',
                    [
                        username.toUpperCase(),
                        salt,
                        verifier,
                        2,
                        10 // dp inicial
                    ]
                );
                accountId = Number(insertResult?.insertId || 0) || null;
            }

            if (!accountId) {
                throw new Error('Could not resolve new account ID');
            }

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
                'INSERT INTO account_security_pin (account_id, pin_salt, pin_hash) VALUES (?, ?, ?)',
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

        // Handle specific database errors
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
                message: 'Internal server error. Please try again later.'
            },
            { status: 500 }
        );
    }
}
