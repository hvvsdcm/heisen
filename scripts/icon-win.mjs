import pngToIco from 'png-to-ico';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Convert the existing brand assets without resizing or drawing new artwork.
const assets=new URL('../assets/',import.meta.url);
const icons=[16,32,128,256].map(size=>fileURLToPath(new URL(`heisen.iconset/icon_${size}x${size}.png`,assets)));
await fs.writeFile(new URL('heisen.ico',assets),await pngToIco(icons));
