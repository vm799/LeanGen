import Alpine from 'alpinejs';
import Clerk from '@clerk/clerk-js';

// Initialize Alpine
window.Alpine = Alpine;

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  console.error("Missing Clerk Publishable Key");
}

const clerk = new Clerk(clerkPubKey);

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
    sendingCampaign: false,
    analyzingLeadId: null,
    error: null,
    insightsModal: null,
    activeTab: 'overview',
    settingsModal: false,

    // Auth State
    user: null,
    isLoaded: false,

    // Branding State
    branding: {
      name: 'LeadGenius',
      primaryColor: '#4f46e5',
      logoUrl: null
    },

    // Initialize
    async init() {
      console.log('LeadGenius initialized');
      await this.initClerk();
    },

    async initClerk() {
      try {
        await clerk.load();

        // Handle auth state changes
        clerk.addListener((payload) => {
          this.user = payload.user;
          this.isLoaded = true;
        });

        this.user = clerk.user;
        this.isLoaded = true;

        if (this.user) {
          this.mountUserButton();
        } else {
          // If we had a mount point for sign in, we'd mount it here,
          // but we'll probably rely on a modal or redirect logic in HTML
        }
      } catch (err) {
        console.error("Error loading Clerk", err);
        this.error = "Authentication failed to load.";
        this.isLoaded = true;
      }
    },

    async fetchBranding() {
      try {
        const token = await clerk.session?.getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/organization`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const org = await response.json();
          if (org.branding) {
            this.branding = { ...this.branding, ...org.branding };
            if (org.name) this.branding.name = org.name;
            if (this.branding.primaryColor) {
              document.documentElement.style.setProperty('--primary-color', this.branding.primaryColor);
            }
          }
        }
      } catch (e) {
        console.warn("Retaining default branding");
      }
    },

    mountUserButton() {
      // Use setTimeout to ensure DOM is ready if it's dynamic
      setTimeout(() => {
        const userButtonDiv = document.getElementById('user-button');
        if (userButtonDiv) {
          clerk.mountUserButton(userButtonDiv);
        }
      }, 100);
    },

    login() {
      clerk.openSignIn();
    },

    // Main search function
    async scout() {
      if (!this.user) {
        this.login();
        return;
      }

      this.loadingInitial = true;
      this.error = null;
      this.leads = [];
      this.selectedLead = null;

      try {
        // Get token
        const token = await clerk.session?.getToken();

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(this.searchParams),
        });

        if (!response.ok) {
          // Check for 401
          if (response.status === 401) {
            this.error = "Session expired. Please log in again.";
            this.user = null; // Force re-render
            return;
          }
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
        const token = await clerk.session?.getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leads/${lead.id}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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

    // Send one-click campaign
    async sendCampaign() {
      if (!this.insightsModal?.analysis?.draftEmail) return;

      const lead = this.insightsModal;
      const email = lead.analysis.estimatedEmail || 'demo@example.com'; // In real app, we'd use found email
      const subject = `Question about ${lead.name}'s digital presence`;
      const html = lead.analysis.draftEmail.replace(/\n/g, '<br>');

      if (!confirm(`Send email to ${email}?`)) return;

      this.sendingCampaign = true;

      try {
        const token = await clerk.session?.getToken();

        // 1. Find Email (mock flow for now if not present)
        // const emailData = await fetch...

        // 2. Send Email
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/outreach/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: email, // In production, we'd verify this email first
            subject,
            html
          }),
        });

        const data = await response.json();

        if (data.success) {
          alert('Campaign sent successfully! 🚀');
        } else {
          throw new Error(data.error?.message || 'Failed to send');
        }

      } catch (error) {
        console.error('Campaign error:', error);
        alert(`Failed to send campaign: ${error.message}`);
      } finally {
        this.sendingCampaign = false;
      }
    },

    async updateSettings() {
      try {
        const token = await clerk.session?.getToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/organization`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(this.branding)
        });

        if (response.ok) {
          alert('Settings saved!');
          this.settingsModal = false;
          this.fetchBranding(); // Refresh to apply changes
        } else {
          throw new Error('Failed to save settings');
        }
      } catch (e) {
        alert(e.message);
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
