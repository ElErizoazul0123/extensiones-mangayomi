// ============================================================
// VerManhwa - Extensión para Mangayomi (+18)
// Versión: 0.3 (Estable)
// Web: https://vermanhwa.com
// ============================================================
// DESCRIPCIÓN:
// Extensión para leer manhwa +18 desde VerManhwa.com
// Compatible con el modo "List Style" del lector Madara
// Todas las imágenes del capítulo se cargan en el HTML inicial
// ============================================================

const mangayomiSources = [{
    "name": "VerManhwa",
    "lang": "es",
    "baseUrl": "https://vermanhwa.com",
    "apiUrl": "",
    "iconUrl": "https://vermanhwa.com/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.3",
    "isAdult": true,
    "adult": true,
    "pkgPath": "",
    "notes": "Extensión para VerManhwa - Leer manhwa +18 en español (Modo List Style)"
}];

// ============================================================
// DECLARACIÓN GLOBAL DE 'extention'
// ============================================================
// IMPORTANTE: Mangayomi busca 'extention' (con 't') en el ámbito global.
// Esta declaración temprana evita el error "extention is not defined".
// ============================================================

var extention;

// ============================================================
// CLASE PRINCIPAL
// ============================================================

class DefaultExtension extends MProvider {
    
    constructor() {
        super();
        this.baseUrl = "https://vermanhwa.com";
    }

