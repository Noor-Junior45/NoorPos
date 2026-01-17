
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const DB_FILENAME = 'glassstore_db.json';
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

// Helper to authenticate
async function getAuth(req) {
  const headerEmail = req.headers['x-google-email'];
  const headerKey = req.headers['x-google-key'];
  let clientEmail = headerEmail || process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = headerKey || process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) return null;

  try {
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    const jwtClient = new google.auth.JWT(clientEmail, null, formattedKey, SCOPES);
    await jwtClient.authorize();
    return jwtClient;
  } catch (err) {
    console.error("Authentication failed:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { publicSaleId } = req.query;

  try {
    // --- PUBLIC READ MODE (No Auth Required) ---
    if (req.method === 'GET' && publicSaleId) {
        let dbData = null;
        try {
            const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
            dbData = JSON.parse(data);
        } catch (e) {
            // If local fails, we might be in cloud mode but public access to cloud without key is restricted
            // In a real app, we'd need a service account key to read the shared sheet.
            return res.status(404).json({ error: "Invoice storage not accessible." });
        }

        if (dbData && dbData.sales) {
            const sale = dbData.sales.find(s => s.id === publicSaleId);
            if (sale) {
                // Return only necessary fields plus store settings for branding
                return res.status(200).json({ 
                    sale, 
                    settings: dbData.settings 
                });
            }
        }
        return res.status(404).json({ error: "Invoice not found." });
    }

    const auth = await getAuth(req);
    
    // --- LOCAL MODE ---
    if (!auth) {
      if (req.method === 'GET') {
        try {
          const data = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
          return res.status(200).json(JSON.parse(data));
        } catch (e) {
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

    // --- GOOGLE DRIVE MODE ---
    const drive = google.drive({ version: 'v3', auth });
    let fileId = null;
    try {
      const listRes = await drive.files.list({
        q: `name = '${DB_FILENAME}' and trashed = false`,
        fields: 'files(id, name)',
      });
      if (listRes.data.files && listRes.data.files.length > 0) fileId = listRes.data.files[0].id;
    } catch (listErr) {
      return res.status(200).json(null); 
    }

    if (req.method === 'GET') {
      if (!fileId) return res.status(200).json(null);
      const fileRes = await drive.files.get({ fileId: fileId, alt: 'media' });
      return res.status(200).json(fileRes.data);
    }

    if (req.method === 'POST') {
      const media = { mimeType: 'application/json', body: JSON.stringify(req.body, null, 2) };
      if (fileId) await drive.files.update({ fileId: fileId, media: media });
      else await drive.files.create({ resource: { name: DB_FILENAME, mimeType: 'application/json' }, media: media });
      return res.status(200).json({ success: true, mode: 'cloud' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("Storage API Error:", error);
    res.status(500).json({ error: error.message || "Storage Error" });
  }
}
