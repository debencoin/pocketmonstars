"""Evolution forms for the hand-drawn Monstars (the Genesis nine, Seraphon, Psyvolt).
Each stage is a remade character built from the base sprite:
  0 Infant   pastel baby in a cracked egg, rosy cheeks
  1 Rookie   lighter, with a scarf and a tuft
  2 Champion the original art
  3 Ultimate deeper colours, horn crest, shoulder armour, type-coloured aura
  4 Mega     armour + a pair of great wings, colours shifted toward its accent
  5 Ascended gold trim, four wings, halo and sparkles
Writes dist/art/hd/<art>_s0..5.png.  Run: python3 scripts/make_stages.py"""
import os, json, subprocess, math, random
from PIL import Image, ImageDraw, ImageEnhance, ImageChops, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); HD = os.path.join(ROOT, 'dist/art/hd')
data = json.loads(subprocess.check_output(['node', '-e', "import('./shared/monstars.mjs').then(M => process.stdout.write(JSON.stringify(M.SPECIES.filter(s => s.id < 11).map(s => [s.art, s.color, s.type]))))"], cwd=ROOT))
OUT = (26, 18, 32, 255)
def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
def mixc(c, d, t): return tuple(round(c[i] + (d[i] - c[i]) * t) for i in range(3)) + (255,)
TYPE = {'EMBER': '#ff8a1f', 'GROVE': '#5fbf3a', 'TIDE': '#3a9ae8', 'SPARK': '#ffd23f', 'SHADE': '#8a5ae0', 'STONE': '#a8906a', 'FROST': '#7ad8ff', 'ASTRAL': '#ffcf4a', 'PSYCHIC': '#c08cff'}

def tinted(im, col, t):
    a = im.getchannel('A'); over = Image.new('RGBA', im.size, col); out = Image.blend(im.convert('RGBA'), over, t); out.putalpha(a); return out

def outline(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 100 else 0); ring = a.filter(ImageFilter.MaxFilter(5))
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(OUT, (0, 0), ring); out.alpha_composite(im); return out

def wings(d, cx, cy, n, col, tip, s=1.0):
    specs = [(-1, 150), (1, 30)] + ([(-1, 195), (1, -15)] if n >= 4 else [])
    for side, ang in specs:
        for f in range(5):
            a = math.radians(ang + (f - 2) * 11 * side); L = (52 - abs(f - 1) * 6) * s * (0.8 if ang in (195, -15) else 1)
            x2, y2 = cx + math.cos(a) * L, cy - math.sin(a) * L; nx, ny = -math.sin(a) * 5, -math.cos(a) * 5
            d.polygon([(cx + nx * .5, cy + ny * .5), (x2 + nx, y2 + ny), (x2 + math.cos(a) * 7, y2 - math.sin(a) * 7), (x2 - nx, y2 - ny), (cx - nx * .5, cy - ny * .5)], fill=col if f % 2 else mixc(col, (255, 255, 255), .3), outline=OUT)
            d.ellipse([x2 - 3, y2 - 3, x2 + 3, y2 + 3], fill=tip)

