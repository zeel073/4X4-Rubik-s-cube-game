const MOVE_ORDER = ["U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2", "R", "R'", "R2", "F", "F'", "F2", "B", "B'", "B2"];

const GAME_MODES = { ACTIVE: "active", DEMO: "demo" };

const ACTIVE_MODE_PHASE = {
  NOT_STARTED: "notStarted",
  CHOOSING_START_STATE: "choosingStartState",
  READY: "ready",
  CUSTOM_START_EDIT: "customStartEdit",
  PLAYING: "playing",
  SOLVED_BY_PLAYER: "solvedByPlayer",
  SOLVE_REQUESTED: "solveRequested",
  SOLUTION_PLAYBACK: "solutionPlayback",
  PLAYBACK_PAUSED: "playbackPaused",
  COMPLETED: "completed",
};

const DEMO_PHASE = {
  CHOOSING: "choosing",
  SCRAMBLING: "scrambling",
  SCRAMBLED: "scrambled",
  SOLVING: "solving",
  PAUSED: "paused",
  COMPLETED: "completed",
};

const GRID = [-1.5, -0.5, 0.5, 1.5];

const FACE_SPECS = {
  U: { axis: "y", layer: 1.5, cwAngle: -Math.PI / 2 },
  D: { axis: "y", layer: -1.5, cwAngle: Math.PI / 2 },
  L: { axis: "x", layer: -1.5, cwAngle: Math.PI / 2 },
  R: { axis: "x", layer: 1.5, cwAngle: -Math.PI / 2 },
  F: { axis: "z", layer: 1.5, cwAngle: -Math.PI / 2 },
  B: { axis: "z", layer: -1.5, cwAngle: Math.PI / 2 },
};

const WIDE_LAYERS = {
  U: [1.5, 0.5],
  D: [-1.5, -0.5],
  R: [1.5, 0.5],
  L: [-1.5, -0.5],
  F: [1.5, 0.5],
  B: [-1.5, -0.5],
};

const FACE_ORDER = ["U", "R", "F", "D", "L", "B"];

const COLORS = {
  U: [245 / 255, 245 / 255, 245 / 255],
  D: [1, 213 / 255, 79 / 255],
  L: [1, 143 / 255, 0],
  R: [229 / 255, 57 / 255, 53 / 255],
  F: [67 / 255, 160 / 255, 71 / 255],
  B: [30 / 255, 136 / 255, 229 / 255],
  CORE: [29 / 255, 29 / 255, 29 / 255],
  CLEAR: [6 / 255, 7 / 255, 10 / 255],
};

window.RubikConstants = {
  MOVE_ORDER,
  GAME_MODES,
  ACTIVE_MODE_PHASE,
  DEMO_PHASE,
  GRID,
  FACE_SPECS,
  WIDE_LAYERS,
  FACE_ORDER,
  COLORS,
};

