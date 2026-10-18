import type { Coordinate } from "../models/discovery";

// Deliberately simplified continent silhouettes for an illustrated, borderless globe.
const continents: Coordinate[][] = [
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
function contains([x, y]: Coordinate, polygon: Coordinate[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
export const landDots: Coordinate[] = [];
for (let lat = -55; lat <= 80; lat += 5) {
  for (let lon = -175; lon < 180; lon += 5) {
    const point: Coordinate = [lon, lat];
    if (continents.some((continent) => contains(point, continent)))
      landDots.push(point);
  }
}
