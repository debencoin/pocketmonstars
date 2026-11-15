#!/usr/bin/env python3
"""Element Masters drawn straight from the creator's character sheets (art-src/masters/<name>_sheet.png).
Every pose on the sheet becomes a frame, so each power plays the pose (and its wind / water / fire effect) from the sheet:
 0-1 idle (the form for that stage), 2-5 run (the side view, legs swinging), 6+ one frame per power pose (see POSES).
Frames are 288x336 like the Aura Warriors; one sheet per stage (_s0.._s5)."""
import os, sys, runpy
from collections import deque
import numpy as np
from PIL import Image, ImageFilter
ROOT = os.path.join(os.path.dirname(__file__), '..'); SRC = os.path.join(ROOT, 'art-src', 'masters')
WALK = os.path.join(ROOT, 'dist', 'art', 'walk'); HD = os.path.join(ROOT, 'dist', 'art', 'hd')
W, H = 288, 336
A = runpy.run_path(os.path.join(os.path.dirname(__file__), 'make_aura_art.py'), run_name='lib')
# crop boxes on the sheet (x0, y0, x1, y1)
D = {
  'zephar': dict(tol=20, glow=(150, 110, 230),
    side=(621, 6, 855, 362),
    poses=[('push', (7, 413, 251, 629)), ('slash', (250, 413, 468, 629)), ('cyclone', (669, 413, 924, 629)), ('burst', (675, 676, 920, 846)),
           ('shield', (5, 676, 212, 846)), ('dash', (445, 676, 672, 846)), ('glider', (201, 676, 450, 846)), ('levitate', (468, 413, 676, 629))],
    forms=[(9, 911, 119, 1130), (9, 911, 119, 1130), (123, 911, 243, 1130), (234, 911, 372, 1130), (368, 911, 514, 1130), (498, 911, 645, 1130)]),
}

def cut(sheet, box, tol):
    im = sheet.crop(box).convert('RGB'); a = np.asarray(im).astype(int); h, w = a.shape[:2]
    near = np.abs(a - 255).sum(-1) <= tol * 3          # paper white
    bg = np.zeros((h, w), bool); q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y, x] or not near[y, x]: continue
        bg[y, x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny, nx]: q.append((nx, ny))
    from scipy import ndimage   # drop specks of other drawings at the crop edges
    lab, n = ndimage.label(~bg); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 60])
    al = Image.fromarray((keep * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert('RGBA'); out.putalpha(al); return out.crop(al.getbbox())

def place(im, k):
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    if im.width > W - 8: im = im.resize((W - 8, round(im.height * (W - 8) / im.width)), Image.LANCZOS)
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fr.alpha_composite(im, ((W - im.width) // 2, H - 6 - im.height)); return fr

def glow(fr, col, t):
    if not t: return fr
    al = fr.split()[3].filter(ImageFilter.MaxFilter(5 + 2 * t)).filter(ImageFilter.GaussianBlur(3 + t))
    g = Image.new('RGBA', fr.size, col + (0,)); g.putalpha(al.point(lambda v: int(v * (0.25 + 0.12 * t))))
    return Image.alpha_composite(g, fr)

if __name__ == '__main__':
    only = set(sys.argv[1:])
    for name, d in D.items():
        if only and name not in only: continue
        sheet = Image.open(os.path.join(SRC, name + '_sheet.png'))
        side = cut(sheet, d['side'], d['tol']); k = (H - 40) / side.height          # one scale for the big drawings
        run = A['frames'](place(side, k).crop(place(side, k).getbbox()))[2:6]
        fit = lambda im: place(im, min((W - 8) / im.width, (H - 24) / im.height))   # each power pose fills the frame like the idle and run drawings
        poses = [fit(cut(sheet, b, d['tol'])) for _, b in d['poses']]
        for st in range(6):
            form = cut(sheet, d['forms'][st], d['tol']); idle = place(form, (H - 40) * [0.86, 0.92, 1, 1, 1, 1][st] / form.height)
            idle2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sq = idle.resize((W, round(H * 0.985)), Image.LANCZOS); idle2.alpha_composite(sq, (0, H - sq.height))
            t = max(0, st - 1); fs = [glow(f, d['glow'], t) for f in [idle, idle2, *run, *poses]]
            sh = Image.new('RGBA', (W * len(fs), H), (0, 0, 0, 0))
            for i, f in enumerate(fs): sh.paste(f, (i * W, 0))
            sh.save(os.path.join(WALK, f'{name}_s{st}.png'), optimize=True); fs[0].save(os.path.join(HD, f'{name}_s{st}.png'), optimize=True)
            if st == 2: fs[0].save(os.path.join(HD, name + '.png'), optimize=True)
        print(name, len(fs), 'frames')