    // ============================================================
    // CABECERAS HTTP
    // ============================================================
    // Se envía un User-Agent moderno y cabeceras que simulan un navegador
    // para evitar bloqueos por parte del servidor.
    // ============================================================
    
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.baseUrl,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        };
    }

    // ============================================================
    // UTILIDADES DE URLs
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

    // ============================================================
    // 1. PARSEO DE LISTAS DE MANGAS
    // ============================================================
    // Extrae los mangas de la página principal o de búsqueda.
    // Usa múltiples selectores para ser robusto ante cambios en el HTML.
    // Filtra nombres vacíos o no deseados ([object Object], Logo, etc.).
    // ============================================================
    
    mangaListFromPage(res) {
        const doc = new Document(res.body);
        
        const selectorsToTry = [
            '.page-listing-item .page-item-detail',
            '.page-item-detail',
            '.manga-item',
            '.page-listing-item',
            'a[href*="/manga/"]',
            '.item-thumb a'
        ];

        let elements = [];
        for (const selector of selectorsToTry) {
            const found = doc.select(selector);
            if (found.length > 0) {
                elements = found;
                break;
            }
        }

        if (elements.length === 0) {
            const imgLinks = doc.select('a img[src*=".jpg"], a img[src*=".png"], a img[src*=".webp"]');
            elements = imgLinks.map(img => img.parentNode);
        }

        const list = [];
        const seenLinks = new Set();

        for (const element of elements) {
            const linkEl = element.selectFirst('a[href*="/manga/"]') || element.selectFirst('.item-thumb a') || element.selectFirst('a');
            const img = element.selectFirst('img') || element.selectFirst('img[src*=".jpg"]') || element.selectFirst('img[data-src]');
            
            let name = '';
            const titleEl = element.selectFirst('.post-title h3 a, .post-title a, .h5 a, h3 a');
            if (titleEl) {
                try {
                    name = String(titleEl.text?.() || titleEl.text || '').trim();
                } catch (_) {
                    name = String(titleEl.text || '').trim();
                }
            }
            if (!name && img) {
                name = img.attr('alt') || img.attr('title') || '';
            }
            if (!name && linkEl) {
                name = linkEl.attr('title') || '';
            }
            if (!name) {
                try {
                    name = String(element.text?.() || element.text || '').trim();
                } catch (_) {
                    name = String(element.text || '').trim();
                }
            }
            if (name) {
                name = name.replace(/\s+/g, ' ').trim();
            }
            if (!name || name === '' || name === 'Logo' || name === 'Image' || name === 'Manga' || name === '[object Object]') {
                continue;
            }
            
            let imageUrl = '';
            if (img) {
                imageUrl = img.attr('data-src') || 
                           img.attr('data-lazy-src') || 
                           img.attr('data-original') || 
                           img.attr('src');
                if (imageUrl && imageUrl.includes('lazyload')) {
                    imageUrl = '';
                }
            }
            if (!imageUrl || imageUrl === '' || imageUrl.startsWith('data:')) {
                const anyImg = element.selectFirst('img[src*="http"]');
                if (anyImg) {
                    imageUrl = anyImg.attr('src') || anyImg.attr('data-src') || '';
                }
            }
            if (imageUrl && imageUrl.startsWith('data:')) {
                imageUrl = '';
            }
            
            let link = '';
            if (linkEl) {
                link = linkEl.attr('href') || '';
            }
            if (!link) {
                const a = element.selectFirst('a[href*="/manga/"]');
                if (a) link = a.attr('href') || '';
            }

            if (link && !link.includes('javascript:') && !link.includes('#')) {
                const absoluteLink = this.toAbsoluteUrl(link);
                const absoluteImage = this.toAbsoluteUrl(imageUrl);
                
                if (!seenLinks.has(absoluteLink) && absoluteLink && absoluteImage && absoluteImage.length > 10) {
                    seenLinks.add(absoluteLink);
                    list.push({
                        name: name.trim(),
                        imageUrl: absoluteImage,
                        link: absoluteLink
                    });
                }
            }
        }

        // Paginación: si hay resultados, asumimos que hay más páginas
        const hasNextPage = list.length > 0;

        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES
    // ============================================================
    // Obtiene los mangas más populares desde la página principal.
    // Usa paginación: /page/2/, /page/3/, etc.
    // ============================================================
    
    async getPopular(page) {
        if (page > 50) {
            return { list: [], hasNextPage: false };
        }
        const url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. ÚLTIMAS ACTUALIZACIONES
    // ============================================================
    // VerManhwa usa la misma página para populares y últimas actualizaciones.
    // La página principal muestra los mangas recientemente actualizados.
    // ============================================================
    
    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        if (page > 50) {
            return { list: [], hasNextPage: false };
        }
        const url = page === 1 ? this.baseUrl : `${this.baseUrl}/page/${page}/`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 4. BÚSQUEDA
    // ============================================================
    // Realiza búsquedas en el sitio usando el parámetro 's' de WordPress.
    // Añade 'post_type=wp-manga' para limitar los resultados a mangas.
    // ============================================================
    
    async search(query, page, filters) {
        if (!query || query.trim() === '') {
            return { list: [], hasNextPage: false };
        }
        const url = `${this.baseUrl}/?s=${encodeURIComponent(query.trim())}&post_type=wp-manga&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        if (res.statusCode === 200) {
            return this.mangaListFromPage(res);
        }
        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // 5. DETALLES DEL MANGA
    // ============================================================
    // Obtiene toda la información de un manga:
    // - Título, portada, descripción, estado, géneros, autor.
    // - Lista de capítulos con sus URLs y fechas.
    // ============================================================
    
    async getDetail(url) {
        if (!url || url.trim() === '') {
            return { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        }

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        
        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const titleEl = doc.selectFirst('.post-title h1, h1, .manga-name, .entry-title, .profile-manga .post-title h1');
            const name = titleEl?.text?.trim() || '';

            const coverImg = doc.selectFirst('.summary_image img, .thumb img, .s-image img, .cover img, .poster img, .profile-manga .summary_image img');
            let imageUrl = '';
            if (coverImg) {
                imageUrl = coverImg.attr('data-src') || coverImg.attr('src') || '';
            }
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = this.toAbsoluteUrl(imageUrl);
            }

            const descEl = doc.selectFirst('.summary__content, .entry-content, .desc, .description, .sinopsis, .summary_content .summary__content');
            const description = descEl?.text?.trim() || '';

            let status = 5;
            const statusEl = doc.selectFirst('.summary-content .status, .status, .state, .manga-status, .post-status .summary-content');
            if (statusEl) {
                const statusText = statusEl.text?.trim()?.toUpperCase() || '';
                if (statusText.includes('PUBLICANDOSE') || statusText.includes('EN CURSO') || statusText.includes('ONGOING')) {
                    status = 0;
                } else if (statusText.includes('FINALIZADO') || statusText.includes('COMPLETADO') || statusText.includes('COMPLETED')) {
                    status = 1;
                } else if (statusText.includes('EN ESPERA') || statusText.includes('HIATUS')) {
                    status = 2;
                } else if (statusText.includes('CANCELADO')) {
                    status = 3;
                }
            }

            const genres = [];
            const genreElements = doc.select('.genres-content a, .genres a, .tags a, .categories a, [class*="genre"] a');
            for (const el of genreElements) {
                const text = el.text?.trim() || '';
                if (text) genres.push(text);
            }

            const authorEl = doc.selectFirst('.author a, .authors a, .summary-content .author a, .profile-manga .author-content a');
            const author = authorEl?.text?.trim() || '';

            const chapters = [];
            const chapterSelectors = [
                '.wp-manga-chapter a',
                '#chapterlist a',
                '.chbox a',
                '.eph-num a',
                '.chapter-list a',
                '.list-chapter a',
                '.chapter-item a',
                'a[href*="/capitulo-"]',
                'a[href*="/chapter-"]'
            ];
            
            let chapterElements = [];
            for (const sel of chapterSelectors) {
                const nodes = doc.select(sel);
                if (nodes.length > 0) {
                    chapterElements = nodes;
                    break;
                }
            }

            for (const link of chapterElements) {
                let chName = link.text?.trim() || link.attr('title') || 'Capítulo';
                chName = chName.replace(/^[0-9]+\s*-\s*/, '');
                const chUrl = link.attr('href');
                if (chUrl && !chUrl.includes('javascript:')) {
                    const absoluteChUrl = this.toAbsoluteUrl(chUrl);
                    if (absoluteChUrl) {
                        const parent = link.parentNode;
                        const dateEl = parent?.selectFirst('.chapter-release-date, .date, .chapter-date, time, .release-date, .post-on') || 
                                      link.selectFirst('.chapter-release-date, .date, .chapter-date');
                        const date = dateEl?.text?.trim() || '';
                        
                        chapters.push({
                            name: chName,
                            url: absoluteChUrl,
                            date: date
                        });
                    }
                }
            }

            chapters.reverse();

            return {
                name: name,
                imageUrl: imageUrl,
                description: description,
                status: status,
                genre: genres,
                author: author,
                chapters: chapters
            };
        } catch (e) {
            console.error(`[VerManhwa] Error en getDetail:`, e);
            return { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        }
    }

    // ============================================================
    // 6. PÁGINAS DE UN CAPÍTULO (MODO LIST STYLE)
    // ============================================================
    // VerManhwa usa el modo "List Style" del lector Madara.
    // TODAS las imágenes del capítulo están en el HTML inicial,
    // dentro del contenedor .reading-content.
    // 
    // IMPORTANTE: Este sitio NO usa paginación interna de capítulos.
    // No hay botones "Siguiente" ni llamadas AJAX para cargar más imágenes.
    // Por lo tanto, NO se debe intentar paginar.
    // ============================================================
    
    async getPageList(url) {
        if (!url || url.trim() === '') {
            return [];
        }

        const absoluteUrl = this.ensureAbsoluteUrl(url);
        console.log(`[VerManhwa] 🖼️ Obteniendo páginas de: ${absoluteUrl}`);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            // Buscar el contenedor principal del capítulo
            const container = doc.selectFirst('.reading-content');
            if (!container) {
                console.warn('[VerManhwa] No se encontró .reading-content');
                // Fallback: buscar cualquier div con muchas imágenes
                const allDivs = doc.select('div');
                let maxImgs = 0;
                let bestDiv = null;
                for (const div of allDivs) {
                    const imgs = div.select('img');
                    if (imgs.length > maxImgs) {
                        maxImgs = imgs.length;
                        bestDiv = div;
                    }
                }
                if (bestDiv && maxImgs > 2) {
                    console.log('[VerManhwa] Usando contenedor alternativo con', maxImgs, 'imágenes');
                    return this.extractImagesFromElement(bestDiv);
                }
                return [];
            }

            return this.extractImagesFromElement(container);

        } catch (e) {
            console.error(`[VerManhwa] Error en getPageList:`, e);
            return [];
        }
    }

    // ============================================================
    // 6.1 AUXILIAR: Extraer imágenes de un elemento
    // ============================================================
    // Extrae todas las imágenes de un elemento HTML,
    // filtrando logos, iconos y otras imágenes no deseadas.
    // ============================================================
    
    extractImagesFromElement(element) {
        const images = [];
        const seen = new Set();

        const srcAttrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-lazy'];
        const imgElements = element.select('img');

        for (const img of imgElements) {
            let imgUrl = '';
            for (const attr of srcAttrs) {
                const val = img.attr(attr);
                if (val) {
                    const cleanVal = val.trim();
                    if (cleanVal && cleanVal.startsWith('http') && !cleanVal.includes('lazyload')) {
                        imgUrl = cleanVal.split('?')[0];
                        break;
                    }
                }
            }
            if (imgUrl && !seen.has(imgUrl)) {
                const lower = imgUrl.toLowerCase();
                if (lower.includes('logo') || lower.includes('icon') || lower.includes('avatar') ||
                    lower.includes('banner') || lower.includes('placeholder') || lower.includes('thumb')) {
                    continue;
                }
                seen.add(imgUrl);
                images.push(imgUrl);
            }
        }

        // Fallback con regex (por si el selector no captura todas las imágenes)
        if (images.length === 0) {
            const html = element.outerHtml ? element.outerHtml() : '';
            const regex = /<img[^>]+(?:src|data-src|data-lazy-src)="([^"]+\.(?:webp|jpg|jpeg|png))"/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
                let url = match[1].trim();
                if (url && url.startsWith('http') && !seen.has(url)) {
                    const lower = url.toLowerCase();
                    if (!lower.includes('logo') && !lower.includes('icon') && !lower.includes('avatar')) {
                        seen.add(url);
                        images.push(url);
                    }
                }
            }
        }

        console.log(`[VerManhwa] Extraídas ${images.length} imágenes del capítulo`);
        return images;
    }

    // ============================================================
    // 7. FILTROS Y PREFERENCIAS
    // ============================================================
    // Configuración opcional de filtros para ordenar resultados.
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
                    { type_name: "SelectOption", name: "A-Z", value: "alphabet" },
                    { type_name: "SelectOption", name: "Más valorados", value: "rating" },
                    { type_name: "SelectOption", name: "Tendencia", value: "trending" }
                ]
            },
            {
                type_name: "GroupFilter",
                name: "Estado",
                state: [
                    { type_name: "CheckBox", name: "En emisión", value: "ongoing" },
                    { type_name: "CheckBox", name: "Completado", value: "completed" },
                    { type_name: "CheckBox", name: "En espera", value: "on-hold" },
                    { type_name: "CheckBox", name: "Cancelado", value: "canceled" }
                ]
            }
        ];
    }

    getSourcePreferences() {
        return [
            {
                key: "vermanhwa_pref_domain",
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

    // ============================================================
    // MÉTODOS NO IMPLEMENTADOS (Requeridos por la interfaz)
    // ============================================================
    
    async getHtmlContent(name, url) {
        return '';
    }

    async cleanHtmlContent(html) {
        return html;
    }

    async getVideoList(url) {
        return [];
    }
}

// ============================================================
// EXPORTACIÓN - ESTABLE Y FUNCIONAL
// ============================================================
// Se crea una instancia de la extensión y se asigna a 'extention'
// (con 't') como requiere Mangayomi.
// También se exporta como 'extension' y 'source' por compatibilidad.
// ============================================================

var extention = new DefaultExtension();
var extension = extention;

// Exportación para Node.js (si se usa en ese entorno)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = extention;
}

// Exportación para navegadores y entornos globales
if (typeof globalThis !== 'undefined') {
    globalThis.source = extention;
    globalThis.extension = extention;
    globalThis.extention = extention;
    globalThis.DefaultExtension = DefaultExtension;
}

if (typeof window !== 'undefined') {
    window.source = extention;
    window.extension = extention;
    window.extention = extention;
    window.DefaultExtension = DefaultExtension;
}