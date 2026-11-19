#!/usr/bin/env python3
"""COVO, COVA and Kena from the creator's three 'complete game sprite' sheets (art-src/masters).
Each sheet draws its character at one scale, so ONE scale per sheet (set by the standing body) keeps every move the same size.
Frames (288x336, feet on the floor, one sheet per stage):
 0-1 idle, 2-5 run, 6 staff strike, 7 earth, 8 wind, 9 fire, 10 water, 11 lightning, 12 guard, 13 dash, 14 origin burst, 15 hit,
 16-23 the 360-degree turnaround: front, front-right, right, back-right, back, back-left, left, front-left."""
import os, sys, runpy
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from dirlib import clusters
M = runpy.run_path(os.path.join(os.path.dirname(__file__), 'make_master_art.py'), run_name='lib')
cut, glow, W, H, SRC, WALK, HD, FX = M['cut'], M['glow'], M['W'], M['H'], M['SRC'], M['WALK'], M['HD'], M['FX']
BODY_H = 206

def cl(im, box, idx, gap=2, tol=60):
    c = clusters(im, box, gap=gap, minw=8, tol=tol); return [c[i] for i in idx]
def split(box, n, idx):
    w = (box[2] - box[0]) / n; return [(round(box[0] + i * w), box[1], round(box[0] + (i + 1) * w), box[3]) for i in idx]

def specs():
    A = Image.open(os.path.join(SRC, 'covo_new_sheet1.png')).convert('RGB')
    B = Image.open(os.path.join(SRC, 'cova_sheet.jpg')).convert('RGB')
    C = Image.open(os.path.join(SRC, 'kena_sheet.jpg')).convert('RGB')
    rotA = cl(A, (1012, 22, 1530, 96), range(11), gap=5, tol=40)
    S = {}
    S['covo'] = dict(im=A, glow=(170, 80, 255), tol=24,
      idle=cl(A, (20, 130, 600, 184), [2, 3]), run=cl(A, (20, 364, 600, 412), [1, 3, 5, 7]),
      basic=[(640, 130, 705, 188)], guard=cl(A, (350, 648, 610, 690), [1]), dash=cl(A, (20, 442, 600, 480), [3]), hit=cl(A, (20, 712, 320, 760), [1]),
      cast={'earth': (715, 313, 775, 359), 'wind': (712, 369, 770, 413), 'fire': (712, 421, 770, 467), 'water': (712, 475, 768, 520), 'lightning': (712, 527, 780, 575)},
      dirs=[(rotA[0], 0), (rotA[1], 0), (rotA[4], 0), (rotA[5], 0), (rotA[10], 0), (rotA[5], 1), (rotA[4], 1), (rotA[1], 1)])
    rotB = cl(B, (330, 22, 680, 92), range(8), gap=3, tol=40)
    S['cova'] = dict(im=B, glow=(150, 90, 255), tol=40,
      idle=cl(B, (60, 129, 312, 159), [2, 3]), run=cl(B, (60, 216, 312, 238), [1, 3, 5, 7]),
      basic=[(333, 141, 382, 168)], guard=cl(B, (60, 401, 312, 423), [1]), dash=cl(B, (60, 244, 312, 269), [4]), hit=cl(B, (60, 428, 312, 447), [2]),
      cast={'earth': (396, 244, 440, 272), 'wind': (395, 272, 441, 302), 'fire': (395, 302, 436, 333), 'water': (396, 333, 442, 363), 'lightning': (396, 363, 445, 394)},
      dirs=[(r, 0) for r in rotB])
    rotC = cl(C, (180, 26, 600, 96), range(8), gap=3, tol=40)
    S['kena'] = dict(im=C, glow=(190, 100, 255), tol=40, crisp=True,
      idle=split((160, 141, 375, 166), 7, [3, 4]), run=split((625, 141, 850, 164), 6, [2, 3, 4, 5]),
      basic=[(165, 268, 208, 297)], guard=split((160, 216, 375, 244), 5, [2]), dash=split((870, 141, 1118, 163), 6, [3]), hit=split((385, 216, 610, 244), 6, [2]),
      cast={'earth': (232, 358, 268, 392), 'wind': (398, 358, 432, 392), 'fire': (563, 358, 600, 392), 'water': (563, 358, 600, 392), 'lightning': (398, 358, 432, 392)},
      dirs=[(r, 0) for r in rotC])
    return S

