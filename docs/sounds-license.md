# Nature sounds licence

The six ambient sounds used by Aube (wake-up) are **procedurally synthesised** by `scripts/generate_nature_sounds.py`. No sample and no third-party recording is used.

These are original works of the project, released under **CC0 1.0 Universal** (public domain): https://creativecommons.org/publicdomain/zero/1.0/

Commercial use allowed, no attribution required.

## Files

Location: `modules/smart-alarm/android/src/main/res/raw/`

| Identifier (`sound`) | File | Description |
|---|---|---|
| `birds` | `nature_birds.ogg` | Birdsong ambience (60 s loop) |
| `waves` | `nature_waves.ogg` | Wave noise (60 s loop) |
| `forest` | `nature_forest.ogg` | Forest ambience (60 s loop) |
| `rain` | `nature_rain.ogg` | Rain noise (60 s loop) |
| `stream` | `nature_stream.ogg` | Stream noise (60 s loop) |
| `storm` | `nature_storm.ogg` | Rain and distant thunder (60 s loop, added on 15/11/2026) |

Only one sound is regenerated with `--only storm` (the other files stay identical).

Each file is a seamless 60-second loop.

## Regenerating the sounds

```
python scripts/generate_nature_sounds.py modules/smart-alarm/android/src/main/res/raw --seconds 60
```

Requirements:
- Python with `numpy` and `scipy`
- `ffmpeg` built with `libvorbis` (OGG encoding)
