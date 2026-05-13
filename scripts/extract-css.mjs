import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'stakepoint.html'), 'utf8');
const m = html.match(/<style>\r?\n([\s\S]*?)\r?\n<\/style>/);
if (!m) throw new Error('no style block');
const outDir = path.join(root, 'client', 'src', 'styles');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'app.css'), m[1].replace(/^  /gm, ''));
