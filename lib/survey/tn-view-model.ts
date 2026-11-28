import type { SurveyDemo, SurveyShare } from "./types";
import type { TnSocialMonth } from "./social-types";
import type { TnAc, TnDistrict } from "@/lib/tamil-nadu/model";
import type { SurveyMapRow, SurveyMapSlot } from "@/lib/tamil-nadu/survey-map";

export type TnSerializedMap = {
  slot: SurveyMapSlot;
  acs: TnAc[];
  districts: TnDistrict[];
  districtRows: Record<string, SurveyMapRow>;
  acRows: Record<string, SurveyMapRow>;
  resultRows: Record<string, { acs: number; seats: Record<string, number>; total: number }>;
  regions?: TnDistrict[];
  regionRows?: Record<string, SurveyMapRow>;
};

export type TnSwingSource = { key: string; label: string; expected: Record<string, SurveyShare>; seats: Record<string, unknown>; n: number; base?: Record<string, SurveyShare>; last?: string; target?: string };
export type TnSwingPayload = { sources: Record<string, TnSwingSource[]> };

export type TnSlotModel = {
  key: string;
  label: string;
  buttonLabel: string;
  monthKey?: string;
  subKey?: string;
  n: number;
  from: string;
  to: string;
  expected: Record<string, SurveyShare>;
  seats: Record<string, unknown>;
  demoCatalog: Record<string, { label: string; cov?: string }>;
  profiles: Record<string, SurveyDemo>;
  lazyProfiles: string[];
};

export type TnCardModel = {
  key: string;
  label: string;
  n: number;
  expected: SurveyShare;
  accuracy?: number;
  showAccuracy?: boolean;
  seats?: Record<string, number>;
  summaryLine?: string;
  seatsLine?: string;
};

export type TnClientModel = {
  parties: string[];
  regions: string[];
  actual: Record<string, SurveyShare>;
  base?: Record<string, SurveyShare>;
  zonelabels?: Record<string, string>;
  n_total: number;
  actualSeats: Record<string, unknown>;
  actualZones: Record<string, Record<string, unknown>>;
  cards: TnCardModel[];
  slots: Record<string, TnSlotModel[]>;
  swing: TnSwingPayload;
  initialMap: TnSerializedMap;
  socialMonthly: TnSocialMonth[];
  meta?: Record<string, unknown>;
};
