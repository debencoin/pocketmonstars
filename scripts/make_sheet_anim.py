#!/usr/bin/env python3
"""Frame-by-frame animation for COVA and Kena, cut from the creator's complete sprite sheets (same pipeline as the Chosen One):
every drawn frame is upscaled 3x (EDSR super-resolution), cut off the white paper and packed in an atlas with its foot anchor.
  dist/art/anim/<name>.png|.webp + .json   {frames, seqs:{idle,run,dash,guard,hit,knock,light,heavy,earth,wind,fire,water,lightning,mega,...}}
  dist/art/fx/<name>_<element>.png         the sheet's own fire / water / wind / earth / lightning effect, used as the projectile
Usage: python3 scripts/make_sheet_anim.py cova kena"""
import os, sys, json, urllib.request
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from dirlib import clusters
ROOT = os.path.join(os.path.dirname(__file__), '..'); SRC = os.path.join(ROOT, 'art-src', 'masters')
OUT = os.path.join(ROOT, 'dist', 'art', 'anim'); FXD = os.path.join(ROOT, 'dist', 'art', 'fx'); os.makedirs(OUT, exist_ok=True); os.makedirs(FXD, exist_ok=True)
K = 3; MODEL = os.path.expanduser('~/.sr/EDSR_x3.pb')

def split(box, n, idx=None):
    w = (box[2] - box[0]) / n; r = [(round(box[0] + i * w), box[1], round(box[0] + (i + 1) * w), box[3]) for i in range(n)]
    return [r[i] for i in idx] if idx else r
def cl(im, box, gap=2, tol=50, minw=8, idx=None):
    c = clusters(im, box, gap=gap, minw=minw, tol=tol); return [c[i] for i in idx] if idx else c

# row definitions per sheet: name -> (how to find the frames, character-x anchor mode)
#   'own': every frame is anchored on its own centre (the character moves in the row); 'fix': anchored on the first frame's centre (he stands, the effect flies out)
def rows_cova(B):
    L = lambda y0, y1, **k: cl(B, (60, y0, 312, y1), gap=2, tol=50, **k)
    return {
      'idle': (L(129, 159), 'own'), 'breath': (L(161, 187), 'own'), 'walk': (L(188, 211), 'own'), 'run': (L(216, 238), 'own'), 'dash': (L(244, 269), 'own'),
      'jump': (L(272, 299), 'own'), 'air': (L(302, 324), 'own'), 'land': (L(328, 348), 'own'), 'crouch': (L(350, 372), 'own'), 'guard': (L(374, 399), 'own'),
      'hit': (L(401, 423), 'own'), 'knock': (L(428, 447), 'own'), 'getup': (L(451, 475), 'own'),
      'light': (cl(B, (327, 138, 548, 170), gap=1, tol=50), 'fix'), 'heavy': (cl(B, (560, 138, 785, 170), gap=1, tol=50), 'fix'),
      'aerial': (cl(B, (327, 176, 548, 214), gap=1, tol=50), 'own'), 'finisher': (cl(B, (560, 176, 785, 214), gap=1, tol=50), 'fix'),
      'earth': (cl(B, (392, 244, 822, 273), gap=2, tol=50), 'fix'), 'wind': (cl(B, (392, 273, 822, 303), gap=2, tol=50), 'fix'), 'fire': (cl(B, (392, 303, 822, 334), gap=2, tol=50), 'fix'),
      'water': (cl(B, (392, 334, 822, 364), gap=2, tol=50), 'fix'), 'lightning': (cl(B, (392, 364, 822, 396), gap=2, tol=50), 'fix'),
      'mega': (cl(B, (322, 428, 700, 480), gap=2, tol=50), 'own'),
    }
