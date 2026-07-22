// Qtoon - Extensión para Mangayomi
// Versión: 0.2
// Web: https://qtoon.org

const mangayomiSources = [{
    "name": "Qtoon",
    "lang": "es",
    "baseUrl": "https://qtoon.org",
    "apiUrl": "",
    "iconUrl": "https://qtoon.org/theme/assets/images/favicon/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2",
    "pkgPath": "",
    "notes": "Extensión para Qtoon - Leer manga y manhwa en español"
}];

class DefaultExtension extends MProvider {

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": this.source.baseUrl,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        };
    }

    toAbsoluteUrl(url) {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return this.source.baseUrl + (url.startsWith('/') ? url : '/' + url);
    }

    // Función para limpiar texto
    cleanText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    }

    // ============================================================
    // 1. LISTA DE MANGAS
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        // Buscar items de manga en la página
        const items = doc.select(".manga-item, .mangaItem, .rcmd_item, [class*='manga-item']");

        for (const item of items) {
            const linkEl = item.selectFirst("a[href*='/manhwa/'], a[href*='/manga/'], a[href*='/manhua/']");
            if (!linkEl) continue;

            // CORRECCIÓN: Obtener nombre del elemento correcto
            let name = '';
            const nameEl = item.selectFirst(".mangaName, .rcmd_title, h3[class*='mangaName'], .two_lines");
            if (nameEl) {
                name = this.cleanText(nameEl.text);
            } else {
                name = this.cleanText(linkEl.text);
            }
            
            if (!name) continue;

            const link = this.toAbsoluteUrl(linkEl.attr("href") || "");
            if (!link || seen.has(link)) continue;

            // Imagen
            let imageUrl = "";
            const imgEl = item.selectFirst("img[src], img[data-src]");
            if (imgEl) {
                imageUrl = this.toAbsoluteUrl(
                    imgEl.attr("data-src") || imgEl.attr("src") || ""
                );
            }

            seen.add(link);
            list.push({ name, imageUrl, link });
        }

        // Paginación
        let hasNextPage = false;
        const nextBtn = doc.selectFirst(".load-more, .pagination-next, a[rel='next']");
        if (nextBtn) hasNextPage = true;

        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES
    // ============================================================

    async getPopular(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        const url = page === 1 
            ? `${this.source.baseUrl}/shelf?sort=popular`
            : `${this.source.baseUrl}/shelf?sort=popular&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 3. ÚLTIMAS ACTUALIZACIONES
    // ============================================================

    get supportsLatest() { return true; }

    async getLatestUpdates(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        const url = page === 1
            ? `${this.source.baseUrl}/latest-updates`
            : `${this.source.baseUrl}/latest-updates?page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 4. BÚSQUEDA
    // ============================================================

    async search(query, page, filters) {
        if (!query || !query.trim()) return { list: [], hasNextPage: false };
        const url = `${this.source.baseUrl}/browse?q=${encodeURIComponent(query.trim())}&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        if (res.statusCode === 200) return this.mangaListFromPage(res);
        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // 5. DETALLES DEL MANGA
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: "", imageUrl: "", description: "", genre: [], status: 5, chapters: [] };
        if (!url) return emptyResult;

        const absUrl = this.toAbsoluteUrl(url);

        try {
            const res = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const doc = new Document(res.body);

            // Nombre
            const titleEl = doc.selectFirst("h1.title, .title.two_lines");
            const name = titleEl ? this.cleanText(titleEl.text) : "";

            // Imagen de portada
            let imageUrl = "";
            const imgEl = doc.selectFirst(".header img.image, .detail img[src*='storage']");
            if (imgEl) {
                imageUrl = this.toAbsoluteUrl(
                    imgEl.attr("data-src") || imgEl.attr("src") || ""
                );
            }

            // Descripción
            let description = "";
            const descEl = doc.selectFirst(".description, .synopsis, #syn-clamp");
            if (descEl) {
                description = this.cleanText(descEl.text);
            }

            // Géneros
            const genreEls = doc.select(".tag .item a, ul.tag a[href*='/shelf?genre=']");
            const genre = genreEls.map(a => this.cleanText(a.text)).filter(t => t);

            // Estado
            let status = 5;
            const statusEl = doc.selectFirst(".status, .detail-meta-chip.chip-ongoing, .detail-meta-chip.chip-done");
            if (statusEl) {
                const statusText = statusEl.text.toLowerCase();
                if (statusText.includes("en curso") || statusText.includes("ongoing")) status = 0;
                else if (statusText.includes("completado") || statusText.includes("completed")) status = 1;
            }

            // Capítulos
            const chapters = [];
            const chapterItems = doc.select("#episode-list li, .list-wrap ul li[data-ep-num]");

            for (const item of chapterItems) {
                const linkEl = item.selectFirst("a[href*='/read/']");
                if (!linkEl) continue;

                // CORRECCIÓN: Obtener nombre del capítulo correctamente
                let chName = '';
                const nameEl = linkEl.selectFirst(".name, h3.name");
                if (nameEl) {
                    // Extraer solo el texto del capítulo, eliminando "Episodio" y números duplicados
                    const fullText = this.cleanText(nameEl.text);
                    // Si el texto contiene "Episodio" y "Capítulo", extraer la parte más descriptiva
                    if (fullText.includes("Episodio") && fullText.includes("Capítulo")) {
                        // Extraer el número y título si existe
                        const match = fullText.match(/(?:Episodio\s*)?(\d+(?:\.\d+)?)\s*(?:—\s*(.+?))?$/i);
                        if (match) {
                            const epNum = match[1];
                            const title = match[2] ? this.cleanText(match[2]) : '';
                            chName = title ? `Episodio ${epNum} - ${title}` : `Episodio ${epNum}`;
                        } else {
                            chName = fullText;
                        }
                    } else {
                        chName = fullText;
                    }
                }
                
                const chUrl = this.toAbsoluteUrl(linkEl.attr("href") || "");
                
                // Fecha
                const dateEl = item.selectFirst(".time, p.time");
                const date = dateEl ? this.cleanText(dateEl.text) : "";

                if (chName && chUrl) {
                    chapters.push({ name: chName, url: chUrl, date });
                }
            }

            // Invertir capítulos (de más antiguo a más nuevo)
            chapters.reverse();

            return { name, imageUrl, description, genre, status, chapters };

        } catch (e) {
            console.error("[Qtoon] getDetail error:", e);
            return emptyResult;
        }
    }

    // ============================================================
    // 6. PÁGINAS DE UN CAPÍTULO
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        let absUrl = url;
        if (!absUrl.startsWith("http")) absUrl = this.toAbsoluteUrl(absUrl);

        try {
            const res = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const doc = new Document(res.body);
            const pages = [];

            // Qtoon carga las imágenes dinámicamente, pero podemos extraerlas del HTML
            // Buscar todas las imágenes del lector
            const images = doc.select("#reader-images img, .reader-img img, img[src*='storage.zonatmo.org'], img[src*='zonatmo']");

            for (const img of images) {
                let src = img.attr("data-src") || img.attr("src") || "";
                if (src && !src.startsWith("data:")) {
                    if (!src.startsWith("http")) src = this.toAbsoluteUrl(src);
                    if (!pages.includes(src)) {
                        pages.push(src);
                    }
                }
            }

            // Si no encontró imágenes estáticas, intentar con el script de datos
            if (pages.length === 0) {
                const scripts = doc.select("script");
                for (const script of scripts) {
                    const content = script.text || "";
                    // Buscar array de imágenes en JSON o JS
                    const matches = content.matchAll(/["'](https?:\/\/[^"']*storage[^"']*\.(?:webp|jpg|jpeg|png)["'])/gi);
                    for (const match of matches) {
                        const imgUrl = match[1].replace(/["']/g, "");
                        if (!pages.includes(imgUrl)) {
                            pages.push(imgUrl);
                        }
                    }
                }
            }

            return pages;

        } catch (e) {
            console.error("[Qtoon] getPageList error:", e);
            return [];
        }
    }

    // ============================================================
    // 7. MÉTODOS NO IMPLEMENTADOS
    // ============================================================

    async getHtmlContent(name, url) { return ""; }
    async cleanHtmlContent(html)    { return html; }
    async getVideoList(url)         { return []; }

    // ============================================================
    // 8. FILTROS
    // ============================================================

    getFilterList() {
        return [
            {
                type_name: "SelectFilter",
                type: "sort",
                name: "Ordenar por",
                state: 0,
                values: [
                    { type_name: "SelectOption", name: "Popular",      value: "popular" },
                    { type_name: "SelectOption", name: "Último",       value: "latest" },
                    { type_name: "SelectOption", name: "Actualizado",  value: "updated" }
                ]
            },
            {
                type_name: "GroupFilter",
                name: "Géneros",
                state: [],
                filters: [
                    { type_name: "CheckBox", name: "Action", value: "action" },
                    { type_name: "CheckBox", name: "Romance", value: "romance" },
                    { type_name: "CheckBox", name: "Drama", value: "drama" },
                    { type_name: "CheckBox", name: "Fantasy", value: "fantasy" },
                    { type_name: "CheckBox", name: "Comedy", value: "comedy" },
                    { type_name: "CheckBox", name: "Slice of Life", value: "slice-of-life" },
                    { type_name: "CheckBox", name: "Ecchi", value: "ecchi" },
                    { type_name: "CheckBox", name: "Harem", value: "harem" }
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
                key: "qtoon_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: this.source.baseUrl,
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base de Qtoon"
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