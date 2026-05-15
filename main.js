/**
 * 4x4 Rubik's cube - raw WebGL (no Three.js).
 * Scramble (20), reset, undo, move counter, solve = inverse move history since reset.
 */
(function initRubik4x4WebGL() {
  if (window.__rubik4x4WebGLInit) {
    return;
  }
  window.__rubik4x4WebGLInit = true;

  const {
    MOVE_ORDER,
    GAME_MODES,
    ACTIVE_MODE_PHASE,
    DEMO_PHASE,
    GRID,
    FACE_SPECS,
    WIDE_LAYERS,
    FACE_ORDER,
    COLORS,
  } = window.RubikConstants;
  const {
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
  } = window.RubikMath;
  const { buildLocalFaceDefs, pushVertex, createProgram } = window.RubikWebGL;
  const { getDomElements } = window.RubikDom;
  const { VERT_SOURCE, FRAG_SOURCE } = window.RubikShaders;
  const {
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
  } = window.RubikGameHelpers;

  const {
    host,
    modeScreen,
    gameWorkspace,
    centerColorPalette,
    tileColorButtons,
    modeSelectActiveBtn,
    modeSelectDemoBtn,
    centerNotice,
    statusBadge,
    moveCounterEl,
    moveButtonsHost,
    playerMovePanel,
    scrambleStartBtn,
    customStartStateBtn,
    activeStartPanel,
    customEditorPanel,
    activeSolvePanel,
    giveUpSolveBtn,
    nextSolveStepBtn,
    autoPlaySolveBtn,
    pauseSolveBtn,
    replayBtn,
    solveSpeedRange,
    soundToggleBtn,
    applyCustomStartBtn,
    cancelCustomStartBtn,
    customCountsText,
    activeFlowHint,
    modeLabel,
    demoPanel,
    demoShuffleSelect,
    demoShuffleBtn,
    demoSolveBtn,
    demoNextBtn,
    demoAutoBtn,
    demoPauseBtn,
    demoReplayBtn,
    demoMoveLog,
    stageMoveLog,
    stageMoveLogBox,
  } = getDomElements();


  const spacing = 1.02;
  const cubieSize = 0.9;
  const cubies = [];
  const moveQueue = [];
  const moveHistory = [];
  let currentMode = GAME_MODES.ACTIVE;
  let gameStarted = false;
  const activeGameSession = {
    mode: GAME_MODES.ACTIVE,
    phase: ACTIVE_MODE_PHASE.NOT_STARTED,
    scrambleMoves: [],
    playerMoves: [],
    solverMoves: [],
    solutionMoves: [],
    playbackIndex: 0,
    isAnimating: false,
    isInteractionLocked: false,
    hasUserGivenUp: false,
    startType: null,
    moveCount: 0,
    startedAt: null,
    endedAt: null,
  };

  const playbackState = {
    active: false,
    pending: [],
    pendingFixes: [],
    mode: "moves",
    autoPlay: false,
    elapsed: 0,
  };

  let activeRotation = null;
  let userMoveCount = 0;
  let aspect = 1;
  let selectedCustomColor = "U";
  let customFixAnimation = null;
  let centerNoticeTimer = null;
  let lockedStartType = null;
  let demoPhase = DEMO_PHASE.CHOOSING;
  let demoShuffleMoves = [];
  let demoSolutionMoves = [];
  let audioCtx = null;
  let audioMasterGain = null;
  let audioCompressor = null;
  let soundEnabled = true;

  const camera = {
    yaw: 0.85,
    pitch: 0.58,
    radius: 12,
    minRadius: 6,
    maxRadius: 22,
    target: [0, 0, 0],
    dragging: false,
    dragMoved: false,
    lastX: 0,
    lastY: 0,
  };

  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });

  if (!gl) {
    host.textContent = "WebGL is not supported in this browser.";
    return;
  }

  const program = createProgram(gl, VERT_SOURCE, FRAG_SOURCE);
  const loc = {
    aPosition: gl.getAttribLocation(program, "aPosition"),
    aNormal: gl.getAttribLocation(program, "aNormal"),
    aColor: gl.getAttribLocation(program, "aColor"),
    uProjection: gl.getUniformLocation(program, "uProjection"),
    uView: gl.getUniformLocation(program, "uView"),
  };

  const vertexBuffer = gl.createBuffer();
  const faceDefs = buildLocalFaceDefs(cubieSize * 0.5);
  const CUSTOM_COLOR_KEYS = ["U", "D", "L", "R", "F", "B"];

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  function setStatus(text, mode) {
    statusBadge.textContent = text;
    centerNotice.textContent = text;
    if (centerNoticeTimer) {
      clearTimeout(centerNoticeTimer);
      centerNoticeTimer = null;
    }
    centerNoticeTimer = setTimeout(function clearCenterNotice() {
      centerNotice.textContent = "";
      centerNoticeTimer = null;
    }, 5000);
    statusBadge.className = "status pill";
    if (mode === "done") {
      statusBadge.classList.add("badge-done");
      return;
    }
    if (mode === "solving") {
      statusBadge.classList.add("badge-solving");
      return;
    }
    statusBadge.classList.add("pill--neutral");
  }

  function updateMoveCounter() {
    moveCounterEl.textContent = "Moves " + userMoveCount;
  }

  function isBusy() {
    return Boolean(activeRotation) || moveQueue.length > 0;
  }

  function updateSolveUiText() {
    if (currentMode !== GAME_MODES.ACTIVE) return;
    if (activeGameSession.phase === ACTIVE_MODE_PHASE.CHOOSING_START_STATE) {
      activeFlowHint.textContent = "Choose a start option.";
      return;
    }
    if (activeGameSession.phase === ACTIVE_MODE_PHASE.CUSTOM_START_EDIT) {
      activeFlowHint.textContent = "Custom editor: select color and click cube stickers.";
      return;
    }
    if (activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYING) {
      activeFlowHint.textContent = "Your turn: solve manually or use Give Up and Solve.";
      return;
    }
    if (activeGameSession.phase === ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK) {
      activeFlowHint.textContent = playbackState.autoPlay
        ? "Auto-play solving in progress."
        : "Press Next Step or Auto Play to continue solving.";
      return;
    }
    if (activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYBACK_PAUSED) {
      activeFlowHint.textContent = "Playback paused. Press Auto Play or Next Step.";
      return;
    }
    activeFlowHint.textContent = "Cube solved.";
  }

  function getSolveSpeedValue() {
    return clamp(Number(solveSpeedRange.value || 1.2), 0.4, 2.5);
  }

  function getPlaybackDelaySeconds() {
    const speed = getSolveSpeedValue();
    return clamp(1.1 - speed * 0.35, 0.08, 1.0);
  }

  function getRotationSpeed() {
    const speed = getSolveSpeedValue();
    return 4 + speed * 5.5;
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    audioCompressor = audioCtx.createDynamicsCompressor();
    audioCompressor.threshold.value = -24;
    audioCompressor.knee.value = 20;
    audioCompressor.ratio.value = 6;
    audioCompressor.attack.value = 0.003;
    audioCompressor.release.value = 0.1;
    audioMasterGain = audioCtx.createGain();
    audioMasterGain.gain.value = 0.75;
    audioMasterGain.connect(audioCompressor);
    audioCompressor.connect(audioCtx.destination);
    return audioCtx;
  }

  function unlockAudioContext() {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(function () {
        /* ignore */
      });
    }
  }

  function updateSoundToggleButton() {
    soundToggleBtn.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
  }

  function playRotationSound() {
    if (!soundEnabled) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state !== "running") {
      ctx.resume().catch(function () {
        /* ignore */
      });
      return;
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(230, now + 0.06);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain);
    gain.connect(audioMasterGain || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  function updateDemoUi() {
    const isDemo = currentMode === GAME_MODES.DEMO;
    demoPanel.classList.toggle("is-hidden", !isDemo);
    if (stageMoveLogBox) stageMoveLogBox.classList.toggle("is-hidden", !isDemo);
    if (!isDemo) return;
    const choosing = demoPhase === DEMO_PHASE.CHOOSING;
    const scrambling = demoPhase === DEMO_PHASE.SCRAMBLING;
    const scrambled = demoPhase === DEMO_PHASE.SCRAMBLED;
    const solving = demoPhase === DEMO_PHASE.SOLVING || demoPhase === DEMO_PHASE.PAUSED;
    const finished = demoPhase === DEMO_PHASE.COMPLETED;
    demoShuffleSelect.classList.toggle("is-hidden", !choosing);
    demoShuffleBtn.classList.toggle("is-hidden", !choosing);
    demoShuffleSelect.disabled = !choosing;
    demoShuffleBtn.disabled = !choosing;
    demoSolveBtn.disabled = !scrambled;
    demoSolveBtn.classList.toggle("is-hidden", !scrambled);
    demoNextBtn.classList.toggle("is-hidden", !solving);
    demoAutoBtn.classList.toggle("is-hidden", !solving);
    demoPauseBtn.classList.toggle("is-hidden", !solving);
    demoReplayBtn.classList.toggle("is-hidden", !finished);
    demoNextBtn.disabled = !solving || isBusy();
    demoAutoBtn.disabled = !solving;
    demoPauseBtn.disabled = !solving;
    demoReplayBtn.disabled = !finished;
    if (scrambling) setStatus("Demo scrambling...", "solving");
    if (scrambled) setStatus("Demo ready. Press Solve.", "neutral");
    if (demoPhase === DEMO_PHASE.PAUSED) setStatus("Demo playback paused", "neutral");
    if (demoPhase === DEMO_PHASE.COMPLETED) setStatus("Demo solved", "done");
  }

  function renderDemoMoveLog() {
    if (!demoSolutionMoves.length) {
      if (demoMoveLog) demoMoveLog.textContent = "No solution yet.";
      if (stageMoveLog) stageMoveLog.textContent = "No solution yet.";
      return;
    }
    const currentIndex = Math.max(0, activeGameSession.playbackIndex - 1);
    const items = demoSolutionMoves.map(function (m, idx) {
      const cls = idx === currentIndex && demoPhase !== DEMO_PHASE.COMPLETED ? "demo-log-item active" : "demo-log-item";
      return '<li class="' + cls + '">' + formatMoveForDisplay(m) + "</li>";
    }).join("");
    const html = '<ol class="demo-log-list">' + items + "</ol>";
    if (demoMoveLog) demoMoveLog.innerHTML = html;
    if (stageMoveLog) stageMoveLog.innerHTML = html;
    const activeEl = stageMoveLog ? stageMoveLog.querySelector(".demo-log-item.active") : null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
  }

  function startDemoShuffle() {
    if (isBusy()) return;
    stopPlayback();
    resetCube();
    const count = Number(demoShuffleSelect.value || 20);
    let prev = null;
    demoShuffleMoves = [];
    for (let i = 0; i < count; i += 1) {
      const token = randomScrambleMove(prev);
      prev = token[0];
      demoShuffleMoves.push(token);
      queueMove(token, { recordHistory: true, source: "scramble" });
    }
    demoSolutionMoves = [];
    renderDemoMoveLog();
    demoPhase = DEMO_PHASE.SCRAMBLING;
    updateDemoUi();
  }

  function solveDemoFromScramble() {
    if (isBusy()) return;
    if (demoPhase !== DEMO_PHASE.SCRAMBLED) return;
    const solution = [];
    for (let i = demoShuffleMoves.length - 1; i >= 0; i -= 1) {
      solution.push({ token: invertToken(demoShuffleMoves[i]), wide: demoShuffleMoves[i].endsWith("2") });
    }
    const optimized = optimizeMoveSequence(solution);
    demoSolutionMoves = optimized;
    activeGameSession.playbackIndex = 0;
    playbackState.active = true;
    playbackState.autoPlay = false;
    playbackState.elapsed = 0;
    playbackState.mode = "moves";
    playbackState.pendingFixes = [];
    playbackState.pending = optimized.map(function (m) { return { token: m.token, wide: m.wide }; });
    renderDemoMoveLog();
    demoPhase = DEMO_PHASE.SOLVING;
    updateDemoUi();
  }

  function setMode(mode) {
    currentMode = mode === GAME_MODES.DEMO ? GAME_MODES.DEMO : GAME_MODES.ACTIVE;
    const active = currentMode === GAME_MODES.ACTIVE;
    modeLabel.textContent = active ? "Active Play" : "Demo";
    activeStartPanel.classList.toggle("is-hidden", !active);
    activeSolvePanel.classList.add("is-hidden");
    playerMovePanel.classList.add("is-hidden");
    if (active) {
      // Hard reset Active-mode flow so Demo state cannot leak.
      stopPlayback();
      demoPhase = DEMO_PHASE.CHOOSING;
      demoShuffleMoves = [];
      demoSolutionMoves = [];
      activeGameSession.playbackIndex = 0;
      lockedStartType = null;
      resetCube();
      setActivePhase(ACTIVE_MODE_PHASE.CHOOSING_START_STATE);
      setStatus("Choose start option", "neutral");
    } else {
      stopPlayback();
      resetCube();
      demoPhase = DEMO_PHASE.CHOOSING;
      demoShuffleMoves = [];
      demoSolutionMoves = [];
      activeGameSession.playbackIndex = 0;
      renderDemoMoveLog();
      setStatus("Demo: choose shuffle steps and press Shuffle", "neutral");
    }
    updateDemoUi();
  }

  function setActivePhase(phase) {
    activeGameSession.phase = phase;
    activeGameSession.isInteractionLocked =
      phase === ACTIVE_MODE_PHASE.SOLVE_REQUESTED ||
      phase === ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK ||
      phase === ACTIVE_MODE_PHASE.PLAYBACK_PAUSED ||
      phase === ACTIVE_MODE_PHASE.COMPLETED;
    const choosing = phase === ACTIVE_MODE_PHASE.CHOOSING_START_STATE;
    const editing = phase === ACTIVE_MODE_PHASE.CUSTOM_START_EDIT;
    const player = phase === ACTIVE_MODE_PHASE.PLAYING;
    const solving = phase === ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK || phase === ACTIVE_MODE_PHASE.PLAYBACK_PAUSED;
    const finished = phase === ACTIVE_MODE_PHASE.SOLVED_BY_PLAYER || phase === ACTIVE_MODE_PHASE.COMPLETED;
    scrambleStartBtn.disabled = !choosing;
    customStartStateBtn.disabled = !choosing;

    // Step-flow visibility:
    // 1) choosing/editing -> show start options only
    // 2) playing -> show Give Up + move operators only
    // 3) solving -> show Next/Auto/Pause only, hide operators
    const showStartPanel = choosing || editing;
    const showMoveOperators = player;
    const showGiveUp = player;
    const showSolvePlaybackButtons = solving;
    const showActiveSolvePanel = player || solving || finished;
    activeStartPanel.classList.toggle("is-hidden", !showStartPanel);
    activeSolvePanel.classList.toggle("is-hidden", !showActiveSolvePanel);
    playerMovePanel.classList.toggle("is-hidden", !showMoveOperators);
    moveButtonsHost.classList.toggle("is-hidden", !showMoveOperators);
    giveUpSolveBtn.classList.toggle("is-hidden", !showGiveUp);
    nextSolveStepBtn.classList.toggle("is-hidden", !showSolvePlaybackButtons);
    autoPlaySolveBtn.classList.toggle("is-hidden", !showSolvePlaybackButtons);
    pauseSolveBtn.classList.toggle("is-hidden", !showSolvePlaybackButtons);

    // Lock user into chosen start path until replay.
    if (lockedStartType === "shuffle") {
      customStartStateBtn.classList.add("is-hidden");
      scrambleStartBtn.classList.remove("is-hidden");
    } else if (lockedStartType === "custom") {
      scrambleStartBtn.classList.add("is-hidden");
      customStartStateBtn.classList.remove("is-hidden");
    } else {
      scrambleStartBtn.classList.remove("is-hidden");
      customStartStateBtn.classList.remove("is-hidden");
    }

    giveUpSolveBtn.disabled = !player || isBusy();
    nextSolveStepBtn.disabled = !solving || isBusy();
    autoPlaySolveBtn.disabled = !solving;
    pauseSolveBtn.disabled = !solving;
    replayBtn.classList.toggle("is-hidden", !finished);
    replayBtn.disabled = !finished;
    customEditorPanel.classList.toggle("is-hidden", !editing);
    applyCustomStartBtn.disabled = !editing;
    cancelCustomStartBtn.disabled = !editing;
    for (let i = 0; i < tileColorButtons.length; i += 1) {
      tileColorButtons[i].disabled = !editing;
    }
    if (editing) {
      showCenterPalette();
    } else {
      hideCenterPalette();
    }
    nextSolveStepBtn.textContent = "Next Step";
    updateSolveUiText();
  }

  function enterGameWithMode(mode) {
    if (gameStarted) return;
    gameStarted = true;
    modeScreen.style.display = "none";
    gameWorkspace.classList.remove("workspace-hidden");
    setMode(mode);
    resize();
    if (currentMode === GAME_MODES.ACTIVE) {
      setStatus("Choose start option", "neutral");
    }
  }

  function stopPlayback(customStatus) {
    playbackState.active = false;
    playbackState.pending.length = 0;
    playbackState.pendingFixes.length = 0;
    playbackState.mode = "moves";
    customFixAnimation = null;
    playbackState.autoPlay = false;
    playbackState.elapsed = 0;
    if (customStatus) setStatus(customStatus, "neutral");
  }

  function canAcceptPlayerInput() {
    return (
      currentMode === GAME_MODES.ACTIVE &&
      activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYING &&
      !activeGameSession.isInteractionLocked &&
      !isBusy()
    );
  }

  function parseMoveSequence(raw) {
    const tokens = String(raw || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return [];
    const normalized = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const token = normalizeToken(tokens[i]);
      if (!token) return null;
      normalized.push(token);
    }
    return normalized;
  }

  function hideCenterPalette() {
    centerColorPalette.classList.add("is-hidden");
  }

  function showCenterPalette() {
    centerColorPalette.classList.remove("is-hidden");
  }

  function setPaletteSelection(colorKey) {
    selectedCustomColor = colorKey;
    for (let i = 0; i < tileColorButtons.length; i += 1) {
      const btn = tileColorButtons[i];
      btn.classList.toggle("palette-btn-active", btn.dataset.color === colorKey);
    }
  }

  function clearToBlankCustomState() {
    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      const keys = ["px", "nx", "py", "ny", "pz", "nz"];
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        cubie.stickers[key] = isSurfaceSticker(cubie, key) ? null : "CORE";
      }
    }
  }

  function getCustomCounts() {
    const counts = { U: 0, D: 0, L: 0, R: 0, F: 0, B: 0, empty: 0 };
    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      const keys = ["px", "nx", "py", "ny", "pz", "nz"];
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        if (!isSurfaceSticker(cubie, key)) continue;
        const value = cubie.stickers[key];
        if (!value) {
          counts.empty += 1;
        } else if (CUSTOM_COLOR_KEYS.indexOf(value) >= 0) {
          counts[value] += 1;
        }
      }
    }
    return counts;
  }

  function updateCustomCountsText() {
    const c = getCustomCounts();
    customCountsText.textContent =
      "W " + c.U + " | Y " + c.D + " | O " + c.L + " | R " + c.R + " | G " + c.F + " | B " + c.B + " | Empty " + c.empty;
  }

  function isCustomStateValid() {
    const c = getCustomCounts();
    if (c.empty !== 0) return false;
    for (let i = 0; i < CUSTOM_COLOR_KEYS.length; i += 1) {
      if (c[CUSTOM_COLOR_KEYS[i]] !== 16) return false;
    }
    return true;
  }

  function buildSignatureInventory(useHome) {
    const map = {};
    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      const keys = ["px", "nx", "py", "ny", "pz", "nz"];
      const colors = [];
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        if (!isSurfaceSticker(cubie, key)) continue;
        const value = useHome ? cubie.homeStickers[key] : cubie.stickers[key];
        if (!value || value === "CORE") continue;
        colors.push(value);
      }
      if (colors.length === 0) continue;
      colors.sort();
      const signature = colors.join("-");
      map[signature] = (map[signature] || 0) + 1;
    }
    return map;
  }

  function mapsEqual(a, b) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i += 1) {
      const key = keysA[i];
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  function isCustomStateSolvable() {
    if (!isCustomStateValid()) return false;
    const currentInventory = buildSignatureInventory(false);
    const solvedInventory = buildSignatureInventory(true);
    return mapsEqual(currentInventory, solvedInventory);
  }

  function buildCustomFixesToSolved() {
    const fixes = [];
    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      const keys = ["px", "nx", "py", "ny", "pz", "nz"];
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        if (!isSurfaceSticker(cubie, key)) continue;
        if (cubie.stickers[key] !== cubie.homeStickers[key]) {
          fixes.push({ cubie: cubie, stickerKey: key, targetColor: cubie.homeStickers[key] });
        }
      }
    }
    return fixes;
  }

  function exportFaceletStateString() {
    const faces = {
      U: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
      D: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
      L: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
      R: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
      F: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
      B: Array.from({ length: 4 }, function () { return Array(4).fill("X"); }),
    };

    for (let i = 0; i < cubies.length; i += 1) {
      const c = cubies[i];
      const x = c.coord.x;
      const y = c.coord.y;
      const z = c.coord.z;
      if (y === 1.5) faces.U[gridIndex(-z)][gridIndex(x)] = c.stickers.py || "X";
      if (y === -1.5) faces.D[gridIndex(z)][gridIndex(x)] = c.stickers.ny || "X";
      if (z === 1.5) faces.F[gridIndex(-y)][gridIndex(x)] = c.stickers.pz || "X";
      if (z === -1.5) faces.B[gridIndex(-y)][gridIndex(-x)] = c.stickers.nz || "X";
      if (x === 1.5) faces.R[gridIndex(-y)][gridIndex(-z)] = c.stickers.px || "X";
      if (x === -1.5) faces.L[gridIndex(-y)][gridIndex(z)] = c.stickers.nx || "X";
    }

    let facelets = "";
    for (let fi = 0; fi < FACE_ORDER.length; fi += 1) {
      const face = FACE_ORDER[fi];
      for (let r = 0; r < 4; r += 1) {
        for (let col = 0; col < 4; col += 1) {
          facelets += faces[face][r][col];
        }
      }
    }
    return facelets;
  }

  function parseSolverMoveToken(raw) {
    const token = String(raw || "").trim();
    if (!token) return [];
    const match = token.match(/^([URFDLBurfdlb])(w)?(2|')?$/);
    if (!match) return [];
    const face = match[1].toUpperCase();
    const isWide = Boolean(match[2]) || match[1] === match[1].toLowerCase();
    const suffix = match[3] || "";

    if (suffix === "2") {
      return [
        { token: face, wide: isWide },
        { token: face, wide: isWide },
      ];
    }
    if (suffix === "'") {
      return [{ token: face + "'", wide: isWide }];
    }
    return [{ token: face, wide: isWide }];
  }

  async function solveCustomStateViaAdapter() {
    return { kind: "fixes", fixes: buildCustomFixesToSolved() };
  }

  function createCubie(x, y, z) {
    const stickers = {
      px: x === 1.5 ? "R" : "CORE",
      nx: x === -1.5 ? "L" : "CORE",
      py: y === 1.5 ? "U" : "CORE",
      ny: y === -1.5 ? "D" : "CORE",
      pz: z === 1.5 ? "F" : "CORE",
      nz: z === -1.5 ? "B" : "CORE",
    };
    cubies.push({
      coord: { x: x, y: y, z: z },
      homeCoord: { x: x, y: y, z: z },
      orient: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      homeOrient: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      stickers: Object.assign({}, stickers),
      homeStickers: Object.assign({}, stickers),
    });
  }

  function buildCube() {
    for (let xi = 0; xi < GRID.length; xi += 1) {
      for (let yi = 0; yi < GRID.length; yi += 1) {
        for (let zi = 0; zi < GRID.length; zi += 1) {
          createCubie(GRID[xi], GRID[yi], GRID[zi]);
        }
      }
    }
  }

  function moveWeight() {
    return 1;
  }

  function queueMove(move, options) {
    const opts = options || {};
    const token = normalizeToken(move);
    if (!token) return false;
    const entry = {
      token: token,
      recordHistory: Boolean(opts.recordHistory),
      source: opts.source || "system",
    };
    if (opts.wide) entry.wide = true;
    moveQueue.push(entry);
    return true;
  }

  function startMove(entry) {
    const token = entry.token;
    const base = token[0];
    const suffix = token.slice(1);
    const spec = FACE_SPECS[base];
    if (!spec) return;

    let target = spec.cwAngle;
    if (suffix === "'") target = -target;
    const wide = suffix === "2" || entry.wide === true;
    const layers = wide ? WIDE_LAYERS[base].slice() : [spec.layer];
    activeRotation = {
      axis: spec.axis,
      layers: layers,
      target: target,
      angle: 0,
      speed: getRotationSpeed(),
      token: token,
      recordHistory: entry.recordHistory,
      source: entry.source,
    };
    playRotationSound();
  }

  function finishMove() {
    const spec = activeRotation;
    const rot = mat3FromAxisAngle(spec.axis, spec.target);

    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      if (!cubieInActiveLayers(cubie, spec.axis, spec.layers)) continue;
      const pos = [cubie.coord.x * spacing, cubie.coord.y * spacing, cubie.coord.z * spacing];
      const newPos = mat3MulVec3(rot, pos);
      cubie.coord = {
        x: snapGrid(newPos[0] / spacing),
        y: snapGrid(newPos[1] / spacing),
        z: snapGrid(newPos[2] / spacing),
      };
      cubie.orient = mat3Snap(mat3Mul(rot, cubie.orient));
    }

    if (playbackState.mode === "fixes" && customFixAnimation && spec.source === "solver") {
      customFixAnimation.remainingMoves -= 1;
      if (customFixAnimation.remainingMoves <= 0) {
        customFixAnimation.fix.cubie.stickers[customFixAnimation.fix.stickerKey] = customFixAnimation.fix.targetColor;
        customFixAnimation = null;
        updateCustomCountsText();
      }
    }

    if (spec.recordHistory) {
      const record = {
        move: spec.token,
        source: spec.source,
        timestamp: Date.now(),
        stepIndex: moveHistory.length,
      };
      moveHistory.push(record);
      if (record.source === "player") {
        activeGameSession.playerMoves.push(record);
        userMoveCount += moveWeight();
        activeGameSession.moveCount = userMoveCount;
        updateMoveCounter();
      } else if (record.source === "scramble") {
        activeGameSession.scrambleMoves.push(record);
      } else if (record.source === "solver") {
        activeGameSession.solverMoves.push(record);
      }
    }

    activeRotation = null;

    if (isSolved()) {
      if (currentMode === GAME_MODES.ACTIVE) {
        stopPlayback();
        if (activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYING) {
          setActivePhase(ACTIVE_MODE_PHASE.SOLVED_BY_PLAYER);
        } else {
          setActivePhase(ACTIVE_MODE_PHASE.COMPLETED);
        }
        activeGameSession.endedAt = Date.now();
      }
      if (currentMode === GAME_MODES.DEMO) {
        demoPhase = DEMO_PHASE.COMPLETED;
        updateDemoUi();
      }
      setStatus("Solved", "done");
      return;
    }

    if (moveQueue.length > 0) {
      setStatus("Applying moves", "solving");
      return;
    }

    if (currentMode === GAME_MODES.DEMO && demoPhase === DEMO_PHASE.SCRAMBLING) {
      demoPhase = DEMO_PHASE.SCRAMBLED;
      updateDemoUi();
      return;
    }
    if (currentMode === GAME_MODES.DEMO && demoPhase === DEMO_PHASE.SOLVING) {
      setStatus("Demo solving: Next / Auto", "neutral");
      return;
    }

    if (currentMode === GAME_MODES.ACTIVE && activeGameSession.phase === ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK) {
      nextSolveStepBtn.disabled = false;
      setStatus("Press Next Step", "neutral");
      return;
    }

    if (currentMode === GAME_MODES.ACTIVE && activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYING) {
      giveUpSolveBtn.disabled = false;
    }
    setStatus("Ready", "neutral");
  }

  function updateRotation(dt) {
    if (!activeRotation) {
      if (moveQueue.length > 0) startMove(moveQueue.shift());
      return;
    }

    const remaining = activeRotation.target - activeRotation.angle;
    const step = Math.sign(remaining) * Math.min(Math.abs(remaining), activeRotation.speed * dt);
    activeRotation.angle += step;

    const t = activeRotation.target;
    const a = activeRotation.angle;
    if ((t >= 0 && a >= t) || (t <= 0 && a <= t)) {
      activeRotation.angle = t;
      finishMove();
      return;
    }
  }

  function queueOnePlaybackStep() {
    if (!playbackState.active || isBusy()) return;
    if (playbackState.mode === "fixes") {
      if (customFixAnimation) return;
      if (playbackState.pendingFixes.length === 0) {
        stopPlayback();
        if (isSolved()) {
          if (currentMode === GAME_MODES.ACTIVE) {
            setActivePhase(ACTIVE_MODE_PHASE.COMPLETED);
            activeGameSession.endedAt = Date.now();
          }
          setStatus("Solved", "done");
          return;
        }
        setStatus("Custom solve ended but cube is not solved", "neutral");
        return;
      }
      const fix = playbackState.pendingFixes.shift();
      const faceMove = stickerKeyToFaceMove(fix.stickerKey);
      customFixAnimation = { fix: fix, remainingMoves: 2 };
      queueMove(faceMove, { recordHistory: true, source: "solver" });
      queueMove(invertToken(faceMove), { recordHistory: true, source: "solver" });
      activeGameSession.playbackIndex += 1;
      if (playbackState.pendingFixes.length === 0) {
        nextSolveStepBtn.textContent = "Finish";
      }
      return;
    }

    if (playbackState.pending.length === 0) {
      stopPlayback();
      if (isSolved()) {
        if (currentMode === GAME_MODES.ACTIVE) {
          setActivePhase(ACTIVE_MODE_PHASE.COMPLETED);
          activeGameSession.endedAt = Date.now();
        }
        if (currentMode === GAME_MODES.DEMO) {
          demoPhase = DEMO_PHASE.COMPLETED;
          updateDemoUi();
        }
        setStatus("Solved", "done");
        return;
      }
      // Never report solved unless the real cube state is solved.
      setStatus("Solve sequence ended but cube is not solved", "neutral");
      return;
    }
    const next = playbackState.pending.shift();
    queueMove(next.token, { recordHistory: true, source: "solver", wide: next.wide });
    activeGameSession.playbackIndex += 1;
    if (currentMode === GAME_MODES.DEMO) {
      renderDemoMoveLog();
    }
    if (playbackState.pending.length === 0) {
      nextSolveStepBtn.textContent = "Finish";
    }
  }

  function updatePlayback(dt) {
    if (!playbackState.active || !playbackState.autoPlay) return;
    if (currentMode === GAME_MODES.ACTIVE && activeGameSession.phase !== ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK) return;
    if (currentMode === GAME_MODES.DEMO && demoPhase !== DEMO_PHASE.SOLVING) return;
    if (isBusy()) return;
    playbackState.elapsed += dt;
    if (playbackState.elapsed >= getPlaybackDelaySeconds()) {
      playbackState.elapsed = 0;
      queueOnePlaybackStep();
    }
  }

  function scramble20() {
    if (isBusy()) return;
    stopPlayback();
    moveHistory.length = 0;
    activeGameSession.scrambleMoves = [];
    activeGameSession.playerMoves = [];
    activeGameSession.solverMoves = [];
    activeGameSession.solutionMoves = [];
    activeGameSession.playbackIndex = 0;
    activeGameSession.hasUserGivenUp = false;
    activeGameSession.startType = "shuffle";
    activeGameSession.startedAt = Date.now();
    activeGameSession.endedAt = null;
    userMoveCount = 0;
    activeGameSession.moveCount = 0;
    updateMoveCounter();
    let prev = null;
    for (let i = 0; i < 20; i += 1) {
      const token = randomScrambleMove(prev);
      prev = token[0];
      queueMove(token, { recordHistory: true, source: "scramble" });
    }
    if (currentMode === GAME_MODES.ACTIVE) {
      setActivePhase(ACTIVE_MODE_PHASE.PLAYING);
    }
    setStatus("Scrambling", "solving");
  }

  function undoLast() {
    if (moveHistory.length === 0 || isBusy() || currentMode !== GAME_MODES.DEMO) return;
    stopPlayback();
    const last = moveHistory.pop();
    const inverse = invertToken(last.move);
    userMoveCount = Math.max(0, userMoveCount - moveWeight());
    updateMoveCounter();
    queueMove(inverse, { recordHistory: false, source: "system", wide: last.move.endsWith("2") });
    setStatus("Undo move", "solving");
  }

  function resetCube() {
    moveQueue.length = 0;
    activeRotation = null;
    stopPlayback();
    moveHistory.length = 0;
    activeGameSession.scrambleMoves = [];
    activeGameSession.playerMoves = [];
    activeGameSession.solverMoves = [];
    activeGameSession.solutionMoves = [];
    activeGameSession.playbackIndex = 0;
    activeGameSession.hasUserGivenUp = false;
    activeGameSession.startType = null;
    userMoveCount = 0;
    activeGameSession.moveCount = 0;
    updateMoveCounter();

    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      cubie.coord = { x: cubie.homeCoord.x, y: cubie.homeCoord.y, z: cubie.homeCoord.z };
      cubie.orient = cubie.homeOrient.slice();
      cubie.stickers = Object.assign({}, cubie.homeStickers);
    }

    if (currentMode === GAME_MODES.ACTIVE) {
      setActivePhase(ACTIVE_MODE_PHASE.CHOOSING_START_STATE);
      setStatus("Choose start option", "neutral");
      return;
    }
    setStatus("Reset to solved", "done");
  }

  function solveFromHistory() {
    if (isBusy()) return;
    if (moveHistory.length === 0) {
      setStatus("Already solved", "done");
      return;
    }

    const hist = moveHistory.slice();
    const solution = [];
    for (let i = hist.length - 1; i >= 0; i -= 1) {
      solution.push({ token: invertToken(hist[i].move), wide: hist[i].move.endsWith("2") });
    }

    activeGameSession.phase = ACTIVE_MODE_PHASE.SOLVE_REQUESTED;
    activeGameSession.hasUserGivenUp = true;
    activeGameSession.solutionMoves = solution.slice();
    activeGameSession.playbackIndex = 0;
    playbackState.active = true;
    playbackState.mode = "moves";
    playbackState.pending = solution;
    playbackState.pendingFixes = [];
    playbackState.autoPlay = false;
    playbackState.elapsed = 0;
    if (currentMode === GAME_MODES.ACTIVE) {
      setActivePhase(ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK);
    }
    setStatus("Solving from current state", "solving");
  }

  function isSolved() {
    for (let i = 0; i < cubies.length; i += 1) {
      const cubie = cubies[i];
      if (
        cubie.coord.x !== cubie.homeCoord.x ||
        cubie.coord.y !== cubie.homeCoord.y ||
        cubie.coord.z !== cubie.homeCoord.z
      ) {
        return false;
      }
      const keys = ["px", "nx", "py", "ny", "pz", "nz"];
      for (let k = 0; k < keys.length; k += 1) {
        const key = keys[k];
        if (cubie.stickers[key] !== cubie.homeStickers[key]) {
          return false;
        }
      }
      for (let j = 0; j < 9; j += 1) {
        if (cubie.orient[j] !== cubie.homeOrient[j]) {
          return false;
        }
      }
    }
    return true;
  }

  function buildVertexData() {
    const data = [];

    for (let ci = 0; ci < cubies.length; ci += 1) {
      const cubie = cubies[ci];
      let orient = cubie.orient;
      let position = [cubie.coord.x * spacing, cubie.coord.y * spacing, cubie.coord.z * spacing];

      if (activeRotation && cubieInActiveLayers(cubie, activeRotation.axis, activeRotation.layers)) {
        const liveRot = mat3FromAxisAngle(activeRotation.axis, activeRotation.angle);
        orient = mat3Mul(liveRot, orient);
        position = mat3MulVec3(liveRot, position);
      }

      for (let fi = 0; fi < faceDefs.length; fi += 1) {
        const face = faceDefs[fi];
        const color = resolveStickerColor(cubie.stickers[face.stickerKey], COLORS);
        const normal = mat3MulVec3(orient, face.normal);
        const corners = face.corners.map(function (corner) {
          const rotated = mat3MulVec3(orient, corner);
          return [rotated[0] + position[0], rotated[1] + position[1], rotated[2] + position[2]];
        });

        pushVertex(data, corners[0], normal, color);
        pushVertex(data, corners[1], normal, color);
        pushVertex(data, corners[2], normal, color);

        pushVertex(data, corners[0], normal, color);
        pushVertex(data, corners[2], normal, color);
        pushVertex(data, corners[3], normal, color);
      }
    }

    return new Float32Array(data);
  }

  function render() {
    const projection = mat4Perspective(degToRad(46), aspect, 0.1, 100);
    const eye = [
      camera.radius * Math.cos(camera.pitch) * Math.sin(camera.yaw),
      camera.radius * Math.sin(camera.pitch),
      camera.radius * Math.cos(camera.pitch) * Math.cos(camera.yaw),
    ];
    const view = mat4LookAt(eye, camera.target, [0, 1, 0]);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(COLORS.CLEAR[0], COLORS.CLEAR[1], COLORS.CLEAR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const vertexData = buildVertexData();

    gl.useProgram(program);
    gl.uniformMatrix4fv(loc.uProjection, false, projection);
    gl.uniformMatrix4fv(loc.uView, false, view);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

    const stride = 9 * 4;
    gl.enableVertexAttribArray(loc.aPosition);
    gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(loc.aNormal);
    gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, stride, 3 * 4);

    gl.enableVertexAttribArray(loc.aColor);
    gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, stride, 6 * 4);

    gl.drawArrays(gl.TRIANGLES, 0, vertexData.length / 9);
  }

  function frame(now) {
    if (!frame.last) frame.last = now;
    const dt = Math.min((now - frame.last) / 1000, 0.05);
    frame.last = now;

    updateRotation(dt);
    updatePlayback(dt);
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(host.clientWidth * dpr));
    const height = Math.max(1, Math.floor(host.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    aspect = width / height;
  }

  function getCameraEye() {
    return [
      camera.radius * Math.cos(camera.pitch) * Math.sin(camera.yaw),
      camera.radius * Math.sin(camera.pitch),
      camera.radius * Math.cos(camera.pitch) * Math.cos(camera.yaw),
    ];
  }

  function getPickRay(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const eye = getCameraEye();
    const forward = normalize3(sub3(camera.target, eye));
    const right = normalize3(cross3(forward, [0, 1, 0]));
    const up = normalize3(cross3(right, forward));
    const tanHalfFov = Math.tan(degToRad(46) * 0.5);
    const vx = ndcX * tanHalfFov * aspect;
    const vy = ndcY * tanHalfFov;
    const dir = normalize3([
      forward[0] + right[0] * vx + up[0] * vy,
      forward[1] + right[1] * vx + up[1] * vy,
      forward[2] + right[2] * vx + up[2] * vy,
    ]);
    return { origin: eye, dir: dir };
  }

  function paintStickerAt(clientX, clientY) {
    if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.CUSTOM_START_EDIT) return;
    if (isBusy()) return;
    const ray = getPickRay(clientX, clientY);
    if (!ray) return;
    let best = null;
    for (let ci = 0; ci < cubies.length; ci += 1) {
      const cubie = cubies[ci];
      const orient = cubie.orient;
      const position = [cubie.coord.x * spacing, cubie.coord.y * spacing, cubie.coord.z * spacing];
      for (let fi = 0; fi < faceDefs.length; fi += 1) {
        const face = faceDefs[fi];
        if (!isSurfaceSticker(cubie, face.stickerKey)) continue;
        const worldNormal = mat3MulVec3(orient, face.normal);
        if (dot3(worldNormal, ray.dir) >= 0) continue;
        const corners = face.corners.map(function (corner) {
          const rotated = mat3MulVec3(orient, corner);
          return [rotated[0] + position[0], rotated[1] + position[1], rotated[2] + position[2]];
        });
        const t1 = intersectRayTriangle(ray.origin, ray.dir, corners[0], corners[1], corners[2], sub3, cross3, dot3);
        const t2 = intersectRayTriangle(ray.origin, ray.dir, corners[0], corners[2], corners[3], sub3, cross3, dot3);
        const t = t1 === null ? t2 : t2 === null ? t1 : Math.min(t1, t2);
        if (t === null) continue;
        if (!best || t < best.t) {
          best = { t: t, cubie: cubie, stickerKey: face.stickerKey };
        }
      }
    }
    if (!best) return;
    const counts = getCustomCounts();
    const currentColorOnTile = best.cubie.stickers[best.stickerKey];
    const nextCount =
      counts[selectedCustomColor] + (currentColorOnTile === selectedCustomColor ? 0 : 1);
    if (nextCount > 16) {
      setStatus("Cannot apply more than 16 tiles for " + selectedCustomColor + " color", "neutral");
      return;
    }
    best.cubie.stickers[best.stickerKey] = selectedCustomColor;
    updateCustomCountsText();
  }

  function bindOrbitControls() {
    canvas.addEventListener("pointerdown", function onPointerDown(event) {
      unlockAudioContext();
      camera.dragging = true;
      camera.dragMoved = false;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", function onPointerMove(event) {
      if (!camera.dragging) return;
      const dx = event.clientX - camera.lastX;
      const dy = event.clientY - camera.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) camera.dragMoved = true;
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;

      camera.yaw -= dx * 0.0085;
      camera.pitch -= dy * 0.0085;
      camera.pitch = clamp(camera.pitch, -1.35, 1.35);
    });

    canvas.addEventListener("pointerup", function onPointerUp(event) {
      camera.dragging = false;
      if (!camera.dragMoved) {
        paintStickerAt(event.clientX, event.clientY);
      }
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch (e) {
        /* ignore */
      }
    });

    canvas.addEventListener("pointercancel", function onPointerCancel() {
      camera.dragging = false;
    });

    canvas.addEventListener(
      "wheel",
      function onWheel(event) {
        event.preventDefault();
        camera.radius += event.deltaY * 0.012;
        camera.radius = clamp(camera.radius, camera.minRadius, camera.maxRadius);
      },
      { passive: false }
    );
  }

  function bindUi() {
    window.addEventListener(
      "pointerdown",
      function onGlobalPointerUnlock() {
        unlockAudioContext();
      },
      { passive: true }
    );
    window.addEventListener(
      "touchstart",
      function onGlobalTouchUnlock() {
        unlockAudioContext();
      },
      { passive: true }
    );
    bindDeduped(soundToggleBtn, function onToggleSound() {
      soundEnabled = !soundEnabled;
      updateSoundToggleButton();
    });
    const DEDUP_MS = 600;

    function bindDeduped(el, handler) {
      let last = 0;
      function run(event) {
        const now = Date.now();
        if (now - last < DEDUP_MS) {
          if (event) event.preventDefault();
          return;
        }
        last = now;
        handler();
      }
      el.addEventListener(
        "pointerup",
        function onPointerUp(event) {
          if (event.button !== 0) return;
          event.preventDefault();
          run(event);
        },
        { passive: false }
      );
      el.addEventListener("click", function onClick(event) {
        event.preventDefault();
        run(event);
      });
    }

    for (let i = 0; i < MOVE_ORDER.length; i += 1) {
      const token = MOVE_ORDER[i];
      const button = document.createElement("button");
      button.className = "btn";
      button.type = "button";
      button.textContent = token;
      bindDeduped(button, function onMove() {
        if (!canAcceptPlayerInput()) return;
        queueMove(token, { recordHistory: true, source: "player" });
        giveUpSolveBtn.disabled = true;
        setStatus("Applying moves", "solving");
      });
      moveButtonsHost.appendChild(button);
    }

    bindDeduped(scrambleStartBtn, function onScramble() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.CHOOSING_START_STATE) return;
      lockedStartType = "shuffle";
      scramble20();
    });

    bindDeduped(customStartStateBtn, function onCustomStart() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.CHOOSING_START_STATE) return;
      lockedStartType = "custom";
      clearToBlankCustomState();
      setPaletteSelection("U");
      updateCustomCountsText();
      setActivePhase(ACTIVE_MODE_PHASE.CUSTOM_START_EDIT);
      setStatus("Custom edit mode", "neutral");
    });

    for (let i = 0; i < tileColorButtons.length; i += 1) {
      (function bindTileColorButton(btn) {
        bindDeduped(btn, function onTileColorPick() {
          if (activeGameSession.phase !== ACTIVE_MODE_PHASE.CUSTOM_START_EDIT) return;
          setPaletteSelection(btn.dataset.color);
        });
      })(tileColorButtons[i]);
    }

    bindDeduped(applyCustomStartBtn, async function onApplyCustomStart() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.CUSTOM_START_EDIT) return;
      if (!isCustomStateSolvable()) {
        setStatus("This custom cube is not solvable", "neutral");
        return;
      }
      setStatus("Checking custom state and generating solution...", "solving");
      moveHistory.length = 0;
      activeGameSession.scrambleMoves = [];
      activeGameSession.playerMoves = [];
      activeGameSession.solverMoves = [];
      activeGameSession.solutionMoves = [];
      activeGameSession.playbackIndex = 0;
      activeGameSession.hasUserGivenUp = false;
      activeGameSession.startType = "custom";
      activeGameSession.startedAt = Date.now();
      activeGameSession.endedAt = null;
      userMoveCount = 0;
      activeGameSession.moveCount = 0;
      updateMoveCounter();
      let solution;
      try {
        solution = await solveCustomStateViaAdapter();
      } catch (error) {
        stopPlayback();
        setStatus(error && error.message ? error.message : "Custom solve error", "neutral");
        return;
      }
      playbackState.active = true;
      playbackState.autoPlay = false;
      playbackState.elapsed = 0;
      if (solution.kind === "moves") {
        playbackState.mode = "moves";
        playbackState.pendingFixes = [];
        playbackState.pending = solution.moves.map(function (m) {
          return { token: m.token, wide: m.wide };
        });
        activeGameSession.solutionMoves = playbackState.pending.map(function (m) { return m.token; });
      } else {
        playbackState.mode = "fixes";
        playbackState.pending = [];
        playbackState.pendingFixes = solution.fixes;
        activeGameSession.solutionMoves = playbackState.pendingFixes.map(function (_item, idx) {
          return "FIX_" + idx;
        });
      }
      if (playbackState.pending.length === 0 && playbackState.pendingFixes.length === 0) {
        setStatus("Already solved", "done");
        stopPlayback();
        setActivePhase(ACTIVE_MODE_PHASE.COMPLETED);
        return;
      }
      setActivePhase(ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK);
      setStatus("Custom cube solvable. Use Next Step / Auto Play", "solving");
    });

    bindDeduped(cancelCustomStartBtn, function onCancelCustomStart() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.CUSTOM_START_EDIT) return;
      lockedStartType = null;
      resetCube();
      setStatus("Custom start canceled. Choose start option.", "neutral");
    });

    bindDeduped(giveUpSolveBtn, function onGiveUpAndSolve() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.PLAYING) return;
      if (isBusy()) return;
      solveFromHistory();
    });

    bindDeduped(nextSolveStepBtn, function onNextStep() {
      if (!gameStarted) return;
      if (
        currentMode !== GAME_MODES.ACTIVE ||
        (activeGameSession.phase !== ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK &&
          activeGameSession.phase !== ACTIVE_MODE_PHASE.PLAYBACK_PAUSED)
      ) {
        return;
      }
      playbackState.autoPlay = false;
      if (activeGameSession.phase === ACTIVE_MODE_PHASE.PLAYBACK_PAUSED) {
        setActivePhase(ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK);
      }
      queueOnePlaybackStep();
    });

    bindDeduped(autoPlaySolveBtn, function onAutoPlaySolve() {
      if (!gameStarted) return;
      if (
        currentMode !== GAME_MODES.ACTIVE ||
        (activeGameSession.phase !== ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK &&
          activeGameSession.phase !== ACTIVE_MODE_PHASE.PLAYBACK_PAUSED)
      ) {
        return;
      }
      playbackState.autoPlay = true;
      playbackState.elapsed = 0;
      setActivePhase(ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK);
      setStatus("Auto solving", "solving");
    });

    bindDeduped(pauseSolveBtn, function onPauseSolve() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE || activeGameSession.phase !== ACTIVE_MODE_PHASE.SOLUTION_PLAYBACK) return;
      playbackState.autoPlay = false;
      setActivePhase(ACTIVE_MODE_PHASE.PLAYBACK_PAUSED);
      setStatus("Playback paused", "neutral");
    });

    solveSpeedRange.addEventListener("input", function onSolveSpeedInput() {
      updateSolveUiText();
    });

    bindDeduped(modeSelectActiveBtn, function onInitialActiveMode() {
      enterGameWithMode(GAME_MODES.ACTIVE);
    });

    bindDeduped(modeSelectDemoBtn, function onInitialDemoMode() {
      enterGameWithMode(GAME_MODES.DEMO);
    });

    bindDeduped(demoShuffleBtn, function onDemoShuffle() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO || demoPhase !== DEMO_PHASE.CHOOSING) return;
      startDemoShuffle();
    });

    bindDeduped(demoSolveBtn, function onDemoSolve() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO) return;
      solveDemoFromScramble();
    });

    bindDeduped(demoNextBtn, function onDemoNext() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO || (demoPhase !== DEMO_PHASE.SOLVING && demoPhase !== DEMO_PHASE.PAUSED)) return;
      playbackState.autoPlay = false;
      demoPhase = DEMO_PHASE.SOLVING;
      updateDemoUi();
      queueOnePlaybackStep();
    });

    bindDeduped(demoAutoBtn, function onDemoAuto() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO || (demoPhase !== DEMO_PHASE.SOLVING && demoPhase !== DEMO_PHASE.PAUSED)) return;
      demoPhase = DEMO_PHASE.SOLVING;
      playbackState.autoPlay = true;
      playbackState.elapsed = 0;
      updateDemoUi();
      setStatus("Demo auto solving", "solving");
    });

    bindDeduped(demoPauseBtn, function onDemoPause() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO || demoPhase !== DEMO_PHASE.SOLVING) return;
      playbackState.autoPlay = false;
      demoPhase = DEMO_PHASE.PAUSED;
      updateDemoUi();
    });

    bindDeduped(demoReplayBtn, function onDemoReplay() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.DEMO) return;
      if (demoPhase !== DEMO_PHASE.COMPLETED) return;
      stopPlayback();
      resetCube();
      demoPhase = DEMO_PHASE.CHOOSING;
      demoShuffleMoves = [];
      demoSolutionMoves = [];
      activeGameSession.playbackIndex = 0;
      renderDemoMoveLog();
      updateDemoUi();
      setStatus("Demo: choose shuffle steps and press Shuffle", "neutral");
    });

    bindDeduped(replayBtn, function onReplay() {
      if (!gameStarted) return;
      if (currentMode !== GAME_MODES.ACTIVE) return;
      if (
        activeGameSession.phase !== ACTIVE_MODE_PHASE.SOLVED_BY_PLAYER &&
        activeGameSession.phase !== ACTIVE_MODE_PHASE.COMPLETED
      ) {
        return;
      }
      lockedStartType = null;
      resetCube();
      setStatus("Replay ready: choose start option", "neutral");
    });

    window.addEventListener("keydown", function onKeyDown(event) {
      unlockAudioContext();
      if (!gameStarted) return;
      if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        if (currentMode === GAME_MODES.ACTIVE && activeGameSession.phase === ACTIVE_MODE_PHASE.CHOOSING_START_STATE) {
          scramble20();
        } else if (currentMode === GAME_MODES.DEMO && demoPhase === DEMO_PHASE.CHOOSING) {
          startDemoShuffle();
        }
        return;
      }

      const key = event.key.toUpperCase();
      if (!/[UDLRFB]/.test(key)) return;

      if (event.repeat) return;
      if (!canAcceptPlayerInput()) return;

      event.preventDefault();

      let token;
      if (event.shiftKey) {
        token = key + "'";
      } else if (event.altKey) {
        token = key + "2";
      } else {
        token = key;
      }

      queueMove(token, { recordHistory: true, source: "player" });
      setStatus("Applying moves", "solving");
    });

    window.addEventListener("resize", resize);
  }


  function snapGrid(value) {
    let best = GRID[0];
    let bestDist = Math.abs(value - best);
    for (let i = 1; i < GRID.length; i += 1) {
      const d = Math.abs(value - GRID[i]);
      if (d < bestDist) {
        bestDist = d;
        best = GRID[i];
      }
    }
    return best;
  }

  buildCube();
  updateSoundToggleButton();
  setPaletteSelection("U");
  hideCenterPalette();
  updateCustomCountsText();
  renderDemoMoveLog();
  bindOrbitControls();
  bindUi();
  resize();
  setMode(GAME_MODES.ACTIVE);
  setStatus("Select a mode to begin", "neutral");
  updateMoveCounter();
  requestAnimationFrame(frame);
})();
