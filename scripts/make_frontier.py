"""Draw the 50 Frontier Monstars (dist/art/hd/<name>.png) from the `look` data in shared/frontier.mjs.
Each creature is built from shaded body parts at 480px, then cleaned to a 96px sprite with a bold outline
(same pipeline as the other battle sprites). Run: python3 scripts/make_frontier.py"""
import json, math, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist/art/hd'); os.makedirs(OUT, exist_ok=True)
S = 480

def load_clean():
    src = open(os.path.join(os.path.dirname(__file__), 'make_sprites.py')).read()
    src = src[:src.index("for n in ['cindercub'")]  # just the helpers
    ns = {'__file__': 'make_sprites.py'}; cwd = os.getcwd(); os.chdir(ROOT); exec(src, ns); os.chdir(cwd); return ns['clean']
clean = load_clean()

def rgb(h, a=255):
    if isinstance(h, tuple): return h[:3] + (a,)
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def mix(c, d, t): return tuple(round(c[i] + (d[i] - c[i]) * t) for i in range(3)) + (255,)
def dark(c, t=0.32): return mix(c, (20, 14, 30), t)
def light(c, t=0.45): return mix(c, (255, 255, 255), t)

class Canvas:
    def __init__(s): s.im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    def part(s, draw_fn, col, shade=True, edge=True, pattern=None):
        """Draw a shaded part: base colour, bottom-right shadow, top-left highlight, dark rim."""
        m = Image.new('L', (S, S), 0); draw_fn(ImageDraw.Draw(m)); c = rgb(col) if isinstance(col, str) else col
        layer = Image.new('RGBA', (S, S), c)
        if pattern: pattern(layer, m)
        if shade:
            o = 14; up = ImageChops.offset(m, -o, -o); sh = ImageChops.subtract(m, up)
            layer.paste(dark(c, 0.28), mask=sh.filter(ImageFilter.GaussianBlur(1)))
            dn = ImageChops.offset(m, 10, 10); hl = ImageChops.subtract(m, dn).filter(ImageFilter.MinFilter(5))
            layer.paste(light(c, 0.35), mask=hl)
        if edge:
            er = m.filter(ImageFilter.MinFilter(7)); rim = ImageChops.subtract(m, er); layer.paste(dark(c, 0.55), mask=rim)
        s.im.paste(layer, (0, 0), m)
    def raw(s): return ImageDraw.Draw(s.im)

def E(cx, cy, rx, ry): return lambda d: d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
def P(pts): return lambda d: d.polygon([tuple(map(round, p)) for p in pts], fill=255)
def RR(x0, y0, x1, y1, r): return lambda d: d.rounded_rectangle([x0, y0, x1, y1], r, fill=255)
def LINE(pts, w): return lambda d: (d.line([tuple(map(round, p)) for p in pts], fill=255, width=w, joint='curve'), [d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=255) for p in (pts[0], pts[-1])])

def eye(cv, x, y, r=17, style='normal', col=(30, 22, 48, 255)):
    d = cv.raw()
    if style == 'big': r = int(r * 1.45)
    if style == 'cyclops': r = int(r * 2.2)
    d.ellipse([x - r, y - r * 1.15, x + r, y + r * 1.15], fill=(255, 255, 255, 255), outline=(30, 22, 48, 255), width=4)
    pr = r * 0.62; d.ellipse([x - pr + r * 0.2, y - pr, x + pr + r * 0.2, y + pr * 1.1], fill=col)
    g = r * 0.28; d.ellipse([x + r * 0.05, y - r * 0.5, x + r * 0.05 + g * 2, y - r * 0.5 + g * 2], fill=(255, 255, 255, 255))

def pattern_fn(kind, accent, rnd):
    a = rgb(accent)
    def f(layer, m):
        d = ImageDraw.Draw(layer); bb = m.getbbox()
        if not bb: return
        x0, y0, x1, y1 = bb
        if kind == 'spots':
            for _ in range(9): cx, cy, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(9, 20); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
        elif kind in ('stripes',):
            for i in range(5): x = x0 + (x1 - x0) * (0.2 + i * 0.16); d.polygon([(x, y0), (x + 16, y0), (x - 4, y1 * 0.7 + y0 * 0.3), (x - 14, y1 * 0.7 + y0 * 0.3)], fill=dark(a, 0.2))
        elif kind == 'stars':
            for _ in range(7):
                cx, cy, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(6, 11)
                d.polygon([(cx, cy - r * 2), (cx + r * 0.5, cy - r * 0.5), (cx + r * 2, cy), (cx + r * 0.5, cy + r * 0.5), (cx, cy + r * 2), (cx - r * 0.5, cy + r * 0.5), (cx - r * 2, cy), (cx - r * 0.5, cy - r * 0.5)], fill=a)
        elif kind == 'rivets':
            for _ in range(10): cx, cy = rnd.uniform(x0 + 10, x1 - 10), rnd.uniform(y0 + 10, y1 - 10); d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=light(layer.getpixel((0, 0)), 0.5)); d.ellipse([cx - 2, cy - 2, cx + 4, cy + 4], fill=dark(layer.getpixel((0, 0)), 0.5))
        elif kind == 'diamonds':
            for i in range(6): cx = x0 + (x1 - x0) * (i + 0.5) / 6; cy = (y0 + y1) / 2; d.polygon([(cx, cy - 18), (cx + 14, cy), (cx, cy + 18), (cx - 14, cy)], fill=a)
        elif kind == 'cracks':
            for _ in range(5):
                x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1); pts = [(x, y)]
                for k in range(5): x += rnd.uniform(-22, 22); y += rnd.uniform(4, 18); pts.append((x, y))
                d.line(pts, fill=a, width=7)
        elif kind == 'bubbles':
            for _ in range(6): cx, cy, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), rnd.uniform(8, 16); d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=4)
        elif kind == 'flakes':
            for _ in range(6):
                cx, cy, r = rnd.uniform(x0, x1), rnd.uniform(y0, y1), 12
                for k in range(3): an = k * math.pi / 3; d.line([(cx - math.cos(an) * r, cy - math.sin(an) * r), (cx + math.cos(an) * r, cy + math.sin(an) * r)], fill=a, width=4)
        elif kind == 'eyes':
            for cx, cy in ((x0 + (x1 - x0) * 0.35, (y0 + y1) / 2), (x0 + (x1 - x0) * 0.68, (y0 + y1) / 2)):
                d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=a); d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(30, 22, 48, 255))
        elif kind == 'runes':
            for i in range(4): cx = x0 + (x1 - x0) * (i + 0.5) / 4; cy = y0 + (y1 - y0) * 0.6; d.line([(cx - 10, cy - 14), (cx + 6, cy), (cx - 8, cy + 14)], fill=a, width=5)
    return f

