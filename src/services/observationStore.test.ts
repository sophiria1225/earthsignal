import assert from 'node:assert/strict';
import test from 'node:test';
import { parseObservations } from './observationStore';

const validReport = {
  id: 'obs_rep_test',
  type: 'citizen_report',
  observedAt: '2026-08-28T00:00:00.000Z',
  createdAt: '2026-08-28T00:00:00.000Z',
  cellId: 'cell_tokyo_01',
  cellName: '東京',
  locationApprox: { latitude: 35.68, longitude: 139.76 },
  visibility: 'private',
  status: 'finalized',
  citizenReport: { category: 'other', intensity: 2, differenceFromNormal: 2 },
};

test('ローカル観測の壊れた要素を読み飛ばす', () => {
  assert.deepEqual(parseObservations('not-json'), []);
  const parsed = parseObservations(JSON.stringify([null, { id: 'bad' }, validReport]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'obs_rep_test');
  assert.deepEqual(parseObservations(JSON.stringify([{
    ...validReport,
    citizenReport: { ...validReport.citizenReport, description: 'x'.repeat(501) },
  }])), []);
});
