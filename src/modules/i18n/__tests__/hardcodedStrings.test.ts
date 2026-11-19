/**
 * Guard: every user-visible string goes through i18n (JS) or Android string resources (native).
 * English is the default language, French the translation; both must hold the same keys.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { en } from '../locales/en';
import { fr } from '../locales/fr';
import { DEFAULT_LOCALE, FALLBACK_LOCALE, resolveLocale } from '../types';

const ROOT = path.resolve(__dirname, '../../../..');

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, accept, out);
    else if (accept(full)) out.push(full);
  }
  return out;
}

const rel = (file: string) => path.relative(ROOT, file).replace(/\\/g, '/');
const LETTER = /[A-Za-zÀ-ɏ]/;
/**
 * Punctuation glued between translated pieces (" : ", " ?") differs between English and French.
 * A bare ":" with no space around it is a clock separator (07:30) and stays.
 */
const isGlue = (raw: string) =>
  /^[\s:?!]+$/.test(raw) && (/[?!]/.test(raw) || /\s:|:\s/.test(raw));

/** Props whose string value is shown to the user (or read by a screen reader). */
const USER_PROPS = new Set([
  'title', 'subtitle', 'label', 'placeholder', 'accessibilityLabel', 'accessibilityHint',
  'text', 'message', 'header', 'headerTitle', 'tabBarLabel', 'description', 'hint',
]);

/** Literal values that are not language-dependent: language codes and colour temperatures. */
const ALLOWED = [/^[A-Z]{2}$/, /^\d+K$/];

function isVisibleText(text: string): boolean {
  if (isGlue(text)) return true;
  const s = text.trim();
  return LETTER.test(s) && !ALLOWED.some(re => re.test(s));
}

function stringValue(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map(s => s.literal.text)].join(' ');
  }
  return null;
}

/** Returns "file:line text" for each hard-coded user-visible string in a TSX source. */
function findHardcodedJsx(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    found.push(`${fileName}:${line} ${JSON.stringify(text.trim())}`);
  };

  const visit = (node: ts.Node, inAlert: boolean) => {
    if (ts.isJsxText(node) && isVisibleText(node.text)) report(node, node.text);
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const s = stringValue(node.expression);
      if (s !== null && isVisibleText(s)) report(node, s);
    }
    if (ts.isJsxAttribute(node) && USER_PROPS.has(node.name.getText(sf)) && node.initializer) {
      const init = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      const s = init ? stringValue(init) : null;
      if (s !== null && isVisibleText(s)) report(node, s);
    }
    if (inAlert) {
      const s = stringValue(node);
      const isStyle = ts.isPropertyAssignment(node.parent) && node.parent.name.getText(sf) === 'style';
      if (s !== null && !isStyle && isVisibleText(s)) report(node, s);
    }
    // Inside Alert.alert(...) literals are visible, except within nested calls (t('key'), console.*).
    const alert = ts.isCallExpression(node) ? /^Alert\.(alert|prompt)$/.test(node.expression.getText(sf)) : inAlert;
    ts.forEachChild(node, child => visit(child, alert));
  };
  visit(sf, false);
  return found;
}

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** name -> translatable, for every string resource of an Android values file. */
function androidStrings(file: string): Map<string, boolean> {
  const names = new Map<string, boolean>();
  const xml = fs.readFileSync(file, 'utf8');
  for (const m of xml.matchAll(/<(?:string|plurals|string-array)\s+name="([^"]+)"([^>]*)>/g)) {
    names.set(m[1], !/translatable="false"/.test(m[2]));
  }
  return names;
}

function linesMatching(files: string[], re: RegExp): string[] {
  return files.flatMap(f =>
    fs.readFileSync(f, 'utf8').split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => re.test(line))
      .map(({ n, line }) => `${rel(f)}:${n} ${line.trim()}`),
  );
}

const RES_DIRS = ['modules/smart-alarm/android/src/main/res', 'android/app/src/main/res'];
/** Same word in both languages: kept in the default file only. */
const SAME_IN_ALL_LANGUAGES = new Set(['app_name']);
const ANDROID_SRC = ['modules/smart-alarm/android/src/main', 'android/app/src/main'];

