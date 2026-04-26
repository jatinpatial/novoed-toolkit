import type { BrandKey } from "../brand/tokens";
import type { ComponentData } from "../types";
import type { Course } from "../course/types";

export type ProjectKind = "component" | "scorm" | "course";

interface ComponentProjectData {
  kind: "component";
  compId: string;
  data: ComponentData;
}

interface ScormProjectData {
  kind: "scorm";
  compId: string;
  data: ComponentData;
}

interface CourseProjectData {
  kind: "course";
  course: Course;
}

export type ProjectData = ComponentProjectData | ScormProjectData | CourseProjectData;

export interface Project {
  id: string;
  name: string;
  kind: ProjectKind;
  brand: BrandKey;
  createdAt: number;
  updatedAt: number;
  data: ProjectData;
}

const KEY = "bcgu_studio_projects_v1";

function read(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function write(projects: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(projects));
  window.dispatchEvent(new CustomEvent("projects-changed"));
}

export function listProjects(): Project[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Project | null {
  return read().find((p) => p.id === id) || null;
}

export function saveProject(p: Omit<Project, "createdAt" | "updatedAt"> & { createdAt?: number }): Project {
  const now = Date.now();
  const all = read();
  const idx = all.findIndex((x) => x.id === p.id);
  const next: Project = {
    ...p,
    createdAt: idx >= 0 ? all[idx].createdAt : p.createdAt ?? now,
    updatedAt: now,
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  write(all);
  return next;
}

export function deleteProject(id: string) {
  write(read().filter((p) => p.id !== id));
}

export function duplicateProject(id: string): Project | null {
  const src = getProject(id);
  if (!src) return null;
  const copy: Project = {
    ...src,
    id: uid(),
    name: src.name + " (copy)",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    data: JSON.parse(JSON.stringify(src.data)),
  };
  const all = read();
  all.push(copy);
  write(all);
  return copy;
}

export function uid(): string {
  return "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function subscribeProjects(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("projects-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("projects-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
