// ghosts.js
// IA de los fantasmas: un tile objetivo por personalidad y la direccion que mas
// lo acerca. Depende de globals de maze.js (inPen, isDoor, PEN_EXIT) y de
// game.js (DIRS, canMove).

const DEBUG_AI = false;

const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PINKY_AHEAD = 4;      // celdas por delante de Pacman que apunta Pinky
const INKY_AHEAD = 2;       // largo del vector pivote de Inky
const CLYDE_FEAR_TILES = 8; // distancia Manhattan a partir de la cual Clyde huye

function tileOf( a ) {
  return { x: Math.round( a.x ), y: Math.round( a.y ) };
}

// Tile situado n celdas por delante del actor segun su direccion actual.
function aheadTile( a, n ) {
  const d = DIRS[ a.dir ];
  return { x: Math.round( a.x ) + d.x * n, y: Math.round( a.y ) + d.y * n };
}

function manhattan( a, b ) {
  return Math.abs( a.x - b.x ) + Math.abs( a.y - b.y );
}

// Blinky: el tile que ocupa Pacman.
function targetBlinky( game ) {
  return tileOf( game.pacman );
}

// Pinky: 4 celdas por delante de Pacman, para cortarle el paso.
function targetPinky( game ) {
  return aheadTile( game.pacman, PINKY_AHEAD );
}

// Inky: el pivote (2 celdas por delante de Pacman) reflejado respecto a Blinky.
function targetInky( game ) {
  const pivot = aheadTile( game.pacman, INKY_AHEAD );
  const blinky = game.ghosts.find( ( g ) => g.kind === 'blinky' );
  const b = tileOf( blinky );
  return { x: pivot.x + ( pivot.x - b.x ), y: pivot.y + ( pivot.y - b.y ) };
}

// Clyde: persigue mientras esta lejos y se repliega a su esquina si se acerca.
function targetClyde( game, g ) {
  const p = tileOf( game.pacman );
  if ( manhattan( tileOf( g ), p ) > CLYDE_FEAR_TILES ) return p;
  return g.corner;
}

// Tile objetivo de un fantasma. Mientras siga en el area de la pen (interior o
// puerta) el objetivo es la salida; la personalidad solo manda cuando ya esta en
// el pasillo. Sin esto, un fantasma liberado parado en la puerta recuperar su
// personalidad y podria ser empujado de vuelta hacia la pen.
function ghostTarget( game, g ) {
  if ( g.mode === 'eaten' ) return PEN_EXIT;
  if ( g.insidePen || inPen( g.x, g.y ) || isDoor( game.grid, g.x, g.y ) ) return PEN_EXIT;
  if ( g.kind === 'pinky' ) return targetPinky( game );
  if ( g.kind === 'inky' ) return targetInky( game );
  if ( g.kind === 'clyde' ) return targetClyde( game, g );
  return targetBlinky( game );
}

function debugGhost( g, target ) {
  if ( ! DEBUG_AI ) return;
  console.log(
    '[AI] ' + g.kind,
    'pos(' + g.x + ',' + g.y + ')',
    'target(' + target.x + ',' + target.y + ')',
    'dir=' + g.dir
  );
}

// Elige la direccion legal que mas acerca al tile objetivo (euclidea al
// cuadrado, sin raiz). No da media vuelta salvo en callejon sin salida.
function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost', g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  if ( g.mode === 'frightened' ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    debugGhost( g, { x: -1, y: -1 } );
    return;
  }

  const target = ghostTarget( game, g );

  let best = choices[ 0 ];
  let bestD2 = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dx = g.x + d.x - target.x;
    const dy = g.y + d.y - target.y;
    const d2 = dx * dx + dy * dy;
    if ( d2 < bestD2 ) {
      bestD2 = d2;
      best = dir;
    }
  }

  g.dir = best;
  debugGhost( g, target );
}

window.PINKY_AHEAD = PINKY_AHEAD;
window.INKY_AHEAD = INKY_AHEAD;
window.CLYDE_FEAR_TILES = CLYDE_FEAR_TILES;
window.ghostTarget = ghostTarget;
window.decideGhost = decideGhost;