def sheet_fx():
    A = Image.open(os.path.join(SRC, 'covo_new_sheet1.png')).convert('RGB')
    fx = {k: cut(A, v, 26) for k, v in FX.items() if k in ('basic', 'earth', 'wind', 'fire', 'water', 'lightning')}
    fx['mega'] = cut(A, (1085, 695, 1310, 832), 26); return fx

def clean(im):
    """drop panel border lines and label scraps that the paper flood-fill left attached"""
    a = np.asarray(im.split()[3]) > 40; lab, n = ndimage.label(a, structure=np.ones((3, 3)))
    if n < 1: return im
    keep = np.zeros(a.shape, bool); sizes = ndimage.sum(a, lab, range(1, n + 1))
    for i, sl in enumerate(ndimage.find_objects(lab)):
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if (h <= 5 and w >= 10) or (w <= 5 and h >= 10) or sizes[i] < sizes.max() * 0.04: continue
        if sizes[i] / (h * w) < 0.14 and (h >= 0.6 * a.shape[0] or w >= 0.6 * a.shape[1]): continue   # an L of panel border
        keep |= lab == i + 1
    al = Image.fromarray((keep * 255).astype(np.uint8), 'L'); out = im.copy(); out.putalpha(al); return out.crop(al.getbbox()) if al.getbbox() else im

def crisp(im):
    rgb = im.convert('RGB').filter(ImageFilter.UnsharpMask(1.4, 90, 2)); rgb.putalpha(im.split()[3]); return rgb

