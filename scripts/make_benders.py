"""Elemental Benders: original martial-artist Monstars who command water, earth, fire, air and thunder.
Drawn at 96x112 per frame (twice the detail of the other walkers): shaded skin, faces with eyes and brows,
layered clothes, real two-segment legs and arms, and a 6-frame sheet (idle A/B, run 1-4) per stage.
Stages: 0 young trainee, 1 apprentice, 2 bender, 3 master (element armour + aura), 4 Mega (element mantle),
5 Ascended (gold trim, element crown).  Writes dist/art/walk/<name>_s0..5.png and dist/art/hd/<name>_s0..5.png.
Run: python3 scripts/make_benders.py [names...]"""
import os, sys, math, random
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALK, HD = os.path.join(ROOT, 'dist/art/walk'), os.path.join(ROOT, 'dist/art/hd')
W, H = 96, 112
OUT = (22, 16, 28, 255)
def c(h, a=255): h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def shade(col, t): return tuple(max(0, min(255, round(v * (1 - t)))) for v in col[:3]) + (col[3] if len(col) > 3 else 255,)
def tint(col, t): return tuple(round(v + (255 - v) * t) for v in col[:3]) + (col[3] if len(col) > 3 else 255,)
GOLD = c('#f0c040')
SKIN = [c('#f2c9a0'), c('#d9a074'), c('#b07a50'), c('#7a4e32'), c('#5a3824')]
ELEM = {  # aura / effect colours per element
  'water': (c('#5ec2ff'), c('#dff6ff')), 'earth': (c('#8f7a5a'), c('#c8b088')), 'fire': (c('#ff8a1f'), c('#fff1a0')),
  'air': (c('#d8f4ff'), c('#ffffff')), 'thunder': (c('#ffe14a'), c('#ffffff')),
}
# name: element, gender, skin, hair, hair style, top, top2 (trim), pants, boots, extras
D = {
  'tidewen':   dict(el='water',   f=True,  skin=1, hair=c('#3a2418'), hs='braid',   top=c('#2b6fd0'), trim=c('#bfefff'), pants=c('#1e3a6e'), boots=c('#e8eef8')),
  'marovek':   dict(el='water',   f=False, skin=3, hair=c('#1a1414'), hs='topknot', top=c('#1e5aa8'), trim=c('#e8eef8'), pants=c('#2a3a5a'), boots=c('#3a2a20')),
  'granitus':  dict(el='earth',   f=False, skin=2, hair=c('#2a1a10'), hs='short',   top=c('#4f7a2a'), trim=c('#c8a060'), pants=c('#6a5030'), boots=c('#3a2a1a'), band=c('#c8a060')),
  'terrala':   dict(el='earth',   f=True,  skin=4, hair=c('#1a1010'), hs='bun',     top=c('#6a8a3a'), trim=c('#e0c890'), pants=c('#5a4630'), boots=c('#2e2418')),
  'pyreska':   dict(el='fire',    f=True,  skin=0, hair=c('#2a0e0e'), hs='pony',    top=c('#b8241c'), trim=c('#f0c040'), pants=c('#2a1414'), boots=c('#1a0e0e')),
  'emberon':   dict(el='fire',    f=False, skin=1, hair=c('#1a1010'), hs='spiky',   top=c('#8a1a14'), trim=c('#ffb030'), pants=c('#241010'), boots=c('#3a2010')),
  'zephyrine': dict(el='air',     f=True,  skin=2, hair=c('#e8d8c0'), hs='long',    top=c('#e8902a'), trim=c('#ffe080'), pants=c('#f4e8c8'), boots=c('#8a5a2a')),
  'aerokai':   dict(el='air',     f=False, skin=3, hair=c('#2a2020'), hs='short',   top=c('#d0782a'), trim=c('#fff0b0'), pants=c('#e8d8a8'), boots=c('#7a4a20'), scarf=c('#ffd060')),
  'voltessa':  dict(el='thunder', f=True,  skin=0, hair=c('#f4f4ff'), hs='long',    top=c('#3a2a7a'), trim=c('#ffe14a'), pants=c('#1e1840'), boots=c('#14102a')),
  'thundrik':  dict(el='thunder', f=False, skin=2, hair=c('#f0f0ff'), hs='spiky',   top=c('#2a2a6a'), trim=c('#ffe14a'), pants=c('#181838'), boots=c('#101024')),
  'tempestro': dict(el='thunder', f=False, skin=4, hair=c('#f8f8ff'), hs='mane',    top=c('#1a1a24'), trim=GOLD,           pants=c('#14141c'), boots=c('#0e0e14'), elite=True, eyes=c('#ffe14a')),
  # Sky Benders (air + a second element). el2 = the second element they bend; 'all' = COVO / COVA (all five)
  'galdris':  dict(el='air', el2='air',     f=False, skin=1, hair=c('#c8d8f0'), hs='mohawk',  top=c('#2a8ad8'), trim=c('#e8fbff'), pants=c('#1a3a5a'), boots=c('#e8eef8'), goggles=c('#5ec2ff')),
  'skyvar':   dict(el='air', el2='thunder', f=False, skin=4, hair=c('#1a1414'), hs='afro',    top=c('#4a3ab8'), trim=c('#ffe14a'), pants=c('#241c50'), boots=c('#14102a')),
  'windrik':  dict(el='air', el2='fire',    f=False, skin=0, hair=c('#c83a1a'), hs='spiky',   top=c('#c84a2a'), trim=c('#ffd060'), pants=c('#3a1a14'), boots=c('#2a1410'), scarf=c('#ffb030')),
  'aeromar':  dict(el='air', el2='water',   f=False, skin=2, hair=c('#1a3a4a'), hs='topknot', top=c('#2ab8b8'), trim=c('#dff6ff'), pants=c('#1a4a5a'), boots=c('#e8eef8')),
  'cyrran':   dict(el='air', el2='earth',   f=False, skin=3, hair=c('#2a1a10'), hs='short',   top=c('#6a8a3a'), trim=c('#e0c890'), pants=c('#5a4630'), boots=c('#3a2a1a'), band=c('#e0c890')),
  'aerisa':   dict(el='air', el2='air',     f=True,  skin=0, hair=c('#f0c8e0'), hs='twin',    top=c('#e85a9a'), trim=c('#ffffff'), pants=c('#f8e0ec'), boots=c('#c83a7a')),
  'sylvane':  dict(el='air', el2='water',   f=True,  skin=3, hair=c('#1a2a4a'), hs='long',    top=c('#3a7ad8'), trim=c('#bfefff'), pants=c('#1e3a6e'), boots=c('#e8eef8')),
  'zephra':   dict(el='air', el2='fire',    f=True,  skin=1, hair=c('#ff8a3a'), hs='pony',    top=c('#e8702a'), trim=c('#fff0b0'), pants=c('#3a1a10'), boots=c('#2a1410')),
  'windara':  dict(el='air', el2='thunder', f=True,  skin=4, hair=c('#f4f4ff'), hs='afro',    top=c('#7a3ac8'), trim=c('#ffe14a'), pants=c('#241840'), boots=c('#14102a')),
  'skylis':   dict(el='air', el2='earth',   f=True,  skin=2, hair=c('#3a2418'), hs='braid',   top=c('#5a9a5a'), trim=c('#f0e0b0'), pants=c('#4a3a24'), boots=c('#2e2418')),
  'covo':     dict(el='air', el2='all',     f=False, skin=4, hair=c('#ffd23f'), hs='spiky',   top=c('#14141a'), trim=c('#ffd23f'), pants=c('#0e0e14'), boots=c('#0a0a0e'), elite=True, eyes=c('#ffe14a'), keep=True),
  'cova':     dict(el='air', el2='all',     f=True,  skin=4, hair=c('#ffd23f'), hs='long',    top=c('#14141a'), trim=c('#ffd23f'), pants=c('#0e0e14'), boots=c('#0a0a0e'), elite=True, eyes=c('#ffe14a'), keep=True),
  'kena':     dict(el='air', el2='all',     f=True,  skin=3, hair=c('#f4f4ff'), hs='braid',   top=c('#2a1440'), trim=c('#5ef0e0'), pants=c('#14081f'), boots=c('#0e0618'), elite=True, eyes=c('#5ef0e0'), keep=True),
  # Starter Benders (every new player gets one at random)
  'aquari':   dict(el='water',   f=True,  skin=2, hair=c('#2a1a3a'), hs='twin',    top=c('#2a8ad8'), trim=c('#dff6ff'), pants=c('#1e3a6e'), boots=c('#e8eef8')),
  'rokko':    dict(el='earth',   f=False, skin=3, hair=c('#1a1010'), hs='afro',    top=c('#7a6a3a'), trim=c('#e0c890'), pants=c('#4a3a24'), boots=c('#2e2418'), band=c('#c8a060')),
  'blazen':   dict(el='fire',    f=False, skin=1, hair=c('#c83a1a'), hs='spiky',   top=c('#d8401a'), trim=c('#ffd060'), pants=c('#2a1414'), boots=c('#1a0e0e')),
  'gusti':    dict(el='air',     f=True,  skin=0, hair=c('#c8a060'), hs='pony',    top=c('#e8a03a'), trim=c('#fff0b0'), pants=c('#f4e8c8'), boots=c('#8a5a2a'), scarf=c('#ffd060')),
  'voltz':    dict(el='thunder', f=False, skin=4, hair=c('#ffe14a'), hs='mohawk',  top=c('#4a3ac8'), trim=c('#ffe14a'), pants=c('#1e1840'), boots=c('#14102a'), goggles=c('#ffe14a')),
  # Market Sky Benders (1 SOL each): five per element, boys and girls
  'breezo': dict(el='air', el2='air', f=False, skin=0, hair=c('#1a1414'), hs='short', top=c('#4ac8e8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#4ac8e8'), 0.55), boots=c('#2a2018')),
  'nimbra': dict(el='air', el2='air', f=True, skin=1, hair=c('#e8d8c0'), hs='pony', top=c('#c8e8ff'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#c8e8ff'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'cirrus': dict(el='air', el2='air', f=False, skin=2, hair=c('#2a1a3a'), hs='mohawk', top=c('#7ab8e8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#7ab8e8'), 0.55), boots=c('#2a2018'), band=c('#ffffff')),
  'aeralyn': dict(el='air', el2='air', f=True, skin=3, hair=c('#3a2418'), hs='bun', top=c('#f0a0c8'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#f0a0c8'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'zephyl': dict(el='air', el2='air', f=True, skin=4, hair=c('#c83a1a'), hs='braid', top=c('#a8e8d8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#a8e8d8'), 0.55), boots=c('#2a2018')),
  'tidegale': dict(el='air', el2='water', f=False, skin=0, hair=c('#5a3a20'), hs='short', top=c('#2a6ab8'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#2a6ab8'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'mistral': dict(el='air', el2='water', f=True, skin=1, hair=c('#c8a060'), hs='pony', top=c('#5ab8e8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#5ab8e8'), 0.55), boots=c('#2a2018')),
  'rainor': dict(el='air', el2='water', f=False, skin=2, hair=c('#f4f4ff'), hs='mohawk', top=c('#3a8ab8'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#3a8ab8'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'oceara': dict(el='air', el2='water', f=True, skin=3, hair=c('#1a1414'), hs='bun', top=c('#1a9ac8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#1a9ac8'), 0.55), boots=c('#2a2018')),
  'glacia': dict(el='air', el2='water', f=True, skin=4, hair=c('#e8d8c0'), hs='braid', top=c('#a0d8f8'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#a0d8f8'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'dustan': dict(el='air', el2='earth', f=False, skin=0, hair=c('#2a1a3a'), hs='short', top=c('#a07a4a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#a07a4a'), 0.55), boots=c('#2a2018'), band=c('#ffffff')),
  'rockwen': dict(el='air', el2='earth', f=True, skin=1, hair=c('#3a2418'), hs='pony', top=c('#8a8a5a'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#8a8a5a'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'sandor': dict(el='air', el2='earth', f=False, skin=2, hair=c('#c83a1a'), hs='mohawk', top=c('#c8a060'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#c8a060'), 0.55), boots=c('#2a2018')),
  'terrai': dict(el='air', el2='earth', f=True, skin=3, hair=c('#5a3a20'), hs='bun', top=c('#7a6a3a'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#7a6a3a'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'quarra': dict(el='air', el2='earth', f=True, skin=4, hair=c('#c8a060'), hs='braid', top=c('#9a8a6a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#9a8a6a'), 0.55), boots=c('#2a2018')),
  'emberwind': dict(el='air', el2='fire', f=False, skin=0, hair=c('#f4f4ff'), hs='short', top=c('#e0482a'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#e0482a'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'ashra': dict(el='air', el2='fire', f=True, skin=1, hair=c('#1a1414'), hs='pony', top=c('#c83a5a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#c83a5a'), 0.55), boots=c('#2a2018')),
  'blazor': dict(el='air', el2='fire', f=False, skin=2, hair=c('#e8d8c0'), hs='mohawk', top=c('#d85a1a'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#d85a1a'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'flarissa': dict(el='air', el2='fire', f=True, skin=3, hair=c('#2a1a3a'), hs='bun', top=c('#ff8a3a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#ff8a3a'), 0.55), boots=c('#2a2018')),
  'pyrrin': dict(el='air', el2='fire', f=False, skin=4, hair=c('#3a2418'), hs='afro', top=c('#c8301a'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#c8301a'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'voltair': dict(el='air', el2='thunder', f=False, skin=0, hair=c('#c83a1a'), hs='short', top=c('#4a4ad8'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#4a4ad8'), 0.55), boots=c('#2a2018')),
  'sparra': dict(el='air', el2='thunder', f=True, skin=1, hair=c('#5a3a20'), hs='pony', top=c('#ffd23f'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#ffd23f'), 0.55), boots=c('#2a2018'), goggles=c('#5ec2ff')),
  'thundro': dict(el='air', el2='thunder', f=False, skin=2, hair=c('#c8a060'), hs='mohawk', top=c('#2a2a7a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#2a2a7a'), 0.55), boots=c('#2a2018'), band=c('#ffffff')),
  'zappira': dict(el='air', el2='thunder', f=True, skin=3, hair=c('#f4f4ff'), hs='bun', top=c('#9a6aff'), trim=c('#ffffff' if 1 else '#ffe080'), pants=shade(c('#9a6aff'), 0.55), boots=c('#2a2018'), scarf=c('#ffd060')),
  'boltan': dict(el='air', el2='thunder', f=False, skin=4, hair=c('#1a1414'), hs='afro', top=c('#e8c83a'), trim=c('#ffffff' if 0 else '#ffe080'), pants=shade(c('#e8c83a'), 0.55), boots=c('#2a2018')),
}

def limb(g, x1, y1, x2, y2, w, col, edge):
    """A rounded limb segment with a darker edge on its lower side."""
    a = math.atan2(y2 - y1, x2 - x1); nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    g.polygon([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)], fill=col)
    g.ellipse([x1 - w / 2, y1 - w / 2, x1 + w / 2, y1 + w / 2], fill=col); g.ellipse([x2 - w / 2, y2 - w / 2, x2 + w / 2, y2 + w / 2], fill=col)
    g.line([(x1 + nx * 0.9, y1 + ny * 0.9), (x2 + nx * 0.9, y2 + ny * 0.9)], fill=edge, width=max(1, int(w / 4)))

def leg_points(hx, hy, thigh, shin, a_thigh, knee):
    kx, ky = hx + math.sin(a_thigh) * thigh, hy + math.cos(a_thigh) * thigh
    a2 = a_thigh - knee
    return (kx, ky), (kx + math.sin(a2) * shin, ky + math.cos(a2) * shin)

def frame(d, f, stage):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    run = f >= 2; k = f - 2; ph = (k * math.pi / 2) if run else 0
    sc = [0.72, 0.84, 1.0, 1.0, 1.0, 1.0][stage]                 # younger forms are smaller
    head_r = [12, 11.5, 11, 11, 11, 11][stage]
    skin = SKIN[d['skin']]; skin_d = shade(skin, 0.22)
    top, trim, pants, boots = d['top'], d['trim'], d['pants'], d['boots']
    if stage == 0: top, pants = tint(top, 0.25), tint(pants, 0.2)
    if stage == 5: trim = GOLD
    air = d['el'] == 'air'
    ALL = ['fire', 'water', 'earth', 'air', 'thunder']
    he = d.get('el2') or d['el']
    if he == 'all': he = ALL[(f + stage) % 5]          # COVO / COVA: a different element in the hand each frame
    if air and not d.get('keep'):  # air benders change outfit at every stage
        if stage == 3: top, trim = shade(top, 0.12), c('#5ec2ff')                 # master: sky-blue trim
        if stage == 4: top, trim, pants = c('#f2f4ff'), d['top'], c('#d8dcef')    # Mega: white wind robes with the old colour as trim
        if stage == 5: top, trim, pants = c('#fffaf0'), GOLD, c('#f0e6c8')        # Ascended: white and gold
    el_col, el_hi = ELEM[d['el']]
    rnd = random.Random(f * 7 + stage)
    cx = 46; ground = H - 4
    bob = (-1.5 if f == 1 else 0) if not run else -abs(math.sin(ph)) * 3
    if air and stage >= 4: bob -= 7 + (f % 2)  # Mega air benders ride a small whirlwind
    leg_len = 34 * sc; thigh, shin = leg_len * 0.5, leg_len * 0.5
    hip_y = ground - leg_len - 2 + bob
    torso_h = 30 * sc; sh_y = hip_y - torso_h
    head_cy = sh_y - head_r * 0.9 - 2
    lean = 0.12 if run else 0                                      # leans into the run
    shx = cx + lean * torso_h
    # ----- element aura / mantle behind (master and up) -----
    if stage >= 3:
        aura = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ag = ImageDraw.Draw(aura)
        r = 30 + stage * 3; ag.ellipse([cx - r, head_cy - 6 - r * 0.5, cx + r, hip_y + r * 0.7], fill=el_col[:3] + (70 if stage == 3 else 100,))
        im.alpha_composite(aura.filter(ImageFilter.GaussianBlur(5)))
    if stage >= 4:  # element mantle: shapes rising behind the shoulders
        for side in (-1, 1):
            for i in range(5):
                bx = shx + side * (10 + i * 5); by = sh_y + 4 - i * 6 + (f % 2)
                me = he if (i % 2 and d.get('el2')) else d['el']
                if d.get('el2') == 'all': me = ALL[(i + side + f) % 5]
                if me == 'fire': g.polygon([(bx - 4, by + 10), (bx + 4, by + 10), (bx + side * 2, by - 10)], fill=ELEM['fire'][0] if i % 2 else ELEM['fire'][1])
                elif me == 'water': g.ellipse([bx - 5, by - 5, bx + 5, by + 5], outline=ELEM['water'][0], width=2)
                elif me == 'earth': g.polygon([(bx - 5, by), (bx, by - 6), (bx + 5, by - 1), (bx + 3, by + 5), (bx - 4, by + 4)], fill=ELEM['earth'][0] if i % 2 else ELEM['earth'][1])
                elif me == 'air': g.arc([bx - 7, by - 7, bx + 7, by + 7], 200, 340, fill=ELEM['air'][0], width=2)
                else: g.line([(bx, by - 8), (bx - 3 * side, by), (bx + 2 * side, by + 1), (bx - 1, by + 9)], fill=ELEM['thunder'][0] if i % 2 else ELEM['thunder'][1], width=2)
    # cape / cloak behind (bender and up; elite gets a storm cloak)
    if stage >= 2 or d.get('elite'):
        cl = shade(top, 0.35) if not d.get('elite') else c('#2a2440')
        flow = 6 if run else 0
        g.polygon([(shx - 10, sh_y + 2), (shx + 8, sh_y + 2), (cx + 2 - flow, hip_y + 16 * sc), (cx - 18 - flow, hip_y + 20 * sc)], fill=cl)
    if air and stage >= 4:
        for i in range(4): g.arc([cx - 16 + i * 2, ground - 10 + i * 2, cx + 16 - i * 2, ground + 2 - i], 200 + f * 30 + i * 40, 520 + f * 30 + i * 40, fill=el_hi if i % 2 else c('#bfe8ff'), width=2)
    # ----- legs (back leg first) -----
    swing = math.sin(ph) * 0.65 if run else 0
    for side, sgn in (('back', -1), ('front', 1)):
        a = sgn * swing
        knee = (0.9 * max(0, -math.cos(ph + (0 if sgn > 0 else math.pi)))) if run else 0.05
        hx = cx + (-3 if side == 'back' else 3) * sc
        (kx, ky), (fx_, fy_) = leg_points(hx, hip_y, thigh, shin, a, knee)
        col = shade(pants, 0.18) if side == 'back' else pants
        limb(g, hx, hip_y, kx, ky, 9 * sc, col, shade(col, 0.3)); limb(g, kx, ky, fx_, fy_, 8 * sc, col, shade(col, 0.3))
        bc = shade(boots, 0.15) if side == 'back' else boots
        g.polygon([(fx_ - 4 * sc, fy_ - 3), (fx_ + 7 * sc, fy_ - 2), (fx_ + 8 * sc, fy_ + 2), (fx_ - 4 * sc, fy_ + 2)], fill=bc)
        if stage >= 1: g.line([(fx_ - 4 * sc, fy_ - 4), (fx_ + 4 * sc, fy_ - 4)], fill=trim, width=1)
    # ----- back arm -----
    arm_sw = -swing * 0.9 if run else (0.15 if f == 1 else 0.1)
    def arm(side, a):
        sx = shx + (-8 if side == 'back' else 9) * sc; sy = sh_y + 3
        ex, ey = sx + math.sin(a) * 12 * sc, sy + math.cos(a) * 12 * sc
        a2 = a + (0.9 if run else 0.5)
        hx, hy = ex + math.sin(a2) * 11 * sc, ey + math.cos(a2) * 11 * sc
        col = shade(top, 0.2) if side == 'back' else top
        limb(g, sx, sy, ex, ey, 7.5 * sc, col, shade(col, 0.3))
        sleeve_skin = d['el'] == 'earth' and stage >= 2
        limb(g, ex, ey, hx, hy, 6.5 * sc, skin_d if side == 'back' else (skin if sleeve_skin else col), shade(skin, 0.35))
        if not sleeve_skin: g.line([(ex, ey), (ex + (hx - ex) * 0.3, ey + (hy - ey) * 0.3)], fill=trim, width=2)
        g.ellipse([hx - 3.5 * sc, hy - 3.5 * sc, hx + 3.5 * sc, hy + 3.5 * sc], fill=skin_d if side == 'back' else skin)
        return hx, hy
    bhx, bhy = arm('back', -arm_sw)
    # ----- torso -----
    tw = 19 * sc
    g.polygon([(shx - tw / 2, sh_y), (shx + tw / 2, sh_y), (cx + tw / 2 - 2, hip_y + 2), (cx - tw / 2 + 2, hip_y + 2)], fill=top)
    g.polygon([(shx - tw / 2, sh_y), (shx - tw / 2 + 4, sh_y), (cx - tw / 2 + 5, hip_y + 2), (cx - tw / 2 + 2, hip_y + 2)], fill=shade(top, 0.22))
    g.line([(shx + 1, sh_y + 1), (cx + 3, hip_y - 4)], fill=trim, width=2)                       # wrap-tunic edge
    g.rectangle([cx - tw / 2 + 1, hip_y - 4, cx + tw / 2 - 1, hip_y + 1], fill=trim)             # sash / belt
    if d.get('scarf') and stage >= 1: g.polygon([(shx - 8, sh_y - 1), (shx + 8, sh_y - 1), (shx + 4, sh_y + 5), (shx - 6, sh_y + 4)], fill=d['scarf'])
    if stage >= 3:  # master armour: shoulder guards and an element emblem
        for s2 in (-1, 1): g.ellipse([shx + s2 * 8 - 6, sh_y - 3, shx + s2 * 8 + 6, sh_y + 6], fill=trim if stage < 5 else GOLD, outline=shade(trim, 0.35))
        g.ellipse([shx - 4, sh_y + 8, shx + 4, sh_y + 16], fill=el_col, outline=shade(el_col, 0.4))
    if air and stage >= 1:  # wooden staff held upright behind the shoulder; from bender stage it opens into a wind fan at the top
        tx, ty = bhx - 9, bhy - 58 * sc
        g.line([(bhx - 2, bhy + 12), (tx, ty)], fill=c('#8a5a2a') if stage < 5 else GOLD, width=3)
        if stage >= 2:
            for s2 in (-1, 1): g.polygon([(tx, ty), (tx + s2 * 12, ty + 4), (tx + s2 * 9, ty + 10)], fill=trim if stage < 4 else el_hi, outline=shade(trim, 0.35))
    # ----- head -----
    hx, hy = shx + 2, head_cy
    hair = d['hair']
    if d['hs'] in ('long', 'braid', 'mane'):  # hair behind the head and shoulders
        g.polygon([(hx - head_r, hy - 4), (hx + head_r * 0.4, hy - 6), (hx + 2, sh_y + 14), (hx - head_r - 4, sh_y + 16)], fill=shade(hair, 0.1))
        if d['hs'] == 'braid': [g.ellipse([hx - head_r - 2, sh_y + i * 5, hx - head_r + 5, sh_y + 6 + i * 5], fill=hair, outline=shade(hair, 0.3)) for i in range(4)]
    if air and stage == 2 and not d.get('el2'): g.ellipse([hx - head_r - 4, hy - head_r - 5, hx + head_r + 2, hy + head_r + 3], fill=shade(top, 0.15))   # hood behind the head
    g.rectangle([hx - 3, hy + head_r - 3, hx + 3, sh_y + 2], fill=skin_d)                         # neck
    g.ellipse([hx - head_r, hy - head_r, hx + head_r, hy + head_r], fill=skin)
    g.chord([hx - head_r, hy - head_r, hx + head_r, hy + head_r], 100, 240, fill=skin_d)          # shadow on the far side
    g.ellipse([hx + head_r - 4, hy - 1, hx + head_r + 2, hy + 4], fill=skin)                      # nose / cheek toward the viewer
    # face (looking right)
    ex1, ex2, ey = hx + 1, hx + 7, hy - 1
    eye_col = d.get('eyes') or c('#ffffff')
    for ex in (ex1, ex2):
        g.ellipse([ex - 2.5, ey - 2.5, ex + 2.5, ey + 2.5], fill=eye_col)
        if not d.get('eyes'): g.ellipse([ex - 0.5, ey - 1.5, ex + 2, ey + 1.5], fill=c('#1a1a2a'))
    if d.get('eyes'): [g.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], outline=eye_col[:3] + (110,)) for ex in (ex1, ex2)]
    brow = shade(hair, 0.2) if hair[0] > 120 else hair
    g.line([(ex1 - 3, ey - 4), (ex1 + 2, ey - 5 + (1 if stage >= 3 else 0))], fill=brow, width=2); g.line([(ex2 - 2, ey - 5 + (1 if stage >= 3 else 0)), (ex2 + 3, ey - 4)], fill=brow, width=2)
    g.line([(hx + 3, hy + 6), (hx + 8, hy + 5 + (0 if stage < 3 else 1))], fill=shade(skin, 0.45), width=1)   # mouth (sterner when older)
    if d['f']: [g.line([(ex - 3, ey - 3), (ex - 4, ey - 4)], fill=c('#1a1a2a'), width=1) for ex in (ex1, ex2)]; g.line([(hx + 3, hy + 6), (hx + 7, hy + 6)], fill=c('#c0504a'), width=2)
    # hair on top
    hs = d['hs']
    g.chord([hx - head_r - 1, hy - head_r - 2, hx + head_r + 1, hy + head_r * 0.6], 180, 360, fill=hair)
    g.polygon([(hx - head_r - 1, hy - 2), (hx - head_r + 3, hy - 9), (hx - head_r + 6, hy + 3)], fill=hair)  # side lock over the ear
    if hs == 'topknot': g.ellipse([hx - 4, hy - head_r - 9, hx + 4, hy - head_r - 1], fill=hair); g.rectangle([hx - 4, hy - head_r - 3, hx + 4, hy - head_r - 1], fill=trim)
    if hs == 'afro':  # round hair above the face and puffed out behind the far ear
        g.ellipse([hx - head_r - 6, hy - 9, hx - head_r + 6, hy + 6], fill=hair); g.chord([hx - head_r - 5, hy - head_r - 14, hx + head_r + 5, hy + 6], 180, 360, fill=hair); g.arc([hx - head_r - 3, hy - head_r - 12, hx + head_r + 3, hy], 200, 320, fill=tint(hair, 0.25), width=1)
    if hs == 'mohawk':
        for i in range(6): sx = hx - head_r + 2 + i * 3.6; g.polygon([(sx - 2, hy - head_r + 2), (sx + 2, hy - head_r + 2), (sx + 1, hy - head_r - 9 - (i % 2) * 2)], fill=hair)
    if hs == 'twin':
        for s2 in (-1, 1): g.polygon([(hx + s2 * (head_r - 2), hy - 6), (hx + s2 * (head_r + 9), hy + 2 + (f % 2) * 2), (hx + s2 * (head_r + 4), hy + 12)], fill=hair)
    if hs == 'bun': g.ellipse([hx - head_r - 4, hy - head_r - 3, hx - head_r + 6, hy - head_r + 7], fill=hair)
    if hs == 'pony': g.polygon([(hx - head_r, hy - 6), (hx - head_r - 12, hy + 4 + (f % 2) * 2), (hx - head_r - 6, hy + 10)], fill=hair)
    if hs in ('spiky', 'mane'):
        for i in range(5): sx = hx - head_r + 3 + i * 4.5; g.polygon([(sx - 3, hy - head_r + 3), (sx + 3, hy - head_r + 3), (sx - 1 - (i - 2), hy - head_r - 7 - (i % 2) * 3)], fill=hair)
    if hs == 'mane': g.polygon([(hx - head_r, hy - 4), (hx - head_r - 10, hy + 8), (hx - head_r + 2, hy + 6)], fill=hair)
    g.line([(hx - head_r + 2, hy - head_r * 0.35), (hx + head_r - 3, hy - head_r * 0.5)], fill=tint(hair, 0.35), width=1)  # hair shine
    if air and stage == 2 and not d.get('el2'): g.chord([hx - head_r - 4, hy - head_r - 5, hx + head_r + 2, hy + 2], 190, 350, fill=shade(top, 0.15)); g.arc([hx - head_r - 4, hy - head_r - 5, hx + head_r + 2, hy + head_r + 3], 190, 350, fill=trim, width=2)
    if air and stage == 3:
        for s2 in (-1, 1): g.polygon([(hx + s2 * 6, hy - head_r), (hx + s2 * 14, hy - head_r - 10), (hx + s2 * 3, hy - head_r - 2)], fill=c('#5ec2ff'))
    if air and stage >= 4:  # rings of wind around the head
        g.ellipse([hx - head_r - 6, hy - head_r - 12, hx + head_r + 6, hy - head_r - 4], outline=el_hi if stage == 4 else GOLD, width=2)
    if d.get('goggles') and stage >= 1:  # flight goggles pushed up on the forehead
        g.line([(hx - head_r, hy - 6), (hx + head_r, hy - 8)], fill=c('#3a2a20'), width=2)
        for gx2 in (hx + 1, hx + 7): g.ellipse([gx2 - 3, hy - 11, gx2 + 3, hy - 5], fill=d['goggles'], outline=c('#3a2a20'))
    if d.get('band') and stage >= 1: g.line([(hx - head_r, hy - 5), (hx + head_r, hy - 7)], fill=d['band'], width=3)
    if stage >= 5:  # element crown
        for i in range(5): px_ = hx - 9 + i * 4.5; g.polygon([(px_ - 2, hy - head_r - 2), (px_ + 2, hy - head_r - 2), (px_, hy - head_r - 8 - (i % 2) * 4)], fill=GOLD)
    if d.get('elite'):  # storm crown and glowing eyes for the elite thunder bender
        g.arc([hx - head_r - 4, hy - head_r - 8, hx + head_r + 4, hy + 2], 200, 340, fill=GOLD, width=2)
    # ----- front arm, hand holding the element -----
    hx2, hy2 = arm('front', arm_sw + (0.0 if run else -0.9))
    if stage >= 1:  # element in the front hand
        hc, hh = ELEM[he]
        if he == 'fire': g.polygon([(hx2 - 4, hy2), (hx2 + 4, hy2), (hx2 + 1, hy2 - 10 - (f % 2) * 3)], fill=hc); g.polygon([(hx2 - 2, hy2), (hx2 + 2, hy2), (hx2, hy2 - 6)], fill=hh)
        elif he == 'water': g.arc([hx2 - 7, hy2 - 9, hx2 + 7, hy2 + 5], 200 + f * 20, 520 + f * 20, fill=hc, width=3)
        elif he == 'earth': g.polygon([(hx2 - 5, hy2 - 8), (hx2, hy2 - 13), (hx2 + 6, hy2 - 9), (hx2 + 4, hy2 - 3), (hx2 - 4, hy2 - 3)], fill=hh, outline=shade(hc, 0.4))
        elif he == 'air': g.arc([hx2 - 8, hy2 - 8, hx2 + 8, hy2 + 8], 30 + f * 40, 300 + f * 40, fill=hc, width=2); g.arc([hx2 - 4, hy2 - 4, hx2 + 4, hy2 + 4], f * 40, 250 + f * 40, fill=hh, width=1)
        else:
            for j in range(2): g.line([(hx2, hy2), (hx2 + rnd.randint(-6, 6), hy2 - 5), (hx2 + rnd.randint(-8, 8), hy2 - 11)], fill=hh if j else hc, width=2)
    if d.get('el2') == 'all' and stage >= 2:  # five element orbs circle COVO / COVA
        for i, e2 in enumerate(ALL):
            a = f * 0.5 + i * 1.2566; ox, oy = cx + math.cos(a) * 30, (sh_y + hip_y) / 2 + math.sin(a) * 12 - 4
            col, hi = ELEM[e2]; g.ellipse([ox - 4, oy - 4, ox + 4, oy + 4], fill=col, outline=shade(col, 0.4)); g.ellipse([ox - 2, oy - 2, ox, oy], fill=hi)
    if stage >= 5 or d.get('elite'):
        for i in range(8): x, y = rnd.randint(4, W - 4), rnd.randint(4, H // 2); g.point((x, y), fill=(GOLD if stage >= 5 and not d.get('elite') else el_hi))
    # 1px outline around the silhouette
    a = im.getchannel('A').point(lambda v: 255 if v > 90 else 0); ring = a.filter(ImageFilter.MaxFilter(3))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.paste(OUT, (0, 0), ring); out.alpha_composite(im)
    return out

only = set(sys.argv[1:])
for name, d in D.items():
    if only and name not in only: continue
    for stage in range(6):
        frames = [frame(d, f, stage) for f in range(6)]
        sheet = Image.new('RGBA', (W * 6, H), (0, 0, 0, 0))
        for i, fr in enumerate(frames): sheet.paste(fr, (i * W, 0))
        sheet.save(os.path.join(WALK, f'{name}_s{stage}.png'))
        frames[0].save(os.path.join(HD, f'{name}_s{stage}.png'))
        if stage == 2: frames[0].save(os.path.join(HD, name + '.png'))
print('benders', len(D))
