# Bannerfall

Tactical RPG isometrico a turni nel browser: tre soldati contro tre, carte-ordine e un'AI a tre livelli.

## Avvio

```bash
npm install
npm run dev      # sviluppo, http://localhost:5173
npm test         # test del motore e delle AI
npm run build    # build di produzione in dist/
```

## Come si gioca

- Clicca un tuo soldato, poi una casella evidenziata per muoverlo (una volta per attivazione).
- Clicca un nemico evidenziato in rosso per attaccarlo; il pulsante dell'abilità attiva la modalità abilità.
- Ogni soldato agisce una volta per fase. "Fine fase" passa il turno al nemico.
- Una carta-ordine per fase: selezionala e clicca un bersaglio evidenziato in viola.
- Vince chi elimina tutte le unità avversarie.

## Regole in breve

| Unità | HP | Mov | Attacco | Abilità |
|---|---|---|---|---|
| Guardiano | 12 | 3 | mischia 3 | Parata: +3 guardia |
| Esploratore | 8 | 4 | mischia 3 | Fendente coordinato: 4 danni, 5 con un altro alleato adiacente al bersaglio |
| Balestriere | 7 | 3 | distanza 2–4, 2 danni | Tiro mirato: 3 danni a distanza 2–5, ricarica 2 |

- Distanze Manhattan, movimento in 4 direzioni.
- Linea di vista bloccata solo da ostacoli solidi.
- Il Balestriere non tira se ha un nemico adiacente.
- La guardia assorbe i danni prima degli HP e scade all'inizio della successiva fase della squadra.
- I valori sono in `src/engine/units.ts` e `src/engine/cards.ts`.

## Architettura

- `src/engine/`: motore puro e deterministico. `applyAction(state, action)` valida e restituisce `{ state, events }`.
- `src/ai/`: facile (avido con scelta casuale a seed fra i 3 migliori), intermedio (valutazione su un livello), difficile (migliori 6 candidati, simulazione della risposta avversaria, budget di 300 ms).
- `src/game/`: Redux Toolkit (stato serializzabile), thunk, driver della fase AI.
- `src/render/`: PixiJS v8. La scena riproduce gli eventi del motore con una coda di animazione, che non modifica mai lo stato.
- `src/ui/`: componenti React.

## Asset provvisori

Tutta la grafica è generata da codice ed è **provvisoria**:

- soldati: matrici di pixel 12×16 in `src/render/spriteFactory.ts`;
- terreno e oggetti: `src/render/terrain.ts`;
- luci, braci e vignettatura: `src/render/effects.ts`.

Per sostituire gli sprite basta modificare `src/render/assetMap.ts`, che deve restituire texture con i piedi sul bordo inferiore. Le regole non cambiano.

Il riferimento stilistico è `docs/references/battlefield-reference.png`.

## Limiti noti

- Nessun audio.
- Niente animazioni a fotogrammi degli sprite: idle e camminata sono interpolazioni.
- L'AI difficile usa una ricerca limitata, non un minimax completo. Se scatta il tetto di tempo, la scelta può dipendere dalla velocità della macchina.
- L'ordinamento in profondità della tenda (2×2) è approssimato.
- Le carte Carica e Marcia forzata non si combinano mai, per via del limite di una carta per fase.
