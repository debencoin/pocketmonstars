#!/usr/bin/env python3
"""AZAELION, the Chosen One: full frame-by-frame animation cut from the creator's complete sprite sheet
(art-src/masters/covo_sheet.png). Every frame on the sheet is upscaled 3x (EDSR super-resolution), cut off the white paper
and packed into one atlas with its foot anchor, so the character is always drawn at the same size and stands on the same
spot whatever he does:

  dist/art/anim/azaelion.png   the atlas
  dist/art/anim/azaelion.json  {frames: [[x, y, w, h, ax, ay], ...], seqs: {name: [frame, ...]}, box: [left, up, right, down]}

The game (dist/pixel-arena.js) plays the sequences: idle loop, run, dash, teleport, guard, hit, knockdown, the light and
heavy combos, a bending attack for each of the five elements, the Fifth Element technique, the Origin Burst mega shot, the
transform sequence and the six forms he powers up through during a fight.
Needs: pip install opencv-contrib-python-headless scipy pillow numpy (the EDSR_x3 model is downloaded once to ~/.sr)."""
import os, json, urllib.request
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art-src', 'masters', 'covo_sheet.png')
OUT = os.path.join(ROOT, 'dist', 'art', 'anim'); os.makedirs(OUT, exist_ok=True)
K = 3  # upscale factor
MODEL = os.path.expanduser('~/.sr/EDSR_x3.pb')
MODEL_URL = 'https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x3.pb'

sheet = np.asarray(Image.open(SRC).convert('RGB')).astype(int)


def char_runs(x0, y0, x1, y1, dark=70, minc=6, gap=6, minw=14):
    """Columns holding the character: his hair and outlines are the only dark pixels (the bending effects are bright)."""
    d = (sheet[y0:y1, x0:x1].max(-1) < dark).sum(0)
    out, s, last = [], None, None
    for i, on in enumerate(d >= minc):
        if not on: continue
        if s is None: s = i
        elif i - last > gap: out.append((s, last)); s = i
        last = i
    if s is not None: out.append((s, last))
    return [(x0 + a, x0 + b + 1) for a, b in out if b - a >= minw]


def baseline(runs, y0, y1):
    """Feet line of a row: the median lowest inked pixel under each character."""
    ys = []
    for a, b in runs:
        m = np.abs(sheet[y0:y1, a:b] - 255).sum(-1) > 90
        rows = np.where(m.any(1))[0]
        if len(rows): ys.append(y0 + rows[-1])
    return int(np.median(ys)) if ys else y1


# row bands (x0, y0, x1, y1) inside the sheet's panels, and how each frame's area is cut around its character:
#  C: halfway to the neighbours, L: the effect flies out to the right, R: the trail streams out to the left
ROWS = {
    'idle': ((15, 120, 605, 184), 'C'), 'breath': ((15, 201, 605, 266), 'C'), 'walk': ((15, 281, 605, 341), 'C'),
    'run': ((15, 356, 605, 413), 'C'), 'dash': ((15, 430, 605, 483), 'R'), 'jump': ((15, 503, 605, 553), 'C'),
    'air': ((15, 573, 352, 613), 'C'), 'land': ((365, 573, 600, 613), 'C'), 'crouch': ((15, 643, 326, 686), 'C'),
    'guard': ((345, 643, 602, 686), 'C'), 'hit': ((15, 710, 322, 756), 'C'), 'knock': ((338, 710, 602, 756), 'C'),
    'getup': ((15, 783, 602, 829), 'C'),
    'light': ((630, 118, 1070, 184), 'L'), 'heavy': ((1100, 116, 1520, 184), 'L'), 'aerial': ((630, 203, 1078, 271), 'C'),
    'finisher': ((1100, 198, 1520, 274), 'L'),
    'earth': ((700, 316, 1520, 363), 'L'), 'wind': ((700, 366, 1520, 417), 'L'), 'fire': ((700, 420, 1520, 471), 'L'),
    'water': ((700, 474, 1520, 525), 'L'), 'lightning': ((700, 528, 1520, 581), 'L'),
    'fifth': ((630, 610, 1520, 679), 'C'), 'mega': ((630, 712, 1520, 832), 'C'), 'forms': ((10, 866, 748, 958), 'C'),
}
# the status row has gaps the character finder can't see (the teleport beam has no body), so its frames are set by hand
STATUS = {'powerup': (776, 844), 'auraon': (855, 942), 'auraoff': (957, 1002), 'transform': (1021, 1110), 'teleport': (1120, 1186),
          'summon': (1197, 1274), 'meditate': (1282, 1354), 'victory': (1374, 1425), 'defeat': (1441, 1519)}
STATUS_BAND = (866, 958)