for art, color, typ in data:
    base = Image.open(os.path.join(HD, art + '.png')).convert('RGBA'); W, H = 150, 150
    acc, tc, gold = rgb(color), rgb(TYPE.get(typ, '#ffd23f')), rgb('#ffd23f')
    for st in range(6):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        b = base
        if st == 0: b = tinted(base, (255, 255, 255, 255), 0.32)
        elif st == 1: b = tinted(base, (255, 255, 255, 255), 0.12)
        elif st == 3: b = ImageEnhance.Contrast(ImageEnhance.Color(base).enhance(1.3)).enhance(1.12); b = tinted(b, (20, 14, 30, 255), 0.08)
        elif st == 4: b = tinted(ImageEnhance.Color(base).enhance(1.25), tc, 0.18)
        elif st == 5: b = tinted(ImageEnhance.Color(base).enhance(1.2), gold, 0.18)
        ox, oy = (W - b.width) // 2, H - b.height - 4
        bb = base.getchannel('A').getbbox(); top = oy + bb[1]; cx = ox + (bb[0] + bb[2]) // 2; mid = oy + (bb[1] + bb[3]) // 2
        A = base.getchannel('A').load()
        band = [(x, y) for y in range(bb[1], bb[1] + max(4, (bb[3] - bb[1]) // 4)) for x in range(bb[0], bb[2]) if A[x, y] > 100]
        hx = ox + (sum(p[0] for p in band) // len(band) if band else (bb[0] + bb[2]) // 2)          # head = highest part of the body
        def topy(x): x -= ox; return next((oy + y for y in range(bb[1], bb[3]) if 0 <= x < base.width and A[x, y] > 100), None)
        if st == 3:  # aura
            glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse([cx - 52, mid - 50, cx + 52, mid + 46], fill=tc[:3] + (110,))
            im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8)))
        if st >= 4: wings(d, cx - 4, mid - 8, 2 if st == 4 else 4, mixc(tc, (255, 255, 255), .35) if st == 4 else mixc(gold, (255, 255, 255), .45), tc if st == 4 else gold)
        im.alpha_composite(b, (ox, oy))
        d = ImageDraw.Draw(im)
        if st == 0:  # cracked egg around the lower half + rosy cheeks
            ey = oy + int(b.height * 0.58); ew = int((bb[2] - bb[0]) * 0.95)
            d.chord([cx - ew // 2, ey - 14, cx + ew // 2, H - 2], 0, 180, fill=(246, 240, 226, 255), outline=OUT, width=2)
            for k in range(6): x = cx - ew // 2 + 4 + k * (ew - 8) // 5; d.polygon([(x - 5, ey + 4), (x + 5, ey + 4), (x, ey - 4 - (k % 2) * 3)], fill=(246, 240, 226, 255))
            d.line([(cx - 8, ey + 10), (cx - 2, ey + 16), (cx + 4, ey + 11)], fill=(200, 184, 152, 255), width=2)
        ht = topy(hx) or top
        if st == 1:  # a little tuft on its head
            for k, dx in enumerate((-4, 0, 4)): d.polygon([(hx + dx - 3, ht + 3), (hx + dx + 3, ht + 3), (hx + dx + 1, ht - 7 - (k == 1) * 3)], fill=mixc(acc, (255, 255, 255), .25), outline=OUT)
        if st >= 3:  # horns on the head and spikes along the back
            hc = gold if st == 5 else mixc(tc, (40, 30, 50), .25)
            for sx in (-1, 1): d.polygon([(hx + sx * 4, ht + 6), (hx + sx * 11, ht + 5), (hx + sx * 14, ht - (18 if st >= 4 else 13))], fill=hc, outline=OUT)
            x0, x1 = ox + bb[0], ox + bb[2]
            for k in range(4 if st == 3 else 5):
                x = int(x0 + (x1 - x0) * (0.2 + k * 0.13))
                if abs(x - hx) < 14: continue
                y = topy(x)
                if y is not None: h = 9 if st == 3 else 12; d.polygon([(x - 4, y + 4), (x + 4, y + 4), (x, y - h)], fill=gold if st >= 4 else hc, outline=OUT)
        if st == 5:  # halo + sparkles
            d.ellipse([hx - 20, ht - 30, hx + 20, ht - 18], outline=gold, width=4)
            r = random.Random(art)
            for k in range(10): x, y = r.randint(10, W - 10), r.randint(10, H - 30); d.line([(x - 3, y), (x + 3, y)], fill=(255, 255, 255, 255)); d.line([(x, y - 3), (x, y + 3)], fill=gold)
        im = outline(im); bbx = im.getchannel('A').getbbox(); im = im.crop(bbx)
        im.save(os.path.join(HD, f'{art}_s{st}.png'))
print('stages', len(data))
