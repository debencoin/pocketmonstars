"""Ascendants: turn the founder's portrait images into game art.
  dist/art/src/ascendants/<file>.jpg  originals (kept)
  dist/art/nft/<name>.jpg             768x768 NFT / market picture
  dist/art/hd/<name>.png              battle sprite: the portrait's head on a drawn winged body, so it moves and
                                      animates like every other Monstar
Run: python3 scripts/make_portraits.py [folder with the original <file>-image.jpg uploads]"""
import os, sys, json, subprocess, importlib.util
from PIL import Image, ImageDraw, ImageFilter, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('mf', os.path.join(ROOT, 'scripts/make_frontier.py')); mf = importlib.util.module_from_spec(spec); spec.loader.exec_module(mf)
SRC = os.path.join(ROOT, 'dist/art/src/ascendants'); NFT = os.path.join(ROOT, 'dist/art/nft'); HD = os.path.join(ROOT, 'dist/art/hd')
for d in (SRC, NFT, HD): os.makedirs(d, exist_ok=True)
incoming = sys.argv[1] if len(sys.argv) > 1 else None
data = json.loads(subprocess.check_output(['node', '-e', "import('./shared/frontier.mjs').then(m => process.stdout.write(JSON.stringify(m.ASCENDANTS.map(a => [a.name.toLowerCase(), a.look.file, a.look.accent, a.cls]))))"], cwd=ROOT))
S = mf.S
for i, (art, file, accent, cls) in enumerate(data):
    src = os.path.join(SRC, file + '.jpg')
    if incoming: Image.open(os.path.join(incoming, file + '-image.jpg')).convert('RGB').save(src, quality=88)
    im = Image.open(src).convert('RGB'); w, h = im.size; s = min(w, h); top = 0 if h > w else (h - s) // 2
    sq = im.crop(((w - s) // 2, top, (w - s) // 2 + s, top + s))
    sq.resize((768, 768), Image.LANCZOS).save(os.path.join(NFT, art + '.jpg'), quality=86, optimize=True)
    # --- body (drawn like the other Monstars) ---
    acc = mf.rgb(accent); robe = mf.dark(acc, 0.55); trim = mf.rgb('#e0b040')
    cv = mf.Canvas(); cx = 240
    mf.wingset(cv, cx, 250, 4 if cls in ('deity', 'seraph') else 2, mf.light(acc, 0.45), accent, scale=0.95)
    cv.part(mf.P([(cx - 78, 250), (cx + 78, 250), (cx + 112, 462), (cx - 112, 462)]), robe)
    cv.part(mf.P([(cx - 22, 262), (cx + 22, 262), (cx + 34, 462), (cx - 34, 462)]), acc, edge=False)
    cv.part(mf.RR(cx - 84, 238, cx + 84, 272, 16), trim)                      # gold collar
    cv.part(mf.RR(cx - 92, 340, cx + 92, 356, 6), trim, edge=False)           # belt
    for sx in (-1, 1): cv.part(mf.LINE([(cx + sx * 74, 262), (cx + sx * 116, 340), (cx + sx * 104, 392)], 30), robe); cv.part(mf.E(cx + sx * 104, 398, 18, 16), mf.rgb('#a8784e'))
    cv.part(mf.RR(cx - 96, 450, cx - 20, 472, 8), trim); cv.part(mf.RR(cx + 20, 450, cx + 96, 472, 8), trim)  # sandals
    body = cv.im
    # --- head: the portrait, cut out as a soft oval and placed on the shoulders ---
    head = sq.crop((int(s * 0.14), int(s * 0.02), int(s * 0.86), int(s * 0.80))).resize((230, 250), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', head.size, 0); ImageDraw.Draw(m).ellipse([6, 4, head.width - 6, head.height - 4], fill=255)
    head.putalpha(m.filter(ImageFilter.GaussianBlur(4)))
    body.alpha_composite(head, (cx - head.width // 2, 262 - head.height + 20))
    ImageDraw.Draw(body).ellipse([cx - 112, 32, cx + 112, 272], outline=trim, width=6)
    # --- shrink to a 104px sprite with the same bold dark outline as the others (keeps the photo colours) ---
    bb = body.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox(); body = body.crop(bb)
    k = 100 / max(body.size); spr = body.resize((max(1, round(body.width * k)), max(1, round(body.height * k))), Image.LANCZOS)
    a = spr.getchannel('A').point(lambda v: 255 if v > 110 else 0); spr.putalpha(a)
    pad = 3; out = Image.new('RGBA', (spr.width + pad * 2, spr.height + pad * 2), (0, 0, 0, 0))
    ring = Image.new('L', out.size, 0); ring.paste(a, (pad, pad)); ring = ring.filter(ImageFilter.MaxFilter(5))
    out.paste((26, 18, 32, 255), (0, 0), ring); out.alpha_composite(spr, (pad, pad))
    out.save(os.path.join(HD, art + '.png'))
print('portraits', len(data))
