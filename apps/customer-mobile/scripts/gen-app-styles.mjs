import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chunk = fs.readFileSync(path.join(__dirname, '../src/_styles_chunk.txt'), 'utf8');
const m = /const styles = StyleSheet.create\(\{([\s\S]*)\}\);/.exec(chunk);
if (!m) throw new Error('Could not parse styles chunk');
const body = m[1];
const out = `import { Platform, StyleSheet } from 'react-native';
import type { CustomerThemeColors } from './customerTheme';

export const AUTH_SCREEN_BACKGROUND = '#0f172a';

export function createCustomerAppStyles(colors: CustomerThemeColors) {
  return StyleSheet.create({${body}});
}
`;
fs.writeFileSync(path.join(__dirname, '../src/appStyles.ts'), out);
