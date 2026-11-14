// Planned public tiers. Display copy does not grant entitlements or enable billing.
export const PLAN_CATALOG = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "Public multi-source discovery",
      "Private project workspace",
      "Live paper and researcher discovery",
      "Evidence library and saved records",
      "EYRA assistance with usage limits",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "per month",
    featured: true,
    features: [
      "EYRA AI assistance with usage limits",
      "Extended project workflows",
      "Official funding Radar and watchlists",
      "EYRA Voice sourced assistant",
      "Executive Briefing and Project Twin",
      "Research Battlefield and Future Simulator",
      "Evidence-backed Impact Assessment",
    ],
  },
  {
    key: "founder",
    name: "Founder",
    price: "$49",
    period: "per month",
    features: [
      "Everything in Pro",
      "Grant Builder and application tracker",
      "Pitch Deck AI with PDF export",
      "Dream Team candidate discovery",
      "Startup planning with evidence",
      "Funding and project execution workspace",
    ],
  },
  {
    key: "institution",
    name: "Institution",
    price: "Custom",
    period: "per organization",
    features: [
      "Everything in Founder",
      "Institution analytics dashboard",
      "Organization-level activity metrics",
      "Support for team access and onboarding",
      "A rollout planned around your organization",
    ],
  },
];