# ---------- features ----------
def horns(cv, kind, x, y, col, s=1.0):
    c = col
    if kind == 'one': cv.part(P([(x - 14, y + 8), (x + 14, y + 8), (x + 22, y - 70 * s)]), c)
    elif kind == 'two':
        for dx in (-26, 18): cv.part(P([(x + dx - 12, y + 10), (x + dx + 12, y + 10), (x + dx - 8, y - 58 * s)]), c)
    elif kind == 'curved':
        for dx in (-28, 16): cv.part(LINE([(x + dx, y + 6), (x + dx - 18, y - 30), (x + dx + 6, y - 60 * s), (x + dx + 30, y - 52 * s)], 18), c)
    elif kind == 'antlers':
        for dx, sgn in ((-24, -1), (16, 1)):
            base = [(x + dx, y + 6), (x + dx + sgn * 10, y - 50 * s), (x + dx + sgn * 30, y - 96 * s)]
            cv.part(LINE(base, 14), c)
            for t in (0.45, 0.8): bx = base[0][0] + (base[2][0] - base[0][0]) * t; by = base[0][1] + (base[2][1] - base[0][1]) * t; cv.part(LINE([(bx, by), (bx + sgn * 34, by - 22)], 11), c)
    elif kind == 'tusks':
        for dx in (0, 22): cv.part(LINE([(x + dx, y), (x + dx + 26, y + 18), (x + dx + 34, y - 10)], 12), '#f6f0e2')

def ears(cv, kind, x, y, col, inner):
    if kind == 'pointy':
        for dx in (-34, 14): cv.part(P([(x + dx - 20, y + 10), (x + dx + 22, y + 6), (x + dx + 4, y - 62)]), col); cv.part(P([(x + dx - 8, y + 4), (x + dx + 12, y + 2), (x + dx + 3, y - 34)]), inner, shade=False, edge=False)
    elif kind == 'long':
        for dx, tilt in ((-30, -26), (8, 10)): cv.part(lambda d, dx=dx, tilt=tilt: d.polygon([(x + dx - 14, y + 10), (x + dx + 14, y + 10), (x + dx + tilt + 14, y - 96), (x + dx + tilt - 6, y - 104)], fill=255), col)
    elif kind == 'round':
        for dx in (-36, 20): cv.part(E(x + dx, y - 14, 24, 24), col); cv.part(E(x + dx, y - 12, 12, 12), inner, shade=False, edge=False)
    elif kind == 'fins':
        for dx in (-30, 10): cv.part(P([(x + dx - 10, y + 10), (x + dx + 26, y), (x + dx - 4, y - 50), (x + dx - 30, y - 20)]), inner)

def tail(cv, kind, x, y, col, acc, side=-1):
    if kind in (None, 'none'): return
    pts = [(x, y), (x - 50, y - 24), (x - 80, y - 74), (x - 70, y - 120)]
    if kind == 'flame':
        cv.part(LINE(pts[:3], 24), col)
        for r, c in ((44, '#ff8a1f'), (30, '#ffd23f'), (16, '#fff6a8')): cv.part(lambda d, r=r: d.polygon([(x - 80 - r, y - 74), (x - 80 + r, y - 74), (x - 76, y - 74 - r * 3)], fill=255), c, edge=False)
    elif kind == 'bushy': cv.part(lambda d: [d.ellipse([x - 110, y - 120, x - 20, y - 20], fill=255), d.ellipse([x - 70, y - 60, x + 10, y + 10], fill=255)], col); cv.part(E(x - 90, y - 100, 24, 24), acc, shade=False)
    elif kind == 'club': cv.part(LINE([(x, y), (x - 70, y + 20), (x - 110, y + 10)], 34), col); cv.part(E(x - 120, y + 6, 36, 30), acc)
    elif kind == 'leaf': cv.part(LINE(pts[:3], 18), col); cv.part(P([(x - 80, y - 70), (x - 140, y - 110), (x - 120, y - 170), (x - 64, y - 120)]), acc)
    elif kind == 'fin': cv.part(LINE([(x, y), (x - 60, y - 10)], 30), col); cv.part(P([(x - 50, y - 10), (x - 120, y - 70), (x - 100, y), (x - 124, y + 50)]), acc)
    elif kind == 'bolt': cv.part(P([(x, y - 10), (x - 40, y - 60), (x - 20, y - 64), (x - 70, y - 130), (x - 40, y - 126), (x - 96, y - 196), (x - 30, y - 110), (x - 52, y - 108), (x - 6, y - 40), (x + 14, y + 8)]), acc)
    elif kind == 'spike': cv.part(P([(x + 10, y - 20), (x + 10, y + 20), (x - 130, y + 30)]), col); [cv.part(P([(x - 30 - k * 30, y + 4), (x - 10 - k * 30, y), (x - 26 - k * 30, y - 30)]), acc) for k in range(3)]
    elif kind == 'comet':
        cv.part(LINE(pts, 26), col)
        for k, c in enumerate(('#ffd23f', '#fff3c4', '#ffffff')): cv.part(E(x - 70 + k * 4, y - 130 + k * 4, 30 - k * 9, 30 - k * 9), c, edge=k == 0)
    elif kind == 'thick': cv.part(P([(x + 20, y - 30), (x + 10, y + 40), (x - 130, y + 50), (x - 140, y + 30)]), col)
    elif kind == 'swirl':
        sp = [(x - 60 + math.cos(t) * (60 - t * 7), y - 70 + math.sin(t) * (60 - t * 7)) for t in [i * 0.3 for i in range(22)]]
        cv.part(LINE([(x, y)] + sp, 18), col)
    elif kind == 'gear':
        cv.part(LINE(pts[:3], 16), col); gx, gy = x - 84, y - 96
        cv.part(lambda d: [d.ellipse([gx - 34, gy - 34, gx + 34, gy + 34], fill=255)] + [d.rectangle([gx + math.cos(a) * 34 - 9, gy + math.sin(a) * 34 - 9, gx + math.cos(a) * 34 + 9, gy + math.sin(a) * 34 + 9], fill=255) for a in [k * math.pi / 4 for k in range(8)]], acc)
        cv.part(E(gx, gy, 12, 12), dark(rgb(acc), 0.5), shade=False)
    elif kind == 'stinger': cv.part(LINE([(x, y), (x - 60, y - 60), (x - 40, y - 150), (x + 30, y - 170)], 26), col); cv.part(P([(x + 20, y - 190), (x + 70, y - 160), (x + 20, y - 150)]), acc)
    elif kind == 'fork': cv.part(P([(x + 10, y - 20), (x - 120, y - 40), (x - 80, y), (x - 130, y + 30), (x + 10, y + 20)]), col)
    elif kind == 'long': cv.part(P([(x + 10, y - 16), (x - 170, y - 10), (x - 160, y + 10), (x + 10, y + 16)]), acc)

