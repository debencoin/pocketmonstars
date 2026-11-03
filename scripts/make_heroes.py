"""Superhero Drop: 30 original hero Monstars as animated pixel characters (same 48x56 grid and 6-frame
sheets as make_walkers.py). Original designs: bodysuits, capes, masks or helmets and a chest emblem each.
Every evolution stage is a new look:
  0 Kid       small, plain suit, simple mask, no cape
  1 Cadet     short cape, emblem
  2 Hero      full cape and the hero's own helmet or mask
  3 Prime     armour plates, glowing emblem, gauntlets
  4 Mega      energy wings and a power aura
  5 Ascended  gold trim, crown of light rays, sparkles
Writes dist/art/walk/<name>_s0..5.png and dist/art/hd/<name>_s0..5.png (+ <name>.png).
Run: python3 scripts/make_heroes.py [names...]"""
import os, sys, math
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALK = os.path.join(ROOT, 'dist/art/walk'); HD = os.path.join(ROOT, 'dist/art/hd')
GW, GH, Z = 48, 56, 2
OUT = (26, 18, 32, 255)
def c(h): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
def shade(col, t): return tuple(max(0, min(255, round(v * (1 - t)))) for v in col[:3]) + (255,)
def tint(col, t): return tuple(round(v + (255 - v) * t) for v in col[:3]) + (255,)
GOLD, WHITE = c('#f0c040'), c('#ffffff')
SKINS = [c('#f0c8a0'), c('#c88a5a'), c('#8a5a3a'), c('#5a3a24'), c('#e8b088')]

