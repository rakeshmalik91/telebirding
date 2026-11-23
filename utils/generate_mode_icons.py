import os
import io
import re
import zipfile
import numpy as np
from PIL import Image
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, 'webapp', 'icons')

def create_png_icons():
    # 1. Insect Icon PNG (64x64)
    logo_insect_path = os.path.join(ICONS_DIR, 'teleinsecta-logo.png')
    out_insect_png = os.path.join(ICONS_DIR, 'insect-icon.png')
    if os.path.exists(logo_insect_path):
        logo_insect = Image.open(logo_insect_path)
        emblem_insect = logo_insect.crop((7, 0, 176, 217))
        h_target = 60
        w_target = int(round(emblem_insect.width * (h_target / emblem_insect.height)))
        _, _, _, a_ins = emblem_insect.split()
        white_base = Image.new('RGB', emblem_insect.size, (255, 255, 255))
        white_insect = Image.merge('RGBA', (*white_base.split(), a_ins))
        scaled_insect = white_insect.resize((w_target, h_target), Image.Resampling.LANCZOS)
        canvas_insect = Image.new('RGBA', (64, 64), (255, 255, 255, 0))
        ox = (64 - w_target) // 2
        oy = (64 - h_target) // 2
        canvas_insect.paste(scaled_insect, (ox, oy), scaled_insect)
        canvas_insect.save(out_insect_png, optimize=True)
        print(f"Generated {out_insect_png} (bbox: {canvas_insect.getbbox()})")
    elif os.path.exists(out_insect_png):
        img = Image.open(out_insect_png)
        print(f"Existing {out_insect_png} (bbox: {img.getbbox()})")

    # 2. Bird Icon PNG (64x64)
    bird_path = os.path.join(ICONS_DIR, 'bird-icon.png')
    if os.path.exists(bird_path):
        bimg = Image.open(bird_path)
        print(f"Existing {bird_path} (bbox: {bimg.getbbox()})")

    # 3. Reptile Icon PNG (64x64)
    reptile_path = os.path.join(ICONS_DIR, 'reptile-icon.png')
    if os.path.exists(reptile_path):
        rimg = Image.open(reptile_path)
        print(f"Existing {reptile_path} (bbox: {rimg.getbbox()})")

def trace_to_svg_path(crop, target_canvas=(64, 64), pad=4):
    h_target = target_canvas[1] - pad * 2
    w_target = crop.width * (h_target / crop.height)
    
    trace_scale = 8
    trace_h = int(round(h_target * trace_scale))
    trace_w = int(round(w_target * trace_scale))
    up = crop.resize((trace_w, trace_h), Image.Resampling.LANCZOS)
    arr = np.array(up)
    mask = (arr[:, :, 3] > 115).astype(np.uint8) * 255
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    mask = (mask > 120).astype(np.uint8) * 255
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(contours, key=cv2.contourArea)
    approx = cv2.approxPolyDP(c, 1.6, True)
    
    ox = (target_canvas[0] - w_target) / 2.0
    oy = (target_canvas[1] - h_target) / 2.0
    
    d_parts = []
    for i, pt in enumerate(approx):
        x = pt[0][0] / float(trace_scale) + ox
        y = pt[0][1] / float(trace_scale) + oy
        cmd = 'M' if i == 0 else 'L'
        d_parts.append(f"{cmd}{x:.2f} {y:.2f}")
    d_parts.append('Z')
    return ' '.join(d_parts)

def create_svg_icons():
    # 1. Bird SVG
    procreate_path = os.path.join(ICONS_DIR, 'Icon.procreate')
    if os.path.exists(procreate_path):
        with zipfile.ZipFile(procreate_path, 'r') as z:
            img_bird = Image.open(io.BytesIO(z.read('QuickLook/Thumbnail.png')))
            crop_bird = img_bird.crop(img_bird.getbbox())
        bird_d = trace_to_svg_path(crop_bird, pad=5)
        bird_svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="currentColor" color="#ffffff">
  <path d="{bird_d}"/>
</svg>
'''
        bird_svg_path = os.path.join(ICONS_DIR, 'bird-icon.svg')
        with open(bird_svg_path, 'w', encoding='utf-8') as f:
            f.write(bird_svg_content)
        print(f"Generated {bird_svg_path}")
    else:
        bird_svg_path = os.path.join(ICONS_DIR, 'bird-icon.svg')
        with open(bird_svg_path, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'd="([^"]+)"', content)
        bird_d = match.group(1) if match else ""

    # 2. Insect SVG
    logo_insect_path = os.path.join(ICONS_DIR, 'teleinsecta-logo.png')
    insect_svg_path = os.path.join(ICONS_DIR, 'insect-icon.svg')
    if os.path.exists(logo_insect_path):
        logo_insect = Image.open(logo_insect_path)
        crop_insect = logo_insect.crop((7, 0, 176, 217))
        insect_d = trace_to_svg_path(crop_insect, pad=5)
        insect_svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="currentColor" color="#ffffff">
  <path d="{insect_d}"/>
</svg>
'''
        with open(insect_svg_path, 'w', encoding='utf-8') as f:
            f.write(insect_svg_content)
        print(f"Generated {insect_svg_path}")
    elif os.path.exists(insect_svg_path):
        with open(insect_svg_path, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'd="([^"]+)"', content)
        insect_d = match.group(1) if match else ""
    else:
        insect_d = ""

    # 3. Reptile SVG
    reptile_svg_path = os.path.join(ICONS_DIR, 'reptile-icon.svg')
    if os.path.exists(reptile_svg_path):
        with open(reptile_svg_path, 'r', encoding='utf-8') as f:
            content = f.read()
        match = re.search(r'd="([^"]+)"', content)
        reptile_d = match.group(1) if match else ""
    else:
        reptile_d = ""

    return bird_d, insect_d, reptile_d

def verify_svgs(bird_d, insect_d, reptile_d, size=32):
    def render_ascii(d, title):
        if not d:
            return
        canvas = np.zeros((64, 64), dtype=np.uint8)
        tokens = d.replace('Z', '').strip().split()
        pts = []
        i = 0
        while i < len(tokens):
            item = tokens[i]
            if item.startswith('M') or item.startswith('L'):
                x = float(item[1:])
                y = float(tokens[i+1])
                pts.append([int(round(x)), int(round(y))])
                i += 2
            else:
                i += 1
        pts = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(canvas, [pts], 255)
        thumb = cv2.resize(canvas, (size, size), interpolation=cv2.INTER_AREA)
        print(f"=== {title} ===")
        for y in range(size):
            line = ''
            for x in range(size):
                line += '#' if thumb[y, x] > 80 else ' '
            if '#' in line:
                print(line)

    render_ascii(bird_d, "Rendered Bird SVG")
    render_ascii(insect_d, "Rendered Insect SVG")
    render_ascii(reptile_d, "Rendered Reptile SVG")

if __name__ == '__main__':
    create_png_icons()
    bird_d, insect_d, reptile_d = create_svg_icons()
    verify_svgs(bird_d, insect_d, reptile_d)
