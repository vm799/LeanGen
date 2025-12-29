import Alpine from 'alpinejs';

// Initialize Alpine
window.Alpine = Alpine;

// Map instance (using Leaflet with OpenStreetMap - free, no API key needed for tiles)
let map = null;
let markers = [];

// TomTom API key (only used for business search API, not for map display)
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY;

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
    showSidebar: false, // Mobile menu state

    // Initialize
    async init() {
      this.initMap();
    },

    // Initialize Map using Leaflet with OpenStreetMap tiles (FREE - no API key needed)
    initMap() {
      try {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
          console.error('Leaflet not loaded');
          return;
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
          console.error('Map container not found');
          return;
        }

        // Create map with OpenStreetMap tiles - completely free, no API key required
        map = L.map('map', {
          center: [37.7749, -122.4194], // San Francisco default
          zoom: 12,
          zoomControl: true,
        });

        // Add OpenStreetMap tiles (free, reliable, no API key needed)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Handle map resize when sidebar toggles
        setTimeout(() => map.invalidateSize(), 100);

      } catch (error) {
        console.error('Failed to initialize map:', error);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
          mapContainer.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 p-4 text-center">Map failed to load. Please refresh the page.</div>';
        }
      }
    },

    // Main search function
    async scout() {
      this.loadingInitial = true;
      this.error = null;
      this.leads = [];
      this.selectedLead = null;
      this.clearMarkers();

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.searchParams),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Search failed');
        }

        const data = await response.json();
        this.leads = data.leads || [];

        if (this.leads.length > 0) {
          this.renderMarkersOnMap();
          this.fitMapToBounds();
        }

        // Invalidate map size after search (in case sidebar state changed)
        if (map) {
          setTimeout(() => map.invalidateSize(), 100);
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

      // Invalidate map size (mobile layout may have changed)
      if (map) {
        setTimeout(() => map.invalidateSize(), 100);
      }

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
      if (typeof L === 'undefined' || !map) return;
      this.clearMarkers();

      this.leads.forEach((lead) => {
        if (!lead.location) return;

        const color = this.getMarkerColor(lead);

        // Create a circle marker
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
          <div style="color: #1e293b; padding: 4px; min-width: 150px;">
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

    // Get marker color based on opportunity score
    getMarkerColor(lead) {
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
    },

    // Update marker after analysis
    updateMarkerForLead(lead) {
      const marker = markers.find((m) => m.leadId === lead.id);
      if (marker) {
        marker.setStyle({ fillColor: this.getMarkerColor(lead) });
      }
    },

    // Clear all markers
    clearMarkers() {
      markers.forEach((marker) => marker.remove());
      markers = [];
    },

    // Fit map to show all markers
    fitMapToBounds() {
      if (markers.length === 0 || typeof L === 'undefined' || !map) return;

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
        // Fallback for mobile
        const textarea = document.createElement('textarea');
        textarea.value = this.selectedLead.analysis.aiAuditPitch;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Pitch copied!');
      }
    },

    // Check system health
    async checkHealth() {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();

        const statusText = Object.entries(data.services || {})
          .map(([service, status]) => `${service}: ${status.status || 'unknown'}`)
          .join('\n');

        alert(`System Status: ${data.status || 'unknown'}\n\n${statusText || 'No services info'}`);
      } catch (error) {
        alert('Failed to check system health. API may not be configured.');
      }
    },
  }));
});

// Start Alpine
Alpine.start();
