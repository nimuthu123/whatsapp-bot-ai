import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Contact list mapping phone numbers and LIDs to their names
export const CONTACTS = {};

// Load contacts from environment variable
if (process.env.CONTACTS_MAP) {
    try {
        Object.assign(CONTACTS, JSON.parse(process.env.CONTACTS_MAP));
        console.log('✅ Contacts loaded from environment');
    } catch (e) {
        console.error('❌ Failed to parse CONTACTS_MAP from environment:', e);
    }
}

// Optional: Load contacts from file
try {
    const contactsFile = path.join(rootDir, 'contacts.json');
    if (fs.existsSync(contactsFile)) {
        const fileContacts = JSON.parse(fs.readFileSync(contactsFile, 'utf8'));
        Object.assign(CONTACTS, fileContacts);
        console.log('✅ Contacts loaded from file:', contactsFile);
    }
} catch (err) {
    // File doesn't exist or invalid JSON - this is fine
    console.log('ℹ️ No contacts.json file found, using environment contacts only');
}

export default CONTACTS;