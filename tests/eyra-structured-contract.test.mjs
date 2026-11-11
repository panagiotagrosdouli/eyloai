import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesEyraResponseSchema } from '../src/lib/eyra-structured-contract.mjs';

const schema = {
  type: 'object', additionalProperties: false, required: ['findings', 'uncertainty'],
  properties: {
    findings: {
      type: 'array', minItems: 1, items: {
        type: 'object', additionalProperties: false, required: ['claim', 'source_id', 'confidence'],
        properties: {
          claim: { type: 'string', minLength: 5 },
          source_id: { type: 'string', enum: ['P1', 'P2'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    uncertainty: { type: 'string' },
  },
};

const valid = {
  findings: [{ claim: 'The record documents the result', source_id: 'P1', confidence: 0.8 }],
  uncertainty: 'Abstract only',
};

test('complete scientific evidence schema is accepted', () => {
  assert.equal(matchesEyraResponseSchema(valid, schema), true);
});

test('missing or invented scientific evidence is rejected', () => {
  assert.equal(matchesEyraResponseSchema({ ...valid, findings: [{ ...valid.findings[0], source_id: 'P999' }] }, schema), false);
  assert.equal(matchesEyraResponseSchema({ findings: valid.findings }, schema), false);
  assert.equal(matchesEyraResponseSchema({ ...valid, unexpected_conclusion: 'certain' }, schema), false);
  assert.equal(matchesEyraResponseSchema({ ...valid, findings: [{ ...valid.findings[0], confidence: '0.8' }] }, schema), false);
  assert.equal(matchesEyraResponseSchema({ ...valid, findings: [{ ...valid.findings[0], confidence: 1.2 }] }, schema), false);
  assert.equal(matchesEyraResponseSchema({ ...valid, findings: [] }, schema), false);
});

test('unknown, invalid or overly deep shapes fail closed', () => {
  assert.equal(matchesEyraResponseSchema({}, { type: 'fictional' }), false);
  assert.equal(matchesEyraResponseSchema([], schema), false);
  assert.equal(matchesEyraResponseSchema('value', null), false);
  assert.equal(matchesEyraResponseSchema({ ...valid }, schema, 9), false);
});
