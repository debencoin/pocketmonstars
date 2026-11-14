#!/usr/bin/env python3
"""Watcher Gods: full-body fighters built from the creator's pictures (art-src/gods/<name>.jpg).
The picture is the head (or the head and chest); the rest of the body is drawn to match it in the same metals:
broad collar, armoured chest, arm bands, kilt, legs. Output: 6-frame sheets (idle A/B, run 1-4) for every stage
(_s0.._s5; the later stages gain a sun disc and rays) at 288x336, same as the Aura Warriors."""
import os, sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location('aura', os.path.join(os.path.dirname(__file__), 'make_aura_art.py'))
ROOT = os.path.join(os.path.dirname(__file__), '..'); SRC = os.path.join(ROOT, 'art-src', 'gods')
WALK = os.path.join(ROOT, 'dist', 'art', 'walk'); HD = os.path.join(ROOT, 'dist', 'art', 'hd')
W, H = 288, 336; CW, CH, CX = 760, 1040, 380
hexc = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
GOLD, SILV, COPP, ROSE = '#e0b028', '#c8ccd4', '#b8643a', '#e0a088'
# kind: bust (picture shows head + chest) | face (picture is a close-up face: a headdress-shaped cut-out)
D = {
  'anpurak': dict(kind='bust', bg=28, m1=GOLD, m2=SILV, acc=ROSE, gem='#3aa0ff', crop=(0, 0, 0, 0.06)),
  'wepwarr': dict(kind='bust', bg=26, m1=SILV, m2=SILV, acc='#e08a50', gem='#5a5aff', crop=(0.04, 0, 0.04, 0)),
  'khemtek': dict(kind='face', mask='nemes', m1='#2a3e58', m2=GOLD, acc='#f09a20', gem='#f09a20', crop=(0.08, 0, 0.08, 0.14)),
  'duatron': dict(kind='face', mask='nemes', m1=GOLD, m2='#5a6068', acc=GOLD, gem='#d02030', crop=(0.08, 0, 0.08, 0.1)),
  'selqira': dict(kind='face', mask='oval', m1=SILV, m2=GOLD, acc='#d83a2a', gem='#3ad0c8', crop=(0.04, 0, 0.04, 0.04)),
  'isetra':  dict(kind='face', mask='nemes', m1='#1e2a4a', m2=GOLD, acc='#c82a2a', gem='#3ad0c8', crop=(0.08, 0, 0.08, 0.06)),
  'ptahrex': dict(kind='face', mask='hood', m1=COPP, m2=SILV, acc='#2a3ab0', gem='#30e080', crop=(0.22, 0, 0.1, 0.34)),
  'khnumek': dict(kind='bust', bg=16, ref=(0, 0, 0), m1=GOLD, m2=SILV, acc=COPP, gem='#e02040', crop=(0, 0, 0, 0)),
  'apisor':  dict(kind='face', mask='wide', m1=GOLD, m2=GOLD, acc='#1e5a8a', gem='#2a6aff', crop=(0, 0, 0, 0.04)),
  'wadjeth': dict(kind='face', mask='hood', m1=GOLD, m2='#c8d8e8', acc='#7a1a1a', gem='#2a4aff', crop=(0.1, 0, 0.1, 0.12), robe=True),
}

def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)
def metal(size, col, seed=0):
    """A brushed-metal fill: bright band left of centre, darker edges, faint engraved marks."""
    w, h = size; x = np.linspace(0, 1, w)[None, :]; y = np.linspace(0, 1, h)[:, None]
    k = 0.62 + 0.55 * np.exp(-((x - 0.36) ** 2) / 0.035) + 0.18 * np.exp(-((x - 0.8) ** 2) / 0.01) - 0.18 * y
    a = np.clip(np.stack([k * col[i] for i in range(3)], -1), 0, 255).astype(np.uint8)
    im = Image.fromarray(a, 'RGB').convert('RGBA'); d = ImageDraw.Draw(im); r = random.Random(seed)
    for _ in range(int(w * h / 900)):   # engraved glyph marks
        gx, gy = r.random() * w, r.random() * h; s = 5 + r.random() * 7; dark = shade(col, 0.45) + (190,)
        t = r.randrange(4)
        if t == 0: d.line([gx, gy, gx + s, gy], fill=dark, width=2)
        elif t == 1: d.line([gx, gy, gx, gy + s], fill=dark, width=2)
        elif t == 2: d.ellipse([gx, gy, gx + s * 0.7, gy + s * 0.7], outline=dark, width=2)
        else: d.line([gx, gy + s, gx + s / 2, gy, gx + s, gy + s], fill=dark, width=2)
    return im
