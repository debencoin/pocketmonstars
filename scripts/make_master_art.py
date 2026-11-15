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
  'covo': dict(file='covo_sheet_v1.png', dark=22, glow=(170, 80, 255),
    side=(916, 503, 987, 598),   # the painted backgrounds behind the big views can't be cut away cleanly, so he runs as his Initiate form
    poses=[('staff', (165, 368, 288, 505)), ('waterspin', (292, 368, 428, 505)), ('ring', (428, 368, 568, 505)), ('fire', (570, 368, 708, 505)),
           ('waterslash', (710, 368, 858, 505)), ('origin', (952, 692, 1178, 898))],
    forms=[(916, 503, 987, 598), (916, 503, 987, 598), (1010, 500, 1085, 598), (1105, 500, 1185, 598), (1295, 500, 1375, 598), (1414, 494, 1498, 594)]),
  # the creator's second set of element benders (and the fire sheet for Ignar). Sheets are full-colour on white paper.
  'ignar': dict(tol=20, glow=(255, 120, 30), blank=[(928, 840, 1254, 1254)],   # paint out the detail panel beside the jumping pose
    side=(745, 5, 975, 495),
    poses=[('fireball', (5, 555, 362, 862)), ('stomp', (340, 580, 690, 858)), ('spiral', (675, 555, 985, 880))],
    forms=[(5, 885, 170, 1185), (5, 885, 170, 1185), (170, 855, 350, 1185), (350, 855, 520, 1185), (520, 855, 735, 1185), (735, 855, 925, 1185)]),
  'aerix': dict(tol=20, glow=(150, 200, 255),
    side=(700, 5, 945, 375),
    poses=[('push', (5, 450, 275, 670)), ('slash', (275, 440, 488, 670)), ('cyclone', (715, 430, 955, 670)), ('burst', (695, 725, 955, 895)),
           ('shield', (5, 705, 225, 895)), ('dash', (460, 725, 690, 895)), ('glider', (220, 705, 465, 895)), ('levitate', (488, 430, 715, 670))],
    forms=[(5, 975, 125, 1160), (5, 975, 125, 1160), (125, 970, 250, 1160), (248, 960, 380, 1160), (380, 960, 515, 1160), (515, 955, 655, 1160)]),
  'bouldar': dict(tol=20, glow=(150, 210, 60),
    side=(715, 5, 950, 378),
    poses=[('push', (10, 435, 255, 602)), ('spike', (250, 435, 455, 602)), ('shield', (452, 428, 700, 602)), ('wave', (697, 435, 957, 602)),
           ('boulder', (15, 640, 205, 812)), ('pillar', (195, 640, 420, 812)), ('quake', (420, 640, 715, 812)), ('wall', (715, 640, 955, 812))],
    forms=[(15, 870, 140, 1040), (140, 855, 290, 1040), (290, 870, 425, 1040), (425, 855, 585, 1040), (585, 855, 760, 1040), (760, 850, 955, 1040)]),
  'nerin': dict(tol=20, glow=(60, 160, 255),
    side=(720, 5, 935, 378),
    poses=[('push', (5, 440, 245, 612)), ('whip', (245, 428, 470, 612)), ('shield', (470, 428, 715, 612)), ('wave', (715, 428, 955, 612)),
           ('spear', (5, 650, 240, 818)), ('surge', (240, 650, 480, 818)), ('whirlpool', (480, 650, 705, 818)), ('dragon', (705, 650, 955, 818))],
    forms=[(10, 870, 125, 1042), (125, 865, 265, 1042), (265, 860, 405, 1042), (405, 860, 540, 1042), (540, 855, 675, 1042), (815, 855, 960, 1042)]),
  # one-form sheets (no evolution row): every stage is the front view, the glow grows with the stage.
  # Painted backgrounds behind these drawings are cut away with an anime matting model (rembg, isnet-anime).
  'zuri': dict(tol=24, ai={(0, 560, 410, 1048), (410, 560, 832, 1050), (830, 575, 1254, 1050)}, boost=True, glow=(80, 170, 255),   # the action poses sit in a glow that only the matting model can cut
    side=(800, 5, 1030, 520),
    poses=[('push', (0, 560, 410, 1048)), ('rise', (410, 560, 832, 1050)), ('orb', (830, 575, 1254, 1050))],
    forms=[(0, 5, 290, 520)] * 6),
  # VORRAK, the crimson saber master (art-src/masters/vorrak_sheet.png): painted dark background, cut with the matting model
  'vorrak': dict(matte='ai', model='birefnet-general-lite', saber=(255, 30, 40), glow=(255, 40, 40),
    side=(700, 0, 885, 338),
    poses=[('saber', (228, 382, 402, 562)), ('grip', (383, 382, 563, 562)), ('crush', (588, 376, 762, 568)), ('cape', (748, 382, 918, 562))],
    forms=[(38, 0, 282, 338)] * 6),
  'verdex': dict(matte='ai', glow=(90, 255, 60),
    side=(950, 0, 1225, 550),
    poses=[('orb', (415, 605, 672, 1000)), ('blade', (668, 605, 945, 1000)), ('turn', (940, 600, 1195, 1000))],
    forms=[(0, 0, 385, 550)] * 6),
}

