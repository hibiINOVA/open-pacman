# SPEC 01 — Cuatro fantasmas con IA diferenciada

> **Estado:** aprobado
> **Depende de:** — (ninguna spec previa)
> **Fecha:** 2026-10-05
> **Objetivo:** Cuatro fantasmas con cuatro personalidades de IA distintas —perseguidor agresivo, emboscada, errático y cobarde— que salen de la pen según un contador de puntos.

---

## Scope

**In:**

- Cuatro fantasmas en el laberinto, cada uno con una personalidad de IA distinta.
- **Blinky** (`blinky`, perseguidor agresivo): su tile objetivo es el tile que ocupa Pacman.
- **Pinky** (`pinky`, emboscada): su tile objetivo es el tile situado 4 celdas por delante de Pacman, según la dirección actual de Pacman.
- **Inky** (`inky`, errático): su tile objetivo es el reflejo de Blinky respecto al pivote —el tile situado 2 celdas por delante de Pacman—, es decir `pivote + (pivote - blinky)`.
- **Clyde** (`clyde`, cobarde): persigue si la distancia Manhattan a Pacman supera 8 celdas; si no, se repliega a su esquina.
- Elección de dirección minimizando la distancia **euclídea al cuadrado** al tile objetivo, sin volver sobre sí mismo salvo en callejones sin salida.
- Liberación escalonada desde la pen por contador de puntos: Blinky fuera desde el primer frame, Pinky al comer 0 puntos, Inky al comer 30, Clyde al comer 60.
- Salida forzada de todos los fantasmas de la pen cuando se han comido todos los puntos.
- Liberación inmediata de los cuatro fantasmas tras la muerte de Pacman.
- Instrumentación de depuración de la IA activada por el flag `DEBUG_AI`.

**Out of scope (for future specs):**

- Alternancia de modos `scatter` / `chase` por temporizador.
- Puntos de poder y modo asustado: tiles nuevos en el laberinto, temporizador, fantasmas azules comibles y su puntaje.
- Estados `eaten` y reingreso en la pen por la puerta.
- Velocidades distintas por fantasma.
- Persistencia: high scores, niveles, ajustes, `localStorage`.
- Salida del túnel más rápida para los fantasmas y cualquier otro matiz del arcade.
- Esquinas de Pinky, Inky y Blinky: los cuatro `corner` se declaran en los datos, pero solo el de Clyde se usa hasta que exista la spec de modos.

---

## Data model

### `src/js/maze.js` — geometría de la pen

```js
// Interior de la pen: filas 13-15, cols 11-16 (18 celdas transisables).
// Verificado contra MAZE: fila 16 cols 10-17 = pared, puerta en fila 12 cols 13-14.
const PEN = { x0: 11, y0: 13, x1: 16, y1: 15 };

// Tile al que se dirige un fantasma liberado que sigue dentro de la pen.
// Es la celda del pasillo central, justo encima de la puerta.
const PEN_EXIT = { x: 14, y: 11 };
```

`maze.js` expone `window.PEN` y `window.PEN_EXIT` como ya hace con el resto de constantes.

### `src/js/maze.js` — tabla de fantasmas

`GHOST_STARTS` pasa de 2 a 4 entradas. El campo `kind` pasa de `'hunter' | 'random'` a los cuatro valores canónicos:

```js
const GHOST_STARTS = [
  { kind: 'blinky', x: 13, y: 11, dotLimit: 0,  insidePen: false, corner: { x: 25, y: 0 }  },
  { kind: 'pinky',  x: 14, y: 14, dotLimit: 0,  insidePen: true,  corner: { x: 2,  y: 0 }  },
  { kind: 'inky',   x: 13, y: 14, dotLimit: 30, insidePen: true,  corner: { x: 27, y: 30 } },
  { kind: 'clyde',  x: 14, y: 15, dotLimit: 60, insidePen: true,  corner: { x: 0,  y: 30 } },
];
```

- `dotLimit` — puntos globales que hay que comer para que el fantasma salga de la pen. Blinky y Pinky tienen 0: Pinky sale de inmediato, Blinky ya está fuera.
- `insidePen` — si la posición inicial está dentro de `PEN`. Explícito, para poder recolocar un fantasma sin depender de la geometría.
- `corner` — destino de repliegue. Solo el de Clyde se usa en esta spec.

### `src/js/game.js` — estado de partida

