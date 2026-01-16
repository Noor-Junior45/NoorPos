
// CLIENT_ID from Env
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export interface GoogleUser {
  accessToken: string;
  spreadsheetId: string;
  profile: {
    name: string;
    email: string;
    picture: string;
  };
}

export interface DriveFile {
    id: string;
    name: string;
    createdTime?: string;
}

// Table Headers Definition
const HEADERS = {
    Products: ['ID', 'Name', 'SKU', 'Sell Price', 'Buy Price', 'Stock', 'Unit', 'Category', 'Location', 'Low Stock', 'Tax', 'Expiry', 'Mfg Date', 'Created At', 'Tag ID'],
    Customers: ['ID', 'Name', 'Phone', 'Email', 'Address', 'Spent', 'Dues', 'Visits', 'Type', 'History JSON', 'Payments JSON'],
    Sales: ['ID', 'Date', 'Customer Name', 'Customer ID', 'Total', 'Subtotal', 'Tax', 'Paid', 'Due', 'Method', 'Items JSON'],
    Tags: ['ID', 'Name', 'Color'],
    Users: ['ID', 'Name', 'Username', 'Role', 'Pin', 'Last Login'],
    Settings: ['Store Name', 'Address', 'Phone', 'Email', 'Logo', 'Currency', 'Tax Name', 'Config JSON'],
    RecycleBin: ['ID', 'Original ID', 'Type', 'Deleted At', 'Data JSON']
};