_SESSIONS = {}
def matte(sheet, box, boost=False, model='isnet-anime', saber=None):
    """Cut a drawing off a painted background with the anime matting model, keeping only the main figure."""
    from rembg import remove, new_session
    if model not in _SESSIONS: _SESSIONS[model] = new_session(model)
    out = remove(sheet.crop(box).convert('RGB'), session=_SESSIONS[model])
    if boost: out.putalpha(out.split()[3].point(lambda v: max(0, min(255, (v - 20) * 3))))   # glowing drawings come out faint: firm them up
    a = np.asarray(out.split()[3]) > 40
    from scipy import ndimage
    lab, n = ndimage.label(a); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)) if n else []
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > max(sizes) * 0.04]) if n else a
    al = np.asarray(out.split()[3]) * keep; out.putalpha(Image.fromarray(al.astype(np.uint8), 'L'))
    if saber:  # the matting model keeps an energy blade's white core but drops its glow: paint the glow back around bright pixels
        rgb = np.asarray(out.convert('RGB')).astype(int); hot = ((rgb.min(-1) > 200) & (al > 120)).astype(np.uint8) * 255
        g = Image.fromarray(hot, 'L').filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(6))
        halo = Image.new('RGBA', out.size, saber + (0,)); halo.putalpha(g.point(lambda v: min(255, v * 2)))
        out = Image.alpha_composite(halo, out)
    return out.crop(out.getbbox())

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

FX = {  # effect-only crops from the Chosen One sprite sheet (the little character is left out)
  'basic': (1000, 125, 1062, 186), 'earth': (950, 312, 1042, 361), 'wind': (948, 368, 1048, 414), 'fire': (950, 421, 1042, 470),
  'water': (950, 475, 1048, 524), 'lightning': (950, 529, 1062, 580), 'guard': (575, 642, 600, 688), 'dash': (190, 438, 330, 472)}

