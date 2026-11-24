"use client";

import SurveyMap, { type SurveyMapProps } from "@/components/case-studies/survey/survey-map";
import AC_GEO from "@/lib/data/tamil-nadu/tn-acs.json";
import DISTRICT_GEO from "@/lib/data/tamil-nadu/tn-districts.json";
import { TN_COLOR, TN_COLOR_DARK, TN_GROUPS, TN_NO_DATA } from "@/lib/tamil-nadu/model";
import { TN_CONFIG } from "@/lib/case-study/config";

export default function TamilNaduMap(props: Omit<SurveyMapProps, "acGeo" | "districtGeo" | "partyOrder" | "partyColors" | "partyColorsDark" | "noDataColor" | "labelOffset" | "mobileLabelOffset" | "districtAlias">) {
  return (
    <SurveyMap
      {...props}
      acGeo={AC_GEO as unknown as SurveyMapProps["acGeo"]}
      districtGeo={DISTRICT_GEO as unknown as SurveyMapProps["districtGeo"]}
      partyOrder={TN_GROUPS}
      partyColors={TN_COLOR}
      partyColorsDark={TN_COLOR_DARK}
      noDataColor={TN_NO_DATA}
      labelOffset={TN_CONFIG.map.labelOffset}
      mobileLabelOffset={TN_CONFIG.map.mobileLabelOffset}
      districtAlias={TN_CONFIG.map.districtAlias}
      fillMode="gradient"
      mobileLabelCount={10}
      mobileForcedLabels={["Chennai", "Kanniyakumari"]}
      stateTilt={0.82}
      stateFit={1}
      avoidDistrictCollisions
    />
  );
}
