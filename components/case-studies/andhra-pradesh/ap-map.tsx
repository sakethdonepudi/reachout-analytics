"use client";

import SurveyMap, { type SurveyMapProps } from "@/components/case-studies/survey/survey-map";
import AC_GEO from "@/lib/data/andhra-pradesh/ap-acs.json";
import DISTRICT_GEO from "@/lib/data/andhra-pradesh/ap-districts.json";
import { AP_CONFIG } from "@/lib/case-study/config";

export const AP_COLOR: Record<string, string> = { NDA: "#f7a325", YSRCP: "#1f6fd1", INC: "#0f7043", Others: "#8c8f96" };
export const AP_COLOR_DARK: Record<string, string> = { NDA: "#ffb340", YSRCP: "#4f8ef7", INC: "#1faa70", Others: "#8f939b" };

export default function ApMap(props: Omit<SurveyMapProps, "acGeo" | "districtGeo" | "partyOrder" | "partyColors" | "partyColorsDark" | "noDataColor" | "labelOffset" | "mobileLabelOffset" | "districtAlias">) {
  return (
    <SurveyMap
      {...props}
      acGeo={AC_GEO as unknown as SurveyMapProps["acGeo"]}
      districtGeo={DISTRICT_GEO as unknown as SurveyMapProps["districtGeo"]}
      partyOrder={AP_CONFIG.parties}
      partyColors={AP_COLOR}
      partyColorsDark={AP_COLOR_DARK}
      noDataColor="#94A3B8"
      labelOffset={AP_CONFIG.map.labelOffset}
      mobileLabelOffset={AP_CONFIG.map.mobileLabelOffset}
      districtAlias={AP_CONFIG.map.districtAlias}
      fillMode={AP_CONFIG.map.fillMode}
      mobileLabelCount={AP_CONFIG.map.mobileLabelCount ?? 8}
      mobileForcedLabels={[]}
      avoidDistrictCollisions
      stateTilt={AP_CONFIG.map.tilt}
      stateFit={AP_CONFIG.map.fit}
      stateCenterZ={AP_CONFIG.map.centerZ}
      mapRotation={AP_CONFIG.map.rotation}
    />
  );
}
