# Migration du traitement de texte - Notes de remplacement

## Code Frontend à remplacer (TranscriptionsPage.tsx)

### À SUPPRIMER (lignes 48-114) :
```typescript
// Post-traitement gratuit (SUPPRIMER)
const DICTIONARY_ENTRIES = [...];
const FRENCH_NUMBER_MAP = {...};
function applyDictionary(text) {...}
function smartNormalize(text) {...}
function cleanChunk(text) {...}
function smartAppend(prev, next) {...}
function finalizeSentence(text) {...}
function correctTextChunk(raw) {...}
```

### À REMPLACER :

#### 1. Traitement des chunks live (ligne ~258) :
**AVANT :**
```typescript
if (autoCorrectionsEnabled) {
  chunk = correctTextChunk(chunk);
} else {
  chunk = cleanChunk(chunk);
}
```

**APRÈS :**
```typescript
// Appel API pour traitement centralisé
const processedResult = await fetch('/api/transcription-history/process-chunk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chunk,
    committed: liveCommittedByCommercial[cid] || '',
    isFinal: data.is_final,
    maxChars: liveMaxChars
  })
});
const { processedChunk, newCommitted } = await processedResult.json();
chunk = processedChunk;
```

#### 2. Affichage transcriptions (ligne ~762) :
**AVANT :**
```typescript
const displayTranscript = autoCorrectionsEnabled
  ? correctTextChunk(session.full_transcript || '')
  : (session.full_transcript || '');
```

**APRÈS :**
```typescript
// Le texte est déjà traité côté backend
const displayTranscript = session.full_transcript || '';
```

#### 3. Modal copie/téléchargement (ligne ~898) :
**AVANT :**
```typescript
onClick={() => copyText(correctTextChunk(openSession.full_transcript || ''))}
onClick={() => downloadText(filename, correctTextChunk(openSession.full_transcript || ''))}
```

**APRÈS :**
```typescript
// Le texte est déjà traité
onClick={() => copyText(openSession.full_transcript || '')}
onClick={() => downloadText(filename, openSession.full_transcript || '')}
```

## Nouvelles APIs Backend disponibles :

- `POST /api/transcription-history/process-chunk` - Traitement chunk avec merge
- `POST /api/transcription-history/process-live` - Traitement simple 
- `GET /api/transcription-history/:id/stats` - Statistiques transcription
- `POST /api/transcription-history/:id/restructure` - Restructuration manuelle

## Avantages de la migration :

✅ **Logique centralisée** - Un seul endroit pour tout le traitement  
✅ **Performance** - Traitement côté serveur plus rapide  
✅ **Cohérence** - Même traitement partout (live, historique, APIs)  
✅ **IA intégrée** - Gemini automatique sur nouvelles transcriptions  
✅ **Maintenance** - Plus facile à maintenir et déboguer  
✅ **Évolutivité** - Facile d'ajouter de nouvelles corrections  

## Configuration recommandée :

Le frontend devrait désormais être **read-only** pour les transcriptions et utiliser les APIs backend pour tout traitement.