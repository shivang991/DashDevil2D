import type { GameState } from "@dashdevil/simulation/state";
import { type GameConfig } from "@/lib/constants";

// Relative weights: these total 100, so they also read as percentages.
// Change these values to tune the mix; selection normalizes by their total.
const grassVariants = [
  { name: "grass", weight: 77 },
  { name: "grass-stone", weight: 15 },
  { name: "grass-flowers", weight: 5 },
  { name: "grass-hole", weight: 2 },
  { name: "grass-chalk", weight: 1 },
] as const;

type GrassTextureName = (typeof grassVariants)[number]["name"];
const grassTileSize = 64; // 32 native pixels, displayed at 2×.
const totalGrassVariantWeight = grassVariants.reduce(
  (sum, variant) => sum + variant.weight,
  0,
);

function pickGrassVariant(random: number): GrassTextureName {
  let remaining = random * totalGrassVariantWeight;
  for (const variant of grassVariants) {
    remaining -= variant.weight;
    if (remaining < 0) return variant.name;
  }
  return grassVariants[grassVariants.length - 1].name;
}

// Hash world coordinates, including negative rows entering from above.
// No per-frame randomness or growing cache: a tile stays fixed for the run.
function grassVariantAt(column: number, row: number, seed: number) {
  let hash = seed ^ Math.imul(column, 0x9e3779b1) ^ Math.imul(row, 0x85ebca77);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  hash ^= hash >>> 16;
  return pickGrassVariant((hash >>> 0) / 0x100000000);
}

function grassRowsInView(offset: number, height: number) {
  return {
    first: Math.floor(-offset / grassTileSize),
    last: Math.ceil((height - offset) / grassTileSize) - 1,
  };
}

// These PNGs are the editable source of truth. Save over a file and refresh.
const textureNames = [
  "asphalt",
  "car",
  "coin",
  "barrier",
  "road-edge",
  "lane-divider",
  ...grassVariants.map((v) => v.name),
] as const;
type TextureName = (typeof textureNames)[number];
const textureImages = new Map<TextureName, HTMLImageElement>();

if (typeof Image !== "undefined") {
  for (const name of textureNames) {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}textures/${name}.png`;
    textureImages.set(name, image);
  }
}

function getTexture(name: TextureName) {
  const image = textureImages.get(name);
  return image?.complete && image.naturalWidth > 0 ? image : undefined;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: TextureName,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const image = getTexture(name);
  if (!image) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
  return true;
}

const texturePatterns = new WeakMap<
  CanvasRenderingContext2D,
  Map<TextureName, CanvasPattern>
>();

function drawGrassTiles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number,
  seed: number,
) {
  const rows = grassRowsInView(offset, height);
  const columns = Math.ceil(width / grassTileSize);
  const plain = getTexture("grass");
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (let row = rows.first; row <= rows.last; row++) {
    const y = Math.floor(row * grassTileSize + offset);
    for (let column = 0; column < columns; column++) {
      const image = getTexture(grassVariantAt(column, row, seed)) ?? plain;
      if (image) {
        ctx.drawImage(
          image,
          column * grassTileSize,
          y,
          grassTileSize,
          grassTileSize,
        );
      }
    }
  }
  ctx.restore();
}

function drawTiledTexture(
  ctx: CanvasRenderingContext2D,
  name: "asphalt" | "grass" | "road-edge" | "lane-divider",
  x: number,
  width: number,
  height: number,
  offset: number,
  scale = 2,
) {
  const image = getTexture(name);
  if (!image) return;
  let cache = texturePatterns.get(ctx);
  if (!cache) {
    cache = new Map();
    texturePatterns.set(ctx, cache);
  }
  let pattern = cache.get(name);
  if (!pattern) {
    const created = ctx.createPattern(image, "repeat");
    if (!created) return;
    pattern = created;
    cache.set(name, pattern);
  }
  const scroll = Math.floor(offset % (image.height * scale));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, scroll);
  ctx.scale(scale, scale);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, -scroll / scale, width / scale, height / scale);
  ctx.restore();
}

// ── module boundry below ──

export function drawRoad(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  config: GameConfig,
  width: number,
  height: number,
) {
  const roadWidth = width * state.roadWidthRatio;
  const roadLeft = (width - roadWidth) / 2;

  // Grass
  ctx.fillStyle = "#2d5a27";
  ctx.fillRect(0, 0, width, height);

  drawGrassTiles(ctx, width, height, state.roadOffset, state.grassSeed);

  // Road surface
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(roadLeft, 0, roadWidth, height);
  drawTiledTexture(
    ctx,
    "asphalt",
    roadLeft,
    roadWidth,
    height,
    state.roadOffset,
  );

  // Selected variant #5 tiles: weathered edges and double yellow dividers.
  // Keep the edges inside the road so they remain visible on narrow screens.
  const edgeWidth = 8;
  for (const x of [roadLeft, roadLeft + roadWidth - edgeWidth]) {
    drawTiledTexture(ctx, "road-edge", Math.round(x), edgeWidth, height, state.roadOffset, 1);
  }

  const laneWidth = roadWidth / config.laneCount;
  const dividerWidth = 16;
  for (let i = 1; i < config.laneCount; i++) {
    const x = Math.round(roadLeft + laneWidth * i - dividerWidth / 2);
    drawTiledTexture(ctx, "lane-divider", x, dividerWidth, height, state.roadOffset, 1);
  }
}

export function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  state: GameState,
  config: GameConfig,
) {
  const centerY = state.carY + config.carHeight / 2;

  ctx.save();
  ctx.translate(cx, centerY);
  ctx.rotate(state.carTilt);

  if (
    drawSprite(
      ctx,
      "car",
      -config.carWidth / 2,
      -config.carHeight / 2,
      config.carWidth,
      config.carHeight,
    )
  ) {
    ctx.restore();
    return;
  }

  // Fallback while the editable texture loads.
  ctx.fillStyle = "#2196f3";
  ctx.fillRect(
    -config.carWidth / 2,
    -config.carHeight / 2,
    config.carWidth,
    config.carHeight,
  );

  ctx.restore();
}

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  coinX: number,
  coinY: number,
  size: number,
) {
  if (drawSprite(ctx, "coin", coinX - size / 2, coinY, size, size)) return;

  // Fallback while the editable texture loads.
  const radius = size / 2;
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(coinX, coinY + radius, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawObstacle(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
) {
  if (drawSprite(ctx, "barrier", ox - ow / 2, oy, ow, oh)) return;

  // Fallback while the editable texture loads.
  ctx.fillStyle = "#e53935";
  ctx.fillRect(ox - ow / 2, oy, ow, oh);
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  width: number,
  height: number,
) {
  ctx.fillStyle = `rgba(0, 0, 0, ${state.gameOverFadeAlpha})`;
  ctx.fillRect(0, 0, width, height);
}
