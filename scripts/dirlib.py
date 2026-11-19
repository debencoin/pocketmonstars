import numpy as np
from PIL import Image
from scipy import ndimage

def clusters(sheet, box, gap=6, minw=14, tol=40):
    """x-ranges of separate drawings inside a row box of a white-paper sheet."""
    a = np.asarray(sheet.crop(box).convert('RGB')).astype(int)
    ink = (np.abs(a - 255).sum(-1) > tol * 3)
    col = ink.sum(0) > 1
    out = []; s = None; last = -99
    for x, v in enumerate(col):
        if v:
            if s is None: s = x
            last = x
        elif s is not None and x - last > gap:
            if last - s + 1 >= minw: out.append((box[0] + s, box[1], box[0] + last + 1, box[3]))
            s = None
    if s is not None and last - s + 1 >= minw: out.append((box[0] + s, box[1], box[0] + last + 1, box[3]))
    return out
