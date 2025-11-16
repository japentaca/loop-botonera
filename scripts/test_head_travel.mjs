// Test script for generateHeadTailScaleSequence reproduction

function computeMaxJump(n, headIdx, dir, ts) {
  const tail = typeof ts === 'number' && isFinite(ts) ? Math.max(0, Math.floor(ts)) : 0;
  if (dir === 'ascending') {
    const maxByBounds = Math.max(0, (n - 1) - headIdx);
    const minByTail = Math.max(1, tail - headIdx);
    return { minJ: minByTail, maxJ: maxByBounds };
  } else {
    const maxByBounds = Math.max(0, headIdx);
    const minByTail = Math.max(1, headIdx + tail - (n - 1));
    return { minJ: minByTail, maxJ: maxByBounds };
  }
}

function generateHeadTailScaleSequence({ scaleNotes, startIndex, moves, direction, tailSize }) {
  const arr = Array.isArray(scaleNotes) ? scaleNotes.slice() : [];
  const n = arr.length;
  if (n === 0) return { sequence: [], steps: [], direction: 'ascending', tailSize: 1 };
  let dir = direction === 'descending' ? 'descending' : (direction === 'ascending' ? 'ascending' : (Math.random() < 0.5 ? 'ascending' : 'descending'));
  const ts = typeof tailSize === 'number' && isFinite(tailSize) ? Math.max(1, Math.min(4, Math.floor(tailSize))) : (1 + Math.floor(Math.random() * 4));
  let head = Math.max(0, Math.min(n - 1, Math.floor(startIndex ?? 0)));
  let remaining = Math.max(0, Math.floor(moves ?? 0));
  const seq = [];
  const steps = [];
  while (remaining > 0) {
    let { minJ, maxJ } = computeMaxJump(n, head, dir, ts);
    if (maxJ < 1) {
      // If we're at the edge, bounce the direction to allow traversal across the scale
      if (dir === 'ascending' && head >= n - 1) {
        head = Math.max(0, n - 2);
        dir = 'descending';
      } else if (dir === 'descending' && head <= 0) {
        head = Math.min(n - 1, 1);
        dir = 'ascending';
      }
      ({ minJ, maxJ } = computeMaxJump(n, head, dir, ts));
      if (maxJ < 1) break;
    }
    const effectiveMin = (minJ && minJ > 1) ? minJ : 1;
    const effectiveMax = Math.max(0, maxJ);
    if (effectiveMax < effectiveMin) {
      if (effectiveMax < 1) break;
      const j1 = 1 + Math.floor(Math.random() * effectiveMax);
      var j = j1;
    } else {
      const range = effectiveMax - effectiveMin + 1;
      const j2 = effectiveMin + Math.floor(Math.random() * range);
      var j = j2;
    }
    head = dir === 'ascending' ? head + j : head - j;
    let headNote = arr[head];
    if (seq.length && headNote === seq[seq.length - 1]) {
      const altUp = head + (dir === 'ascending' ? 1 : -1);
      const altDown = head - (dir === 'ascending' ? 1 : -1);
      if (altUp >= 0 && altUp < n) headNote = arr[altUp];
      else if (altDown >= 0 && altDown < n) headNote = arr[altDown];
    }
    seq.push(headNote);
    const tail = [];
    for (let k = 1; k <= ts; k++) {
      const ti = dir === 'ascending' ? head - k : head + k;
      if (ti < 0 || ti >= n) break;
      const tailNote = arr[ti];
      tail.push({ index: ti, note: tailNote, jump: dir === 'ascending' ? -1 : 1 });
      const nextNote = (seq.length && tailNote === seq[seq.length - 1])
        ? (dir === 'ascending' ? (ti - 1 >= 0 ? arr[ti - 1] : tailNote) : (ti + 1 < n ? arr[ti + 1] : tailNote))
        : tailNote;
      seq.push(nextNote);
    }
    steps.push({ headIndex: head, headJump: dir === 'ascending' ? j : -j, tail });
    remaining--;
  }
  return { sequence: seq, steps, direction: dir, tailSize: ts };
}

function testCoverageForN(n, trials = 2000, movesFactor = 1, ts = 2) {
  const headSeen = new Set();
  const sequences = [];
  let truncatedTailCount = 0;
  for (let t = 0; t < trials; t++) {
    const startIndex = Math.floor(Math.random() * Math.max(1, n));
    const res = generateHeadTailScaleSequence({ scaleNotes: Array.from({ length: n }, (_, i) => i), startIndex, moves: Math.max(1, Math.floor(n * movesFactor)), direction: undefined, tailSize: ts });
    for (const st of res.steps) {
      headSeen.add(st.headIndex);
      if (st.tail.length < ts) truncatedTailCount++;
    }
    sequences.push(res.sequence.slice(0, 20)); // capture some sequences
  }
  return { n, seen: Array.from(headSeen).sort((a, b) => a - b), missing: [...Array(n).keys()].filter(i => !headSeen.has(i)), truncatedTailCount, sequences: sequences.slice(0, 5) };
}

const arg = Number(process.argv[2] || 0);
const tsArg = Number(process.argv[3] || 2);
const debugRun = Number(process.argv[4] || 0);
if (arg === 0) {
  for (let n = 2; n <= 20; n++) {
    const r = testCoverageForN(n, 2500, 1, tsArg);
    console.log(`n=${n} missing=${r.missing.length} indices: ${r.missing.join(', ')} truncatedTails=${r.truncatedTailCount}`);
  }
} else {
  const r = testCoverageForN(arg, 10000, 1, tsArg);
  console.log(JSON.stringify(r, null, 2));
  if (debugRun) {
    const sample = generateHeadTailScaleSequence({ scaleNotes: Array.from({ length: arg }, (_, i) => i), startIndex: 0, moves: arg, direction: undefined, tailSize: tsArg });
    console.log('SAMPLE STEPS', JSON.stringify(sample.steps, null, 2));
  }
}
