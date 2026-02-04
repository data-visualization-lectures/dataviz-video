import { SignJWT } from "jose";

export async function generateStreamToken(videoId: string) {
    const keyId = process.env.CLOUDFLARE_KEY_ID;
    const keyPem = process.env.CLOUDFLARE_KEY_PEM;

    if (!keyId || !keyPem) {
        console.warn("Cloudflare Signing Keys are missing. Signed URL cannot be generated.");
        return null;
    }

    try {
        // PEM needs to be formatted correctly for importPKCS8
        // If it's a one-line string from env, we might need to handle newlines
        const formattedKey = keyPem.replace(/\\n/g, '\n');

        const privateKey = await importPKCS8(formattedKey, 'RS256');

        // Expire in 2 hours
        const expiration = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

        const token = await new SignJWT({
            sub: videoId,
            kid: keyId,
        })
            .setProtectedHeader({ alg: "RS256", kid: keyId })
            .setIssuedAt()
            .setExpirationTime(expiration)
            .setNotBefore(Math.floor(Date.now() / 1000) - 60) // valid from 1 min ago
            .sign(privateKey);

        return token;
    } catch (error) {
        console.error("Error generating stream token:", error);
        return null;
    }
}

async function importPKCS8(pem: string, alg: string) {
    const { importPKCS8 } = await import("jose");
    return importPKCS8(pem, alg);
}
