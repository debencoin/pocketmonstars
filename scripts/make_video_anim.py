"""Frame-by-frame animation from a character's Higgsfield combat video (white background).

Every frame is cut out of the white (soft matte, so glows, smoke and wind stay see-through), anchored at the feet and packed into
an atlas the arena plays like COVO's (art/anim/<name>.webp + .json). The video's moves become the sequences: each special press
plays the next move from the video, the hold-to-charge and release come from the charge clip, and so on.

usage: python3 scripts/make_video_anim.py <name> <video.mp4> <moves> [charge.mp4]
  moves: comma-separated roles for the video's segments after a short idle, e.g. "m,m,guard,m,charge"
         (m = a move, dash = a move that travels, guard = a guard move, charge = charge then release)
"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'dist', 'art', 'anim')
FPS, SIZE, IDLE = 8, 300, 0.8


def frames(video, fps=FPS):
    d = tempfile.mkdtemp()
    subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={fps},scale={SIZE}:{SIZE}', os.path.join(d, '%04d.png'), '-y'], check=True)
    fs = sorted(os.listdir(d))
    return [Image.open(os.path.join(d, f)).convert('RGB') for f in fs]


def matte(im):
    a = np.asarray(im).astype(np.float32)
    d = 255 - a.min(axis=2)                                   # how far from white
    al = np.clip((d - 8) / 38, 0, 1)
    rgb = 255 - (255 - a) / np.maximum(al[..., None], 1e-3)   # un-mix the white background
    rgb = np.clip(np.where(al[..., None] > 0, rgb, 0), 0, 255)
    return np.dstack([rgb, al * 255]).astype(np.uint8)


def anchor(rgba):
    al = rgba[..., 3] > 230
    ys, xs = np.nonzero(al)
    if not len(ys): return SIZE // 2, int(SIZE * 0.9), 1
    y1 = int(np.percentile(ys, 99.5)); y0 = int(np.percentile(ys, 0.5))
    feet = xs[ys > y1 - (y1 - y0) * 0.25]
    return int(np.median(feet if len(feet) else xs)), y1, y1 - y0


def main():
    name, video, roles = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
    charge_video = sys.argv[4] if len(sys.argv) > 4 else None
    vids = [frames(video)]
    if charge_video: vids.append(frames(charge_video))
    cut, seqs = [], {}

    def add(rgba, ax, ay):
        al = rgba[..., 3] > 15
        ys, xs = np.nonzero(al)
        if not len(ys): x0, y0, x1, y1 = ax - 1, ay - 1, ax + 1, ay + 1
        else: x0, y0, x1, y1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(SIZE - 1, xs.max() + 2), min(SIZE - 1, ys.max() + 2)
        cut.append((Image.fromarray(rgba).crop((x0, y0, x1 + 1, y1 + 1)), ax - x0, ay - y0))
        return len(cut) - 1

    # the main video: a short idle, then the moves in order, evenly spread over the rest of the clip
    F = vids[0]; mats = [matte(f) for f in F]
    ax, ay, stand = anchor(mats[0])
    n_idle = max(2, int(IDLE * FPS)); rest = len(F) - n_idle; per = rest / len(roles)
    idle = [add(mats[i], ax, ay) for i in range(n_idle)]
    segs = []
    for k, r in enumerate(roles):
        a, b = n_idle + int(k * per), n_idle + int((k + 1) * per)
        segs.append((r, [add(mats[i], ax, ay) for i in range(a, b)]))
    moves = [s for r, s in segs if r != 'charge']
    chg = next((s for r, s in segs if r == 'charge'), None)
    if charge_video: # a dedicated charge-and-release clip
        M2 = [matte(f) for f in vids[1]]; a2, b2, _ = anchor(M2[0])
        chg = [add(m, a2, b2) for m in M2]
    thin = lambda s, n: [s[int(i * len(s) / n)] for i in range(n)] if len(s) > n else s
    seqs['idle'] = idle + idle[::-1]; seqs['breath'] = idle
    dash = next((s for r, s in segs if r == 'dash'), None); guard = next((s for r, s in segs if r == 'guard'), None)
    seqs['run'] = thin(dash, 10) if dash else seqs['idle']
    seqs['walk'] = seqs['run']; seqs['dash'] = thin(dash or moves[0], 8)
    seqs['guard'] = thin(guard, 6) if guard else idle[:2]
    seqs['hit'] = idle[:3]; seqs['knock'] = idle[:2]; seqs['getup'] = idle
    seqs['light'] = thin(moves[0][: max(2, len(moves[0]) // 2)], 6); seqs['heavy'] = thin(moves[0], 8)
    for k, el in enumerate(['earth', 'wind', 'fire', 'water', 'lightning', 'fifth']): seqs[el] = thin(moves[k % len(moves)], 12) # each special plays the next move
    if chg:
        cut_at = int(len(chg) * 0.6)
        seqs['charge'] = thin(chg[:cut_at], 12); seqs['release'] = thin(chg[cut_at:], 10); seqs['mega'] = thin(chg, 14)
    else: seqs['mega'] = thin(moves[-1], 14)
    for k in ['powerup', 'auraon', 'auraoff', 'transform', 'teleport', 'summon', 'meditate', 'victory', 'defeat']: seqs[k] = [idle[0]]
    seqs['forms'] = [idle[0]] * 6
    for k in ['jump', 'air', 'land', 'crouch', 'aerial', 'finisher']: seqs[k] = seqs['heavy']

    # keep only the frames the sequences use, then pack them (shelves, 2048 wide)
    used = sorted({i for q in seqs.values() for i in q}); remap = {o: n for n, o in enumerate(used)}
    seqs = {k: [remap[i] for i in q] for k, q in seqs.items()}; cut = [cut[i] for i in used]
    W = 2048; x = y = rowh = 0; boxes = []
    for im, _, _ in cut:
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        boxes.append((x, y)); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (W, y + rowh + 2), (0, 0, 0, 0))
    out = []
    for (im, fx, fy), (bx, by) in zip(cut, boxes):
        atlas.paste(im, (bx, by)); out.append([bx, by, im.width, im.height, int(fx), int(fy)])
    os.makedirs(OUT, exist_ok=True)
    atlas.save(os.path.join(OUT, name + '.webp'), quality=78, method=6)
    json.dump({'scale': 1, 'stand': int(stand), 'box': [0, 0, SIZE], 'frames': out, 'seqs': seqs}, open(os.path.join(OUT, name + '.json'), 'w'), separators=(',', ':'))
    print(name, len(cut), 'frames', atlas.size, 'stand', stand)


if __name__ == '__main__':
    main()
