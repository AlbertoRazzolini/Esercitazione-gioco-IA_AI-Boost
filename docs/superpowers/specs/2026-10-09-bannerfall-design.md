# Bannerfall — Design (MVP, scope ridotto)

Data: 2026-10-09 · Stato: in revisione

## 1. Obiettivo

Tactical RPG medievale a turni, singola battaglia nel browser: 3 unità del giocatore contro 3 unità controllate dall'AI, con carte-ordine e tre livelli di difficoltà. Progetto personale, frontend-only, da realizzare in circa 4 ore.

**Criterio di successo:** una battaglia giocabile dall'inizio alla fine, con regole e carte complete, tre AI realmente diverse, grafica isometrica in pixel art semplice e animazioni essenziali.

**Fuori scope:** campagna, progressione, multiplayer, backend, audio, Playwright, React Testing Library, animazioni sprite a frame (idle/camminata a fotogrammi), effetti grafici dedicati per singola carta, rifinitura responsive avanzata.

**Riferimento artistico:** `docs/references/battlefield-reference.png` (stile Sea of Stars / Eiyuden), da interpretare in forma semplificata.

## 2. Stack

React 19, TypeScript strict, Vite (già presenti). Da aggiungere: `@reduxjs/toolkit`, `react-redux`, `pixi.js` v8 (uso imperativo, senza `@pixi/react`), `vitest` (dev). Nessun'altra dipendenza; pathfinding con BFS scritto a mano.

## 3. Architettura

Motore puro + Redux sottile + coda di eventi.

- **Motore** (`src/engine/`): TypeScript senza dipendenze. Funzione centrale `applyAction(state, action) → { state, events }`. Valida ogni azione; un'azione illegale restituisce un errore e lascia lo stato invariato.
- **Redux** (`src/game/gameSlice.ts`): conserva il `GameState` serializzabile e lo stato di UI (selezione, carta in uso, difficoltà, schermata). I reducer delegano al motore e accodano gli eventi prodotti in un buffer esterno allo store.
- **Renderer PixiJS** (`src/render/`): legge lo stato per gli overlay e riproduce gli eventi tramite una coda di animazione. Non contiene regole.
- **AI** (`src/ai/`): riceve un `GameState`, restituisce azioni; le simula con lo stesso `applyAction`.
- **UI React** (`src/ui/`): menu, HUD, pannello unità, mano di carte, fine partita.

Nello store non entrano oggetti PixiJS, timer, promise o funzioni.

## 4. Modello di gioco

### 4.1 Arena

Griglia logica 10 colonne × 8 righe, coordinate intere `{x, y}`. Ogni cella ha un tipo di terreno (solo estetico: erba, terra, fango, ghiaia) e un eventuale oggetto:

- **solido** (blocca movimento e linea di vista): tenda 2×2, rudere, bracieri 1×1 (emettono luce);
- **decorativo** (attraversabile, non blocca): rocce, erba alta.

Il giocatore parte sulle colonne di sinistra, l'AI su quelle di destra, in posizioni fisse definite in `arena.ts`.

### 4.2 Unità

| Archetipo | HP | Mov | Attacco base | Gittata | Abilità |
|---|---|---|---|---|---|
| Guardiano | 12 | 3 | mischia, 3 danni | 1 | **Parata**: +3 guardia |
| Esploratore | 8 | 4 | mischia, 3 danni | 1 | **Fendente coordinato**: 4 danni, 5 se un *altro* alleato è adiacente al bersaglio |
| Balestriere | 7 | 3 | distanza, 2 danni | 2–4 | **Tiro mirato**: 3 danni, gittata 2–5, cooldown 2 |

Tutti i valori sono in `units.ts`, unica fonte.

### 4.3 Regole

