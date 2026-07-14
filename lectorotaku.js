// ============================================================
// LectorOtaku - Extensión para Mangayomi
// Versión: 0.1
// Web: https://lectorotaku.com
// ============================================================

const mangayomiSources = [{
    "name": "LectorOtaku",
    "lang": "es",
    "baseUrl": "https://lectorotaku.com",
    "apiUrl": "https://api.ikigaicomics.lat/api",
    "iconUrl": "https://lectorotaku.com/favicon.svg",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.1",
    "isAdult": true,
    "adult": true,
    "pkgPath": "",
    "notes": "Extensión para LectorOtaku - Leer manga, manhwa y novelas en español"
}];

// ============================================================
// DECLARACIÓN GLOBAL DE 'extention' (con 't')
// ============================================================
var extention;

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.baseUrl = "https://lectorotaku.com";
        this.apiUrl = "https://api.ikigaicomics.lat/api";
        this.siteKey = "lectorotaku";
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        this.sessionCookies = '';
    }

    // ============================================================
    // CABECERAS HTTP
    // ============================================================

    getHeaders(url, includeApi = false) {
        const headers = {
            "User-Agent": this.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": this.baseUrl,
            "Connection": "keep-alive"
        };
        if (includeApi) {
            headers["Accept"] = "application/json, text/plain, */*";
            headers["X-Site"] = this.siteKey;
        }
        if (this.sessionCookies) {
            headers["Cookie"] = this.sessionCookies;
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
    // 1. PARSEO DE LISTAS DE MANGAS (desde HTML - fallback)
    // ============================================================

    mangaListFromHtml(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        // Buscar en "Últimos Capítulos" (cards con imagen y título)
        const items = doc.select('.grid .group, .grid a[href^="/series/"]');

        for (const item of items) {
            let link = item;
            let href = link.attr('href') || '';

            // Si el item no es un enlace, buscar el enlace dentro
            if (!href.includes('/series/')) {
                const linkEl = item.selectFirst('a[href^="/series/"]');
                if (!linkEl) continue;
                link = linkEl;
                href = link.attr('href') || '';
            }

            if (!href || !href.includes('/series/')) continue;
            const absoluteLink = this.toAbsoluteUrl(href);
            if (!absoluteLink || seen.has(absoluteLink)) continue;

            // Imagen
            const img = link.selectFirst('img');
            let imageUrl = '';
            if (img) {
                imageUrl = img.attr('src') || img.attr('data-src') || '';
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }

            // Título: buscaremos el texto del enlace o el alt de la imagen
            let name = link.attr('title') || img?.attr('alt') || '';
            if (!name) {
                // Buscar en elementos de texto dentro del enlace
                const titleEl = link.selectFirst('h3, .font-bold, .line-clamp-2');
                if (titleEl) name = this.getText(titleEl);
            }
            if (!name) name = this.getText(link);
            name = name.replace(/\s+/g, ' ').trim();
            if (!name) continue;

            // Extraer el slug del enlace para usarlo después
            const slugMatch = href.match(/\/series\/([^\/]+)/);
            const slug = slugMatch ? slugMatch[1] : '';

            seen.add(absoluteLink);
            list.push({
                name: name,
                imageUrl: imageUrl || '',
                link: absoluteLink,
                // Guardamos el slug para futuras peticiones API
                slug: slug
            });
        }

        // Paginación: buscar enlaces de paginación
        let hasNextPage = false;
        const pageLinks = doc.select('a[href*="page="]');
        for (const a of pageLinks) {
            const text = this.getText(a).toLowerCase();
            if (text.includes('siguiente') || text.includes('next') || text.includes('»')) {
                const href = a.attr('href') || '';
                if (href && href !== '#') {
                    hasNextPage = true;
                    break;
                }
            }
        }

        console.log(`[LectorOtaku] ✅ Mangas extraídos: ${list.length} | HasNextPage: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES (usando API)
    // ============================================================

    async getPopular(page) {
        if (page > 50) return { list: [], hasNextPage: false };

        // Intentar usar la API primero
        try {
            const url = `${this.apiUrl}/series/top?page=${page}&limit=20`;
            console.log(`[LectorOtaku] 🌐 Obteniendo populares desde API: ${url}`);
            
            const res = await new Client().get(url, {
                headers: this.getHeaders(url, true)
            });

            if (res.statusCode === 200) {
                const data = JSON.parse(res.body);
                const items = data.data || data || [];
                const list = items.map(item => ({
                    name: item.titulo || item.title || '',
                    imageUrl: item.portada || item.cover || '',
                    link: this.toAbsoluteUrl(`/series/${item.slug || item.id}/`),
                    slug: item.slug || item.id
                }));
                const hasNextPage = data.pagination?.next_page || (items.length === 20);
                console.log(`[LectorOtaku] ✅ API populares: ${list.length} mangas`);
                return { list, hasNextPage };
            }
        } catch (e) {
            console.warn('[LectorOtaku] ⚠️ API falló, usando fallback HTML:', e.message);
        }

        // Fallback: extraer del HTML
        const url = `${this.baseUrl}/?page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromHtml(res);
    }

    // ============================================================
    // 3. ÚLTIMAS ACTUALIZACIONES (usando API)
    // ============================================================

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 50) return { list: [], hasNextPage: false };

        try {
            const url = `${this.apiUrl}/series/latest?page=${page}&limit=20`;
            console.log(`[LectorOtaku] 🌐 Obteniendo últimas desde API: ${url}`);
            
            const res = await new Client().get(url, {
                headers: this.getHeaders(url, true)
            });

            if (res.statusCode === 200) {
                const data = JSON.parse(res.body);
                const items = data.data || data || [];
                const list = items.map(item => ({
                    name: item.titulo || item.title || '',
                    imageUrl: item.portada || item.cover || '',
                    link: this.toAbsoluteUrl(`/series/${item.slug || item.id}/`),
                    slug: item.slug || item.id
                }));
                const hasNextPage = data.pagination?.next_page || (items.length === 20);
                console.log(`[LectorOtaku] ✅ API últimas: ${list.length} mangas`);
                return { list, hasNextPage };
            }
        } catch (e) {
            console.warn('[LectorOtaku] ⚠️ API falló, usando fallback HTML:', e.message);
        }

        return this.getPopular(page);
    }

    // ============================================================
    // 4. BÚSQUEDA (usando API)
    // ============================================================

    async search(query, page, filters) {
        if (!query || query.trim() === '') {
            return { list: [], hasNextPage: false };
        }

        try {
            const url = `${this.apiUrl}/series/search?q=${encodeURIComponent(query.trim())}&page=${page}&limit=20`;
            console.log(`[LectorOtaku] 🔍 Buscando desde API: ${url}`);
            
            const res = await new Client().get(url, {
                headers: this.getHeaders(url, true)
            });

            if (res.statusCode === 200) {
                const data = JSON.parse(res.body);
                const items = data.data || data || [];
                const list = items.map(item => ({
                    name: item.titulo || item.title || '',
                    imageUrl: item.portada || item.cover || '',
                    link: this.toAbsoluteUrl(`/series/${item.slug || item.id}/`),
                    slug: item.slug || item.id
                }));
                const hasNextPage = data.pagination?.next_page || (items.length === 20);
                console.log(`[LectorOtaku] ✅ API búsqueda: ${list.length} resultados`);
                return { list, hasNextPage };
            }
        } catch (e) {
            console.warn('[LectorOtaku] ⚠️ API de búsqueda falló:', e.message);
        }

        // Fallback: búsqueda por HTML
        const url = `${this.baseUrl}/series/?search=${encodeURIComponent(query.trim())}&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromHtml(res);
    }

    // ============================================================
    // 5. DETALLES DEL MANGA (usando API)
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        console.log(`[LectorOtaku] 📖 Obteniendo detalles de: ${absoluteUrl}`);

        // Intentar obtener el slug de la URL
        const slugMatch = absoluteUrl.match(/\/series\/([^\/?]+)/);
        const slug = slugMatch ? slugMatch[1] : '';

        if (slug) {
            try {
                const apiUrl = `${this.apiUrl}/series/${slug}`;
                console.log(`[LectorOtaku] 📡 Obteniendo desde API: ${apiUrl}`);
                
                const res = await new Client().get(apiUrl, {
                    headers: this.getHeaders(apiUrl, true)
                });

                if (res.statusCode === 200) {
                    const data = JSON.parse(res.body);
                    const serie = data.data || data;

                    // Mapear datos de la API a la estructura de Mangayomi
                    const name = serie.titulo || serie.title || '';
                    const imageUrl = serie.portada || serie.cover || '';
                    const description = serie.descripcion || serie.synopsis || serie.sinopsis || '';
                    
                    // Estado
                    let status = 5;
                    const estado = (serie.estado || '').toLowerCase();
                    if (estado.includes('en emisión') || estado.includes('en curso') || estado.includes('publicando')) status = 0;
                    else if (estado.includes('finalizado') || estado.includes('completado')) status = 1;
                    else if (estado.includes('hiatus') || estado.includes('pausa') || estado.includes('espera')) status = 2;
                    else if (estado.includes('cancelado') || estado.includes('abandonado')) status = 3;

                    // Géneros
                    const genres = serie.generos || serie.genres || [];

                    // Autor
                    const author = serie.autor || serie.author || '';

                    // Capítulos
                    const chapters = [];
                    const capitulos = serie.capitulos || serie.chapters || [];
                    for (const ch of capitulos) {
                        const chName = ch.titulo || ch.title || `Capítulo ${ch.numero || ch.number}`;
                        const chUrl = this.toAbsoluteUrl(`/series/${slug}/capitulo/${ch.numero || ch.id}/`);
                        const date = ch.fecha || ch.date || ch.created_at || '';
                        chapters.push({
                            name: chName,
                            url: chUrl,
                            date: date
                        });
                    }

                    console.log(`[LectorOtaku] ✅ Detalles obtenidos de API: ${name} (${chapters.length} capítulos)`);
                    return { name, imageUrl, description, status, genre: genres, author, chapters };
                }
            } catch (e) {
                console.warn('[LectorOtaku] ⚠️ API de detalle falló:', e.message);
            }
        }

        // Fallback: parsear HTML
        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const titleEl = doc.selectFirst('h1, .title, .manga-title');
            const name = titleEl ? this.getText(titleEl) : '';

            let imageUrl = '';
            const coverImg = doc.selectFirst('img[src*="/portadas/"], .cover img, .portada img');
            if (coverImg) {
                imageUrl = coverImg.attr('src') || coverImg.attr('data-src') || '';
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }

            const descEl = doc.selectFirst('.description, .sinopsis, .summary, .desc');
            const description = descEl ? this.getText(descEl) : '';

            let status = 5;
            const statusText = this.getText(doc.selectFirst('body')).toUpperCase();
            if (statusText.includes('EN EMISIÓN') || statusText.includes('EN CURSO')) status = 0;
            else if (statusText.includes('FINALIZADO') || statusText.includes('COMPLETADO')) status = 1;
            else if (statusText.includes('HIATUS') || statusText.includes('PAUSA')) status = 2;
            else if (statusText.includes('CANCELADO') || statusText.includes('ABANDONADO')) status = 3;

            const genres = [];
            const genreEls = doc.select('.generos a, .genres a, .tags a');
            for (const el of genreEls) {
                const g = this.getText(el);
                if (g && !genres.includes(g)) genres.push(g);
            }

            const authorEl = doc.selectFirst('.autor a, .author a');
            const author = authorEl ? this.getText(authorEl) : '';

            const chapters = [];
            const chapterLinks = doc.select('.capitulos a, .chapters a, a[href*="/capitulo/"]');
            for (const link of chapterLinks) {
                const chName = this.getText(link) || 'Capítulo';
                const chUrl = this.toAbsoluteUrl(link.attr('href') || '');
                if (chUrl) {
                    const parent = link.parentNode;
                    const dateEl = parent ? parent.selectFirst('.fecha, .date, .chapter-date') : null;
                    const date = dateEl ? this.getText(dateEl) : '';
                    chapters.push({ name: chName, url: chUrl, date });
                }
            }
            chapters.reverse();

            return { name, imageUrl, description, status, genre: genres, author, chapters };

        } catch (e) {
            console.error('[LectorOtaku] Error en getDetail:', e);
            return emptyResult;
        }
    }

    // ============================================================
    // 6. PÁGINAS DE UN CAPÍTULO (usando API)
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        console.log(`[LectorOtaku] 🖼️ Obteniendo páginas de: ${absoluteUrl}`);

        // Intentar obtener el slug y número de capítulo de la URL
        const match = absoluteUrl.match(/\/series\/([^\/]+)\/capitulo\/(\d+)/);
        const slug = match ? match[1] : '';
        const chapterNum = match ? parseInt(match[2], 10) : 0;

        if (slug && chapterNum) {
            try {
                const apiUrl = `${this.apiUrl}/series/${slug}/chapter/${chapterNum}`;
                console.log(`[LectorOtaku] 📡 Obteniendo páginas desde API: ${apiUrl}`);
                
                const res = await new Client().get(apiUrl, {
                    headers: this.getHeaders(apiUrl, true)
                });

                if (res.statusCode === 200) {
                    const data = JSON.parse(res.body);
                    const chapter = data.data || data;
                    
                    // Extraer las imágenes del capítulo
                    const pages = chapter.paginas || chapter.pages || chapter.images || [];
                    const imageUrls = pages.map(p => {
                        if (typeof p === 'string') return this.toAbsoluteUrl(p);
                        return this.toAbsoluteUrl(p.url || p.src || p.image || p);
                    }).filter(u => u && !u.includes('logo') && !u.includes('icon'));

                    console.log(`[LectorOtaku] ✅ Páginas obtenidas de API: ${imageUrls.length}`);
                    if (imageUrls.length > 0) return imageUrls;
                }
            } catch (e) {
                console.warn('[LectorOtaku] ⚠️ API de páginas falló:', e.message);
            }
        }

        // Fallback: extraer imágenes del HTML
        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const html = res.body;
            if (!html) return [];

            const pages = [];
            const seen = new Set();

            // Buscar en data-src (principal)
            const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["']/gi;
            let match;
            while ((match = dataSrcRegex.exec(html)) !== null) {
                let src = this.toAbsoluteUrl(match[1].trim());
                if (src && src.includes('/storage/') && !seen.has(src)) {
                    seen.add(src);
                    pages.push(src);
                }
            }

            // Buscar en src
            if (pages.length === 0) {
                const srcRegex = /<img[^>]+src=["']([^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/gi;
                while ((match = srcRegex.exec(html)) !== null) {
                    let src = this.toAbsoluteUrl(match[1].trim());
                    if (src && !src.includes('logo') && !src.includes('icon') && !seen.has(src)) {
                        seen.add(src);
                        pages.push(src);
                    }
                }
            }

            console.log(`[LectorOtaku] 🖼️ Páginas extraídas (fallback): ${pages.length}`);
            return pages;

        } catch (e) {
            console.error('[LectorOtaku] Error en getPageList:', e);
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
                key: "lectorotaku_pref_domain",
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
// EXPORTACIÓN (CORREGIDA - CON 'extention')
// ============================================================

const extensionInstance = new DefaultExtension();

// Declaración global de extention (con 't') - ESENCIAL
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

if (typeof window !== 'undefined') {
    window.source = extensionInstance;
    window.extension = extensionInstance;
    window.extention = extensionInstance;
    window.DefaultExtension = DefaultExtension;
}