declare module "*.svg?raw" {
  const content: string;
  export default content;
}

declare module "*.geojson?raw" {
  const content: string;
  export default content;
}

// Vite `?url` import. Resolves to the asset's URL string at build time.
declare module "*?url" {
  const url: string;
  export default url;
}

// maplibre-gl's CSP build doesn't ship its own types; re-use the main typings.
declare module "maplibre-gl/dist/maplibre-gl-csp" {
  export * from "maplibre-gl";
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const maplibregl: typeof import("maplibre-gl");
  export default maplibregl;
}
