"""Ascendants as Game Boy-style animated pixel characters (no photos). Each is drawn on a 48x56 pixel grid in
six frames - idle A, idle B (breathing), run 1-4 (striding legs, swinging arms, body bob) - with a 1px dark
outline, then doubled to 96x112.
  dist/art/walk/<name>.png  6-frame sheet (576x112) used by the battle renderer
  dist/art/hd/<name>.png    idle frame for cards, pickers and icons
Designs are inspired by the founder's reference portraits (headdress, colours, glowing eyes, jewellery).
Run: python3 scripts/make_walkers.py"""
import os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALK = os.path.join(ROOT, 'dist/art/walk'); HD = os.path.join(ROOT, 'dist/art/hd')
os.makedirs(WALK, exist_ok=True)
GW, GH, Z = 48, 56, 2
OUT = (26, 18, 32, 255)

def c(h): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
def shade(col, t): return tuple(max(0, min(255, round(v * (1 - t)))) for v in col[:3]) + (255,)
def tint(col, t): return tuple(round(v + (255 - v) * t) for v in col[:3]) + (255,)

GOLD, SILVER, TEAL, RUBY, PEARL = c('#e8b840'), c('#c8d0dc'), c('#2ab8a8'), c('#d0304a'), c('#eef0f6')

# name: skin, robe (main outfit), trim, eye glow, headdress style, extras
D = {
  'nyxara':   dict(skin=c('#3a4058'), robe=c('#1e1e2a'), trim=GOLD, eye=c('#b070ff'), head='dome', hc=c('#22222e'), x=dict(tears=c('#9a4ae0'), feathers=c('#b070c8'), chains=True)),
  'serqeth':  dict(skin=c('#2a3048'), robe=c('#1a1a24'), trim=GOLD, eye=c('#b060ff'), head='hood', hc=SILVER, x=dict(stripes=GOLD)),
  'kaelor':   dict(skin=c('#5a3424'), robe=c('#3a4252'), trim=SILVER, eye=c('#4a8aff'), head='plume', hc=SILVER, x=dict(plume=c('#7a8094'), fur=c('#8a90a0'), weapon='staff', chest=GOLD)),
  'lumiyah':  dict(skin=c('#5a3828'), robe=c('#e8ecf6'), trim=SILVER, eye=c('#dff8ff'), head='cathood', hc=c('#f0f2f8'), x=dict(weapon='sword', sparkle=True)),
  'thothex':  dict(skin=c('#7a4a2a'), robe=c('#14303a'), trim=c('#b06a3a'), eye=c('#5ac8ff'), head='twinplume', hc=c('#2a8a8a'), x=dict(scarab=TEAL, glyphs=GOLD, cyber=True)),
  'khonsar':  dict(skin=c('#1e2a2e'), robe=c('#1e2830'), trim=GOLD, eye=c('#ffd84a'), head='crescent', hc=c('#14141a'), x=dict(circuit=GOLD, wingpin=GOLD, gem=RUBY)),
  'selenox':  dict(skin=c('#101018'), robe=c('#c0c8d8'), trim=SILVER, eye=c('#ffffff'), head='moonhorns', hc=SILVER, x=dict(pearls=PEARL, moon=c('#dfe6f4'), beard=SILVER)),
  'amunrah':  dict(skin=c('#3a2418'), robe=c('#14605a'), trim=GOLD, eye=c('#5af0e0'), head='ramhorns', hc=GOLD, x=dict(ankh=TEAL, facelines=GOLD)),
  'azarath':  dict(skin=c('#3a2438'), robe=c('#4a2a4a'), trim=GOLD, eye=c('#ffffff'), head='ramhorns', hc=c('#c89a40'), x=dict(halfmask=GOLD, halo=GOLD, ankh=SILVER)),
  'setekh':   dict(skin=c('#7a7a84'), robe=c('#3a3a44'), trim=GOLD, eye=c('#ff8a1f'), head='nemes', hc=c('#6a6a74'), x=dict(stripes=c('#8a8a94'), gem=RUBY, collar=RUBY)),
  'horuskai': dict(skin=c('#c8962e'), robe=c('#1e2a3a'), trim=GOLD, eye=c('#3ad8e8'), head='eyecrown', hc=GOLD, x=dict(sidewings=GOLD, scarab=c('#2a6ad8'))),
  'neferion': dict(skin=c('#7a4a2e'), robe=c('#c0c8d0'), trim=GOLD, eye=c('#ffa020'), head='nemes', hc=GOLD, x=dict(stripes=c('#1e5a6a'), thirdeye=c('#ffa020'), collar=TEAL, collar2=RUBY)),
  'ptahmos':  dict(skin=c('#2a1a14'), robe=c('#2a8ab8'), trim=GOLD, eye=c('#ffffff'), head='nemes', hc=c('#2a5ab8'), x=dict(stripes=GOLD, gem=c('#8ab8ff'), nosering=GOLD)),
  'khepron':  dict(skin=c('#a0583a'), robe=c('#3a2a20'), trim=GOLD, eye=c('#3ad87a'), head='band', hc=c('#b06a3a'), x=dict(gems=True, shoulders=TEAL)),
  'osirak':   dict(skin=c('#2a5a5a'), robe=c('#1e4a50'), trim=c('#b88a3a'), eye=c('#fff6c0'), head='horncrown', hc=c('#a8783a'), x=dict(stripes=c('#2a8a8a'), collar=GOLD, gem=RUBY)),
  'isisra':   dict(skin=c('#7a4a2e'), robe=c('#1e7a72'), trim=GOLD, eye=c('#5af0f0'), head='veil', hc=c('#2a9a90'), x=dict(mask=GOLD, hoops=GOLD, scarab=c('#2a4ab8'))),
  'rasolar':  dict(skin=c('#6a3a24'), robe=c('#14605a'), trim=GOLD, eye=c('#5af0f0'), head='sundisc', hc=SILVER, x=dict(beads=TEAL, facepaint=SILVER)),
  'anuket':   dict(skin=c('#a8603a'), robe=c('#4a2a1e'), trim=GOLD, eye=c('#e8f0ff'), head='fincrown', hc=c('#c87a4a'), x=dict(circuit=c('#e8a060'), gem=TEAL, drips=GOLD)),
  'anupex':   dict(skin=c('#d8dce6'), robe=c('#c8ccd8'), trim=GOLD, eye=c('#3a6aff'), head='jackal', hc=GOLD, x=dict(gem=c('#2a4ab8'), collar=GOLD)),
  'nefertek': dict(skin=c('#e8dcc0'), robe=c('#2a8ab8'), trim=GOLD, eye=c('#c86a2a'), head='tallcrown', hc=c('#2a8ab8'), x=dict(circuit=c('#b08a40'), collar=GOLD)),
}

