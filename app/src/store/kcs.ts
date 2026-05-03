/**
 * Knowledge-check store (Track-B-Quiz, KC Studio).
 *
 * Standalone knowledge checks live in their own localStorage
 * namespace, separate from courses (Project store) and scripts
 * (Script store). KC Studio is the third surface in the Studio
 * suite — same architectural pattern as ScriptStudio: a focused
 * brief form (CreateKcPage) submits into a dedicated builder, the
 * result page renders the agent-generated questions.
 *
 * The Kc record carries the form-collected metadata (topic +
 * question_count + difficulty_mix + question_types + notes) so
 * the KC list view can show "Topic: …, 5 Q · MCQ + Apply" without
 * re-parsing the questions.
 */

import type { QuizQuestion } from "../course/types";

export interface Kc {
  id: string;
  /** Editable display title — defaults to the topic but the LD can
   *  rename it on the KC Studio result page. */
  title: string;
  /** The form's "topic" field — the subject the questions probe.
   *  Preserved separately from title so renames don't drift the
   *  prompt context (used by Refine in chat, sprint-2-10b). */
  topic: string;
  /** Number of questions requested at build time. */
  questionCount: number;
  /** Bloom's-mix selected at build time: any of "recall" / "apply"
   *  / "analyze". Empty array means agent picks (rare). */
  difficultyMix: ("recall" | "apply" | "analyze")[];
  /** Question types selected: any of "mcq" / "short" / "scenario".
   *  Maps onto Quiz Builder's existing type vocabulary. */
  questionTypes: ("mcq" | "short" | "scenario")[];
  /** Free-form notes appended to the prompt. */
  notes: string;
  /** Agent-generated questions. Empty when the Kc is freshly
   *  created and the build_kc round-trip hasn't completed. */
  questions: QuizQuestion[];
  /** SDK-reported cost for the build. Surfaced on the result page
   *  for cost-economics transparency. */
  costUsd: number | null;
  createdAt: number;
  updatedAt: number;
}

const KEY = "bcgu_studio_kcs_v1";

function read(): Kc[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Kc[];
  } catch {
    return [];
  }
}

function write(kcs: Kc[]) {
  localStorage.setItem(KEY, JSON.stringify(kcs));
  window.dispatchEvent(new CustomEvent("kcs-changed"));
}

export function listKcs(): Kc[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getKc(id: string): Kc | null {
  return read().find((k) => k.id === id) || null;
}

export function saveKc(kc: Kc): void {
  const kcs = read();
  const i = kcs.findIndex((k) => k.id === kc.id);
  const updated: Kc = { ...kc, updatedAt: Date.now() };
  if (i >= 0) kcs[i] = updated;
  else kcs.push(updated);
  write(kcs);
}

export function deleteKc(id: string): void {
  write(read().filter((k) => k.id !== id));
}

export function subscribeKcs(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener("kcs-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("kcs-changed", handler);
    window.removeEventListener("storage", handler);
  };
}
