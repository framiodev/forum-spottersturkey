export function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L && window.L.markerClusterGroup) {
      resolve();
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-cluster-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cluster-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(link);
    }

    const loadScript = (id, src) =>
      new Promise((res) => {
        if (document.getElementById(id)) {
          res();
          return;
        }
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = res;
        document.head.appendChild(script);
      });

    loadScript('leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')
      .then(() => loadScript('leaflet-cluster-js', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'))
      .then(resolve);
  });
}
