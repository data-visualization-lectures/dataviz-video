import { SignJWT } from "jose";
import { createPrivateKey } from "crypto";

export async function generateStreamToken(videoId: string) {
    const keyId = process.env.CLOUDFLARE_KEY_ID;
    const keyPem = process.env.CLOUDFLARE_KEY_PEM;

    if (!keyId || !keyPem) {
        console.warn("Cloudflare Signing Keys are missing. Signed URL cannot be generated.");
        return null;
    }

    try {
        let formattedKey = keyPem;

        // If the key doesn't start with the standard PEM header, assume it's Base64 encoded
        if (!keyPem.includes("-----BEGIN")) {
            try {
                formattedKey = Buffer.from(keyPem, 'base64').toString('utf-8');
            } catch (e) {
                console.warn("Failed to decode base64 key, attempting to use as-is.", e);
            }
        }

        // Handle escaped newlines
        formattedKey = formattedKey.replace(/\\n/g, '\n');

        // Use Node.js crypto to import the key (handles both PKCS#1 and PKCS#8)
        const privateKey = createPrivateKey({
            key: formattedKey,
            format: 'pem',
        });

        // Expire in 2 hours
        const expiration = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

        const token = await new SignJWT({
            sub: videoId,
            kid: keyId,
        })
            .setProtectedHeader({ alg: "RS256", kid: keyId })
            .setIssuedAt()
            .setExpirationTime(expiration)
            .setNotBefore(Math.floor(Date.now() / 1000) - 60)
            .sign(privateKey);

        return token;
    } catch (error) {
        console.error("Error generating stream token:", error);
        return null; // Return null so we can fallback or handle error
    }
}