def rows_kena(C):
    return {
      'idle': (split((160, 141, 375, 166), 7), 'own'), 'walk': (split((385, 141, 610, 166), 6), 'own'), 'run': (split((625, 141, 850, 164), 6), 'own'), 'dash': (split((870, 141, 1118, 163), 6), 'own'),
      'jump': (split((160, 172, 375, 200), 6), 'own'), 'air': (split((385, 172, 610, 200), 6), 'own'), 'guard': (split((160, 216, 375, 244), 5), 'own'), 'hit': (split((385, 216, 610, 244), 6), 'own'),
      'knock': (split((625, 205, 860, 240), 5), 'own'),
      'light': (split((165, 266, 600, 300), 5), 'fix'), 'heavy': (split((620, 266, 1120, 300), 5), 'fix'),
      'earth': (cl(C, (225, 356, 685, 396), gap=2, tol=50), 'fix'), 'wind': (cl(C, (392, 356, 720, 396), gap=2, tol=50), 'fix'), 'fire': (cl(C, (560, 356, 735, 396), gap=2, tol=50), 'fix'),
      'mega': (split((395, 404, 1120, 456), 5), 'own'),
    }
def rot_cova(B): return cl(B, (330, 22, 680, 92), gap=3, tol=40, idx=range(8))
def rot_kena(C): return cl(C, (180, 26, 600, 96), gap=3, tol=40, idx=range(8))
ROT = {'cova': rot_cova, 'kena': rot_kena}
SHEETS = {'cova': ('cova_sheet.jpg', rows_cova), 'kena': ('kena_sheet.jpg', rows_kena)}

def upscale(rgb, tag):
    cache = os.path.expanduser(f'~/.sr/{tag}_x3.png')
    if os.path.exists(cache): return np.asarray(Image.open(cache).convert('RGB'))
    import cv2
    sr = cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(MODEL); sr.setModel('edsr', K)
    bgr = rgb[:, :, ::-1].astype(np.uint8); h, w = bgr.shape[:2]; T, P = 200, 8; big = np.zeros((h * K, w * K, 3), np.uint8)
    for ty in range(0, h, T):
        for tx in range(0, w, T):
            ax, ay, bx, by = max(0, tx - P), max(0, ty - P), min(w, tx + T + P), min(h, ty + T + P)
            up = sr.upsample(np.ascontiguousarray(bgr[ay:by, ax:bx])); ox, oy = (tx - ax) * K, (ty - ay) * K
            tw, th = (min(w, tx + T) - tx) * K, (min(h, ty + T) - ty) * K; big[ty * K:ty * K + th, tx * K:tx * K + tw] = up[oy:oy + th, ox:ox + tw]
    out = big[:, :, ::-1]; Image.fromarray(out).save(cache); return out

def cutbig(big, box, tol=34):
    x0, y0, x1, y1 = [v * K for v in box]; a = big[y0:y1, x0:x1].astype(int); h, w = a.shape[:2]
    near = np.abs(a - 255).sum(-1) <= tol * 3; bg = np.zeros((h, w), bool)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y, x] or not near[y, x]: continue
        bg[y, x] = True
        if x + 1 < w: q.append((x + 1, y))
        if x > 0: q.append((x - 1, y))
        if y + 1 < h: q.append((x, y + 1))
        if y > 0: q.append((x, y - 1))
    from scipy import ndimage
    lab, n = ndimage.label(~bg, structure=np.ones((3, 3))); objs = ndimage.find_objects(lab); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else []
    big_ = max(sizes) if n else 0; keep = np.zeros((h, w), bool)
    for i, s in enumerate(sizes):
        sl = objs[i]; hh = sl[0].stop - sl[0].start; ww = sl[1].stop - sl[1].start
        if s < big_ * 0.03 or s < 60 or (hh <= 15 and ww >= 30) or (ww <= 15 and hh >= 30): continue   # specks and panel border lines
        keep |= lab == i + 1
    img = Image.fromarray(a.astype(np.uint8), 'RGB').convert('RGBA'); img.putalpha(Image.fromarray((keep * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.7))); return img

