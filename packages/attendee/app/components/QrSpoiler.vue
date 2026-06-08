<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  watch,
} from "vue";

const props = withDefaults(
  defineProps<{
    /** Density target: dots per 1000 css px². */
    density?: number;
    /** CSS color for the dots. */
    dotColor?: string;
    /** Optional solid fill behind the dots; default transparent (inherits parent bg). */
    background?: string;
    /** Pause / resume the animation. */
    active?: boolean;
    /** Dot radius in css px. Default 2 → roughly the size of a QR module at 200px. */
    dotRadius?: number;
  }>(),
  {
    density: 25,
    dotColor: "rgba(0,0,0,0.85)",
    background: "transparent",
    active: true,
    dotRadius: 2,
  },
);

const canvas = ref<HTMLCanvasElement | null>(null);

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseAlpha: number;
  phase: number;
  phaseSpeed: number;
  baseSpeed: number;
}

let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let resizeObs: ResizeObserver | null = null;
let particles: Particle[] = [];
let cssW = 0;
let cssH = 0;
let keptAlive = true;
let reducedMotion = false;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function makeParticle(): Particle {
  const angle = Math.random() * Math.PI * 2;
  const baseSpeed = 0.15 + Math.random() * 0.45;
  return {
    x: Math.random() * cssW,
    y: Math.random() * cssH,
    vx: Math.cos(angle) * baseSpeed,
    vy: Math.sin(angle) * baseSpeed,
    baseAlpha: 0.35 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: 0.02 + Math.random() * 0.05,
    baseSpeed,
  };
}

function spawn() {
  const target = Math.max(
    40,
    Math.round(((cssW * cssH) / 1000) * props.density),
  );
  particles = new Array(target).fill(0).map(makeParticle);
}

function resize() {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  cssW = rect.width;
  cssH = rect.height;
  if (cssW === 0 || cssH === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.value.width = Math.round(cssW * dpr);
  canvas.value.height = Math.round(cssH * dpr);
  ctx = canvas.value.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  spawn();
  if (reducedMotion) drawStatic();
}

function tick() {
  if (!ctx) return;
  ctx.clearRect(0, 0, cssW, cssH);
  if (props.background !== "transparent") {
    ctx.fillStyle = props.background;
    ctx.fillRect(0, 0, cssW, cssH);
  }
  ctx.fillStyle = props.dotColor;
  for (const p of particles) {
    // Random small perturbation gives a brownian feel without the dots
    // wandering far from their cell.
    if (Math.random() < 0.04) {
      const angle = Math.random() * Math.PI * 2;
      p.vx = Math.cos(angle) * p.baseSpeed;
      p.vy = Math.sin(angle) * p.baseSpeed;
    }
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x += cssW;
    else if (p.x >= cssW) p.x -= cssW;
    if (p.y < 0) p.y += cssH;
    else if (p.y >= cssH) p.y -= cssH;

    p.phase += p.phaseSpeed;
    const a = p.baseAlpha * (0.35 + 0.65 * (Math.sin(p.phase) * 0.5 + 0.5));
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, props.dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  rafId = requestAnimationFrame(tick);
}

function drawStatic() {
  if (!ctx) return;
  ctx.clearRect(0, 0, cssW, cssH);
  if (props.background !== "transparent") {
    ctx.fillStyle = props.background;
    ctx.fillRect(0, 0, cssW, cssH);
  }
  ctx.fillStyle = props.dotColor;
  for (const p of particles) {
    ctx.globalAlpha = p.baseAlpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, props.dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function start() {
  if (rafId != null || reducedMotion) return;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function onVisibility() {
  if (document.hidden) stop();
  else if (keptAlive && props.active) start();
}

let motionMql: MediaQueryList | null = null;
function onMotionChange(e: MediaQueryListEvent) {
  reducedMotion = e.matches;
  if (reducedMotion) {
    stop();
    drawStatic();
  } else if (keptAlive && props.active && !document.hidden) {
    start();
  }
}

onMounted(() => {
  motionMql = window.matchMedia(REDUCED_MOTION_QUERY);
  reducedMotion = motionMql.matches;
  motionMql.addEventListener("change", onMotionChange);

  resize();
  resizeObs = new ResizeObserver(resize);
  if (canvas.value) resizeObs.observe(canvas.value);
  document.addEventListener("visibilitychange", onVisibility);

  if (props.active && !document.hidden) start();
});

onBeforeUnmount(() => {
  stop();
  resizeObs?.disconnect();
  document.removeEventListener("visibilitychange", onVisibility);
  motionMql?.removeEventListener("change", onMotionChange);
});

onActivated(() => {
  keptAlive = true;
  if (props.active && !document.hidden) start();
});

onDeactivated(() => {
  keptAlive = false;
  stop();
});

watch(
  () => props.active,
  (v) => {
    if (v && keptAlive && !document.hidden) start();
    else stop();
  },
);
</script>

<template>
  <canvas
    ref="canvas"
    aria-hidden="true"
    class="block w-full h-full pointer-events-none"
  />
</template>