def part(canvas, poly_fn, col, seed=0, bbox=None):
    """Draws a filled shape with the metal texture. poly_fn(draw) paints the shape in white on a mask."""
    m = Image.new('L', canvas.size, 0); poly_fn(ImageDraw.Draw(m)); bb = m.getbbox()
    if not bb: return
    tex = metal((bb[2] - bb[0], bb[3] - bb[1]), col, seed); layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); layer.paste(tex, bb[:2]); layer.putalpha(m)
    edge = m.filter(ImageFilter.MaxFilter(7)); ol = Image.new('RGBA', canvas.size, (14, 12, 18, 255)); ol.putalpha(edge)
    canvas.alpha_composite(ol); canvas.alpha_composite(layer)

def cut_bust(name, d):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB'); w, h = im.size; l, t, r, b = d['crop']
    im = im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b)))); im.thumbnail((640, 640), Image.LANCZOS); w, h = im.size
    a = np.asarray(im).astype(int); from collections import deque
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); ref = np.array(d['ref']) if d.get('ref') else np.median(edge, axis=0)
    close = np.abs(a - ref).sum(-1) <= d['bg'] * 3
    if d.get('soft'): close |= (np.abs(a - a.mean(-1, keepdims=True)).sum(-1) < 26) & (np.abs(a.mean(-1) - ref.mean()) < 46)   # blurry grey backdrops
    bg = np.zeros((h, w), bool); q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y, x] or not close[y, x]: continue
        bg[y, x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny, nx]: q.append((nx, ny))
    al = Image.fromarray((~bg * 255).astype(np.uint8), 'L').filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    out = im.convert('RGBA'); out.putalpha(al); return out.crop(al.getbbox())

def cut_face(name, d):
    im = Image.open(os.path.join(SRC, name + '.jpg')).convert('RGB'); w, h = im.size; l, t, r, b = d['crop']
    im = im.crop((int(w * l), int(h * t), int(w * (1 - r)), int(h * (1 - b)))); im.thumbnail((640, 640), Image.LANCZOS); w, h = im.size
    m = Image.new('L', (w, h), 0); g = ImageDraw.Draw(m)
    if d['mask'] == 'nemes':   # domed top, lappets widening to the bottom corners
        g.ellipse([w * 0.06, 0, w * 0.94, h * 0.9], fill=255); g.polygon([(w * 0.14, h * 0.35), (w * 0.86, h * 0.35), (w, h), (0, h)], fill=255)
    elif d['mask'] == 'hood': g.ellipse([0, 0, w, h * 1.1], fill=255); g.rounded_rectangle([0, h * 0.45, w, h], radius=int(w * 0.12), fill=255)
    elif d['mask'] == 'wide': g.rounded_rectangle([0, 0, w, h], radius=int(w * 0.3), fill=255); g.rectangle([0, 0, w, h * 0.45], fill=255); g.ellipse([w * 0.1, -h * 0.1, w * 0.9, h * 0.5], fill=255)
    else: g.ellipse([w * 0.03, 0, w * 0.97, h * 1.04], fill=255); g.rectangle([w * 0.03, 0, w * 0.97, h * 0.3], fill=255); g.rounded_rectangle([w * 0.03, 0, w * 0.97, h * 0.6], radius=int(w * 0.2), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(1.5)); out = im.convert('RGBA'); out.putalpha(m); return out

