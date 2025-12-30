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
    insightsModal: null, // For the insights modal
    activeTab: 'overview', // Tab state for modal

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
          const errorMsg = errorData.error || `API error: ${response.status}`;
          const hint = errorData.hint ? ` (${errorData.hint})` : '';
          throw new Error(errorMsg + hint);
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

    // Analyze a lead and show modal
    async analyzeLead(lead) {
      this.analyzingLeadId = lead.id;

      // If already analyzed, just show modal
      if (lead.analysis) {
        this.insightsModal = lead;
        this.activeTab = 'overview';
        this.analyzingLeadId = null;
        return;
      }

      try {
        const response = await fetch(`/api/leads/${lead.id}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name,
            address: lead.address,
            industry: lead.category || this.searchParams.industry,
            phone: lead.phone,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Analysis failed');
        }

        const data = await response.json();

        // Update the lead with analysis
        const leadIndex = this.leads.findIndex((l) => l.id === lead.id);
        if (leadIndex !== -1) {
          this.leads[leadIndex].analysis = data.analysis;
          this.leads[leadIndex].analyzed = true;
        }

        // Show the modal
        this.insightsModal = this.leads[leadIndex] || { ...lead, analysis: data.analysis };
        this.activeTab = 'overview';
      } catch (error) {
        console.error('Analysis error:', error);
        this.error = error.message || 'Analysis failed';
      } finally {
        this.analyzingLeadId = null;
      }
    },

    // Close modal
    closeModal() {
      this.insightsModal = null;
      this.activeTab = 'overview';
    },

    // Copy email to clipboard
    async copyEmail() {
      if (!this.insightsModal?.analysis?.draftEmail) return;

      const email = this.insightsModal.analysis.draftEmail;

      try {
        await navigator.clipboard.writeText(email);
        alert('Email copied to clipboard!');
      } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = email;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Email copied!');
      }
    },

    // Copy all insights
    async copyAllInsights() {
      if (!this.insightsModal?.analysis) return;
      const a = this.insightsModal.analysis;
      const lead = this.insightsModal;

      const text = `
=== AI INSIGHTS FOR ${lead.name.toUpperCase()} ===
Address: ${lead.address}
Opportunity Score: ${a.opportunityScore}

📋 SUMMARY
${a.summary}

🌐 WEBSITE RECOMMENDATIONS
${a.websiteRecommendations?.map(r => `• ${r}`).join('\n') || 'None'}

📱 SOCIAL MEDIA RECOMMENDATIONS
${a.socialMediaRecommendations?.map(r => `• ${r}`).join('\n') || 'None'}

⚙️ SERVICE OPTIMIZATIONS
${a.serviceOptimizations?.map(r => `• ${r}`).join('\n') || 'None'}

🤖 AI & AUTOMATION OPPORTUNITIES
${a.aiAutomationOpportunities?.map(r => `• ${r}`).join('\n') || 'None'}

⚡ QUICK WINS
${a.quickWins?.map(r => `• ${r}`).join('\n') || 'None'}

📈 LONG-TERM STRATEGY
${a.longTermStrategy || 'None'}

👤 ESTIMATED CONTACT: ${a.estimatedContactName || 'Business Owner'}

📧 DRAFT EMAIL
${a.draftEmail}
      `.trim();

      try {
        await navigator.clipboard.writeText(text);
        alert('All insights copied!');
      } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Insights copied!');
      }
    },
  }));
});

// Start Alpine
Alpine.start();
