"""Build the battle sprites (dist/art/hd/*.png) from the illustrations, plus the two legendaries.
Clean look: denoised, limited palette, bold dark outline. Run: python3 scripts/make_sprites.py"""
import math, os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
OUT = 'dist/art/hd'; os.makedirs(OUT, exist_ok=True)
SIZE = 96

def clean(img, size=SIZE, colors=22):
    a0 = img.getchannel('A').point(lambda a: 255 if a > 40 else 0); img = img.crop(a0.getbbox())
    w, h = img.size; s = size / max(w, h)
    mid = img.resize((max(1, round(w * s * 2)), max(1, round(h * s * 2))), Image.LANCZOS)  # 2x then down: smoother
    rgb = mid.convert('RGB').filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.SMOOTH_MORE)
    mid = Image.merge('RGBA', (*rgb.split(), mid.getchannel('A')))
    small = mid.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    alpha = small.getchannel('A').point(lambda v: 255 if v > 120 else 0)
    q = small.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = ImageEnhance.Color(q).enhance(1.2); q = ImageEnhance.Contrast(q).enhance(1.08)
    spr = q.convert('RGBA'); spr.putalpha(alpha)
    # remove single stray pixels
    px = spr.load(); W, H = spr.size
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if px[x, y][3]:
                n = sum(1 for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)) if px[x+dx, y+dy][3])
                if n <= 1: px[x, y] = (0, 0, 0, 0)
    # bold 2px outline
    pad = 3; out = Image.new('RGBA', (W + pad * 2, H + pad * 2), (0, 0, 0, 0)); o = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3]:
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        if abs(dx) + abs(dy) <= 2 and o[x + pad + dx, y + pad + dy][3] == 0: o[x + pad + dx, y + pad + dy] = (26, 18, 32, 255)
    for y in range(H):
        for x in range(W):
            if px[x, y][3]: o[x + pad, y + pad] = px[x, y]
    return out

for n in ['cindercub','mossprout','ripplefin','voltwing','duskhorn','pebblit','frostuft','bloomtail','soloryx']:
    clean(Image.open(f'dist/art/{n}.png').convert('RGBA')).save(f'{OUT}/{n}.png')

S = 480  # legendaries are drawn large, then cleaned the same way
def seraphon():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); k = 2
    def wing(cx, cy, ang, length, width, feathers, col, shade, tip):
        for i in range(feathers):
            t = i / (feathers - 1); a = math.radians(ang + t * 55); L = length * (0.55 + 0.45 * (1 - abs(t - 0.35)))
            x2 = cx + math.cos(a) * L; y2 = cy - math.sin(a) * L; nx, ny = -math.sin(a) * width / 2, -math.cos(a) * width / 2
            d.polygon([(cx+nx*0.6,cy+ny*0.6),(x2+nx*0.5,y2+ny*0.5),(x2+math.cos(a)*20,y2-math.sin(a)*20),(x2-nx*0.5,y2-ny*0.5),(cx-nx*0.6,cy-ny*0.6)], fill=col if i % 2 == 0 else shade, outline=(150,160,200,255), width=2)
            d.ellipse([x2-8,y2-8,x2+8,y2+8], fill=tip)
    cx, cy = 224, 192
    wing(cx-12,cy+56,190,140,44,6,(214,222,246,255),(188,198,232,255),(255,236,160,255))
    wing(cx-8,cy+12,120,208,52,7,(236,240,255,255),(206,214,244,255),(255,232,140,255))
    wing(cx+12,cy+56,-35,124,40,6,(214,222,246,255),(188,198,232,255),(255,236,160,255))
    wing(cx+16,cy+8,10,192,48,7,(246,248,255,255),(214,222,248,255),(255,232,140,255))
    d.ellipse([cx-32,cy-124,cx+44,cy-100], outline=(255,214,90,255), width=8)
    d.polygon([(cx-28,cy+80),(cx-8,cy+80),(cx-12,cy+192),(cx-40,cy+192)], fill=(200,206,228,255))
    d.polygon([(cx+8,cy+80),(cx+28,cy+80),(cx+36,cy+192),(cx+8,cy+192)], fill=(226,230,246,255))
    d.rectangle([cx-44,cy+184,cx-8,cy+200], fill=(214,170,60,255)); d.rectangle([cx+4,cy+184,cx+44,cy+200], fill=(236,190,70,255))
    d.polygon([(cx-44,cy-12),(cx+44,cy-12),(cx+32,cy+88),(cx-32,cy+88)], fill=(240,242,252,255))
    d.polygon([(cx-44,cy-12),(cx,cy-12),(cx-4,cy+88),(cx-32,cy+88)], fill=(214,220,240,255))
    d.polygon([(cx-12,cy+4),(cx+12,cy+4),(cx+6,cy+60),(cx-6,cy+60)], fill=(80,140,230,255))
    d.line([(cx-44,cy-12),(cx+44,cy-12)], fill=(230,184,64,255), width=8); d.rectangle([cx-36,cy+72,cx+36,cy+88], fill=(226,180,60,255))
    d.polygon([(cx-40,cy+80),(cx+40,cy+80),(cx+60,cy+168),(cx+16,cy+140),(cx-12,cy+176),(cx-52,cy+156)], fill=(70,110,210,255))
    d.ellipse([cx-68,cy-28,cx-20,cy+16], fill=(236,240,252,255), outline=(220,176,60,255), width=6)
    d.ellipse([cx+20,cy-28,cx+68,cy+16], fill=(246,248,255,255), outline=(220,176,60,255), width=6)
    d.polygon([(cx+44,cy+4),(cx+64,cy+4),(cx+88,cy+56),(cx+72,cy+64)], fill=(230,234,250,255))
    d.line([(cx+80,cy+60),(cx+152,cy-92)], fill=(214,170,60,255), width=10)
    d.ellipse([cx+132,cy-124,cx+180,cy-76], fill=(255,244,180,255), outline=(255,200,80,255), width=6)
    d.polygon([(cx+156,cy-148),(cx+168,cy-100),(cx+144,cy-100)], fill=(255,250,210,255))
    d.ellipse([cx-32,cy-88,cx+32,cy-16], fill=(244,246,255,255), outline=(220,176,60,255), width=6)
    d.polygon([(cx-4,cy-60),(cx+32,cy-60),(cx+28,cy-40),(cx-4,cy-44)], fill=(40,60,120,255))
    d.polygon([(cx+8,cy-54),(cx+24,cy-54),(cx+22,cy-48),(cx+8,cy-48)], fill=(150,220,255,255))
    d.polygon([(cx-28,cy-76),(cx-68,cy-112),(cx-12,cy-88)], fill=(226,180,60,255))
    d.polygon([(cx-24,cy-60),(cx-60,cy-76),(cx-20,cy-48)], fill=(236,190,70,255))
    return im
