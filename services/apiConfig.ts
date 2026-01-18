
/**
 * API CONFIGURATION
 * 
 * When running in the Android APK, relative paths (like /api/storage) do NOT work.
 * The APK needs a full URL to communicate with your Vercel backend.
 */
const PRODUCTION_URL = 'https://www.noorpos.in'; 

export const getApiUrl = (path: string) => {
  // Check if we are running inside the Android/iOS app environment
  // Capacitor uses the 'capacitor:' protocol or a local 'http://localhost' without a port
  const isCapacitor = 
    window.location.protocol === 'capacitor:' || 
    (window.location.hostname === 'localhost' && !window.location.port);
  
  if (isCapacitor) {
    // Force absolute URL for APK
    return `${PRODUCTION_URL}${path}`;
  }
  
  // Use relative path for web browser
  return path;
};
