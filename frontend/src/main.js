import Alpine from 'alpinejs';

// Initialize Alpine
window.Alpine = Alpine;

// Google Maps instance
let map = null;
let markers = [];

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
    init() {
      this.initMap();
    },

    // Initialize Google Map
    initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.7749, lng: -122.4194 }, // San Francisco default
        zoom: 12,
        styles: getDarkMapStyle(),
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
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
        map.panTo(lead.location);
        map.setZoom(15);

        // Highlight marker
        markers.forEach((marker) => {
          if (marker.leadId === lead.id) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => marker.setAnimation(null), 2000);
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
      clearMarkers();

      this.leads.forEach((lead) => {
        if (!lead.location) return;

        const marker = new google.maps.Marker({
          position: lead.location,
          map: map,
          title: lead.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: getMarkerColor(lead),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.leadId = lead.id;

        marker.addListener('click', () => {
          this.selectLead(lead);
        });

        markers.push(marker);
      });
    },

    // Update marker after analysis
    updateMarkerForLead(lead) {
      const marker = markers.find((m) => m.leadId === lead.id);
      if (marker) {
        marker.setIcon({
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: getMarkerColor(lead),
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        });
      }
    },

    // Fit map to show all markers
    fitMapToBounds() {
      if (markers.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      markers.forEach((marker) => {
        bounds.extend(marker.getPosition());
      });

      map.fitBounds(bounds);

      // Ensure minimum zoom level
      const listener = google.maps.event.addListener(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
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
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

// Helper: Dark map style
function getDarkMapStyle() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#cbd5e1' }],
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#64748b' }],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#1e3a28' }],
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#6b8e23' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#334155' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1e293b' }],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#94a3b8' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#475569' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1e293b' }],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#cbd5e1' }],
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }],
    },
    {
      featureType: 'transit.station',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#64748b' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0c1429' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#475569' }],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#0f172a' }],
    },
  ];
}

// Start Alpine
Alpine.start();