- **Distanza:** Manhattan. "Adiacente" significa distanza 1 (niente diagonali).
- **Movimento:** 4 direzioni, costo 1 per cella. Celle occupate da unità o da oggetti solidi e celle fuori mappa non sono attraversabili. BFS calcola le destinazioni raggiungibili e il percorso verso ciascuna.
- **Linea di vista:** linea di Bresenham fra i centri delle due celle. È bloccata se una cella intermedia contiene un oggetto solido; le unità non la bloccano.
- **Attacchi a distanza** (base e Tiro mirato): bersaglio entro gittata e in linea di vista; vietati se un nemico è adiacente al Balestriere.
- **Guardia:** assorbe danni prima degli HP. Non si accumula: si tiene il valore più alto. Scade all'inizio della successiva fase della squadra dell'unità (vale sia per Parata sia per Tenere la linea).
- **Cooldown:** scala di 1 all'inizio di ogni fase della squadra dell'unità.
- **Sconfitta:** con HP a 0 l'unità viene rimossa dallo stato e non può più agire.
- **Vittoria:** una squadra senza unità vive perde. Nessuna azione è accettata dopo la fine della partita.

### 4.4 Attivazione e fasi

Fasi alternate: giocatore, poi AI, poi giocatore, e così via. Un round è la coppia di fasi. Il giocatore inizia per primo.

Un'attivazione segue gli stati `idle → moved → acted → done`:

1. Si seleziona un'unità viva non ancora attivata in questa fase.
2. Movimento opzionale, una sola volta.
3. Attacco base **oppure** abilità, opzionale, al massimo una volta. Dopo questa azione il movimento non è più consentito.
4. `EndActivation` segna l'unità come attivata. Selezionare un'altra unità mentre una è in `moved` chiude automaticamente la precedente.

`EndPhase` chiude la fase, anche in anticipo; le unità non attivate perdono il turno. La fase si chiude da sola quando tutte le unità vive sono attivate. Al cambio di fase:

- cambia la squadra attiva;
- scadono la guardia e i bonus delle carte legati alla fase precedente;
- scalano i cooldown della nuova squadra attiva;
- si azzerano attivazioni e carta giocata.

### 4.5 Carte-ordine

Mazzo di 12 carte per squadra (2 copie di ciascuna delle 6), mescolato con PRNG a seed. Mano iniziale di 3 carte. Al massimo **una carta per fase**, giocabile in qualsiasi momento della propria fase. Dopo il gioco la carta va negli scarti e se ne pesca una nuova; se il mazzo è vuoto, gli scarti vengono rimescolati e diventano il nuovo mazzo.

| Carta | Bersaglio | Effetto |
|---|---|---|
| Marcia forzata | alleato non ancora attivato, in stato `idle` | +2 movimento in questa attivazione |
| Tenere la linea | alleato | +3 guardia (stessa regola di scadenza della guardia) |
| Fuoco concentrato | nemico | il prossimo attacco alleato contro di lui in questa fase infligge +2; consumato al primo colpo; non cumulabile |
| Carica | alleato da mischia in stato `idle` | +2 danni al prossimo attacco o abilità in questa attivazione, se nell'attivazione ha percorso ≥2 celle (contano anche quelle di Marcia forzata) |
| Richiamare le forze | alleato ferito | +2 HP, fino al massimo |
| Ordine di precisione | Balestriere alleato | il prossimo attacco a distanza in questa fase infligge +1 e ha gittata massima +1 |

Una carta è giocabile solo se esiste almeno un bersaglio valido; la UI riporta il motivo quando non lo è. Gli effetti sono dati (`cards.ts`) interpretati dal motore, non condizioni sparse nella UI. I bonus si sommano al danno prima dell'assorbimento della guardia.

### 4.6 Azioni ed eventi

