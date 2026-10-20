"""Procedural nature ambiences for the Aube alarm app.

Synthesizes seamless, loopable mono ambiences (birds, waves, forest, rain,
stream) with numpy and scipy, then encodes each one to Ogg Vorbis via ffmpeg.

Usage:
    python scripts/generate_nature_sounds.py <out_dir> [--seconds 60]

ffmpeg is taken from the FFMPEG environment variable if set, else from PATH.

Generated audio is original work, released under CC0 1.0.
"""

import argparse
import os
import shutil
import subprocess
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
CROSSFADE_S = 3.0
PEAK = 10 ** (-1.0 / 20)  # -1 dBFS


def db(value_db):
    return 10 ** (value_db / 20)


def normalize_std(x):
    return x / (x.std() + 1e-12)


def normalize_peak(x):
    return x * (PEAK / np.max(np.abs(x)))


def lowpass(x, cutoff, order=4):
    sos = signal.butter(order, cutoff, btype="lowpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def highpass(x, cutoff, order=4):
    sos = signal.butter(order, cutoff, btype="highpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bandpass(x, low, high, order=4):
    sos = signal.butter(order, [low, high], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def pink_noise(rng, n):
    """1/f noise shaped in the frequency domain, unit std."""
    spec = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    freqs[0] = freqs[1]
    return normalize_std(np.fft.irfft(spec / np.sqrt(freqs), n))


def brown_noise(rng, n):
    """Random walk with DC removed, unit std."""
    return normalize_std(highpass(np.cumsum(rng.standard_normal(n)), 20, order=2))


def poisson_times(rng, rate, duration):
    """Uniform random onset times (s) of a Poisson process over duration."""
    return rng.uniform(0, duration, rng.poisson(rate * duration))


def add_at(buf, start, snippet):
    """Mix snippet into buf at sample index start, clipped to buf."""
    if start >= len(buf):
        return
    end = min(len(buf), start + len(snippet))
    buf[start:end] += snippet[: end - start]


def decaying_sine(freq0, freq1, dur, tau_frac=0.25):
    """Sine chirping from freq0 to freq1 over dur seconds, exponentially decaying."""
    t = np.arange(int(dur * SR)) / SR
    freq = freq0 + (freq1 - freq0) * t / dur
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t / (tau_frac * dur))


# ---------------------------------------------------------------- birds

# (low Hz, high Hz, pattern, min notes, max notes)
BIRD_SPECIES = [
    (2000, 3200, "up", 3, 6),
    (3200, 5000, "trill", 4, 8),
    (4500, 7000, "down", 2, 5),
    (2600, 4200, "trill", 2, 4),
]


def bird_note(rng, f_start, f_end, dur):
    """One note: swept sine with vibrato, 2nd harmonic at -15 dB, 5 ms attack."""
    t = np.arange(int(dur * SR)) / SR
    sweep = f_start + (f_end - f_start) * t / dur
    vibrato = 0.03 * sweep * np.sin(2 * np.pi * rng.uniform(20, 40) * t)
    phase = 2 * np.pi * np.cumsum(sweep + vibrato) / SR
    tone = np.sin(phase) + db(-15) * np.sin(2 * phase)
    return tone * np.minimum(t / 0.005, 1.0) * np.exp(-t / (0.4 * dur))


def bird_call(rng, species):
    """A call of 2-8 short notes following the species' pitch pattern."""
    low, high, pattern, n_min, n_max = species
    n_notes = rng.integers(n_min, n_max + 1)
    pieces = []
    for k in range(n_notes):
        if pattern == "up":
            base = low + (high - low) * k / max(n_notes - 1, 1)
        elif pattern == "down":
            base = high - (high - low) * k / max(n_notes - 1, 1)
        else:  # trill: alternate between the ends of the range
            base = high if k % 2 else low
        base *= rng.uniform(0.97, 1.03)
        sweep = rng.choice([-1.0, 1.0]) * rng.uniform(0.05, 0.15)
        f_end = np.clip(base * (1 + sweep), 2000, 7000)
        pieces.append(bird_note(rng, base, f_end, rng.uniform(0.04, 0.2)))
        pieces.append(np.zeros(int(rng.uniform(0.005, 0.03) * SR)))
    return np.concatenate(pieces)


def bird_calls(rng, n, rate):
    """Bird chorus of n samples at about `rate` calls/s, with short reflections."""
    buf = np.zeros(n)
    for onset in poisson_times(rng, rate, n / SR):
        species = BIRD_SPECIES[rng.integers(len(BIRD_SPECIES))]
        call = bird_call(rng, species) * rng.uniform(0.3, 1.0)
        add_at(buf, int(onset * SR), call)
    dry = buf.copy()
    for _ in range(3):
        delay = int(rng.uniform(0.03, 0.08) * SR)
        buf[delay:] += db(-12) * dry[: n - delay]
    return buf


def make_birds(rng, n):
    wind = normalize_std(lowpass(pink_noise(rng, n), 1500)) * db(-30)
    return wind + bird_calls(rng, n, rate=1.5)


# ---------------------------------------------------------------- waves

def wave_envelope(rng, n):
    """Smooth 0..1 swell envelope: 40% rise (trough to crest), 60% fall."""
    env = np.zeros(n + int(13 * SR))  # margin so the last wave never overruns
    start = 0.0
    while start * SR < n:
        period = rng.uniform(7, 12)
        i0 = int(start * SR)
        n_rise = int(0.4 * period * SR)
        n_fall = int(0.6 * period * SR)
        x = np.linspace(0, 1, n_rise, endpoint=False)
        env[i0 : i0 + n_rise] = 0.5 - 0.5 * np.cos(np.pi * x)
        y = np.linspace(0, 1, n_fall, endpoint=False)
        j0 = i0 + n_rise
        env[j0 : j0 + n_fall] = 0.5 + 0.5 * np.cos(np.pi * y)
        start += period
    return env[:n]


def make_waves(rng, n):
    env = wave_envelope(rng, n)
    base = 0.5 * (brown_noise(rng, n) + pink_noise(rng, n))
    dark = lowpass(base, 300, order=2)
    bright = lowpass(base, 3000, order=2)
    body = normalize_std(dark * (1 - env) + bright * env)
    body *= 0.15 + 0.85 * env
    # Foam hiss follows the swell, delayed by 1.5 s.
    hiss = normalize_std(highpass(rng.standard_normal(n), 4000, order=2))
    delay = int(1.5 * SR)
    hiss_env = np.concatenate([np.zeros(delay), env[:-delay]])
    return body + 0.2 * hiss * hiss_env


# ---------------------------------------------------------------- forest

def make_forest(rng, n):
    t = np.arange(n) / SR
    lfo = np.zeros(n)
    for f, p in zip(rng.uniform(0.05, 0.2, 5), rng.uniform(0, 2 * np.pi, 5)):
        lfo += np.sin(2 * np.pi * f * t + p)
    gust = np.clip(0.5 + lfo / 5, 0, 1)
    wind = normalize_std(bandpass(rng.standard_normal(n), 300, 3000)) * gust
    return wind + db(-12) * bird_calls(rng, n, rate=0.3)


# ---------------------------------------------------------------- rain

def make_rain(rng, n):
    dur = n / SR
    body = 0.3 * normalize_std(lowpass(highpass(pink_noise(rng, n), 500), 8000))
    for onset in poisson_times(rng, 150, dur):
        length = rng.uniform(0.002, 0.006)
        gain = rng.uniform(0.02, 0.15)
        add_at(body, int(onset * SR), gain * decaying_sine(
            freq0=(f := rng.uniform(2000, 8000)), freq1=f, dur=length))
    for onset in poisson_times(rng, 3, dur):
        gain = rng.uniform(0.3, 0.6)
        add_at(body, int(onset * SR), gain * decaying_sine(
            freq0=(f := rng.uniform(200, 900)), freq1=f,
            dur=rng.uniform(0.01, 0.02)))
    return body


# ---------------------------------------------------------------- stream

def make_stream(rng, n):
    water = normalize_std(bandpass(rng.standard_normal(n), 400, 2500))
    t = np.arange(n) / SR
    lfo = np.zeros(n)
    for f in rng.uniform(2, 8, 4):
        lfo += np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi))
    buf = water * np.clip(0.6 + 0.4 * lfo / 4, 0.2, 1.0) * 0.5
    for onset in poisson_times(rng, 20, n / SR):
        f0 = rng.uniform(300, 600)
        f1 = rng.uniform(800, 1200)
        gain = rng.uniform(0.1, 0.4)
        add_at(buf, int(onset * SR), gain * decaying_sine(
            f0, f1, dur=rng.uniform(0.01, 0.04), tau_frac=1 / 3))
    return buf


