#!/usr/bin/env node
/*
 * Downloads real, properly-licensed photos of Egypt from Wikimedia Commons into
 * assets/bg/photos/ and rewrites assets/bg/backgrounds.json + assets/bg/CREDITS.md
 * (photographer + license are filled in automatically).
 *
 * Needs Node 18+ and an internet connection. No dependencies.
 *   node tools/fetch-backgrounds.mjs                 # 1 photo per theme
 *   node tools/fetch-backgrounds.mjs --per-theme=2   # more photos
 *   node tools/fetch-backgrounds.mjs --dry-run       # only show what it would download
 *
 * Only CC0 / public domain / CC BY / CC BY-SA images are accepted (never NC/ND),
 * landscape and large enough to look sharp full-screen. Featured/Quality pictures are preferred.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BardyBackgrounds/1.0 (https://bardy.pages.dev; educational project)';

export const THEMES = [
  { id: 'giza', query: 'Giza pyramids', title: 'أهرامات الجيزة' },
  { id: 'sphinx', query: 'Great Sphinx of Giza', title: 'أبو الهول' },
  { id: 'karnak', query: 'Karnak temple', title: 'معبد الكرنك' },
  { id: 'abu-simbel', query: 'Abu Simbel temple', title: 'معبد أبو سمبل' },
  { id: 'nile', query: 'Nile felucca Aswan', title: 'النيل وفلوكة أسوان' },
  { id: 'luxor', query: 'Luxor temple', title: 'معبد الأقصر' },
  { id: 'philae', query: 'Philae temple', title: 'معبد فيلة' },
];
const QUALITY_FILTERS = ['incategory:"Featured pictures on Wikimedia Commons"', 'incategory:"Quality images"', ''];
const LICENSE_OK = /^(CC0.*|Public domain.*|PD[ -].*|CC BY(-SA)? [0-9.]+.*)$/i;
const LICENSE_BAD = /(\bNC\b|\bND\b|non-?commercial|no ?derivs|fair use|GFDL)/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function api(params, fetchImpl) {
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params });
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  return res.json();
}

export function usable(page, minWidth) {
  const ii = page?.imageinfo?.[0];
  if (!ii || !ii.thumburl) return null;
  if (ii.mime !== 'image/jpeg') return null;
  if (ii.width < minWidth) return null;
  const ratio = ii.width / ii.height;
  if (ratio < 1.4 || ratio > 2.6) return null;
  const meta = ii.extmetadata || {};
  const v = k => clean(meta[k]?.value);
  const license = v('LicenseShortName');
  if (!license || !LICENSE_OK.test(license) || LICENSE_BAD.test(license)) return null;
  if (/^(true|1|yes)$/i.test(v('NonFree'))) return null;
  if (/nonfree|copyvio/i.test(v('Restrictions'))) return null;
  const artist = v('Artist').slice(0, 90) || 'مصور مجهول';
  return { file: page.title, thumb: ii.thumburl, page: ii.descriptionurl, artist, license, width: ii.width, height: ii.height };
}

async function findCandidates(theme, filter, fetchImpl) {
  const json = await api({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '30',
    gsrsearch: `${theme.query} filetype:bitmap ${filter}`.trim(),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920',
    iiextmetadatafilter: 'LicenseShortName|Artist|NonFree|Restrictions',
  }, fetchImpl);
  return [...(json?.query?.pages || [])].sort((a, b) => (a.index || 0) - (b.index || 0));
}

export async function run({ fetchImpl = fetch, root = ROOT, perTheme = 1, minWidth = 2400, dryRun = false, log = console.log, delay = 400, maxBytes = 2.5 * 1024 * 1024 } = {}) {
  const photosDir = path.join(root, 'assets/bg/photos');
  const jsonPath = path.join(root, 'assets/bg/backgrounds.json');
  let existing = [];
  try { existing = JSON.parse(await readFile(jsonPath, 'utf8')); } catch {}
  const existingPhotos = existing.filter(b => b && b.type === 'photo' && typeof b.src === 'string' && b.src.startsWith('/assets/bg/photos/'));
  const photos = [], seen = new Set();
  if (!dryRun) await mkdir(photosDir, { recursive: true });

  for (const theme of THEMES) {
    let got = 0;
    for (const filter of QUALITY_FILTERS) {
      if (got >= perTheme) break;
      let pages = [];
      try { pages = await findCandidates(theme, filter, fetchImpl); } catch (e) { log(`  ! ${theme.id}: ${e.message}`); }
      await sleep(delay);
      for (const page of pages) {
        if (got >= perTheme) break;
        const c = usable(page, minWidth);
        if (!c || seen.has(c.file)) continue;
        const name = `${theme.id}-${got + 1}.jpg`;
        log(`  ${dryRun ? '•' : '↓'} ${theme.title}: ${c.file}  [${c.license}] ${c.width}x${c.height}`);
        if (!dryRun) {
          try {
            const res = await fetchImpl(c.thumb, { headers: { 'User-Agent': UA } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > maxBytes || buf.length < 20000) throw new Error(`unexpected size ${buf.length}`);
            await writeFile(path.join(photosDir, name), buf);
          } catch (e) { log(`    skipped (${e.message})`); await sleep(delay); continue; }
          await sleep(delay);
        }
        seen.add(c.file); got++;
        photos.push({ type: 'photo', src: `/assets/bg/photos/${name}`, title: theme.title, credit: `${c.artist} / ويكيميديا كومنز`, license: c.license, creditUrl: c.page });
      }
    }
    if (!got) log(`  - ${theme.title}: no suitable photo found`);
  }

  if (!photos.length) { log('\nلم يتم تنزيل أي صورة — لم يتغير شيء.'); return { photos: 0 }; }
  if (dryRun) { log(`\nDry run: ${photos.length} photo(s) would be downloaded.`); return { photos: photos.length }; }
  const mergedPhotos = [...new Map([...existingPhotos, ...photos].map(photo => [photo.src, photo])).values()];
  await writeFile(jsonPath, JSON.stringify(mergedPhotos, null, 2) + '\n', 'utf8');
  const credits = ['# حقوق الصور / Photo credits', '', 'الصور من ويكيميديا كومنز بتراخيص حرة تتطلب نسب العمل لصاحبه. لا تحذف هذا الملف.', '',
    ...photos.map(p => `- ${p.title} — ${p.credit} — ${p.license} — ${p.creditUrl}`), ''].join('\n');
  await writeFile(path.join(root, 'assets/bg/CREDITS.md'), credits, 'utf8');
  log(`\nتم: ${photos.length} صورة في assets/bg/photos/ وتم تحديث backgrounds.json و CREDITS.md`);
  log('الخطوة التالية: راجع الصور واعتماداتها ثم ارفع المشروع.');
  return { photos: photos.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (n, d) => { const m = process.argv.find(a => a.startsWith(`--${n}=`)); return m ? Number(m.split('=')[1]) : d; };
  run({ perTheme: arg('per-theme', 1), minWidth: arg('min-width', 2400), dryRun: process.argv.includes('--dry-run') })
    .catch(e => { console.error('فشل:', e.message); process.exit(1); });
}
