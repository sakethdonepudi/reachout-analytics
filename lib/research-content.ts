export type ResearchIcon = "proposal" | "thesis" | "statistics" | "article" | "report" | "web";

export type ResearchService = {
  title: string;
  category: string;
  description: string;
  deliverables: string[];
  icon: ResearchIcon;
};

export const RESEARCH_CATEGORIES = [
  "Business content",
  "Website content and blogs",
  "Research articles",
  "Thesis/dissertation support",
  "Research proposals",
  "Statistical analysis",
] as const;

export const RESEARCH_SERVICES: ResearchService[] = [
  {
    title: "Research topic development & proposal guidance",
    category: "Research proposals",
    description: "Shape a focused research question, frame the gap and build a proposal that is clear about scope, evidence and method.",
    deliverables: ["Topic and scope exploration", "Literature and gap framing", "Proposal structure and feedback"],
    icon: "proposal",
  },
  {
    title: "Dissertation & thesis support",
    category: "Thesis/dissertation support",
    description: "Methodology guidance, chapter feedback, editing and formatting support for the researcher's own thesis.",
    deliverables: ["Methodology review", "Chapter-level feedback", "Editing and formatting checks"],
    icon: "thesis",
  },
  {
    title: "Statistical analysis & interpretation",
    category: "Statistical analysis",
    description: "Data preparation, appropriate statistical analysis, visualisation and plain-language interpretation.",
    deliverables: ["Data preparation and checks", "Analysis aligned to the question", "Visualisation and interpretation"],
    icon: "statistics",
  },
  {
    title: "Research article development & submission support",
    category: "Research articles",
    description: "Structure, editing and journal-submission preparation for an article the researcher has developed.",
    deliverables: ["Article structure review", "Editing and consistency checks", "Submission checklist"],
    icon: "article",
  },
  {
    title: "Business content & professional reports",
    category: "Business content",
    description: "Clear, well-sourced business writing for reports, proposals, explainers and internal communications.",
    deliverables: ["Content outline", "Drafting and editing", "Source and consistency review"],
    icon: "report",
  },
  {
    title: "Website copy, blogs & SEO content",
    category: "Website content and blogs",
    description: "Reader-focused website copy, articles and SEO-aware content with clear structure and accurate attribution.",
    deliverables: ["Content and keyword brief", "Draft copy and editing", "SEO-aware structure review"],
    icon: "web",
  },
];

export const QUALITY_STATEMENTS = [
  "Original writing with clear source attribution.",
  "Accurate, carefully reviewed information.",
  "Clear structure and consistent formatting.",
  "Analysis appropriate to the research question.",
  "SEO-aware writing where relevant.",
  "Confidential handling of project materials.",
];

/** Legacy figures are intentionally not displayed. Their meaning, reporting date and consistency with current company information have not been verified. */
export const UNVERIFIED_LEGACY_COUNTERS = {
  corporateTrainingProgrammes: "196+",
  inHouseTrainingBatches: "118+",
  projects: "450+",
  contentPieces: "800,000+",
  articlesPublications: "1,340+",
  phdThesisProjects: "86+",
  status: "unpublished pending confirmation of meaning, reporting date and consistency",
} as const;