```js
return {
  state: 'start',
  score: 0,
  lives: 3,
  dotsRemaining: dots,
  dotsEaten: 0,          // NUEVO: contador global, base de la liberación
  grid,
  pacman: { /* igual que hoy */ },
  ghosts: GHOST_STARTS.map( ( g ) => ( {
    x: g.x,
    y: g.y,
    dir: 'up',
    speed: GHOST_SPEED,        // 0.1, los cuatro igual
    kind: g.kind,
    dotLimit: g.dotLimit,      // NUEVO
    corner: g.corner,          // NUEVO
    insidePen: g.insidePen,    // NUEVO
  } ) ),
};
```

### `src/js/ghosts.js` (nuevo) — superficie pública

```js
window.PINKY_AHEAD = 4;          // celdas por delante que_targets Pinky
window.INKY_AHEAD = 2;           // largo del vector pivote de Inky
window.CLYDE_FEAR_TILES = 8;     // umbral Manhattan de cobardía de Clyde
window.ghostTarget = ghostTarget;   // ( game, g ) -> { x, y }
window.decideGhost = decideGhost;   // ( game, g ) -> fija g.dir
```

Funciones auxiliares puras, no exportadas: `tileOf( actor )`, `aheadTile( actor, n )`, `targetInky( game )`, `targetClyde( game, g )`, `manhattan( a, b )`.

Convención: coordenadas en celdas, origen arriba-izquierda; las posiciones de actores pueden ser fraccionarias mientras se mueven y enteras cuando `decideGhost` decide.

---

## Implementation plan

1. **`maze.js`: datos de los cuatro fantasmas.** Añadir `PEN` y `PEN_EXIT`, y sustituir `GHOST_STARTS` por la tabla de 4 entradas de arriba con `dotLimit`, `insidePen` y `corner`. Exponerlos por `window`.
   *Prueba manual:* abrir `src/index.html`. Se dibujan 4 fantasmas con los 4 colores de `GHOST_COLORS`; la partida arranca sin errores en consola. La IA antigua sigue activa, así que los cuatro se mueven al azar salvo el primero: es un estado funcional intermedio aceptable.

2. **`ghosts.js`: las funciones de objetivo, sin conectar.** Crear `src/js/ghosts.js` con `tileOf`, `aheadTile`, `targetInky`, `targetClyde`, `manhattan` y `ghostTarget`. Registrar `<script src="js/ghosts.js"></script>` en `src/index.html` entre `maze.js` y `game.js`. Exponer solo `ghostTarget` y las tres constantes.
   *Prueba manual:* el juego se juega igual que en el paso 1. En consola, `ghostTarget( game, game.ghosts[0] )` devuelve el tile de Pacman y `ghostTarget( game, game.ghosts[1] )` devuelve un tile 4 celdas por delante según su dirección. `window.ghostTarget` existe.

3. **`ghosts.js`: `decideGhost` por personalidad, y delegación desde `game.js`.** Implementar `decideGhost( game, g )`: candidatos legales = direcciones transitables que no son la inversa de `g.dir` (o solo la inversa si es un callejón sin salida); elegir la de menor distancia euclídea al cuadrado a `ghostTarget( game, g )`. Exponerla por `window` y reemplazar el cuerpo de `decideGhost` en `game.js` por una llamada a la de `ghosts.js`, borrando la rama `kind === 'hunter'` y el `else` aleatorio.
   *Prueba manual:* Blinky converge de forma consistente; Pinky se coloca por delante; Inky no sigue a nadie; Clyde se aleja cuando está cerca.

4. **`game.js`: liberación por contador de puntos.** Añadir `dotsEaten` a `createGame` e incrementarlo junto a `dotsRemaining--`. Añadir `insidePen` a `canMove` mediante un parámetro opcional: si el fantasma tiene `insidePen === true`, solo se permiten destinos dentro de `PEN`. Liberar en `update` con `dotsEaten >= g.dotLimit || dotsRemaining === 0`, ya sea cambiando `insidePen` a `false` o fijando `g.dir = 'up'`. Añadir `dotLimit` e `insidePen` al reseteo de `resetPositions`, con `insidePen = false` para los cuatro y sin tocar `dotsEaten`.
   *Prueba manual:* al empezar solo se mueve Blinky y Pinky; Inky sale a los 30 puntos y Clyde a los 60. Al morir Pacman, los cuatro vuelven a la vez.

