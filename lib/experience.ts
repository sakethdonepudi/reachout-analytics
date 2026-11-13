export type ExperienceOrganisation = {
  name: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  /** Optical height in px. Keeps wordmarks and compact marks balanced. */
  opticalHeight: number;
};

export const EXPERIENCE_ORGANISATIONS: ExperienceOrganisation[] = [
  {
    name: "SBI",
    alt: "State Bank of India logo",
    src: "/logos/experience/sbi.svg",
    width: 550,
    height: 286,
    opticalHeight: 40,
  },
  {
    name: "IBM",
    alt: "IBM logo",
    src: "/logos/experience/ibm.svg",
    width: 1000,
    height: 401,
    opticalHeight: 34,
  },
  {
    name: "Visa",
    alt: "Visa logo",
    src: "/logos/experience/visa.svg",
    width: 1000,
    height: 325,
    opticalHeight: 24,
  },
  {
    name: "Aon",
    alt: "Aon logo",
    src: "/logos/experience/aon.svg",
    width: 240,
    height: 91,
    opticalHeight: 28,
  },
  {
    name: "EY",
    alt: "EY logo",
    src: "/logos/experience/ey.svg",
    width: 69,
    height: 69,
    opticalHeight: 30,
  },
  {
    name: "Dr. Reddy’s",
    alt: "Dr. Reddy's Laboratories logo",
    src: "/logos/experience/dr-reddys.svg",
    width: 171,
    height: 38,
    opticalHeight: 26,
  },
  {
    name: "Capgemini",
    alt: "Capgemini logo",
    src: "/logos/experience/capgemini.svg",
    width: 1024,
    height: 239,
    opticalHeight: 27,
  },
  {
    name: "Epsilon",
    alt: "Epsilon logo",
    src: "/logos/experience/epsilon.svg",
    width: 1091,
    height: 290,
    opticalHeight: 27,
  },
  {
    name: "Deloitte",
    alt: "Deloitte logo",
    src: "/logos/experience/deloitte.svg",
    width: 892,
    height: 171,
    opticalHeight: 28,
  },
  {
    name: "L&T",
    alt: "Larsen & Toubro logo",
    src: "/logos/experience/larsen-toubro.svg",
    width: 3000,
    height: 3000,
    opticalHeight: 36,
  },
  {
    name: "Dell",
    alt: "Dell logo",
    src: "/logos/experience/dell.svg",
    width: 300,
    height: 300,
    opticalHeight: 34,
  },
  {
    name: "Cognizant",
    alt: "Cognizant logo",
    src: "/logos/experience/cognizant.svg",
    width: 820,
    height: 190,
    opticalHeight: 26,
  },
  {
    name: "MetLife",
    alt: "MetLife logo",
    src: "/logos/experience/metlife.svg",
    width: 750,
    height: 175,
    opticalHeight: 27,
  },
  {
    name: "ANZ",
    alt: "ANZ logo",
    src: "/logos/experience/anz.svg",
    width: 704,
    height: 156,
    opticalHeight: 28,
  },
];
