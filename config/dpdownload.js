// config/dpdownload.js
export async function getProfilePicBuffer(sock, phoneNumber) {
    try {
        const jid = phoneNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        
        // Use the passed sock instead of global.sock
        const ppUrl = await sock.profilePictureUrl(jid, 'image');
        
        const response = await fetch(ppUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error("DP error:", error);
        return null;
    }
}