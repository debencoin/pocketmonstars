"""Square marketplace / NFT pictures (dist/art/nft/<name>.png, 512x512): each battle sprite centred on a
navy card with a soft glow, so every Monstar fits the same frame in the market, in Phantom and on explorers."""
import os, json, subprocess
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'dist/art/hd'), os.path.join(ROOT, 'dist/art/nft'); os.makedirs(OUT, exist_ok=True)
species = json.loads(subprocess.check_output(['node', '-e', "import('./shared/monstars.mjs').then(M => process.stdout.write(JSON.stringify(M.SPECIES.filter(s => !s.portrait).map(s => [s.art, s.color]))))"], cwd=ROOT))
N = 512
for art, color in species:
    c = tuple(int(color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    bg = Image.new('RGBA', (N, N), (16, 23, 42, 255)); d = ImageDraw.Draw(bg)
    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse([96, 80, 416, 400], fill=c + (120,))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))
    d.ellipse([136, 380, 376, 420], fill=(8, 12, 24, 180))
    spr = Image.open(os.path.join(SRC, art + '.png')).convert('RGBA'); s = min(340 / spr.width, 340 / spr.height)
    spr = spr.resize((round(spr.width * s), round(spr.height * s)), Image.LANCZOS)
    bg.alpha_composite(spr, ((N - spr.width) // 2, 400 - spr.height))
    d.rounded_rectangle([6, 6, N - 7, N - 7], 40, outline=(42, 53, 80, 255), width=6)
    bg.convert('RGB').save(os.path.join(OUT, art + '.png'), optimize=True)
print('cards', len(species))
