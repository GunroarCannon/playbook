/**
 * postMessage contract between the host app and a sandboxed simulation iframe.
 * Hand-built sims (public/sims/*.html) and AI-generated sims both implement it.
 */
import type { ParamValue } from "./sims";

export type HostToSim =
  | { type: "UPDATE_PARAMS"; params: Record<string, ParamValue> }
  | { type: "RUN_TEST" }
  | { type: "RESET" }
  | { type: "SET_THEME"; theme: "light" | "dark" };

export type SimMetrics = {
  /** 0..1 healthy, >1 over limit */
  stressRatio: number;
  /** Short live readout, e.g. "max member force 14.2 kgf" */
  label?: string;
  values?: Record<string, number | string>;
};

export type SimResult = {
  passed: boolean;
  /** One plain sentence, e.g. "Pratt truss, 40cm span, held 6.2kg using 44 sticks." */
  summary: string;
  failureReason?: string;
  /** Headline number for "best" comparisons, e.g. kg held, profit, hours of autonomy. */
  score?: number;
  scoreLabel?: string;
  metrics?: Record<string, number | string>;
};

export type SimToHost =
  | { type: "SIM_READY" }
  | { type: "SIM_METRICS"; payload: SimMetrics }
  | { type: "SIM_RESULT"; payload: SimResult }
  | { type: "SIM_ERROR"; message: string };