def warp(img, t, hair=0, cloth=0, bob=0, lean=0, back=0, sx=1.0, sy=1.0, canvas=None):
    """Procedural life for a crisp view: hair streams and sways (top of the picture), the robe hem swings, the body bobs and leans about the feet."""
    a = np.asarray(img); h, w = a.shape[:2]; pad = int(max(w, h) * 0.35); out = np.zeros((h, w + 2 * pad, 4), np.uint8)
    for y in range(h):
        u = y / h; hw = max(0.0, 1 - u / 0.42) ** 1.5; cw = max(0.0, (u - 0.55) / 0.45) ** 1.3
        d = int(round(hair * hw * np.sin(2 * np.pi * t - u * 7) - back * hw + cloth * cw * np.sin(2 * np.pi * t * 1.0 + 1.3 - u * 5)))
        x0 = pad + d; out[y, max(0, x0):min(out.shape[1], x0 + w)] = a[y, max(0, -x0):w - max(0, x0 + w - out.shape[1])]
    im = Image.fromarray(out, 'RGBA')
    if sx != 1 or sy != 1: im = im.resize((round(im.width * sx), round(im.height * sy)), Image.LANCZOS)
    big = Image.new('RGBA', (im.width, im.height + pad), (0, 0, 0, 0)); big.alpha_composite(im, (0, pad)); im = big
    if lean: im = im.rotate(-lean, resample=Image.BICUBIC, center=(im.width / 2, im.height))
    if bob: s2 = Image.new('RGBA', im.size, (0, 0, 0, 0)); s2.alpha_composite(im, (0, -int(bob))) if bob > 0 else s2.alpha_composite(im, (0, int(-bob))); im = s2
    return im

