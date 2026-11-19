"""Cut a seamless mono loop from a field recording: make_loop.py SRC OUT.ogg START_S [LEN_S] [XFADE_S]."""
import subprocess, sys
import numpy as np

SR = 44100
src, out, start = sys.argv[1], sys.argv[2], float(sys.argv[3])
length = float(sys.argv[4]) if len(sys.argv) > 4 else 60.0
xf = float(sys.argv[5]) if len(sys.argv) > 5 else 4.0

raw = subprocess.run(
    ['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(length + xf + 1), '-i', src,
     '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
n, k = int(length * SR), int(xf * SR)
if len(x) < n + k:
    sys.exit('source too short: %.1f s' % (len(x) / SR))
x = x[:n + k]
# Equal-power crossfade: the tail past the loop point fades into the head.
t = np.linspace(0, np.pi / 2, k)
y = x[:n].copy()
y[:k] = x[:k] * np.sin(t) + x[n:n + k] * np.cos(t)
# Gentle high-pass against rumble, then loudness to a calm, consistent level.
pcm = (np.clip(y, -1, 1) * 32767).astype('<i2').tobytes()
subprocess.run(
    ['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
     '-af', 'highpass=f=60,loudnorm=I=-23:TP=-2:LRA=11', '-ar', str(SR),
     '-c:a', 'libvorbis', '-q:a', '4', out], input=pcm, check=True)
print(out, 'ok')
