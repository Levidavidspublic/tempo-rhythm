import assert from 'node:assert/strict';
import test from 'node:test';
import {judge} from '../factory/scope-guard.mjs';

const aggregate = {
  pr: {
    base: {ref: 'integration', repo: {full_name: 'owner/repo'}},
    head: {ref: 'loop/codex-2026-11-17', repo: {full_name: 'owner/repo'}},
  },
  labels: [],
  ticket: 101,
  fm: {type: 'data', scope: ['apps/web/a.ts', 'apps/mobile/b.ts']},
  files: [{filename: 'apps/web/a.ts'}, {filename: 'apps/mobile/b.ts'}],
  commitFiles: [],
  config: {dataFolders: ['packages/backend']},
};

test('a loop aggregate has a strict ticketed path without the config label', () => {
  assert.deepEqual(judge(aggregate).problems, []);
});

test('an unrelated file fails the unchanged scope guard', () => {
  const input = {
    ...aggregate,
    files: [...aggregate.files, {filename: 'apps/rogue.ts'}],
  };
  assert.ok(
    judge(input).problems.some(message =>
      message.includes('outside the ticket scope'),
    ),
  );
});

test('a loop without an aggregate ticket is rejected', () => {
  assert.ok(
    judge({...aggregate, ticket: null}).problems.some(message =>
      message.includes('No ticket found'),
    ),
  );
});

test('a component aggregate cannot claim data-folder permissions', () => {
  const input = {
    ...aggregate,
    fm: {type: 'component', scope: ['packages/backend/item.ts']},
    files: [{filename: 'packages/backend/item.ts'}],
  };
  assert.ok(
    judge(input).problems.some(message =>
      message.includes('component tickets may not change'),
    ),
  );
});

test('legacy batch lanes use the same strict ticket contract', () => {
  const input = {
    ...aggregate,
    pr: {
      ...aggregate.pr,
      head: {...aggregate.pr.head, ref: 'batch/example/codex'},
    },
  };
  assert.deepEqual(judge(input).problems, []);
});
