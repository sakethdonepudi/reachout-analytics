/* =====================================================================
   Representative Tamil Nadu PIN codes (district-level demo set).

   This is a curated subset — a handful of principal PINs per district —
   used to drive the demo. It is intentionally NOT the full PIN directory.
   Replace with the authoritative India Post / data.gov.in PIN directory
   (then a district→PIN lookup) when real data is connected.

   Source: India Post PIN directory (data.gov.in), representative subset.
   Keys match TN_DISTRICTS names in ./tamil-nadu-districts.ts.
   ===================================================================== */

/**
 * Provenance descriptor for the bundled postal reference.
 * Used to label "PIN Mapping Source" on the assumed-PIN scenario.
 */
export const POSTAL_REFERENCE = {
  name: "India Post PIN directory (data.gov.in) — bundled TN district↔PIN reference",
  shortName: "India Post PIN directory",
  source: "https://data.gov.in (India Post PIN codes)",
  version: "assumed-pin-ref-2026-02.1 (bundled TN subset)",
  /** "subset" = a representative selection, not the full postal directory. */
  completeness: "subset" as "subset" | "complete",
  note:
    "Verified PIN↔district pairs, bundled as a representative SUBSET of the India Post PIN directory " +
    "(not the full directory). Used only to choose candidate PINs for the assumed-PIN scenario; it does not " +
    "represent a respondent's real location.",
} as const;

/**
 * District-name reconciliation. The survey data uses shortened/renamed
 * spellings for some districts; these map a data spelling (lowercased,
 * alphanumerics only) to the canonical reference district.
 */
export const DISTRICT_ALIASES: Record<string, string> = {
  kanniyakumari: "Kanyakumari",
  kanyakumari: "Kanyakumari",
  tirunelveli: "Tirunelveli",
  nellai: "Tirunelveli",
  thoothukudi: "Thoothukkudi",
  tuticorin: "Thoothukkudi",
  thoothukkudi: "Thoothukkudi",
  tiruchirappalli: "Tiruchirappalli",
  trichy: "Tiruchirappalli",
  trichinopoly: "Tiruchirappalli",
  nilgiri: "Nilgiris",
  nilgiris: "Nilgiris",
  thenilgiris: "Nilgiris",
  villupuram: "Viluppuram",
  viluppuram: "Viluppuram",
  vizhupuram: "Viluppuram",
  tirupattur: "Tirupathur",
  tirupathur: "Tirupathur",
  kanchipuram: "Kancheepuram",
  kancheepuram: "Kancheepuram",
  sivagangai: "Sivaganga",
  sivaganga: "Sivaganga",
  ramnad: "Ramanathapuram",
  ramanathapuram: "Ramanathapuram",
  pudukkottai: "Pudukkottai",
  thiruvarur: "Thiruvarur",
  tiruvarur: "Thiruvarur",
  nagapattinam: "Nagapattinam",
  nagappattinam: "Nagapattinam",
  mayiladuthurai: "Mayiladuthurai",
  mayiladuthurai_: "Mayiladuthurai",
  mayavaram: "Mayiladuthurai",
  krishnagiri: "Krishnagiri",
  dharmapuri: "Dharmapuri",
  namakkal: "Namakkal",
  perambalur: "Perambalur",
  karur: "Karur",
  erode: "Erode",
  salem: "Salem",
  coimbatore: "Coimbatore",
  kovai: "Coimbatore",
  tiruppur: "Tiruppur",
  tirupur: "Tiruppur",
  cuddalore: "Cuddalore",
  chengalpattu: "Chengalpattu",
  chengalpet: "Chengalpattu",
  kallakurichi: "Kallakurichi",
  tenkasi: "Tenkasi",
  chennai: "Chennai",
  madras: "Chennai",
  madurai: "Madurai",
  vellore: "Vellore",
  ranipet: "Ranipet",
  ranipettai: "Ranipet",
  tiruvannamalai: "Tiruvannamalai",
  tiruvannamalai_: "Tiruvannamalai",
  ariyalur: "Ariyalur",
  dindigul: "Dindigul",
  theni: "Theni",
  virudhunagar: "Virudhunagar",
  thanjavur: "Thanjavur",
  tanjore: "Thanjavur",
  thiruvallur: "Thiruvallur",
  tiruvallur: "Thiruvallur",
  tiruvallur_: "Thiruvallur",
};

/**
 * Verified coordinates are not bundled in this repository, so no markers are
 * fabricated. Keys are canonical (normalised) PIN codes; empty by design.
 */
export const PIN_COORDINATES: Record<string, { lat: number; lng: number }> = {};

