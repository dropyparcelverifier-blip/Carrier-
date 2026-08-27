export type Client = {
  name: string;
  href: string;
  domain: string;
  city: string;
  focus: string;
  mark: string;
  brandColor: string;
  /** Path to logo in /public/clients/ — SVG, PNG or JPG. Falls back to mark initials. */
  logo?: string;
};

export const CLIENTS: Client[] = [
  {
    name: "Nykaa",
    href: "https://www.nykaa.com/",
    domain: "nykaa.com",
    city: "Mumbai",
    focus: "Beauty and wellness marketplace — imported SKUs across every category we clear",
    mark: "NY",
    brandColor: "#FC2779",
    logo: "/clients/nykaa.svg",
  },
  {
    name: "Amazon",
    href: "https://www.amazon.in/",
    domain: "amazon.in",
    city: "Bengaluru",
    focus: "Cross-border fulfilment — bonded-to-warehouse handoff for FBA-bound stock",
    mark: "AZ",
    brandColor: "#FF9900",
    logo: "/clients/amazon.svg",
  },
  {
    name: "Flipkart",
    href: "https://www.flipkart.com/",
    domain: "flipkart.com",
    city: "Bengaluru",
    focus: "Marketplace imports — customs clearance through to seller-hub delivery",
    mark: "FK",
    brandColor: "#2874F0",
    logo: "/clients/flipkart.svg",
  },
  {
    name: "Rudra Retails",
    href: "https://rudraretails.com/",
    domain: "rudraretails.com",
    city: "Navi Mumbai",
    focus: "Premium personal care and lifestyle — supplements, skincare and makeup",
    mark: "RR",
    brandColor: "#12224C",
    logo: "/clients/rudra-retails.png",
  },
  {
    name: "Sourcery",
    href: "https://sourcery.co.in/",
    domain: "sourcery.co.in",
    city: "Mumbai",
    focus: "Sourcing and procurement partner — supplier consolidation at origin",
    mark: "SR",
    brandColor: "#0F9D6D",
    // logo: "/clients/sourcery.svg",
  },
  {
    name: "Meesho",
    href: "https://www.meesho.com/",
    domain: "meesho.com",
    city: "Bengaluru",
    focus: "Social commerce marketplace — cross-border seller stock cleared and handed off to fulfilment",
    mark: "ME",
    brandColor: "#570A57",
    logo: "/clients/meesho.png",
  },
];