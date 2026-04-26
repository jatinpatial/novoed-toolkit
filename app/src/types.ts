import type { BrandKey } from "./brand/tokens";

export interface ComponentItem {
  title: string;
  desc?: string;
  desc2?: string;
  icon?: string;
  img?: string;
  color?: string;
}

export interface ComponentData {
  title?: string;
  body?: string;
  author?: string;
  type?: string;
  col1?: string;
  col2?: string;
  stat?: string;
  label?: string;
  active?: number;
  bg?: string;
  items?: ComponentItem[];
}

export interface ComponentRegistryEntry {
  id: string;
  n: string;
  d: string;
  ic: string;
  cat: string;
}

export type { BrandKey };
