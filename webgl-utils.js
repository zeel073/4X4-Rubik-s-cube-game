function buildLocalFaceDefs(half) {
  return [
    {
      stickerKey: "px",
      normal: [1, 0, 0],
      corners: [
        [half, -half, -half],
        [half, half, -half],
        [half, half, half],
        [half, -half, half],
      ],
    },
    {
      stickerKey: "nx",
      normal: [-1, 0, 0],
      corners: [
        [-half, -half, half],
        [-half, half, half],
        [-half, half, -half],
        [-half, -half, -half],
      ],
    },
    {
      stickerKey: "py",
      normal: [0, 1, 0],
      corners: [
        [-half, half, -half],
        [-half, half, half],
        [half, half, half],
        [half, half, -half],
      ],
    },
    {
      stickerKey: "ny",
      normal: [0, -1, 0],
      corners: [
        [-half, -half, half],
        [-half, -half, -half],
        [half, -half, -half],
        [half, -half, half],
      ],
    },
    {
      stickerKey: "pz",
      normal: [0, 0, 1],
      corners: [
        [half, -half, half],
        [half, half, half],
        [-half, half, half],
        [-half, -half, half],
      ],
    },
    {
      stickerKey: "nz",
      normal: [0, 0, -1],
      corners: [
        [-half, -half, -half],
        [-half, half, -half],
        [half, half, -half],
        [half, -half, -half],
      ],
    },
  ];
}

function pushVertex(target, position, normal, color) {
  target.push(position[0], position[1], position[2]);
  target.push(normal[0], normal[1], normal[2]);
  target.push(color[0], color[1], color[2]);
}

function createProgram(glContext, vertexSource, fragmentSource) {
  const vertexShader = compileShader(glContext, glContext.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(glContext, glContext.FRAGMENT_SHADER, fragmentSource);

  const shaderProgram = glContext.createProgram();
  glContext.attachShader(shaderProgram, vertexShader);
  glContext.attachShader(shaderProgram, fragmentShader);
  glContext.linkProgram(shaderProgram);

  if (!glContext.getProgramParameter(shaderProgram, glContext.LINK_STATUS)) {
    throw new Error("WebGL program link error: " + glContext.getProgramInfoLog(shaderProgram));
  }

  return shaderProgram;
}

function compileShader(glContext, type, source) {
  const shader = glContext.createShader(type);
  glContext.shaderSource(shader, source);
  glContext.compileShader(shader);

  if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
    throw new Error("WebGL shader compile error: " + glContext.getShaderInfoLog(shader));
  }

  return shader;
}

window.RubikWebGL = {
  buildLocalFaceDefs,
  pushVertex,
  createProgram,
  compileShader,
};
