# Andhra Pradesh map sources

## Assembly constituencies

- File: `ap-acs.json`
- Source: DataMeet Community Maps Project, India Assembly Constituencies (2008 delimitation).
- Repository: https://github.com/datameet/maps/tree/master/assembly-constituencies
- Licence: Creative Commons Attribution 2.5 India.
- Attribution: Assembly Constituencies Maps are provided by Data{Meet} Community Maps Project under CC BY 2.5 India.
- Processing: selected the 175 Andhra Pradesh records numbered 120 to 294 in the combined Andhra Pradesh series and renumbered them 1 to 175. Coordinates are rounded to five decimals. No boundaries were drawn or inferred.

## Districts

- File: `ap-districts.json`
- Built by dissolving the 175 constituency polygons using the district lists in the owner's AP survey dashboard.
- 28 districts match the survey's `geo.dist` mapping, including Polavaram and Markapuram.
- The HTML lists 175 constituency names across 28 districts. Every name resolved to exactly one data polygon. The matches use these spelling aliases: Cheepurupalli / Cheepurupalle, Elamanchili / Yelamanchili, Palakollu / Palacole, Unguturu / Ungutur, Ponnuru / Ponnur, Sathyavedu / Satyavedu, Tadipatri / Tadpatri.
- Two repeated names are resolved by the source district: Gannavaram in Konaseema and Krishna, Prathipadu in Kakinada and Guntur.

## Use

- The files are bundled locally. Nothing is fetched at runtime.
- The boundary polygons are community maps, not certified legal boundaries.