def kena_rig(dirs_cells):
    """Kena's sheet is too small to cut frames from, so she moves as her crisp turnaround view, brought to life frame by frame."""
    right = dirs_cells[2][0]; seqs = {}; cells = []
    def add(im): cells.append((im, im.width / 2, im.height - 2)); return len(cells) - 1
    from PIL import ImageDraw
    seqs['idle'] = [add(warp(right, i / 8, hair=5, cloth=4, bob=2 * np.sin(2 * np.pi * i / 8) + 2, sy=1 + 0.006 * np.sin(2 * np.pi * i / 8))) for i in range(8)]
    seqs['run'] = [add(warp(right, i / 8, hair=9, cloth=8, back=14, bob=14 * abs(np.sin(np.pi * i / 8 + 0.4)), lean=9, sx=1.04 - 0.05 * abs(np.sin(np.pi * i / 8)))) for i in range(8)]
    seqs['walk'] = seqs['run']
    seqs['dash'] = [add(warp(right, i / 6, hair=10, cloth=9, back=26, bob=4, lean=17, sx=1.12, sy=0.94)) for i in range(6)]
    seqs['light'] = [add(warp(right, 0.1 * i, hair=6, back=6 * i, lean=l, sx=sx_, bob=b)) for i, (l, sx_, b) in enumerate([(-7, 0.97, 0), (13, 1.1, 2), (9, 1.08, 0), (2, 1.0, 0)])]
    seqs['heavy'] = [add(warp(right, 0.1 * i, hair=8, back=10 * i, lean=l, sx=sx_, bob=b)) for i, (l, sx_, b) in enumerate([(-10, 0.95, 0), (6, 1.0, 6), (16, 1.14, 2), (4, 1.0, 0)])]
    for el in ('earth', 'wind', 'fire', 'water', 'lightning'):
        seqs[el] = [add(warp(right, 0.1, hair=6, back=4, lean=-4, sx=0.98)), add(warp(right, 0.3, hair=9, back=12, lean=8, sx=1.1, bob=2))]
    seqs['hit'] = [add(warp(right, 0.1 * i, hair=8, back=-16, lean=-13 + i, sx=0.95, sy=0.96)) for i in range(4)]
    kn = []
    for i, ang in enumerate((-30, -60, -80, -90, -90)):
        im = warp(right, 0, lean=0); im = im.rotate(ang, resample=Image.BICUBIC, expand=True); cells.append((im, im.width / 2, im.height - 2 - int(0.0))); kn.append(len(cells) - 1)
    seqs['knock'] = kn
    gi = []
    for i in range(5):
        base = warp(right, i / 5, hair=4, cloth=3); ring = Image.new('RGBA', (base.width * 3 // 2, base.height + 40), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
        cx, cy = ring.width // 2, ring.height - base.height // 2
        r0 = base.height * 0.62 + 4 * np.sin(i)
        for r, al in ((r0 + 14, 70), (r0 + 7, 150), (r0, 255)): d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(200, 130, 255, al), width=6)
        ring = ring.filter(ImageFilter.GaussianBlur(1.5)); ring.alpha_composite(base, ((ring.width - base.width) // 2, ring.height - base.height)); cells.append((ring, ring.width / 2, ring.height - 2)); gi.append(len(cells) - 1)
    seqs['guard'] = gi
    mg = []
    for i in range(6):
        base = warp(right, i / 6, hair=8 + 2 * i, cloth=6, back=-6 * i, bob=2 * i); ring = Image.new('RGBA', (int(base.width * 2.2), int(base.height * 1.5)), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
        cx, cy = ring.width // 2, ring.height - base.height // 2
        for k in range(1 + i):
            r = base.height * (0.35 + 0.13 * k) ; d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(190, 120, 255, 255 - 30 * k), width=7)
        ring = ring.filter(ImageFilter.GaussianBlur(2)); ring.alpha_composite(base, ((ring.width - base.width) // 2, ring.height - base.height)); cells.append((ring, ring.width / 2, ring.height - 2)); mg.append(len(cells) - 1)
    seqs['mega'] = mg; seqs['forms'] = [seqs['idle'][0]] * 6
    return cells, seqs

def build(name):
    fn, rowfn = SHEETS[name]; sheet = Image.open(os.path.join(SRC, fn)).convert('RGB'); rows = rowfn(sheet)
    big = upscale(np.asarray(sheet), name); cells, seqs = [], {}
    dcells = []
    for b in ROT[name](sheet):   # the 8-view turnaround, upscaled: front, front-right, right, back-right, back, back-left, left, front-left
        img = cutbig(big, b); bb = img.getbbox(); img = img.crop(bb); dcells.append((img, img.width / 2, img.height - 2))
    if name == 'kena':
        cells, seqs = kena_rig(dcells); rows = {}
    mass = lambda im: int(((np.asarray(im)[..., 3] > 200) & (np.asarray(im)[..., :3].max(-1) < 80)).sum())
    FIGONLY = {'light', 'heavy', 'earth', 'wind', 'fire', 'water', 'lightning'}   # effect-only pieces of these rows become projectiles, the character never vanishes
    raw = {}
    if name == 'kena': raw = None
    for rname, (boxes, mode) in (rows.items() if raw is not None else []):
        if rname in ('aerial', 'finisher') or not boxes: continue
        a_ = np.asarray(sheet).astype(int); bots = []
        for b in boxes:
            m = (np.abs(a_[b[1]:b[3], b[0]:b[2]] - 255).sum(-1) > 150).any(1); r = np.where(m)[0]; bots.append(b[1] + (r[-1] if len(r) else b[3] - b[1]))
        base = int(np.median(bots[:max(1, len(bots) // 2)] if mode == 'fix' else bots)); fx0 = (boxes[0][0] + boxes[0][2]) / 2; lst = []
        for b in boxes:
            img = cutbig(big, b); bb = img.getbbox()
            if not bb: continue
            cx = fx0 if mode == 'fix' else (b[0] + b[2]) / 2; img = img.crop(bb)
            lst.append((img, cx * K - (b[0] * K + bb[0]), base * K - (b[1] * K + bb[1]), mass(img)))
        raw[rname] = lst
    if raw is None: raw = {}
    Mi = np.median([m for *_, m in raw['idle']]) if raw else 1   # one body size: every row is scaled so its figures carry the standing figure's hair-and-outline mass
    for rname, lst in raw.items():
        ms = sorted(m for *_, m in lst); med = max(1, ms[len(ms) // 2]); f = min(1.35, max(0.75, (Mi / med) ** 0.5))
        top = max(m for *_, m in lst)
        if rname in FIGONLY:
            eff = [t for t in lst if t[3] < top * 0.25]
            if rname in ('earth', 'wind', 'fire', 'water', 'lightning') and eff:
                im = max(eff, key=lambda t: t[0].width * t[0].height)[0]; im.save(os.path.join(FXD, f'{name}_{rname}.png'))
            lst = [t for t in lst if t[3] >= top * 0.25]
            if rname in ('earth', 'wind', 'fire', 'water', 'lightning'): lst = lst[:2]
        ids = []
        for img, ax, ay, _ in lst:
            if abs(f - 1) > 0.03: img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS); ax *= f; ay *= f
            cells.append((img, ax, ay)); ids.append(len(cells) - 1)
        seqs[rname] = ids
    if name != 'kena':   # one body size: the turnaround views are drawn bigger than the action sprites
        f = (np.median([mass(c[0]) for c in dcells]) and (Mi / np.median([mass(c[0]) for c in dcells])) ** 0.5) or 1
    else: f = 1
    seqs['dirs'] = []
    for img, ax, ay in dcells:
        if abs(f - 1) > 0.03: img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS); ax *= f; ay *= f
        cells.append((img, ax, ay)); seqs['dirs'].append(len(cells) - 1)
    seqs.setdefault('earth', seqs.get('light', [0])); 
    for el in ('earth', 'wind', 'fire', 'water', 'lightning'): seqs.setdefault(el, seqs.get('heavy') or seqs['light'])
    seqs.setdefault('heavy', seqs['light']); seqs.setdefault('knock', seqs['hit']); seqs.setdefault('mega', seqs['light'])
    if name == 'kena':
        for el in ('earth', 'wind', 'fire', 'water', 'lightning'): pass
    seqs['forms'] = [seqs['idle'][0]] * 6
    # pack
    Wd, x, y, sh, pos = 2048, 0, 0, 0, []
    for img, _, _ in cells:
        if x + img.width > Wd: x, y, sh = 0, y + sh + 2, 0
        pos.append((x, y)); x += img.width + 2; sh = max(sh, img.height)
    atlas = Image.new('RGBA', (Wd, y + sh), (0, 0, 0, 0))
    for (img, _, _), p in zip(cells, pos): atlas.alpha_composite(img, p)
    atlas.save(os.path.join(OUT, name + '.webp'), quality=88, method=6); atlas.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT, name + '.png'), optimize=True)
    frames = [[p[0], p[1], img.width, img.height, round(ax), round(ay)] for (img, ax, ay), p in zip(cells, pos)]
    box = [max(fr[4] for fr in frames), max(fr[5] for fr in frames), max(fr[2] - fr[4] for fr in frames), max(fr[3] - fr[5] for fr in frames)]
    stand = cells[seqs['idle'][0]][0].height
    json.dump({'scale': K, 'stand': stand, 'box': box, 'frames': frames, 'seqs': seqs}, open(os.path.join(OUT, name + '.json'), 'w'), separators=(',', ':'))
    print(name, atlas.size, len(frames), 'frames; stand', stand, {k: len(v) for k, v in seqs.items()})
    # contact sheet for checking
    from PIL import ImageDraw
    rowsk = list(seqs); cw = 150; ch = 150; cs = Image.new('RGB', (cw * 12, ch * len(rowsk)), 'white'); d = ImageDraw.Draw(cs)
    for r, k in enumerate(rowsk):
        d.text((2, r * ch + 2), k, fill='red')
        for c, fi in enumerate(seqs[k][:12]):
            im = cells[fi][0]; s = min((cw - 6) / im.width, (ch - 16) / im.height); im2 = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
            cs.paste(im2, (c * cw + 3, r * ch + 14), im2)
    os.makedirs('/tmp/dc/out', exist_ok=True); cs.save(f'/tmp/dc/out/{name}_anim.png')

if __name__ == '__main__':
    for n in (sys.argv[1:] or SHEETS): build(n)
