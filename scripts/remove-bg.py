import sys
from PIL import Image

def remove_black_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    new_data = []
    for r, g, b, a in data:
        alpha = max(r, g, b)
        if alpha == 0:
            new_data.append((0, 0, 0, 0))
        else:
            # Un-premultiply RGB against the new alpha
            out_r = int((r * 255) / alpha)
            out_g = int((g * 255) / alpha)
            out_b = int((b * 255) / alpha)
            new_data.append((out_r, out_g, out_b, alpha))

    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved {output_path} with transparent background.")

input_img = sys.argv[1]
output_img = sys.argv[2]
remove_black_background(input_img, output_img)
