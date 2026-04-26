import type { BrandKey } from "../brand/tokens";

export interface BlockItem {
  title: string;
  desc?: string;
  img?: string;
  alt?: string;
}

export interface BlockData {
  content?: string;
  url?: string;
  caption?: string;
  alt?: string;
  title?: string;
  body?: string;
  type?: string;
  items?: BlockItem[];
}

export interface Block {
  id: string;
  type: string;
  data: BlockData;
  source?: "writer";
}

export interface Lesson {
  id: string;
  title: string;
  duration: number;
  blocks: Block[];
  objectives?: string[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
  weekNumber?: number;
  summary?: string;
  objectives?: string[];
}

export interface Material {
  id: string;
  filename: string;
  text: string;
  charCount: number;
  addedAt: number;
}

export interface Course {
  id: string;
  title: string;
  client: string;
  brand: BrandKey;
  modules: Module[];
  materials?: Material[];
}

export interface BlockType {
  id: string;
  label: string;
  icon: string;
  col: string;
}
