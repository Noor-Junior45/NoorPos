
// CLIENT_ID is now expected to be provided via Environment Variable
// Scopes: drive.file (create/open files), spreadsheets (read/write sheets), userinfo (profile data)
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

const headers = ['ID', 'Product Name', 'SKU', 'Price', 'Stock', 'Unit', 'Category'];
const settingsHeaders = ['Store Name', 'Address', 'Phone', 'Email', 'Last Updated'];
const customerHeaders = ['ID', 'Name', 'Phone', 'Total Spent', 'Dues', 'Visits', 'Wholesaler'];
const salesHeaders = ['Invoice ID', 'Date', 'Customer', 'Total', 'Payment Method', 'Items Count'];

export const GoogleDriveUtils = {
  
  /**
   * Initializes the Google Token Client and requests access.
   */
  initGoogleLogin: (clientId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Safely access google object on window
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
              if (response.error) {
                reject(response);
              } else {
                resolve(response.access_token);
              }
            },
            error_callback: (err: any) => {
                reject(err);
            }
          });

          // Request token (triggers popup)
          tokenClient.requestAccessToken();
      } catch (e) {
          reject(e);
      }
    });
  },

  getUserProfile: async (accessToken: string) => {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Profile API Error:", response.status, errorText);
        throw new Error("Failed to fetch user profile. Scopes might be missing.");
    }
    return await response.json();
  },

  /**
   * Helper to find or create a specific folder
   */
  findOrCreateFolder: async (accessToken: string, folderName: string): Promise<string> => {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
    }

    // Create Folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });
    const createData = await createRes.json();
    return createData.id;
  },

  /**
   * Finds 'StoreManager_DB' or creates it with 'Products', 'Settings', 'Customers', 'Sales', and 'RawData' sheets inside the 'NoorPOS_Data' folder.
   */
  findOrCreateBackend: async (accessToken: string): Promise<string> => {
    const folderName = 'NoorPOS_Data';
    const fileName = 'StoreManager_DB';
    
    // 1. GLOBAL SEARCH FIRST (Crucial for Staff Access)
    // Search for the file anywhere (Shared with me OR Owned by me)
    const globalSearchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id, name, sharedWithMe)`;
    const globalSearchRes = await fetch(globalSearchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (globalSearchRes.ok) {
        const globalData = await globalSearchRes.json();
        // If found, return immediately. This handles the case where Admin shared the file with Staff.
        if (globalData.files && globalData.files.length > 0) {
            console.log("Found existing database (Global/Shared):", globalData.files[0].id);
            return globalData.files[0].id;
        }
    }

    // --- ONLY IF NOT FOUND GLOBALLY, CREATE NEW IN FOLDER ---

    // 2. Get Folder ID (Create if doesn't exist)
    const folderId = await GoogleDriveUtils.findOrCreateFolder(accessToken, folderName);

    // 3. Search for File INSIDE Folder (Double check to avoid duplicates)
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${folderId}' in parents and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(`Drive Search Failed: ${err?.error?.message || searchRes.statusText}`);
    }
    const searchData = await searchRes.json();

    let spreadsheetId = '';

    if (searchData.files && searchData.files.length > 0) {
      spreadsheetId = searchData.files[0].id;
    } else {
      // 4. Create if not found inside the folder
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: fileName },
          sheets: [
            { properties: { title: 'Products', gridProperties: { frozenRowCount: 1 } } },
            { properties: { title: 'Customers', gridProperties: { frozenRowCount: 1 } } },
            { properties: { title: 'Sales', gridProperties: { frozenRowCount: 1 } } },
            { properties: { title: 'Settings', gridProperties: { frozenRowCount: 1 } } },
            { properties: { title: 'RawData' } } // Hidden sheet for full state
          ]
        }),
      });

      if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(`Sheet Creation Failed: ${err?.error?.message || createRes.statusText}`);
      }
      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;

      // Move file to folder
      // Step 4a: Retrieve current parents
      const fileGet = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=parents`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });
      const fileInfo = await fileGet.json();
      const previousParents = fileInfo.parents ? fileInfo.parents.join(',') : '';

      // Step 4b: Move to new folder
      await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${folderId}&removeParents=${previousParents}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` }
      });

      // 5. Add Headers to Sheets
      const headerUpdates = [
          { range: 'Products!A1:G1', values: [headers] },
          { range: 'Customers!A1:G1', values: [customerHeaders] }, // Updated range for extra column
          { range: 'Sales!A1:F1', values: [salesHeaders] },
          { range: 'Settings!A1:E1', values: [settingsHeaders] }
      ];

      for (const h of headerUpdates) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${h.range}?valueInputOption=USER_ENTERED`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: h.values })
          });
      }
    }

    // Ensure all tabs exist (for legacy file migration)
    try {
        const metadataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (metadataRes.ok) {
            const metadata = await metadataRes.json();
            const existingTitles = metadata.sheets.map((s: any) => s.properties.title);
            
            const requiredSheets = ['Products', 'Customers', 'Sales', 'Settings', 'RawData'];
            const requests = [];

            requiredSheets.forEach(title => {
                if (!existingTitles.includes(title)) {
                    requests.push({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
                    });
                }
            });

            if (requests.length > 0) {
                await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requests })
                });
            }
        }
    } catch (e) {
        console.warn("Failed to check/create sheet structure", e);
    }

    return spreadsheetId;
  },

  /**
   * Shares the database file with another email address.
   */
  shareDatabase: async (accessToken: string, spreadsheetId: string, email: string) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?emailMessage=You have been invited to manage Noor POS Store.&sendNotificationEmail=true`, {
        method: 'POST',
        headers: { 
            Authorization: `Bearer ${accessToken}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            role: 'writer',
            type: 'user',
            emailAddress: email
        })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Sharing failed: ${err?.error?.message || res.statusText}`);
    }
    return true;
  },

  /**
   * Saves the entire application state to the Google Sheet.
   * Syncs: Products, Customers, Sales History, Settings, and Raw Data Blob.
   */
  saveToSheet: async (accessToken: string, spreadsheetId: string, data: any) => {
    // 1. Prepare Product Rows
    const productRows = data.products.map((p: any) => [
        p.id, p.name, p.sku, p.sellPrice, p.stock, p.unit, p.category || ''
    ]);

    // 2. Prepare Customer Rows (Added isWholesaler boolean)
    const customerRows = data.customers.map((c: any) => [
        c.id, c.name, c.phone, c.totalSpent, c.totalDues, c.visitCount, c.isWholesaler ? 'Yes' : 'No'
    ]);

    // 3. Prepare Sales Rows (Most recent first)
    const salesRows = data.sales.map((s: any) => [
        s.id, new Date(s.timestamp).toLocaleDateString(), s.customerName, s.total, s.paymentMethod, s.items.length
    ]);

    // 4. Prepare Settings Row
    const settingsRow = [
        data.settings?.storeName || '',
        data.settings?.storeAddress || '',
        data.settings?.storePhone || '',
        data.settings?.storeEmail || '',
        new Date().toLocaleString()
    ];

    // 5. Prepare Raw JSON blob (Essential for full app state recovery including tags, complex objects)
    const jsonBlob = JSON.stringify(data);
    
    const body = {
        valueInputOption: "USER_ENTERED",
        data: [
            { range: "Products!A2", values: productRows.length ? productRows : [['']] },
            { range: "Customers!A2", values: customerRows.length ? customerRows : [['']] },
            { range: "Sales!A2", values: salesRows.length ? salesRows : [['']] },
            { range: "Settings!A2", values: [settingsRow] },
            { range: "RawData!A1", values: [[jsonBlob]] }
        ]
    };

    // 6. Clear existing content first (except headers)
    const clearRanges = ['Products!A2:Z', 'Customers!A2:Z', 'Sales!A2:Z', 'Settings!A2:Z', 'RawData!A1:Z'];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranges: clearRanges })
    });

    // 7. Batch Update with new data
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Save failed: ${err?.error?.message || res.statusText}`);
    }
  },

  /**
   * Loads data from the Sheet. Preferentially reads 'RawData' for full fidelity.
   */
  loadFromSheet: async (accessToken: string, spreadsheetId: string) => {
      // Try reading RawData first
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RawData!A1`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
          console.warn("Load failed details:", res.status, res.statusText);
          throw new Error(`Cloud fetch failed: ${res.statusText}`);
      }
      
      const json = await res.json();
      
      if (json.values && json.values[0] && json.values[0][0]) {
          try {
              return JSON.parse(json.values[0][0]);
          } catch (e) {
              console.error("Failed to parse remote JSON", e);
              // We return null here to indicate empty/corrupt data, handled by caller
              return null;
          }
      }
      return null;
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