5. **`game.js`: instrumentación de depuración.** Añadir `const DEBUG_AI = false;` en cabecera. En `decideGhost` de `ghosts.js`, tras fijar `g.dir`, emitir una línea por fantasma cuando el flag esté activo.
   *Prueba manual:* poner `DEBUG_AI = true` y jugar 20 segundos. Cada fantasma imprime su tipo, posición, tile objetivo y dirección elegida.

---

## Acceptance criteria

- [ ] `src/index.html` se abre sin errores en la consola y se dibujan exactamente 4 fantasmas.
- [ ] Cada fantasma se dibuja con un color distinto de `GHOST_COLORS` y `kind` es uno de `blinky`, `pinky`, `inky`, `clyde`.
- [ ] Blinky nunca elige una dirección que aumente su distancia euclídea al tile de Pacman, salvo si es el único camino transitable de su celda.
- [ ] El objetivo de Blinky es el tile que ocupa Pacman en el momento de la decisión.
- [ ] El objetivo de Pinky es el tile situado 4 celdas por delante de Pacman según la dirección actual de Pacman (con `dir`, no con el giro pendiente `nextDir`).
- [ ] El objetivo de Inky cumple `pivote + (pivote - blinky)`, donde `pivote` es el tile 2 celdas por delante de Pacman. Si Pacman mira hacia arriba, `pivote` está 2 celdas arriba, no 4 a la izquierda.
- [ ] El objetivo de Inky cambia cuando Blinky cambia de posición, no cuando Inky la cambia.
- [ ] Con la distancia Manhattan entre Clyde y Pacman igual o menor a 8, Clyde no elige ninguna dirección que acerque su tile a `{ x: 0, y: 30 }`.
- [ ] Con la distancia Manhattan entre Clyde y Pacman mayor que 8, el objetivo de Clyde es el tile que ocupa Pacman.
- [ ] Ningún fantasma elige la dirección inversa a la suya, salvo cuando es el único camino posible.
- [ ] Blinky está fuera de la pen en (13,11) desde el primer frame de `state: 'playing'` y nunca entra en ella.
- [ ] Pinky, Inky y Clyde están dentro de `PEN` en el frame 1 y no salen mientras `dotsEaten` sea menor que su `dotLimit` (0, 30 y 60 respectivamente).
- [ ] Pinky sale de la pen con 0 puntos comidos, Inky al llegar a 30 y Clyde al llegar a 60.
- [ ] Cuando `dotsRemaining` llega a 0, cualquier fantasma que siga dentro de la pen sale de ella.
- [ ] Tras la muerte de Pacman, los cuatro fantasmas reanudan fuera o sobre la puerta sin esperar a los contadores.
- [ ] Ningún fantasma se queda atrapado dentro de la pen tras ser liberado: todos la abandonan en menos de 2 segundos.
- [ ] Los fantasmas siguen pudiendo usar el túnel de la fila 14 y reaparecer por el lado opuesto.
- [ ] Con `DEBUG_AI = true`, cada decisión de fantasma imprime por consola tipo, posición, tile objetivo y dirección elegida.
- [ ] `game.ghosts.length === 4` y todos los fantasmas se mueven a `GHOST_SPEED` (0.1 celdas por frame).

---

## Decisions

