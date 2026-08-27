import { Observation } from '../types';

export const OBSERVATION_STORAGE_KEY = 'earthsignal_observations_v1';
const MAX_OBSERVATIONS = 200;
const OBSERVATION_TYPES = new Set(['audio', 'cloud_photo', 'citizen_report']);
const VISIBILITIES = new Set(['private', 'aggregate_only', 'anonymous_public']);
const STATUSES = new Set(['processing', 'ready', 'finalized', 'deleted']);
const CITIZEN_CATEGORIES = new Set([
  'animal_active', 'animal_quiet', 'bird_flock', 'cloud_shape',
  'low_rumble_sound', 'micro_tremor', 'electronic_anomaly', 'other',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidObservation(value: unknown): value is Observation {
  if (!isRecord(value) || !isRecord(value.locationApprox)) return false;
  if (typeof value.id !== 'string' || value.id.length < 3 || value.id.length > 200) return false;
  if (typeof value.type !== 'string' || !OBSERVATION_TYPES.has(value.type)) return false;
  if (typeof value.cellId !== 'string' || value.cellId.length > 100) return false;
  if (typeof value.cellName !== 'string' || value.cellName.length > 150) return false;
  if (typeof value.visibility !== 'string' || !VISIBILITIES.has(value.visibility)) return false;
  if (typeof value.status !== 'string' || !STATUSES.has(value.status)) return false;
  if (typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt))) return false;
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return false;
  if (!Number.isFinite(value.locationApprox.latitude) || !Number.isFinite(value.locationApprox.longitude)) return false;
  if (value.userConfirmation !== undefined) {
    if (!isRecord(value.userConfirmation)) return false;
    if (typeof value.userConfirmation.userNotes === 'string' && value.userConfirmation.userNotes.length > 500) return false;
    if (value.userConfirmation.differenceFromNormal !== undefined
      && (typeof value.userConfirmation.differenceFromNormal !== 'number'
        || value.userConfirmation.differenceFromNormal < 1
        || value.userConfirmation.differenceFromNormal > 5)) return false;
    if (!Array.isArray(value.userConfirmation.confirmedLabels)
      || value.userConfirmation.confirmedLabels.length > 20
      || value.userConfirmation.confirmedLabels.some(label => typeof label !== 'string' || label.length > 100)) return false;
  }
  if (value.type === 'citizen_report') {
    if (!isRecord(value.citizenReport)) return false;
    if (typeof value.citizenReport.category !== 'string' || !CITIZEN_CATEGORIES.has(value.citizenReport.category)) return false;
    if (typeof value.citizenReport.intensity !== 'number' || value.citizenReport.intensity < 1 || value.citizenReport.intensity > 5) return false;
    if (typeof value.citizenReport.differenceFromNormal !== 'number'
      || value.citizenReport.differenceFromNormal < 1
      || value.citizenReport.differenceFromNormal > 5) return false;
    if (typeof value.citizenReport.description === 'string' && value.citizenReport.description.length > 500) return false;
  }
  if (value.type === 'audio') {
    if (!isRecord(value.audioAnalysis) || !Array.isArray(value.audioAnalysis.topLabels) || value.audioAnalysis.topLabels.length > 20) return false;
  }
  if (value.type === 'cloud_photo') {
    if (!isRecord(value.cloudAnalysis)
      || !Array.isArray(value.cloudAnalysis.detectedCloudTypes)
      || value.cloudAnalysis.detectedCloudTypes.length > 10) return false;
  }
  return true;
}

export function parseObservations(raw: string | null): Observation[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidObservation).slice(0, MAX_OBSERVATIONS);
  } catch {
    return [];
  }
}

export function loadObservations(): Observation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return parseObservations(localStorage.getItem(OBSERVATION_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveObservations(observations: Observation[]): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(observations.slice(0, MAX_OBSERVATIONS)));
    return true;
  } catch {
    return false;
  }
}
