import type { UnitPref } from "./types";

// Mirrors the backend's conversion constants exactly (calc.service.ts) so
// display-side rounding matches what the server would compute. The API
// always stores and returns canonical metric (kg, cm) — these are purely
// for presenting/collecting values in the unit the user's profile prefers.
const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToDisplay(kg: number, unitPref: UnitPref): number {
  return unitPref === "IMPERIAL" ? round1(kg / KG_PER_LB) : round1(kg);
}

export function displayToKg(value: number, unitPref: UnitPref): number {
  return unitPref === "IMPERIAL" ? value * KG_PER_LB : value;
}

export function cmToDisplay(cm: number, unitPref: UnitPref): number {
  return unitPref === "IMPERIAL" ? round1(cm / CM_PER_IN) : round1(cm);
}

export function displayToCm(value: number, unitPref: UnitPref): number {
  return unitPref === "IMPERIAL" ? value * CM_PER_IN : value;
}

export function weightUnitLabel(unitPref: UnitPref): string {
  return unitPref === "IMPERIAL" ? "lb" : "kg";
}

export function heightUnitLabel(unitPref: UnitPref): string {
  return unitPref === "IMPERIAL" ? "in" : "cm";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
