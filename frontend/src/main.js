import Alpine from 'alpinejs';

// Initialize Alpine
window.Alpine = Alpine;

// Map instance (using Leaflet with OpenStreetMap - completely free, no API key needed)
let map = null;
let markers = [];
let L = null;

// TomTom API key (only used for business search, not for map tiles)
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

// Load Leaflet dynamically
function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    // Load Leaflet CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    css.crossOrigin = '';
    document.head.appendChild(css);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve(window.L);
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

    // Initialize Map using Leaflet with OpenStreetMap tiles (FREE - no API key needed)
    async initMap() {
      try {
        L = await loadLeaflet();

        // Create map with OpenStreetMap tiles - completely free, no API key
        map = L.map('map').setView([37.7749, -122.4194], 12); // San Francisco default

        // Add OpenStreetMap tiles (free, no API key required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

      } catch (error) {
        console.error('Failed to initialize map:', error);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400">Map failed to load</div>';
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
        map.flyTo([lead.location.lat, lead.location.lng], 15);

        // Open popup for selected marker
        markers.forEach((marker) => {
          if (marker.leadId === lead.id) {
            marker.openPopup();
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
      if (!L || !map) return;
      clearMarkers();

      this.leads.forEach((lead) => {
        if (!lead.location) return;

        const color = getMarkerColor(lead);

        // Create a circle marker (simpler and works well)
        const marker = L.circleMarker([lead.location.lat, lead.location.lng], {
          radius: 10,
          fillColor: color,
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);

        // Create popup
        marker.bindPopup(`
          <div style="color: #1e293b; padding: 4px;">
            <strong>${lead.name}</strong><br>
            <small>${lead.address || ''}</small>
          </div>
        `);

        marker.leadId = lead.id;

        marker.on('click', () => {
          this.selectLead(lead);
        });

        markers.push(marker);
      });
    },

    // Update marker after analysis
    updateMarkerForLead(lead) {
      const marker = markers.find((m) => m.leadId === lead.id);
      if (marker) {
        marker.setStyle({ fillColor: getMarkerColor(lead) });
      }
    },

    // Fit map to show all markers
    fitMapToBounds() {
      if (markers.length === 0 || !L || !map) return;

      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
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
