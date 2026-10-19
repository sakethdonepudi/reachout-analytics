import manifest from './brand-map.json';

export type DeviceBrandAsset = (typeof manifest.brands)[keyof typeof manifest.brands];
const normalise = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const byLabel = new Map<string, DeviceBrandAsset>(Object.entries(manifest.brands).map(([key,value]) => [normalise(key),value]));
for (const [alias,key] of Object.entries({'tecno':'Tecno Mobile','itel mobile':'iTel','cmf by nothing':'CMF','ai plus':'AI+','ai +':'AI+'})) {
 const found=byLabel.get(normalise(key));if(found)byLabel.set(normalise(alias),found);
}
export function mobileBrandAsset(raw: unknown): DeviceBrandAsset {
 return byLabel.get(normalise(typeof raw==='string'?raw:'')) ?? manifest.brands.Unknown;
}
export function mobileBrandMarker(raw: unknown, basePath='/brand-logos', format:'svg'|'png'='svg') {
 const brand=mobileBrandAsset(raw);
 return {brand:brand.brand,src:`${basePath}/${format==='svg'?brand.markerSvg:brand.markerPng}`,alt:`${brand.brand} — aggregate device metadata`,width:56,height:36,kind:brand.kind};
}
// Render inside a keyboard-operable map button. Selection halo belongs to the
// button/CSS; do not recolour the source logo. Never use this mark as evidence
// that a coordinate is an independently verified phone/voter location.
