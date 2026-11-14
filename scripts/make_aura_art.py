#!/usr/bin/env python3
"""Aura Warriors drawn straight from the creator's own drawings (art-src/aura/<name>.jpg).
Cuts each drawing out of its background and writes 6-frame sheets (idle A, idle B, run 1-4) at 3x the usual frame size
(288x336) for every stage (_s0.._s5) and the five Aura forms (_a1.._a5: glowing aura + hair in the Aura colour)."""
import os, sys, colorsys
from collections import deque
from PIL import Image, ImageFilter, ImageChops
ROOT = os.path.join(os.path.dirname(__file__), '..'); SRC = os.path.join(ROOT, 'art-src', 'aura')
WALK = os.path.join(ROOT, 'dist', 'art', 'walk'); HD = os.path.join(ROOT, 'dist', 'art', 'hd')
W, H = 288, 336
# tol: background colour tolerance; crop: (l, t, r, b) fractions trimmed first; hair: hair colour recoloured in Aura forms
D = {
  'dashi': dict(tol=17, crop=(0, 0.04, 0, 0.02), hair=(190, 160, 120), htol=45, gr=0.75),
  'bolo':  dict(tol=30, crop=(0, 0, 0, 0), hair=(70, 75, 20), htol=55, gr=0.9),
  'swish': dict(tol=30, crop=(0, 0, 0, 0), hair=(55, 60, 15), htol=45, gr=0.9),
  'kapri': dict(tol=30, crop=(0, 0, 0.02, 0), hair=(60, 62, 14), htol=50, gr=0.9),
  'nyla':  dict(tol=30, crop=(0, 0, 0, 0), hair=(170, 135, 70), htol=50, gr=0.7),
  'verdo': dict(tol=14, crop=(0, 0, 0, 0.03), hair=None),
  'bunzo': dict(tol=30, crop=(0, 0, 0, 0), hair=None),
  'bunzo_baby': dict(tol=30, crop=(0, 0, 0, 0.5), hair=None, only_for='bunzo'),   # the bear as a baby: Bunzo's Infant and Rookie stages
  'tigo':  dict(tol=30, crop=(0, 0, 0, 0.07), hair=None),
  'vikko': dict(tol=14, crop=(0, 0, 0, 0), hair=None),
  'noxx':  dict(tol=30, crop=(0, 0, 0, 0.03), hair=None),
}
AURA = ['#ffd23f', '#b45aff', '#3aff7a', '#ff3b3b', '#f4fbff']
hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def cutout(name, d):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB')
    w, h = im.size; l, t, r, b = d['crop']; im = im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b))))
    if max(im.size) > 900: im.thumbnail((900, 900), Image.LANCZOS)
    w, h = im.size; px = im.load(); tol = d['tol']
    from collections import Counter
    border = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for y in range(h) for x in (0, w - 1)]
    key = Counter((c[0] // 24, c[1] // 24, c[2] // 24) for c in border).most_common(1)[0][0]
    grp = [c for c in border if (c[0] // 24, c[1] // 24, c[2] // 24) == key]; ref0 = tuple(sum(c[i] for c in grp) // len(grp) for i in range(3))
    bg = [[False] * w for _ in range(h)]; q = deque()
    def near(a, c, k=3): return abs(a[0] - c[0]) + abs(a[1] - c[1]) + abs(a[2] - c[2]) <= tol * k
    drift = d.get('drift', 0)
    for x in range(w):
        for y in (0, h - 1):
            if near(px[x, y], ref0): q.append((x, y, ref0))
    for y in range(h):
        for x in (0, w - 1):
            if near(px[x, y], ref0): q.append((x, y, ref0))
    while q:  # flood from the border through pixels close to the paper colour
        x, y, ref = q.popleft()
        if bg[y][x] or not near(px[x, y], ref): continue
        bg[y][x] = True; c = px[x, y]; nref = tuple((ref[i] * (8 - drift) + c[i] * drift) // 8 for i in range(3)) if drift else ref
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx]: q.append((nx, ny, nref))
    # keep only the biggest connected piece (drops logos, signatures, stray marks)
    lab = [[0] * w for _ in range(h)]; best, bestn, cur = 0, 0, 0
    for y0 in range(h):
        for x0 in range(w):
            if bg[y0][x0] or lab[y0][x0]: continue
            cur += 1; n = 0; q = deque([(x0, y0)]); lab[y0][x0] = cur
            while q:
                x, y = q.popleft(); n += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and not lab[ny][nx]: lab[ny][nx] = cur; q.append((nx, ny))
            if n > bestn: best, bestn = cur, n
    a = Image.new('L', (w, h), 0); ap = a.load()
    for y in range(h):
        for x in range(w):
            if lab[y][x] == best: ap[x, y] = 255
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(a); return out.crop(a.getbbox())

def fit(im):
    s = min((W - 64) / im.width, (H - 40) / im.height); return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def recolor_hair(im, d, col):
    hair, htol, gr = d['hair'], d['htol'], d['gr']; hl = max(hair)
    out = im.copy(); p = out.load(); hh, ss, _ = colorsys.rgb_to_hsv(*[c / 255 for c in col])
    for y in range(int(out.height * 0.75)):
        for x in range(out.width):
            r, g, b, a = p[x, y]
            if a < 40 or max(r, g, b) < 34 or min(r, g, b) > 225: continue   # keep the ink outline and the whites
            if abs(r - hair[0]) + abs(g - hair[1]) + abs(b - hair[2]) <= htol * 3 and g >= r * gr:
                v = min(1.0, 0.55 + 0.45 * max(r, g, b) / hl); nr, ng, nb = colorsys.hsv_to_rgb(hh, ss * (1 if ss > 0.2 else 0.3), v)
                p[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return out

def with_aura(im, col, t):
    pad = 22; base = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0)); base.paste(im, (pad, pad), im)
    al = base.split()[3]; glow = al.filter(ImageFilter.MaxFilter(9 + 2 * t)).filter(ImageFilter.GaussianBlur(3 + t * 0.6))
    g = Image.new('RGBA', base.size, col + (0,)); g.putalpha(glow.point(lambda v: min(255, int(v * 1.3))))
    return Image.alpha_composite(g, base)

def frames(im, legs=True):
    """idle A, idle B, then a 4-frame run: the legs are cut from the drawing and swung (one forward and lifted, the other back),
    with the body leaning forward and bouncing on each step."""
    w, h = im.size; cut = int(h * 0.76); mid = w // 2; M = 26
    O = 8; upper = im.crop((0, 0, w, cut + 2)); legL = im.crop((0, cut - O, mid, h)); legR = im.crop((mid, cut - O, w, h))
    def swing(leg, k, lift):   # shear the leg sideways from the hip (k px per row) and shorten it by `lift` (foot off the ground)
        lw, lh = leg.size; big = Image.new('RGBA', (lw + M * 2, lh), (0, 0, 0, 0)); big.paste(leg, (M, 0))
        out = big.transform(big.size, Image.AFFINE, (1, -k, 0, 0, 1, 0), resample=Image.BICUBIC)
        return out.resize((out.width, max(1, round(lh * (1 - lift)))), Image.LANCZOS) if lift else out
    def pose(kl, liftl, kr, liftr, bob, lean):
        body = Image.new('RGBA', (w + M * 2, h + 8), (0, 0, 0, 0))
        l = swing(legL, kl, liftl); r = swing(legR, kr, liftr)
        body.paste(l, (0, cut - O), l); body.alpha_composite(r, (mid, cut - O)); body.alpha_composite(upper, (M, bob))
        return body.rotate(lean, resample=Image.BICUBIC, expand=True) if lean else body
    if not legs:   # no legs to swing (the baby): a waddle, rocking side to side with a hop
        def wad(bob, lean):
            body = Image.new('RGBA', (w + M * 2, h + 8), (0, 0, 0, 0)); body.alpha_composite(im, (M, 8 + bob)); return body.rotate(lean, resample=Image.BICUBIC, expand=True) if lean else body
        poses = [wad(0, 0), None, wad(0, -8), wad(-8, -3), wad(0, 8), wad(-8, 3)]
    else: poses = [pose(0, 0, 0, 0, 0, 0), None, pose(0.55, 0.3, -0.45, 0, 3, -5), pose(0.12, 0.08, -0.1, 0, -4, -4), pose(-0.45, 0, 0.55, 0.3, 3, -5), pose(-0.1, 0, 0.12, 0.08, -4, -4)]
    idle = poses[0]; poses[1] = idle.resize((idle.width, round(idle.height * 0.985)), Image.LANCZOS)   # idle B: a small breath
    out = []
    for s2 in poses:
        fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fr.alpha_composite(s2, ((W - s2.width) // 2, H - 6 - s2.height + (8 if s2 is not poses[1] else 8))); out.append(fr)
    return out

def save(name, suffix, im, legs=True):
    fs = frames(im, legs); sheet = Image.new('RGBA', (W * 6, H), (0, 0, 0, 0))
    for i, fr in enumerate(fs): sheet.paste(fr, (i * W, 0))
    sheet.save(os.path.join(WALK, f'{name}{suffix}.png'), optimize=True); fs[0].save(os.path.join(HD, f'{name}{suffix}.png'), optimize=True)
    return fs[0]

only = set(sys.argv[1:])
for name, d in D.items():
    if d.get('only_for') or (only and name not in only): continue
    cut = cutout(name, d); base = fit(cut)
    baby = fit(cutout(name + '_baby', D[name + '_baby'])) if name + '_baby' in D else None
    if baby: baby = baby.resize((round(baby.width * 0.8), round(baby.height * 0.8)), Image.LANCZOS)
    for st in range(6): f0 = save(name, f'_s{st}', baby if baby and st < 2 else base, not (baby and st < 2))
    Image.open(os.path.join(HD, name + '_s2.png')).save(os.path.join(HD, name + '.png'), optimize=True)
    for t, colh in enumerate(AURA, 1):
        col = hexc(colh); im = recolor_hair(cut, d, col) if d.get('hair') else cut
        save(name, f'_a{t}', fit(with_aura(im, col, t)))
    print(name, cut.size)