def frame(d, f):
    """f: 0,1 idle (breathing) - 2..5 run cycle."""
    im = Image.new('RGBA', (GW, GH), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    P = lambda x, y, w=1, h=1, col=None: g.rectangle([x, y, x + w - 1, y + h - 1], fill=col)
    run = f >= 2; k = f - 2
    bob = (-1 if f == 1 else 0) if not run else (-1 if k in (0, 2) else 0)
    stride = [3, 0, -3, 0][k] if run else 0         # +: left (front) leg forward
    lift = [1, 0, 1, 0][k] if run else 0
    swing = -stride                                 # arms swing opposite to legs
    x = d['x']; skin, robe, trim, eye, hc = d['skin'], d['robe'], d['trim'], d['eye'], d['hc']
    cx, by = 24, 31 + bob                           # body top
    # back-layer extras
    if x.get('halo'): g.ellipse([cx - 13, 1 + bob, cx + 13, 25 + bob], outline=x['halo'], width=2)
    if x.get('moon'): g.ellipse([cx - 12, 0 + bob, cx + 12, 22 + bob], fill=x['moon'])
    if x.get('sidewings'):
        for s in (-1, 1):
            for i in range(5): P(cx + s * (10 + i * 2) - (1 if s < 0 else 0), 8 + bob + i, 2, 8 - i, tint(x['sidewings'], 0.15 * (i % 2)))
    if x.get('feathers'):
        for s in (-1, 1):
            for i in range(4): P(cx + s * (12 + i) - 1, 6 + bob + i * 3, 2, 6, x['feathers'] if i % 2 else shade(x['feathers'], 0.3))
    if x.get('fur'): P(cx - 13, by + 1, 26, 5, x['fur'])
    # legs (two, alternating) and feet
    for s, off in ((-1, stride), (1, -stride)):
        lx = cx + s * 4 - 2 + off; ly = by + 15
        leg_h = 8 - (lift if off > 0 else 0)
        P(lx, ly, 5, leg_h, shade(robe, 0.35)); P(lx - (1 if s < 0 else 0), ly + leg_h, 6, 2, trim)
    # torso / robe
    P(cx - 8, by, 16, 16, robe); P(cx - 8, by, 2, 16, shade(robe, 0.25)); P(cx + 6, by, 2, 16, tint(robe, 0.15))
    P(cx - 9, by + 13, 18, 3, robe)                 # robe flare
    P(cx - 8, by + 9, 16, 2, trim)                  # belt
    if x.get('glyphs'): [P(cx - 5 + i * 3, by + 3 + (i % 2) * 2, 1, 2, x['glyphs']) for i in range(4)]
    if x.get('circuit'): [P(cx - 6 + i * 4, by + 2, 1, 6, x['circuit']) or P(cx - 6 + i * 4, by + 7, 3, 1, x['circuit']) for i in range(3)]
    if x.get('shoulders'): P(cx - 10, by, 5, 4, x['shoulders']); P(cx + 5, by, 5, 4, x['shoulders'])
    if x.get('chest'): P(cx - 5, by + 1, 10, 6, x['chest']); P(cx - 4, by + 2, 8, 4, tint(x['chest'], 0.3))
    if x.get('sparkle'): [P(cx - 6 + (i * 5) % 12, by + 1 + (i * 3) % 10, 1, 1, c('#ffe6a0') if i % 2 else c('#a8e0ff')) for i in range(7)]
    # collar / necklace
    P(cx - 7, by - 1, 14, 3, trim)
    if x.get('collar'): P(cx - 8, by + 1, 16, 2, x['collar'])
    if x.get('collar2'): P(cx - 7, by + 3, 14, 1, x['collar2'])
    if x.get('pearls'): [P(cx - 8 + i * 3, by + 1 + (1 if i % 2 else 0), 2, 2, x['pearls']) for i in range(6)]
    if x.get('beads'): [P(cx - 8 + i * 2, by + 2, 1, 1, x['beads']) for i in range(9)]
    if x.get('scarab'): P(cx - 2, by + 4, 4, 4, x['scarab']); P(cx - 3, by + 5, 1, 2, x['scarab']); P(cx + 2, by + 5, 1, 2, x['scarab'])
    if x.get('ankh'): P(cx - 1, by + 3, 2, 6, x['ankh']); P(cx - 3, by + 4, 6, 1, x['ankh']); P(cx - 2, by + 1, 4, 2, x['ankh'])
    if x.get('wingpin'): P(cx - 5, by + 4, 10, 2, x['wingpin']); P(cx - 1, by + 3, 2, 4, x['wingpin'])
    if x.get('chains'): [P(cx - 7 + i * 4, by + 2, 1, 9, trim) for i in range(4)]
    # arms (swing) with hands
    for s in (-1, 1):
        sw = swing * s // 2 if run else 0
        ax = cx + s * 9 - (2 if s < 0 else 0) + sw
        P(ax, by + 1, 3, 10, shade(robe, 0.1)); P(ax, by + 11, 3, 2, skin if not x.get('cyber') else c('#b06a3a'))
    w = x.get('weapon')
    if w == 'staff': hx = cx + 10 + (swing // 2 if run else 0); P(hx, by - 12, 2, 28, GOLD); P(hx - 1, by - 14, 4, 3, c('#fff0b0'))
    if w == 'sword': hx = cx + 10 + (swing // 2 if run else 0); P(hx, by - 10, 2, 22, c('#eef6ff')); P(hx - 2, by + 10, 6, 2, SILVER); P(hx, by - 9, 1, 18, c('#ffe0a0'))
    # head
    hx, hy = cx + 1, 18 + bob                       # head centre
    head = d['head']
    if head == 'jackal':                             # jackal head with tall ears and long snout
        P(hx - 6, hy - 18, 4, 10, hc); P(hx + 3, hy - 18, 4, 10, hc); P(hx - 5, hy - 16, 2, 6, skin); P(hx + 4, hy - 16, 2, 6, skin)
        g.ellipse([hx - 8, hy - 9, hx + 8, hy + 7], fill=skin); P(hx + 4, hy - 1, 9, 5, skin); P(hx + 11, hy, 2, 2, c('#202028'))
        P(hx - 10, hy - 4, 4, 14, hc); P(hx - 9, hy - 3, 2, 12, tint(hc, 0.2))
        P(hx - 3, hy - 4, 4, 2, eye); P(hx + 2, hy - 4, 3, 2, eye)
    else:
        g.ellipse([hx - 8, hy - 9, hx + 8, hy + 8], fill=skin)
        g.ellipse([hx - 8, hy - 9, hx - 4, hy + 8], fill=shade(skin, 0.2))
        # eyes (glowing) - looking right
        for ex in (hx - 3, hx + 3): P(ex, hy - 1, 3, 2, eye); P(ex + 1, hy - 1, 1, 1, tint(eye, 0.6))
        P(hx + 6, hy + 1, 1, 2, shade(skin, 0.3)); P(hx - 1, hy + 4, 5, 1, shade(skin, 0.45))   # nose shadow, mouth
        if x.get('tears'): P(hx - 3, hy + 1, 2, 4, x['tears']); P(hx + 3, hy + 1, 2, 4, x['tears'])
        if x.get('facelines'): P(hx - 4, hy + 1, 1, 4, x['facelines']); P(hx + 6, hy + 1, 1, 4, x['facelines'])
        if x.get('facepaint'): P(hx - 6, hy - 3, 13, 1, x['facepaint'])
        if x.get('halfmask'): g.chord([hx - 8, hy - 9, hx + 8, hy + 8], 90, 270, fill=x['halfmask']); P(hx - 3, hy - 1, 3, 2, eye)
        if x.get('mask'): P(hx - 6, hy + 2, 13, 6, x['mask']); P(hx - 5, hy + 3, 11, 1, tint(x['mask'], 0.3))
        if x.get('circuit'): P(hx - 5, hy - 6, 1, 4, x['circuit']); P(hx + 5, hy + 3, 3, 1, x['circuit'])
        if x.get('thirdeye'): P(hx, hy - 6, 2, 2, x['thirdeye'])
        if x.get('nosering'): g.ellipse([hx + 3, hy + 3, hx + 7, hy + 7], outline=x['nosering'])
        if x.get('beard'): P(hx - 4, hy + 6, 9, 6, x['beard']); P(hx - 3, hy + 7, 7, 4, tint(x['beard'], 0.3))
        if x.get('cyber'): g.ellipse([hx + 2, hy - 3, hx + 7, hy + 2], fill=c('#3a3a8a'), outline=GOLD)
        # headdress
        if head == 'dome':
            g.chord([hx - 10, hy - 13, hx + 10, hy + 5], 180, 360, fill=hc); P(hx - 10, hy - 4, 21, 2, trim); P(hx - 1, hy - 13, 3, 10, trim)
            for i in range(4): P(hx - 8 + i * 5, hy - 10 + (i % 2), 2, 2, trim)
            for s in (-1, 1): P(hx + s * 10 - 1, hy - 3, 2, 14, trim)
        elif head == 'hood':
            g.chord([hx - 10, hy - 14, hx + 10, hy + 6], 180, 360, fill=hc); P(hx - 11, hy - 4, 4, 18, hc); P(hx + 8, hy - 4, 4, 18, hc)
            for i in range(5): P(hx - 2, hy - 13 + i * 2, 5, 1, x['stripes'])
            P(hx - 10, hy - 4, 2, 18, x['stripes']); P(hx + 10, hy - 4, 2, 18, x['stripes'])
        elif head == 'plume':
            for i in range(9): P(hx - 10 + i * 2, hy - 20 + abs(i - 4), 3, 10, x['plume'] if i % 2 else shade(x['plume'], 0.25))
            P(hx - 9, hy - 10, 19, 6, hc); P(hx + 2, hy - 6, 9, 4, hc); [P(hx - 7 + i * 3, hy - 9, 1, 1, c('#ffffff')) for i in range(6)]
            g.ellipse([hx + 4, hy - 13, hx + 12, hy - 5], fill=SILVER, outline=GOLD)
        elif head == 'cathood':
            g.chord([hx - 11, hy - 14, hx + 11, hy + 8], 180, 360, fill=hc); P(hx - 11, hy - 3, 4, 14, hc)
            P(hx - 8, hy - 19, 4, 7, hc); P(hx + 4, hy - 19, 4, 7, hc); P(hx - 7, hy - 17, 2, 4, c('#ffd0d8')); P(hx + 5, hy - 17, 2, 4, c('#ffd0d8'))
            P(hx - 6, hy - 4, 14, 3, SILVER); g.ellipse([hx + 5, hy - 6, hx + 12, hy + 1], fill=SILVER, outline=c('#8090a8'))
        elif head == 'twinplume':
            for s in (-3, 3): P(hx + s - 2, hy - 24, 4, 14, hc); P(hx + s - 1, hy - 23, 2, 12, tint(hc, 0.3))
            P(hx - 1, hy - 14, 3, 4, c('#5a3a20'))
            P(hx - 10, hy - 9, 21, 5, d['trim']); P(hx - 12, hy - 5, 5, 16, d['trim']); P(hx + 8, hy - 5, 5, 16, d['trim'])
            for i in range(4): P(hx - 12, hy - 3 + i * 4, 5, 1, TEAL); P(hx + 8, hy - 3 + i * 4, 5, 1, TEAL)
        elif head == 'crescent':
            g.arc([hx - 15, hy - 19, hx + 15, hy + 11], 150, 30, fill=GOLD, width=3)
            g.chord([hx - 9, hy - 11, hx + 9, hy + 3], 180, 360, fill=hc); [P(hx - 6 + i * 3, hy - 8, 1, 1, GOLD) for i in range(5)]
        elif head == 'moonhorns':
            g.arc([hx - 13, hy - 24, hx + 13, hy - 2], 0, 180, fill=SILVER, width=3)
            for i in range(7): P(hx - 11 + i * 3 + (1 if i % 2 else 0), hy - 13 + abs(i - 3), 2, 2, c('#c8e8ff') if i % 2 else c('#ffd8f0'))
            g.chord([hx - 8, hy - 10, hx + 8, hy + 2], 180, 360, fill=skin)
        elif head == 'ramhorns':
            g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hc); [P(hx - 1, hy - 12 + i * 3, 3, 1, shade(hc, 0.3)) for i in range(4)]
            for s in (-1, 1):
                ox = hx + s * 11
                g.ellipse([ox - 5, hy - 9, ox + 5, hy + 3], outline=hc, width=3); P(ox - 1 + s, hy - 1, 3, 3, shade(hc, 0.2))
        elif head == 'nemes':
            g.chord([hx - 10, hy - 13, hx + 10, hy + 5], 180, 360, fill=hc)
            P(hx - 12, hy - 4, 5, 17, hc); P(hx + 8, hy - 4, 5, 17, hc)
            for i in range(4): P(hx - 12, hy - 3 + i * 4, 5, 2, x['stripes']); P(hx + 8, hy - 3 + i * 4, 5, 2, x['stripes'])
            for i in range(3): P(hx - 9 + i * 3, hy - 11 + i * 2, 19 - i * 6, 1, x['stripes'])
            P(hx - 10, hy - 5, 21, 2, trim)
            if x.get('gem'): P(hx, hy - 9, 3, 3, x['gem'])
            P(hx, hy - 15, 3, 4, trim)                                            # cobra
        elif head == 'eyecrown':
            g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hc)
            g.ellipse([hx - 6, hy - 17, hx + 6, hy - 10], outline=hc, width=2); P(hx - 1, hy - 15, 3, 3, c('#2a4ab8')); P(hx - 5, hy - 10, 1, 4, hc)
        elif head == 'band':
            g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hc); P(hx - 1, hy - 12, 3, 8, GOLD)
            P(hx - 9, hy - 5, 19, 2, GOLD); [P(hx - 8 + i * 3, hy - 5, 2, 2, [TEAL, RUBY, c('#3a8ae0')][i % 3]) for i in range(6)]
        elif head == 'horncrown':
            g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hc); P(hx - 9, hy - 6, 19, 2, GOLD)
            for s in (-1, 1): g.arc([hx + s * 9 - 6, hy - 18, hx + s * 9 + 6, hy - 2], 180 if s < 0 else 270, 270 if s < 0 else 360, fill=hc, width=3)
            P(hx - 12, hy - 4, 4, 16, x['stripes']); P(hx + 9, hy - 4, 4, 16, x['stripes'])
            for i in range(4): P(hx - 12, hy - 3 + i * 4, 4, 1, GOLD); P(hx + 9, hy - 3 + i * 4, 4, 1, GOLD)
        elif head == 'veil':
            g.chord([hx - 11, hy - 14, hx + 11, hy + 8], 180, 360, fill=hc)
            for i in range(5): P(hx - 11 + i, hy - 6 + i * 3, 3, 3, shade(hc, 0.2) if i % 2 else hc); P(hx + 9 - i, hy - 6 + i * 3, 3, 3, shade(hc, 0.2) if i % 2 else hc)
            g.ellipse([hx - 4, hy - 9, hx + 4, hy - 5], outline=GOLD); P(hx - 1, hy - 8, 2, 2, c('#2a4ab8'))
            for s in (-1, 1): g.ellipse([hx + s * 9 - 2, hy + 1, hx + s * 9 + 2, hy + 6], outline=x['hoops'])
        elif head == 'sundisc':
            for s in (-1, 1): P(hx + s * 10 - (3 if s < 0 else 0), hy - 18, 4, 9, SILVER); P(hx + s * 12 - (3 if s < 0 else 0), hy - 14, 4, 6, GOLD)
            g.ellipse([hx - 7, hy - 22, hx + 7, hy - 8], fill=GOLD, outline=c('#a07020')); g.ellipse([hx - 3, hy - 18, hx + 3, hy - 12], outline=c('#a07020'))
            g.chord([hx - 9, hy - 11, hx + 9, hy + 3], 180, 360, fill=hc)
        elif head == 'fincrown':
            for s in (-1, 1):
                for i in range(3): P(hx + s * (7 + i * 2) - (1 if s < 0 else 0), hy - 14 + i, 2, 6 - i, hc)
            g.chord([hx - 9, hy - 12, hx + 9, hy + 2], 180, 360, fill=hc); g.ellipse([hx - 3, hy - 15, hx + 3, hy - 9], fill=GOLD); P(hx - 1, hy - 14, 3, 4, x['gem'])
            if x.get('drips'): [P(hx - 8 + i * 4, hy + 2, 1, 6 + (i % 2) * 3, x['drips']) for i in range(5)]
        elif head == 'tallcrown':
            P(hx - 8, hy - 24, 17, 16, hc); P(hx - 9, hy - 9, 19, 2, GOLD); P(hx - 2, hy - 20, 5, 6, GOLD); P(hx - 1, hy - 19, 3, 4, c('#ffe890'))
            [P(hx - 7 + i * 4, hy - 22 + (i % 2) * 5, 1, 1, GOLD) for i in range(5)]
    # 1px dark outline around the whole silhouette
    a = im.getchannel('A'); o = Image.new('RGBA', (GW, GH), (0, 0, 0, 0)); po = o.load(); pa = a.load()
    for yy in range(GH):
        for xx in range(GW):
            if pa[xx, yy]: continue
            if any(0 <= xx + dx < GW and 0 <= yy + dy < GH and pa[xx + dx, yy + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): po[xx, yy] = OUT
    o.alpha_composite(im); return o

for name, d in D.items():
    frames = [frame(d, f) for f in range(6)]
    sheet = Image.new('RGBA', (GW * 6, GH), (0, 0, 0, 0))
    for i, fr in enumerate(frames): sheet.paste(fr, (i * GW, 0))
    sheet.resize((GW * 6 * Z, GH * Z), Image.NEAREST).save(os.path.join(WALK, name + '.png'))
    frames[0].resize((GW * Z, GH * Z), Image.NEAREST).save(os.path.join(HD, name + '.png'))
print('walkers', len(D))
