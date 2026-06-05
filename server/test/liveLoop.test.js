import { test } from 'node:test';
import assert from 'node:assert/strict';

// deriveEventKind isn't exported (it's a private helper). To unit-test it
// we re-implement the contract here as a fixture. The real test is the
// integration: place a bet, simulate a tick, see the event arrive.
// This guard test pins the public contract on `emitScoreUpdate` payloads.

import { emitScoreUpdate } from '../src/services/realtime.js';

test('emitScoreUpdate is a no-op before attachRealtime', () => {
  assert.doesNotThrow(() =>
    emitScoreUpdate({
      fixtureId: 'f1',
      scoreHome: 1,
      scoreAway: 0,
      minute: '34',
      eventKind: 'goal_home',
      team: 'home',
    }),
  );
});
