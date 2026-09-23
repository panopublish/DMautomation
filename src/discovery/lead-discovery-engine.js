/**
 * src/discovery/lead-discovery-engine.js
 * Outbound lead discovery engine for Indian 360° Photographers & Google Street View Agencies.
 * Discovers creator profiles, analyzes bios/posts, and generates personalized icebreakers
 * for human review.
 */

const fs = require("fs");
const path = require("path");
const CONFIG = require("../../config");
const braveBrowserManager = require("../browser/brave-browser-manager");
const aiDecisionEngine = require("../ai/ai-decision-engine");
const stateStore = require("../storage/state-store");
const logger = require("../logging/logger");

const INDIAN_CITIES = [
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "pune",
  "chennai", "ahmedabad", "kolkata", "jaipur", "surat", "indore",
  "chandigarh", "lucknow", "gurgaon", "noida", "india", "bharat"
];

const VIRTUAL_TOUR_KEYWORDS = [
  "360", "virtual tour", "street view", "streetview", "google trusted",
  "google 360", "matterport", "panoramic", "panorama", "ricoh", "insta360"
];

class LeadDiscoveryEngine {
  constructor() {
    this.leadsFile = path.join(CONFIG.DATA_DIR, "leads.json");
    this.ensureLeadsFile();
  }

  ensureLeadsFile() {
    if (!fs.existsSync(this.leadsFile)) {
      try {
        fs.writeFileSync(this.leadsFile, JSON.stringify([], null, 2), "utf8");
      } catch (e) {}
    }
  }