# name: suit, trim, cape (None = no cape), head style, emblem, eye/energy colour, hair, female, extra
D = {
  'solarch':     dict(suit='#ffb020', trim='#c8501a', cape='#ffe680', head='crest',  emb='sun',      eye='#fff2a0', hair='#f0e0a0', skin=1, f=False),
  'voltaris':    dict(suit='#2a6aff', trim='#ffd23f', cape='#1a2a6a', head='visor',  emb='bolt',     eye='#9ef0ff', hair=None,      skin=2, f=False),
  'gravitas':    dict(suit='#5a2a9a', trim='#2a1a3a', cape='#c08cff', head='cowl',   emb='ring',     eye='#e0b8ff', hair=None,      skin=0, f=True),
  'aegiron':     dict(suit='#2a8a70', trim='#d8dce8', cape=None,      head='horns',  emb='hex',      eye='#7affd8', hair=None,      skin=3, f=False),
  'nightvale':   dict(suit='#22223a', trim='#8a5ae0', cape='#3a2a5a', head='domino', emb='crescent', eye='#d8c8ff', hair='#14141e', skin=4, f=True),
  'blazewing':   dict(suit='#e0482a', trim='#ffb030', cape='#ff8a1f', head='flame',  emb='flame',    eye='#fff0a0', hair='#ffb030', skin=1, f=False),
  'magmara':     dict(suit='#8a1e3a', trim='#ff7a2a', cape='#2a1418', head='domino', emb='drop',     eye='#ffb060', hair='#ff5a2a', skin=2, f=True),
  'tidebreaker': dict(suit='#1a5ab8', trim='#5af0e0', cape='#0e2a5a', head='crest',  emb='wave',     eye='#bff8ff', hair=None,      skin=3, f=False),
  'coralon':     dict(suit='#ff7a6a', trim='#2ab8a8', cape='#ffd0c0', head='domino', emb='diamond',  eye='#c8fff4', hair='#2ab8a8', skin=0, f=True),
  'hailstrike':  dict(suit='#e8f4ff', trim='#2a8ad8', cape='#5ac8f0', head='visor',  emb='chevron',  eye='#5ac8f0', hair=None,      skin=0, f=False),
  'frostbyte':   dict(suit='#2a3a5a', trim='#a0e8ff', cape=None,      head='antenna',emb='hex',      eye='#a0e8ff', hair=None,      skin=1, f=True),
  'quakefist':   dict(suit='#6a4a2a', trim='#e0a040', cape=None,      head='horns',  emb='mountain', eye='#ffd080', hair=None,      skin=3, f=False),
  'bouldra':     dict(suit='#7a7a5a', trim='#c86a3a', cape='#4a4a3a', head='domino', emb='mountain', eye='#ffe0a0', hair='#3a2418', skin=2, f=True),
  'galeforce':   dict(suit='#2a8a78', trim='#e8fff8', cape='#c8f8e8', head='visor',  emb='chevron',  eye='#e8fff8', hair=None,      skin=1, f=False),
  'vortexa':     dict(suit='#d8f0f8', trim='#3a8ab8', cape='#88c8e8', head='domino', emb='ring',     eye='#3a8ab8', hair='#f8f8ff', skin=4, f=True),
  'thornheart':  dict(suit='#2a6a2a', trim='#8a4a20', cape='#1a3a1a', head='cowl',   emb='leaf',     eye='#c8ff80', hair=None,      skin=2, f=False),
  'verdantia':   dict(suit='#5ac83a', trim='#ff9ad8', cape='#2a7a2a', head='domino', emb='leaf',     eye='#ffe0f4', hair='#c83a7a', skin=1, f=True),
  'nebulor':     dict(suit='#2a2a6a', trim='#8a7aff', cape='#4a3ab8', head='antenna',emb='star4',    eye='#ffffff', hair=None,      skin=0, f=False),
  'comettra':    dict(suit='#ff9ad8', trim='#ffffff', cape='#c85ab8', head='domino', emb='star4',    eye='#ffffff', hair='#ffe0f4', skin=3, f=True),
  'mindlock':    dict(suit='#4a2a7a', trim='#ffd23f', cape='#2a1a4a', head='visor',  emb='eye',      eye='#ffd23f', hair=None,      skin=1, f=False),
  'psyra':       dict(suit='#c83ab8', trim='#3a1a4a', cape='#5a1a5a', head='domino', emb='eye',      eye='#ffb8f8', hair='#1e1428', skin=2, f=True),
  'steelbrand':  dict(suit='#6a7890', trim='#c83a3a', cape=None,      head='visor',  emb='triangle', eye='#ff8a6a', hair=None,      skin=0, f=False),
  'ferronix':    dict(suit='#a85a2a', trim='#3a3a4a', cape='#5a2a14', head='crest',  emb='ring',     eye='#ffc080', hair=None,      skin=3, f=False),
  'shadowstep':  dict(suit='#3a2a5a', trim='#1a1424', cape='#14101e', head='cowl',   emb='chevron',  eye='#b8a0ff', hair=None,      skin=1, f=False),
  'duskara':     dict(suit='#6a1a4a', trim='#ffb070', cape='#2a0e20', head='domino', emb='crescent', eye='#ffb070', hair='#3a0e2a', skin=4, f=True),
  'joltrix':     dict(suit='#ffd23f', trim='#2a2a3a', cape=None,      head='flame',  emb='bolt',     eye='#ffffff', hair='#ffffff', skin=2, f=False),
  'ampere':      dict(suit='#2a2a3a', trim='#ffe86a', cape='#ffe86a', head='domino', emb='bolt',     eye='#ffe86a', hair='#ffe86a', skin=0, f=True),
  'drakonis':    dict(suit='#8a1a1a', trim='#e8b840', cape='#3a0e0e', head='horns',  emb='flame',    eye='#ffcf4a', hair=None,      skin=2, f=False),
  'runeguard':   dict(suit='#5a4a2a', trim='#2ab8a8', cape='#8a6a2a', head='crest',  emb='diamond',  eye='#7affe8', hair=None,      skin=3, f=False),
  'sentrion':    dict(suit='#e8ecf6', trim='#5a6a8a', cape='#c8d0e0', head='cowl',   emb='eye',      eye='#5ac8ff', hair=None,      skin=4, f=False),
}

