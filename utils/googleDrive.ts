// CLIENT_ID is now expected to be provided via Environment Variable
// Scopes: drive.file (create/open files), spreadsheets (read/write sheets)
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

export interface GoogleUser {
  accessToken: string;
  spreadsheetId: string;
  profile: {
    name: string;
    email: string;
    picture: string;
  };
}

export const GoogleDriveUtils = {
  
  /**
   * Initializes the Google Token Client and requests access.
   */
  initGoogleLogin: (clientId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      if (typeof google === 'undefined') {
        reject(new Error("Google Identity Services script not loaded."));
        return;
      }

      // @ts-ignore
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(response);
          } else {
            resolve(response.access_token);
          }
        },
      });

      tokenClient.requestAccessToken();
    });
  },

  getUserProfile: async (accessToken: string) => {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Failed to fetch user profile");
    return await response.json();
  },

  /**
   * Finds 'StoreManager_DB' or creates it with 'Products' and 'RawData' sheets.
   */
  findOrCreateBackend: async (accessToken: string): Promise<string> => {
    const fileName = 'StoreManager_DB';
    
    // 1. Search
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!searchRes.ok) throw new Error("Failed to search Drive");
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. Create if not found
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
          { properties: { title: 'RawData' } } // Hidden sheet for full state
        ]
      }),
    });

    if (!createRes.ok) throw new Error("Failed to create Spreadsheet");
    const createData = await createRes.json();
    const spreadsheetId = createData.spreadsheetId;

    // 3. Add Headers to Products Sheet
    const headers = ['ID', 'Product Name', 'SKU', 'Price', 'Stock', 'Unit', 'Category'];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A1:G1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers] })
    });

    return spreadsheetId;
  },

  /**
   * Saves the entire application state to the Google Sheet.
   * 1. Updates 'Products' sheet for visibility.
   * 2. Dumps full JSON to 'RawData' sheet for persistence of Settings/Sales/Customers.
   */
  saveToSheet: async (accessToken: string, spreadsheetId: string, data: any) => {
    // 1. Prepare Product Rows
    const productRows = data.products.map((p: any) => [
        p.id, p.name, p.sku, p.sellPrice, p.stock, p.unit, p.category || ''
    ]);

    // 2. Prepare Raw JSON blob (Chunked if necessary, but usually fits in one cell for small-med apps)
    // We store it in RawData!A1
    const jsonBlob = JSON.stringify(data);
    
    const body = {
        valueInputOption: "USER_ENTERED",
        data: [
            {
                range: "Products!A2",
                values: productRows
            },
            {
                range: "RawData!A1",
                values: [[jsonBlob]]
            }
        ]
    };

    // 3. Batch Update
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
  },

  /**
   * Loads data from the Sheet. Preferentially reads 'RawData' for full fidelity.
   */
  loadFromSheet: async (accessToken: string, spreadsheetId: string) => {
      // Try reading RawData first
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RawData!A1`, {
          headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) throw new Error("Failed to load from sheet");
      
      const json = await res.json();
      
      if (json.values && json.values[0] && json.values[0][0]) {
          try {
              return JSON.parse(json.values[0][0]);
          } catch (e) {
              console.error("Failed to parse remote JSON", e);
          }
      }
      return null; // Return null to fallback to local or default
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