import { Retailer } from "./types";

export const retailers: Retailer[] = [
  {
    slug: "albert-heijn",
    name: "Albert Heijn",
    logo: "/retailers/albert-heijn.png",
    color: "#00A0E2",
    website: "https://www.ah.be",
    description:
      "Bekijk de nieuwste Albert Heijn Bonusfolder en ontdek de beste AH aanbiedingen van deze week.",
    category: "supermarkt",
  },
  {
    slug: "lidl",
    name: "Lidl",
    logo: "/retailers/lidl.png",
    color: "#0050AA",
    website: "https://www.lidl.be",
    description:
      "Ontdek de Lidl folder van deze week met de scherpste prijzen en weekendaanbiedingen.",
    category: "supermarkt",
  },
  {
    slug: "delhaize",
    name: "Delhaize",
    logo: "/retailers/delhaize.png",
    color: "#E31837",
    website: "https://www.delhaize.be",
    description:
      "Bekijk de Delhaize folder van deze week en profiteer van de beste supermarktpromoties.",
    category: "supermarkt",
  },
  {
    slug: "colruyt",
    name: "Colruyt",
    logo: "/retailers/colruyt.png",
    color: "#E94E1B",
    website: "https://www.colruyt.be",
    description:
      "Bekijk de Colruyt folder en ontdek de laagste prijzen van deze week in België.",
    category: "supermarkt",
  },
];

export function getRetailerBySlug(slug: string): Retailer | undefined {
  return retailers.find((r) => r.slug === slug);
}

export function getRetailersByCategory(
  category: Retailer["category"]
): Retailer[] {
  return retailers.filter((r) => r.category === category);
}
