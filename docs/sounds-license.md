# Licence des sons de la nature

Les six sons d'ambiance utilisés par Aube (réveil) sont **synthétisés de façon procédurale** par `scripts/generate_nature_sounds.py`. Aucun échantillon, aucun enregistrement tiers n'est utilisé.

Ce sont des œuvres originales du projet, publiées sous **CC0 1.0 Universal** (domaine public) : https://creativecommons.org/publicdomain/zero/1.0/

Usage commercial autorisé, sans attribution requise.

## Fichiers

Emplacement : `modules/smart-alarm/android/src/main/res/raw/`

| Identifiant (`sound`) | Fichier | Description |
|---|---|---|
| `birds` | `nature_birds.ogg` | Ambiance d'oiseaux (boucle de 60 s) |
| `waves` | `nature_waves.ogg` | Bruit de vagues (boucle de 60 s) |
| `forest` | `nature_forest.ogg` | Ambiance de forêt (boucle de 60 s) |
| `rain` | `nature_rain.ogg` | Bruit de pluie (boucle de 60 s) |
| `stream` | `nature_stream.ogg` | Bruit de ruisseau (boucle de 60 s) |
| `storm` | `nature_storm.ogg` | Pluie et tonnerre lointain (boucle de 60 s, ajouté le 15/11/2026) |

Un seul son se régénère avec `--only storm` (les autres fichiers restent identiques).

Chaque fichier est une boucle sans couture de 60 secondes.

## Régénérer les sons

```
python scripts/generate_nature_sounds.py modules/smart-alarm/android/src/main/res/raw --seconds 60
```

Prérequis :
- Python avec `numpy` et `scipy`
- `ffmpeg` compilé avec `libvorbis` (encodage OGG)