```ts
type Action =
  | { type: 'Move'; unitId; to }
  | { type: 'Attack'; unitId; targetId }
  | { type: 'UseAbility'; unitId; targetId? }
  | { type: 'PlayCard'; handIndex; targetId }
  | { type: 'EndActivation'; unitId }
  | { type: 'EndPhase' };

type GameEvent =
  | { type: 'Moved'; unitId; path }
  | { type: 'Attacked'; unitId; targetId; kind: 'melee' | 'ranged' }
  | { type: 'Damaged'; unitId; amount; absorbed }
  | { type: 'Guarded'; unitId; amount }
  | { type: 'Healed'; unitId; amount }
  | { type: 'CardPlayed'; team; cardId; targetId }
  | { type: 'Defeated'; unitId }
  | { type: 'PhaseChanged'; team; round }
  | { type: 'GameOver'; winner };
```

La selezione dell'unità è stato di UI, non un'azione del motore: l'attivazione inizia con la prima azione dell'unità. Lo stato contiene `rngSeed`, che rende deterministici mescolamenti e variabilità dell'AI.

## 5. AI

Interfaccia: `planActivation(state, difficulty, seed): Action[]`, che restituisce una carta (opzionale), un movimento (opzionale), un attacco o un'abilità (opzionale) e infine `EndActivation`; se nessuna unità è attivabile restituisce `[EndPhase]`. Il driver (`aiDriver.ts`) invia le azioni una alla volta e attende la fine di ogni animazione. Se un'azione viene rifiutata, il driver termina la fase AI con `EndPhase`, così la partita non resta bloccata.

**Candidati:** per ogni unità attivabile, ogni destinazione raggiungibile (compreso restare fermi) combinata con nessuna azione, l'attacco base o l'abilità su ogni bersaglio valido, più le carte giocabili.

**Valutazione** (punto di vista della squadra AI):

- differenza di HP;
- bonus forte per le uccisioni, penalità forte per le perdite;
- minaccia: danni che il nemico può infliggere nella sua prossima fase;
- posizione: i corpo a corpo si avvicinano ai bersagli, il Balestriere sta a 2–4 con linea di vista e senza nemici adiacenti;
- concentrazione: bonus per colpire unità già ferite.

| Livello | Strategia |
|---|---|
| Facile | Avido sul danno immediato, senza valutare la minaccia. Sceglie a caso (con seed) fra i 3 candidati migliori. Gioca una carta solo nei casi ovvi (es. cura sotto metà HP). |
| Intermedio | Valutazione completa su un livello: sceglie la migliore attivazione fra tutte le unità, la applica e ripete. Gioca una carta se migliora la valutazione. |
| Difficile | Prende i migliori 8 candidati dell'intermedio, simula le proprie attivazioni restanti e l'intera fase di risposta del giocatore (con la politica intermedia), e sceglie il candidato che regge meglio. Budget di 300 ms o tetto di nodi; oltre il budget usa il migliore trovato. |

## 6. Rendering

- **Proiezione:** cella 64×32; `screenX = (x − y)·32 + offsetX`, `screenY = (x + y)·16 + offsetY`. Sprite ancorati ai piedi. `zIndex = x + y`; le unità in movimento usano la profondità interpolata.
- **Strati:** terreno (tile procedurali con variazioni di colore), overlay tattici (selezione, raggiungibili, bersagli, percorso), unità e oggetti ordinati per profondità, effetti (aloni dei fuochi, braci, proiettili, numeri di danno), vignettatura.
- **Griglia invisibile** durante il gioco normale. Gli overlay compaiono solo quando c'è un'unità selezionata o una carta in uso. Al passaggio del mouse, la cella ha un'evidenziazione leggera.
- **Sprite:** chibi 24×32 da matrici di pixel (`spriteFactory.ts`) con contorno scuro di 1 px e sagome distinte per classe; palette per squadra blu e rossa, smorzate. Nessuna base sotto le unità, nessuna emoji. `assetMap` associa gli archetipi alle texture e permette di sostituirle.
- **Palette:** terreno bruno-violaceo, ombre fredde blu/viola, luci calde arancioni solo dai fuochi.
- **Animazioni** (coda sequenziale, ogni evento è una promise): passo cella per cella con saltello, scatto in mischia, quadrello in volo, lampo bianco e numero di danno, scudo luminoso per la guardia, cura verde, dissolvenza alla sconfitta, banner al cambio di fase. Timeout di sicurezza per ogni animazione. Con `prefers-reduced-motion` le durate sono prossime a zero.
- **Input:** clic sul canvas → coordinate logiche → azione o selezione. Input bloccato durante le animazioni e la fase AI.