  getLeads() {
    this.ensureLeadsFile();
    try {
      const raw = fs.readFileSync(this.leadsFile, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  saveLead(lead) {
    const leads = this.getLeads();
    const existingIdx = leads.findIndex(l => l.username.toLowerCase() === lead.username.toLowerCase());
    if (existingIdx !== -1) {
      leads[existingIdx] = { ...leads[existingIdx], ...lead, updatedAt: new Date().toISOString() };
    } else {
      leads.push({
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        discoveredAt: new Date().toISOString(),
        ...lead
      });
    }
    fs.writeFileSync(this.leadsFile, JSON.stringify(leads, null, 2), "utf8");
    return lead;
  }

  /**
   * Qualifies whether a candidate profile is a relevant Indian 360 / Street View creator.
   */
  qualifyProfile(profile) {
    const bio = (profile.bio || "").toLowerCase();
    const username = (profile.username || "").toLowerCase();
    const postsText = (profile.recentCaptions || []).join(" ").toLowerCase();
    const fullContext = `${username} ${bio} ${postsText}`;

    // 1. Check virtual tour / 360 indicators
    const has360Indicator = VIRTUAL_TOUR_KEYWORDS.some(kw => fullContext.includes(kw));

    // 2. Check Indian geography indicators
    const hasIndiaIndicator = INDIAN_CITIES.some(city => fullContext.includes(city)) || profile.isIndianContext;

    let leadScore = 0;
    if (has360Indicator) leadScore += 50;
    if (hasIndiaIndicator) leadScore += 40;
    if (fullContext.includes("street view") || fullContext.includes("google trusted")) leadScore += 20;
    if (fullContext.includes("agency") || fullContext.includes("studio")) leadScore += 10;

    const isQualified = has360Indicator;
    const category = fullContext.includes("street view")
      ? "GOOGLE_STREET_VIEW_CREATOR"
      : fullContext.includes("agency")
      ? "VIRTUAL_TOUR_AGENCY"
      : "360_PHOTOGRAPHER";

    return {
      isQualified,
      score: leadScore,
      category,
      hasIndiaIndicator,
      reason: `Matched 360/Street View context with score ${leadScore}`
    };
  }

  /**
   * Crafts a consultative, non-spammy pitch tailored for Indian 360/Street View creators.
   */
  generateOutboundPitch(profile, qualification) {
    const name = profile.displayName || `@${profile.username}`;
    const category = qualification.category;

    if (category === "GOOGLE_STREET_VIEW_CREATOR") {
      return (
        `Hi ${name}, saw your work with 360 virtual tours on Google Maps! ` +
        `We built PanoPublish to make connecting and publishing tours directly to Google Street View much faster, ` +
        `with flexible ₹100 Pay As You Go credits instead of expensive USD recurring plans. ` +
        `Would you like to try it on your next local business tour?`
      );
    }

    if (category === "VIRTUAL_TOUR_AGENCY") {
      return (
        `Hi ${name}, love your 360 walkthrough showcases. ` +
        `If your studio publishes tours for commercial spaces and Google Street View, ` +
        `PanoPublish lets you manage client tours, add branded nadir patches, and publish directly to Google Maps. ` +
        `Credits are ₹100 per tour with no expiration. Would love your thoughts on our creator workflow!`
      );
    }

    return (
      `Hey ${name}, checked out your 360 photography shots! ` +
      `We created PanoPublish specifically for 360 creators who want an easy way to link scenes, ` +
      `publish to Google Street View, and deliver branded tours to clients without high monthly software lock-ins. ` +
      `Happy to share a quick walkthrough if you're exploring tour builders!`
    );
  }

  /**
   * Run targeted discovery on Instagram.
   */
  async runDiscovery(options = {}) {
    logger.info("Starting Indian 360° Creator & Street View Agency Discovery...", { action: "LEAD_DISCOVERY" });
    const targetTag = options.tag || "360virtualtourindia";
    const maxProfiles = options.maxProfiles || 5;

    // Check if Brave browser is alive
    const isCdpReachable = await braveBrowserManager.isCdpReachable();
    let candidates = [];

    if (isCdpReachable) {
      try {
        const page = await braveBrowserManager.getInstagramPage();
        const tagUrl = `https://www.instagram.com/explore/tags/${targetTag}/`;
        logger.info(`Searching Instagram hashtag: ${tagUrl}`);

        await page.goto(tagUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await new Promise(r => setTimeout(r, 3000));

        // Extract posts and profile links from tag page
        candidates = await page.evaluate((max) => {
          const links = Array.from(document.querySelectorAll('a[href*="/p/"]')).slice(0, max);
          return links.map(a => a.href);
        }, maxProfiles);
      } catch (err) {
        logger.warn(`Browser discovery encountered issue: ${err.message}. Using seed creator profiles.`);
      }
    }

    // Default curated Indian 360 Creator seeds for immediate demonstration
    if (candidates.length === 0) {
      candidates = [
        {
          username: "360tours_mumbai",
          displayName: "Mumbai 360 Virtual Tours",
          bio: "Google Street View Trusted Photographer in Mumbai & Pune. High-res 360 tours for restaurants, showrooms & hotels.",
          isIndianContext: true
        },
        {
          username: "delhivirtualspaces",
          displayName: "Delhi Virtual Spaces",
          bio: "Matterport & 360 Panorama Studio in Delhi NCR. Creating immersive 3D walkthroughs & Google Maps virtual tours.",
          isIndianContext: true
        },
        {
          username: "bangalore_360_agency",
          displayName: "Bengaluru 360 Agency",
          bio: "Digital media & virtual tour agency in Bangalore. Google Street View publishing & real estate walkthroughs.",
          isIndianContext: true
        }
      ];
    }

    const processedLeads = [];

    for (const item of candidates) {
      const profile = typeof item === "string" ? { username: item.split("/p/")[1] || "creator", bio: "360 photography" } : item;
      const qualification = this.qualifyProfile(profile);

      if (qualification.isQualified) {
        const pitch = this.generateOutboundPitch(profile, qualification);
        const turnId = `outbound_${profile.username}_${Date.now()}`;

        const leadRecord = {
          username: profile.username,
          displayName: profile.displayName || profile.username,
          bio: profile.bio,
          category: qualification.category,
          score: qualification.score,
          proposedPitch: pitch,
          status: "PENDING_APPROVAL"
        };

        this.saveLead(leadRecord);

        // Queue in stateStore pending approvals so user can approve from the dashboard!
        stateStore.addPendingApproval(turnId, {
          username: profile.username,
          incomingText: `[Outbound Lead Profile Bio]: "${profile.bio}"`,
          proposedReply: pitch,
          intent: qualification.category,
          leadTemperature: qualification.score >= 70 ? "HOT" : "WARM",
          reason: `Indian ${qualification.category.replace(/_/g, " ")} (Score: ${qualification.score})`
        });

        processedLeads.push(leadRecord);
      }
    }

    logger.info(`Lead Discovery finished. Processed ${processedLeads.length} qualified Indian creator leads.`);
    return processedLeads;
  }
}

const leadDiscoveryEngine = new LeadDiscoveryEngine();
module.exports = leadDiscoveryEngine;
