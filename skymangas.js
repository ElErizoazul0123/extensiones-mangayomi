// SkyMangas - Extensión para Mangayomi
// Versión: 0.2
// Web: https://www.skymangas.com

const mangayomiSources = [{
    "name": "SkyMangas",
    "lang": "es",
    "baseUrl": "https://www.skymangas.com",
    "apiUrl": "https://api.skymangas.com",
    "iconUrl": "https://www.skymangas.com/assets/LogoSimbolo.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2",
    "isAdult": false,
    "adult": false,
    "pkgPath": "",
    "notes": "Extensión para SkyMangas - Leer manhua/manhwa/manga en español"
}];

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.baseUrl = "https://www.skymangas.com";
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    // ============================================================
    // CABECERAS HTTP
    // ============================================================

    getHeaders(url) {
        return {
            "User-Agent": this.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": this.baseUrl
        };
    }

    // ============================================================
    // UTILIDADES
    // ============================================================

    toAbsoluteUrl(relative, base = this.baseUrl) {
        if (!relative) return '';
        if (relative.startsWith('data:')) return '';
        if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
        try {
            const baseUrl = base.endsWith('/') ? base : base + '/';
            const cleanRelative = relative.startsWith('/') ? relative.substring(1) : relative;
            return new URL(cleanRelative, baseUrl).href;
        } catch (e) {
            try {
                const baseUrl = base.endsWith('/') ? base : base + '/';
                const cleanRelative = relative.startsWith('/') ? relative.substring(1) : relative;
                return baseUrl + cleanRelative;
            } catch (_) {
                return relative;
            }
        }
    }

    getText(element) {
        if (!element) return '';
        try {
            if (typeof element.text === 'function') {
                const result = element.text();
                return typeof result === 'string' ? result.replace(/\s+/g, ' ').trim() : '';
            }
            if (typeof element.text === 'string') {
                return element.text.replace(/\s+/g, ' ').trim();
            }
            return '';
        } catch (_) {
            return '';
        }
    }

    // ============================================================
    // 1. PARSEO DE LISTAS DE MANGAS
    //
    // Estructura confirmada en / y /explorar:
    //   <a href="/manhua/{slug}">
    //     <img src="...">
    //     Título
    //     5.0 (rating)
    //     Cap. N
    //   </a>
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        const anchors = doc.select('a[href*="/manhua/"]');

        for (const a of anchors) {
            const href = a.attr('href') || '';
            if (!href || !href.includes('/manhua/')) continue;

            const link = this.toAbsoluteUrl(href);
            if (!link || seen.has(link)) continue;

            let name = a.attr('title') || '';
            if (!name) {
                const img = a.selectFirst('img');
                if (img) name = img.attr('alt') || '';
            }
            if (!name) {
                // El texto del enlace suele repetir el título dos veces
                // seguido de la calificación y "Cap. N" — limpiamos eso
                let raw = this.getText(a);
                raw = raw.replace(/\d\.\d\s*/, ' ').trim();
                raw = raw.replace(/\s*Cap\.\s*[\d.]+.*$/i, '').trim();
                const half = raw.length > 0 ? raw.substring(0, Math.floor(raw.length / 2)).trim() : '';
                if (half && raw === half + half) {
                    name = half;
                } else {
                    name = raw;
                }
            }
            if (!name) continue;

            const img = a.selectFirst('img');
            let imageUrl = img ? (img.attr('data-src') || img.attr('src') || '') : '';
            if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);

            seen.add(link);
            list.push({ name, imageUrl, link });
        }

        // Paginación: /explorar?...&page=N
        let hasNextPage = false;
        const pageLinks = doc.select('a[href*="page="]');
        for (const a of pageLinks) {
            const text = this.getText(a).toLowerCase();
            if (text.includes('siguiente') || text === '›' || text === '»' || /^\d+$/.test(text)) {
                hasNextPage = true;
                break;
            }
        }
        if (!hasNextPage && list.length >= 20) hasNextPage = true;

        console.log(`[SkyMangas] ✅ Mangas extraídos: ${list.length} | HasNextPage: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES / ÚLTIMOS
    // ============================================================

    async getPopular(page) {
        if (page > 200) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/explorar?sort=popular&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 200) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/explorar?sort=updated&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. BÚSQUEDA Y FILTROS
    // ============================================================

    async search(query, page, filters) {
        const params = [`page=${page}`];

        if (query && query.trim() !== '') {
            params.push(`q=${encodeURIComponent(query.trim())}`);
        } else {
            params.push('sort=latest');
        }

        if (filters && filters.length > 0) {
            for (const filter of filters) {
                if (filter.type_name === "SelectFilter" && filter.state > 0) {
                    const selected = filter.values[filter.state];
                    if (selected && selected.value) {
                        params.push(`${filter.type}=${encodeURIComponent(selected.value)}`);
                    }
                }
            }
        }

        const url = `${this.baseUrl}/explorar?${params.join('&')}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "Ordenar por",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Últimas actualizaciones", value: "updated" },
                    { type_name: "SelectOption", name: "Popular", value: "popular" },
                    { type_name: "SelectOption", name: "Recién llegadas", value: "latest" },
                    { type_name: "SelectOption", name: "Mejor valorados", value: "rating" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "originationId",
                name: "Tipo",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Todos", value: "" },
                    { type_name: "SelectOption", name: "Manhua", value: "2" }
                ]
            }
        ];
    }

    // ============================================================
    // 4. DETALLES DEL MANGA
    //
    // Estructura confirmada: título en h1, portada en <img>, sinopsis
    // bajo "Sinopsis", géneros en /generos/{slug}, estado con emoji
    // 🟢/🔴, capítulos ya listados en la misma página.
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.toAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const titleEl = doc.selectFirst('h1');
            const name = titleEl ? this.getText(titleEl) : '';

            let imageUrl = '';
            const coverImg = doc.selectFirst('img[src*="/uploads/covers/"]');
            if (coverImg) {
                imageUrl = coverImg.attr('src') || coverImg.attr('data-src') || '';
                if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
            }

            let description = '';
            const metaDesc = doc.selectFirst('meta[name="description"]');
            if (metaDesc) description = metaDesc.attr('content') || '';

            let status = 5;
            const bodyText = this.getText(doc.selectFirst('body'));
            if (bodyText.includes('🟢') || /en emisi[oó]n/i.test(bodyText)) status = 0;
            else if (/finalizad/i.test(bodyText) || /completad/i.test(bodyText)) status = 1;
            else if (/pausad/i.test(bodyText) || /hiatus/i.test(bodyText)) status = 2;
            else if (/cancelad/i.test(bodyText)) status = 3;

            const genres = [];
            const genreEls = doc.select('a[href*="/generos/"]');
            for (const el of genreEls) {
                const g = this.getText(el);
                if (g && !genres.includes(g)) genres.push(g);
            }

            const chapters = [];
            const chapterLinks = doc.select('a[href*="/leer/"]');
            const seenCh = new Set();

            for (const link of chapterLinks) {
                const href = link.attr('href') || '';
                if (!href) continue;
                const chUrl = this.toAbsoluteUrl(href);
                if (!chUrl || seenCh.has(chUrl)) continue;

                const chText = this.getText(link);
                const capMatch = chText.match(/Cap\.?\s*([\d.]+)/i);
                let chName = capMatch ? `Capítulo ${capMatch[1]}` : chText;
                if (!chName) continue;

                const dateMatch = chText.match(/(\d{1,2}\s\w{3}\s\d{4})/);
                const date = dateMatch ? dateMatch[1] : '';

                seenCh.add(chUrl);
                chapters.push({ name: chName, url: chUrl, date });
            }

            chapters.reverse();
            return { name, imageUrl, description, status, genre: genres, chapters };

        } catch (e) {
            console.error('[SkyMangas] Error en getDetail:', e);
            return emptyResult;
        }
    }

    // ============================================================
    // 5. PÁGINAS DE UN CAPÍTULO
    //
    // ⚠️ El robots.txt del sitio bloquea /leer/ para crawlers, así
    // que no pude confirmar la estructura yo mismo. Este código es
    // una base razonable (busca imágenes en un contenedor de lectura
    // típico) que probablemente necesite ajuste con el HTML real.
    // ============================================================

    async getPageList(url) {
        if (!url) return [];
        const absoluteUrl = this.toAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const html = res.body;

            const pages = [];
            const seen = new Set();

            // Intento 1: imágenes dentro de un contenedor de lectura típico
            const doc = new Document(html);
            const container = doc.selectFirst('.reader, .chapter-reader, .pages-container, main');
            const imgs = container ? container.select('img') : doc.select('img');

            for (const img of imgs) {
                let src = img.attr('data-src') || img.attr('src') || '';
                src = src.trim();
                if (!src || src.startsWith('data:')) continue;
                if (/logo|icon|favicon|avatar/i.test(src)) continue;
                const absSrc = this.toAbsoluteUrl(src);
                if (absSrc && !seen.has(absSrc)) {
                    seen.add(absSrc);
                    pages.push(absSrc);
                }
            }

            // Fallback: regex directa buscando URLs de la API de imágenes
            if (pages.length === 0) {
                const imgRegex = /https?:\/\/api\.skymangas\.com\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi;
                let match;
                while ((match = imgRegex.exec(html)) !== null) {
                    if (!seen.has(match[0])) {
                        seen.add(match[0]);
                        pages.push(match[0]);
                    }
                }
            }

            if (pages.length === 0) {
                console.warn('[SkyMangas] ⚠️ No se encontraron páginas. El robots.txt bloqueó mi acceso a /leer/ para confirmar la estructura exacta — puede necesitar ajuste con el HTML real.');
            }

            return pages;

        } catch (e) {
            console.error('[SkyMangas] Error en getPageList:', e);
            return [];
        }
    }

    // ============================================================
    // 6. MÉTODOS NO IMPLEMENTADOS
    // ============================================================

    async getHtmlContent(name, url) { return ''; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }

    // ============================================================
    // 7. PREFERENCIAS
    // ============================================================

    getSourcePreferences() {
        return [
            {
                key: "skymangas_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: this.baseUrl,
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            }
        ];
    }
}

// ============================================================
// EXPORTACIÓN
// ============================================================

var extention = new DefaultExtension();
var extension = extention;