describe('hard-coded user-facing strings', () => {
  it('detects literals in JSX text, user props and alerts (self-check)', () => {
    const sample = [
      'const A = () => <View>',
      '  <Text>Hello</Text>',
      '  <Text>{t("a")} : {t("b")}</Text>',
      '  <Button title="Save" accessibilityLabel={"stats"} />',
      '  <Text>{t("ok")}</Text>',
      '  <Chip label="FR" /><Text>{"3000K"}</Text>',
      '</View>;',
      'Alert.alert(t("x"), t("y") + " ?", [{ text: "Nope", style: "cancel" }]);',
    ].join('\n');
    const found = findHardcodedJsx('s.tsx', sample).map(f => f.replace(/^s\.tsx:\d+ /, ''));
    expect(found).toEqual(['"Hello"', '":"', '"Save"', '"stats"', '"?"', '"Nope"']);
  });

  it('screens and components route every visible string through i18n', () => {
    const files = [...walk(path.join(ROOT, 'src'), f => f.endsWith('.tsx')), path.join(ROOT, 'App.tsx')];
    const found = files.flatMap(f => findHardcodedJsx(rel(f), fs.readFileSync(f, 'utf8')));
    expect(found).toEqual([]);
  });

  it('English and French JS locales have the same keys', () => {
    const enKeys = keyPaths(en);
    const frKeys = keyPaths(fr);
    expect(enKeys.filter(k => !frKeys.includes(k))).toEqual([]);
    expect(frKeys.filter(k => !enKeys.includes(k))).toEqual([]);
  });

  it('defaults to English and follows a French device', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(FALLBACK_LOCALE).toBe('en');
    expect(resolveLocale(null, ['fr'])).toBe('fr');
    expect(resolveLocale(null, ['de', 'fr'])).toBe('fr');
    expect(resolveLocale(null, ['de'])).toBe('en');
    expect(resolveLocale(null, [])).toBe('en');
    expect(resolveLocale('fr', ['en'])).toBe('fr');
    expect(resolveLocale('de', ['fr'])).toBe('fr');
  });

  it.each(RES_DIRS)('Android strings in %s: English default, complete French translation', dir => {
    const base = path.join(ROOT, dir);
    const defaults = androidStrings(path.join(base, 'values/strings.xml'));
    const frFile = path.join(base, 'values-fr/strings.xml');
    const french = fs.existsSync(frFile) ? androidStrings(frFile) : new Map<string, boolean>();
    const missing = [...defaults]
      .filter(([name, translatable]) => translatable && !SAME_IN_ALL_LANGUAGES.has(name) && !french.has(name))
      .map(([name]) => name);
    expect(missing).toEqual([]);
    expect([...french.keys()].filter(name => !defaults.has(name))).toEqual([]);
    expect(fs.readFileSync(path.join(base, 'values/strings.xml'), 'utf8')).not.toMatch(/[àâçéèêîôûœ]/);
  });

  it('Android layouts and manifests use @string resources for visible attributes', () => {
    const xmlFiles = ANDROID_SRC
      .flatMap(d => walk(path.join(ROOT, d), f => f.endsWith('.xml')))
      .filter(f => !/[\\/]values[^\\/]*[\\/]/.test(f));
    const found = linesMatching(xmlFiles, /android:(text|label|title|hint|contentDescription|description)="(?!@)[^"]*[A-Za-z]/);
    expect(found).toEqual([]);
  });

  it('Kotlin code passes no literal text to notifications, views or toasts', () => {
    const ktFiles = ANDROID_SRC.flatMap(d => walk(path.join(ROOT, d, 'java'), f => /\.(kt|java)$/.test(f)));
    const UI_CALL = /(setContentTitle|setContentText|setSubText|setTicker|setText|setTitle|setMessage|setPositiveButton|setNegativeButton|addAction|setDescription|Toast\.makeText\([^,]+,|NotificationChannel\([^,]+,|\.text\s*=|contentDescription\s*=)\s*\(?[^"\n]*?"[^"]*[A-Za-z]/;
    expect(linesMatching(ktFiles, UI_CALL)).toEqual([]);
  });
});
