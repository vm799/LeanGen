import Alpine from 'alpinejs';

// Initialize Alpine
window.Alpine = Alpine;

// Initialize app
document.addEventListener('alpine:init', () => {
  Alpine.data('scoutApp', () => ({
    // State
    searchParams: {
      industry: '',
      city: '',
    },
    leads: [],
    selectedLead: null,
    loadingInitial: false,
    analyzingLeadId: null,
    error: null,
    pitchModalLead: null, // For the pitch modal

    // Initialize
    init() {
      console.log('LeadGenius initialized');
    },

    // Main search function
    async scout() {
      this.loadingInitial = true;
      this.error = null;
      this.leads = [];
      this.selectedLead = null;

      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.searchParams),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.hint || `API error: ${response.status}`);
        }

        const data = await response.json();
        this.leads = data.leads || [];

        if (this.leads.length === 0) {
          this.error = 'No businesses found. Try a different search.';
        }
      } catch (error) {
        this.error = error.message || 'Search failed. Check that API is configured.';
        console.error('Search error:', error);
      } finally {
        this.loadingInitial = false;
      }
    },

    // Select lead and trigger analysis
    async selectLead(lead) {
      this.selectedLead = lead;

      // If not analyzed yet, trigger analysis
      if (!lead.analysis) {
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

          // Update selected lead
          if (this.selectedLead?.id === leadId) {
            this.selectedLead = this.leads[leadIndex];
          }
        }
      } catch (error) {
        console.error('Analysis error:', error);
      } finally {
        this.analyzingLeadId = null;
      }
    },

    // Show pitch modal
    showPitchModal(lead) {
      this.pitchModalLead = lead;
    },

    // Copy pitch to clipboard
    async copyPitch(lead) {
      const pitchLead = lead || this.pitchModalLead;
      if (!pitchLead?.analysis?.aiAuditPitch) return;

      const fullPitch = `
Business: ${pitchLead.name}
Address: ${pitchLead.address}

Opportunity Score: ${pitchLead.analysis.opportunityScore}

Key Gaps:
${pitchLead.analysis.keyGaps.map(g => `• ${g}`).join('\n')}

Digital Presence:
${pitchLead.analysis.digitalPresenceSummary}

Pitch:
${pitchLead.analysis.aiAuditPitch}
      `.trim();

      try {
        await navigator.clipboard.writeText(fullPitch);
        alert('Pitch copied to clipboard!');
      } catch (error) {
        // Fallback for mobile
        const textarea = document.createElement('textarea');
        textarea.value = fullPitch;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Pitch copied!');
      }
    },
  }));
});

// Start Alpine
Alpine.start();
