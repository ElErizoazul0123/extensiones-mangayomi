// ============================================================
// YupManga - Extensión para Mangayomi (CORREGIDA CON UA DINÁMICO)
// Versión: 0.5
// Web: https://www.yupmanga.com
// ============================================================

const mangayomiSources = [{
    "name": "YupManga",
    "lang": "es",
    "baseUrl": "https://www.yupmanga.com",
    "apiUrl": "",
    "iconUrl": "https://www.yupmanga.com/img/favicon.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.5",
    "isAdult": false,
    "adult": false,
    "pkgPath": "",
    "notes": "Extensión para YupManga - Leer manga en español (Yuri/GL)"
}];

var extention;

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.foundEndpoints = { chapters: null, search: null };
    }

    // ============================================================
    // AJUSTES DINÁMICOS (Base URL y User-Agent vía SharedPreferences)
    // ============================================================

    get baseUrl() {
        try {
            const pref = new SharedPreferences();
            const domain = pref.get("yupmanga_pref_domain");
            if (domain && domain.trim() !== "") {
                return domain.trim();
            }
        } catch (e) {
            console.warn("[YupManga] No se pudo leer el dominio de las preferencias:", e);
        }
        return "https://www.yupmanga.com";
    }

    get userAgent() {
        try {
            const pref = new SharedPreferences();
            const ua = pref.get("yupmanga_pref_ua");
            if (ua && ua.trim() !== "") {
                return ua.trim();
            }
        } catch (e) {
            console.warn("[YupManga] No se pudo leer el User-Agent de las preferencias:", e);
        }
        // UA por defecto (Windows 11 Chrome)
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    }

    getHeaders(url, includeAjax = false) {
        const headers = {
            "User-Agent": this.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": this.baseUrl,
            "Connection": "keep-alive"
        };
        if (includeAjax) {
            headers["X-Requested-With"] = "XMLHttpRequest";
            headers["Accept"] = "application/json, text/plain, */*";
        }
        return headers;
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

    ensureAbsoluteUrl(url, base = this.baseUrl) {
        if (!url) return '';
        const absolute = this.toAbsoluteUrl(url, base);
        if (!absolute || absolute === '' || absolute.startsWith('data:')) {
            throw new Error(`URL inválida: ${url}`);
        }
        return absolute;
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
    // PARSEO DE LISTAS DE MANGAS
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        const items = doc.select('.comic-card');

        for (const item of items) {
            const link = item.selectFirst('a');
            if (!link) continue;

            const linkHref = link.attr('href') || '';
            if (!linkHref || !linkHref.includes('series.php')) continue;

            const absoluteLink = this.toAbsoluteUrl(linkHref);
            if (!absoluteLink || seen.has(absoluteLink)) continue;

            const img = link.selectFirst('img');
            let name = img ? (img.attr('alt') || '') : '';
            if (!name) {
                const titleEl = link.selectFirst('h3');
                name = titleEl ? this.getText(titleEl) : '';
            }
            name = name.replace(/\s+/g, ' ').trim();
            if (!name) continue;

            let imageUrl = '';
            if (img) {
                imageUrl = img.attr('src') || img.attr('data-src') || '';
                if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
            }

            seen.add(absoluteLink);
            list.push({ name, imageUrl: imageUrl || '', link: absoluteLink });
        }

        let hasNextPage = false;
        const pageLinks = doc.select('a[href*="page="]');
        for (const a of pageLinks) {
            const text = this.getText(a).toLowerCase();
            if (text.includes('siguiente')) {
                const href = a.attr('href') || '';
                if (href && href !== '#') {
                    hasNextPage = true;
                    break;
                }
            }
        }

        return { list, hasNextPage };
    }

    async getPopular(page) {
        if (page > 50) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/?page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        return this.getPopular(page);
    }

    async search(query, page, filters) {
        if (!query || query.trim() === '') {
            return { list: [], hasNextPage: false };
        }

        const searchUrl = `${this.baseUrl}/ajax/search.php?q=${encodeURIComponent(query.trim())}&page=${page}`;
        try {
            const res = await new Client().get(searchUrl, {
                headers: this.getHeaders(searchUrl, true)
            });
            if (res.statusCode === 200) {
                const data = JSON.parse(res.body);
                const items = data.results || data.data || data.items || [];
                const list = items.map(item => ({
                    name: item.title || item.name || '',
                    imageUrl: this.toAbsoluteUrl(item.cover || item.image || ''),
                    link: this.toAbsoluteUrl(item.url || item.link || '')
                }));
                const hasNextPage = data.pagination?.next_page || false;
                return { list, hasNextPage };
            }
        } catch (e) {
            console.warn('[YupManga] Búsqueda no disponible temporalmente');
        }

        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // DETALLES DEL MANGA
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.ensureAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const titleEl = doc.selectFirst('h1');
            const name = titleEl ? this.getText(titleEl) : '';

            let imageUrl = '';
            const coverImg = doc.selectFirst('.comic-cover, .cover img, img[src*="image-proxy-v2.php"]');
            if (coverImg) {
                imageUrl = coverImg.attr('data-src') || coverImg.attr('src') || '';
                if (imageUrl && !imageUrl.startsWith('data:')) {
                    imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }

            const descEl = doc.selectFirst('#synopsisText, .synopsis-text, .description, .sinopsis, .summary');
            const description = descEl ? this.getText(descEl) : '';

            let status = 5;
            const statusText = this.getText(doc.selectFirst('body')).toUpperCase();
            if (statusText.includes('ACTIVO')) status = 0;
            else if (statusText.includes('FINALIZADO')) status = 1;
            else if (statusText.includes('EN PAUSA')) status = 2;
            else if (statusText.includes('ABANDONADO')) status = 3;

            const genres = [];
            const genreEls = doc.select('a[href*="/genero/"], a[href*="/tag/"]');
            for (const el of genreEls) {
                const g = this.getText(el);
                if (g && !genres.includes(g)) genres.push(g);
            }

            let author = '';
            const authorEl = doc.selectFirst('a[href^="/autor/"]');
            if (authorEl) author = this.getText(authorEl);

            const seriesId = url.match(/id=([^&]+)/)?.[1] || '';
            let chapters = [];

            if (seriesId) {
                const timestamp = Date.now();
                const chapUrl = `${this.baseUrl}/ajax/load_chapters.php?series_id=${seriesId}&page=1&order=oldest_first&_=${timestamp}`;

                try {
                    const chapRes = await new Client().get(chapUrl, {
                        headers: this.getHeaders(chapUrl, true)
                    });

                    if (chapRes.statusCode === 200) {
                        const data = JSON.parse(chapRes.body);
                        if (data.success && data.html) {
                            const chapDoc = new Document(data.html);
                            const chapterLinks = chapDoc.select('.comic-card .chapter-link');

                            for (const link of chapterLinks) {
                                const chName = link.selectFirst('h3')?.text?.trim() || 'Capítulo';
                                const chapterId = link.attr('data-chapter');
                                if (chapterId) {
                                    const chUrl = this.toAbsoluteUrl(`/reader_v2.php?chapter=${chapterId}&page=1`);
                                    chapters.push({
                                        name: chName,
                                        url: chUrl,
                                        date: ''
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[YupManga] Error cargando capítulos vía AJAX:', e);
                }
            }

            if (chapters.length === 0) {
                const jsonLdMatch = res.body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
                if (jsonLdMatch) {
                    try {
                        const jsonData = JSON.parse(jsonLdMatch[1]);
                        if (jsonData && jsonData.episode && Array.isArray(jsonData.episode)) {
                            for (const ep of jsonData.episode) {
                                if (ep.url && ep.name) {
                                    chapters.push({
                                        name: ep.name,
                                        url: this.toAbsoluteUrl(ep.url),
                                        date: ep.datePublished || ''
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[YupManga] Error parseando JSON-LD:', e);
                    }
                }
            }

            chapters.reverse();

            return { name, imageUrl, description, status, genre: genres, author, chapters };

        } catch (e) {
            console.error('[YupManga] Error en getDetail:', e);
            return emptyResult;
        }
    }

    // ============================================================
    // PÁGINAS DE UN CAPÍTULO
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        const absoluteUrl = this.ensureAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const html = res.body;
            if (!html) return [];

            const pages = [];
            const seen = new Set();
            let pageKeys = null;
            let totalPages = 0;

            const chapterTokenMatch = html.match(/chapterToken\s*=\s*["']([^"']+)["']/);
            const chapterToken = chapterTokenMatch ? chapterTokenMatch[1] : '';
            const chapterIdMatch = absoluteUrl.match(/chapter=(\d+)/);
            const chapterId = chapterIdMatch ? chapterIdMatch[1] : '';

            const keysMatch = html.match(/window\.readerPageKeys\s*=\s*(\{[\s\S]*?\});/);
            
            if (keysMatch) {
                try {
                    let keysStr = keysMatch[1];
                    keysStr = keysStr
                        .replace(/\/\/.*$/gm, '')                  
                        .replace(/\/\*[\s\S]*?\*\//g, '')          
                        .replace(/['"]/g, '"')                      
                        .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') 
                        .replace(/,\s*}/g, '}')                    
                        .replace(/,\s*]/g, ']')                    
                        .replace(/\s+/g, ' ')                      
                        .trim();

                    pageKeys = JSON.parse(keysStr);
                } catch (e) {
                    console.warn('[YupManga] Error limpiando pageKeys:', e);
                }
            }

            const totalMatch = html.match(/totalPages\s*:\s*(\d+)/);
            if (totalMatch) {
                totalPages = parseInt(totalMatch[1], 10);
            } else if (pageKeys) {
                const keys = Object.keys(pageKeys);
                totalPages = keys.length ? Math.max(...keys.map(k => parseInt(k, 10))) : 0;
            }

            if (pageKeys && totalPages > 0) {
                for (let i = 1; i <= totalPages; i++) {
                    const key = pageKeys[i.toString()];
                    if (key) {
                        let imgUrl = this.toAbsoluteUrl(`/image-proxy-v2.php?k=${encodeURIComponent(key)}`);
                        
                        if (!key && chapterId && chapterToken) {
                            imgUrl = this.toAbsoluteUrl(`/image-proxy-v2.php?chapter=${chapterId}&page=${i}&token=${encodeURIComponent(chapterToken)}&context=reader`);
                        }

                        if (imgUrl && !seen.has(imgUrl)) {
                            seen.add(imgUrl);
                            pages.push({
                                url: imgUrl,
                                headers: { "Referer": absoluteUrl, "User-Agent": this.userAgent }
                            });
                        }
                    }
                }
                if (pages.length > 0) return pages;
            }

            // Fallback
            const imgRegex = /<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi;
            let match;
            while ((match = imgRegex.exec(html)) !== null) {
                let src = match[1].trim();
                if (src && !src.startsWith('data:') && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
                    const absSrc = this.toAbsoluteUrl(src);
                    if (!seen.has(absSrc)) {
                        seen.add(absSrc);
                        pages.push({
                            url: absSrc,
                            headers: { "Referer": absoluteUrl, "User-Agent": this.userAgent }
                        });
                    }
                }
            }

            return pages;

        } catch (e) {
            console.error('[YupManga] Error en getPageList:', e);
            return [];
        }
    }

    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "Ordenar por",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Relevancia", value: "relevance" },
                    { type_name: "SelectOption", name: "Último", value: "latest" },
                    { type_name: "SelectOption", name: "A-Z", value: "alphabet" }
                ]
            }
        ];
    }

    getSourcePreferences() {
        return [
            {
                key: "yupmanga_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: "https://www.yupmanga.com",
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            },
            {
                key: "yupmanga_pref_ua",
                editTextPreference: {
                    title: "User-Agent personalizado",
                    summary: "Obligatorio para Cloudflare. En ordenadores suele funcionar el de por defecto. En móviles, pega el de tu dispositivo si falla.",
                    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    dialogTitle: "User-Agent",
                    dialogMessage: "Introduce el User-Agent exacto de tu dispositivo"
                }
            }
        ];
    }

    async getHtmlContent(name, url) { return ''; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }
}

const extensionInstance = new DefaultExtension();
var extention = extensionInstance;
var extension = extensionInstance;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = extensionInstance;
}

if (typeof globalThis !== 'undefined') {
    globalThis.source = extensionInstance;
    globalThis.extension = extensionInstance;
    globalThis.extention = extensionInstance;
    globalThis.DefaultExtension = DefaultExtension;
}


// ============================================================
// Niadd - Extensión para Mangayomi (CORREGIDA CON UA DINÁMICO)
// Versión: 0.2
// Web: https://es.niadd.com
// ============================================================

const niaddSources = [{
    "name": "Niadd",
    "lang": "es",
    "baseUrl": "https://es.niadd.com",
    "apiUrl": "",
    "iconUrl": "https://es.niadd.com/files/images/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2",
    "pkgPath": "",
    "notes": "Extensión para Niadd - Leer manga en español"
}];

class NiaddExtension extends MProvider {

    constructor() {
        super();
    }

    get baseUrl() {
        try {
            const pref = new SharedPreferences();
            const domain = pref.get("niadd_pref_domain");
            if (domain && domain.trim() !== "") {
                return domain.trim();
            }
        } catch (e) {}
        return "https://es.niadd.com";
    }

    get userAgent() {
        try {
            const pref = new SharedPreferences();
            const ua = pref.get("niadd_pref_ua");
            if (ua && ua.trim() !== "") {
                return ua.trim();
            }
        } catch (e) {}
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    }

    getHeaders(url) {
        return {
            "User-Agent": this.userAgent,
            "Referer": this.baseUrl,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        };
    }

    toAbsoluteUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return this.baseUrl + (url.startsWith('/') ? url : '/' + url);
    }

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        const anchors = doc.select("a[href*='/manga/'][title], a[href*='/original/'][title]");

        for (const a of anchors) {
            const name = (a.attr("title") || a.text || "").trim();
            if (!name) continue;

            const link = this.toAbsoluteUrl(a.attr("href") || "");
            if (!link || seen.has(link)) continue;

            let imageUrl = "";
            const imgInside = a.selectFirst("img");
            if (imgInside) {
                imageUrl = this.toAbsoluteUrl(
                    imgInside.attr("data-src") || imgInside.attr("src") || ""
                );
            }
            seen.add(link);
            list.push({ name, imageUrl, link });
        }

        let hasNextPage = false;
        for (const a of doc.select("a")) {
            const txt = (a.text || "").trim();
            if (txt.includes("Siguiente") || txt.includes(">>")) {
                const href = a.attr("href") || "";
                if (href && href !== '#') { hasNextPage = true; break; }
            }
        }

        return { list, hasNextPage };
    }

    async getPopular(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/category/index_${page}.html`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        const url = page === 1
            ? `${this.baseUrl}/list/New-Update/`
            : `${this.baseUrl}/list/New-Update/index_${page}.html`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    async search(query, page, filters) {
        if (!query || !query.trim()) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/search/?name=${encodeURIComponent(query.trim())}&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        if (res.statusCode === 200) return this.mangaListFromPage(res);
        return { list: [], hasNextPage: false };
    }

    async getDetail(url) {
        const emptyResult = { name: "", imageUrl: "", description: "", genre: [], status: 5, chapters: [] };
        if (!url) return emptyResult;

        const absUrl = this.toAbsoluteUrl(url);

        try {
            const infoRes = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const doc = new Document(infoRes.body);

            const titleEl = doc.selectFirst("h1");
            const name = titleEl ? titleEl.text.trim() : "";

            let imageUrl = "";
            const imgEl = doc.selectFirst(".bookside-img img, .manga-cover img, div.cover img");
            if (imgEl) {
                imageUrl = this.toAbsoluteUrl(imgEl.attr("data-src") || imgEl.attr("src") || "");
            }

            let description = (doc.selectFirst("meta[name='description']") || {}).attr?.("content") || "";
            if (!description) {
                const descEl = doc.selectFirst(".manga-info-top p, .book-intro, p.description");
                description = descEl ? descEl.text.trim() : "";
            }

            const genreEls = doc.select("a[href*='/category/']");
            const genre = [...new Set(
                genreEls.map(a => a.text.trim()).filter(t => t && t.length < 40)
            )];

            let status = 5;
            const pageText = doc.selectFirst("body") ? doc.selectFirst("body").text : "";
            const statusMatch = pageText.match(/\(\s*(En marcha|En curso|Completado|Finalizado)\s*\)/i);
            if (statusMatch) {
                const s = statusMatch[1].toLowerCase();
                if (s.includes("marcha") || s.includes("curso")) status = 0;
                else if (s.includes("complet") || s.includes("finaliz")) status = 1;
            }

            const chapPageUrl = absUrl.replace(/\.html$/, "/chapters.html");
            const chapRes = await new Client().get(chapPageUrl, { headers: this.getHeaders(chapPageUrl) });
            const chapDoc = new Document(chapRes.body);

            const chapters = [];
            const chapLinks = chapDoc.select("a[href*='/chapter/']");
            for (const link of chapLinks) {
                const chName = link.text.trim();
                const chUrl = this.toAbsoluteUrl(link.attr("href") || "");
                if (chUrl) {
                    chapters.push({ name: chName, url: chUrl, date: "" });
                }
            }

            return { name, imageUrl, description, genre, status, chapters };

        } catch (e) {
            console.error('[Niadd] Error en getDetail:', e);
            return emptyResult;
        }
    }

    async getPageList(url) {
        if (!url) return [];
        const absUrl = this.toAbsoluteUrl(url);
        try {
            const res = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const doc = new Document(res.body);
            const pages = [];

            const imgEls = doc.select(".manga-image-container img, .reader-images img, #manga-page");
            for (const img of imgEls) {
                const src = img.attr("data-src") || img.attr("src") || "";
                if (src && !src.includes("logo") && !src.includes("banner")) {
                    pages.push(this.toAbsoluteUrl(src));
                }
            }
            return pages;
        } catch (e) {
            console.error('[Niadd] Error en getPageList:', e);
            return [];
        }
    }

    getFilterList() { return []; }
    
    getSourcePreferences() {
        return [
            {
                key: "niadd_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: "https://es.niadd.com",
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            },
            {
                key: "niadd_pref_ua",
                editTextPreference: {
                    title: "User-Agent personalizado",
                    summary: "Para evadir Cloudflare. Deja en blanco para usar el de Windows por defecto.",
                    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                    dialogTitle: "User-Agent",
                    dialogMessage: "Introduce el User-Agent exacto de tu dispositivo"
                }
            }
        ];
    }
    
    async getHtmlContent(name, url) { return ''; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }
}