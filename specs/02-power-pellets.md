# SPEC 02 — Power Pellets y fantasmas asustados (comibles)

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-05
> **Objetivo:** Añadir Power Pellets en las cuatro esquinas del laberinto que activan el modo asustado en los fantasmas, permitiendo a Pac-Man comerlos para ganar puntos escalonados y enviándolos de regreso a la pen en forma de ojos para regenerarse.

---

## Scope

**In:**

- Cuatro **Power Pellets** (energizadores) en las posiciones clásicas del laberinto: `(1, 3)`, `(26, 3)`, `(1, 23)` y `(26, 23)`.
- Representación en el laberinto como un nuevo tipo de celda (`tile === 4` / `'o'`).
- Renderizado de los Power Pellets: círculos de mayor radio que los dots comunes y con efecto de parpadeo/pulsación continua.
- Puntuación: comer un Power Pellet otorga **50 puntos** y reduce el contador de `dotsRemaining` (necesario para ganar).
- **Modo Asustado (`frightened`)**:
  - Al comer un Power Pellet se activa un temporizador global de `420` frames (~7 segundos a 60 FPS).
  - Los fantasmas que están en modo normal invierten su dirección de movimiento inmediatamente (giro 180°).
  - La velocidad de los fantasmas asustados se reduce a la mitad (`GHOST_FRIGHTENED_SPEED = 0.05`).
  - IA de fantasmas asustados: en cada cruce eligen una dirección transitable aleatoria entre las legales (sin retroceso).
  - Visual: los fantasmas asustados se dibujan de color azul con ojos y boca asustados. Durante los últimos ~2 segundos (`120` frames) parpadean alternando con color blanco para avisar al jugador.
  - Al agotarse el temporizador, los fantasmas que siguen asustados vuelven a su modo `normal`, recuperando su color, velocidad e IA clásica.
  - Si Pac-Man come otro Power Pellet mientras el modo asustado está activo, el temporizador se reinicia a 420 frames y la cadena de puntaje de fantasmas se reinicia al valor base.
- **Comer Fantasmas**:
  - Al colisionar Pac-Man con un fantasma asustado, Pac-Man come al fantasma (no pierde vidas).
  - Puntuación escalonada por fantasma comido dentro de un mismo ciclo de Power Pellet:
    - 1.º fantasma: 200 puntos.
    - 2.º fantasma: 400 puntos.
    - 3.º fantasma: 800 puntos.
    - 4.º fantasma: 1600 puntos.
  - Estado `eaten` (ojos):
    - El fantasma comido pasa al estado `mode = 'eaten'`.
    - Solo se dibujan sus ojos orientados en la dirección de su movimiento.
    - Velocidad incrementada de regreso a la pen (`GHOST_EATEN_SPEED = 0.2`).
    - Su IA apunta como objetivo a `PEN_EXIT` (14, 11) / interior de la pen.
    - Las colisiones entre Pac-Man y fantasmas en estado `eaten` son inocuas para ambos.
    - Al alcanzar la pen (`insidePen` o proximidad a `PEN_EXIT`/interior), el fantasma recupera su cuerpo y estado `normal`.

**Out of scope (for future specs):**

- Pausa corta de congelación de pantalla (freeze frame de ~1 segundo) al comer un fantasma.
- Texto flotante momentáneo con el valor numérico (200, 400, etc.) en el lugar donde fue comido.
- Frutas o ítems de bonificación en el centro.
- Efectos de sonido y música.
- Niveles progresivos con duración reducida de Power Pellets.

---

## Data model

### `src/js/maze.js` — Tipo de tile y posiciones en el mapa

Se actualiza `MAZE_STR` para ubicar `'o'` en las 4 esquinas clásicas:
- Fila 3: columna 1 y columna 26.
- Fila 23: columna 1 y columna 26.

```js
function parseTile( ch ) {
  if ( ch === '#' ) return 1; // pared
  if ( ch === '.' ) return 2; // dot común
  if ( ch === '-' ) return 3; // puerta pen
  if ( ch === 'o' || ch === 'O' ) return 4; // power pellet
  return 0; // vacío transitable
}
```

### `src/js/game.js` — Constantes y estado de juego