def emblem(P, g, kind, x, y, col, bg):
    """6x6 chest emblem centred at (x, y)."""
    g.ellipse([x - 4, y - 4, x + 4, y + 4], fill=bg)
    if kind == 'bolt': P(x, y - 3, 2, 2, col); P(x - 1, y - 1, 3, 1, col); P(x - 1, y, 2, 2, col); P(x - 2, y + 2, 2, 1, col)
    elif kind == 'sun': g.ellipse([x - 2, y - 2, x + 2, y + 2], fill=col); [P(x + dx, y + dy, 1, 1, col) for dx, dy in ((0, -4), (0, 4), (-4, 0), (4, 0))]
    elif kind == 'ring': g.ellipse([x - 3, y - 3, x + 3, y + 3], outline=col); P(x, y, 1, 1, col)
    elif kind == 'hex': g.polygon([(x - 3, y), (x - 1, y - 3), (x + 2, y - 3), (x + 3, y), (x + 2, y + 3), (x - 1, y + 3)], fill=col)
    elif kind == 'crescent': g.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col); g.ellipse([x - 1, y - 4, x + 4, y + 2], fill=bg)
    elif kind == 'flame': g.polygon([(x, y - 4), (x + 3, y + 1), (x, y + 3), (x - 3, y + 1)], fill=col); P(x, y, 1, 2, tint(col, 0.6))
    elif kind == 'drop': g.polygon([(x, y - 4), (x + 3, y + 1), (x - 3, y + 1)], fill=col); g.ellipse([x - 3, y - 1, x + 3, y + 3], fill=col)
    elif kind == 'wave': [P(x - 3 + i, y + (1 if i % 3 == 0 else 0) - (1 if i % 3 == 2 else 0), 1, 2, col) for i in range(7)]
    elif kind == 'diamond': g.polygon([(x, y - 4), (x + 3, y), (x, y + 4), (x - 3, y)], fill=col)
    elif kind == 'chevron': g.line([(x - 3, y - 2), (x, y + 1), (x + 3, y - 2)], fill=col, width=2)
    elif kind == 'mountain': g.polygon([(x - 4, y + 3), (x - 1, y - 3), (x + 1, y), (x + 2, y - 1), (x + 4, y + 3)], fill=col)
    elif kind == 'leaf': g.ellipse([x - 2, y - 4, x + 2, y + 3], fill=col); P(x, y - 2, 1, 6, bg)
    elif kind == 'star4': g.polygon([(x, y - 4), (x + 1, y - 1), (x + 4, y), (x + 1, y + 1), (x, y + 4), (x - 1, y + 1), (x - 4, y), (x - 1, y - 1)], fill=col)
    elif kind == 'eye': g.ellipse([x - 3, y - 2, x + 3, y + 2], fill=col); P(x - 1, y - 1, 2, 2, bg)
    elif kind == 'triangle': g.polygon([(x, y - 3), (x + 3, y + 3), (x - 3, y + 3)], fill=col)

