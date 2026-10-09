import { getMongo } from "@/lib/mongodb";

/* =====================================================================
   Editable About page content. Defaults reproduce the supplied copy;
   admins can override any field from /admin → Website Content.
   ===================================================================== */

export type Expertise = { title: string; desc: string };
export type AboutContent = {
  eyebrow: string;
  headline: string;
  intro: string;
  overview: string[];
  expertise: Expertise[];
  team: { name: string; role: string; bio: string[]; portrait: string; portraitAlt: string };
  professionalOrgs: string[];
  trainingOrgs: string[];
  skills: string[];
  cta: { title: string; body: string; button: string };
};

export const ABOUT_DEFAULT: AboutContent = {
  eyebrow: "ABOUT REACHOUT ANALYTICS",
  headline: "Expertise that turns data into decisions.",
  intro:
    "ReachOut Analytics brings together data science, practical research and professional education to help organisations make informed decisions and develop analytical capability.",
  overview: [
    "Our work combines the expertise of technologists, academics and industry professionals. We connect analytical theory with hands-on field experience, bringing practical understanding to the projects and training programmes we deliver.",
    "From analytics and prediction to artificial intelligence and machine learning, our approach focuses on understanding the problem, applying appropriate methods and communicating useful insights.",
    "For clients and learners alike, we aim to deliver an experience built on quality, relevance, depth and practical application.",
  ],
  expertise: [
    { title: "Data Analytics", desc: "Research, modelling and insights that support business decisions." },
    { title: "Applied Data Science", desc: "Predictive methods, artificial intelligence and machine learning." },
    { title: "Professional Education", desc: "Practical training for students, professionals and organisational leaders." },
  ],
  team: {
    name: "Venkat Rao",
    role: "Data Scientist, Analyst & Educator",
    bio: [
      "Venkat Rao is a data scientist, analyst and multidisciplinary professional with over 22 years of field experience. He holds a master’s degree in Operations Research from the Indian Statistical Institute, Calcutta, and an MBA from IIM Calcutta.",
      "His technical experience spans R, SAS, Python, Rattle and SPSS, alongside a range of artificial intelligence and machine-learning tools and techniques. He has worked across industries, applying analytics and prediction to improve business performance and address operational challenges. His professional experience includes engagements with organisations such as SBI, Benz, Epsilon, IBM, Visa, AON, EY, Dr. Reddy’s and Capgemini.",
      "As a corporate trainer, he works with audiences ranging from senior executives to early-career professionals. He is a visiting faculty member at CDAC and has delivered training for organisations including IBM, SBI, Benz, Deloitte, L&T, Dell, Cognizant, Mestek, MetLife, ANZ, Shriram, Capgemini and EY. His interests also include education and research: he has published data-science research in national and international journals and has guided over 100 scholars in their doctoral work.",
    ],
    portrait: "/team/venkat-rao.png",
    portraitAlt: "Portrait of Venkat Rao",
  },
  professionalOrgs: ["SBI", "Benz", "Epsilon", "IBM", "Visa", "AON", "EY", "Dr. Reddy’s", "Capgemini"],
  trainingOrgs: ["IBM", "SBI", "Benz", "Deloitte", "L&T", "Dell", "Cognizant", "Mestek", "MetLife", "ANZ", "Shriram", "Capgemini", "EY"],
  skills: ["R", "SAS", "Python", "Rattle", "SPSS", "Artificial Intelligence & Machine Learning"],
  cta: {
    title: "Let’s turn your data into decisions.",
    body: "Talk to our team about analytics, training or a campaign.",
    button: "Book a consultation",
  },
};

const DB = process.env.MONGODB_DB || "reachout";

export async function getAbout(): Promise<AboutContent> {
  try {
    const p = getMongo();
    if (!p) return ABOUT_DEFAULT;
    const client = await p;
    const col = client.db(DB).collection<{ _id: string } & Record<string, unknown>>("site_content");
    const doc = await col.findOne({ _id: "about" });
    if (!doc) return ABOUT_DEFAULT;
    const { _id, ...rest } = doc;
    void _id;
    return { ...ABOUT_DEFAULT, ...rest, team: { ...ABOUT_DEFAULT.team, ...((rest.team as AboutContent["team"]) ?? {}) }, cta: { ...ABOUT_DEFAULT.cta, ...((rest.cta as AboutContent["cta"]) ?? {}) } } as AboutContent;
  } catch {
    return ABOUT_DEFAULT;
  }
}

export async function saveAbout(patch: Partial<AboutContent>): Promise<AboutContent> {
  const p = getMongo();
  if (!p) throw new Error("Database not configured");
  const client = await p;
  await client.db(DB).collection<{ _id: string } & Record<string, unknown>>("site_content").updateOne(
    { _id: "about" },
    { $set: patch as unknown as Record<string, unknown> },
    { upsert: true },
  );
  return getAbout();
}