export const GoogleDriveUtils = {
  
  initGoogleLogin: (clientId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const g = (window as any).google;
      if (!g || !g.accounts || !g.accounts.oauth2) {
        reject(new Error("Google Identity Services script not loaded. Please refresh the page."));
        return;
      }
      try {
          const tokenClient = g.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: SCOPES,
            callback: (response: any) => {
              if (response.error) reject(response);
              else resolve(response.access_token);
            },
            error_callback: (err: any) => reject(err)
          });
          tokenClient.requestAccessToken();
      } catch (e) { reject(e); }
    });
  },

  refreshSession: async (clientId: string): Promise<string> => {
      const newToken = await GoogleDriveUtils.initGoogleLogin(clientId);
      const currentSheetId = localStorage.getItem('google_sheet_id');
      const currentProfile = localStorage.getItem('google_user_profile');
      if (currentSheetId && currentProfile) {
          GoogleDriveUtils.saveSession({
              accessToken: newToken,
              spreadsheetId: currentSheetId,
              profile: JSON.parse(currentProfile)
          });
      }
      return newToken;
  },

  getUserProfile: async (accessToken: string) => {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Failed to fetch user profile.");
    return await response.json();
  },

  findOrCreateFolder: async (accessToken: string, folderName: string, parentId?: string): Promise<string> => {
    let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) query += ` and '${parentId}' in parents`;

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!searchRes.ok) throw new Error(`${searchRes.status}: Folder search failed`);
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

    const body: any = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) body.parents = [parentId];

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!createRes.ok) throw new Error("Failed to create folder");
    const createData = await createRes.json();
    return createData.id;
  },

  ensureSheetsExist: async (accessToken: string, spreadsheetId: string) => {
      // Check existing sheets
      const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!getRes.ok) return; 
      const sheetData = await getRes.json();
      const existingTitles = new Set(sheetData.sheets.map((s: any) => s.properties.title));

      // Create missing sheets
      const requests = [];
      for (const title of Object.keys(HEADERS)) {
          if (!existingTitles.has(title)) {
              requests.push({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } });
          }
      }

      if (requests.length > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ requests })
          });
      }

      // Ensure Headers
      const valueData = [];
      for (const [title, headers] of Object.entries(HEADERS)) {
          valueData.push({ range: `${title}!A1`, values: [headers] });
      }
      
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: valueData })
      });
  },

  findOrCreateBackend: async (accessToken: string): Promise<string> => {
    const folderName = 'NoorPOS_Data';
    const fileName = 'StoreManager_DB';
    
    const folderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, folderName);

    // Search for File in Folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const searchData = await searchRes.json();

    let spreadsheetId = '';

    if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
        await GoogleDriveUtils.ensureSheetsExist(accessToken, spreadsheetId);
    } else {
        // Create New Spreadsheet
        const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                properties: { title: fileName },
                sheets: Object.keys(HEADERS).map(title => ({ properties: { title, gridProperties: { frozenRowCount: 1 } } }))
            }),
        });
        const createData = await createRes.json();
        spreadsheetId = createData.spreadsheetId;

        // Move to folder
        const fileGet = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=parents`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const fileInfo = await fileGet.json();
        const previousParents = fileInfo.parents ? fileInfo.parents.join(',') : '';

        await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}&removeParents=${previousParents}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        await GoogleDriveUtils.ensureSheetsExist(accessToken, spreadsheetId);
    }

    return spreadsheetId;
  },

  // --- SAVE LOGIC (TABLE BASED) ---
  saveToSheet: async (accessToken: string, spreadsheetId: string, data: any) => {
    const bodyData = [];

    // 1. Products
    const productRows = data.products.map((p: any) => [
        p.id, p.name, p.sku, p.sellPrice, p.buyPrice || 0, p.stock, p.unit, p.category || '', 
        p.location || '', p.lowStockThreshold || 10, p.taxRate || 0, p.expiryDate || '', p.manufacturingDate || '', p.createdAt || '', p.tagId || ''
    ]);
    bodyData.push({ range: "Products!A2", values: productRows.length ? productRows : [['']] });

    // 2. Customers
    const customerRows = data.customers.map((c: any) => [
        c.id, c.name, c.phone, c.email || '', c.location || '', c.totalSpent || 0, c.totalDues || 0, c.visitCount || 0, c.isWholesaler ? 'Wholesale' : 'Retail',
        JSON.stringify(c.history || []), JSON.stringify(c.payments || [])
    ]);
    bodyData.push({ range: "Customers!A2", values: customerRows.length ? customerRows : [['']] });

    // 3. Sales
    const salesRows = data.sales.map((s: any) => [
        s.id, s.timestamp, s.customerName, s.customerId || '', s.total, s.subtotal || 0, s.tax || 0, s.amountPaid ?? s.total, (s.total - (s.amountPaid ?? s.total)), s.paymentMethod || 'Cash',
        JSON.stringify(s.items)
    ]);
    bodyData.push({ range: "Sales!A2", values: salesRows.length ? salesRows : [['']] });

    // 4. Tags
    const tagRows = (data.tags || []).map((t: any) => [t.id, t.name, t.color]);
    bodyData.push({ range: "Tags!A2", values: tagRows.length ? tagRows : [['']] });

    // 5. Users
    const userRows = (data.users || []).map((u: any) => [u.id, u.name, u.username, u.role, u.pin, u.lastLogin || '']);
    bodyData.push({ range: "Users!A2", values: userRows.length ? userRows : [['']] });

    // 6. Settings (Single Row)
    const settingsJson = JSON.stringify({
        expiryAlertDays: data.settings.expiryAlertDays,
        soundEnabled: data.settings.soundEnabled,
        notificationsEnabled: data.settings.notificationsEnabled,
        recycleBinRetentionDays: data.settings.recycleBinRetentionDays,
        directPrintEnabled: data.settings.directPrintEnabled,
        scannerPreference: data.settings.scannerPreference,
        nasUrl: data.settings.nasUrl,
        syncToNas: data.settings.syncToNas,
        lowStockDefault: data.settings.lowStockDefault
    });
    const settingRow = [
        data.settings.storeName || '', data.settings.storeAddress || '', data.settings.storePhone || '', data.settings.storeEmail || '', 
        data.settings.logo || '', data.settings.currencySymbol || '₹', '', settingsJson
    ];
    bodyData.push({ range: "Settings!A2", values: [settingRow] });

    // 7. Recycle Bin
    const deletedRows = (data.deletedItems || []).map((d: any) => [
        d.id, d.originalId, d.type, d.deletedAt, JSON.stringify(d.data)
    ]);
    bodyData.push({ range: "RecycleBin!A2", values: deletedRows.length ? deletedRows : [['']] });

    // EXECUTE: Clear old data then write new
    const ranges = Object.keys(HEADERS).map(k => `${k}!A2:ZZ`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges })
    });

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: bodyData })
    });

    if (!res.ok) {
        throw new Error(`${res.status}: Save failed`);
    }
  },

  // --- LOAD LOGIC (Smart Migration) ---
  loadFromSheet: async (accessToken: string, spreadsheetId: string) => {
      // 1. Try to load from Table Format (Products Sheet)
      const ranges = Object.keys(HEADERS).map(k => `${k}!A2:Z`);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?majorDimension=ROWS&ranges=${ranges.join('&ranges=')}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      const valueRanges = json.valueRanges;

      const getSheetRows = (sheetTitle: string) => {
          const range = valueRanges.find((r: any) => r.range.startsWith(sheetTitle));
          return range ? (range.values || []) : [];
      };

      const productRows = getSheetRows('Products');

      // --- MIGRATION CHECK ---
      // If Products sheet is empty, check for old "RawData" blob to restore it
      if (!productRows || productRows.length === 0) {
          try {
              const rawRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RawData!A1`, {
                  headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (rawRes.ok) {
                  const rawJson = await rawRes.json();
                  if (rawJson.values && rawJson.values[0] && rawJson.values[0][0]) {
                      console.log("Migrating from Legacy RawData format...");
                      return JSON.parse(rawJson.values[0][0]); // Return old structure, it will be saved as new Table structure next time
                  }
              }
          } catch (e) { console.warn("No legacy data found"); }
      }
      // -----------------------

      // Parse Tables
      const products = productRows.map((r: any[]) => ({
          id: r[0], name: r[1], sku: r[2], sellPrice: parseFloat(r[3]) || 0, buyPrice: parseFloat(r[4]) || 0,
          stock: parseFloat(r[5]) || 0, unit: r[6], category: r[7], location: r[8],
          lowStockThreshold: parseInt(r[9]) || 10, taxRate: parseFloat(r[10]) || 0,
          expiryDate: r[11], manufacturingDate: r[12], createdAt: r[13], tagId: r[14]
      })).filter((p: any) => p.id);

      const customers = getSheetRows('Customers').map((r: any[]) => {
          let history = [], payments = [];
          try { history = JSON.parse(r[9] || '[]'); } catch {}
          try { payments = JSON.parse(r[10] || '[]'); } catch {}
          return {
              id: r[0], name: r[1], phone: r[2], email: r[3], location: r[4],
              totalSpent: parseFloat(r[5]) || 0, totalDues: parseFloat(r[6]) || 0, visitCount: parseInt(r[7]) || 0,
              isWholesaler: r[8] === 'Wholesale', history, payments
          };
      }).filter((c: any) => c.id);

      const sales = getSheetRows('Sales').map((r: any[]) => {
          let items = [];
          try { items = JSON.parse(r[10] || '[]'); } catch {}
          return {
              id: r[0], timestamp: r[1], customerName: r[2], customerId: r[3],
              total: parseFloat(r[4]) || 0, subtotal: parseFloat(r[5]) || 0, tax: parseFloat(r[6]) || 0,
              amountPaid: parseFloat(r[7]), paymentMethod: r[9], items
          };
      }).filter((s: any) => s.id);

      const tags = getSheetRows('Tags').map((r: any[]) => ({ id: r[0], name: r[1], color: r[2] })).filter((t: any) => t.id);

      const users = getSheetRows('Users').map((r: any[]) => ({
          id: r[0], name: r[1], username: r[2], role: r[3], pin: r[4], lastLogin: r[5]
      })).filter((u: any) => u.id);

      const sRow = getSheetRows('Settings')[0] || [];
      let extraSettings: any = {};
      try { extraSettings = JSON.parse(sRow[7] || '{}'); } catch {}
      const settings = {
          storeName: sRow[0] || '', storeAddress: sRow[1] || '', storePhone: sRow[2] || '', storeEmail: sRow[3] || '',
          logo: sRow[4] || '', currencySymbol: sRow[5] || '₹',
          ...extraSettings
      };

      const deletedItems = getSheetRows('RecycleBin').map((r: any[]) => {
          let data = null;
          try { data = JSON.parse(r[4]); } catch {}
          return { id: r[0], originalId: r[1], type: r[2], deletedAt: r[3], data };
      }).filter((d: any) => d.id && d.data);

      return { products, customers, sales, tags, users, settings, deletedItems };
  },

  // --- BACKUP METHODS ---
  createCloudBackup: async (accessToken: string, data: any): Promise<void> => {
      const rootFolderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, 'NoorPOS_Data');
      const backupFolderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, 'Backups', rootFolderId);
      const fileName = `noor_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const metadataBlob = new Blob([JSON.stringify({ name: fileName, parents: [backupFolderId] })], { type: 'application/json' });
      const form = new FormData();
      form.append('metadata', metadataBlob);
      form.append('file', file);

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form
      });
      if (!res.ok) throw new Error(`${res.status}: Backup failed`);
  },

  listCloudBackups: async (accessToken: string): Promise<DriveFile[]> => {
      const rootFolderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, 'NoorPOS_Data');
      const backupFolderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, 'Backups', rootFolderId);
      const query = `'${backupFolderId}' in parents and mimeType = 'application/json' and trashed = false`;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&fields=files(id, name, createdTime)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error(`${res.status}: Failed to list backups`);
      const data = await res.json();
      return data.files || [];
  },

  downloadBackupFile: async (accessToken: string, fileId: string): Promise<any> => {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error("Failed to download backup");
      return await res.json();
  },

  shareDatabase: async (accessToken: string, spreadsheetId: string, email: string) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?emailMessage=You have been invited to manage Noor POS Store.&sendNotificationEmail=true`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email })
    });
    if (!res.ok) throw new Error(`Sharing failed: ${res.statusText}`);
    return true;
  },

  saveSession: (data: GoogleUser) => {
    localStorage.setItem('google_access_token', data.accessToken);
    localStorage.setItem('google_sheet_id', data.spreadsheetId);
    localStorage.setItem('google_user_profile', JSON.stringify(data.profile));
  },

  getSession: () => {
    const token = localStorage.getItem('google_access_token');
    const sheetId = localStorage.getItem('google_sheet_id');
    const profile = localStorage.getItem('google_user_profile');
    if (token && sheetId && profile) {
      return { accessToken: token, spreadsheetId: sheetId, profile: JSON.parse(profile) };
    }
    return null;
  },

  clearSession: () => {
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_sheet_id');
      localStorage.removeItem('google_user_profile');
  }
};
