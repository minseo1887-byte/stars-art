import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

source = Image.open(sys.argv[1]).crop((260, 680, 1840, 2260)).convert('RGB')
grey = source.convert('L')
pixels = np.asarray(grey, dtype=np.float32)
local = np.asarray(grey.filter(ImageFilter.GaussianBlur(13)), dtype=np.float32)
rgb = np.asarray(source, dtype=np.float32)
red = np.maximum(0, rgb[:,:,0] - rgb[:,:,1] * 1.25)
marks = np.clip((local - pixels - 2) / 105 + red / 140, 0, 1)
texture = np.clip((pixels - 104) / 145, 0, 1)
base = np.array([17, 23, 35]) + texture[:,:,None] * np.array([17, 16, 12])
ink = base + marks[:,:,None] ** .84 * np.array([174, 141, 95])
chart = Image.fromarray(np.uint8(np.clip(ink, 0, 255)))
mask = Image.new('L', chart.size)
ImageDraw.Draw(mask).ellipse((10, 3, 1574, 1565), fill=255)
chart.putalpha(mask.filter(ImageFilter.GaussianBlur(1.25)))
chart.save(sys.argv[2], quality=89, method=6)
