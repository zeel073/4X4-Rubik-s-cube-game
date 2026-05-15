function cubieInActiveLayers(cubie, axis, layers) {
  const v = cubie.coord[axis];
  for (let i = 0; i < layers.length; i += 1) {
    if (layers[i] === v) return true;
  }
  return false;
}

function gridIndex(value) {
  if (value === -1.5) return 0;
  if (value === -0.5) return 1;
  if (value === 0.5) return 2;
  return 3;
}

function formatMoveForDisplay(move) {
  const token = typeof move === "string" ? move : move.token;
  const wide = typeof move === "string" ? false : Boolean(move.wide);
  const base = token[0];
  const suffix = token.slice(1);
  if (!wide) return token;
  return base + "w" + suffix;
}

function optimizeMoveSequence(moves) {
  const output = [];
  function toQuarter(token) {
    const suffix = token.slice(1);
    if (suffix === "'") return 3;
    if (suffix === "2") return 2;
    return 1;
  }
  function fromQuarter(base, quarter) {
    const q = quarter % 4;
    if (q === 1) return base;
    if (q === 2) return base + "2";
    if (q === 3) return base + "'";
    return null;
  }
  for (let i = 0; i < moves.length; i += 1) {
    const current = { token: moves[i].token, wide: Boolean(moves[i].wide) };
    const prev = output.length ? output[output.length - 1] : null;
    if (prev && prev.token[0] === current.token[0] && prev.wide === current.wide) {
      const merged = (toQuarter(prev.token) + toQuarter(current.token)) % 4;
      if (merged === 0) {
        output.pop();
      } else {
        prev.token = fromQuarter(prev.token[0], merged);
      }
    } else {
      output.push(current);
    }
  }
  return output;
}

function normalizeToken(move) {
  const token = String(move || "").trim().toUpperCase();
  const match = token.match(/^([UDLRFB])(2|')?$/);
  if (!match) return null;
  return match[1] + (match[2] || "");
}

function invertToken(move) {
  if (move.endsWith("2")) return move[0] + "'";
  if (move.endsWith("'")) return move[0];
  return move + "'";
}

function randomScrambleMove(previousBase) {
  const bases = ["U", "D", "L", "R", "F", "B"].filter(function (item) {
    return item !== previousBase;
  });
  const base = bases[Math.floor(Math.random() * bases.length)];
  const r = Math.random();
  const suffix = r < 1 / 3 ? "" : r < 2 / 3 ? "'" : "2";
  return base + suffix;
}

function isSurfaceSticker(cubie, stickerKey) {
  if (stickerKey === "px") return cubie.coord.x === 1.5;
  if (stickerKey === "nx") return cubie.coord.x === -1.5;
  if (stickerKey === "py") return cubie.coord.y === 1.5;
  if (stickerKey === "ny") return cubie.coord.y === -1.5;
  if (stickerKey === "pz") return cubie.coord.z === 1.5;
  return cubie.coord.z === -1.5;
}

function stickerKeyToFaceMove(stickerKey) {
  if (stickerKey === "px") return "R";
  if (stickerKey === "nx") return "L";
  if (stickerKey === "py") return "U";
  if (stickerKey === "ny") return "D";
  if (stickerKey === "pz") return "F";
  return "B";
}

function resolveStickerColor(stickerValue, COLORS) {
  if (!stickerValue) return COLORS.CORE;
  return COLORS[stickerValue] || COLORS.CORE;
}

function intersectRayTriangle(orig, dir, a, b, c, sub3, cross3, dot3) {
  const eps = 1e-6;
  const edge1 = sub3(b, a);
  const edge2 = sub3(c, a);
  const h = cross3(dir, edge2);
  const det = dot3(edge1, h);
  if (det > -eps && det < eps) return null;
  const invDet = 1 / det;
  const s = sub3(orig, a);
  const u = invDet * dot3(s, h);
  if (u < 0 || u > 1) return null;
  const q = cross3(s, edge1);
  const v = invDet * dot3(dir, q);
  if (v < 0 || u + v > 1) return null;
  const t = invDet * dot3(edge2, q);
  if (t <= eps) return null;
  return t;
}

window.RubikGameHelpers = {
  cubieInActiveLayers,
  gridIndex,
  formatMoveForDisplay,
  optimizeMoveSequence,
  normalizeToken,
  invertToken,
  randomScrambleMove,
  isSurfaceSticker,
  stickerKeyToFaceMove,
  resolveStickerColor,
  intersectRayTriangle,
};

