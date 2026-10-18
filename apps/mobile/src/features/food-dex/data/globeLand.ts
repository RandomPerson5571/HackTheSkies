import { atlasCuisines, cuisineAnchors } from "../models/discovery";

// Deliberately simplified continent silhouettes for an illustrated, borderless globe.
const continents: [number, number][][] = [
  [
    [-168, 70],
    [-138, 70],
    [-124, 60],
    [-96, 72],
    [-60, 58],
    [-55, 48],
    [-81, 25],
    [-87, 20],
    [-80, 9],
    [-96, 16],
    [-117, 32],
    [-130, 51],
    [-168, 62],
  ],
  [
    [-73, 59],
    [-48, 60],
    [-22, 79],
    [-48, 84],
    [-64, 76],
  ],
  [
    [-81, 12],
    [-66, 10],
    [-51, 1],
    [-35, -6],
    [-43, -23],
    [-54, -35],
    [-68, -55],
    [-75, -41],
    [-80, -12],
  ],
  [
    [-17, 35],
    [10, 37],
    [34, 31],
    [44, 12],
    [51, 11],
    [42, -12],
    [32, -29],
    [18, -35],
    [11, -19],
    [8, 3],
    [-14, 7],
  ],
  [
    [-10, 36],
    [-10, 44],
    [4, 50],
    [10, 57],
    [5, 70],
    [30, 71],
    [43, 60],
    [65, 72],
    [110, 77],
    [150, 65],
    [177, 65],
    [150, 49],
    [141, 37],
    [121, 24],
    [109, 19],
    [109, 7],
    [100, 2],
    [93, 20],
    [80, 7],
    [68, 24],
    [51, 25],
    [43, 12],
    [35, 30],
    [23, 36],
    [15, 45],
    [6, 43],
  ],
  [
    [112, -22],
    [130, -12],
    [143, -12],
    [153, -28],
    [145, -39],
    [130, -33],
    [115, -35],
  ],
  [
    [129, -3],
    [141, -3],
    [151, -8],
    [144, -11],
  ],
  [
    [95, 5],
    [106, -7],
    [117, -9],
    [109, -1],
  ],
  [
    [47, -13],
    [50, -17],
    [46, -26],
    [43, -23],
  ],
  [
    [130, 32],
    [142, 46],
    [146, 43],
    [139, 33],
  ],
  [
    [166, -34],
    [179, -38],
    [170, -47],
    [165, -45],
  ],
  [
    [-10, 50],
    [1, 51],
    [-3, 59],
    [-8, 58],
  ],
];

function contains([x, y]: [number, number], polygon: [number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

// Deterministic jitter so the dot matrix reads organic instead of scanned.
function pseudoRandom(seed: number, range: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 4294967296 - 0.5) * range;
  };
}

// Cuisine anchors share one lighting radius; precompute which regions a dot
// stands in so lit dots are an O(1) bitmask lookup at render time.
function regionBits(lon: number, lat: number) {
  let bits = 0;
  atlasCuisines.forEach((cuisine, index) => {
    const anchor = cuisineAnchors[cuisine];
    if (!anchor) return;
    const dx =
      (((lon - anchor[0] + 540) % 360) - 180) * Math.cos(radians(anchor[1]));
    const dy = lat - anchor[1];
    if (dx * dx + dy * dy < 150) bits |= 1 << index;
  });
  return bits;
}

export type SphereDot = {
  key: number;
  latCos: number;
  latSin: number;
  lonSin: number;
  lonCos: number;
  // Bitmask over atlasCuisines order of the cuisine regions this dot stands in.
  region: number;
  jx: number;
  jy: number;
};

function sphereDot(key: number, lon: number, lat: number, region: number, spread: number, rand: () => number): SphereDot {
  const latRad = radians(lat);
  const lonRad = radians(lon);
  return {
    key,
    latCos: Math.cos(latRad),
    latSin: Math.sin(latRad),
    lonSin: Math.sin(lonRad),
    lonCos: Math.cos(lonRad),
    region,
    jx: rand() * spread,
    jy: rand() * spread,
  };
}

const landRand = pseudoRandom(20_260_118, 2);
export const landDots: SphereDot[] = [];
let landKey = 0;
for (let lat = -55; lat <= 80; lat += 3.2) {
  // Stretch the longitude step toward the poles so dot spacing stays even.
  const step = 3.2 / Math.max(0.28, Math.cos(radians(lat)));
  for (let lon = -175; lon < 180; lon += step) {
    let inland = false;
    for (const continent of continents) {
      if (contains([lon, lat], continent)) {
        inland = true;
        break;
      }
    }
    if (!inland) continue;
    landDots.push(
      sphereDot(landKey++, lon, lat, regionBits(lon, lat), 1, landRand),
    );
  }
}

const gridRand = pseudoRandom(777, 0.7);
export const gridDots: SphereDot[] = [];
let gridKey = 0;
// Meridians every 30 degrees, sampled every 10 degrees of latitude.
for (let lon = -180; lon < 180; lon += 30) {
  for (let lat = -80; lat <= 80; lat += 10) {
    gridDots.push(sphereDot(gridKey++, lon, lat, 0, 0.8, gridRand));
  }
}
// Parallels every 30 degrees, sampled every 6 degrees of longitude.
for (let lat = -60; lat <= 60; lat += 30) {
  for (let lon = -180; lon < 180; lon += 6) {
    gridDots.push(sphereDot(gridKey++, lon, lat, 0, 0.8, gridRand));
  }
}

// Twinkling backdrop stars around the globe (percent coordinates of the sky card).
export type SkyStar = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  delay: number;
  twinkle: boolean;
};
const starRand = pseudoRandom(9_101, 1);
export const skyStars: SkyStar[] = Array.from({ length: 46 }, () => {
  const size = 1 + (starRand() > 0.4 ? 1 : 0) + (starRand() > 0.85 ? 1 : 0);
  return {
    x: 4 + starRand() * 92,
    y: 2 + starRand() * 96,
    size,
    alpha: 0.16 + starRand() * 0.32,
    delay: (starRand() * 2100 + 1050) | 0,
    twinkle: size > 1 && starRand() > 0.45,
  };
});

export const TILT = {
  sin: Math.sin(radians(15)),
  cos: Math.cos(radians(15)),
};