def figure(name, d, stage=2):
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); m1, m2, acc, gem = hexc(d['m1']), hexc(d['m2']), hexc(d['acc']), hexc(d['gem']); seed = sum(map(ord, name))
    bust = d['kind'] == 'bust'; pic = cut_bust(name, d) if bust else cut_face(name, d)
    pw = 500 if bust else 360; pic = pic.resize((pw, round(pic.height * pw / pic.width)), Image.LANCZOS)
    ptop = 60; pbot = ptop + pic.height
    ttop = pbot - (110 if bust else 70); th = 150 if bust else 250; sh = 205; wy = ttop + th; ky = wy + (190 if d.get('robe') else 125); ly = ky - 30; fy = CH - 16
    # arms (behind the body)
    for sgn in (-1, 1):
        ax = CX + sgn * (sh + 18); ay = ttop + (80 if bust else 36); al = 250
        part(c, lambda g: (g.rounded_rectangle([ax - 44, ay, ax + 44, ay + al], radius=40, fill=255), g.ellipse([ax - 56, ay - 34, ax + 56, ay + 66], fill=255)), m2, seed + sgn)
        part(c, lambda g: g.ellipse([ax - 34, ay + al - 26, ax + 34, ay + al + 42], fill=255), shade(m2, 0.9), seed + 3)
        for by in (ay + 70, ay + al - 60): part(c, lambda g: g.rounded_rectangle([ax - 44, by, ax + 44, by + 30], radius=8, fill=255), acc, seed + 5)
    # legs and feet
    for sgn in (-1, 1):
        lx = CX + sgn * 62
        part(c, lambda g: g.rounded_rectangle([lx - 46, ly, lx + 46, fy - 26], radius=30, fill=255), m2, seed + 7 + sgn)
        part(c, lambda g: g.rounded_rectangle([lx - 50, fy - 150, lx + 50, fy - 118], radius=8, fill=255), acc, seed + 9)
        part(c, lambda g: g.rounded_rectangle([lx - 58, fy - 52, lx + 58, fy], radius=22, fill=255), m1, seed + 11)
    # chest
    part(c, lambda g: g.polygon([(CX - sh, ttop + 26), (CX - sh + 30, ttop), (CX + sh - 30, ttop), (CX + sh, ttop + 26), (CX + 128, wy + 6), (CX - 128, wy + 6)], fill=255), m1, seed + 13)
    part(c, lambda g: g.rounded_rectangle([CX - 22, ttop + 60, CX + 22, wy - 6], radius=6, fill=255), acc, seed + 15)
    # kilt / robe with a striped apron, and a belt with a gem
    part(c, lambda g: g.polygon([(CX - 132, wy - 4), (CX + 132, wy - 4), (CX + 168, ky), (CX - 168, ky)], fill=255), m2 if d.get('robe') else acc, seed + 17)
    part(c, lambda g: g.polygon([(CX - 40, wy), (CX + 40, wy), (CX + 56, ky + 26), (CX - 56, ky + 26)], fill=255), m1, seed + 19)
    part(c, lambda g: g.rounded_rectangle([CX - 140, wy - 22, CX + 140, wy + 18], radius=10, fill=255), m2 if not d.get('robe') else acc, seed + 21)
    g = ImageDraw.Draw(c); g.ellipse([CX - 22, wy - 24, CX + 22, wy + 20], fill=(14, 12, 18, 255)); g.ellipse([CX - 16, wy - 18, CX + 16, wy + 14], fill=gem + (255,)); g.ellipse([CX - 10, wy - 14, CX, wy - 4], fill=(255, 255, 255, 200))
    if not bust:   # broad collar under the face
        for k, colr in enumerate([acc, m2, gem, m2, acc]):
            rr = 230 - k * 30; part(c, lambda g: g.pieslice([CX - rr, ttop - rr * 0.55 + 40, CX + rr, ttop + rr * 0.75 + 40], 0, 180, fill=255), colr, seed + 23 + k)
    # the picture: head (and chest), with a dark outline so it sits in the game like the other fighters
    al = pic.split()[3]; ol = Image.new('RGBA', pic.size, (14, 12, 18, 255)); big = Image.new('L', (pic.width + 16, pic.height + 16), 0); big.paste(al, (8, 8)); big = big.filter(ImageFilter.MaxFilter(9))
    olim = Image.new('RGBA', big.size, (14, 12, 18, 255)); olim.putalpha(big); c.alpha_composite(olim, (CX - pw // 2 - 8, ptop - 8)); c.alpha_composite(pic, (CX - pw // 2, ptop))
    if stage >= 3:   # evolved forms: a sun disc behind the head; the last form adds rays
        back = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); bg2 = ImageDraw.Draw(back); hy = ptop + min(pic.height, 380) * 0.4; R = (360 if not bust else 300) * (0.6 if stage < 5 else 0.66)
        if stage >= 5:
            for k in range(16): a = k / 16 * math.tau; bg2.polygon([(CX + math.cos(a - 0.07) * R, hy + math.sin(a - 0.07) * R), (CX + math.cos(a) * R * 1.45, hy + math.sin(a) * R * 1.45), (CX + math.cos(a + 0.07) * R, hy + math.sin(a + 0.07) * R)], fill=(255, 226, 120, 230))
        bg2.ellipse([CX - R, hy - R, CX + R, hy + R], fill=(255, 214, 90, 70 if stage < 5 else 110), outline=(255, 205, 70, 255), width=14 if stage >= 4 else 9)
        bg2.ellipse([CX - R - 5, hy - R - 5, CX + R + 5, hy + R + 5], outline=(110, 72, 10, 255), width=4)
        back.alpha_composite(c); c = back
    return c.crop(c.getbbox())

if __name__ == '__main__':
    only = set(sys.argv[1:])
    import runpy; A = runpy.run_path(os.path.join(os.path.dirname(__file__), 'make_aura_art.py'), run_name='lib'); A['frames'].__globals__['SWING'] = 0.5
    for name, d in D.items():
        if only and name not in only: continue
        for st in range(6):
            fig = figure(name, d, st); k = [0.92, 0.96, 1.0, 1.0, 1.0, 1.0][st]
            im = A['fit'](fig); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            f0 = A['save'](name, f'_s{st}', im)
            if st == 2: f0.save(os.path.join(HD, name + '.png'), optimize=True)
        print(name)
