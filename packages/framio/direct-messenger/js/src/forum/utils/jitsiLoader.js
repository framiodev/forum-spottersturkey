/**
 * Jitsi Meet External Cloud API Loader & Helper
 * Loads Jitsi script on-demand from global CDN (zero forum server load)
 */

let apiScriptLoadingPromise = null;

export function loadJitsiScript() {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }

  if (apiScriptLoadingPromise) {
    return apiScriptLoadingPromise;
  }

  apiScriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    script.onload = () => {
      resolve(window.JitsiMeetExternalAPI);
    };
    script.onerror = (err) => {
      apiScriptLoadingPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return apiScriptLoadingPromise;
}
