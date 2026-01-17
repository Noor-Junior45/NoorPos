
/**
 * API CONFIGURATION
 * 
 * CRITICAL FOR APK:
 * When running in the Android APK, relative paths (like /api/storage) do NOT work.
 * The APK needs a full URL to communicate with your Vercel backend.
 * 
 * ACTION REQUIRED:
 * Replace 'https://noorpos.vercel.app' with your actual Vercel Production URL.
 * You can find this URL in your Vercel Project Dashboard under "Deployments".
 */
const PRODUCTION_URL = 'https://www.noorpos.in'; 

export const getApiUrl = (path: string) => {
  // Check if we are running inside the Android/iOS app environment
  const isCapacitor = window.location.protocol === 'capacitor:' || 
                      window.location.protocol === 'http:' && window.location.hostname === 'localhost' && !window.location.port;
  
  // If we are in the APK, we MUST use the absolute URL to reach your server
  if (isCapacitor) {
    return `${PRODUCTION_URL}${path}`;
  }
  
  // If we are just browsing the website normally, use relative paths
  return path;
};