## 7. UI

- **Schermata iniziale:** titolo, scelta della difficoltà, "Inizia".
- **HUD:** round, squadra attiva, stato di attivazione delle unità.
- **Pannello unità:** HP, guardia, cooldown, pulsanti Attacco / Abilità / Fine attivazione, descrizione dell'abilità.
- **Mano di carte:** in basso, compatta; le carte non giocabili sono disattivate e mostrano il motivo.
- **Pulsanti** "Fine fase" e "Ricomincia".
- **Schermata finale** di vittoria o sconfitta, con "Nuova partita".
- Stile pergamena con cornici scure; nessun componente generico da dashboard.
- Feedback per azioni non valide: breve messaggio nell'HUD.

## 8. Struttura dei file

```
src/
  app/      store.ts, hooks.ts
  engine/   types.ts, units.ts, arena.ts, rng.ts, movement.ts, targeting.ts,
            combat.ts, cards.ts, engine.ts (+ *.test.ts)
  ai/       evaluate.ts, candidates.ts, easy.ts, medium.ts, hard.ts, index.ts (+ *.test.ts)
  game/     gameSlice.ts, selectors.ts, aiDriver.ts
  render/   BattlefieldCanvas.tsx, iso.ts, spriteFactory.ts, terrain.ts, scene.ts,
            animationQueue.ts, effects.ts
  ui/       StartScreen.tsx, Hud.tsx, UnitPanel.tsx, CardHand.tsx, EndScreen.tsx, ui.css
docs/       superpowers/specs, superpowers/plans, references/
```

Lo scaffold Vite di default (`App.tsx`, `App.css`, asset demo) viene sostituito.

## 9. Test e verifica

**Vitest sul motore:**

- movimento: raggiungibilità, limite e bonus, celle occupate, ostacoli, bordi, percorsi;
- combattimento: mischia, gittata, linea di vista, nemico adiacente al Balestriere, guardia, sconfitta, le tre abilità, cooldown, vittoria;
- turni: una sola attivazione per unità, nessun movimento dopo un attacco, alternanza delle fasi, reset, scadenze, unità sconfitte;
- carte: pesca iniziale, una carta per fase, pesca sostitutiva, rimescolamento, bersagli, effetti e scadenze, interazioni (Carica con Marcia forzata, bonus e guardia).

**Vitest sull'AI:**

- legalità in partite AI contro AI su molti seed;
- determinismo;
- budget del difficile;
- torneo su N seed: il difficile batte l'intermedio e l'intermedio batte il facile in più del 50% delle partite.

**Verifica finale:** `npm test`, `npm run build` (con `tsc` strict) e una partita giocata nel browser senza errori in console.

## 10. Ordine di lavoro e linea di taglio

L'ordine è: motore → carte → AI → rendering e input → UI → animazioni ed effetti. Ogni passo lascia il progetto compilabile e testato.

Se il tempo non basta, si taglia in quest'ordine:

1. il difficile scende alla sola valutazione delle proprie attivazioni, senza simulare la risposta;
2. le animazioni si riducono a sole interpolazioni;
3. si eliminano aloni e braci.

Regole e carte non si tagliano.

## 11. Limiti noti

Gli sprite sono provvisori e procedurali, sostituibili tramite `assetMap`. Non c'è audio. L'AI difficile usa una ricerca limitata, non un minimax completo.