def frame(d, f, stage):
    im = Image.new('RGBA', (GW, GH), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    P = lambda x, y, w=1, h=1, col=None: g.rectangle([x, y, x + w - 1, y + h - 1], fill=col)
    run = f >= 2; k = f - 2
    bob = (-1 if f == 1 else 0) if not run else (-1 if k in (0, 2) else 0)
    stride = [3, 0, -3, 0][k] if run else 0; lift = [1, 0, 1, 0][k] if run else 0; swing = -stride
    suit, trim, eye = c(d['suit']), c(d['trim']), c(d['eye']); skin = SKINS[d['skin']]
    cape = c(d['cape']) if d['cape'] else None
    if stage == 0: suit = tint(suit, 0.25)
    if stage == 5: trim = GOLD
    TH, LH = (12, 5) if stage == 0 else (14, 7) if stage == 1 else (16, 9)
    cx = 24; by = GH - 2 - LH - (TH - 1) + bob
    sw = 9 if stage >= 2 else 8                     # shoulder half-width: heroes get broad shoulders
    # --- back layer: aura, wings, crown of light, cape ---
    if stage >= 4:
        aura = Image.new('RGBA', (GW, GH), (0, 0, 0, 0)); ImageDraw.Draw(aura).ellipse([cx - 19, by - 26, cx + 19, GH - 1], fill=eye[:3] + (60 if stage == 4 else 80,))
        im.alpha_composite(aura)
        for s in (-1, 1):                            # energy wings: swept streaks
            for i in range(5):
                L = 14 - i * 2 + (2 if stage == 5 else 0)
                x0 = cx + s * (sw + 1); y0 = by - 2 + i * 3 - (f % 2 if not run else 0)
                for j in range(L): P(x0 + s * j - (1 if s < 0 else 0), y0 - j // 3, 1, 2, tint(eye, 0.2 + 0.1 * (j % 2)) if i % 2 else eye)
    if stage >= 5:                                   # crown of light rays above the head
        for a in range(-60, 61, 30):
            r = math.radians(a - 90); x1, y1 = cx + 1 + math.cos(r) * 13, by - 14 + math.sin(r) * 13
            g.line([(cx + 1 + math.cos(r) * 9, by - 14 + math.sin(r) * 9), (x1, y1)], fill=GOLD, width=2)
    if cape and stage >= 1:
        n = 7 if stage == 1 else TH + 2 if stage == 2 else TH + LH - 3
        flow = (2 if run else 0)
        for row in range(n):
            w2 = 2 * sw + 2 + row // 3; x0 = cx - w2 // 2 - (flow * row // 6)
            P(x0, by + 1 + row, w2, 1, cape if row % 5 else shade(cape, 0.22))
        if stage >= 3: P(cx - sw - 1, by + 1, 1, n, tint(cape, 0.3) if stage < 5 else GOLD)
    # --- legs and boots ---
    for s, off in ((-1, stride), (1, -stride)):
        lx = cx + s * 4 - 2 + off; ly = by + TH - 1; leg_h = LH - (lift if off > 0 else 0)
        P(lx, ly, 5, leg_h, shade(suit, 0.18)); P(lx, ly + leg_h - (3 if stage >= 1 else 2), 5, 3 if stage >= 1 else 2, trim); P(lx - (1 if s < 0 else 0), ly + leg_h, 6, 2, shade(trim, 0.25))
    # --- torso: V shape ---
    for row in range(TH):
        w2 = 2 * sw - (row * 4 // TH) * 2 + 2 if stage >= 2 else 2 * sw
        P(cx - w2 // 2, by + row, w2, 1, suit)
    P(cx - sw, by, 2, TH - 4, shade(suit, 0.22)); P(cx + sw - 2, by, 2, TH - 4, tint(suit, 0.15))
    P(cx - 6, by + TH - 4, 12, 2, trim)              # belt
    if stage >= 2: P(cx - 1, by + TH - 4, 3, 2, tint(trim, 0.5))
    if stage >= 3:                                   # armour: shoulder plates and chest lines
        for s in (-1, 1): P(cx + s * (sw - 2) - (4 if s < 0 else 0) + (1 if s > 0 else 0), by - 2, 6, 4, trim); P(cx + s * (sw - 2) - (3 if s < 0 else 0) + (1 if s > 0 else 0), by - 2, 4, 1, tint(trim, 0.4))
        P(cx - 6, by + 8, 12, 1, shade(suit, 0.3))
    # emblem
    if stage >= 1: emblem(P, g, d['emb'], cx, by + 4, eye if stage >= 3 else trim, shade(suit, 0.35) if stage < 3 else shade(trim, 0.45))
    else: P(cx - 1, by + 3, 3, 3, trim)
    # --- arms, gloves (gauntlets from Prime) ---
    for s in (-1, 1):
        sw2 = swing * s // 2 if run else 0
        ax = cx + s * (sw + 1) - (2 if s < 0 else 0) + sw2
        P(ax, by + 1, 3, 10, shade(suit, 0.08))
        P(ax - (1 if stage >= 3 else 0), by + 8, 3 + (2 if stage >= 3 else 0) // 2 * (1 if stage >= 3 else 0) + (1 if stage >= 3 else 0), 5 if stage >= 3 else 3, trim)
        if stage >= 4: P(ax, by + 9, 3, 1, eye)
    # --- head ---
    hx, hy = cx + 1, by - 12
    hair = c(d['hair']) if d['hair'] else None
    head = d['head'] if stage >= 2 else 'domino'
    if head == 'domino' and hair is None: hair = shade(trim, 0.5)
    if hair and head in ('domino', 'flame') and d['f']:   # long hair
        P(hx - 10, hy - 6, 5, 20, hair); P(hx + 6, hy - 6, 5, 16, hair)
    g.ellipse([hx - 8, hy - 9, hx + 8, hy + 8], fill=skin); g.ellipse([hx - 8, hy - 9, hx - 4, hy + 8], fill=shade(skin, 0.18))
    P(hx - 1, hy + 4, 5, 1, shade(skin, 0.45))       # mouth
    if head in ('domino', 'flame'):
        if hair: g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hair); P(hx - 9, hy - 6, 3, 4, hair)
        if head == 'flame':
            for i in range(6): P(hx - 8 + i * 3, hy - 14 - (i % 2) * 3 - (f % 2), 2, 6, tint(eye, 0.1) if i % 2 else c(d['trim']))
        P(hx - 7, hy - 3, 15, 4, c(d['trim']) if stage < 5 else shade(suit, 0.3))   # domino mask
        for ex in (hx - 3, hx + 3): P(ex, hy - 2, 3, 2, WHITE)
        if d['f']: [P(ex - 1, hy - 3, 4, 1, OUT) for ex in (hx - 3, hx + 3)]; P(hx, hy + 4, 4, 1, c('#c83a5a'))
    else:
        hc = suit if head != 'visor' else trim
        g.chord([hx - 9, hy - 12, hx + 9, hy + 8], 180, 360, fill=hc)       # helmet / cowl
        P(hx - 9, hy - 3, 3, 8, hc); P(hx + 7, hy - 3, 3, 6, hc)
        if head == 'visor':
            P(hx - 6, hy - 3, 14, 3, eye); P(hx, hy - 3, 2, 6, eye); P(hx - 6, hy - 3, 14, 1, tint(eye, 0.6))
        elif head == 'cowl':
            for ex in (hx - 3, hx + 3): P(ex - 1, hy - 3, 4, 3, WHITE); P(ex, hy - 2, 2, 1, tint(eye, 0.5))
            P(hx - 8, hy - 4, 17, 1, shade(hc, 0.3))
        else:
            P(hx - 7, hy - 3, 15, 3, shade(hc, 0.4)); [P(ex, hy - 2, 3, 1, eye) for ex in (hx - 3, hx + 3)]
            if head == 'crest': P(hx - 1, hy - 18, 3, 8, c(d['trim'])); P(hx, hy - 17, 1, 6, tint(c(d['trim']), 0.5))
            if head == 'horns':
                for s in (-1, 1): P(hx + s * 7 - 1, hy - 14, 3, 4, c(d['trim'])); P(hx + s * 8 - (0 if s > 0 else 1), hy - 17, 2, 3, tint(c(d['trim']), 0.3))
            if head == 'antenna':
                for s in (-1, 1): P(hx + s * 5, hy - 18, 1, 7, c(d['trim'])); P(hx + s * 5 - 1, hy - 20, 3, 3, eye)
        if stage >= 4:                               # helmet fins
            for s in (-1, 1): P(hx + s * 10 - (2 if s < 0 else 0), hy - 8, 3, 6, eye)
    if stage >= 5:
        for i in range(10): P((i * 17 + f * 5) % GW, (i * 11 + f * 7) % 30 + 2, 1, 1, GOLD if i % 2 else WHITE)
    # 1px outline
    a = im.getchannel('A'); o = Image.new('RGBA', (GW, GH), (0, 0, 0, 0)); po = o.load(); pa = a.load()
    for yy in range(GH):
        for xx in range(GW):
            if pa[xx, yy] > 100: continue
            if any(0 <= xx + dx < GW and 0 <= yy + dy < GH and pa[xx + dx, yy + dy] > 100 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): po[xx, yy] = OUT
    o.alpha_composite(im); return o

only = set(sys.argv[1:])
for name, d in D.items():
    if only and name not in only: continue
    for stage in range(6):
        frames = [frame(d, f, stage) for f in range(6)]
        sheet = Image.new('RGBA', (GW * 6, GH), (0, 0, 0, 0))
        for i, fr in enumerate(frames): sheet.paste(fr, (i * GW, 0))
        sheet.resize((GW * 6 * Z, GH * Z), Image.NEAREST).save(os.path.join(WALK, f'{name}_s{stage}.png'))
        frames[0].resize((GW * Z, GH * Z), Image.NEAREST).save(os.path.join(HD, f'{name}_s{stage}.png'))
        if stage == 2: frames[0].resize((GW * Z, GH * Z), Image.NEAREST).save(os.path.join(HD, name + '.png'))
print('heroes', len(D))
