// Niadd - Extensión para Mangayomi
// Versión: 0.2
// Web: https://es.niadd.com

const mangayomiSources = [{
    "name": "Niadd",
    "lang": "es",
    "baseUrl": "https://es.niadd.com",
    "apiUrl": "",
    "iconUrl": "https://es.niadd.com/files/images/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "1.8",
    "pkgPath": "",
    "notes": "Extensión para Niadd - Leer manga en español"
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

    // ============================================================
    // 1. LISTA DE MANGAS  (selector confirmado inspeccionando HTML)
    //
    // La página /category/index_N.html tiene items con esta forma:
    //   <dl class="bookcase-item">
    //     <dt><a href="/manga/TITULO.html" title="NOMBRE"><img src="..." /></a></dt>
    //     <dd class="bookcase-item-right">
    //       <a class="bookcase-item-name" href="...">NOMBRE</a>
    //       ...
    //     </dd>
    //   </dl>
    // ============================================================

    mangaListFromPage(res) {
        const doc = new Document(res.body);
        const list = [];
        const seen = new Set();

        // La página usa <ul><li> donde cada <li> tiene:
        //   <a href="/manga/TITULO.html" title="NOMBRE">  ← link + nombre
        //   <img src="...">                               ← dentro de ese <a> o como hermano
        // Tomamos todos los <a> que apuntan a /manga/ o /original/ con title
        const anchors = doc.select("a[href*='/manga/'][title], a[href*='/original/'][title]");

        for (const a of anchors) {
            const name = (a.attr("title") || a.text || "").trim();
            if (!name) continue;

            const link = this.toAbsoluteUrl(a.attr("href") || "");
            if (!link || seen.has(link)) continue;

            // Imagen: dentro del mismo <a> o en el <li> padre
            let imageUrl = "";
            const imgInside = a.selectFirst("img");
            if (imgInside) {
                imageUrl = this.toAbsoluteUrl(
                    imgInside.attr("data-src") || imgInside.attr("src") || ""
                );
            }
            if (!imageUrl) {
                const parent = a.parentNode;
                const imgSibling = parent ? parent.selectFirst("img") : null;
                if (imgSibling) {
                    imageUrl = this.toAbsoluteUrl(
                        imgSibling.attr("data-src") || imgSibling.attr("src") || ""
                    );
                }
            }

            seen.add(link);
            list.push({ name, imageUrl, link });
        }

        // Paginación: buscar enlace "Siguiente>>"
        let hasNextPage = false;
        for (const a of doc.select("a")) {
            const txt = (a.text || "").trim();
            if (txt.includes("Siguiente") || txt.includes(">>")) {
                const href = a.attr("href") || "";
                if (href && href !== "#") { hasNextPage = true; break; }
            }
        }

        return { list, hasNextPage };
    }

    // ============================================================
    // 2. POPULARES  →  /category/index_N.html
    // ============================================================

    async getPopular(page) {
        if (page > 100) return { list: [], hasNextPage: false };
        const url = `${this.source.baseUrl}/category/index_${page}.html`;
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
            ? `${this.source.baseUrl}/list/New-Update/`
            : `${this.source.baseUrl}/list/New-Update/index_${page}.html`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        return this.mangaListFromPage(res);
    }

    // ============================================================
    // 4. BÚSQUEDA
    // ============================================================

    async search(query, page, filters) {
        if (!query || !query.trim()) return { list: [], hasNextPage: false };
        const url = `${this.source.baseUrl}/search/?name=${encodeURIComponent(query.trim())}&page=${page}`;
        const res = await new Client().get(url, { headers: this.getHeaders(url) });
        if (res.statusCode === 200) return this.mangaListFromPage(res);
        return { list: [], hasNextPage: false };
    }

    // ============================================================
    // 5. DETALLES DEL MANGA
    //
    // Niadd separa info y capítulos en dos páginas:
    //   /manga/TITULO.html          → portada, descripción, géneros, estado
    //   /manga/TITULO/chapters.html → lista completa de capítulos
    // ============================================================

    async getDetail(url) {
        const emptyResult = { name: "", imageUrl: "", description: "", genre: [], status: 5, chapters: [] };
        if (!url) return emptyResult;

        const absUrl = this.toAbsoluteUrl(url);

        try {
            // ── Página de detalle ────────────────────────────────
            const infoRes = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const doc = new Document(infoRes.body);

            // Nombre: <h1> principal
            const titleEl = doc.selectFirst("h1");
            const name = titleEl ? titleEl.text.trim() : "";

            // Imagen de portada
            let imageUrl = "";
            const imgEl = doc.selectFirst(".bookside-img img, .manga-cover img, div.cover img, img[src*='/logo/']");
            if (imgEl) {
                imageUrl = this.toAbsoluteUrl(imgEl.attr("data-src") || imgEl.attr("src") || "");
            }

            // Descripción: primero del meta, luego de la página
            let description = (doc.selectFirst("meta[name='description']") || {}).attr?.("content") || "";
            if (!description) {
                const descEl = doc.selectFirst(".manga-info-top p, .book-intro, p.description");
                description = descEl ? descEl.text.trim() : "";
            }

            // Géneros: enlaces a /category/
            const genreEls = doc.select("a[href*='/category/']");
            const genre = [...new Set(
                genreEls
                    .map(a => a.text.trim())
                    .filter(t => t && t.length < 40)  // descartar "ruido" largo
            )];

            // Estado: texto entre paréntesis junto al título, ej: "(En marcha)"
            let status = 5;
            const pageText = doc.selectFirst("body") ? doc.selectFirst("body").text : "";
            const statusMatch = pageText.match(/\(\s*(En marcha|En curso|Completado|Finalizado|En espera|Pausado|Cancelado)\s*\)/i);
            if (statusMatch) {
                const s = statusMatch[1].toLowerCase();
                if (s.includes("marcha") || s.includes("curso")) status = 0;
                else if (s.includes("complet") || s.includes("finaliz")) status = 1;
                else if (s.includes("espera") || s.includes("paus")) status = 2;
                else if (s.includes("cancel")) status = 3;
            }

            // ── Página de capítulos ──────────────────────────────
            // Casos:
            //   /manga/TITULO.html     →  /manga/TITULO/chapters.html
            //   /original/12345.html   →  /original/12345/chapters.html
            const chapPageUrl = absUrl.replace(/\.html$/, "/chapters.html");
            const chapRes = await new Client().get(chapPageUrl, { headers: this.getHeaders(chapPageUrl) });
            const chapDoc = new Document(chapRes.body);

            // Los capítulos son <a> con href que apunta a /chapter/
            // Pueden estar en es.ninemanga.com o es.niadd.com
            const chapLinks = chapDoc.select("a[href*='/chapter/']");

            const chapters = [];
            for (const a of chapLinks) {
                const chName = (a.attr("title") || a.text || "").trim();
                if (!chName) continue;

                let chHref = a.attr("href") || "";
                if (!chHref || chHref.includes("javascript:")) continue;

                // Normalizar: reemplazar ninemanga.com por niadd.com
                // y asegurar que termina en .html (no en /)
                chHref = chHref
                    .replace("es.ninemanga.com", "es.niadd.com")
                    .replace("ninemanga.com", "niadd.com");
                if (chHref.endsWith("/")) chHref = chHref.slice(0, -1) + ".html";
                if (!chHref.endsWith(".html")) chHref = chHref + ".html";

                const chUrl = this.toAbsoluteUrl(chHref);

                // Fecha: texto en el padre del enlace
                const parent = a.parentNode;
                const dateEl = parent
                    ? parent.selectFirst(".detail-chp-time, .date, time, span")
                    : null;
                const date = dateEl ? dateEl.text.trim() : "";

                chapters.push({ name: chName, url: chUrl, date });
            }

            // La página lista los capítulos de más nuevo a más antiguo;
            // invertimos para que el primero sea el más antiguo (convención Mangayomi)
            chapters.reverse();

            return { name, imageUrl, description, genre, status, chapters };

        } catch (e) {
            console.error("[Niadd] getDetail error:", e);
            return emptyResult;
        }
    }

    // ============================================================
    // 6. PÁGINAS DE UN CAPÍTULO
    //
    // Niadd muestra UNA imagen por sub-página:
    //   /chapter/TITULO/123456.html      → página 1  (imagen visible)
    //   /chapter/TITULO/123456-2.html    → página 2
    //   …
    //
    // El total de páginas se lee del texto "1/9" en la página.
    // ============================================================

    async getPageList(url) {
        if (!url) return [];

        // Normalizar: ninemanga → niadd, quitar / final, asegurar .html
        let absUrl = url
            .replace("es.ninemanga.com", "es.niadd.com")
            .replace("ninemanga.com", "niadd.com");
        if (!absUrl.startsWith("http")) absUrl = this.toAbsoluteUrl(absUrl);
        if (absUrl.endsWith("/")) absUrl = absUrl.slice(0, -1) + ".html";
        if (!absUrl.endsWith(".html")) absUrl = absUrl + ".html";

        // Extraer ID numérico y directorio base
        // ej: https://es.niadd.com/chapter/TITULO/123456.html
        const baseMatch = absUrl.match(/^(.*\/)(\d+)\.html$/);
        if (!baseMatch) {
            console.warn("[Niadd] getPageList: URL inesperada:", absUrl);
            return [];
        }
        const dirBase   = baseMatch[1];   // "https://es.niadd.com/chapter/TITULO/"
        const chapterId = baseMatch[2];   // "123456"

        try {
            // Cargar página 1 para conocer el total
            const res1 = await new Client().get(absUrl, { headers: this.getHeaders(absUrl) });
            const html1 = res1.body;

            // Total de páginas desde "1/9" o selector de páginas
            let totalPages = 1;
            const totalMatch = html1.match(/\b1\s*\/\s*(\d+)\b/);
            if (totalMatch) {
                totalPages = parseInt(totalMatch[1], 10);
            }

            const pages = [];
            const seen  = new Set();

            // Extraer imagen de página 1
            const img1 = this._extractImg(html1);
            if (img1 && !seen.has(img1)) { seen.add(img1); pages.push(img1); }

            // Iterar sub-páginas 2..N
            for (let p = 2; p <= totalPages; p++) {
                const subUrl = `${dirBase}${chapterId}-${p}.html`;
                try {
                    const subRes = await new Client().get(subUrl, {
                        headers: { ...this.getHeaders(subUrl), "Referer": absUrl }
                    });
                    const img = this._extractImg(subRes.body);
                    if (img && !seen.has(img)) { seen.add(img); pages.push(img); }
                } catch (e) {
                    console.warn(`[Niadd] sub-página ${p} error:`, e.message);
                }
            }

            return pages;

        } catch (e) {
            console.error("[Niadd] getPageList error:", e);
            return [];
        }
    }

    // Extrae la imagen principal del HTML del lector
    _extractImg(html) {
        // 1. Imagen dentro de .mangaread-img o #viewer
        const secMatch = html.match(/<(?:div|section)[^>]+(?:mangaread-img|id=["']viewer["'])[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
        if (secMatch) {
            const m = secMatch[1].match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/i);
            if (m) return m[1];
        }
        // 2. Enlace cuyo interior es <img src="http...">
        const lm = html.match(/href=["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["'][^>]*>\s*<img/i);
        if (lm) return lm[1];
        // 3. Cualquier <img src="http..."> que no sea decorativa
        for (const m of html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png)[^"']*)["']/gi)) {
            const src = m[1];
            if (!/logo|banner|icon|favicon|avatar/i.test(src)) return src;
        }
        return "";
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
                    { type_name: "SelectOption", name: "Relevancia",    value: "relevance" },
                    { type_name: "SelectOption", name: "Último",        value: "latest" },
                    { type_name: "SelectOption", name: "A-Z",           value: "name" },
                    { type_name: "SelectOption", name: "Más valorados", value: "rating" },
                    { type_name: "SelectOption", name: "Más vistos",    value: "views" }
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
                key: "niadd_pref_domain",
                editTextPreference: {
                    title: "URL del dominio",
                    summary: "Cambia el dominio si es necesario",
                    value: this.source.baseUrl,
                    dialogTitle: "URL",
                    dialogMessage: "Introduce la URL base del sitio"
                }
            }
        ];
    }
}

// ============================================================
// EXPORTACIÓN
// var (no const/let) para que sea visible en el eval() de Mangayomi
// ============================================================

var extention = new DefaultExtension();
var extension = extention;
