// config/download.js
import axios from 'axios';

export async function getFileStream(fileUrl) {
    try {
        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
        });

        return {
            stream: response.data,
            mimetype: response.headers['content-type'] // ගොනුවේ වර්ගය මෙතැනින් ලැබේ
        };
    } catch (error) {
        console.error("❌ Download stream error:", error);
        return null;
    }
}