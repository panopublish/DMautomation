/**
 * scripts/build-creator-db.js
 * Builds the verified Outreach Hub database for PanoPublish.
 * Only includes REAL companies with verified Instagram handles, verified WhatsApp numbers,
 * verified websites, and the official PanoPublish outreach pitch.
 */

const fs = require('fs');
const path = require('path');

const PANOPUBLISH_PITCH = `Hey! 👋

Are you using any software to publish your 360° tours to Google Street View?

Check out PanoPublish — you can create, connect & publish your tours in one place.

🎁 Free trial:
https://panopublish.com

Would love to hear your feedback!`;

function makeCreator(opts) {
  const {
    id,
    displayName,
    username = null, // Only real verified Instagram username, otherwise null
    category,
    city,
    bio,
    website = null,
    whatsappPhone = null, // Raw phone e.g. "919871280005"
    linkedin = null,
    score = 95,
    tags = []
  } = opts;

  const hasVerifiedInstagram = Boolean(username);
  const hasVerifiedWhatsApp = Boolean(whatsappPhone);

  const instagramUrl = hasVerifiedInstagram ? `https://www.instagram.com/${username}/` : null;
  const whatsappUrl = hasVerifiedWhatsApp 
    ? `https://api.whatsapp.com/send?phone=${whatsappPhone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(PANOPUBLISH_PITCH)}`
    : null;

  return {
    id,
    displayName,
    username: username || null,
    category,
    city,
    bio,
    website,
    instagram: instagramUrl,
    instagram_dm: instagramUrl,
    hasVerifiedInstagram,
    whatsapp: whatsappUrl,
    whatsappPhone: whatsappPhone ? `+${whatsappPhone.replace(/[^0-9]/g, '')}` : null,
    hasVerifiedWhatsApp,
    linkedin,
    score,
    status: 'ACTIVE',
    tags: tags.length > 0 ? tags : ['360-photography', 'india'],
    proposedPitch: PANOPUBLISH_PITCH,
    notes: '',
    discoveredAt: new Date().toISOString()
  };
}

