import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const DB_FILENAME = 'glassstore_db.json';
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

// Helper to authenticate
async function getAuth(req) {
  // 1. Try Headers (Client-provided via Profile tab)
  const headerEmail = req.headers['x-google-email'];
  const headerKey = req.headers['x-google-key'];

  // 2. Fallback to server env vars (optional)
  let clientEmail = headerEmail || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = headerKey || process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    // If no credentials provided, return null (treat as offline/unconfigured)
    return null;
  }

  try {
    // Handle newlines in private key (restore from escaped string)
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const jwtClient = new google.auth.JWT(
      clientEmail,
      null,
      formattedKey,
      SCOPES
    );
    await jwtClient.authorize();
    return jwtClient;
  } catch (err) {
    console.error("Authentication failed:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS Check
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const auth = await getAuth(req);
    
    // --- LOCAL MODE (No Google Auth Configured) ---
    if (!auth) {
      if (req.method === 'GET') {
        try {
          const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
          return res.status(200).json(JSON.parse(data));
        } catch (e) {
          // File doesn't exist yet or error reading, return null to trigger frontend init
          return res.status(200).json(null);
        }
      }

      if (req.method === 'POST') {
        try {
          await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(req.body, null, 2));
          return res.status(200).json({ success: true, mode: 'local' });
        } catch (e) {
          console.error("Local write error:", e);
          return res.status(500).json({ error: "Failed to save locally" });
        }
      }
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- GOOGLE DRIVE MODE (Service Account Configured) ---
    const drive = google.drive({ version: 'v3', auth });

    // 1. Check if file exists
    let fileId = null;
    try {
      const listRes = await drive.files.list({
        q: `name = '${DB_FILENAME}' and trashed = false`,
        fields: 'files(id, name)',
      });
      if (listRes.data.files && listRes.data.files.length > 0) {
        fileId = listRes.data.files[0].id;
      }
    } catch (listErr) {
      console.warn("Drive List Error:", listErr.message);
      return res.status(200).json(null); 
    }

    // --- READ OPERATION ---
    if (req.method === 'GET') {
      if (!fileId) {
        // No file yet, return null (client handles initialization)
        return res.status(200).json(null);
      }

      const fileRes = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      return res.status(200).json(fileRes.data);
    }

    // --- WRITE OPERATION ---
    if (req.method === 'POST') {
      const data = req.body;
      
      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(data, null, 2)
      };

      if (fileId) {
        // Update existing
        await drive.files.update({
          fileId: fileId,
          media: media,
        });
      } else {
        // Create new
        await drive.files.create({
          resource: {
            name: DB_FILENAME,
            mimeType: 'application/json'
          },
          media: media,
        });
      }
      
      return res.status(200).json({ success: true, mode: 'cloud' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error("Storage API Error:", error);
    // Return 500 only on unexpected critical errors
    res.status(500).json({ error: error.message || "Storage Error" });
  }
}