```js
const PACMAN_SPEED = 0.125;
const GHOST_SPEED = 0.1;
const GHOST_FRIGHTENED_SPEED = 0.05;
const GHOST_EATEN_SPEED = 0.2;
const FRIGHTENED_DURATION = 420;     // 7 segundos a 60 fps
const FRIGHTENED_FLASH_START = 120;  // 2 segundos restantes para parpadear
const GHOST_SCORES = [ 200, 400, 800, 1600 ];
```

Estado extendido en `createGame`:

```js
return {
  state: 'start',
  score: 0,
  lives: 3,
  dotsRemaining: dots,      // Incluye dots normales y power pellets
  dotsEaten: 0,
  frightenedTimer: 0,       // NUEVO: temporizador global de modo asustado
  ghostsEatenInChain: 0,    // NUEVO: contador de fantasmas comidos en la racha actual
  grid,
  pacman: { /* ... */ },
  ghosts: GHOST_STARTS.map( ( g ) => ( {
    x: g.x,
    y: g.y,
    dir: 'up',
    speed: GHOST_SPEED,
    kind: g.kind,
    dotLimit: g.dotLimit,
    corner: g.corner,
    insidePen: g.insidePen,
    mode: 'normal',         // NUEVO: 'normal' | 'frightened' | 'eaten'
  } ) ),
};
```

---

## Implementation plan

1. **`maze.js` & `render.js`: Power Pellets en el laberinto y renderizado.**
   - Modificar `MAZE_STR` en `src/js/maze.js` añadiendo `'o'` en `(1, 3)`, `(26, 3)`, `(1, 23)` y `(26, 23)`.
   - Modificar `parseTile` para mapear `'o'` / `'O'` a tile tipo `4`.
   - Modificar `drawDots` en `src/js/render.js` para dibujar el tile `4` con mayor tamaño (radio ~5.5px) y efecto de parpadeo/pulsación según el `frame`.
   *Prueba manual:* Abrir `src/index.html`; verificar que en las 4 esquinas aparecen las bolas grandes parpadeantes.

2. **`game.js`: Consumo de Power Pellets y activación de modo asustado.**
   - En `createGame`, inicializar `frightenedTimer: 0` y `ghostsEatenInChain: 0`, y añadir `mode: 'normal'` a cada fantasma.
   - En `movePacman`, detectar consumo de tile `4`: sumar 50 puntos, decrementar `dotsRemaining`, incrementar `dotsEaten`, activar `game.frightenedTimer = FRIGHTENED_DURATION`, resetear `game.ghostsEatenInChain = 0`, y cambiar a `mode = 'frightened'` e invertir dirección (`OPPOSITE`) en todos los fantasmas que no estén en `eaten` ni dentro de la pen.
   - En `update`, decrementar `frightenedTimer` cada frame. Cuando llegue a 0, devolver los fantasmas con `mode === 'frightened'` a `mode = 'normal'`.
   *Prueba manual:* Comer un Power Pellet suma 50 puntos y activa `frightenedTimer`.

3. **`ghosts.js` & `render.js`: IA y renderizado de fantasmas asustados.**
   - En `ghosts.js`: en `decideGhost`, si `g.mode === 'frightened'`, elegir una dirección legal al azar (entre las no opuestas a `g.dir`).
   - En `game.js`: asignar `g.speed = GHOST_FRIGHTENED_SPEED` cuando `g.mode === 'frightened'`.
   - En `render.js`: modificar `drawGhost` para que si `g.mode === 'frightened'`, dibuje el cuerpo en azul `#2121ff` (o alternando blanco/azul si `game.frightenedTimer <= FRIGHTENED_FLASH_START` y `frame % 16 < 8`) con ojos asustados.
   *Prueba manual:* Comer un Power Pellet hace que los fantasmas se vuelvan azules y lentos, huyendo de forma errática y parpadeando en blanco antes de volver a su color original.

