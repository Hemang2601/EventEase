import summit from "@/assets/tech-summit.jpg";
import workshop from "@/assets/design-workshop.jpg";
import cultural from "@/assets/cultural-fest.jpg";
import hackathon from "@/assets/hackathon.jpg";

export const CATEGORIES = ["Technology", "Hackathon", "Workshop", "Cultural", "Networking"] as const;
export type Category = (typeof CATEGORIES)[number];

const images: Record<string, string> = {
  Technology: summit,
  Hackathon: hackathon,
  Workshop: workshop,
  Cultural: cultural,
  Networking: summit,
};

export const categoryImage = (c: string | null | undefined) => images[c ?? ""] ?? summit;

export const GATES = ["Gate 01", "Gate 02", "Gate 03"] as const;
