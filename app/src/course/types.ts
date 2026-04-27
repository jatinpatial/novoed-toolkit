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
  // Synthesia script for video blocks. Authored by the Scriptwriter agent
  // and edited by the LD in the block drawer; never rendered in the
  // published lesson.
  //
  // Format: a sequence of scene blocks. Each scene has SPOKEN: (the
  // narration with <break time="X.Xs"/> tags) and VISUAL: (what's on
  // screen). Example:
  //   SCENE 1
  //   SPOKEN: Hello there. <break time="0.5s"/> Today we'll cover…
  //   VISUAL: Lower-third with speaker name and title.
  script?: string;
  // How the avatar speaks the script: "speaker" = on-camera presenter
  // talking head with sparse visuals; "narration" = voice-over driving
  // rich full-screen visuals. Defaults to "speaker" when absent.
  videoType?: "speaker" | "narration";
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
