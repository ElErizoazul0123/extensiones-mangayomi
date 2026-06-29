// Mangayomi Source: LeerMangaEsp
// Language: es
// Version: 1.0.0

const BASE_URL = 'https://leermangaesp.net';

// Selectores con soporte para múltiples plantillas comunes (Madara / MangaStream)
const SELECTORS = {
  popularItems: '.page-item-detail > a, .bsx > a, .c-tabs-item__content > a, .item > a',
  popularImage: 'img',
  seriesTitle: 'h1, .post-title h1, .entry-title',
  seriesCover: '.summary_image img, .thumb img, .s-image img',
  seriesDescription: '.summary__content, .entry-content, .desc',
  seriesGenres: '.genres-content a, .mgen a, .genres a',
  chapterLinks: '.wp-manga-chapter > a, #chapterlist a, .chbox a, .eph-num a',
  chapterDate: '.chapter-release-date, .epxdate',
  readerContainer: '.reading-content, #readerarea, .reader-area',
  pageImages: 'img[src*="uploads"], img[src*=".jpg"], img[src*=".png"], img[src*=".webp"]',
};

function toAbsoluteUrl(relative, base = BASE_URL) {
  try { return new URL(relative, base).href; } catch (_) { return relative; }
}

async function getPopularManga(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}/page/${page}/`;
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = doc.querySelectorAll(SELECTORS.popularItems);
  const mangas = [];

  for (const link of items) {
    const img = link.querySelector(SELECTORS.popularImage);
    const name = img?.getAttribute('alt') || img?.getAttribute('title') || 'Sin título';
    const href = link.getAttribute('href');
    
    if (href && !href.includes('javascript:')) {
      mangas.push({
        name: name.trim(),
        link: toAbsoluteUrl(href),
        imageUrl: img?.src ? toAbsoluteUrl(img.src) : (img?.getAttribute('data-src') || ''),
      });
    }
  }
  return mangas;
}

async function getMangaDetails(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = doc.querySelector(SELECTORS.seriesTitle)?.textContent?.trim() || '';
  
  let cover = '';
  const coverImg = doc.querySelector(SELECTORS.seriesCover);
  if (coverImg) {
      cover = coverImg.src ? toAbsoluteUrl(coverImg.src) : toAbsoluteUrl(coverImg.getAttribute('data-src') || '');
  }

  const descEl = doc.querySelector(SELECTORS.seriesDescription);
  const description = descEl?.textContent?.trim() || '';
  const genreNodes = doc.querySelectorAll(SELECTORS.seriesGenres);
  const genres = Array.from(genreNodes).map(el => el.textContent.trim());

  return { title, cover, description, genres };
}

async function getChapterList(url) {
  const response = await fetch(url);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = doc.querySelectorAll(SELECTORS.chapterLinks);
  const chapters = [];

  for (const link of links) {
    const name = link.textContent?.trim() || 'Capítulo';
    const href = link.getAttribute('href');
    const dateEl = link.querySelector(SELECTORS.chapterDate);
    const date = dateEl?.textContent?.trim() || '';
    if (href && !href.includes('javascript:')) {
      chapters.push({ name, link: toAbsoluteUrl(href), date });
    }
  }
  return chapters;
}

async function getPageList(chapterUrl) {
  const response = await fetch(chapterUrl);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const container = doc.querySelector(SELECTORS.readerContainer) || doc;
  const imgElements = container.querySelectorAll(SELECTORS.pageImages);
  const imageUrls = [];

  for (const img of imgElements) {
    let src = img.getAttribute('src') || img.getAttribute('data-src');
    if (src && !src.includes('data:image')) {
        imageUrls.push(toAbsoluteUrl(src, chapterUrl));
    }
  }
  return imageUrls;
}