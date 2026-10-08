/* =====================================================================
   Tamil Nadu districts — id, display name, geographic centroid and a
   demo-only "spread radius" (degrees) used to lay out representative
   survey points across each district.

   Boundary source: india-maps-data (github.com/udit-001/india-maps-data),
   curated from publicly available boundary data. This is the 37-district
   boundary set (includes Chengalpattu, Ranipet, Tirupathur, Tenkasi,
   Kallakurichi). Mayiladuthurai is included so the district list and PIN
   data are complete, but the boundary set merges its area into
   Nagapattinam, so it has no separate 3D polygon yet.
   ===================================================================== */

export type TnDistrict = {
  /** stable slug, also the React key + geojson join key */
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** demo-only spread radius in degrees for placing representative PINs */
  r: number;
};

export const TN_DISTRICTS: TnDistrict[] = [
  { id: "ariyalur", name: "Ariyalur", lng: 79.2426, lat: 11.1648, r: 0.187 },
  { id: "chengalpattu", name: "Chengalpattu", lng: 79.9975, lat: 12.567, r: 0.252 },
  { id: "chennai", name: "Chennai", lng: 80.2238, lat: 13.0047, r: 0.083 },
  { id: "coimbatore", name: "Coimbatore", lng: 76.975, lat: 10.8844, r: 0.335 },
  { id: "cuddalore", name: "Cuddalore", lng: 79.4473, lat: 11.5362, r: 0.297 },
  { id: "dharmapuri", name: "Dharmapuri", lng: 78.1956, lat: 12.1028, r: 0.316 },
  { id: "dindigul", name: "Dindigul", lng: 77.8193, lat: 10.3912, r: 0.331 },
  { id: "erode", name: "Erode", lng: 77.4158, lat: 11.5199, r: 0.359 },
  { id: "kallakurichi", name: "Kallakurichi", lng: 79.0112, lat: 11.7973, r: 0.248 },
  { id: "kancheepuram", name: "Kancheepuram", lng: 79.8303, lat: 12.8259, r: 0.188 },
  { id: "kanyakumari", name: "Kanyakumari", lng: 77.3599, lat: 8.3066, r: 0.176 },
  { id: "karur", name: "Karur", lng: 78.1387, lat: 10.8429, r: 0.246 },
  { id: "krishnagiri", name: "Krishnagiri", lng: 78.0289, lat: 12.4895, r: 0.35 },
  { id: "madurai", name: "Madurai", lng: 78.0089, lat: 9.9253, r: 0.309 },
  { id: "mayiladuthurai", name: "Mayiladuthurai", lng: 79.65, lat: 11.1, r: 0.1 },
  { id: "nagapattinam", name: "Nagapattinam", lng: 79.7447, lat: 10.5561, r: 0.305 },
  { id: "namakkal", name: "Namakkal", lng: 78.1389, lat: 11.3216, r: 0.248 },
  { id: "nilgiris", name: "Nilgiris", lng: 76.6422, lat: 11.4568, r: 0.234 },
  { id: "perambalur", name: "Perambalur", lng: 78.8901, lat: 11.2719, r: 0.174 },
  { id: "pudukkottai", name: "Pudukkottai", lng: 78.8795, lat: 10.3614, r: 0.29 },
  { id: "ramanathapuram", name: "Ramanathapuram", lng: 78.6852, lat: 9.4547, r: 0.351 },
  { id: "ranipet", name: "Ranipet", lng: 79.4589, lat: 12.9504, r: 0.209 },
  { id: "salem", name: "Salem", lng: 78.2258, lat: 11.6776, r: 0.338 },
  { id: "sivaganga", name: "Sivaganga", lng: 78.5845, lat: 9.9321, r: 0.312 },
  { id: "tenkasi", name: "Tenkasi", lng: 77.4614, lat: 9.087, r: 0.241 },
  { id: "thanjavur", name: "Thanjavur", lng: 79.2401, lat: 10.6661, r: 0.313 },
  { id: "theni", name: "Theni", lng: 77.4426, lat: 9.892, r: 0.219 },
  { id: "thiruvallur", name: "Thiruvallur", lng: 79.9383, lat: 13.2351, r: 0.307 },
  { id: "thiruvarur", name: "Thiruvarur", lng: 79.528, lat: 10.7049, r: 0.2 },
  { id: "thoothukkudi", name: "Thoothukkudi", lng: 78.0071, lat: 8.8954, r: 0.314 },
  { id: "tiruchirappalli", name: "Tiruchirappalli", lng: 78.5715, lat: 10.8991, r: 0.348 },
  { id: "tirunelveli", name: "Tirunelveli", lng: 77.6056, lat: 8.5759, r: 0.304 },
  { id: "tirupathur", name: "Tirupathur", lng: 78.6387, lat: 12.5802, r: 0.2 },
  { id: "tiruppur", name: "Tiruppur", lng: 77.4092, lat: 10.8409, r: 0.348 },
  { id: "tiruvannamalai", name: "Tiruvannamalai", lng: 79.1693, lat: 12.4332, r: 0.357 },
  { id: "vellore", name: "Vellore", lng: 78.9515, lat: 12.9026, r: 0.217 },
  { id: "viluppuram", name: "Viluppuram", lng: 79.5297, lat: 12.1195, r: 0.267 },
  { id: "virudhunagar", name: "Virudhunagar", lng: 77.9058, lat: 9.4962, r: 0.309 },
];

export const tnDistrictById = (id: string) => TN_DISTRICTS.find((d) => d.id === id);
export const tnDistrictByName = (name: string) => TN_DISTRICTS.find((d) => d.name === name);
