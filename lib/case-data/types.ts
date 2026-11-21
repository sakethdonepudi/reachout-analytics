export type PollKind = "opinion" | "exit";
export type SegmentScope = "statewide" | "district" | "assembly";
export type SegmentType = "gender" | "age" | "caste" | "region";

export type PollSegment = {
  state: string;
  pollType: PollKind;
  scope: SegmentScope;
  scopeName: string | null;
  segmentType: SegmentType;
  segmentLabel: string;
  party: string;
  /** Percentage points, 0-100. */
  share: number;
  n: number | null;
  asOf: string;
};

export type ReasonNumber = { label: string; party: string; share: number };

export type VoteShareReason = {
  id: string;
  state: string;
  title: string;
  party: string;
  /** Percentage points, signed. */
  impactPp: number;
  segments: string[];
  explanation: string;
  before: ReasonNumber[];
  after: ReasonNumber[];
  relatedCampaigns: string[];
  socialUrls: string[];
  asOf: string;
};

export const SEGMENT_TYPES: SegmentType[] = ["gender", "age", "caste", "region"];