4. **`game.js`, `ghosts.js` & `render.js`: Comer fantasmas, ojos retornando a la pen y regeneración.**
   - En `game.js`: al colisionar Pac-Man con un fantasma con `mode === 'frightened'`:
     - Calcular puntaje (`GHOST_SCORES[game.ghostsEatenInChain] || 1600`), sumarlo a `game.score`, e incrementar `game.ghostsEatenInChain++`.
     - Cambiar `g.mode = 'eaten'` y `g.speed = GHOST_EATEN_SPEED`.
   - En `ghosts.js`: si `g.mode === 'eaten'`, `ghostTarget` es `PEN_EXIT` (14, 11).
   - En `game.js`: cuando un fantasma con `mode === 'eaten'` llega a `PEN_EXIT` o entra a la pen, restablecer su estado a `mode = 'normal'`, velocidad `GHOST_SPEED` y salir de la pen si ya estaba liberado.
   - En `render.js`: cuando `g.mode === 'eaten'`, dibujar únicamente los ojos del fantasma.
   *Prueba manual:* Comer un fantasma asustado otorga 200 pts, se convierte en ojos flotantes a alta velocidad de regreso a la pen, y al llegar revive como fantasma normal.

---

## Acceptance criteria

- [x] Existen exactamente 4 Power Pellets en las posiciones `(1, 3)`, `(26, 3)`, `(1, 23)` y `(26, 23)`.
- [x] Los Power Pellets se renderizan más grandes que los dots normales y parpadean.
- [x] Comer un Power Pellet añade exactamente 50 puntos al marcador y descuenta 1 a `dotsRemaining`.
- [x] Comer un Power Pellet activa el modo asustado durante 420 frames (~7 segundos).
- [x] Todos los fantasmas fuera de la pen pasan a `mode = 'frightened'`, invierten su dirección y su velocidad pasa a `0.05`.
- [x] Los fantasmas asustados se dibujan con cuerpo azul y cara asustada.
- [x] Durante los últimos 120 frames del modo asustado, los fantasmas asustados parpadean alternando azul y blanco.
- [x] Al expirar el temporizador, los fantasmas que siguen asustados vuelven a `mode = 'normal'` y velocidad `0.1`.
- [x] Si Pac-Man colisiona con un fantasma asustado, Pac-Man no pierde vidas.
- [x] Comer fantasmas otorga puntajes escalonados (200, 400, 800, 1600 puntos) dentro de la misma activación.
- [x] El fantasma comido pasa a `mode = 'eaten'`, dibuja solo sus ojos y se desplaza a velocidad rápida (`0.2`) hacia `PEN_EXIT`/pen.
- [x] Pac-Man no sufre daño ni puede volver a comer a un fantasma en estado `mode = 'eaten'`.
- [x] Al llegar a la pen, el fantasma en estado `eaten` se regenera a `mode = 'normal'` con su velocidad e IA correspondientes.
- [x] Comer un nuevo Power Pellet reinicia el temporizador de modo asustado a 420 frames y reinicia la cadena de puntos a 200.

---

## Decisions

- **Sí:** Cuatro Power Pellets en las esquinas canónicas del nivel 1 de Pac-Man. Fiel al diseño original.
- **Sí:** Puntuaciones estándar de 50 pts por Power Pellet y 200 / 400 / 800 / 1600 por fantasmas en racha.
- **Sí:** Reducción de velocidad a la mitad (`0.05`) para fantasmas asustados y aumento al doble (`0.2`) para ojos en retorno.
- **Sí:** Los ojos regresan automáticamente a `PEN_EXIT` (14, 11) navegando con el algoritmo de búsqueda euclídea existente.
- **No:** Pausa freeze-frame al comer fantasmas en esta spec, para mantener el bucle de juego simple y fluido.
- **Sí:** Parpadeo visual con alternancia azul/blanco en los 2 últimos segundos antes de revertir.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Fantasma comido (`eaten`) se atasca intentando entrar a la pen | `canMove` y `ghostTarget` permiten a los fantasmas con `mode === 'eaten'` entrar a la puerta (`isDoor`) y al interior de la pen (`inPen`) para regenerarse. |
| Reinicio de nivel o muerte de Pac-Man con fantasmas asustados | `resetPositions` resetea `mode = 'normal'` en todos los fantasmas y `frightenedTimer = 0`. |

---

## What is **not** in this spec

- Congelación de pantalla (freeze frame) de medio segundo al engullir un fantasma.
- Texto flotante momentáneo sobre el laberinto con el valor de los puntos ganados.
- Sonidos / sirenas de modo asustado.
- Frutas o bonificaciones de comida en el centro del laberinto.
- Modo scatter/chase temporizado.
