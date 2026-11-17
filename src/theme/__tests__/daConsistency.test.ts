import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../../..');
const files = [
  ...['StatsScreen', 'SettingsScreen', 'CustomSoundsScreen', 'LightsScreen', 'NightSummaryScreen', 'HomeScreen'].map(n => `src/screens/${n}.tsx`),
  ...['Screen', 'UpdateBanner', 'RingingOverlay'].map(n => `src/components/${n}.tsx`),
];

describe('design consistency (single themed palette)', () => {
  it.each(files)('%s has no hex literal and does not import static Colors', file => {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    expect(src).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/import\s*\{[^}]*\bColors\b[^}]*\}\s*from\s*['"]@\/theme['"]/);
  });
});
