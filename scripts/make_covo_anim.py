#!/usr/bin/env python3
"""COVO plays the same full frame-by-frame animation as the Chosen One sheet (the same drawings), plus the sheet's own turnaround views
(EDSR 3x) so he turns to face any of 8 directions. Atlas: dist/art/anim/azaelion.* -> covo.* with seqs.dirs appended."""
import os, sys, json, shutil
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from dirlib import clusters
import make_sheet_anim as M
R = os.path.join(os.path.dirname(__file__), '..'); AN = os.path.join(R, 'dist', 'art', 'anim')
J = json.load(open(os.path.join(AN, 'azaelion.json'))); atlas = Image.open(os.path.join(AN, 'azaelion.webp')).convert('RGBA')
sheet = Image.open(os.path.join(R, 'art-src', 'masters', 'covo_new_sheet1.png')).convert('RGB')
rot = clusters(sheet, (1012, 22, 1530, 96), gap=5, minw=14, tol=40)
big = M.upscale(np.asarray(sheet), 'covo_sheet')
# front, front-right, right, back-right, back, back-left, left, front-left (the sheet has 11 views: left ones are mirrored)
pick = [(0, 0), (1, 0), (4, 0), (5, 0), (10, 0), (5, 1), (4, 1), (1, 1)]
cells = []
for i, mir in pick:
    img = M.cutbig(big, rot[i]); img = img.crop(img.getbbox())
    if mir: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    cells.append(img)
mass = lambda im: int(((np.asarray(im)[..., 3] > 200) & (np.asarray(im)[..., :3].max(-1) < 80)).sum())
idle = J['frames'][J['seqs']['idle'][0]]; im0 = atlas.crop((idle[0], idle[1], idle[0] + idle[2], idle[1] + idle[3]))
f = (mass(im0) / np.median([mass(c) for c in cells])) ** 0.5   # the turnaround is drawn bigger than the action sprites
y = atlas.height + 2; x = 0; sh = 0; placed = []
for c in cells:
    c = c.resize((max(1, round(c.width * f)), max(1, round(c.height * f))), Image.LANCZOS)
    if x + c.width > 2048: x, y, sh = 0, y + sh + 2, 0
    placed.append((c, x, y)); x += c.width + 2; sh = max(sh, c.height)
out = Image.new('RGBA', (2048, y + sh), (0, 0, 0, 0)); out.alpha_composite(atlas, (0, 0))
J['seqs']['dirs'] = []
for c, px, py in placed:
    out.alpha_composite(c, (px, py)); J['frames'].append([px, py, c.width, c.height, round(c.width / 2), c.height - 2]); J['seqs']['dirs'].append(len(J['frames']) - 1)
out.save(os.path.join(AN, 'covo.webp'), quality=88, method=6); out.quantize(256, method=Image.Quantize.FASTOCTREE).save(os.path.join(AN, 'covo.png'), optimize=True)
json.dump(J, open(os.path.join(AN, 'covo.json'), 'w'), separators=(',', ':')); print('covo atlas', out.size, len(J['frames']), 'frames')
