export type BoolRange = {
  s: number;
  e: number;
  f: boolean
  c?: [BoolRange, BoolRange];
}

/**
 * Set range
 * @param range
 * @param start
 * @param end
 * @returns the range is all set true
 */
export function setBoolRange (range: BoolRange, start: number, end: number): boolean {
  if (range.s === start && range.e === end) {
    range.f = true;
    delete range.c;
    return true;
  }

  if (range.s > end || range.e < start) {
    throw new TypeError(`Invalid range set ${start}..${end} on ${range.s}..${range.e}`);
  }

  const mid = (range.s + range.e) >> 1;

  if (!range.c) {
    range.c = [
      { s: range.s, e: mid, f: false },
      { s: mid + 1, e: range.e, f: false },
    ];
  }

  if (end <= mid) {
    const allSet = setBoolRange(range.c[0], start, end);
    if (allSet && range.c[1].f) {
      range.f = true;
      delete range.c;
    }
  } else if (start >= mid + 1) {
    const allSet = setBoolRange(range.c[1], start, end);
    if (allSet && range.c[0].f) {
      range.f = true;
      delete range.c;
    }
  } else {
    const b0 = setBoolRange(range.c[0], start, mid);
    const b1 = setBoolRange(range.c[1], mid + 1, end);
    if (b0 && b1) {
      range.f = true;
      delete range.c;
    }
  }
  return range.f;
}

export function queryBoolRange (range: BoolRange, start: number, end: number): boolean {
  if (range.f) {
    return true;
  }

  if (range.s > end || range.e < start) {
    throw new TypeError(`Invalid range query ${start}..${end} on ${range.s}..${range.e}`);
  }

  if (!range.c) {
    return false;
  }

  const mid = (range.s + range.e) >> 1;

  if (end <= mid) {
    return queryBoolRange(range.c[0], start, end);
  } else if (start >= mid + 1) {
    return queryBoolRange(range.c[1], start, end);
  } else {
    return queryBoolRange(range.c[0], start, mid) && queryBoolRange(range.c[1], mid + 1, end);
  }
}

export function queryBoolRangePrefixRange (range: BoolRange): number | false {
  let { e: end } = range;
  if (range.f) {
    return end;
  }

  if (!range.c) {
    return false;
  }

  let res: number | false = false;
  const left = queryBoolRangePrefixRange(range.c[0]);
  if (left !== false) {
    res = left;

    // if res matches end of left, try to concat with c1
    if (res === range.c[0].e) {
      const right = queryBoolRangePrefixRange(range.c[1]);
      if (right !== false) {
        res = right;
      }
    }
  }

  return res;
}

export function queryBoolSetRangeFrom (range: BoolRange, from: number): number | false {
  let { s: start, e: end, f, c } = range;

  // out of range
  if (from > end || from < start) {
    throw new Error(`Invalid range query ${from}... on ${range.s}..${range.e}`);
  }

  // all true
  if (f) {
    return end;
  }

  // all false
  if (!c) {
    return false;
  }

  if (from === start) {
    return queryBoolRangePrefixRange(range);
  }

  // check c[1] only
  if (from >= c[1].s) {
    return queryBoolSetRangeFrom(c[1], from);
  }

  // if from to c0.end is true. check c[1] only
  if (queryBoolRange(c[0], from, c[0].e)) {
    const p = queryBoolRangePrefixRange(c[1]);
    if (p !== false) {
      return p;
    } else {
      return c[0].e;
    }
  }

  // from ..< c0.end not satisfied, recursive check c[0] is ok.
  return queryBoolSetRangeFrom(c[0], from);
}

export function expandBoolRange (range: BoolRange, targetEnd: number) {
  if (range.s !== 0) {
    throw new Error('Invalid range, only expand root');
  }

  while (range.e < targetEnd) {
    range = {
      s: 0,
      e: (range.e + 1) * 2 - 1,
      f: false,
      c: [
        range,
        {
          s: range.e + 1,
          e: (range.e + 1) * 2 - 1,
          f: false,
        },
      ],
    };
  }

  return range;
}

export function debugDetectBoolRangeFalseRanges (range: BoolRange): [start: number, end: number][] {
  if (range.f) {
    return [];
  }

  if (!range.c) {
    return [[range.s, range.e]];
  }

  const left = debugDetectBoolRangeFalseRanges(range.c[0]);
  const right = debugDetectBoolRangeFalseRanges(range.c[1]);

  if (left.length > 0 && right.length > 0) {
    if (left[left.length - 1][1] === right[0][0] - 1) {
      left.splice(left.length - 1, 1, [left[left.length - 1][0], right[0][1]]);
      right.splice(0, 1);
    }
  }

  return [...left, ...right];
}

// BoolRange encoding v2: 2 bits
export function encodeBoolRange (br: BoolRange) {
  const n = nodesCount(br);
  const bytes = 8 + Math.ceil(n / 4);
  const buffer = Buffer.alloc(bytes);
  let bitOffset = 64;

  function _enc (br: BoolRange) {
    let flag = br.f ? 0b0000_0001 : 0b0000_0000;
    if (br.c) {
      flag |= 0b0000_0010;
    }

    flag <<= (bitOffset % 8);
    const byteOffset = Math.floor(bitOffset >> 3);
    buffer.writeUint8(buffer.readUint8(byteOffset) | flag, byteOffset);

    bitOffset += 2;

    if (br.c) {
      _enc(br.c[0]);
      _enc(br.c[1]);
    }
  }

  buffer.writeUint32BE(br.s, 0);
  buffer.writeUint32BE(br.e, 4);
  _enc(br);

  return buffer;
}

export function decodeBoolRange (buffer: Buffer) {
  let bitOffset = 64; // Start after the 8-byte header

  function _dec (start: number, end: number): BoolRange {
    const byteOffset = Math.floor(bitOffset >> 3);
    const flag = buffer.readUint8(byteOffset) >> (bitOffset % 8);

    bitOffset += 2; // Consume 2 bits for this node

    if ((flag & 0b0000_0010) !== 0) {
      // Has children
      const leftChild = _dec(start, (start + end) >> 1);
      const rightChild = _dec(((start + end) >> 1) + 1, end);

      return {
        s: start,
        e: end,
        f: (flag & 0b0000_0001) !== 0,
        c: [leftChild, rightChild],
      };
    } else {
      return {
        s: start,
        e: end,
        f: (flag & 0b0000_0001) !== 0,
      };
    }
  }

  const start = buffer.readUint32BE(0);
  const end = buffer.readUint32BE(4);

  return _dec(start, end);
}

export function createBoolRange (size: number) {
  return { s: 0, e: size - 1, f: false } satisfies BoolRange;
}

function nodesCount (br: BoolRange): number {
  if (br.c) {
    return 1 + nodesCount(br.c[0]) + nodesCount(br.c[1]);
  }
  return 1;
}