export const TN_DISTRICT_PINCODES: Record<string, string[]> = {
  Ariyalur: ["621704", "621705", "621707", "621708", "621709"],
  Chengalpattu: ["603001", "603002", "603003", "603004", "603109", "603110"],
  Chennai: [
    "600001", "600002", "600003", "600004", "600005", "600006", "600007", "600008",
    "600009", "600010", "600011", "600012", "600013", "600014", "600015", "600016",
    "600017", "600018", "600019", "600020", "600021", "600022", "600023", "600024",
    "600025", "600026", "600028", "600029", "600030", "600031", "600032", "600033",
    "600034", "600035", "600036", "600037", "600038", "600039", "600040", "600041",
    "600042", "600043", "600044", "600045", "600046", "600047", "600049", "600050",
  ],
  Coimbatore: [
    "641001", "641002", "641003", "641004", "641005", "641006", "641007", "641008",
    "641009", "641010", "641011", "641012", "641013", "641014", "641015", "641016",
    "641017", "641018", "641019", "641020", "641021", "641022", "641023", "641024",
    "641025", "641026", "641027", "641028", "641029", "641030", "641031", "641032",
    "641033", "641034", "641035", "641036", "641037", "641038", "641039", "641041",
    "641042", "641043", "641044", "641045", "641046", "641047", "641048", "641049",
  ],
  Cuddalore: ["607001", "607002", "607003", "607004", "607005", "607006", "607101", "607102", "607103", "607104"],
  Dharmapuri: ["636701", "636702", "636703", "636704", "636705", "636706", "636803", "636804"],
  Dindigul: ["624001", "624002", "624003", "624004", "624005", "624006", "624007", "624008", "624009", "624101"],
  Erode: ["638001", "638002", "638003", "638004", "638005", "638006", "638007", "638008", "638009", "638010", "638011", "638012"],
  Kallakurichi: ["606202", "606203", "606204", "606205", "606206", "606207", "606208"],
  Kancheepuram: ["631501", "631502", "631503", "631504", "631551", "631552", "631553", "631561"],
  Kanyakumari: ["629001", "629002", "629003", "629004", "629101", "629102", "629151", "629152"],
  Karur: ["639001", "639002", "639003", "639004", "639005", "639006", "639007", "639008"],
  Krishnagiri: ["635001", "635002", "635101", "635102", "635103", "635104", "635105", "635106"],
  Madurai: [
    "625001", "625002", "625003", "625004", "625005", "625006", "625007", "625008",
    "625009", "625010", "625011", "625012", "625014", "625015", "625016", "625017",
    "625018", "625019", "625020", "625021", "625022", "625023", "625024",
  ],
  Mayiladuthurai: ["609001", "609002", "609003", "609101", "609102", "609103", "609104", "609105"],
  Nagapattinam: ["611001", "611002", "611003", "611101", "611102", "611103", "611104", "611105"],
  Namakkal: ["637001", "637002", "637003", "637004", "637013", "637014", "637015", "637017"],
  Nilgiris: ["643001", "643002", "643003", "643004", "643005", "643006", "643007", "643101", "643102"],
  Perambalur: ["621212", "621213", "621214", "621215", "621216", "621219"],
  Pudukkottai: ["622001", "622002", "622003", "622004", "622005", "622101", "622102"],
  Ramanathapuram: ["623501", "623502", "623503", "623504", "623520", "623521", "623522"],
  Ranipet: ["632401", "632402", "632403", "632404", "632405", "632406", "632407"],
  Salem: [
    "636001", "636002", "636003", "636004", "636005", "636006", "636007", "636008",
    "636009", "636010", "636011", "636012", "636013", "636014", "636015", "636016",
  ],
  Sivaganga: ["630561", "630562", "630563", "630564", "630565", "630566", "630601", "630602"],
  Tenkasi: ["627811", "627812", "627813", "627814", "627815", "627816", "627817", "627818"],
  Thanjavur: ["613001", "613002", "613003", "613004", "613005", "613006", "613007", "613008", "613009", "613010"],
  Theni: ["625531", "625532", "625533", "625534", "625535", "625536", "625601", "625602"],
  Thoothukkudi: ["628001", "628002", "628003", "628004", "628005", "628006", "628007", "628008", "628101", "628102"],
  Tiruchirappalli: [
    "620001", "620002", "620003", "620004", "620005", "620006", "620007", "620008",
    "620009", "620010", "620011", "620012", "620013", "620014", "620015", "620016",
    "620017", "620018", "620019", "620020", "620021", "620022", "620023", "620024",
  ],
  Tirunelveli: ["627001", "627002", "627003", "627004", "627005", "627006", "627007", "627008", "627009", "627010", "627011", "627012"],
  Tirupathur: ["635601", "635602", "635653", "635654", "635655", "635701", "635702", "635703"],
  Tiruppur: ["641601", "641602", "641603", "641604", "641605", "641606", "641607", "641608", "641652", "641653"],
  Thiruvallur: ["602001", "602002", "602003", "602021", "602023", "602024", "602025", "602026"],
  Tiruvannamalai: ["606601", "606602", "606603", "606604", "606611", "606612", "606613", "606614"],
  Thiruvarur: ["610001", "610002", "610003", "610004", "610101", "610102", "610103", "610104"],
  Vellore: ["632001", "632002", "632003", "632004", "632005", "632006", "632007", "632008", "632009", "632010"],
  Viluppuram: ["605602", "605603", "605604", "605605", "605651", "605652", "605701", "605702"],
  Virudhunagar: ["626001", "626002", "626003", "626004", "626005", "626101", "626102", "626103"],
};

export const pincodesForDistrict = (name: string): string[] => TN_DISTRICT_PINCODES[name] ?? [];
