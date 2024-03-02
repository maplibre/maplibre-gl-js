import cv2
import json

font_name = 'Roboto-Regular'

image = cv2.imread(f'{font_name}.png', cv2.IMREAD_UNCHANGED)


def get_values(image, x, y, width, height):
    sub_image = image[y:y+height, x:x+width]
    values = []
    for i in range(len(sub_image)):
        for j in range(len(sub_image[0])):
            # CV2 has BGR color ordering
            values.append(int(sub_image[i, j, 2])) # red
            values.append(int(sub_image[i, j, 1])) # green
            values.append(int(sub_image[i, j, 0])) # blue
            values.append(255) # alpha
    return values



with open(f'{font_name}.json') as f:
    metadata = json.load(f)

output = {}
for c in metadata['chars']:
    x = c['x']
    y = c['y']
    width = c['width']
    height = c['height']
    values = get_values(image, x, y, width, height)

    # HACK:  The 0x0 pixel image would result in an error in GL JS. Use a 1x1 pixel empty image. For whitespaces etc...
    if c['width'] == 0:
        c['width'] = 1
        c['height'] = 1
        values = [0, 0, 0, 255]

    output[c['char']] = {
        'metadata': c,
        'values': values
    }


with open('../src/render/font_js_asset.json', 'w') as f:
    json.dump(output, f, indent=2)
