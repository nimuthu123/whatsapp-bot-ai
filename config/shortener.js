// config/shortener.js
const API_URL = 'https://blueshort.eu.cc/api/v1/shorten';
const API_KEY = 'your_secure_api_key_here'; // මෙතැනට ඔබේ API Key එක ඇතුලත් කරන්න

export async function createShortUrl(longUrl) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ longUrl })
    });

    const data = await response.json();
    return data.success ? data.shortUrl : null; // කෙටි කළ URL එක පමණක් ලබා දෙයි
  } catch (error) {
    console.error('URL Shortening Failed:', error.message);
    return null;
  }
}