def back(cv, kind, pts, col, acc, rnd):
    """pts: points along the top of the body, left to right."""
    if not kind or kind == 'none': return
    for i, (x, y) in enumerate(pts):
        if kind == 'spikes': cv.part(P([(x - 16, y + 12), (x + 16, y + 12), (x - 4, y - 42)]), acc)
        elif kind == 'crystals': h = rnd.uniform(40, 70); cv.part(P([(x - 14, y + 14), (x + 14, y + 14), (x + 8, y - h), (x - 4, y - h - 14)]), acc)
        elif kind == 'leaves': cv.part(lambda d, x=x, y=y: d.ellipse([x - 16, y - 46, x + 16, y + 6], fill=255), acc)
        elif kind == 'mane': cv.part(E(x, y - 6, 30, 26), acc)
        elif kind == 'coral': cv.part(LINE([(x, y + 10), (x - 6, y - 30), (x + 14, y - 54)], 12), acc); cv.part(LINE([(x - 6, y - 26), (x - 26, y - 44)], 10), acc)
        elif kind == 'plates': cv.part(P([(x - 22, y + 14), (x + 22, y + 14), (x + 4, y - 40)]), acc)
        elif kind == 'fins': cv.part(P([(x - 20, y + 10), (x + 24, y + 10), (x - 16, y - 34)]), acc)

def top(cv, kind, x, y, acc, main):
    if not kind: return
    if kind == 'flame':
        for r, c in ((40, '#ff8a1f'), (28, '#ffd23f'), (14, '#fff6a8')): cv.part(lambda d, r=r: d.polygon([(x - r, y), (x + r, y), (x + r * 0.3, y - r * 2.6)], fill=255), c, edge=False)
    elif kind == 'droplet': cv.part(lambda d: [d.ellipse([x - 22, y - 30, x + 22, y + 14], fill=255), d.polygon([(x - 18, y - 16), (x + 18, y - 16), (x, y - 62)], fill=255)], acc)
    elif kind == 'fern':
        for a in (-60, -20, 20, 60): r = math.radians(a - 90); cv.part(LINE([(x, y), (x + math.cos(r) * 90, y + math.sin(r) * 90)], 14), '#3a8a2a')
        for a in (-60, -20, 20, 60): r = math.radians(a - 90); cv.part(E(x + math.cos(r) * 80, y + math.sin(r) * 80, 26, 18), '#6fd04a')
    elif kind == 'acorn': cv.part(E(x, y - 6, 70, 34), '#6a4420'); cv.part(LINE([(x, y - 36), (x + 10, y - 66)], 12), '#5a3a1a')
    elif kind == 'lily':
        for k in range(6): a = math.radians(k * 60 - 90); cv.part(E(x + math.cos(a) * 26, y - 20 + math.sin(a) * 18, 22, 14), acc)
        cv.part(E(x, y - 22, 14, 12), '#ffe14a')
    elif kind == 'wisp': cv.part(lambda d: d.polygon([(x - 30, y + 10), (x + 30, y + 10), (x + 10, y - 70), (x - 6, y - 40)], fill=255), acc)
    elif kind == 'mask': cv.part(E(x, y + 60, 70, 56), '#e8e0f0'); eye(cv, x - 24, y + 54, 12); eye(cv, x + 26, y + 54, 12)
    elif kind == 'crystals':
        for dx, h in ((-40, 60), (0, 90), (36, 54)): cv.part(P([(x + dx - 16, y + 10), (x + dx + 16, y + 10), (x + dx + 8, y - h), (x + dx - 6, y - h - 16)]), acc)
    elif kind == 'snow': cv.part(E(x, y - 4, 50, 22), '#ffffff')
    elif kind == 'moon': cv.part(lambda d: d.ellipse([x - 26, y - 70, x + 26, y - 18], fill=255), '#ffd97a'); cv.part(E(x + 14, y - 50, 20, 22), main, edge=False, shade=False)
    elif kind == 'rings': d = cv.raw(); d.ellipse([x - 170, y + 60, x + 170, y + 140], outline=rgb(acc), width=14)
    elif kind == 'gem': cv.part(P([(x - 18, y + 30), (x, y + 6), (x + 18, y + 30), (x, y + 54)]), '#ff4a8a')
    elif kind == 'shards':
        for k in range(5): a = math.radians(-150 + k * 30); cv.part(P([(x + math.cos(a) * 110, y + 110 + math.sin(a) * 110), (x + math.cos(a) * 150 - 10, y + 110 + math.sin(a) * 150), (x + math.cos(a) * 160 + 8, y + 104 + math.sin(a) * 160)]), acc)
    elif kind == 'mushroom':
        cv.part(lambda d: d.chord([x - 120, y - 70, x + 120, y + 90], 180, 360, fill=255), main, pattern=pattern_fn('spots', '#f8e8d8', random.Random(7)))
    elif kind == 'ziggurat':
        for k in range(4): cv.part(RR(x - 90 + k * 22, y - k * 26, x + 90 - k * 22, y - k * 26 + 28, 4), acc if k % 2 else '#c8a060')
    elif kind == 'eye': eye(cv, x, y - 20, 26, col=rgb(acc))
    elif kind == 'antenna': cv.part(LINE([(x, y + 10), (x + 6, y - 50)], 10), '#c8d0dc'); cv.part(E(x + 6, y - 58, 14, 14), acc)
    elif kind == 'swirl':
        sp = [(x + math.cos(t) * (50 - t * 5), y - 40 + math.sin(t) * (40 - t * 4)) for t in [i * 0.35 for i in range(26)]]; cv.part(LINE(sp, 12), acc)

