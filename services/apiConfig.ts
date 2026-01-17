
// Replace this with your actual Vercel deployment URL
const VERCEL_URL = 'https://noor-pos-your-project.vercel.app'; 

export const getApiUrl = (path: string) => {
  // If we are running in a browser on the actual domain, use relative paths
  // If we are running in an APK (localhost/capacitor), use the absolute Vercel URL
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isCapacitor = window.location.protocol === 'capacitor:';
  
  if (isCapacitor || (isLocalhost && !window.location.port)) {
    return `${VERCEL_URL}${path}`;
  }
  
  return path;
};
