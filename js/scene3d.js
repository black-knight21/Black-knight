// scene3d.js — Three.js arena scene
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ─── Helpers ───────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV3 = (v, tx, ty, tz, t) => {
  v.x = lerp(v.x, tx, t);
  v.y = lerp(v.y, ty, t);
  v.z = lerp(v.z, tz, t);
};

export function createArenaScene(canvas, { onProgress, onReady, onImpact }) {
  // ─── Renderer ──────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.0 : 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x000000, 1);

  // ─── Scene & camera ────────────────────────
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 1.85, 5.6);
  camera.lookAt(0, 1.25, 0);

  // Camera target state
  const camLookCurrent = new THREE.Vector3(0, 1.25, 0);

  // ─── Lighting ──────────────────────────────
  const hemi = new THREE.HemisphereLight(0x2e2948, 0x09090d, 0.85);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xe2e8ff, 2.2);
  moon.position.set(4.5, 9.5, 5.5);
  scene.add(moon);

  // Gold rim → Ivory side (static)
  const goldRim = new THREE.SpotLight(0xd4af37, 6.5);
  goldRim.position.set(3.8, 5.2, 2.8);
  const goldRimTarget = new THREE.Object3D();
  goldRimTarget.position.set(1.6, 1.0, 0.1);
  scene.add(goldRimTarget);
  goldRim.target = goldRimTarget;
  scene.add(goldRim);
  goldRimTarget.updateMatrixWorld();

  // Violet rim → Obsidian (dynamic)
  const violetRim = new THREE.SpotLight(0xb060ff, 0);
  violetRim.position.set(-3.8, 5.2, 2.8);
  const violetRimTarget = new THREE.Object3D();
  scene.add(violetRimTarget);
  violetRim.target = violetRimTarget;
  scene.add(violetRim);

  // Ivory white fill (dynamic, tracks ivory)
  const ivoryFill = new THREE.PointLight(0xddeeff, 7, 15, 1);
  scene.add(ivoryFill);

  // Obsidian purple fill (dynamic)
  const obsFill = new THREE.PointLight(0xb060ff, 0, 18, 1);
  scene.add(obsFill);

  // Skills aura
  const skillsAura = new THREE.PointLight(0xf4f4f6, 0, 12, 1);
  skillsAura.position.set(0, 2.5, 1);
  scene.add(skillsAura);

  // Grace beacon
  const graceBeacon = new THREE.PointLight(0xd4af37, 1.8, 20, 1);
  graceBeacon.position.set(0, 1.5, 0);
  scene.add(graceBeacon);

  // ─── Ember particles ───────────────────────
  const EMBER_COUNT = 180;
  const emberPositions = new Float32Array(EMBER_COUNT * 3);
  const emberPhases = new Float32Array(EMBER_COUNT);
  for (let i = 0; i < EMBER_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 8 + 1;
    emberPositions[i * 3]     = Math.cos(angle) * radius;
    emberPositions[i * 3 + 1] = Math.random() * 3;
    emberPositions[i * 3 + 2] = Math.sin(angle) * radius;
    emberPhases[i] = Math.random() * Math.PI * 2;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({ color: 0xf4a030, size: 0.055, transparent: true, opacity: 0.65 });
  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);

  // ─── State ─────────────────────────────────
  const state = {
    section: "hero",
    mode: "active", // active | eco | paused
    pointer: { x: 0, y: 0 },
    clashTimer: 0,
    frame: 0,
    _eu: new THREE.Euler(), // scratch Euler — reused
    obsidianAlpha: 0,
    ivoryPivot: null,
    obsPivot: null,
  };

  // Target positions per section
  const IVORY_X = { hero: 0, lore: 1.65, projects: 2.0, skills: 1.2, contact: 1.35 };
  const OBS_X   = { hero: 0, lore: -1.65, projects: -2.0, skills: -2.0, contact: -1.35 };
  const CAM = {
    hero:     { pos: [0, 1.85, 5.6],  look: [0, 1.25, 0] },
    lore:     { pos: [0, 1.70, 6.0],  look: [0, 1.25, 0] },
    projects: { pos: [0, 1.05, 6.6],  look: [0, 1.45, 0] },
    skills:   { pos: [-1.0, 1.55, 5.0], look: [0.4, 1.35, 0] },
    contact:  { pos: [0, 1.75, 5.0],  look: [0, 0.85, 0] },
  };
  const VIOLET_I = { hero: 0, lore: 5, projects: 13, skills: 9, contact: 6 };
  const OBS_FILL_I = { hero: 0, lore: 4.5, projects: 9.5, skills: 7, contact: 4.5 };
  const IVORY_FILL_I = { hero: 7, lore: 2.5, projects: 2.5, skills: 2.5, contact: 2.5 };

  // ─── Material fix ──────────────────────────
  function upgradeMaterials(root, collectMeshes) {
    root.traverse((child) => {
      if (!child.isMesh) return;
      const mat = child.material;
      if (mat && mat.isMeshBasicMaterial) {
        const std = new THREE.MeshStandardMaterial({
          color:         mat.color,
          map:           mat.map       || null,
          alphaMap:      mat.alphaMap  || null,
          transparent:   mat.transparent,
          opacity:       mat.opacity,
          side:          mat.side,
          alphaTest:     mat.alphaTest,
          vertexColors:  mat.vertexColors,
          roughness:     0.6,
          metalness:     0.3,
        });
        mat.dispose();
        child.material = std;
      }
      child.castShadow = false;
      child.receiveShadow = false;
      if (collectMeshes) collectMeshes.push(child);
    });
  }

  // ─── Load models ───────────────────────────
  const isGitHubPages = location.hostname.endsWith("github.io");
  const modelBase = isGitHubPages
    ? "https://media.githubusercontent.com/media/black-knight21/Black-knight/main/"
    : "./";

  const loader = new GLTFLoader();
  let loadedCount = 0;
  const totalAssets = 2;
  const obsMeshes = [];

  function onLoad() {
    loadedCount++;
    onProgress(loadedCount / totalAssets);
    if (loadedCount === totalAssets) onReady();
  }

  // Ivory Oathkeeper
  const ivoryPivot = new THREE.Object3D();
  ivoryPivot.position.set(0, 0, 0);
  scene.add(ivoryPivot);
  state.ivoryPivot = ivoryPivot;

  loader.load(
    modelBase + "aurencast__the_ivory_oathkeeper.glb",
    (gltf) => {
      upgradeMaterials(gltf.scene);
      gltf.scene.position.set(0, 0, 0);
      ivoryPivot.add(gltf.scene);
      onLoad();
    },
    (xhr) => onProgress(xhr.total ? (xhr.loaded / xhr.total) * 0.5 : 0),
    (err) => console.error("Ivory load error:", err)
  );

  // Obsidian Oathbreaker
  const obsPivot = new THREE.Object3D();
  obsPivot.position.set(0, 0, 0);
  obsPivot.visible = false;
  scene.add(obsPivot);
  state.obsPivot = obsPivot;

  loader.load(
    modelBase + "varkhen__the_obsidian_oathbreaker.glb",
    (gltf) => {
      upgradeMaterials(gltf.scene, obsMeshes);
      gltf.scene.position.set(0, 0, 0);
      obsPivot.add(gltf.scene);
      onLoad();
    },
    (xhr) => onProgress(xhr.total ? 0.5 + (xhr.loaded / xhr.total) * 0.5 : 0.5),
    (err) => console.error("Obsidian load error:", err)
  );

  // ─── Animate ───────────────────────────────
  let lastTime = performance.now();
  let animId = null;

  function animate(now) {
    animId = requestAnimationFrame(animate);
    if (state.mode === "paused") return;

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    state.frame++;
    const f = state.frame;

    const sec = state.section;
    const camCfg = CAM[sec] || CAM.hero;

    // ── Camera lerp (pull back slightly on portrait mobile so both knights fit) ──
    const isPortrait = camera.aspect < 1;
    const zScale = isPortrait ? Math.min(1.45, 0.9 / Math.max(camera.aspect, 0.45)) : 1;
    const xScale = isPortrait ? 0.65 : 1;
    const camT = 1 - Math.exp(-2.4 * dt);
    const px = state.pointer.x * 0.12;
    const py = state.pointer.y * 0.07;
    lerpV3(camera.position, camCfg.pos[0] * xScale + px, camCfg.pos[1] + py, camCfg.pos[2] * zScale, camT);
    lerpV3(camLookCurrent, camCfg.look[0] * xScale, camCfg.look[1], camCfg.look[2], camT);
    camera.lookAt(camLookCurrent);

    // ── Clash animation ──
    let ivoryXTarget = (IVORY_X[sec] ?? 0) * xScale;
    let obsXTarget   = (OBS_X[sec] ?? 0) * xScale;

    if (state.clashTimer > 0) {
      state.clashTimer -= dt;
      const surge = Math.sin((1 - state.clashTimer / 1.1) * Math.PI);
      ivoryXTarget  =  lerp(ivoryXTarget,  0.6, surge);
      obsXTarget    = lerp(obsXTarget, -0.6, surge);
    }

    // ── Obsidian alpha ──
    const obsWant = sec === "hero" ? 0 : 1;
    state.obsidianAlpha = lerp(state.obsidianAlpha, obsWant, 1 - Math.exp(-4.5 * dt));
    if (state.obsidianAlpha > 0.005) {
      obsPivot.visible = true;
    } else {
      obsPivot.visible = false;
    }

    // ── Knight positions ──
    const kT = 1 - Math.exp(-2.0 * dt);
    ivoryPivot.position.x = lerp(ivoryPivot.position.x, ivoryXTarget, kT);
    obsPivot.position.x   = lerp(obsPivot.position.x, obsXTarget, kT);

    // Obsidian opacity via cached mesh list (disable transparent once opaque for early-Z speed)
    if (obsPivot.visible) {
      const isFading = state.obsidianAlpha < 0.99;
      for (let i = 0; i < obsMeshes.length; i++) {
        const mat = obsMeshes[i].material;
        if (mat) {
          mat.transparent = isFading;
          mat.opacity = isFading ? state.obsidianAlpha : 1;
        }
      }
    }

    // Obsidian aggressive animation (bob+twitch on projects)
    const t = now * 0.001;
    if (sec === "projects") {
      obsPivot.position.y = lerp(obsPivot.position.y, Math.sin(t * 2.6) * 0.06, kT);
      state._eu.set(0, Math.sin(t * 3.1) * 0.05, 0);
      obsPivot.rotation.copy(state._eu);
    } else {
      obsPivot.position.y = lerp(obsPivot.position.y, 0, kT);
      state._eu.set(0, 0, 0);
      obsPivot.rotation.copy(state._eu);
    }

    // Ivory gentle sway
    state._eu.set(0, Math.sin(t * 0.8) * 0.025, 0);
    ivoryPivot.rotation.copy(state._eu);

    // Contact: face inward
    if (sec === "contact") {
      ivoryPivot.rotation.y = lerp(ivoryPivot.rotation.y, -0.4, kT);
      obsPivot.rotation.y   = lerp(obsPivot.rotation.y, 0.4, kT);
    }

    // ── Atmosphere & lighting — every 2nd frame ──
    if (f % 2 === 0) {
      const lt = 1 - Math.exp(-2.0 * dt * 2);

      violetRim.intensity = lerp(violetRim.intensity, VIOLET_I[sec] ?? 0, lt);
      ivoryFill.intensity  = lerp(ivoryFill.intensity, IVORY_FILL_I[sec] ?? 2.5, lt);
      obsFill.intensity    = lerp(obsFill.intensity, OBS_FILL_I[sec] ?? 0, lt);

      // Skills aura
      const skillsWant = sec === "skills" ? 4.0 : 0;
      skillsAura.intensity = lerp(skillsAura.intensity, skillsWant, lt);

      // Grace beacon
      const beaconWant = sec === "contact" ? 4.5 : 1.8;
      graceBeacon.intensity = lerp(graceBeacon.intensity, beaconWant, lt);

      // Violet rim tracks obsidian
      violetRimTarget.position.copy(obsPivot.position);
      violetRimTarget.position.y += 1.4;
      violetRimTarget.updateMatrixWorld();

      // Ivory fill tracks ivory
      ivoryFill.position.set(
        ivoryPivot.position.x + 0.4,
        2.8,
        ivoryPivot.position.z + 2.8
      );
      // Obsidian fill tracks obs
      obsFill.position.set(
        obsPivot.position.x + 0.3,
        2.5,
        obsPivot.position.z + 2.8
      );
    }

    // Embers
    if (state.mode !== "eco" || f % 3 === 0) {
      const pos = emberGeo.attributes.position;
      for (let i = 0; i < EMBER_COUNT; i++) {
        pos.array[i * 3 + 1] += dt * (0.3 + Math.sin(emberPhases[i] + t) * 0.1);
        pos.array[i * 3]     += Math.sin(t + emberPhases[i] * 1.3) * dt * 0.08;
        if (pos.array[i * 3 + 1] > 4.5) {
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * 8 + 1;
          pos.array[i * 3]     = Math.cos(angle) * radius;
          pos.array[i * 3 + 1] = -0.2;
          pos.array[i * 3 + 2] = Math.sin(angle) * radius;
        }
      }
      pos.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  animate(performance.now());

  // ── Resize ──
  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.0 : 1.25));
    renderer.setSize(innerWidth, innerHeight);
  }
  window.addEventListener("resize", onResize);

  // ── Pointer ──
  window.addEventListener("pointermove", (e) => {
    state.pointer.x = (e.clientX / innerWidth - 0.5) * 2;
    state.pointer.y = -(e.clientY / innerHeight - 0.5) * 2;
  });

  // ─── Public API ────────────────────────────
  const prevSection = { val: "hero" };

  function setSection(name) {
    const prev = prevSection.val;
    prevSection.val = name;
    state.section = name;

    // Trigger clash if crossing hero/lore ↔ projects
    const prevIsBeforeWorks = prev === "hero" || prev === "lore";
    const nowIsProjects = name === "projects";
    const prevIsProjects = prev === "projects";
    const nowIsBeforeWorks = name === "hero" || name === "lore";

    if ((prevIsBeforeWorks && nowIsProjects) || (prevIsProjects && nowIsBeforeWorks)) {
      state.clashTimer = 1.1;
      onImpact?.();
    }
  }

  function triggerPulse() {}

  function getMode() { return state.mode; }

  function cycleMode() {
    const modes = ["active", "eco", "paused"];
    const prevMode = state.mode;
    const idx = modes.indexOf(prevMode);
    state.mode = modes[(idx + 1) % modes.length];
    if (state.mode === "paused") {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (prevMode === "paused") {
      lastTime = performance.now();
      animate(lastTime);
    }
    return state.mode;
  }

  function dispose() {
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
  }

  return { setSection, triggerPulse, getMode, cycleMode, dispose };
}