# ---------- body plans (all face right) ----------
def quad(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; dm = dark(rgb(m), 0.25)
    bx, by, brx, bry = 220, 300, 118 + rnd.randint(-10, 10), 70 + rnd.randint(-6, 8)
    tail(cv, L.get('tail'), bx - brx + 20, by - 10, m, a)
    for lx in (bx - 70, bx + 60): cv.part(RR(lx + 14, by + 10, lx + 46, by + 120, 14), dm)  # far legs
    if L.get('back') == 'shell': cv.part(lambda d: d.chord([bx - brx - 10, by - bry - 40, bx + brx + 10, by + bry + 10], 180, 360, fill=255), a)
    cv.part(E(bx, by, brx, bry), m, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None)
    cv.part(E(bx + 10, by + 30, brx * 0.7, bry * 0.45), b, edge=False)
    for lx in (bx - 90, bx + 40): cv.part(RR(lx, by + 20, lx + 40, by + 130, 16), m); cv.part(E(lx + 22, by + 128, 26, 14), dark(rgb(m), 0.4))
    hx, hy = bx + brx - 10, by - bry - 36
    back(cv, L.get('back') if L.get('back') != 'shell' else None, [(bx - 70 + i * 34, by - bry + 8 + abs(i - 2) * 6) for i in range(5)], m, a, rnd)
    if L.get('back') == 'mane': cv.part(E(hx - 30, hy + 40, 54, 56), a)
    ears(cv, L.get('ears', 'pointy'), hx, hy - 40, m, b)
    horns(cv, L.get('horns'), hx + 4, hy - 46, a if L.get('horns') != 'antlers' else (dark(rgb(a), 0.1) if a != '#ffd23f' else rgb('#ffd23f')))
    cv.part(E(hx, hy, 64, 56), m); cv.part(E(hx + 52, hy + 20, 34, 24), b)
    cv.raw().ellipse([hx + 76, hy + 8, hx + 88, hy + 18], fill=(30, 22, 48, 255))
    eye(cv, hx + 20, hy - 8, 15, L.get('eyes', 'normal'))
    cv.raw().arc([hx + 44, hy + 18, hx + 80, hy + 40], 20, 120, fill=(30, 22, 48, 255), width=4)

def biped(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; bx, by = 236, 300
    if L.get('wings'):
        for dx, c in ((-40, dark(rgb(a), 0.2)), (-10, rgb(a))): cv.part(P([(bx + dx, by - 60), (bx + dx - 150, by - 170), (bx + dx - 130, by - 60), (bx + dx - 160, by - 20), (bx + dx - 40, by + 10)]), c)
    tail(cv, L.get('tail', 'thick'), bx - 40, by + 60, m, a)
    back(cv, L.get('back'), [(bx - 78 + i * 6, by - 70 + i * 40) for i in range(4)], m, a, rnd)
    for lx in (bx - 56, bx + 20): cv.part(RR(lx, by + 50, lx + 50, by + 160, 20), m); cv.part(E(lx + 34, by + 158, 38, 16), dark(rgb(m), 0.35))
    cv.part(E(bx, by, 86, 104), m, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None); cv.part(E(bx + 14, by + 20, 54, 74), b, edge=False)
    cv.part(LINE([(bx + 40, by - 30), (bx + 96, by + 10), (bx + 112, by - 10)], 26), m)
    hx, hy = bx + 24, by - 146
    ears(cv, L.get('ears', 'round'), hx, hy - 40, m, b)
    horns(cv, L.get('horns'), hx, hy - 50, a)
    cv.part(E(hx, hy, 78, 68), m); cv.part(E(hx + 46, hy + 26, 40, 26), b)
    top(cv, L.get('top'), hx - 4, hy - 62, a, m)
    eye(cv, hx + 20, hy - 10, 18, L.get('eyes', 'normal'))
    cv.raw().arc([hx + 30, hy + 20, hx + 76, hy + 46], 20, 140, fill=(30, 22, 48, 255), width=5)

def serpent(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']
    path = [(70 + t * 300, 380 - math.sin(t * math.pi * 1.5) * 90 - t * 160) for t in [i / 30 for i in range(31)]]
    back(cv, L.get('back'), [path[i] for i in range(6, 28, 5)], m, a, rnd)
    for i, (x, y) in enumerate(path):
        r = 18 + 30 * i / 30
        cv.part(E(x, y, r, r), m, edge=False, shade=i % 3 == 0, pattern=None)
    pat = L.get('pattern')
    if pat in ('stripes', 'diamonds'):
        for i in range(4, 28, 5): x, y = path[i]; r = 18 + 30 * i / 30; cv.part(E(x, y - r * 0.2, r * 0.55, r * 0.55), a, edge=False, shade=False)
    for i in range(0, 30, 2): x, y = path[i]; r = 18 + 30 * i / 30; cv.part(E(x + r * 0.2, y + r * 0.5, r * 0.6, r * 0.35), b, edge=False, shade=False)
    hx, hy = path[-1][0] + 30, path[-1][1] - 24
    horns(cv, L.get('horns'), hx - 10, hy - 40, a)
    cv.part(E(hx, hy, 70, 52), m); cv.part(E(hx + 50, hy + 16, 46, 26), b)
    eye(cv, hx + 10, hy - 14, 16, L.get('eyes', 'normal'))
    d = cv.raw(); d.line([(hx + 40, hy + 30), (hx + 92, hy + 24)], fill=(30, 22, 48, 255), width=5)
    d.polygon([(hx + 60, hy + 28), (hx + 66, hy + 46), (hx + 72, hy + 27)], fill=(255, 255, 255, 255))

def bird(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; bx, by = 220, 280
    tl = L.get('tail', 'fan')
    if tl == 'flame': tail(cv, 'flame', bx - 90, by + 10, m, a)
    elif tl == 'long': cv.part(P([(bx - 60, by - 10), (bx - 230, by + 30), (bx - 220, by + 60), (bx - 60, by + 40)]), a)
    else:
        for k in range(3): cv.part(P([(bx - 70, by + k * 14 - 10), (bx - 190, by - 30 + k * 40), (bx - 170, by - 6 + k * 40), (bx - 70, by + k * 14 + 20)]), a if k % 2 else m)
    for lx in (bx - 20, bx + 30): cv.part(LINE([(lx, by + 60), (lx + 4, by + 140)], 12), '#e8a040'); cv.part(LINE([(lx - 20, by + 144), (lx + 30, by + 144)], 10), '#e8a040')
    cv.part(E(bx, by, 110, 84), m, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None); cv.part(E(bx + 30, by + 26, 70, 50), b, edge=False)
    cv.part(P([(bx + 40, by - 50), (bx - 140, by - 150), (bx - 160, by - 100), (bx - 110, by - 60), (bx - 130, by - 20), (bx + 10, by + 30)]), dark(rgb(m), 0.12))
    for k in range(4): cv.part(LINE([(bx - 20 - k * 30, by - 30 - k * 10), (bx - 60 - k * 30, by - 90 - k * 12)], 8), light(rgb(m), 0.25), edge=False, shade=False)
    hx, hy = bx + 100, by - 100
    cr = L.get('crest')
    if cr:
        cc = {'flame': '#ff8a1f', 'wave': a, 'tufts': m, 'icicles': a, 'blades': a, 'long': a}[cr]
        for k in range(3): cv.part(P([(hx - 30 + k * 20, hy - 40), (hx - 10 + k * 20, hy - 40), (hx - 60 - k * 6 + (k * 30 if cr == 'tufts' else 0), hy - 110 - k * 12)]), cc)
    cv.part(E(hx, hy, 60, 54), m)
    cv.part(P([(hx + 46, hy - 10), (hx + 110, hy + 8), (hx + 46, hy + 26)]), '#f0a830')
    eye(cv, hx + 14, hy - 10, 15, L.get('eyes', 'normal'))

def blob(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 300
    cv.part(lambda d: [d.ellipse([cx - 150, cy - 130, cx + 150, cy + 110], fill=255), d.rectangle([cx - 150, cy, cx + 150, cy + 110], fill=0), d.ellipse([cx - 150, cy + 60, cx + 150, cy + 130], fill=255)], m,
            pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None)
    for k in range(3): x = cx - 100 + k * 90; cv.part(E(x, cy + 128, 26, 16), dark(rgb(m), 0.2), edge=False)
    cv.part(E(cx + 30, cy + 50, 90, 50), b, edge=False)
    top(cv, L.get('top'), cx + 10, cy - 120, a, m)
    eye(cv, cx - 10, cy - 30, 22, L.get('eyes', 'normal')); eye(cv, cx + 70, cy - 30, 22, L.get('eyes', 'normal'))
    cv.raw().arc([cx + 10, cy + 2, cx + 60, cy + 36], 10, 170, fill=(30, 22, 48, 255), width=5)
    cv.part(E(cx - 50, cy + 10, 16, 10), '#ff9cb0', shade=False, edge=False); cv.part(E(cx + 110, cy + 10, 16, 10), '#ff9cb0', shade=False, edge=False)

def bug(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; ax, ay = 150, 300; tx, ty = 260, 280; hx, hy = 350, 230
    wings = L.get('wings')
    if wings:
        wc = light(rgb(a if wings == 'moth' else '#e8f4ff'), 0.2)
        cv.part(lambda d: [d.ellipse([tx - 160, ty - 230, tx + 30, ty - 30], fill=255), d.ellipse([tx - 190, ty - 120, tx - 10, ty + 10], fill=255)], wc,
                pattern=pattern_fn('eyes', m, rnd) if L.get('pattern') == 'eyes' else None)
    legs = L.get('legs', 'six')
    for k in range(3):
        lx = 170 + k * 70
        cv.part(LINE([(lx, 300), (lx - 20 + k * 10, 360), (lx - 40 + k * 20, 420)], 12 if legs == 'six' else 18), dark(rgb(m), 0.25))
    tail(cv, L.get('tail'), 90, 300, m, a)
    cv.part(E(ax, ay, 100 if legs != 'crab' else 70, 70), m, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') in ('stripes', 'spots', 'rivets') else None)
    cv.part(E(tx, ty, 70, 64), m); cv.part(E(tx + 6, ty + 24, 44, 30), b, edge=False)
    cl = L.get('claws')
    if cl == 'scythe': cv.part(P([(tx + 50, ty - 20), (tx + 140, ty - 120), (tx + 170, ty - 100), (tx + 80, ty + 10)]), light(rgb(m), 0.25))
    elif cl:
        for dy in (-10, 40): cv.part(LINE([(tx + 40, ty + dy), (tx + 110, ty + dy - 20)], 22), m); cv.part(lambda d, dy=dy: d.pieslice([tx + 90, ty + dy - 70, tx + 190, ty + dy + 20], 200, 520, fill=255), a)
    horns(cv, L.get('horns'), hx + 10, hy - 30, a)
    if L.get('antennae'):
        for dx in (-10, 20): cv.part(LINE([(hx + dx, hy - 40), (hx + dx + 30, hy - 110), (hx + dx + 60, hy - 120)], 8), dark(rgb(m), 0.3)); cv.part(E(hx + dx + 62, hy - 120, 12, 12), a)
    cv.part(E(hx, hy, 56, 50), m)
    top(cv, L.get('top'), hx - 20, hy - 40, a, m)
    eye(cv, hx + 18, hy - 6, 16, L.get('eyes', 'normal'))

def floater(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 210
    n = L.get('tentacles', 3)
    for k in range(n):
        x0 = cx - 80 + k * (160 / max(1, n - 1)) if n > 1 else cx
        pts = [(x0 + math.sin(t * 3 + k) * 22, cy + 70 + t * 200) for t in [i / 10 for i in range(11)]]
        cv.part(LINE(pts, 26 - n), dark(rgb(m), 0.1) if k % 2 else rgb(m))
    if n == 0: cv.part(E(cx, cy + 150, 60, 20), a, shade=False, edge=False)
    top(cv, L.get('top'), cx, cy - 110, a, m)
    cv.part(E(cx, cy, 130, 120), m, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None); cv.part(E(cx + 20, cy + 50, 80, 50), b, edge=False)
    st = L.get('eyes', 'normal')
    if st == 'cyclops': eye(cv, cx + 20, cy - 10, 20, 'cyclops', col=rgb(a))
    else: eye(cv, cx - 10, cy - 20, 22, st, col=rgb(a) if L.get('top') in ('wisp',) else (30, 22, 48, 255)); eye(cv, cx + 70, cy - 20, 22, st)
    if L.get('top') == 'rings': d = cv.raw(); d.arc([cx - 170, cy - 40, cx + 170, cy + 40], 0, 180, fill=rgb(a), width=14)

def golem(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 236, 290
    pat = pattern_fn(L['pattern'], a, rnd) if L.get('pattern') else None
    back(cv, L.get('back'), [(cx - 110, cy - 70), (cx - 120, cy - 20)], m, a, rnd)
    for lx in (cx - 80, cx + 20): cv.part(RR(lx, cy + 60, lx + 64, cy + 170, 18), dark(rgb(m), 0.12))
    cv.part(RR(cx - 120, cy - 100, cx + 110, cy + 90, 50), m, pattern=pat); cv.part(RR(cx - 60, cy - 40, cx + 70, cy + 60, 30), b, edge=False)
    cv.part(RR(cx + 70, cy - 70, cx + 150, cy + 80, 30), m); cv.part(E(cx + 112, cy + 92, 46, 34), dark(rgb(m), 0.2))
    hx, hy = cx + 10, cy - 150
    cv.part(RR(hx - 80, hy - 60, hx + 90, hy + 60, 36), m, pattern=pat)
    top(cv, L.get('top'), hx, hy - 60, a, m)
    if L.get('top') != 'mask': eye(cv, hx + 10, hy, 16, 'normal', col=rgb(a) if L.get('top') == 'antenna' else (30, 22, 48, 255)); eye(cv, hx + 60, hy, 16, 'normal', col=rgb(a) if L.get('top') == 'antenna' else (30, 22, 48, 255))

def plant(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 320
    for k, ang in enumerate((-150, -30, 200, -10)):
        r = math.radians(ang); cv.part(lambda d, r=r: d.ellipse([cx + math.cos(r) * 120 - 50, cy + 40 + math.sin(r) * 50 - 26, cx + math.cos(r) * 120 + 50, cy + 40 + math.sin(r) * 50 + 26], fill=255), '#4caa3a')
    for lx in (cx - 60, cx + 40): cv.part(LINE([(lx, cy + 80), (lx - 10, cy + 150), (lx + 20, cy + 160)], 22), '#8a5a2e')
    top(cv, L.get('top'), cx, cy - 90, a, m)
    body = m if L.get('top') != 'mushroom' else L['belly']
    cv.part(E(cx, cy, 110, 104), body, pattern=pattern_fn(L['pattern'], a, rnd) if L.get('pattern') and L.get('top') != 'mushroom' else None)
    cv.part(E(cx + 16, cy + 40, 66, 44), b if L.get('top') != 'mushroom' else light(rgb(b), 0.3), edge=False)
    if L.get('top') == 'fern':
        for k in range(5): a2 = math.radians(-160 + k * 35); cv.part(E(cx + math.cos(a2) * 120, cy - 70 + math.sin(a2) * 60, 30, 18), a)
    eye(cv, cx - 4, cy - 20, 20); eye(cv, cx + 60, cy - 20, 20)
    cv.raw().arc([cx + 10, cy + 10, cx + 54, cy + 40], 10, 170, fill=(30, 22, 48, 255), width=5)


def wingset(cv, cx, cy, n, col, tip, scale=1.0):
    """n wings (2, 4 or 6) spreading from the shoulders, feathered."""
    if not n: return
    specs = [(-1, 150), (1, 30)]
    if n >= 4: specs += [(-1, 195), (1, -15)]
    if n >= 6: specs += [(-1, 115), (1, 65)]
    for k, (side, ang) in enumerate(reversed(specs)):
        shade = mix(rgb(col), (180, 190, 230), 0.25 if k % 2 else 0.0)
        for f in range(6):
            a = math.radians(ang + (f - 2.5) * 11 * side); L = (240 - abs(f - 1.0) * 26) * scale * (0.8 if ang in (195, -15) else 1)
            x2, y2 = cx + math.cos(a) * L, cy - math.sin(a) * L; nx, ny = -math.sin(a) * 24, -math.cos(a) * 24
            cv.part(P([(cx + nx * 0.5, cy + ny * 0.5), (x2 + nx, y2 + ny), (x2 + math.cos(a) * 26, y2 - math.sin(a) * 26), (x2 - nx, y2 - ny), (cx - nx * 0.5, cy - ny * 0.5)]), shade)
            cv.part(E(x2 + math.cos(a) * 16, y2 - math.sin(a) * 16, 13, 13), tip, shade=False)

def angel(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; small = L.get('small'); k = 0.82 if small else 1.0
    cx, cy = 240, 250
    wingset(cv, cx - 10, cy - 60 * k, L.get('wings', 2), '#4a3a5a' if L.get('fallen') else '#f6f8ff', a, scale=k)
    d = cv.raw()
    if not L.get('fallen'): d.ellipse([cx - 52 * k, cy - 230 * k, cx + 62 * k, cy - 200 * k], outline=rgb('#ffd23f'), width=10)
    robe = L.get('robe', a)
    cv.part(P([(cx - 60 * k, cy - 60 * k), (cx + 60 * k, cy - 60 * k), (cx + 96 * k, cy + 190 * k), (cx - 96 * k, cy + 190 * k)]), m)
    cv.part(P([(cx - 20 * k, cy - 50 * k), (cx + 30 * k, cy - 50 * k), (cx + 40 * k, cy + 190 * k), (cx - 30 * k, cy + 190 * k)]), robe, edge=False)
    cv.part(RR(cx - 70 * k, cy - 70 * k, cx + 70 * k, cy - 40 * k, 14), a)
    w = L.get('weapon')
    if w == 'staff': cv.part(LINE([(cx + 90, cy + 160), (cx + 120, cy - 170)], 14), '#e0b040'); cv.part(E(cx + 122, cy - 190, 30, 30), '#fff6c0')
    if w == 'bolt': cv.part(P([(cx + 110, cy - 200), (cx + 140, cy - 200), (cx + 120, cy - 110), (cx + 150, cy - 110), (cx + 90, cy + 10), (cx + 106, cy - 80), (cx + 80, cy - 80)]), '#ffe14a')
    if w == 'sword': cv.part(P([(cx + 100, cy + 20), (cx + 118, cy + 20), (cx + 150, cy - 210), (cx + 136, cy - 226)]), '#eef2f8'); cv.part(RR(cx + 80, cy + 14, cx + 140, cy + 30, 6), a)
    cv.part(LINE([(cx + 50 * k, cy - 40 * k), (cx + 100 * k, cy + 30 * k)], 26), m)
    hx, hy = cx + 6, cy - 130 * k
    cv.part(E(hx, hy, 58 * k, 60 * k), '#ffe6cc'); cv.part(lambda dd: dd.chord([hx - 66 * k, hy - 74 * k, hx + 60 * k, hy + 40 * k], 180, 360, fill=255), a if not small else '#ffe9a0')
    eye(cv, hx + 22 * k, hy + 4, 13); cv.raw().arc([hx + 4, hy + 20, hx + 40, hy + 40], 20, 160, fill=(30, 22, 48, 255), width=4)

def god(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 260
    d = cv.raw(); d.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], outline=rgb('#ffd23f', 255), width=12)
    wingset(cv, cx, cy - 50, 6, '#fffbe6', a, scale=0.95)
    cv.part(P([(cx - 70, cy - 60), (cx + 70, cy - 60), (cx + 120, cy + 200), (cx - 120, cy + 200)]), m)
    cv.part(P([(cx - 26, cy - 50), (cx + 26, cy - 50), (cx + 40, cy + 200), (cx - 40, cy + 200)]), '#ffd23f', edge=False)
    cv.part(E(cx, cy + 40, 30, 30), '#7ae0ff')
    for dx in (-1, 1): cv.part(LINE([(cx + dx * 66, cy - 46), (cx + dx * 130, cy + 30), (cx + dx * 150, cy - 30)], 28), m); cv.part(E(cx + dx * 152, cy - 40, 24, 24), '#fff6c0')
    hx, hy = cx, cy - 140
    cv.part(E(hx, hy, 66, 66), '#fff4e0')
    cv.part(P([(hx - 70, hy - 40), (hx - 56, hy - 120), (hx - 26, hy - 70), (hx, hy - 140), (hx + 26, hy - 70), (hx + 56, hy - 120), (hx + 70, hy - 40)]), '#ffd23f')
    for dx in (-40, 0, 40): cv.part(E(hx + dx, hy - 80 - (20 if dx == 0 else 0), 9, 9), '#ff4a8a', shade=False)
    eye(cv, hx - 22, hy + 6, 14, col=rgb('#4a3aa8')); eye(cv, hx + 26, hy + 6, 14, col=rgb('#4a3aa8'))
    cv.part(E(hx + 2, hy - 30, 9, 12), '#7ae0ff', shade=False)

PLANS = dict(quad=quad, biped=biped, serpent=serpent, bird=bird, blob=blob, bug=bug, floater=floater, golem=golem, plant=plant, angel=angel, god=god)


def crown(cv, kind, x, y, acc, w=60):
    if kind == 'horned':  # tall horned cap of a Mesopotamian god
        cv.part(RR(x - w * 0.6, y - 70, x + w * 0.6, y + 6, 14), acc)
        for k in range(3): cv.part(LINE([(x - w * 0.6, y - 6 - k * 22), (x - w * 0.9, y - 26 - k * 22), (x - w * 0.6, y - 18 - k * 22)], 9), '#f6f0e2', shade=False)
        for k in range(3): cv.part(LINE([(x + w * 0.6, y - 6 - k * 22), (x + w * 0.9, y - 26 - k * 22), (x + w * 0.6, y - 18 - k * 22)], 9), '#f6f0e2', shade=False)
        cv.part(E(x, y - 76, w * 0.5, 12), '#ffd23f')
    elif kind == 'cap': cv.part(lambda d: d.chord([x - w * 0.7, y - 50, x + w * 0.7, y + 30], 180, 360, fill=255), acc)
    elif kind == 'star':
        r = 26; cv.part(P([(x + math.cos(a) * (r if i % 2 == 0 else r * 0.45), y - 40 + math.sin(a) * (r if i % 2 == 0 else r * 0.45)) for i, a in enumerate([k * math.pi / 4 - math.pi / 2 for k in range(8)])]), '#ffd23f')
    elif kind == 'sun':
        for k in range(10): a = k * math.pi / 5; cv.part(LINE([(x, y - 30), (x + math.cos(a) * 54, y - 30 + math.sin(a) * 54)], 10), '#ffd23f', shade=False)
        cv.part(E(x, y - 30, 26, 26), '#fff6a8')

def beard(cv, x, y, col):  # long curled beard
    cv.part(P([(x - 34, y), (x + 34, y), (x + 26, y + 70), (x - 26, y + 70)]), col)
    for k in range(4): cv.raw().line([(x - 24 + k * 16, y + 8), (x - 24 + k * 16, y + 64)], fill=dark(rgb(col), 0.4), width=4)

def genie(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 236, 270
    wingset(cv, cx - 20, cy - 70, L.get('wings', 2), light(rgb(a), 0.55), a, scale=0.9)
    cv.part(P([(cx - 70, cy - 60), (cx + 70, cy - 60), (cx + 90, cy + 180), (cx - 90, cy + 180)]), m)
    cv.part(P([(cx - 70, cy + 40), (cx + 90, cy + 20), (cx + 90, cy + 60), (cx - 80, cy + 80)]), a, edge=False)  # sash
    for k in range(6): cv.raw().line([(cx - 80 + k * 30, cy + 120), (cx - 74 + k * 30, cy + 178)], fill=dark(rgb(m), 0.3), width=4)  # fringe
    w = L.get('weapon')
    if w == 'bolt': cv.part(P([(cx + 120, cy - 150), (cx + 150, cy - 150), (cx + 130, cy - 70), (cx + 160, cy - 70), (cx + 100, cy + 40), (cx + 116, cy - 40), (cx + 90, cy - 40)]), '#ffe14a')
    elif w == 'tablet': cv.part(RR(cx + 70, cy - 40, cx + 150, cy + 60, 10), '#c8a060', pattern=pattern_fn('runes', '#6a4a20', rnd))
    else: cv.part(E(cx + 110, cy + 10, 26, 34), '#c89a40'); cv.part(RR(cx + 96, cy - 30, cx + 124, cy - 10, 4), '#8a5a2e')  # cone and bucket
    cv.part(LINE([(cx + 50, cy - 40), (cx + 100, cy + 10)], 30), m)
    hx, hy = cx + 10, cy - 120; head = L.get('head', 'human')
    if head == 'beast':
        cv.part(E(hx, hy, 66, 58), dark(rgb(m), 0.1)); cv.part(P([(hx + 30, hy - 10), (hx + 100, hy + 10), (hx + 40, hy + 40)]), '#e8d8b8'); eye(cv, hx + 20, hy - 14, 15, col=rgb(a))
    else:
        cv.part(E(hx, hy, 56, 58), '#d8a878'); beard(cv, hx + 8, hy + 20, '#3a2a40'); eye(cv, hx + 22, hy - 8, 13)
        cv.part(lambda d: d.chord([hx - 60, hy - 64, hx + 56, hy + 30], 180, 300, fill=255), '#3a2a40')
    crown(cv, L.get('crown', 'horned'), hx, hy - 50, a, 60)

def lamassu(cv, L, rnd):
    m, b, a = L['main'], L['belly'], L['accent']; bx, by = 210, 310
    wingset(cv, bx - 10, by - 50, 2, light(rgb(m), 0.25), a, scale=0.8)
    for lx in (bx - 80, bx + 50): cv.part(RR(lx + 14, by + 10, lx + 48, by + 120, 12), dark(rgb(m), 0.25))
    cv.part(LINE([(bx - 120, by - 20), (bx - 160, by + 30), (bx - 150, by + 70)], 16), m); cv.part(E(bx - 150, by + 80, 18, 18), dark(rgb(m), 0.4))
    cv.part(E(bx, by, 130, 76), m); cv.part(E(bx + 10, by + 34, 90, 34), b, edge=False)
    for lx in (bx - 100, bx + 40): cv.part(RR(lx, by + 20, lx + 44, by + 134, 14), m); cv.part(RR(lx - 4, by + 118, lx + 48, by + 140, 8), dark(rgb(m), 0.45))
    hx, hy = bx + 130, by - 80
    cv.part(E(hx, hy, 54, 56), '#d8a878'); beard(cv, hx + 6, hy + 22, '#3a2a40'); eye(cv, hx + 20, hy - 6, 13)
    cv.part(lambda d: d.chord([hx - 58, hy - 62, hx + 54, hy + 30], 180, 300, fill=255), '#3a2a40')
    crown(cv, L.get('crown', 'horned'), hx, hy - 48, a, 56)

def fishman(cv, L, rnd):  # sage wearing a fish cloak (head of the fish over its own head)
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 236, 280
    cv.part(P([(cx - 80, cy - 140), (cx + 40, cy - 160), (cx + 70, cy - 60), (cx + 40, cy + 190), (cx - 90, cy + 190), (cx - 120, cy + 60)]), m, pattern=pattern_fn('diamonds', '#bfe8f4', rnd))
    cv.part(P([(cx - 120, cy + 170), (cx - 180, cy + 220), (cx - 100, cy + 200), (cx - 60, cy + 210)]), a)  # tail fin at the hem
    cv.part(P([(cx - 40, cy - 60), (cx + 60, cy - 60), (cx + 70, cy + 180), (cx - 30, cy + 180)]), b)
    cv.part(LINE([(cx + 40, cy - 30), (cx + 110, cy + 20)], 28), b); cv.part(E(cx + 120, cy + 30, 26, 32), '#c89a40')
    hx, hy = cx + 20, cy - 100
    cv.part(E(hx, hy, 52, 54), '#d8a878'); beard(cv, hx + 8, hy + 20, '#3a2a40'); eye(cv, hx + 22, hy - 6, 13)
    cv.part(E(hx - 10, hy - 70, 70, 40), m); eye(cv, hx + 40, hy - 78, 12, col=rgb(a))  # fish head hood
    if L.get('crown') == 'horned': crown(cv, 'horned', hx - 6, hy - 96, a, 44)

def ophan(cv, L, rnd):  # wheels within wheels, covered in eyes, with wings
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 240
    wingset(cv, cx, cy, 4, '#f6f8ff', a, scale=0.85)
    for k in range(L.get('rings', 3)):
        rx, ry, ang = 170 - k * 30, 70 + k * 22, k * 55
        im = Image.new('L', (S, S), 0); dd = ImageDraw.Draw(im); dd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=255, width=22)
        im = im.rotate(ang, center=(cx, cy)); cv.part(lambda d, im=im: d.bitmap((0, 0), im, fill=255), a if k % 2 else m)
        for j in range(6):
            t = j / 6 * 2 * math.pi; x = rx * math.cos(t); y = ry * math.sin(t); ra = math.radians(-ang)
            eye(cv, cx + x * math.cos(ra) - y * math.sin(ra), cy + x * math.sin(ra) + y * math.cos(ra), 10, col=rgb('#2a4ab0'))
    cv.part(E(cx, cy, 44, 44), '#fff6c0'); eye(cv, cx, cy, 20, col=rgb('#2a4ab0'))

def seer(cv, L, rnd):  # floating many-eyed orb with wings
    m, b, a = L['main'], L['belly'], L['accent']; cx, cy = 240, 230
    wingset(cv, cx, cy, L.get('wings', 2), light(rgb(m), 0.5), a, scale=0.85)
    cv.part(E(cx, cy, 120, 116), m); cv.part(E(cx + 16, cy + 40, 70, 44), b, edge=False)
    n = L.get('eyes', 5); pts = [(cx + 20, cy - 10, 30)] + [(cx + math.cos(k / max(1, n - 1) * 2 * math.pi) * 74, cy + math.sin(k / max(1, n - 1) * 2 * math.pi) * 64, 14) for k in range(n - 1)]
    for x, y, r in pts: eye(cv, x, y, r, col=rgb(a) if r < 20 else (30, 22, 48, 255))
    cv.part(E(cx, cy + 150, 50, 14), a, shade=False, edge=False)

PLANS.update(genie=genie, lamassu=lamassu, fishman=fishman, ophan=ophan, seer=seer)

WINGED = ('angel', 'god', 'ophan', 'seer', 'genie')
def hexc(c): return '#%02x%02x%02x' % tuple(c[:3])
def stage_look(L, stage):
    """Each evolution stage is a redesigned character: baby, young, adult, armoured, winged, ascended."""
    L = dict(L); plan = L['plan']; main, acc = rgb(L['main']), rgb(L['accent'])
    if stage == 0:
        L['main'] = hexc(light(main, 0.35)); L['eyes'] = L['eyes'] if isinstance(L.get('eyes'), int) else 'big'
        for k in ('horns', 'back', 'claws', 'weapon', 'crest', 'pattern', 'antennae'): L.pop(k, None)
        if L.get('tail') not in (None, 'none'): L['tail'] = 'thick' if plan in ('quad', 'biped') else L['tail']
        if plan in ('genie', 'lamassu', 'fishman'): L['crown'] = 'cap'
        if plan in WINGED: L['wings'] = 0          # babies have no wings yet
        if plan == 'ophan': L['rings'] = 1
        L.pop('weapon', None)
    elif stage == 1:
        L['main'] = hexc(light(main, 0.15)); L['eyes'] = L['eyes'] if isinstance(L.get('eyes'), int) else 'big'
        for k in ('horns', 'back', 'weapon'): L.pop(k, None)
        if plan in WINGED: L['wings'] = 0 if plan in ('angel', 'genie') else 2
        if plan == 'ophan': L['rings'] = 2
    elif stage >= 3:
        L['main'] = hexc(dark(main, 0.12) if stage == 3 else mix(main, acc, 0.22) if stage == 4 else mix(main, rgb('#ffe6a0'), 0.25))
        if plan in ('quad', 'biped', 'serpent', 'bug', 'golem'):
            L['horns'] = {None: 'two', 'one': 'two', 'two': 'curved', 'tusks': 'curved'}.get(L.get('horns'), L.get('horns')) if stage == 3 else ('antlers' if plan == 'quad' else 'curved')
        if plan in ('quad', 'biped', 'serpent', 'golem') and not L.get('back'): L['back'] = 'spikes' if stage == 3 else 'crystals'
        if stage >= 4 and plan in ('quad', 'biped', 'serpent'): L['back'] = 'crystals'
        if not L.get('pattern'): L['pattern'] = 'stripes' if stage == 3 else 'stars' if stage == 5 else 'diamonds'
        if stage == 5: L['accent'] = '#ffd23f'
        if plan in WINGED: L['wings'] = min(6, (L.get('wings') or 2) + (stage - 2) * 2) if plan != 'genie' else 4
    return L

def draw_stage(sp, i, stage):
    L = stage_look(sp['look'], stage); rnd = random.Random(i * 97 + 13); cv = Canvas()
    plan = L['plan']
    if stage >= 4 and plan not in WINGED + ('lamassu',):   # Mega grows wings, Ascended four
        wingset(cv, 230, 250, 2 if stage == 4 else 4, light(rgb(L['accent']), 0.5), L['accent'], scale=0.9)
    PLANS[plan](cv, L, rnd)
    if stage == 5:                                           # halo above the head
        bb = cv.im.getchannel('A').getbbox()
        if bb: cx = (bb[0] + bb[2]) // 2; ImageDraw.Draw(cv.im).ellipse([cx - 70, bb[1] - 46, cx + 70, bb[1] - 14], outline=rgb('#ffd23f'), width=12)
    if stage == 3:                                           # aura of type-coloured sparks
        d = ImageDraw.Draw(cv.im)
        for k in range(10): a = rnd.random() * 6.28; r = 200 + rnd.random() * 20; d.ellipse([240 + math.cos(a) * r - 7, 250 + math.sin(a) * r * 0.8 - 7, 240 + math.cos(a) * r + 7, 250 + math.sin(a) * r * 0.8 + 7], fill=rgb(L['accent']))
    size = 104 if plan in ('angel', 'god', 'ophan', 'genie', 'lamassu') or L.get('giant') else 96
    return clean(cv.im, size=size, colors=24)

def job(args):
    sp, i = args; art = sp['name'].lower()
    for st in range(6):
        im = draw_stage(sp, i, st); im.save(os.path.join(OUT, f'{art}_s{st}.png'))
        if st == 2: im.save(os.path.join(OUT, art + '.png'))
    return art

def main():
    data = json.loads(subprocess.check_output(['node', '-e', "import('./shared/frontier.mjs').then(m => process.stdout.write(JSON.stringify([...m.FRONTIER, ...m.MYTHIC, ...m.ANUNNAKI, ...m.WATCHERS])))"], cwd=ROOT))
    only = set(sys.argv[1:])
    jobs = [(sp, i) for i, sp in enumerate(data) if not only or sp['name'].lower() in only]
    from multiprocessing import Pool
    with Pool(int(os.environ.get('JOBS', os.cpu_count() or 2))) as pool:
        for art in pool.imap_unordered(job, jobs): pass
    print('drew', len(jobs), 'Monstars x 6 evolution forms')

if __name__ == '__main__': main()
