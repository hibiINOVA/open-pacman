// maze.js
// Laberinto 28x31 fiel a la geometria del nivel 1 de Pac-Man.
// Se escribe como 31 strings de 28 chars (legible) y se parsea a numeros.
//   '#' pared(1) · '.' dot(2) · ' ' vacio transitable(0) · '-' puerta pen(3)
// Coordenadas: celda (x,y), origen arriba-izquierda. x in [0,27], y in [0,30].
// Simetrico respecto al eje vertical central (entre cols 13 y 14).

const MAZE_STR = [
  '############################', // 0  borde
  '#............##............#', // 1
  '#.####.#####.##.#####.####.#', // 2
  '#o####.#####.##.#####.####o#', // 3  power pellets cols 1 y 26
  '#.####.#####.##.#####.####.#', // 4
  '#..........................#', // 5
  '#.####.##.########.##.####.#', // 6
  '#.####.##.########.##.####.#', // 7
  '#......##....##....##......#', // 8
  '######.#####.##.#####.######', // 9
  '######.#####.##.#####.######', // 10
  '######.##..........##.######', // 11
  '######.##.###--###.##.######', // 12  puerta pen cols 13-14
  '######.##.#      #.##.######', // 13  interior pen
  '          #      #          ', // 14  tunel (extremos abiertos) + pen
  '######.##.#      #.##.######', // 15  interior pen
  '######.##.########.##.######', // 16  fondo pen
  '######.##..........##.######', // 17
  '######.#####.##.#####.######', // 18
  '######.#####.##.#####.######', // 19
  '#............##............#', // 20
  '#.####.#####.##.#####.####.#', // 21
  '#.####.#####.##.#####.####.#', // 22
  '#o..##................##..o#', // 23  power pellets cols 1 y 26, inicio Pacman (13,23)
  '###.##.##.########.##.##.###', // 24
  '###.##.##.########.##.##.###', // 25
  '#......##....##....##......#', // 26
  '#.##########.##.##########.#', // 27
  '#.##########.##.##########.#', // 28
  '#..........................#', // 29
  '############################', // 30  borde
];

function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === '-' ) return 3;
  if ( ch === 'o' || ch === 'O' ) return 4;
  return 0; // espacio = vacio transitable
}

// Matriz numerica pristina (no se muta; cada partida copia esto).
const MAZE = MAZE_STR.map( ( row ) => row.split( '' ).map( parseTile ) );

const TUNNEL_ROW = 14;
const PACMAN_START = { x: 13, y: 23 };

// Interior de la pen: filas 13-15, cols 11-16 (18 celdas transisables).
// Fondo en la fila 16 (cols 10-17) y puerta en la fila 12 (cols 13-14).
const PEN = { x0: 11, y0: 13, x1: 16, y1: 15 };

// Tile al que se dirige un fantasma que sigue dentro de la pen: la celda del
// pasillo central justo encima de la puerta.
const PEN_EXIT = { x: 14, y: 11 };

// dotLimit  = puntos globales que hay que comer para salir de la pen (0 = ya).
// insidePen = su casilla inicial cae dentro de PEN.
// corner    = destino de repliegue; en esta spec solo lo usa Clyde.
const GHOST_STARTS = [
  { kind: 'blinky', x: 13, y: 11, dotLimit: 0, insidePen: false, corner: { x: 25, y: 0 } },
  { kind: 'pinky', x: 14, y: 14, dotLimit: 0, insidePen: true, corner: { x: 2, y: 0 } },
  { kind: 'inky', x: 13, y: 14, dotLimit: 30, insidePen: true, corner: { x: 27, y: 30 } },
  { kind: 'clyde', x: 14, y: 15, dotLimit: 60, insidePen: true, corner: { x: 0, y: 30 } },
];

function inPen( x, y ) {
  return x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1;
}

// La celda de puerta (tile 3) es lo unico que enlaza la pen con el pasillo.
function isDoor( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return false;
  if ( x < 0 || x >= grid[ 0 ].length ) return false;
  return grid[ y ][ x ] === 3;
}

window.MAZE = MAZE;
window.TUNNEL_ROW = TUNNEL_ROW;
window.PACMAN_START = PACMAN_START;
window.GHOST_STARTS = GHOST_STARTS;
window.PEN = PEN;
window.PEN_EXIT = PEN_EXIT;
window.inPen = inPen;
window.isDoor = isDoor;