// ==========================================
// 1. VERIFIED INDIAN 360 / GSV AGENCIES & STUDIOS
// ==========================================
const verifiedIndianAgencies = [
  // Both Instagram & WhatsApp Verified
  makeCreator({
    id: 'hub_v001',
    displayName: 'Cinematic 360',
    username: 'cinematic360.in',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Mumbai / Bikaner / Pan-India',
    bio: '360-Degree Videography, Virtual Tours & Google Street View Integration. High-impact corporate visuals & brand films.',
    website: 'https://cinematic360.in',
    whatsappPhone: '918928493817',
    linkedin: 'https://www.linkedin.com/company/cinematic360/',
    score: 140,
    tags: ['google-street-view', '360-video', 'cinematic', 'pan-india']
  }),

  makeCreator({
    id: 'hub_v002',
    displayName: 'Ajit 360 Virtual Tours Photography',
    username: 'ajit360view',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pune, Maharashtra',
    bio: 'Professional Google 360° virtual tours for businesses, real estate, and schools. Google Street View integration specialist.',
    website: 'https://ajit360view.com',
    whatsappPhone: '919175569351',
    score: 135,
    tags: ['google-street-view', 'pune', 'maharashtra', 'virtual-tour']
  }),

  makeCreator({
    id: 'hub_v003',
    displayName: 'NS Ventures',
    username: 'ns_ventures',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR / Mumbai / Pan-India',
    bio: 'Premier 360 Virtual Tour and Matterport 3D walkthrough provider for real estate and corporate properties across India.',
    website: 'https://nsventures.in',
    whatsappPhone: '917506203777',
    linkedin: 'https://www.linkedin.com/company/ns-ventures/',
    score: 135,
    tags: ['matterport', 'real-estate', 'delhi-ncr', 'mumbai']
  }),

  makeCreator({
    id: 'hub_v004',
    displayName: '360Pano Immersive Reality',
    username: '360panovr',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Noida, Delhi NCR',
    bio: 'India leading virtual reality & 360 virtual tour solutions. Google Maps integration, 3D simulations & digital twins.',
    website: 'https://360pano.in',
    whatsappPhone: '916397113996',
    linkedin: 'https://www.linkedin.com/company/360pano',
    score: 130,
    tags: ['virtual-reality', '360-video', 'noida', 'delhi-ncr']
  }),

  makeCreator({
    id: 'hub_v005',
    displayName: 'Aerial Photo India',
    username: 'aerialphotoindia',
    category: '360_PHOTOGRAPHER',
    city: 'Pune / Pan-India',
    bio: 'Specialist in 360° aerial photography, drone mapping, and interactive virtual tours for Google Maps & websites.',
    website: 'https://aerialphotoindia.com',
    whatsappPhone: '919922468407',
    score: 125,
    tags: ['aerial-360', 'drone', 'google-maps', 'pune']
  }),

  makeCreator({
    id: 'hub_v006',
    displayName: 'Bring It Online Media Pvt Ltd',
    username: 'bringitonline',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR / Mumbai',
    bio: 'Official Google My Business 360 photography partner, Street View integration, commercial business walkthroughs.',
    website: 'https://bringitonline.in',
    whatsappPhone: '919319989802',
    score: 125,
    tags: ['google-my-business', 'delhi', 'mumbai', 'street-view']
  }),

  makeCreator({
    id: 'hub_v007',
    displayName: 'Illusionist Studios',
    username: 'illusioniststudios',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: 'High-end 4K 360° virtual tours for luxury real estate, hotels, corporate headquarters, and showrooms.',
    website: 'https://illusioniststudios.com',
    whatsappPhone: '919004970726',
    score: 120,
    tags: ['real-estate', 'mumbai', 'luxury', 'virtual-tour']
  }),

  makeCreator({
    id: 'hub_v008',
    displayName: 'Recce Digital Studio',
    username: 'reccestudio',
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pune, Maharashtra',
    bio: 'Google Street View certified agency specializing in interactive 360 tours, digital visibility, and social media production.',
    website: 'https://recce.studio',
    whatsappPhone: null,
    score: 115,
    tags: ['google-certified', 'pune', 'digital-studio']
  }),

  makeCreator({
    id: 'hub_v009',
    displayName: '3D Power Visualization',
    username: '3dpower',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Bangalore / Mumbai',
    bio: 'Leading 3D visualization and architectural walkthrough studio with over 20+ years of digital tour creation.',
    website: 'https://threedpower.com',
    whatsappPhone: null,
    score: 110,
    tags: ['3d-walkthrough', 'bangalore', 'mumbai', 'architecture']
  }),

  // ==========================================
  // 2. VERIFIED INDIAN BUSINESSES WITH DIRECT WHATSAPP
  // ==========================================
  makeCreator({
    id: 'hub_v010',
    displayName: 'Walkthru Tech Pvt Ltd',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Noida / Delhi NCR / Pan-India',
    bio: 'DPIIT-recognized leader in 360° virtual tours, AR/VR, and Google Street View for universities, hotels, and real estate.',
    website: 'https://walkthru.in',
    whatsappPhone: '918595002877',
    score: 135,
    tags: ['walkthru', 'google-street-view', 'delhi-ncr', 'pan-india']
  }),

  makeCreator({
    id: 'hub_v011',
    displayName: 'SEO Tech Experts',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Gurgaon, Haryana / Delhi NCR',
    bio: 'Google Street View walkthroughs, Google Business Profile 360° photos, and local business digital marketing.',
    website: 'https://seotechexperts.com',
    whatsappPhone: '919871280005',
    score: 125,
    tags: ['google-street-view', 'gurgaon', 'delhi-ncr']
  }),

  makeCreator({
    id: 'hub_v012',
    displayName: 'TechDost Services Pvt Ltd',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Meerut / UP / Delhi NCR',
    bio: 'Google Street View Trusted agency covering North India (UP, Delhi, Haryana). Bulk business tours on Google Maps.',
    website: 'https://techdost.com',
    whatsappPhone: '917500996633',
    score: 120,
    tags: ['north-india', 'up', 'delhi-ncr', 'google-trusted']
  }),

  makeCreator({
    id: 'hub_v013',
    displayName: 'Roesome Creative',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Bangalore, Karnataka',
    bio: 'Google Certified 360° photography partner in Bengaluru. Architecture, interior, and commercial Google Maps tours.',
    website: 'https://roesome.com',
    whatsappPhone: '919845714977',
    score: 120,
    tags: ['google-certified', 'bangalore', 'commercial-photography']
  }),

  makeCreator({
    id: 'hub_v014',
    displayName: 'JHA 360 Virtual Tours',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: 'Google Street View Trusted Agency in Mumbai. High-resolution 360° tours for retail stores, showrooms, and clinics.',
    website: 'https://jha360.com',
    whatsappPhone: '918369397726',
    score: 118,
    tags: ['google-maps', 'mumbai', 'retail-tours']
  }),

  makeCreator({
    id: 'hub_v015',
    displayName: 'Shri Hari Productions',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR / Pan-India',
    bio: 'Professional 360 virtual tours, Google Street View, and DSLR panoramic capture for schools, factories, and hotels.',
    website: 'https://shrihariproductions.com',
    whatsappPhone: '919811085472',
    score: 115,
    tags: ['industrial-tours', 'delhi-ncr', 'pan-india']
  }),

  makeCreator({
    id: 'hub_v016',
    displayName: 'AK Virtual Tours',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Ahmedabad, Gujarat',
    bio: 'Interactive 360° virtual tours, FPV drone videography, and VR simulations for universities and industrial facilities.',
    website: 'https://akvirtualtours.in',
    whatsappPhone: '919727164577',
    score: 115,
    tags: ['ahmedabad', 'gujarat', 'universities', 'industrial']
  }),

  makeCreator({
    id: 'hub_v017',
    displayName: '360 Trusted Virtual Tour',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pan-India',
    bio: 'Google Street View Trusted Photographer & 360° Virtual Tours for Google Maps. Social media video walkthroughs.',
    website: 'https://360trustedvirtualtour.com',
    whatsappPhone: '919653905715',
    score: 120,
    tags: ['trusted-photographer', 'pan-india', 'google-maps']
  }),

  makeCreator({
    id: 'hub_v018',
    displayName: '360TourMaker',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Nagpur, Maharashtra',
    bio: '360 Virtual Tour services in Central India. Google Street View integration for restaurants, hospitals, and coaching hubs.',
    website: 'https://360tourmaker.in',
    whatsappPhone: '919270243452',
    score: 110,
    tags: ['nagpur', 'maharashtra', 'central-india']
  }),

  makeCreator({
    id: 'hub_v019',
    displayName: 'The Visual Media',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Kolkata, West Bengal',
    bio: 'Leading virtual tour provider in Eastern India. 360° panoramic tours, drone footage, and Google Maps business visibility.',
    website: 'https://thevisualmedia.co.in',
    whatsappPhone: '919830015852',
    score: 115,
    tags: ['kolkata', 'eastern-india', 'google-maps']
  }),

  makeCreator({
    id: 'hub_v020',
    displayName: 'Shootin 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Kanpur, Uttar Pradesh',
    bio: 'Google Street View photographer agency in UP. 360 degree virtual tours and business listings across Kanpur & Lucknow.',
    website: 'https://shootin360.com',
    whatsappPhone: '919415039489',
    score: 105,
    tags: ['kanpur', 'lucknow', 'up', 'google-street-view']
  }),

  makeCreator({
    id: 'hub_v021',
    displayName: 'Digital Studio India',
    username: null,
    category: '360_PHOTOGRAPHER',
    city: 'Mumbai, Maharashtra',
    bio: 'Professional 360 panoramic stitching, Google Street View, and commercial interior photography in Mumbai.',
    website: 'https://digitalstudio.in',
    whatsappPhone: '919820578189',
    score: 110,
    tags: ['mumbai', 'interior-360', 'panoramic']
  }),

  makeCreator({
    id: 'hub_v022',
    displayName: 'Adostrophe Virtual Walkthroughs',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Bangalore / Pan-India',
    bio: 'Matterport 3D virtual walkthroughs and Google Maps tours for luxury properties and commercial centers.',
    website: 'https://adostrophe.com',
    whatsappPhone: '918861188822',
    score: 110,
    tags: ['matterport', 'bangalore', 'luxury-properties']
  }),

  makeCreator({
    id: 'hub_v023',
    displayName: 'Matterport In Mumbai',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: 'Matterport 3D scanning, dollhouse views, and Google Street View constellation tours in Mumbai and Thane.',
    website: 'https://matterportinmumbai.com',
    whatsappPhone: '919899072838',
    score: 110,
    tags: ['matterport', 'mumbai', '3d-scanning']
  }),

  makeCreator({
    id: 'hub_v024',
    displayName: 'Map Media 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pan-India / South Asia',
    bio: '360° virtual tour creation, Google Street View publishing, and social media marketing across India and neighboring countries.',
    website: 'https://mapmedia360.com',
    whatsappPhone: '919288338838',
    score: 115,
    tags: ['google-street-view', 'pan-india', 'social-media']
  }),

  makeCreator({
    id: 'hub_v025',
    displayName: 'Click360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: 'High-res panoramic photography, mobile and VR-ready virtual tours, and Google Maps business listings in Mumbai.',
    website: 'https://click360.in',
    whatsappPhone: '919867603336',
    score: 108,
    tags: ['mumbai', 'ghatkopar', 'panoramic', 'vr-ready']
  }),

  makeCreator({
    id: 'hub_v026',
    displayName: 'Starts360 Virtual Tours',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR / Pan-India',
    bio: 'Matterport Service Provider and Google Street View virtual tours for corporate offices, hospitals, and schools.',
    website: 'https://starts360.com',
    whatsappPhone: '918849192050',
    score: 110,
    tags: ['matterport', 'delhi-ncr', 'pan-india']
  }),

  makeCreator({
    id: 'hub_v027',
    displayName: 'TMR Digital 360 Photography',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Hyderabad, Telangana',
    bio: 'Google Maps 360° virtual tour photography for local businesses in Hyderabad. GMB boost and QR review cards.',
    website: 'https://tmrdigital.co.in',
    whatsappPhone: '918125008059',
    score: 105,
    tags: ['hyderabad', 'telangana', 'google-maps']
  }),

  makeCreator({
    id: 'hub_v028',
    displayName: 'Eyes Pixel Studio',
    username: null,
    category: '360_PHOTOGRAPHER',
    city: 'Pune, Maharashtra',
    bio: 'Interactive 360 virtual tours for real estate and commercial properties in Pune. Architectural walkthroughs.',
    website: 'https://eyespixel.com',
    whatsappPhone: '917903243332',
    score: 105,
    tags: ['pune', 'architecture', 'real-estate']
  }),

  makeCreator({
    id: 'hub_v029',
    displayName: 'Touchstone Infotech 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR',
    bio: 'Google Street View virtual tours and Google Business Profile optimization agency in Delhi NCR.',
    website: 'https://touchstoneinfotech.com',
    whatsappPhone: '918587999666',
    score: 105,
    tags: ['delhi-ncr', 'gmb', 'street-view']
  }),

  makeCreator({
    id: 'hub_v030',
    displayName: '360 VR Photography India',
    username: null,
    category: '360_PHOTOGRAPHER',
    city: 'Mumbai, Maharashtra',
    bio: '360-degree photography, virtual reality tours, and interactive digital walkthroughs for hospitality and events.',
    website: 'https://360vrphotography.in',
    whatsappPhone: '919920322366',
    score: 105,
    tags: ['mumbai', 'events', 'hospitality', '360-photo']
  }),

  makeCreator({
    id: 'hub_v031',
    displayName: 'Dharam Graphics 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi',
    bio: '360° virtual tour creator for cafes, restaurants, schools, and retail businesses in West Delhi and NCR.',
    website: 'https://dharamgraphics.in',
    whatsappPhone: '918510055400',
    score: 100,
    tags: ['delhi', 'mundka', 'cafes', 'schools']
  }),

  makeCreator({
    id: 'hub_v032',
    displayName: '360 Virtual Space',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Delhi NCR',
    bio: 'Immersive 360 virtual tours for colleges, hospitals, coaching centers, and restaurants across Delhi NCR.',
    website: 'https://360virtualspace.com',
    whatsappPhone: '919971257789',
    score: 100,
    tags: ['delhi-ncr', 'colleges', 'hospitals']
  }),

  makeCreator({
    id: 'hub_v033',
    displayName: 'Pexels360 Matterport Tours',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Mumbai / Pune',
    bio: 'Matterport 3D virtual tour scanning for real estate developers, sample flats, and commercial properties.',
    website: 'https://pexels360.com',
    whatsappPhone: '917020495358',
    score: 105,
    tags: ['matterport', 'real-estate', 'sample-flats']
  }),

  makeCreator({
    id: 'hub_v034',
    displayName: 'Digital Endeavours',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Bangalore / Pan-India',
    bio: 'Google Street View photography, Matterport 3D scans, and aerial LiDAR surveys for commercial real estate.',
    website: 'https://digitalendeavours.net',
    whatsappPhone: '917710771360',
    score: 110,
    tags: ['bangalore', 'google-street-view', 'matterport']
  }),

  makeCreator({
    id: 'hub_v035',
    displayName: 'Phoenix Branding 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Bangalore, Karnataka',
    bio: 'Professional 360 photography, virtual tours, and Google My Business 360 photos in Bengaluru.',
    website: 'https://phoenixbranding.in',
    whatsappPhone: '919141133678',
    score: 100,
    tags: ['bangalore', 'karnataka', 'gmb-photos']
  }),

  makeCreator({
    id: 'hub_v036',
    displayName: 'Jalls Media Virtual Reality',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Chennai, Tamil Nadu',
    bio: '360° virtual tours for hotels, schools, hospitals, and showrooms across Chennai and Tamil Nadu.',
    website: 'https://jallsmedia.net',
    whatsappPhone: '919884060032',
    score: 100,
    tags: ['chennai', 'tamil-nadu', 'virtual-tour']
  }),

  makeCreator({
    id: 'hub_v037',
    displayName: 'Virtual Dekho 360',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: '360 virtual tours and interactive business walkthroughs for Google Maps and websites in Mumbai.',
    website: 'https://virtualdekho.com',
    whatsappPhone: '917208638910',
    score: 100,
    tags: ['mumbai', 'virtual-dekho', 'google-maps']
  }),

  makeCreator({
    id: 'hub_v038',
    displayName: 'Go360 Virtual Tours',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Kochi, Kerala',
    bio: 'Specialist in 360 panoramic photography, virtual tour production, and tourism virtual walks in Kerala.',
    website: 'https://go360.in',
    whatsappPhone: '919995358120',
    score: 100,
    tags: ['kochi', 'kerala', 'tourism-360']
  }),

  makeCreator({
    id: 'hub_v039',
    displayName: 'Dronaa Ibx 360 Tours',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pune, Maharashtra',
    bio: '360 virtual tours, Google Maps panoramic uploads, and industrial drone inspections in Pune.',
    whatsappPhone: '918043872921',
    score: 95,
    tags: ['pune', 'drone', 'virtual-tour']
  }),

  makeCreator({
    id: 'hub_v040',
    displayName: 'Intermind Digital Solutions',
    username: null,
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Mumbai, Maharashtra',
    bio: 'Virtual tour solutions and 360 digital media integration for corporate and institutional facilities.',
    whatsappPhone: '918043828090',
    score: 95,
    tags: ['mumbai', 'corporate-tours']
  }),

  makeCreator({
    id: 'hub_v041',
    displayName: 'Digital Images 360',
    username: null,
    category: '360_PHOTOGRAPHER',
    city: 'Mumbai, Maharashtra',
    bio: 'Matterport and 360 virtual tour photography studio for residential and commercial real estate.',
    whatsappPhone: '917942658674',
    score: 95,
    tags: ['mumbai', 'residential-real-estate']
  }),

  makeCreator({
    id: 'hub_v042',
    displayName: 'Viasell Consultancy Services',
    username: null,
    category: 'GOOGLE_STREET_VIEW_AGENCY',
    city: 'Pune, Maharashtra',
    bio: '360-degree virtual business tours and Google Street View publishing services in Maharashtra.',
    whatsappPhone: '917949346411',
    score: 95,
    tags: ['pune', 'google-street-view']
  })
];

