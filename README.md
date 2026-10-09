# Bannerfall

Tactical RPG isometrico a turni, giocabile nel browser. Guidi tre soldati contro tre nemici su un accampamento medievale devastato dalla guerra, aiutandoti con carte-ordine. Il nemico è controllato da un'AI con tre livelli di difficoltà che si sbloccano a mano a mano che vinci.

Progetto didattico: tutto gira nel browser, senza server.

## Avvio

Serve Node.js. Poi:

```bash
npm install
npm run dev      # sviluppo, http://localhost:5173
npm test         # test del motore, delle AI e della grafica (parti pure)
npm run build    # build di produzione in dist/
npm run lint
```

## Come si gioca

1. Scegli la difficoltà e premi **Inizia la battaglia**.
2. Clicca un tuo soldato: si evidenziano le caselle dove può muoversi (giallo) e i nemici che può colpire (rosso).
3. Clicca una casella per muoverlo (una volta per attivazione), poi un nemico per attaccarlo. Il pulsante dell'abilità attiva la modalità abilità.
4. Ogni soldato agisce **una volta per fase**. Quando hai finito, o vuoi saltare le unità rimaste, premi **Fine fase**: gioca il nemico.
5. Una **carta-ordine per fase**: selezionala e clicca un bersaglio evidenziato in viola. Una carta disattivata spiega perché non si può usare.
6. Vince chi elimina tutte le unità avversarie. `Esc` annulla la selezione.

### Livelli

| Livello | Come gioca il nemico |
|---|---|
| Recluta | Cerca il colpo più facile e a volte sbaglia. |
| Veterano | Valuta minacce e posizioni, usa le carte con criterio. |
| Comandante | Prevede la tua risposta prima di muovere. |

All'inizio è sbloccato solo **Recluta**. Vincere sblocca il livello successivo (e propone di affrontarlo subito). I progressi restano nel browser (`localStorage`).

## Regole

| Unità | HP | Mov | Attacco | Abilità |
|---|---|---|---|---|
| Guardiano | 12 | 3 | mischia, 3 danni | **Parata**: 3 punti guardia fino alla prossima fase |
| Esploratore | 8 | 4 | mischia, 3 danni | **Fendente coordinato**: 4 danni, 5 se un altro alleato è adiacente al bersaglio |
| Balestriere | 7 | 3 | distanza 2–4, 2 danni | **Tiro mirato**: 3 danni a distanza 2–5, poi salta la fase successiva |

- Mappa 12×9, movimento in 4 direzioni, distanze di Manhattan.
- Un'attivazione = muoversi (opzionale) e poi un solo attacco o abilità. Dopo aver agito non si può più muovere.
- Gli ostacoli (tenda, rovina, bracieri, carro, casse, staccionata) bloccano movimento e linea di tiro. Le unità bloccano il movimento ma non la linea di tiro.
- Il Balestriere non tira se ha un nemico adiacente.
- La guardia assorbe i danni prima degli HP e scade all'inizio della successiva fase della squadra.
- Niente fortuna: nessun colpo critico e nessuna probabilità di mancare. L'unico elemento casuale è il mazzo di carte.

### Carte-ordine

Mazzo di 12 carte (2 copie per tipo), mano di 3, una carta per fase; dopo l'uso ne peschi un'altra.

| Carta | Effetto |
|---|---|
| Marcia forzata | Un alleato non ancora attivato ottiene +2 movimento per questa attivazione. |
| Tenere la linea | Un alleato ottiene 3 punti guardia fino alla prossima fase della sua squadra. |
| Fuoco concentrato | Il prossimo attacco alleato contro il nemico scelto infligge +2 danni, solo in questa fase. |
| Carica | Un alleato da mischia non ancora attivato: +2 danni al prossimo colpo, se prima si muove di almeno 2 caselle. |
| Richiamare le forze | Un alleato ferito recupera 2 HP. |
| Ordine di precisione | Il prossimo tiro del Balestriere in questa fase: +1 danno e +1 gittata. |

I valori di unità e carte sono in `src/engine/units.ts` e `src/engine/cards.ts`.

## Com'è fatto

Strumenti: React 19, TypeScript strict, Vite, Redux Toolkit, PixiJS 8, Vitest.

- `src/engine/`: il motore delle regole. È puro e deterministico: `applyAction(stato, azione)` valida l'azione e restituisce il nuovo stato più gli eventi da animare. Non sa niente di grafica.
- `src/ai/`: le tre AI. Usano lo stesso motore del giocatore, quindi non possono fare mosse illegali. Facile: sceglie a caso (con seed) fra i 3 colpi migliori. Intermedio: valuta danni, minacce e posizione. Difficile: considera anche la risposta del giocatore, con un limite di tempo.
- `src/game/`: lo stato con Redux Toolkit, le azioni asincrone e il ciclo della fase dell'AI.
- `src/render/`: la scena PixiJS, la proiezione isometrica e le animazioni. Riproduce gli eventi del motore e non modifica mai lo stato di gioco.
- `src/ui/`: menu, HUD, pannello unità, mano di carte, schermata finale e gli effetti delle carte.
- `public/sprites/`, `public/map/`: immagini dei personaggi, del terreno e degli oggetti.
- `docs/`: specifica di progetto e piano di implementazione (`docs/superpowers/`) e immagine di riferimento dello stile.

Le immagini sono sostituibili senza toccare le regole: gli sprite sono descritti in `src/render/spriteManifest.ts`, gli oggetti in `src/render/propManifest.ts`. Se un'immagine manca o non si carica, la scena ripiega su una versione disegnata da codice.

## Crediti e copyright

- **Sprite dei personaggi** (Tidus, Ramza, Fran, Garland, Agrias, Lulu): © SQUARE ENIX CO., LTD. Tutti i diritti riservati. Provengono da *Final Fantasy Brave Exvius*. Progetto didattico senza scopo di lucro. Gli sprite sono inclusi nel repository solo per questo scopo: non sono ridistribuibili da questo progetto.
- **Terreno e oggetti** (`public/map/`): immagini generate con Gemini a partire da prompt scritti per questo progetto.
- **Font** Pixelify Sans: Google Fonts.
- Costruito insieme a Claude Code.

## Limiti noti

- Nessun suono.
- Solo Ramza e Fran hanno un vero ciclo di corsa a 4 frame; gli altri quattro personaggi hanno una posa di corsa unica con un saltello.
- La mappa non si usa da tastiera: serve il mouse (o il tocco).
- Una pozza di luce del terreno dipinto è fuori posto e viene spenta da codice (`src/render/groundGlow.ts`). Se rigeneri il terreno, aggiorna o svuota `MISPLACED_GLOWS`.
- "Ricomincia" e "Menu" non chiedono conferma.
- Con "riduci animazioni" i numeri dei danni e il banner del turno durano troppo poco per essere letti (gli HP e l'indicatore del turno restano visibili).
- L'AI contro l'AI può andare in stallo in qualche partita (circa 1 su 16 a livelli alti): non succede quando muovi tu.
- A ogni riavvio la scena ricarica terreno e oggetti: con molti riavvii di fila usa un po' di memoria in più.
- Il browser deve supportare WebGL: altrimenti il campo resta vuoto.