def frames_for(name):
    (x0, y0, x1, y1), mode = ROWS[name]
    runs = char_runs(x0, y0, x1, y1)
    if name == 'earth': runs = char_runs(700, 366, 1530, 417)  # the rocks fool the finder: he stands where he does in the wind row
    if name == 'fifth': runs = runs + [(1440, 1520)]            # the last panel is the Origin Force burst itself
    base = baseline(runs[:-1] if name == 'fifth' else runs, y0, y1)
    out = []
    for i, (a, b) in enumerate(runs):
        prev, nxt = (runs[i - 1] if i else None), (runs[i + 1] if i + 1 < len(runs) else None)
        if mode == 'L': l, r = a - 8, (nxt[0] - 6 if nxt else x1)
        elif mode == 'R': l, r = (prev[1] + 4 if prev else x0), b + 8
        else: l, r = ((prev[1] + a) // 2 if prev else x0), ((b + nxt[0]) // 2 if nxt else x1)
        if name == 'finisher' and i == len(runs) - 1: l = 1330
        out.append(((max(x0, l), y0, min(x1, r), y1), ((a + b) / 2, base)))
    return out


def upscale():
    """3x EDSR super-resolution of the whole sheet (in tiles), cached next to the model."""
    cache = os.path.expanduser('~/.sr/covo_sheet_x3.png')
    if os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(SRC):
        return np.asarray(Image.open(cache).convert('RGB'))
    import cv2
    if not os.path.exists(MODEL):
        os.makedirs(os.path.dirname(MODEL), exist_ok=True); urllib.request.urlretrieve(MODEL_URL, MODEL)
    sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(MODEL); sr.setModel('edsr', K)
    bgr = sheet[:, :, ::-1].astype(np.uint8); h, w = bgr.shape[:2]; T, P = 256, 8
    big = np.zeros((h * K, w * K, 3), np.uint8)
    for ty in range(0, h, T):
        for tx in range(0, w, T):
            ax, ay, bx, by = max(0, tx - P), max(0, ty - P), min(w, tx + T + P), min(h, ty + T + P)
            up = sr.upsample(np.ascontiguousarray(bgr[ay:by, ax:bx]))
            ox, oy = (tx - ax) * K, (ty - ay) * K; tw, th = (min(w, tx + T) - tx) * K, (min(h, ty + T) - ty) * K
            big[ty * K:ty * K + th, tx * K:tx * K + tw] = up[oy:oy + th, ox:ox + tw]
        print('upscaled rows to', min(h, ty + T))
    rgb = big[:, :, ::-1]; Image.fromarray(rgb).save(cache); return rgb


def cut(big, box, tol=30, top=None):
    """Flood the white paper away from the crop edge; keep the drawing and its effect."""
    x0, y0, x1, y1 = [v * K for v in box]
    a = big[y0:y1, x0:x1].astype(int); h, w = a.shape[:2]
    near = np.abs(a - 255).sum(-1) <= tol * 3
    bg = np.zeros((h, w), bool); q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y, x] or not near[y, x]: continue
        bg[y, x] = True
        if x + 1 < w: q.append((x + 1, y))
        if x > 0: q.append((x - 1, y))
        if y + 1 < h: q.append((x, y + 1))
        if y > 0: q.append((x, y - 1))
    from scipy import ndimage
    lab, n = ndimage.label(~bg); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else []
    objs = ndimage.find_objects(lab)
    # drop specks, and pieces of the row's printed label: anything lying wholly above the top of his hair
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 40 and not (top is not None and objs[i][0].stop < top)])
    alpha = keep.astype(float)
    img = Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA')
    img.putalpha(Image.fromarray((alpha * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.6)))
    return img


def main():
    big = upscale()
    cells, seqs = [], {}
    def add(name, box, anchor):
        img = cut(big, box, top=None if name in ('fifth', 'mega', 'finisher', 'forms') else round((anchor[1] - 46 - box[1]) * K)); bb = img.getbbox()
        if not bb: return None
        img = img.crop(bb); ax = anchor[0] * K - (box[0] * K + bb[0]); ay = anchor[1] * K - (box[1] * K + bb[1])
        cells.append((img, ax, ay)); return len(cells) - 1
    for name in ROWS:
        fr = frames_for(name); seqs[name] = [i for i in (add(name, b, an) for b, an in fr) if i is not None]
        print(name, len(seqs[name]), 'frames')
    sruns = list(STATUS.values()); sbase = baseline([r for k, r in STATUS.items() if k not in ('teleport', 'defeat')], *STATUS_BAND)
    for k, (a, b) in STATUS.items():
        seqs[k] = [add(k, (a, STATUS_BAND[0], b, STATUS_BAND[1]), ((a + b) / 2, sbase))]
    # the six forms: the front view of each (base, elemental, harmonic, ascendant, transcendent) and the Ultimate Chosen One
    f = seqs.pop('forms'); seqs['forms'] = [f[i] for i in (0, 2, 4, 6, 8, 10)] if len(f) >= 11 else f
    # pack (shelves, 2048 wide)
    W, x, y, sh, pos = 2048, 0, 0, 0, []
    for img, _, _ in cells:
        if x + img.width > W: x, y, sh = 0, y + sh + 2, 0
        pos.append((x, y)); x += img.width + 2; sh = max(sh, img.height)
    atlas = Image.new('RGBA', (W, y + sh), (0, 0, 0, 0))
    for (img, _, _), p in zip(cells, pos): atlas.alpha_composite(img, p)
    atlas.save(os.path.join(OUT, 'azaelion.webp'), quality=88, method=6)   # what the game loads (small enough for phones)
    atlas.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT, 'azaelion.png'), optimize=True)  # fallback for browsers without WebP
    frames = [[p[0], p[1], img.width, img.height, round(ax), round(ay)] for (img, ax, ay), p in zip(cells, pos)]
    box = [max(fr[4] for fr in frames), max(fr[5] for fr in frames), max(fr[2] - fr[4] for fr in frames), max(fr[3] - fr[5] for fr in frames)]
    stand = cells[seqs['idle'][0]][0].height  # standing height of the character, for scaling him like the other fighters
    json.dump({'scale': K, 'stand': stand, 'box': box, 'frames': frames, 'seqs': seqs}, open(os.path.join(OUT, 'azaelion.json'), 'w'), separators=(',', ':'))
    print('atlas', atlas.size, len(frames), 'frames; standing height', stand)


if __name__ == '__main__':
    main()
