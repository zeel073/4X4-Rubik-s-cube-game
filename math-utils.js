function mat3FromAxisAngle(axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  if (axis === "x") {
    return [1, 0, 0, 0, c, -s, 0, s, c];
  }

  if (axis === "y") {
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  }

  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

function mat3Mul(a, b) {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

function mat3MulVec3(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mat3Snap(m) {
  return m.map(function (value) {
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 1e-6 ? rounded : value;
  });
}

function mat4Perspective(fovRad, ratio, near, far) {
  const f = 1 / Math.tan(fovRad / 2);
  const rangeInv = 1 / (near - far);

  return new Float32Array([
    f / ratio, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0,
  ]);
}

function mat4LookAt(eye, center, up) {
  const z = normalize3(sub3(eye, center));
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);

  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot3(x, eye), -dot3(y, eye), -dot3(z, eye), 1,
  ]);
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

window.RubikMath = {
  mat3FromAxisAngle,
  mat3Mul,
  mat3MulVec3,
  mat3Snap,
  mat4Perspective,
  mat4LookAt,
  sub3,
  cross3,
  dot3,
  normalize3,
  clamp,
  degToRad,
};