# ---------------------------------------------------------------- render

# name -> (fixed seed, synthesis function taking (rng, n_samples))
SOUNDS = {
    "birds": (1, make_birds),
    "waves": (2, make_waves),
    "forest": (3, make_forest),
    "rain": (4, make_rain),
    "stream": (5, make_stream),
}


def loop_crossfade(buf, n_out, n_fade):
    """Blend the tail of buf into its head (equal power), then trim to n_out."""
    t = np.linspace(0, np.pi / 2, n_fade)
    out = buf[:n_out].copy()
    out[:n_fade] = buf[:n_fade] * np.sin(t) + buf[n_out : n_out + n_fade] * np.cos(t)
    return out


def render(name, seconds):
    seed, make = SOUNDS[name]
    rng = np.random.default_rng(seed)
    n_out = int(seconds * SR)
    n_fade = int(CROSSFADE_S * SR)
    buf = make(rng, n_out + n_fade)
    return normalize_peak(loop_crossfade(buf, n_out, n_fade))


def encode_ogg(samples, path, ffmpeg):
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = os.path.join(tmp, "source.wav")
        wavfile.write(wav_path, SR, pcm)
        subprocess.run(
            [ffmpeg, "-y", "-v", "error", "-i", wav_path,
             "-c:a", "libvorbis", "-q:a", "4", "-ar", "44100", "-ac", "1", path],
            check=True,
        )


def find_ffmpeg():
    exe = os.environ.get("FFMPEG") or shutil.which("ffmpeg")
    if not exe:
        raise SystemExit("ffmpeg not found: add it to PATH or set the FFMPEG env var")
    return exe


def main():
    parser = argparse.ArgumentParser(description="Generate looping nature ambiences.")
    parser.add_argument("out_dir", help="directory for nature_<name>.ogg files")
    parser.add_argument("--seconds", type=float, default=60,
                        help="loop length in seconds (default 60)")
    args = parser.parse_args()
    if args.seconds <= CROSSFADE_S:
        parser.error(f"--seconds must be greater than {CROSSFADE_S:g}")

    ffmpeg = find_ffmpeg()
    os.makedirs(args.out_dir, exist_ok=True)
    for name in SOUNDS:
        samples = render(name, args.seconds)
        path = os.path.join(args.out_dir, f"nature_{name}.ogg")
        encode_ogg(samples, path, ffmpeg)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
