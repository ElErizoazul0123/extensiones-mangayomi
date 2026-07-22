// TaurusManga - Extensión para Mangayomi
// Versión: 1.0.0
// Web: https://lectortaurus.com

const mangayomiSources = [{
    "name": "TaurusManga",
    "lang": "es",
    "baseUrl": "https://lectortaurus.com",
    "apiUrl": "",
    "iconUrl": "https://lectortaurus.com/wp-content/uploads/2017/10/1002445752.png",
    "typeSource": "single",
    "itemType": 0,
    "version": "1.0.0",
    "isAdult": false,
    "adult": false,
    "pkgPath": "",
    "notes": "Extensión para TaurusManga (tema Madara/WordPress)"
}];

class DefaultExtension extends MProvider {

    constructor() {
        super();
        this.baseUrl = "https://lectortaurus.com";
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
    // Estructura Madara estándar confirmada en /manga/:
    //   <div class="page-item-detail">
    //     <a href="/manga/{slug}/"><img src="..."></a>
    //     <h3 class="h5"><a href="/manga/{slug}/">Título</a></h3>
    //     ...
    //   </div>
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        // NOTA: el sitio reescribe el HTML con JavaScript en el navegador
        // (convirtiéndolo en .manga-card con background-image), pero eso
        // NUNCA llega a Mangayomi — la extensión recibe el HTML crudo del
        // servidor, que sigue el patrón clásico de Madara/WordPress:
        //   <div class="page-item-detail">
        //     <a href="/manga/{slug}/">
        //       <img src="PLACEHOLDER_COMPARTIDO" data-src="PORTADA_REAL">
        //       <img src="PORTADA_REAL_2">  <!-- fallback noscript, a veces -->
        //     </a>
        //     <h3><a href="/manga/{slug}/">Título</a></h3>
        //     ...
        //   </div>
        //
        // Por eso buscamos directamente los enlaces de título (h3/h4 > a)
        // en vez de depender del nombre exacto de la clase contenedora,
        // que puede variar. Esto evita quedar en 0 resultados si el tema
        // cambia una clase CSS.
        const titleAnchors = doc.select('h3 a[href*="/manga/"], h4 a[href*="/manga/"], .post-title a[href*="/manga/"]');

        // URL del placeholder de carga conocido — nunca es la portada real
        const PLACEHOLDER_HINTS = ['IMG_20250826_150657', 'loading', 'placeholder'];

        for (const titleEl of titleAnchors) {
            const href = titleEl.attr('href') || '';
            if (!href || !href.includes('/manga/')) continue;

            const link = this.toAbsoluteUrl(href);
            if (!link || seen.has(link)) continue;

            const name = this.getText(titleEl);
            if (!name) continue;

            // Subir hasta el contenedor de la tarjeta completa (2-3 niveles)
            // para encontrar la imagen de portada real
            let card = titleEl.parentNode;
            for (let i = 0; i < 3 && card; i++) {
                if (card.parentNode) card = card.parentNode; else break;
            }
            // Volver a bajar buscando todas las imágenes desde un ancestro razonable
            let searchScope = titleEl.parentNode ? titleEl.parentNode.parentNode : null;
            if (!searchScope) searchScope = doc;

            let imageUrl = '';
            const imgs = (searchScope && searchScope.select) ? searchScope.select('img') : [];
            for (const img of imgs) {
                const candidates = [img.attr('data-src'), img.attr('data-lazy-src'), img.attr('src')];
                for (const c of candidates) {
                    if (!c) continue;
                    const isPlaceholder = PLACEHOLDER_HINTS.some(hint => c.toLowerCase().includes(hint.toLowerCase()));
                    if (!isPlaceholder && !c.startsWith('data:')) {
                        imageUrl = this.toAbsoluteUrl(c);
                        break;
                    }
                }
                if (imageUrl) break;
            }

            seen.add(link);
            list.push({ name, imageUrl, link });
        }

        // Paginación: Madara usa /page/N/ con enlaces numerados o "»"
        let hasNextPage = false;
        const pageLinks = doc.select('a.next.page-numbers, .wp-pagenavi a.nextpostslink, a[href*="/page/"]');
        for (const a of pageLinks) {
            const text = this.getText(a);
            const href = a.attr('href') || '';
            if ((text === '»' || text.toLowerCase().includes('siguiente') || text.toLowerCase().includes('next')) && href && href !== '#') {
                hasNextPage = true;
                break;
            }
        }
        if (!hasNextPage && list.length >= 20) hasNextPage = true;

        console.log(`[TaurusManga] ✅ Mangas extraídos: ${list.length} | HasNextPage: ${hasNextPage}`);
        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES / ÚLTIMOS
    // ============================================================

    async getPopular(page) {
        if (page > 500) return { list: [], hasNextPage: false };
        const url = page === 1
            ? `${this.baseUrl}/manga/?m_orderby=trending`
            : `${this.baseUrl}/manga/page/${page}/?m_orderby=trending`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 500) return { list: [], hasNextPage: false };
        const url = page === 1
            ? `${this.baseUrl}/manga/?m_orderby=latest`
            : `${this.baseUrl}/manga/page/${page}/?m_orderby=latest`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. BÚSQUEDA
    //
    // Patrón estándar de Madara: ?s=QUERY&post_type=wp-manga
    // ============================================================

    async search(query, page, filters) {
        let url;
        if (query && query.trim() !== '') {
            url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query.trim())}&post_type=wp-manga`;
        } else {
            url = page === 1
                ? `${this.baseUrl}/manga/?m_orderby=alphabet`
                : `${this.baseUrl}/manga/page/${page}/?m_orderby=alphabet`;
        }
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
                    { type_name: "SelectOption", name: "Último", value: "latest" },
                    { type_name: "SelectOption", name: "A-Z", value: "alphabet" },
                    { type_name: "SelectOption", name: "Clasificación", value: "rating" },
                    { type_name: "SelectOption", name: "Tendencia", value: "trending" },
                    { type_name: "SelectOption", name: "Más Vistos", value: "views" },
                    { type_name: "SelectOption", name: "Nuevo", value: "new-manga" }
                ]
            }
        ];
    }

    // ============================================================
    // 4. DETALLES DEL MANGA
    //
    // Estructura Madara estándar: título en .post-title h1, portada
    // en .summary_image img, descripción en .summary__content o
    // .description-summary, géneros en .genres-content a, capítulos
    // en .wp-manga-chapter a (misma página, sin AJAX)
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: '', imageUrl: '', description: '', status: 5, genre: [], author: '', chapters: [] };
        if (!url) return emptyResult;

        const absoluteUrl = this.toAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const titleEl = doc.selectFirst('.post-title h1, h1.entry-title, h1');
            const name = titleEl ? this.getText(titleEl) : '';

            let imageUrl = '';
            const coverImg = doc.selectFirst('.summary_image img, .tab-summary img');
            if (coverImg) {
                imageUrl = coverImg.attr('data-src') || coverImg.attr('data-lazy-src') || coverImg.attr('src') || '';
                if (imageUrl) imageUrl = this.toAbsoluteUrl(imageUrl);
            }

            let description = '';
            const descEl = doc.selectFirst('.summary__content, .description-summary, .manga-excerpt');
            if (descEl) description = this.getText(descEl);

            let status = 5;
            const statusEl = doc.selectFirst('.post-status .summary-content, .post-content_item .summary-content');
            if (statusEl) {
                const statusText = this.getText(statusEl).toLowerCase();
                if (statusText.includes('emision') || statusText.includes('emisión') || statusText.includes('ongoing')) status = 0;
                else if (statusText.includes('completo') || statusText.includes('completed') || statusText.includes('finaliz')) status = 1;
                else if (statusText.includes('pausa') || statusText.includes('hiatus')) status = 2;
                else if (statusText.includes('cancel') || statusText.includes('drop')) status = 3;
            }

            const genres = [];
            const genreEls = doc.select('.genres-content a, a[href*="/manga-genre/"]');
            for (const el of genreEls) {
                const g = this.getText(el);
                if (g && !genres.includes(g)) genres.push(g);
            }

            let author = '';
            const authorEl = doc.selectFirst('.author-content a');
            if (authorEl) author = this.getText(authorEl);

            // Capítulos: listados directamente en la misma página
            const chapters = [];
            const chapterEls = doc.select('.wp-manga-chapter a, li.wp-manga-chapter a, .chapter-link a, a[href*="/capitulo-"]');
            const seenCh = new Set();

            for (const link of chapterEls) {
                const href = link.attr('href') || '';
                if (!href) continue;
                const chUrl = this.toAbsoluteUrl(href);
                if (!chUrl || seenCh.has(chUrl)) continue;
                if (!/capitulo/i.test(chUrl) && !/chapter/i.test(chUrl)) continue;

                let chName = this.getText(link);
                if (!chName) continue;

                const parent = link.parentNode;
                const dateEl = parent ? parent.selectFirst('.chapter-release-date, .post-on, i') : null;
                const date = dateEl ? this.getText(dateEl) : '';

                seenCh.add(chUrl);
                chapters.push({ name: chName, url: chUrl, date });
            }

            chapters.reverse();
            return { name, imageUrl, description, status, genre: genres, author, chapters };

        } catch (e) {
            console.error('[TaurusManga] Error en getDetail:', e);
            return emptyResult;
        }
    }

    // ============================================================
    // 5. PÁGINAS DE UN CAPÍTULO
    //
    // Estructura confirmada: imágenes directas en <img src="...">
    // dentro del contenedor del lector. Sin AJAX, sin lazy-load
    // complicado. Formato típico Madara:
    //   <div class="reading-content">
    //     <img src="https://.../Manga_Page_Number_N.jpg">
    //     ...
    //   </div>
    // ============================================================

    async getPageList(url) {
        if (!url) return [];
        const absoluteUrl = this.toAbsoluteUrl(url);

        try {
            const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
            const doc = new Document(res.body);

            const pages = [];
            const seen = new Set();

            let container = doc.selectFirst('.reading-content, .page-break, .container-chapter-reader');

            const imgs = container ? container.select('img') : doc.select('img[src*="wp-content/uploads"]');

            for (const img of imgs) {
                let src = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
                src = src.trim();
                if (!src || src.startsWith('data:')) continue;
                if (/logo|icon|favicon|avatar|loading|placeholder/i.test(src)) continue;

                const absSrc = this.toAbsoluteUrl(src);
                if (absSrc && !seen.has(absSrc)) {
                    seen.add(absSrc);
                    pages.push(absSrc);
                }
            }

            // Fallback: regex directa por si cambia la estructura del contenedor
            if (pages.length === 0) {
                const imgRegex = /<img[^>]+(?:data-src|data-lazy-src|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
                let match;
                while ((match = imgRegex.exec(res.body)) !== null) {
                    const src = match[1];
                    if (src && !seen.has(src) && !/logo|icon|favicon|avatar/i.test(src)) {
                        seen.add(src);
                        pages.push(src);
                    }
                }
            }

            console.log(`[TaurusManga] 🖼️ Páginas extraídas: ${pages.length}`);
            return pages;

        } catch (e) {
            console.error('[TaurusManga] Error en getPageList:', e);
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
                key: "taurusmanga_pref_domain",
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