def stand(im, k):   # feet on the floor, centred on the body, same scale for every frame
    im = crisp(im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS))
    if im.width > W - 8: im = im.resize((W - 8, round(im.height * (W - 8) / im.width)), Image.LANCZOS)
    if im.height > H - 8: im = im.resize((round(im.width * (H - 8) / im.height), H - 8), Image.LANCZOS)
    fr = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fr.alpha_composite(im, ((W - im.width) // 2, H - 6 - im.height)); return fr

def save_stages(name, d, frames):
    assert len(frames) == 24, len(frames)
    for st in range(6):
        t = max(0, st - 1); fs = [glow(f, d['glow'], t) for f in frames]
        sh = Image.new('RGBA', (W * len(fs), H), (0, 0, 0, 0))
        for i, f in enumerate(fs): sh.paste(f, (i * W, 0))
        sh.save(os.path.join(WALK, f'{name}_s{st}.png'), optimize=True); fs[16].save(os.path.join(HD, f'{name}_s{st}.png'), optimize=True)   # pick screen and cards show the front view
        if st == 2: fs[16].save(os.path.join(HD, name + '.png'), optimize=True)
    prev = Image.new('RGBA', (W * 12, H * 2), (255, 255, 255, 255))
    for i, f in enumerate(frames[:24]): prev.alpha_composite(f, ((i % 12) * W, (i // 12) * H))
    os.makedirs('/tmp/dc/out', exist_ok=True); prev.convert('RGB').save(f'/tmp/dc/out/{name}_frames.png'); print(name, len(frames), 'frames')

def build_crisp(name, d, FXI, cu):
    """The sheet's action sprites are too small to enlarge: this character moves as its crisp turnaround view, posed with squash, lean and the sheet's effects."""
    kd = BODY_H / cu(d['dirs'][0][0]).height
    dirs = [stand(cu(b), kd) for b, _ in d['dirs']]; right = dirs[2]
    def tilt(fr, deg, dy=0, sx=1.0, sy=1.0):
        bb = fr.getbbox(); body = fr.crop(bb); body = body.resize((max(1, round(body.width * sx)), max(1, round(body.height * sy))), Image.LANCZOS)
        body = body.rotate(deg, resample=Image.BICUBIC, expand=True, center=(body.width / 2, body.height))
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.alpha_composite(body, ((W - body.width) // 2, H - 6 - body.height + dy)); return out
    idle = [right, tilt(right, 0, 0, 1.0, 0.985)]
    run = [tilt(right, -9, 0, 1.06, 0.96), tilt(right, -12, -14, 1.0, 1.02), tilt(right, -9, 0, 1.06, 0.96), tilt(right, -6, -14, 1.0, 1.02)]
    def with_fx(key, fxw=130, gap=-20, dy=0.0):
        out = tilt(right, -4, 0, 1.03, 0.98); f = FXI[key]; f = f.resize((fxw, max(1, round(f.height * fxw / f.width))), Image.LANCZOS)
        bb = out.getbbox(); out.alpha_composite(f, (min(W - f.width, bb[2] + gap), int(bb[1] + (bb[3] - bb[1]) * (0.42 + dy) - f.height / 2))); return out
    basic = with_fx('basic', 96); els = [with_fx(e) for e in ('earth', 'wind', 'fire', 'water', 'lightning')]
    ring = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(ring)
    for r, al in ((112, 90), (104, 170), (96, 255)): dr.ellipse((W // 2 - r, H // 2 - r + 30, W // 2 + r, H // 2 + r + 30), outline=(200, 130, 255, al), width=4)
    guard = Image.alpha_composite(ring.filter(ImageFilter.GaussianBlur(1.2)), tilt(right, 3, 0, 0.97, 1.0))
    dash = tilt(right, -16, -6, 1.12, 0.92); trail = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n, a in ((3, 0.18), (2, 0.3), (1, 0.5)):
        g = dash.copy(); g.putalpha(g.split()[3].point(lambda v, a=a: int(v * a))); trail.alpha_composite(glow(g, d['glow'], 2), (-n * 30, 0))
    dash = Image.alpha_composite(trail, dash)
    mega = FXI['mega'].resize((W - 8, round(FXI['mega'].height * (W - 8) / FXI['mega'].width)), Image.LANCZOS)
    og = Image.new('RGBA', (W, H), (0, 0, 0, 0)); og.alpha_composite(mega, (4, H - 6 - mega.height)); og.alpha_composite(dirs[0])
    hit = tilt(right, 14, 0, 0.98, 0.93)
    save_stages(name, d, [*idle, *run, basic, *els, guard, dash, og, hit, *dirs])

def build(name, d, FXI):
    im, tol = d['im'], d['tol']
    cu = lambda b: clean(cut(im, b, tol))
    idle0 = cu(d['idle'][0]); k = BODY_H / idle0.height   # the standing body is BODY_H tall; everything else keeps that scale
    fr = {}
    if d.get('crisp'): return build_crisp(name, d, FXI, cu)
    kd = BODY_H / cu(d['dirs'][0][0]).height      # the turnaround views are drawn bigger than the action sprites: same body height
    r = cu(d['dirs'][2][0]); r = stand(r, kd * 0.97); sq = r.resize((W, round(H * 0.985)), Image.LANCZOS); i2 = Image.new('RGBA', (W, H), (0, 0, 0, 0)); i2.alpha_composite(sq, (0, H - sq.height))
    fr['idle'] = [r, i2]
    fr['run'] = [stand(cu(b), k) for b in d['run']]
    def with_fx(figbox, key, fxw=130, gap=-14):
        b = cu(figbox); b = crisp(b.resize((max(1, round(b.width * k)), max(1, round(b.height * k))), Image.LANCZOS))
        f = FXI[key]; f = f.resize((fxw, max(1, round(f.height * fxw / f.width))), Image.LANCZOS)
        out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); bx = 6; out.alpha_composite(b, (bx, H - 6 - b.height))
        out.alpha_composite(f, (min(W - f.width, bx + b.width + gap), int(H - 6 - b.height * 0.6 - f.height / 2))); return out
    basic = with_fx(d['basic'][0], 'basic', 96)
    els = [with_fx(d['cast'][e], e) for e in ('earth', 'wind', 'fire', 'water', 'lightning')]
    guard = stand(cu(d['guard'][0]), k); dash = stand(cu(d['dash'][0]), k); hit = stand(cu(d['hit'][0]), k)
    mega = FXI['mega'].resize((W - 8, round(FXI['mega'].height * (W - 8) / FXI['mega'].width)), Image.LANCZOS)
    og = Image.new('RGBA', (W, H), (0, 0, 0, 0)); og.alpha_composite(mega, (4, H - 6 - mega.height)); b = fr['idle'][0]; og.alpha_composite(b)
    dirs = []
    for box, mir in d['dirs']:
        f = stand(cu(box), kd)
        dirs.append(f.transpose(Image.FLIP_LEFT_RIGHT) if mir else f)
    frames = [*fr['idle'], *fr['run'], basic, *els, guard, dash, og, hit, *dirs]
    save_stages(name, d, frames)

if __name__ == '__main__':
    only = set(sys.argv[1:]); S = specs(); FXI = sheet_fx()
    for n, d in S.items():
        if not only or n in only: build(n, d, FXI)
