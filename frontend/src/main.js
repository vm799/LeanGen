import Alpine from 'alpinejs';

// Initialize Alpine
window.Alpine = Alpine;

// Map instance (using MapLibre GL JS)
let map = null;
let markers = [];
let maplibregl = null;

// TomTom API key from environment variable
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

// Load MapLibre GL JS dynamically (no TomTom SDK to avoid custom style issues)
function loadMapLibre() {
  return new Promise((resolve, reject) => {
    if (window.maplibregl) {
      resolve(window.maplibregl);
      return;
    }

    // Load MapLibre CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
    document.head.appendChild(css);

    // Load MapLibre JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js';
    script.async = true;
    script.onload = () => resolve(window.maplibregl);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize app
document.addEventListener('alpine:init', () => {
  Alpine.data('scoutApp', () => ({
    // State
    searchParams: {
      industry: '',
      city: '',
    },
    filters: {
      requireMissingChatbot: false,
      requireManualBooking: false,
    },
    leads: [],
    selectedLead: null,
    loadingInitial: false,
    analyzingLeadId: null,
    error: null,

    // Initialize
    async init() {
      await this.initMap();
    },

    // Initialize Map using MapLibre with TomTom tiles
    async initMap() {
      try {
        maplibregl = await loadMapLibre();

        // Use TomTom's basic_main style directly - no custom styles
        const styleUrl = `https://api.tomtom.com/style/1/style/22.2.1-*?map=basic_main&key=${TOMTOM_API_KEY}`;

        map = new maplibregl.Map({
          container: 'map',
          style: styleUrl,
          center: [-122.4194, 37.7749], // San Francisco default [lng, lat]
          zoom: 12,
        });

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl());
      } catch (error) {
        console.error('Failed to initialize map:', error);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400">Map failed to load. Check your API key.</div>';
        }
      }
    },

    // Main search function
    async scout() {
      this.loadingInitial = true;
      this.error = null;
      this.leads = [];
      this.selectedLead = null;
      clearMarkers();

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.searchParams),
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        this.leads = data.leads;

        if (this.leads.length > 0) {
          this.renderMarkersOnMap();
          this.fitMapToBounds();
        }
      } catch (error) {
        this.error = error.message;
        console.error('Search error:', error);
      } finally {
        this.loadingInitial = false;
      }
    },

    // Select lead and trigger deep analysis
    async selectLead(lead) {
      this.selectedLead = lead;

      // Fly to location on map
      if (map && lead.location) {
        map.flyTo({
          center: [lead.location.lng, lead.location.lat],
          zoom: 15,
        });

        // Show popup for selected marker
        markers.forEach((marker) => {
          if (marker.leadId === lead.id && marker.popup) {
            marker.popup.addTo(map);
          }
        });
      }

      // If not analyzed yet, trigger deep analysis
      if (!lead.analyzed) {
        await this.analyzeLeadDeep(lead.id);
      }
    },

    // Deep analysis for selected lead
    async analyzeLeadDeep(leadId) {
      this.analyzingLeadId = leadId;

      try {
        const response = await fetch(`/api/leads/${leadId}/analyze`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const data = await response.json();

        // Update the lead in our list
        const leadIndex = this.leads.findIndex((l) => l.id === leadId);
        if (leadIndex !== -1) {
          this.leads[leadIndex].analysis = data.analysis;
          this.leads[leadIndex].technicalDetails = data.technicalDetails;
          this.leads[leadIndex].analyzed = true;

          // Update selected lead if it's the one we analyzed
          if (this.selectedLead?.id === leadId) {
            this.selectedLead = this.leads[leadIndex];
          }

          // Update marker color based on opportunity score
          this.updateMarkerForLead(this.leads[leadIndex]);
        }
      } catch (error) {
        console.error('Analysis error:', error);
      } finally {
        this.analyzingLeadId = null;
      }
    },

    // Filter leads based on filters
    filteredLeads() {
      return this.leads.filter((lead) => {
        if (this.filters.requireMissingChatbot) {
          if (!lead.technicalDetails?.chatbot || lead.technicalDetails.chatbot.hasChatbot) {
            return false;
          }
        }

        if (this.filters.requireManualBooking) {
          if (!lead.technicalDetails?.booking || lead.technicalDetails.booking.hasBooking) {
            return false;
          }
        }

        return true;
      });
    },

    // Render markers on map
    renderMarkersOnMap() {
      if (!maplibregl || !map) return;
      clearMarkers();

      this.leads.forEach((lead) => {
        if (!lead.location) return;

        // Create marker element
        const markerElement = document.createElement('div');
        markerElement.className = 'custom-marker';
        markerElement.style.cssText = `
          width: 16px;
          height: 16px;
          background-color: ${getMarkerColor(lead)};
          border: 2px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        // Create popup
        const popup = new maplibregl.Popup({ offset: 20 }).setHTML(`
          <div style="color: #1e293b; padding: 4px;">
            <strong>${lead.name}</strong><br>
            <small>${lead.address || ''}</small>
          </div>
        `);

        // Create marker
        const marker = new maplibregl.Marker({ element: markerElement })
          .setLngLat([lead.location.lng, lead.location.lat])
          .setPopup(popup)
          .addTo(map);

        marker.leadId = lead.id;
        marker.markerElement = markerElement;
        marker.popup = popup;

        markerElement.addEventListener('click', () => {
          this.selectLead(lead);
        });

        markers.push(marker);
      });
    },

    // Update marker after analysis
    updateMarkerForLead(lead) {
      const marker = markers.find((m) => m.leadId === lead.id);
      if (marker && marker.markerElement) {
        marker.markerElement.style.backgroundColor = getMarkerColor(lead);
      }
    },

    // Fit map to show all markers
    fitMapToBounds() {
      if (markers.length === 0 || !maplibregl || !map) return;

      const bounds = new maplibregl.LngLatBounds();
      markers.forEach((marker) => {
        bounds.extend(marker.getLngLat());
      });

      map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
    },

    // Copy pitch to clipboard
    async copyPitch() {
      if (!this.selectedLead?.analysis?.aiAuditPitch) return;

      try {
        await navigator.clipboard.writeText(this.selectedLead.analysis.aiAuditPitch);
        alert('Pitch copied to clipboard!');
      } catch (error) {
        console.error('Copy failed:', error);
      }
    },

    // Check system health
    async checkHealth() {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();

        const statusText = Object.entries(data.services)
          .map(([service, status]) => `${service}: ${status.status}`)
          .join('\n');

        alert(`System Status: ${data.status}\n\n${statusText}`);
      } catch (error) {
        alert('Failed to check system health');
      }
    },
  }));
});

// Helper: Get marker color based on opportunity score
function getMarkerColor(lead) {
  if (!lead.analysis) return '#94a3b8'; // slate-400 (not analyzed)

  switch (lead.analysis.opportunityScore) {
    case 'HIGH':
      return '#ef4444'; // red-500
    case 'MEDIUM':
      return '#eab308'; // yellow-500
    case 'LOW':
      return '#22c55e'; // green-500
    default:
      return '#94a3b8'; // slate-400
  }
}

// Helper: Clear all markers
function clearMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];
}

// Start Alpine
Alpine.start();