- **Sí:** las cuatro personalidades clásicas del arcade (Blinky, Pinky, Inky, Clyde). Cada una se percibe claramente distinta al jugar y el jugador reconoce los roles.
- **No:** inventar cuatro comportamientos nuevos. El `kind: 'hunter'` actual ya es un perseguidor; reutilizar el diseño original evita reexplicar la referencia.
- **No:** replicar el bug del arcade donde Inky, si Pacman mira arriba, desplaza el pivote 4 celdas a la izquierda. Se implementa el comportamiento correcto: 2 celdas arriba. Queda documentado aquí para que nadie lo "arregle" al revés en el futuro.
- **Sí:** distancia **euclídea al cuadrado** para elegir dirección, como en el original. La distancia Manhattan que usa hoy `game.js` produce caminos menos naturales en un laberinto con huecos.
- **No:** calcular la raíz cuadrada. Comparar cuadrados da la misma elección sin el coste.
- **No:** conservar `kind: 'random'` como personalidad. El azar puro solo queda como desempate dentro de la pen antes de la liberación, y aun así con preferencia por `PEN_EXIT` para garantizar la salida.
- **Sí:** los cuatro a `GHOST_SPEED = 0.1`. La diferencia debe medirse en la IA; mezclar velocidad e IA haría imposible atribuir el comportamiento a una de las dos cosas.
- **Sí:** liberación por contador de puntos global (`dotsEaten`), con `dotLimit` en la tabla de `GHOST_STARTS`. Es el mecanismo del original y hace visible la pen.
- **No:** derivar `dotLimit` de la posición. Sería una regla implícita frágil ante cualquier recolocación del laberinto.
- **No:** derivar `insidePen` de `inPen( x, y )`. Mismo motivo: un campo explícito es más legible y más seguro.
- **Sí:** `dotsEaten` no se reinicia al morir Pacman. En el arcade los fantasmas salen de la pen tras cada muerte.
- **Sí:** la salida de la pen apunta a `PEN_EXIT` (14,11) en vez de a la celda de la puerta (13,12), porque una celda de puerta es un destino ambiguo al elegir entre los dos lados posibles.
- **Sí:** la IA vive en `src/js/ghosts.js`. `game.js` conserva movimiento, colisión, puntuación y liberación; `ghosts.js` contiene solo "qué tile persigo y qué dirección elijo".
- **No:** ampliar `game.js` con las cuatro funciones de objetivo. Pasaría de 199 a unas 320 líneas mezclando reglas de partida con IA.
- **No:** scatter/chase por temporizador en esta spec. Se documenta como riesgo con el nombre de la spec que lo mitiga.
- **No:** puntos de poder en esta spec. Añadir tiles al laberinto más temporizador y estados `eaten` es una spec propia.
- **Sí:** `corner` declarado en los cuatro fantasmas aunque solo se use el de Clyde. La tabla queda completa y la spec de modos no tendrá que volver a tocar `maze.js`.
- **No:** tests automatizados. El proyecto no tiene `package.json` ni framework; la verificación es manual en el navegador más la tabla de consola que da las coordenadas exactas.
- **Sí:** convención de scripts y globals del proyecto (`<script>` en orden, `window.X` para exports). No se introduce `type="module"` en esta spec.
- **No:** refactor general de `game.js`, cambios en `render.js` ni en el CSS. `GHOST_COLORS` ya trae 4 colores y `drawGhost` ya es genérico.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Sin `scatter`/`chase`, Blinky, Pinky e Inky convergen siempre sobre Pacman y el nivel resulta más difícil que el arcade. | Riesgo aceptado y documentado. Mitigación futura: spec de modos con alternancia por temporizador. El comportamiento cobarde de Clyde da margen de respiro mientras tanto. |
| Un fantasma liberado se queda dando vueltas dentro de la pen sin encontrar la salida. | Mientras sigue dentro de la pen su objetivo es `PEN_EXIT`, no la personalidad. Al alcanzar `insidePen === false` el objetivo pasa a ser el de su tipo. Criterio de aceptación: ninguno tarda más de 2 s en salir. |
| Confundir `dotsEaten` con `dotsRemaining` al contar los puntos de liberación. | Un único contador (`dotsEaten`) decide la liberación; `dotsRemaining` solo lleva la victoria. Ambos se incrementan en la misma línea de `movePacman`. |
| Cuatro fantasmas a la vez en el mismo tile producen un golpe que no corresponde. | `collides` ya usa un umbral de 0.5 celdas y solo descuenta una vida por frame. Sin cambios previstos; si se ve una doble muerte, se mide la distancia real con `DEBUG_AI`. |
| La tabla de consola satura el navegador si se olvida apagar el flag. | `DEBUG_AI` es `false` por defecto y su línea se puede comentar sin tocar el resto del código. |

---

## What is **not** in this spec

- Puntos de poder, modo asustado y fantasmas comibles.
- Estados `eaten` y reingreso en la pen.
- Alternancia de modos `scatter` / `chase` por temporizador.
- Velocidades distintas por fantasma.
- Score al comer fantasmas, vidas extra ni puntajes por nivel.
- Persistencia de cualquier tipo.
- Niveles adicionales, cambio de laberinto o editor de laberinto.
- Variaciones del arcade: salida del túnel rápida, frightened flash, Cruce Elroy.

Cada uno de esos, si aterriza, va en su propia spec.
