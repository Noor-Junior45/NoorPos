
/**
 * API CONFIGURATION
 * 
 * When running in the Android APK, relative paths (like /api/storage) don't work
 * because the app runs on a local bridge (capacitor:// or http://localhost).
 * 
 * REPLACE the URL below with your actual Vercel deployment URL.
 */
const PRODUCTION_URL = 'https://noorpos.vercel.app'; 

export const getApiUrl = (path: string) => {
  // Check if we are running in a Capacitor (Android/iOS) environment
  const isCapacitor = window.location.protocol === 'capacitor:' || 
                      (window.location.hostname === 'localhost' && !window.location.port);
  
  // In mobile or isolated local preview, use absolute production URL
  if (isCapacitor) {
    return `${PRODUCTION_URL}${path}`;
  }
  
  // In the standard browser deployment on Vercel, use relative paths
  return path;
};
