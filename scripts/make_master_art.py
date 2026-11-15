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
  'terrok': dict(tol=20, glow=(120, 200, 60),
    side=(712, 8, 935, 376),
    poses=[('push', (8, 432, 250, 601)), ('spike', (247, 432, 451, 601)), ('shield', (451, 432, 690, 601)), ('wave', (690, 432, 954, 601)),
           ('boulder', (21, 642, 195, 812)), ('pillar', (186, 640, 422, 812)), ('quake', (421, 640, 714, 812)), ('wall', (715, 640, 956, 812))],
    forms=[(13, 862, 133, 1038), (13, 862, 133, 1038), (136, 852, 284, 1038), (286, 870, 417, 1038), (426, 860, 588, 1038), (756, 849, 956, 1038)]),
  'tydal': dict(tol=20, glow=(60, 150, 255),
    side=(715, 4, 931, 376),
    poses=[('push', (13, 429, 248, 611)), ('whip', (246, 429, 468, 611)), ('shield', (468, 429, 711, 611)), ('wave', (711, 429, 950, 611)),
           ('spear', (5, 653, 238, 818)), ('surge', (234, 653, 479, 818)), ('whirlpool', (479, 653, 702, 818)), ('dragon', (705, 653, 946, 818))],
    forms=[(13, 870, 114, 1039), (125, 866, 266, 1039), (264, 862, 398, 1039), (400, 855, 536, 1039), (536, 855, 672, 1039), (800, 852, 964, 1039)]),
  'covo': dict(tol=26, glow=(170, 80, 255),   # the Chosen One's own full sprite sheet: real run frames, one pose per power
    side=(219, 358, 277, 412),
    run=[(219, 358, 277, 412), (282, 358, 342, 412), (345, 358, 405, 412), (405, 358, 468, 412)],
    poses=[('basic', (950, 125, 1050, 186)), ('earth', (900, 312, 1042, 361)), ('wind', (900, 368, 1048, 414)), ('fire', (900, 421, 1042, 470)),
           ('water', (900, 475, 1048, 524)), ('origin', (1085, 695, 1310, 832)), ('lightning', (900, 529, 1062, 580)), ('guard', (543, 642, 598, 688)),
           ('dash', (940, 205, 1065, 272))],
    forms=[(18, 872, 80, 968), (18, 872, 80, 968), (130, 872, 187, 968), (240, 872, 300, 968), (360, 872, 417, 968), (480, 872, 545, 968)]),
}

def cut(sheet, box, tol=20, dark=None):
    """White-paper sheets: flood the paper from the crop edge. Dark sheets: flood everything darker than `dark`."""
    im = sheet.crop(box).convert('RGB'); a = np.asarray(im).astype(int); h, w = a.shape[:2]
    near = (a.max(-1) <= dark) if dark else (np.abs(a - 255).sum(-1) <= tol * 3)
    bg = np.zeros((h, w), bool); q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if bg[y, x] or not near[y, x]: continue
        bg[y, x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny, nx]: q.append((nx, ny))
    from scipy import ndimage   # drop specks of other drawings at the crop edges
    lab, n = ndimage.label(~bg); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); big = max(sizes) if n else 0
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > (big * 0.08 if dark else 60)])
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
        side = cut(sheet, d['side'], d.get('tol', 20), d.get('dark')); k = (H - 40) / side.height          # one scale for the big drawings
        if d.get('run'):
            rk = (H - 40) / max(cut(sheet, b, d.get('tol', 20)).height for b in d['run'])
            run = [place(cut(sheet, b, d.get('tol', 20)), rk) for b in d['run']]
        else: run = A['frames'](place(side, k).crop(place(side, k).getbbox()))[2:6]
        fit = lambda im: place(im, min((W - 8) / im.width, (H - 24) / im.height))   # each power pose fills the frame like the idle and run drawings
        poses = [fit(cut(sheet, b, d.get('tol', 20), d.get('dark'))) for _, b in d['poses']]
        for st in range(6):
            form = cut(sheet, d['forms'][st], d.get('tol', 20), d.get('dark')); idle = place(form, (H - 40) * [0.86, 0.92, 1, 1, 1, 1][st] / form.height)
            idle2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sq = idle.resize((W, round(H * 0.985)), Image.LANCZOS); idle2.alpha_composite(sq, (0, H - sq.height))
            t = max(0, st - 1); fs = [glow(f, d['glow'], t) for f in [idle, idle2, *run, *poses]]
            sh = Image.new('RGBA', (W * len(fs), H), (0, 0, 0, 0))
            for i, f in enumerate(fs): sh.paste(f, (i * W, 0))
            sh.save(os.path.join(WALK, f'{name}_s{st}.png'), optimize=True); fs[0].save(os.path.join(HD, f'{name}_s{st}.png'), optimize=True)
            if st == 2: fs[0].save(os.path.join(HD, name + '.png'), optimize=True)
        print(name, len(fs), 'frames')
