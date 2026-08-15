import { describe, expect, it } from 'vitest';
import { assignNearGroups, NEAR_BUCKET_CAP, type DuplicateCandidate } from '../../src/main/scanner-service';

function candidate(id: string, normalizedContentHash: string, contentHash = `hash-${id}`): DuplicateCandidate {
  return { id, name: id, content_hash: contentHash, normalized_content_hash: normalizedContentHash };
}

type Assignment = { kind: 'exact' | 'near' | 'name'; group: string };

describe('assignNearGroups', () => {
  it('unions rows that share a band within the distance bound and leaves far rows alone', () => {
    const rows = [
      candidate('a', '0000000000000000'),
      candidate('b', '0000000000000001'), // distance 1 from a, shares band 0
      candidate('c', 'ffffffffffffffff') // far from both, no shared band
    ];
    const assignments = new Map<string, Assignment>();
    assignNearGroups(rows, assignments);

    const a = assignments.get('a');
    const b = assignments.get('b');
    expect(a).toMatchObject({ kind: 'near' });
    expect(b).toMatchObject({ kind: 'near' });
    expect(a?.group).toBe(b?.group);
    expect(a?.group).toMatch(/^near-/);
    expect(assignments.has('c')).toBe(false);
  });

  it('does not union rows with identical content hashes (exact duplicates are handled earlier)', () => {
    const rows = [
      candidate('a', '0000000000000000', 'same-content'),
      candidate('b', '0000000000000000', 'same-content')
    ];
    const assignments = new Map<string, Assignment>();
    assignNearGroups(rows, assignments);
    expect(assignments.size).toBe(0);
  });

  it('caps hot band buckets so oversized similar groups degrade gracefully', () => {
    const rows: DuplicateCandidate[] = [];
    for (let index = 0; index < NEAR_BUCKET_CAP + 10; index += 1) {
      rows.push(candidate(`r${index}`, '0000000000000000'));
    }
    const assignments = new Map<string, Assignment>();
    assignNearGroups(rows, assignments);

    const near = rows.filter((row) => assignments.has(row.id));
    // The first NEAR_BUCKET_CAP rows compare while the bucket is still open;
    // the remainder are skipped for every band and stay unassigned.
    expect(near).toHaveLength(NEAR_BUCKET_CAP);
    expect(rows[NEAR_BUCKET_CAP] && assignments.has(rows[NEAR_BUCKET_CAP].id)).toBe(false);
  });
});