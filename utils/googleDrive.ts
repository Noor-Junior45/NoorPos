


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
   * Finds 'StoreManager_DB' or creates it with 'Products' and 'RawData' sheets.
   */
  findOrCreateBackend: async (accessToken: string): Promise<string> => {
    const fileName = 'StoreManager_DB';
    
    // 1. Search
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&fields=files(id, name)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(`Drive Search Failed: ${err?.error?.message || searchRes.statusText}`);
    }
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

    if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(`Sheet Creation Failed: ${err?.error?.message || createRes.statusText}`);
    }
    const createData = await createRes.json();
    const spreadsheetId = createData.spreadsheetId;

    // 3. Add Headers to Products Sheet
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Products!A1:G1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers] })
    });

    return spreadsheetId;
  },

  /**
   * Shares the database file with another email address.
   */
  shareDatabase: async (accessToken: string, spreadsheetId: string, email: string) => {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
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
          // If 404/403, might be issue with sheet, return null to fallback
          console.warn("Load failed, falling back", res.statusText);
          return null; 
      }
      
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