def psyvolt():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im); cx, cy = 220, 220
    d.ellipse([cx-124,cy+112,cx+124,cy+160], outline=(180,120,255,220), width=10)
    pts = [(cx-60-math.cos(math.pi*(0.2+1.6*i/39))*(104-60*i/39)*0.9, cy+80-math.sin(math.pi*(0.2+1.6*i/39))*(104-60*i/39)) for i in range(40)]
    for i in range(len(pts)-1): d.line([pts[i], pts[i+1]], fill=(150,96,220,255), width=max(8, int(32-24*i/len(pts))))
    d.ellipse([pts[-1][0]-18,pts[-1][1]-18,pts[-1][0]+18,pts[-1][1]+18], fill=(110,60,190,255))
    d.polygon([(cx-24,cy+60),(cx-4,cy+60),(cx-16,cy+140),(cx-32,cy+148)], fill=(214,200,236,255))
    d.polygon([(cx+8,cy+60),(cx+28,cy+60),(cx+36,cy+132),(cx+16,cy+144)], fill=(232,222,248,255))
    d.polygon([(cx-36,cy-40),(cx+36,cy-40),(cx+28,cy+68),(cx-28,cy+68)], fill=(236,226,250,255))
    d.polygon([(cx-36,cy-40),(cx,cy-40),(cx-4,cy+68),(cx-28,cy+68)], fill=(210,196,236,255))
    d.polygon([(cx-16,cy+8),(cx+20,cy+8),(cx+12,cy+60),(cx-12,cy+60)], fill=(150,96,220,255))
    d.polygon([(cx+28,cy-32),(cx+44,cy-20),(cx+92,cy-68),(cx+80,cy-80)], fill=(226,214,246,255))
    d.ellipse([cx+72,cy-124,cx+128,cy-68], fill=(170,110,255,230), outline=(230,200,255,255), width=6); d.ellipse([cx+88,cy-108,cx+112,cy-84], fill=(250,240,255,255))
    d.polygon([(cx-28,cy-28),(cx-44,cy-16),(cx-80,cy-60),(cx-68,cy-72)], fill=(204,190,232,255))
    for seg in [[(cx+40,cy-28),(cx+56,cy-52),(cx+48,cy-56),(cx+68,cy-80)],[(cx-96,cy+60),(cx-116,cy+40),(cx-108,cy+36),(cx-132,cy+12)]]: d.line(seg, fill=(255,236,80,255), width=8)
    d.ellipse([cx-40,cy-116,cx+44,cy-36], fill=(240,232,252,255))
    d.polygon([(cx-28,cy-100),(cx-60,cy-172),(cx-4,cy-112)], fill=(226,214,246,255)); d.polygon([(cx+8,cy-112),(cx+32,cy-180),(cx+40,cy-100)], fill=(236,226,250,255))
    d.polygon([(cx-24,cy-104),(cx-48,cy-156),(cx-8,cy-112)], fill=(170,120,230,255)); d.polygon([(cx+16,cy-112),(cx+32,cy-160),(cx+34,cy-108)], fill=(170,120,230,255))
    d.polygon([(cx+8,cy-80),(cx+36,cy-84),(cx+32,cy-68),(cx+8,cy-68)], fill=(90,40,170,255)); d.ellipse([cx+18,cy-82,cx+30,cy-70], fill=(120,240,255,255))
    d.polygon([(cx+36,cy-60),(cx+52,cy-56),(cx+36,cy-48)], fill=(210,196,236,255)); d.line([(cx-16,cy-40),(cx+12,cy-24)], fill=(150,96,220,255), width=10)
    return im
clean(seraphon(), size=100, colors=18).save(f'{OUT}/seraphon.png')
clean(psyvolt(), size=96, colors=18).save(f'{OUT}/psyvolt.png')
print('ok', sorted(os.listdir(OUT)))
