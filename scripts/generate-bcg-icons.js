#!/usr/bin/env node
/**
 * BCG icons generator (Phase 2 #2 B0).
 *
 * Reads ../bcg-icons.js (the 5MB bundle of 1069 SVGs) and writes a
 * subset to app/src/icons/bcg/icons.tsx as named React exports.
 * Tree-shaking via Vite/rollup means only icons actually imported by
 * surface code ship in the production bundle.
 *
 * To add an icon: append a {source, output} pair to ICON_SUBSET below
 * (using the source name from bcg-icons.js) and re-run:
 *
 *   node scripts/generate-bcg-icons.js
 *
 * Then update the BcgIcon component's BcgIconName union if needed
 * (it auto-derives from index.ts re-exports, so no code change there).
 */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const BCG_ICONS_PATH = path.join(REPO_ROOT, "bcg-icons.js");
const OUTPUT_PATH = path.join(REPO_ROOT, "app/src/icons/bcg/icons.tsx");

// Curated subset for Phase 2 #2 surfaces + components catalog.
// source = name in bcg-icons.js (window.BCG_ICONS[source])
// output = PascalCase name in the generated React module
const ICON_SUBSET = [
  // Content & generic
  { source: "svg_Light_Bulb",                                        output: "LightBulb" },
  { source: "svg_Document",                                          output: "Document" },
  { source: "Brochure",                                              output: "Brochure" },
  { source: "svg_Closed_Book",                                       output: "ClosedBook" },
  { source: "svg_High_Education_Neutral",                            output: "HigherEducation" },
  { source: "svg_Library_regulatory_filings",                        output: "Library" },
  { source: "FileCabinet",                                           output: "FileCabinet" },
  { source: "svg_Cards",                                             output: "Cards" },
  { source: "Inventory",                                             output: "Inventory" },
  { source: "svg_Data_Catalogue",                                    output: "DataCatalogue" },
  { source: "svg_Innovation",                                        output: "Innovation" },
  { source: "svg_Center_for_Customer_Insight",                       output: "CustomerInsight" },

  // Course / lesson / module / process
  { source: "BusinessUnitStrategy",                                  output: "BusinessUnitStrategy" },
  { source: "Strategy",                                              output: "Strategy" },
  { source: "svg_Hierarchy",                                         output: "Hierarchy" },
  { source: "svg_Business_process",                                  output: "BusinessProcess" },
  { source: "svg_Five_Steps_fingers_1",                              output: "FiveSteps" },

  // People / discussion / collaboration
  { source: "People",                                                output: "People" },
  { source: "GroupCollaboration",                                    output: "GroupCollaboration" },
  { source: "GroupMeetingPartnership",                               output: "GroupMeeting" },
  { source: "Coach",                                                 output: "Coach" },
  { source: "Speaking",                                              output: "Speaking" },
  { source: "Handshake",                                             output: "Handshake" },

  // Decision / choice
  { source: "svg_Crossroads_A",                                      output: "Crossroads" },
  { source: "CrossroadsB",                                           output: "CrossroadsAlt" },

  // Quiz / test / assessment
  { source: "svg_Beta_test",                                         output: "BetaTest" },
  { source: "svg_Continuous_testing",                                output: "ContinuousTesting" },

  // Data / charts / dashboards
  { source: "DataAnalysis",                                          output: "DataAnalysis" },
  { source: "svg_Bar_Chart_Analysis",                                output: "BarChart" },
  { source: "svg_Dashboard_1",                                       output: "Dashboard" },

  // Media
  { source: "PlayVideoOrMusic",                                      output: "PlayVideo" },
  { source: "svg_Picture_frame",                                     output: "PictureFrame" },

  // AI / Studio Copilot
  { source: "HumanIntelligence",                                     output: "HumanIntelligence" },
  { source: "svg_Artificial_Intelligence_5_Brain_Network_Technology_Intelligence_Learning_Computing",
    output: "BrainNetwork" },

  // Achievement / objectives
  { source: "Target",                                                output: "Target" },
  { source: "Trophy",                                                output: "Trophy" },

  // Misc
  { source: "Alert",                                                 output: "Alert" },
  { source: "Clock",                                                 output: "Clock" },
  { source: "MagnifyingGlassSearch",                                 output: "MagnifyingGlass" },
  { source: "Funnel",                                                output: "Funnel" },
  { source: "Network",                                               output: "Network" },
  { source: "Survey",                                                output: "Survey" },
];

// ─── Load bcg-icons.js ────────────────────────────────────────────────────────
global.window = {};
require(BCG_ICONS_PATH);
const ALL_ICONS = global.window.BCG_ICONS;
console.log(`Loaded ${Object.keys(ALL_ICONS).length} icons from bcg-icons.js`);

// ─── Extract inner content from each SVG string ───────────────────────────────
// Source format:
//   <svg xmlns="..." viewBox="X Y W H" fill="currentColor"><path .../><path .../></svg>
// We strip the outer <svg ...> open tag and the </svg> close, capture the
// viewBox, and emit the inner content via dangerouslySetInnerHTML.
function extractInner(svg) {
  const openMatch = svg.match(/^<svg\s[^>]*viewBox="([^"]+)"[^>]*>/);
  if (!openMatch) throw new Error("could not match opening <svg>");
  const viewBox = openMatch[1];
  const closeMatch = svg.match(/<\/svg>\s*$/);
  if (!closeMatch) throw new Error("could not match closing </svg>");
  const inner = svg.slice(openMatch[0].length, svg.length - closeMatch[0].length);
  return { viewBox, inner };
}

// ─── Generate icons.tsx ───────────────────────────────────────────────────────
const lines = [];
lines.push("/**");
lines.push(" * BCG icons — auto-generated by scripts/generate-bcg-icons.js.");
lines.push(" * DO NOT EDIT BY HAND. Re-run the generator to add or update icons.");
lines.push(" *");
lines.push(" * Each export is a tree-shakeable React component. Import by name:");
lines.push(' *   import { LightBulb } from "@app/icons/bcg";');
lines.push(' *   <LightBulb width={20} height={20} className="text-brand-700" />');
lines.push(" *");
lines.push(" * The <BcgIcon name=\"…\" /> wrapper in ../BcgIcon.tsx provides a");
lines.push(" * uniform sizing + className API for code that picks icons by name.");
lines.push(" */");
lines.push('import type { SVGProps } from "react";');
lines.push("");

const namesPresent = [];
for (const { source, output } of ICON_SUBSET) {
  const svg = ALL_ICONS[source];
  if (!svg) {
    console.error(`  MISSING: ${source}`);
    continue;
  }
  const { viewBox, inner } = extractInner(svg);
  const escapedInner = inner.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  lines.push(`export function ${output}(props: SVGProps<SVGSVGElement>) {`);
  lines.push(`  return (`);
  lines.push(`    <svg`);
  lines.push(`      xmlns="http://www.w3.org/2000/svg"`);
  lines.push(`      viewBox="${viewBox}"`);
  lines.push(`      fill="currentColor"`);
  lines.push(`      {...props}`);
  lines.push("      // eslint-disable-next-line react/no-danger");
  lines.push(`      dangerouslySetInnerHTML={{ __html: \`${escapedInner}\` }}`);
  lines.push(`    />`);
  lines.push(`  );`);
  lines.push(`}`);
  lines.push("");
  namesPresent.push(output);
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
console.log(`Wrote ${namesPresent.length} icons to ${OUTPUT_PATH}`);
console.log(`Names: ${namesPresent.join(", ")}`);
