export type ServiceIcon =
  | "poll" | "map" | "swing" | "research" | "dashboard" | "database"
  | "analytics" | "bi" | "ml" | "mining" | "insight" | "security"
  | "marketing" | "training" | "statistics";

export type ServiceArea = {
  title: string;
  description: string;
  deliverables: string[];
  icon: ServiceIcon;
  caseStudy?: { label: string; href: string };
};

export const POLITICAL_SERVICES: ServiceArea[] = [
  {
    title: "Opinion polls & exit-poll analysis",
    description: "Survey design, response analysis and clear reporting for political research programmes.",
    deliverables: ["Questionnaire and sample plan", "Validated response tables", "Poll and exit-poll analysis", "Segment and constituency readouts"],
    icon: "poll",
    caseStudy: { label: "Tamil Nadu case study", href: "/case-studies/tamil-nadu" },
  },
  {
    title: "Geographic election analysis",
    description: "District and constituency insights, historical comparisons and interactive maps built on available results and survey data.",
    deliverables: ["District and assembly profiles", "Historical comparison pack", "Interactive map dashboard", "Boundary and data QA"],
    icon: "map",
    caseStudy: { label: "Tamil Nadu & Telangana", href: "/case-studies" },
  },
  {
    title: "Vote-share & swing analysis",
    description: "Compare vote shares and swings across elections and survey periods with a clear account of the underlying data.",
    deliverables: ["Vote-share baselines", "Swing and change analysis", "Party and segment comparisons", "Visual analysis pack"],
    icon: "swing",
    caseStudy: { label: "Telangana case study", href: "/case-studies/telangana" },
  },
  {
    title: "Campaign research",
    description: "Issue research, public sentiment and communication-performance analysis using the data available to the project.",
    deliverables: ["Issue and sentiment map", "Message-performance analysis", "Audience research summary", "Campaign learning report"],
    icon: "research",
  },
  {
    title: "Election dashboards",
    description: "Interactive reporting with geographic filters, comparative charts and a clear audit trail for teams working from the same evidence.",
    deliverables: ["Scoped reporting dashboard", "Geographic and party filters", "Comparative charts and tables", "Data validation and handover"],
    icon: "dashboard",
    caseStudy: { label: "Explore live dashboards", href: "/case-studies" },
  },
  {
    title: "Survey data management",
    description: "Collection workflows, cleaning, validation and controlled Excel import/export for political survey programmes.",
    deliverables: ["Collection templates", "Cleaning and validation log", "Controlled Excel import/export", "Audited working dataset"],
    icon: "database",
  },
];

export const DATA_SERVICES: ServiceArea[] = [
  {
    title: "Data analysis & preparation",
    description: "Clean, organise and investigate data so that analysis starts from a trustworthy base.",
    deliverables: ["Data audit and profiling", "Prepared analysis dataset", "Quality and transformation log", "Findings memo"],
    icon: "analytics",
  },
  {
    title: "Business intelligence & dashboards",
    description: "Accessible reporting for operational and strategic decisions, designed around the questions teams actually need to answer.",
    deliverables: ["KPI and metric model", "Interactive dashboard", "Documentation", "Review and handover"],
    icon: "bi",
  },
  {
    title: "Machine learning & predictive modelling",
    description: "Forecasting, classification and analytical models selected for the problem, data and decision context.",
    deliverables: ["Problem and data framing", "Feature preparation", "Model evaluation", "Deployment-ready output"],
    icon: "ml",
  },
  {
    title: "Data mining",
    description: "Identify useful patterns and relationships in complex datasets through exploratory and statistical analysis.",
    deliverables: ["Exploratory analysis", "Pattern and relationship map", "Validation checks", "Insight summary"],
    icon: "mining",
  },
  {
    title: "Business insights",
    description: "Performance, customer, risk and operational analysis translated into practical recommendations.",
    deliverables: ["Diagnostic analysis", "Opportunity and risk map", "Actionable recommendations", "Decision pack"],
    icon: "insight",
  },
  {
    title: "Data security & governance",
    description: "Access controls, responsible data handling and data-quality practices for analytics programmes.",
    deliverables: ["Data-flow review", "Access and retention controls", "Quality checks", "Governance checklist"],
    icon: "security",
  },
  {
    title: "Marketing analytics",
    description: "SEO, social-media performance and campaign ROI analysis using available measurement data.",
    deliverables: ["Channel measurement plan", "Performance dashboard", "Attribution and ROI analysis", "Recommendations"],
    icon: "marketing",
  },
  {
    title: "Corporate training",
    description: "Practical data science, AI, machine-learning and business-analytics programmes for teams and professionals.",
    deliverables: ["Needs assessment", "Custom curriculum", "Hands-on labs and case studies", "Participant evaluation"],
    icon: "training",
  },
  {
    title: "Research & statistical support",
    description: "Study design, statistical analysis, visualisation and interpretation for research projects.",
    deliverables: ["Study design support", "Statistical analysis", "Research visualisations", "Interpretation report"],
    icon: "statistics",
  },
];

export const SERVICE_CATEGORIES = [...POLITICAL_SERVICES, ...DATA_SERVICES].map((s) => s.title);

export const serviceHref = (service: string) => `/services?service=${encodeURIComponent(service)}#enquiry`;