def build_azaelion():
    """AZAELION (the Chosen One) looks like the big character art (art-src/masters/covo_design.png) and moves like the sprite sheet:
    run cycle, a pose + effect per element, guard, dash and the Origin Burst ring."""
    design = Image.open(os.path.join(SRC, 'covo_design.png')); sheet = Image.open(os.path.join(SRC, 'covo_sheet.png'))
    front = cut(design, (0, 0, 255, 322), 26); side = cut(design, (262, 20, 412, 318), 26).transpose(Image.FLIP_LEFT_RIGHT)
    glowc = (170, 80, 255)
    def body(h):
        return front.resize((round(front.width * h / front.height), h), Image.LANCZOS)
    def with_fx(key, h=214, fxw=124, gap=-18, dy=0.0):
        b = body(h); fx = cut(sheet, FX[key], 26); fx = fx.resize((fxw, max(1, round(fx.height * fxw / fx.width))), Image.LANCZOS)
        fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bx = 4; fr.alpha_composite(b, (bx, H - 6 - b.height))
        fr.alpha_composite(fx, (min(W - fx.width, bx + b.width + gap), int(H - 6 - b.height * (0.62 + dy) - fx.height / 2))); return fr
    idle = place(front, (H - 40) / front.height)
    idle2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sq = idle.resize((W, round(H * 0.985)), Image.LANCZOS); idle2.alpha_composite(sq, (0, H - sq.height))
    k = (H - 40) / side.height; sp = place(side, k); run = A['frames'](sp.crop(sp.getbbox()))[2:6]
    basic = with_fx('basic', fxw=110)
    elems = [with_fx(e) for e in ('earth', 'wind', 'fire', 'water')]
    ring = fit_ring = None
    mega = cut(sheet, (1085, 695, 1310, 832), 26); mega = mega.resize((W - 8, round(mega.height * (W - 8) / mega.width)), Image.LANCZOS)
    og = Image.new('RGBA', (W, H), (0, 0, 0, 0)); og.alpha_composite(mega, (4, H - 6 - mega.height))
    b = body(206); og.alpha_composite(b, ((W - b.width) // 2, H - 6 - b.height))
    light = with_fx('lightning', fxw=124)
    g = body(214)
    from PIL import ImageDraw
    ring = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
    for r, al in ((118, 90), (110, 170), (102, 255)): d.ellipse((W // 2 - r + 30, H // 2 - r + 25, W // 2 + r + 30, H // 2 + r + 25), outline=(190, 120, 255, al), width=4)
    ring = ring.filter(ImageFilter.GaussianBlur(1.2))
    guard = Image.new('RGBA', (W, H), (0, 0, 0, 0)); guard.alpha_composite(ring); guard.alpha_composite(g, (28, H - 6 - g.height))
    ds = sp.crop(sp.getbbox()); ds = ds.resize((round(ds.width * 190 / ds.height), 190), Image.LANCZOS)
    dash = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n, a in ((3, 0.18), (2, 0.3), (1, 0.5)):   # purple speed trail behind the lean
        ghost = ds.copy(); ghost.putalpha(ghost.split()[3].point(lambda v: int(v * a))); dash.alpha_composite(glow(ghost, glowc, 2), (W - ds.width - 4 - n * 34, H - 6 - ds.height))
    dash.alpha_composite(ds, (W - ds.width - 4, H - 6 - ds.height))
    poses = [basic, *elems, og, light, guard, dash]
    for st_i in range(6):
        t = max(0, st_i - 1); fs = [glow(f, glowc, t) for f in [idle, idle2, *run, *poses]]
        sh = Image.new('RGBA', (W * len(fs), H), (0, 0, 0, 0))
        for i, f in enumerate(fs): sh.paste(f, (i * W, 0))
        sh.save(os.path.join(WALK, f'azaelion_s{st_i}.png'), optimize=True); fs[0].save(os.path.join(HD, f'azaelion_s{st_i}.png'), optimize=True)
        if st_i == 2: fs[0].save(os.path.join(HD, 'azaelion.png'), optimize=True)
    print('azaelion', len(fs), 'frames (design art + sheet moves)')


if __name__ == '__main__':
    only = set(sys.argv[1:])
    if not only or 'azaelion' in only: build_azaelion()
    for name, d in D.items():
        if only and name not in only: continue
        sheet = Image.open(os.path.join(SRC, d.get('file', name + '_sheet.png')))
        if d.get('blank'):
            from PIL import ImageDraw
            sheet = sheet.convert('RGB'); dr = ImageDraw.Draw(sheet)
            for r in d['blank']: dr.rectangle(r, fill=(255, 255, 255))
        ai = d.get('ai', set())
        def cutf(sh, box, *a, _c={}, _ai=ai, _all=d.get('matte') == 'ai'):
            if not (_all or box in _ai): return cut(sh, box, *a)
            if box not in _c: _c[box] = matte(sh, box, d.get('boost', False), d.get('model', 'isnet-anime'), d.get('saber'))
            return _c[box]
        side = cutf(sheet, d['side'], d.get('tol', 20), d.get('dark')); k = (H - 40) / side.height          # one scale for the big drawings
        if d.get('run'):
            rk = (H - 40) / max(cutf(sheet, b, d.get('tol', 20)).height for b in d['run'])
            run = [place(cutf(sheet, b, d.get('tol', 20)), rk) for b in d['run']]
        else: run = A['frames'](place(side, k).crop(place(side, k).getbbox()))[2:6]
        fit = lambda im: place(im, min((W - 8) / im.width, (H - 24) / im.height))   # each power pose fills the frame like the idle and run drawings
        poses = [fit(cutf(sheet, b, d.get('tol', 20), d.get('dark'))) for _, b in d['poses']]
        for st in range(6):
            form = cutf(sheet, d['forms'][st], d.get('tol', 20), d.get('dark')); idle = place(form, (H - 40) * [0.86, 0.92, 1, 1, 1, 1][st] / form.height)
            idle2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sq = idle.resize((W, round(H * 0.985)), Image.LANCZOS); idle2.alpha_composite(sq, (0, H - sq.height))
            t = max(0, st - 1); fs = [glow(f, d['glow'], t) for f in [idle, idle2, *run, *poses]]
            sh = Image.new('RGBA', (W * len(fs), H), (0, 0, 0, 0))
            for i, f in enumerate(fs): sh.paste(f, (i * W, 0))
            sh.save(os.path.join(WALK, f'{name}_s{st}.png'), optimize=True); fs[0].save(os.path.join(HD, f'{name}_s{st}.png'), optimize=True)
            if st == 2: fs[0].save(os.path.join(HD, name + '.png'), optimize=True)
        print(name, len(fs), 'frames')
