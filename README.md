# ReachOut Analytics: website

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui project structure · three.js · motion · d3-geo

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

Node 18.18+ (Node 20 recommended).

## Page flow

1. **Home** (`components/site/hero.tsx`). The Parliament photo is split into depth layers (a blurred ambient layer, the sharp photo, and a blurred top and bottom), and each layer moves with the pointer and the scroll. Authentic party symbols turn in a circular party/state ring (`party-orbit.tsx`). No politician portraits are used.
2. **3D map tour** (`components/site/india-map.tsx`). The camera zooms to North East, then Tamil Nadu, then Andhra Pradesh 2024, then Gujarat. Each stop shows a small glass card that links to its case-study page.
3. **All-India view.** You can drag to rotate it, hover over any state, and click a campaign.
4. **Contact** (`components/site/contact-section.tsx`). The map pulls away and a globe with India facing you shrinks into place and turns **clockwise**. That means clockwise seen from above the North Pole, so the surface moves right to left. To reverse it, pass `direction="counterclockwise"` to `<Globe>`.
5. **Case-study pages** at `/case-studies/[slug]` (`app/case-studies/[slug]/page.tsx`).

## Edit the content

Everything lives in **`lib/cases.ts`**: party/state associations, case studies (text, tags, map position, camera stops), upcoming elections and contact details. Party symbols and source notes live in **`lib/parties.ts`** and `public/parties/`.

- Company experience uses the reusable `components/site/company-marquee.tsx` with the local marks in `public/logos/experience/`.
- `CONTACT.email` and `CONTACT.phone` are placeholders. Replace them.
- The **Results** box on each case-study page is a placeholder. Add verified outcomes there.
- The contact form only shows a thank-you message. Connect it to your email service or an API route (see the `TODO` in `contact-section.tsx`).

## ShimmerButton (shadcn component)

- Component: `components/ui/shimmer-button.tsx` (copied unchanged)
- Demo: `components/shimmer-button-demo.tsx`, shown at `/shimmer-demo`
- Dependency: `motion`
- Used for **Book a Consultation** (nav and map panel), **Request Strategy Demo** (home), **Send message** (contact form) and **Plan your campaign with us** (case pages). The site runs in dark mode (`<html class="dark">`), so the button uses its dark style. Each use passes `className` to tint it navy.

### Why `components/ui`?

shadcn's CLI and every component copied from shadcn/21st.dev assume that UI primitives live at `@/components/ui/*` and that helpers live at `@/lib/utils` (`cn`). `components.json` holds those aliases. Keeping the folder means `npx shadcn@latest add <component>` drops new components in the right place and their imports resolve without edits. Site-specific sections are kept separate in `components/site/`.

### Setting up the same stack from scratch

```bash
npx create-next-app@latest my-app --typescript --tailwind --app --import-alias "@/*"
cd my-app
npx shadcn@latest init            # creates components.json, lib/utils.ts, theme CSS
npm i motion                      # ShimmerButton dependency
# then copy shimmer-button.tsx into components/ui/
```

To add Tailwind to an existing Next.js app: `npm i -D tailwindcss @tailwindcss/postcss`, add `@tailwindcss/postcss` to `postcss.config.mjs`, and put `@import "tailwindcss";` at the top of `app/globals.css`.
To add TypeScript: rename a file to `.tsx` and run `npm run dev`. Next.js creates `tsconfig.json` for you.

## Credits

- India state outlines: "India" by svg-maps (github.com/VictorCazanave/svg-maps), **CC BY 4.0**. Keep this credit.
- World outlines on the globe: world-atlas / Natural Earth (public domain). India itself is drawn from the state outlines above.