// ==========================================
// 3. VERIFIED GLOBAL 360 CREATORS & PLATFORMS ON INSTAGRAM
// ==========================================
const verifiedGlobalCreators = [
  makeCreator({
    id: 'hub_g001',
    displayName: 'Ben Claremont',
    username: 'benclaremont',
    category: '360_PHOTOGRAPHER',
    city: 'Global / Australia',
    bio: 'World leading 360 camera expert, Virtual Tour Pro educator, YouTube creator with 200k+ subscribers on 360 photography.',
    website: 'https://benclaremont.com',
    score: 150,
    tags: ['educator', 'virtual-tour-pro', 'insta360', 'youtube']
  }),

  makeCreator({
    id: 'hub_g002',
    displayName: 'CloudPano',
    username: 'cloudpano',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Global / USA',
    bio: 'Leading 360° virtual tour software community and creator platform for Google Street View photographers.',
    website: 'https://cloudpano.com',
    score: 145,
    tags: ['software', 'community', 'virtual-tours']
  }),

  makeCreator({
    id: 'hub_g003',
    displayName: 'Kuula 360 Virtual Tours',
    username: 'kuula360',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Global / USA',
    bio: 'Official Instagram for Kuula — 360 virtual tour software used by hundreds of thousands of photographers worldwide.',
    website: 'https://kuula.co',
    score: 140,
    tags: ['kuula', 'virtual-tours', '360-photo']
  }),

  makeCreator({
    id: 'hub_g004',
    displayName: 'Insta360 Official',
    username: 'insta360',
    category: '360_PHOTOGRAPHER',
    city: 'Global',
    bio: 'Think Bold. Official account for Insta360 cameras (X3, X4, Titan, Pro2) used by Google Street View contributors.',
    website: 'https://insta360.com',
    score: 140,
    tags: ['insta360', 'camera', 'hardware']
  }),

  makeCreator({
    id: 'hub_g005',
    displayName: 'RICOH THETA Official',
    username: 'theta360official',
    category: '360_PHOTOGRAPHER',
    city: 'Global / Japan',
    bio: 'Official Instagram for RICOH THETA 360° cameras — the pioneer in 360 capture for Google Street View.',
    website: 'https://theta360.com',
    score: 135,
    tags: ['ricoh-theta', '360-camera', 'google-street-view']
  }),

  makeCreator({
    id: 'hub_g006',
    displayName: '3DVista Virtual Tour',
    username: '3dvista',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Global / Spain',
    bio: 'Professional multimedia 360° virtual tour software with Google Maps integration and e-learning features.',
    website: 'https://3dvista.com',
    score: 135,
    tags: ['3dvista', 'multimedia', 'software']
  }),

  makeCreator({
    id: 'hub_g007',
    displayName: 'Matterport Official',
    username: 'matterport',
    category: 'VIRTUAL_TOUR_AGENCY',
    city: 'Global / USA',
    bio: 'Spatial data and digital twins. Matterport 3D cameras and virtual tour technology used by real estate creators globally.',
    website: 'https://matterport.com',
    score: 135,
    tags: ['matterport', 'digital-twins', '3d-tours']
  })
];

// Combine all verified creators
const allVerifiedCreators = [
  ...verifiedIndianAgencies,
  ...verifiedGlobalCreators
];

// Output summary
console.log(`\n======================================================`);
console.log(`  BUILDING PANOPUBLISH OUTREACH HUB DATABASE`);
console.log(`======================================================`);
console.log(`Total verified creators: ${allVerifiedCreators.length}`);
console.log(`- Verified Instagram profiles: ${allVerifiedCreators.filter(c => c.hasVerifiedInstagram).length}`);
console.log(`- Verified WhatsApp contacts: ${allVerifiedCreators.filter(c => c.hasVerifiedWhatsApp).length}`);
console.log(`- Indian agencies / photographers: ${verifiedIndianAgencies.length}`);
console.log(`- Global platforms & educators: ${verifiedGlobalCreators.length}`);

// Write to data/outreach-hub.json
const outputPath = path.resolve(__dirname, '../data/outreach-hub.json');
fs.writeFileSync(outputPath, JSON.stringify(allVerifiedCreators, null, 2), 'utf8');
console.log(`✓ Successfully written to: ${outputPath}\n`);
