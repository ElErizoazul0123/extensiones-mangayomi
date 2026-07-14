// ============================================================
// YupManga - Extensión para Mangayomi (FINAL - FUNCIONA)
// Versión: 3.3
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
    "version": "3.3",
    "isAdult": false,
    "adult": false,
    "pkgPath": "",
    "notes": "Extensión para YupManga - Leer manga en español (Yuri/GL)"
}];

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.baseUrl = "https://www.yupmanga.com";
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        this.sessionCookies = '';
        this.foundEndpoints = { chapters: null, search: null };
    }

    // ============================================================
    // CABECERAS HTTP
    // ============================================================

    getHeaders(url, includeAjax = false) {
        const headers = {
            "User-Agent": this.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": this.baseUrl,
            "Connection": "keep-alive",
            "Cache-Control": "no-cache"
        };
        if (includeAjax) {
            headers["X-Requested-With"] = "XMLHttpRequest";
            headers["Accept"] = "application/json, text/plain, */*";
        }
        if (this.sessionCookies) {
            headers["Cookie"] = this.sessionCookies;
        }
        return headers;
    }

    // ============================================================
    // OBTENER COOKIES DE SESIÓN
    // ============================================================

    async ensureSession() {
        if (this.sessionCookies) return;
        try {
            const res = await new Client().get(this.baseUrl, { headers: this.getHeaders(this.baseUrl) });
            if (res.headers && res.headers['set-cookie']) {
                const cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
                if (cookies) {
                    this.sessionCookies = cookies;
                    console.log('[YupManga] 🍪 Cookies de sesión obtenidas');
                }
            }
        } catch (e) {
            console.warn('[YupManga] ⚠️ No se pudieron obtener cookies de sesión:', e);
        }
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
    // 1. PARSEO DE LISTAS DE MANGAS
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

        console.log(`[YupManga] ✅ Mangas extraídos: ${list.length} | HasNextPage: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES
    // ============================================================

    async getPopular(page) {
        if (page > 50) return { list: [], hasNextPage: false };
        const url = `${this.baseUrl}/?page=${page}`;
        console.log(`[YupManga] 🌐 Obteniendo página ${page}: ${url}`);
        await this.ensureSession();
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. ÚLTIMAS ACTUALIZACIONES
    // ============================================================

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        return this.getPopular(page);
    }

    // ============================================================
    // 4. BÚSQUEDA
    // ============================================================

    async search(query, page, filters) {
        if (!query || query.trim() === '') {
            return { list: [], hasNextPage: false };
        }

        await this.ensureSession();

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
            console.warn('[YupManga] Búsqueda no disponible aún (pendiente de endpoint real)');
        }

        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // 5. DETALLES DEL MANGA
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        console.log(`[YupManga] 📖 Obteniendo detalles de: ${absoluteUrl}`);

        await this.ensureSession();

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

            // ── Capítulos vía AJAX ──
            const seriesId = url.match(/id=([^&]+)/)?.[1] || '';
            let chapters = [];

            if (seriesId) {
                const timestamp = Date.now();
                const chapUrl = `${this.baseUrl}/ajax/load_chapters.php?series_id=${seriesId}&page=1&order=oldest_first&_=${timestamp}`;
                console.log(`[YupManga] 📚 Obteniendo capítulos desde: ${chapUrl}`);

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
                            console.log(`[YupManga] ✅ Capítulos obtenidos: ${chapters.length}`);
                        }
                    }
                } catch (e) {
                    console.warn('[YupManga] Error cargando capítulos vía AJAX:', e);
                }
            }

            // ── Fallback: JSON-LD ──
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
                            console.log(`[YupManga] 📖 Capítulos desde JSON-LD: ${chapters.length}`);
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
    // 6. PÁGINAS DE UN CAPÍTULO (CORREGIDA - EXTRAE TODAS LAS PÁGINAS)
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        console.log(`[YupManga] 🖼️ Obteniendo páginas de: ${absoluteUrl}`);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const html = res.body;
            if (!html) return [];

            const pages = [];
            const seen = new Set();

            // ── 1. Extraer window.readerPageKeys (TEXTO LITERAL) ──
            let pageKeys = null;
            let totalPages = 0;

            // Buscar el script que contiene readerPageKeys
            const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            let scriptMatch;
            while ((scriptMatch = scriptRegex.exec(html)) !== null) {
                const scriptContent = scriptMatch[1];
                
                // Buscar window.readerPageKeys = {...}
                const keysMatch = scriptContent.match(/window\.readerPageKeys\s*=\s*(\{[\s\S]*?\});/);
                if (keysMatch) {
                    try {
                        let keysStr = keysMatch[1];
                        // Limpiar: eliminar comentarios
                        keysStr = keysStr.replace(/\/\/.*$/gm, '');
                        // Eliminar trailing commas (problema común en JSON)
                        keysStr = keysStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                        // Eliminar espacios y saltos de línea excesivos
                        keysStr = keysStr.replace(/\s+/g, ' ');
                        pageKeys = JSON.parse(keysStr);
                        console.log(`[YupManga] ✅ pageKeys extraído: ${Object.keys(pageKeys).length} claves`);
                        break;
                    } catch (e) {
                        console.warn('[YupManga] ⚠️ Error parseando pageKeys (intentando con eval)...');
                        try {
                            // Fallback: usar eval (peligroso pero necesario si el JSON es inválido)
                            pageKeys = eval('(' + keysMatch[1] + ')');
                            console.log(`[YupManga] ✅ pageKeys extraído con eval: ${Object.keys(pageKeys).length} claves`);
                            break;
                        } catch (e2) {
                            console.warn('[YupManga] ⚠️ Error con eval:', e2);
                        }
                    }
                }

                // Buscar totalPages en el mismo script
                const totalMatch = scriptContent.match(/totalPages\s*:\s*(\d+)/);
                if (totalMatch) {
                    totalPages = parseInt(totalMatch[1], 10);
                }
            }

            // Si no se encontró totalPages, buscar en el resto del HTML
            if (!totalPages) {
                const totalMatch = html.match(/totalPages\s*:\s*(\d+)/);
                if (totalMatch) {
                    totalPages = parseInt(totalMatch[1], 10);
                } else if (pageKeys) {
                    const keys = Object.keys(pageKeys);
                    totalPages = keys.length ? Math.max(...keys.map(k => parseInt(k, 10))) : 0;
                }
            }
            console.log(`[YupManga] 📊 totalPages: ${totalPages}`);

            // ── 2. Construir URLs usando las claves ──
            if (pageKeys && totalPages > 0) {
                let count = 0;
                for (let i = 1; i <= totalPages; i++) {
                    const key = pageKeys[i.toString()];
                    if (key) {
                        const imgUrl = this.toAbsoluteUrl(`/image-proxy-v2.php?k=${encodeURIComponent(key)}`);
                        if (imgUrl && !seen.has(imgUrl)) {
                            seen.add(imgUrl);
                            pages.push(imgUrl);
                            count++;
                        }
                    }
                }
                console.log(`[YupManga] ✅ Páginas construidas: ${count}/${totalPages}`);
                if (pages.length > 0) {
                    return pages;
                }
            }

            // ── 3. Fallback: extraer imágenes del HTML ──
            console.warn('[YupManga] ⚠️ Fallback: extrayendo imágenes del HTML...');
            
            // Buscar en data-src (primero)
            const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["']/gi;
            let match;
            while ((match = dataSrcRegex.exec(html)) !== null) {
                let src = this.toAbsoluteUrl(match[1].trim());
                if (src && src.includes('image-proxy-v2.php') && !seen.has(src)) {
                    seen.add(src);
                    pages.push(src);
                }
            }
            
            // Si no hay, buscar en src
            if (pages.length === 0) {
                const srcRegex = /<img[^>]+src=["']([^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/gi;
                while ((match = srcRegex.exec(html)) !== null) {
                    let src = this.toAbsoluteUrl(match[1].trim());
                    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('no-cover') && !seen.has(src)) {
                        seen.add(src);
                        pages.push(src);
                    }
                }
            }

            console.log(`[YupManga] 🖼️ Páginas extraídas (fallback): ${pages.length}`);
            return pages;

        } catch (e) {
            console.error('[YupManga] Error en getPageList:', e);
            return [];
        }
    }

    // ============================================================
    // 7. FILTROS Y PREFERENCIAS
    // ============================================================

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
                    value: this.baseUrl,
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            }
        ];
    }

    async getHtmlContent(name, url) { return ''; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }
}

// ============================================================
// EXPORTACIÓN
// ============================================================

var extention = new DefaultExtension();
var extension = extention;