// MangaOni - Extensión para Mangayomi
// Versión: 0.3
// Web: https://manga-oni.com

const mangayomiSources = [{
    "name": "MangaOni",
    "lang": "es",
    "baseUrl": "https://manga-oni.com",
    "apiUrl": "",
    "iconUrl": "https://manga-oni.com/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.3",
    "isAdult": true,
    "adult": true,
    "pkgPath": "",
    "notes": "Extensión para MangaOni"
}];

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.baseUrl = "https://manga-oni.com";
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
        this.sessionCookies = '';
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
                    console.log('[MangaOni] 🍪 Cookies de sesión obtenidas');
                }
            }
        } catch (e) {
            console.warn('[MangaOni] ⚠️ No se pudieron obtener cookies de sesión:', e);
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
    // DECODIFICADOR BASE64
    // ============================================================

    decodeBase64(str) {
        try {
            if (typeof atob === 'function') {
                try {
                    return atob(str);
                } catch (e) {
                    // Continuar con implementación manual
                }
            }
        } catch (e) {
            // atob no disponible
        }
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let output = '';
        str = str.replace(/[^A-Za-z0-9+/=]/g, '');
        
        for (let i = 0; i < str.length; i += 4) {
            const a = chars.indexOf(str[i]);
            const b = chars.indexOf(str[i + 1] || '');
            const c = chars.indexOf(str[i + 2] || '');
            const d = chars.indexOf(str[i + 3] || '');
            
            if (a === -1 || b === -1) continue;
            
            const bytes = (a << 18) | (b << 12) | (c << 6) | d;
            output += String.fromCharCode((bytes >> 16) & 0xFF);
            if (c !== -1 && str[i + 2] !== '=') {
                output += String.fromCharCode((bytes >> 8) & 0xFF);
            }
            if (d !== -1 && str[i + 3] !== '=') {
                output += String.fromCharCode(bytes & 0xFF);
            }
        }
        
        return output;
    }

    // ============================================================
    // 1. PARSEO DE LISTAS DE MANGAS
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        // Buscar los elementos de manga
        const items = doc.select('._135yj._2FQAt._2mJki');
        
        for (const item of items) {
            // Buscar el enlace - puede estar en diferentes lugares
            let link = item.selectFirst('a[href*="/manga/"], a[href*="/manhua/"], a[href*="/novela/"], a[href*="/manhwa/"]');
            if (!link) {
                // Intentar con el enlace dentro de _2NNxg
                const nameLink = item.selectFirst('._2NNxg a');
                if (nameLink) link = nameLink;
            }
            if (!link) continue;
            
            const href = link.attr('href') || '';
            if (!href) continue;
            
            const linkUrl = this.toAbsoluteUrl(href);
            if (!linkUrl || seen.has(linkUrl)) continue;
            
            // Nombre
            let name = '';
            const nameEl = item.selectFirst('._1A2Dc._2uHIS');
            if (nameEl) {
                name = nameEl.text || '';
            }
            if (!name) {
                name = link.attr('title') || '';
            }
            if (!name) {
                name = link.text || '';
            }
            name = name.trim();
            if (!name) continue;
            
            // Imagen - usar data-src para lazy loading
            let imageUrl = '';
            const imgContainer = item.selectFirst('._1-8M9');
            if (imgContainer) {
                const img = imgContainer.selectFirst('img');
                if (img) {
                    // Priorizar data-src sobre src para imágenes lazy
                    imageUrl = img.attr('data-src') || img.attr('src') || '';
                    if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }
            if (!imageUrl) {
                const img = link.selectFirst('img');
                if (img) {
                    imageUrl = img.attr('data-src') || img.attr('src') || '';
                    if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }
            
            seen.add(linkUrl);
            list.push({ name, imageUrl, link: linkUrl });
        }

        // Si no se encontraron items con la clase específica, buscar enlaces directos
        if (list.length === 0) {
            const anchors = doc.select("a[href*='/manga/'], a[href*='/manhua/'], a[href*='/novela/'], a[href*='/manhwa/']");
            for (const a of anchors) {
                const href = a.attr('href') || '';
                if (!href || href === '#') continue;
                
                const linkUrl = this.toAbsoluteUrl(href);
                if (!linkUrl || seen.has(linkUrl)) continue;
                
                let name = a.attr('title') || '';
                if (!name) {
                    const titleEl = a.selectFirst('h2, .title, .manga-title');
                    if (titleEl) name = titleEl.text || '';
                }
                if (!name) name = a.text || '';
                name = name.trim();
                if (!name) continue;
                
                let imageUrl = '';
                const img = a.selectFirst('img');
                if (img) {
                    imageUrl = img.attr('data-src') || img.attr('src') || '';
                    if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
                }
                
                seen.add(linkUrl);
                list.push({ name, imageUrl, link: linkUrl });
            }
        }

        // Paginación
        let hasNextPage = false;
        const nextLink = doc.selectFirst('a[rel="next"], .pagination a:contains("›")');
        if (nextLink) {
            const href = nextLink.attr('href') || '';
            if (href && href !== '#' && href !== 'javascript:void(0)') {
                hasNextPage = true;
            }
        }

        console.log(`[MangaOni] ✅ Mangas extraídos: ${list.length} | HasNextPage: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES
    // ============================================================

    async getPopular(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        await this.ensureSession();
        
        const url = `${this.baseUrl}/directorio?filtro=visitas&orden=desc&p=${page}`;
        console.log(`[MangaOni] 🌐 Obteniendo populares: ${url}`);
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. ÚLTIMAS ACTUALIZACIONES
    // ============================================================

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        await this.ensureSession();
        
        const url = `${this.baseUrl}/directorio?filtro=id&orden=desc&p=${page}`;
        console.log(`[MangaOni] 🌐 Obteniendo últimas: ${url}`);
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 4. BÚSQUEDA
    // ============================================================

    async search(query, page, filters) {
        await this.ensureSession();
        
        if (!query || !query.trim()) {
            // Sin query, usar directorio con filtros
            let url = `${this.baseUrl}/directorio?p=${page}`;
            
            if (filters && filters.length > 0) {
                for (const filter of filters) {
                    if (filter.type_name === "SelectFilter") {
                        const selectedIndex = filter.state || 0;
                        const selectedValue = filter.values[selectedIndex];
                        
                        if (selectedValue && selectedValue.value && selectedValue.value !== 'false') {
                            const paramName = filter.name.toLowerCase();
                            url += `&${paramName}=${selectedValue.value}`;
                        }
                    }
                }
            }
            
            console.log(`[MangaOni] 🔍 Buscando con filtros: ${url}`);
            try {
                const res = await new Client().get(url, { headers: this.getHeaders(url) });
                if (res.statusCode === 200) {
                    return this.mangaListFromPage(res);
                }
            } catch (e) {
                console.error('[MangaOni] Error en búsqueda con filtros:', e);
            }
            return { list: [], hasNextPage: false };
        }

        // Con query - usar la URL de búsqueda
        const url = `${this.baseUrl}/buscar?s=${encodeURIComponent(query.trim())}&p=${page}`;
        console.log(`[MangaOni] 🔍 Buscando: ${url}`);
        
        try {
            const res = await new Client().get(url, { headers: this.getHeaders(url) });
            if (res.statusCode === 200) {
                return this.mangaListFromPage(res);
            }
        } catch (e) {
            console.error('[MangaOni] Error en búsqueda:', e);
        }
        
        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // 5. DETALLES DEL MANGA
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.toAbsoluteUrl(url);
        console.log(`[MangaOni] 📖 Obteniendo detalles de: ${absoluteUrl}`);
        await this.ensureSession();

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            // Título
            const titleEl = doc.selectFirst('h1');
            const name = titleEl ? this.getText(titleEl) : '';

            // Portada
            let imageUrl = '';
            const metaImage = doc.selectFirst('meta[property="og:image"]');
            if (metaImage) {
                imageUrl = metaImage.attr('content') || '';
            }
            if (!imageUrl) {
                const coverImg = doc.selectFirst('.cover img, .manga-cover img, img[src*="cover"]');
                if (coverImg) {
                    imageUrl = coverImg.attr('data-src') || coverImg.attr('src') || '';
                    if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
                }
            }

            // Descripción
            let description = '';
            const metaDesc = doc.selectFirst('meta[property="og:description"]');
            if (metaDesc) {
                description = metaDesc.attr('content') || '';
            }
            if (!description) {
                const descEl = doc.selectFirst('.sinopsis, .description, .summary, .manga-description');
                description = descEl ? this.getText(descEl) : '';
            }

            // Estado
            let status = 5;
            const bodyText = doc.selectFirst('body') ? this.getText(doc.selectFirst('body')) : '';
            if (bodyText) {
                if (/en\s*(desarrollo|curso|marcha)/i.test(bodyText)) status = 0;
                else if (/completado|finalizado|terminado/i.test(bodyText)) status = 1;
                else if (/pausa|hiatus|espera/i.test(bodyText)) status = 2;
                else if (/cancelado|abandonado/i.test(bodyText)) status = 3;
            }

            // Géneros
            const genres = [];
            const genreEls = doc.select('.generos a, .genres a, .tags a, .categories a');
            for (const el of genreEls) {
                const g = this.getText(el);
                if (g && !genres.includes(g) && g.length < 40) {
                    genres.push(g);
                }
            }

            // Autor
            let author = '';
            const authorEl = doc.selectFirst('.autor a, .author a, a[href*="/usuario/"]');
            if (authorEl) {
                author = this.getText(authorEl);
            }

            // Capítulos
            const chapters = [];
            const chapterLinks = doc.select('a[href*="/lector/"]');
            
            for (const link of chapterLinks) {
                const chName = this.getText(link) || 'Capítulo';
                const chUrl = this.toAbsoluteUrl(link.attr('href') || '');
                if (chUrl && chUrl.includes('/lector/')) {
                    const parent = link.parentNode;
                    const dateEl = parent ? parent.selectFirst('.date, .fecha, .chapter-date, time') : null;
                    const date = dateEl ? this.getText(dateEl) : '';
                    chapters.push({ name: chName, url: chUrl, date });
                }
            }
            
            chapters.reverse();

            console.log(`[MangaOni] 📖 Capítulos extraídos: ${chapters.length}`);
            return { name, imageUrl, description, status, genre: genres, author, chapters };

        } catch (e) {
            console.error('[MangaOni] Error en getDetail:', e);
            return emptyResult;
        }
    }

    // ============================================================
    // 6. PÁGINAS DE UN CAPÍTULO
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        const absoluteUrl = this.toAbsoluteUrl(url);
        console.log(`[MangaOni] 🖼️ Obteniendo páginas de: ${absoluteUrl}`);
        await this.ensureSession();

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const html = res.body;
            if (!html) return [];

            const pages = [];
            const seen = new Set();

            // Buscar variable unicap
            const match = html.match(/var\s+unicap\s*=\s*['"]([^'"]+)['"]/);
            if (match) {
                console.log('[MangaOni] 🔍 Variable unicap encontrada');
                try {
                    const decoded = this.decodeBase64(match[1]);
                    const parts = decoded.split('||');
                    if (parts.length >= 2) {
                        const baseUrl = parts[0];
                        let imageNames = [];
                        try {
                            imageNames = JSON.parse(parts[1]);
                        } catch (e) {
                            const nameMatches = parts[1].match(/["']([^"']+)["']/g);
                            if (nameMatches) {
                                imageNames = nameMatches.map(n => n.replace(/["']/g, ''));
                            }
                        }
                        
                        if (Array.isArray(imageNames) && imageNames.length > 0) {
                            for (const name of imageNames) {
                                let imgUrl = '';
                                if (name.startsWith('http')) {
                                    imgUrl = name;
                                } else {
                                    const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
                                    imgUrl = base + name;
                                }
                                
                                if (imgUrl && !seen.has(imgUrl)) {
                                    seen.add(imgUrl);
                                    pages.push(imgUrl);
                                }
                            }
                            console.log(`[MangaOni] ✅ Páginas extraídas: ${pages.length}`);
                            if (pages.length > 0) return pages;
                        }
                    }
                } catch (e) {
                    console.warn('[MangaOni] ⚠️ Error decodificando unicap:', e);
                }
            }

            // Fallback: buscar imágenes en el DOM
            console.warn('[MangaOni] ⚠️ Usando fallback DOM...');
            const doc = new Document(html);
            const imgElements = doc.select('#slider img, .lector img, .chapter-content img');
            for (const img of imgElements) {
                let src = img.attr('data-src') || img.attr('src') || '';
                if (src && !src.startsWith('data:') && !src.includes('logo') && !src.includes('icon')) {
                    const imgUrl = this.toAbsoluteUrl(src);
                    if (imgUrl && !seen.has(imgUrl)) {
                        seen.add(imgUrl);
                        pages.push(imgUrl);
                    }
                }
            }

            console.log(`[MangaOni] 🖼️ Páginas extraídas (fallback): ${pages.length}`);
            return pages;

        } catch (e) {
            console.error('[MangaOni] Error en getPageList:', e);
            return [];
        }
    }

    // ============================================================
    // 7. MÉTODOS NO IMPLEMENTADOS
    // ============================================================

    async getHtmlContent(name, url) { return ""; }
    async cleanHtmlContent(html) { return html; }
    async getVideoList(url) { return []; }

    // ============================================================
    // 8. FILTROS
    // ============================================================

    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "genero",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Género", value: "false" },
                    { type_name: "SelectOption", name: "Comedia", value: "1" },
                    { type_name: "SelectOption", name: "Drama", value: "2" },
                    { type_name: "SelectOption", name: "Acción", value: "3" },
                    { type_name: "SelectOption", name: "Escolar", value: "4" },
                    { type_name: "SelectOption", name: "Romance", value: "5" },
                    { type_name: "SelectOption", name: "Ecchi", value: "6" },
                    { type_name: "SelectOption", name: "Aventura", value: "7" },
                    { type_name: "SelectOption", name: "Shōnen", value: "8" },
                    { type_name: "SelectOption", name: "Shōjo", value: "9" },
                    { type_name: "SelectOption", name: "Deportes", value: "10" },
                    { type_name: "SelectOption", name: "Psicológico", value: "11" },
                    { type_name: "SelectOption", name: "Fantasía", value: "12" },
                    { type_name: "SelectOption", name: "Mecha", value: "13" },
                    { type_name: "SelectOption", name: "Gore", value: "14" },
                    { type_name: "SelectOption", name: "Yaoi", value: "15" },
                    { type_name: "SelectOption", name: "Yuri", value: "16" },
                    { type_name: "SelectOption", name: "Misterio", value: "17" },
                    { type_name: "SelectOption", name: "Sobrenatural", value: "18" },
                    { type_name: "SelectOption", name: "Seinen", value: "19" },
                    { type_name: "SelectOption", name: "Ficción", value: "20" },
                    { type_name: "SelectOption", name: "Harem", value: "21" },
                    { type_name: "SelectOption", name: "Webtoon", value: "25" },
                    { type_name: "SelectOption", name: "Histórico", value: "27" },
                    { type_name: "SelectOption", name: "Músical", value: "30" },
                    { type_name: "SelectOption", name: "Ciencia ficción", value: "31" },
                    { type_name: "SelectOption", name: "Shōjo-ai", value: "32" },
                    { type_name: "SelectOption", name: "Josei", value: "33" },
                    { type_name: "SelectOption", name: "Magia", value: "34" },
                    { type_name: "SelectOption", name: "Artes Marciales", value: "35" },
                    { type_name: "SelectOption", name: "Horror", value: "36" },
                    { type_name: "SelectOption", name: "Demonios", value: "37" },
                    { type_name: "SelectOption", name: "Supervivencia", value: "38" },
                    { type_name: "SelectOption", name: "Recuentos de la vida", value: "39" },
                    { type_name: "SelectOption", name: "Shōnen ai", value: "40" },
                    { type_name: "SelectOption", name: "Militar", value: "41" },
                    { type_name: "SelectOption", name: "Eroge", value: "42" },
                    { type_name: "SelectOption", name: "Isekai", value: "43" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "estado",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Estado", value: "false" },
                    { type_name: "SelectOption", name: "En desarrollo", value: "1" },
                    { type_name: "SelectOption", name: "Completo", value: "0" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "filtro",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Recientes", value: "id" },
                    { type_name: "SelectOption", name: "Alfabético", value: "nombre" },
                    { type_name: "SelectOption", name: "Visitas", value: "visitas" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "tipo",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Todo", value: "false" },
                    { type_name: "SelectOption", name: "Mangas", value: "0" },
                    { type_name: "SelectOption", name: "Manhwa", value: "1" },
                    { type_name: "SelectOption", name: "OneShot", value: "2" },
                    { type_name: "SelectOption", name: "Manhuas", value: "3" },
                    { type_name: "SelectOption", name: "Novelas", value: "4" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "adulto",
                state: 1,
                values: [
                    { type_name: "SelectOption", name: "Mostrar todo", value: "false" },
                    { type_name: "SelectOption", name: "No mostrar +18", value: "0" },
                    { type_name: "SelectOption", name: "Mostrar +18", value: "1" }
                ]
            },
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "orden",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Descendente", value: "desc" },
                    { type_name: "SelectOption", name: "Ascendente", value: "asc" }
                ]
            }
        ];
    }

    // ============================================================
    // 9. PREFERENCIAS
    // ============================================================

    getSourcePreferences() {
        return [
            {
                key: "mangaoni_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: this.baseUrl,
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            },
            {
                key: "mangaoni_pref_cookies",
                editTextPreference: {
                    title: "Cookies (para Cloudflare)",
                    summary: "Pega las cookies de la sesión si el sitio da 403",
                    value: "",
                    dialogTitle: "Cookies",
                    dialogMessage: "Introduce las cookies de Cloudflare (ej: cf_clearance=xxx; PHPSESSID=yyy)"
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = extension;
}

if (typeof globalThis !== 'undefined') {
    globalThis.source = extension;
    globalThis.extension = extension;
    globalThis.extention = extension;
    globalThis.DefaultExtension = DefaultExtension;
}

if (typeof window !== 'undefined') {
    window.source = extension;
    window.extension = extension;
    window.extention = extension;
    window.DefaultExtension = DefaultExtension;
}