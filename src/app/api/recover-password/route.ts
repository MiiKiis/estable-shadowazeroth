import { NextRequest, NextResponse } from 'next/server';
import { authPool } from '@/lib/db';
import { generateSrp6Data } from '@/lib/srp6';
import crypto from 'crypto';
import { sendPasswordRecoveryEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, pin, username } = body;

        if (!email || !pin || !username) {
            return NextResponse.json(
                { success: false, message: 'El nombre de usuario, correo electrónico y PIN son requeridos.' },
                { status: 400 }
            );
        }

        const normalizedPin = String(pin).trim();
        if (!/^[0-9]{4}$/.test(normalizedPin)) {
            return NextResponse.json(
                { success: false, message: 'El PIN debe ser de 4 dígitos.' },
                { status: 400 }
            );
        }

        const connection = await authPool.getConnection();
        try {
            // Find account by email and username
            const [accountRows]: any = await connection.query(
                'SELECT id, username, email FROM account WHERE LOWER(email) = LOWER(?) AND UPPER(username) = UPPER(?)',
                [email, username]
            );

            if (accountRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'No se encontró ninguna cuenta con ese usuario y correo combinados.' },
                    { status: 404 }
                );
            }

            const account = accountRows[0];
            const accountId = account.id;

            // Find PIN
            const [pinRows]: any = await connection.query(
                'SELECT pin_salt, pin_hash FROM account_security_pin WHERE account_id = ?',
                [accountId]
            );

            if (pinRows.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'Esta cuenta no tiene configurado un PIN de seguridad. Contacta a un administrador en Discord.' },
                    { status: 400 }
                );
            }

            const { pin_salt, pin_hash } = pinRows[0];

            // Verify PIN
            const hashedInput = crypto
                .createHash('sha256')
                .update(pin_salt)
                .update(normalizedPin)
                .digest();

            if (!crypto.timingSafeEqual(pin_hash, hashedInput)) {
                return NextResponse.json(
                    { success: false, message: 'El PIN de seguridad proporcionado es incorrecto.' },
                    { status: 401 }
                );
            }

            // Generate a secure 12-char alphanumeric token
            const newToken = crypto.randomBytes(6).toString('hex').toLowerCase(); 

            // Update Auth SRP6
            const { salt, verifier } = generateSrp6Data(account.username, newToken);

            await connection.query(
                'UPDATE account SET salt = ?, verifier = ? WHERE id = ?',
                [salt, verifier, accountId]
            );

            // Send Email
            try {
                await sendPasswordRecoveryEmail({
                    email: account.email,
                    username: account.username,
                    newToken: newToken
                });
            } catch (emailError) {
                console.error("Error al enviar email pero pass actualizada:", emailError);
                return NextResponse.json(
                    { success: false, message: 'No se pudo enviar el correo a esa cuenta. Contacta un administrador.' },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Contraseña recuperada exitosamente.'
            });

        } finally {
            connection.release();
        }
    } catch (error: any) {
        console.error('Password recovery error:', error);
        return NextResponse.json(
            { success: false, message: 'Ocurrió un error interno al intentar recuperar la cuenta.' },
            { status: 500 }
        );
    }
}
