// LeerMangaEsp - Extensión para Mangayomi (VERSIÓN FINAL CON URLs CORREGIDAS)
// Basado en el patrón de Mangafire

const mangayomiSources = [
  {
    "name": "LeerMangaEsp",
    "langs": ["es"],
    "baseUrl": "https://leermangaesp.net",
    "apiUrl": "",
    "iconUrl": "https://leermangaesp.net/favicon.ico",
    "typeSource": "single",
    "itemType": 0,
    "version": "0.2",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": ""
  }
];

class DefaultExtension extends MProvider {
  // ============================================================
  // UTILIDADES
  // ============================================================
  
  getHeaders(url) {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": this.source.baseUrl,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    };
  }

  toAbsoluteUrl(relative, base = this.source.baseUrl) {
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

  ensureAbsoluteUrl(url, base = this.source.baseUrl) {
    if (!url) return '';
    const absolute = this.toAbsoluteUrl(url, base);
    if (!absolute || absolute === '' || absolute.startsWith('data:')) {
      throw new Error(`URL inválida: ${url}`);
    }
    return absolute;
  }

  // ============================================================
  // PARSEO DE LISTAS
  // ============================================================
  
  mangaListFromPage(res) {
    const doc = new Document(res.body);
    
    const selectorsToTry = [
      '.page-item-detail > a',
      '.bsx > a',
      '.c-tabs-item__content > a',
      '.list-update .item > a',
      '.update_item > a',
      '.manga-posts .item > a',
      'a[href*="/manga/"]',
      'a[href*="/series/"]',
      'a[href*="/comic/"]',
      '.item > a',
      'li > a[href*="/manga/"]',
      'div[class*="manga"] > a',
      'a:has(img)'
    ];

    let elements = [];
    let usedSelector = '';

    for (const selector of selectorsToTry) {
      const found = doc.select(selector);
      if (found.length > 0) {
        elements = found;
        usedSelector = selector;
        break;
      }
    }

    if (elements.length === 0) {
      const imgLinks = doc.select('a img[src*=".jpg"], a img[src*=".png"], a img[src*=".webp"]');
      elements = imgLinks.map(img => img.parentNode);
      usedSelector = 'a with img (fallback)';
    }

    console.log(`[LeerMangaEsp] 🎯 Selector usado: "${usedSelector}"`);
    console.log(`[LeerMangaEsp] 📦 Elementos encontrados: ${elements.length}`);

    const list = [];
    const seenLinks = new Set();

    for (const element of elements) {
      const img = element.selectFirst('img') || element.selectFirst('img[src*=".jpg"]') || element.selectFirst('img[src*=".png"]');
      
      let name = img?.attr('alt') || img?.attr('title') || element.text?.trim() || 'Sin título';
      
      let imageUrl = '';
      if (img) {
        imageUrl = img.attr('data-src') || 
                   img.attr('data-lazy-src') || 
                   img.attr('data-original') || 
                   img.attr('src');
        
        if (imageUrl && imageUrl.startsWith('data:')) {
          const srcset = img.attr('srcset');
          if (srcset) {
            const firstUrl = srcset.split(',')[0]?.trim()?.split(' ')[0];
            if (firstUrl && !firstUrl.startsWith('data:')) {
              imageUrl = firstUrl;
            }
          }
        }
      }

      if (imageUrl && imageUrl.startsWith('data:')) {
        imageUrl = '';
      }

      let link = element.attr('href') || element.selectFirst('a')?.attr('href') || '';

      if (link && !link.includes('javascript:') && !link.includes('/usuarios/login') && !link.includes('#')) {
        const absoluteLink = this.toAbsoluteUrl(link);
        const absoluteImage = this.toAbsoluteUrl(imageUrl);
        
        if (!seenLinks.has(absoluteLink) && absoluteImage && absoluteLink) {
          seenLinks.add(absoluteLink);
          list.push({
            name: name.trim(),
            imageUrl: absoluteImage,
            link: absoluteLink
          });
        }
      }
    }

    // Fallback
    if (list.length === 0) {
      console.warn('[LeerMangaEsp] ⚠️ No se encontraron mangas. Intentando método alternativo...');
      const updateItems = doc.select('.list-update .item, .update_item, .manga-posts .item');
      for (const item of updateItems) {
        const link = item.selectFirst('a[href*="/manga/"], a[href*="/series/"]');
        if (!link) continue;
        const href = link.attr('href');
        const img = item.selectFirst('img');
        let imageUrl = img?.attr('data-src') || img?.attr('data-lazy-src') || img?.attr('src') || '';
        if (imageUrl && imageUrl.startsWith('data:')) {
          const srcset = img?.attr('srcset');
          if (srcset) {
            const firstUrl = srcset.split(',')[0]?.trim()?.split(' ')[0];
            if (firstUrl && !firstUrl.startsWith('data:')) imageUrl = firstUrl;
          }
        }
        if (imageUrl && !imageUrl.startsWith('data:')) {
          const name = img?.attr('alt') || link.text?.trim() || 'Sin título';
          const absoluteLink = this.toAbsoluteUrl(href);
          const absoluteImage = this.toAbsoluteUrl(imageUrl);
          if (!seenLinks.has(absoluteLink)) {
            seenLinks.add(absoluteLink);
            list.push({
              name: name.trim(),
              imageUrl: absoluteImage,
              link: absoluteLink
            });
          }
        }
      }
    }

    const nextLink = doc.selectFirst('a.next.page-numbers, .next, .nav-links .next, a[rel="next"]');
    const hasNextPage = nextLink !== null;

    console.log(`[LeerMangaEsp] ✅ Mangas extraídos: ${list.length}`);
    if (list.length > 0) {
      console.log(`[LeerMangaEsp] 🖼️ Primer manga: ${list[0].name}`);
      console.log(`[LeerMangaEsp] 🔗 Enlace: ${list[0].link}`);
    }

    return { list, hasNextPage };
  }

  // ============================================================
  // 1. POPULARES
  // ============================================================
  
  async getPopular(page) {
    const url = page === 1 ? this.source.baseUrl : `${this.source.baseUrl}/page/${page}/`;
    const res = await new Client().get(url, { headers: this.getHeaders(url) });
    return this.mangaListFromPage(res);
  }

  // ============================================================
  // 2. ÚLTIMAS ACTUALIZACIONES
  // ============================================================
  
  async getLatestUpdates(page) {
    return await this.getPopular(page);
  }

  // ============================================================
  // 3. BÚSQUEDA
  // ============================================================
  
  async search(query, page, filters) {
    if (!query || query.trim() === '') {
      return { list: [], hasNextPage: false };
    }
    const url = `${this.source.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    const res = await new Client().get(url, { headers: this.getHeaders(url) });
    return this.mangaListFromPage(res);
  }

  // ============================================================
  // 4. DETALLES DEL MANGA - CORREGIDO
  // ============================================================
  
  async getDetail(url) {
    if (!url || url.trim() === '') {
      return { name: '', imageUrl: '', description: '', genre: [], chapters: [] };
    }

    const absoluteUrl = this.ensureAbsoluteUrl(url);
    console.log(`[LeerMangaEsp] 📖 Obteniendo detalles de: ${absoluteUrl}`);
    
    try {
      const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
      const doc = new Document(res.body);
      const detail = {};

      // ============================================================
      // TÍTULO
      // ============================================================
      const titleSelectors = ['h1', '.post-title h1', '.entry-title', '.manga-title', '.series-title'];
      for (const sel of titleSelectors) {
        const el = doc.selectFirst(sel);
        if (el && el.text?.trim()) {
          detail.name = el.text.trim();
          break;
        }
      }
      if (!detail.name) detail.name = '';
      console.log(`[LeerMangaEsp] 📝 Título: ${detail.name}`);

      // ============================================================
      // PORTADA
      // ============================================================
      const coverSelectors = ['.manga-cover', '.summary_image img', '.thumb img', '.s-image img', '.cover img', 'img[class*="cover"]'];
      for (const sel of coverSelectors) {
        const img = doc.selectFirst(sel);
        if (img) {
          let src = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src') || '';
          if (src && !src.startsWith('data:')) {
            detail.imageUrl = this.toAbsoluteUrl(src);
            break;
          }
        }
      }
      if (!detail.imageUrl) detail.imageUrl = '';

      // ============================================================
      // SINOPSIS
      // ============================================================
      const synopsisEl = doc.selectFirst('#synopsis-text, .synopsis p, .summary__content, .entry-content, .desc, .description, .sinopsis');
      if (synopsisEl) {
        detail.description = synopsisEl.text?.trim() || '';
      } else {
        detail.description = '';
      }

      // ============================================================
      // GÉNEROS
      // ============================================================
      const genreLinks = doc.select('.info-generos .genero-item, .genres-content a, .mgen a, .genres a, .tags a');
      detail.genre = genreLinks.map(el => el.text.trim()).filter(Boolean);
      console.log(`[LeerMangaEsp] 🏷️ Géneros: ${detail.genre.join(', ')}`);

      // ============================================================
      // ESTADO
      // ============================================================
      const statusEl = doc.selectFirst('.info-block .info-value, .summary-content:contains(Estado) + div, .post-status .summary-content, .status, [class*="status"]');
      if (statusEl) {
        const statusText = statusEl.text.trim().toLowerCase();
        const statusMap = {
          'en curso': 0,
          'en emision': 0,
          'publicandose': 0,
          'en publicacion': 0,
          'emision': 0,
          'completado': 1,
          'finalizado': 1,
          'completo': 1,
          'en espera': 2,
          'pausado': 2,
          'cancelado': 3,
          'descontinuado': 3
        };
        detail.status = statusMap[statusText] ?? 5;
      } else {
        detail.status = 5;
      }

      // ============================================================
      // CAPÍTULOS - CORREGIDO: construir URLs con baseUrl directamente
      // ============================================================
      console.log('[LeerMangaEsp] 🔍 Buscando capítulos...');
      
      const chapterCards = doc.select('#chapter-list .chapter-card > a, .chapter-list .chapter-card a, .chapter-scroll .chapter-card a');
      console.log(`[LeerMangaEsp] 📚 Capítulos encontrados con selector principal: ${chapterCards.length}`);
      
      const chapters = [];
      for (const link of chapterCards) {
        const chName = link.selectFirst('.chapter-title')?.text?.trim() || link.text?.trim() || 'Capítulo';
        const chUrl = link.attr('href');
        const dateEl = link.selectFirst('.chapter-date');
        const date = dateEl?.text?.trim() || '';
        
        if (chUrl && !chUrl.includes('javascript:')) {
          // IMPORTANTE: Usar this.source.baseUrl como base, NO absoluteUrl (la carátula)
          const absoluteChUrl = this.toAbsoluteUrl(chUrl, this.source.baseUrl);
          if (absoluteChUrl) {
            console.log(`[LeerMangaEsp] 📖 Capítulo encontrado: ${chName} -> ${absoluteChUrl}`);
            chapters.push({
              name: chName,
              url: absoluteChUrl,  // URL completa al capítulo
              date: date
            });
          }
        }
      }
      
      console.log(`[LeerMangaEsp] 📖 Capítulos extraídos: ${chapters.length}`);

      // Fallback: si no se encontraron capítulos, intentar con selectores alternativos
      if (chapters.length === 0) {
        console.warn('[LeerMangaEsp] ⚠️ No se encontraron capítulos. Intentando alternativas...');
        const altSelectors = [
          '.wp-manga-chapter > a',
          '#chapterlist a',
          '.chbox a',
          '.eph-num a',
          '.chapter-list a',
          '.chapter-item > a',
          'a[href*="/leer-m/"]',
          'a[href*="/capitulo-"]'
        ];
        
        for (const sel of altSelectors) {
          const links = doc.select(sel);
          if (links.length > 0) {
            console.log(`[LeerMangaEsp] 📚 Selector alternativo "${sel}" encontró ${links.length} capítulos`);
            for (const link of links) {
              const chName = link.text?.trim() || 'Capítulo';
              const chUrl = link.attr('href');
              if (chUrl && !chUrl.includes('javascript:')) {
                const absoluteChUrl = this.toAbsoluteUrl(chUrl, this.source.baseUrl);
                if (absoluteChUrl) {
                  chapters.push({
                    name: chName,
                    url: absoluteChUrl,
                    date: ''
                  });
                }
              }
            }
            break;
          }
        }
        console.log(`[LeerMangaEsp] 📖 Capítulos con alternativos: ${chapters.length}`);
      }

      // Invertir para que el más reciente aparezca primero
      chapters.reverse();
      detail.chapters = chapters;

      if (detail.chapters.length > 0) {
        console.log(`[LeerMangaEsp] 📖 Primer capítulo: ${detail.chapters[0].name} - ${detail.chapters[0].url}`);
        console.log(`[LeerMangaEsp] 📖 Último capítulo: ${detail.chapters[detail.chapters.length-1].name} - ${detail.chapters[detail.chapters.length-1].url}`);
      }

      return detail;
    } catch (e) {
      console.error(`[LeerMangaEsp] Error en getDetail:`, e);
      return { name: '', imageUrl: '', description: '', genre: [], chapters: [] };
    }
  }

  // ============================================================
  // 5. LISTA DE PÁGINAS - CORREGIDO CON LOGS ADICIONALES
  // ============================================================
  
  async getPageList(url) {
    console.log(`[LeerMangaEsp] 🖼️ getPageList recibió URL: ${url}`);
    
    if (!url || url.trim() === '') {
      console.warn('[LeerMangaEsp] ⚠️ URL vacía en getPageList');
      return [];
    }

    // Asegurar que la URL es absoluta y apunta al capítulo
    let absoluteUrl = url;
    if (!absoluteUrl.startsWith('http')) {
      absoluteUrl = this.toAbsoluteUrl(absoluteUrl, this.source.baseUrl);
    }
    console.log(`[LeerMangaEsp] 🖼️ URL absoluta para petición: ${absoluteUrl}`);
    
    try {
      const res = await new Client().get(absoluteUrl, { headers: this.getHeaders(absoluteUrl) });
      console.log(`[LeerMangaEsp] 🖼️ Respuesta HTTP: ${res.statusCode}`);
      
      const html = res.body;
      
      const pages = [];
      const seen = new Set();
      
      // ============================================================
      // MÉTODO 1: Buscar en <img> con regex directa
      // ============================================================
      console.log('[LeerMangaEsp] 🔍 Método 1: Buscando en <img>...');
      // Buscar imágenes .webp, .jpg, .png en <img>
      const imgRegex = /<img[^>]+src=["']([^"']+\.(?:webp|jpg|jpeg|png))["']/gi;
      let match;
      let imgCount = 0;
      
      while ((match = imgRegex.exec(html)) !== null) {
        let src = match[1];
        // Filtrar URLs no deseadas
        if (src && 
            src.startsWith('http') && 
            !src.includes('data:') && 
            !src.includes('logo') && 
            !src.includes('icon') && 
            !src.includes('avatar') &&
            !src.includes('favicon') &&
            src.includes('images.leermangaesp.net')) {
          if (!seen.has(src)) {
            seen.add(src);
            pages.push(src);
            imgCount++;
          }
        }
      }
      console.log(`[LeerMangaEsp] 🖼️ Encontradas ${pages.length} imágenes en <img>`);

      // ============================================================
      // MÉTODO 2: Buscar en paginasRutas (script)
      // ============================================================
      if (pages.length === 0) {
        console.log('[LeerMangaEsp] 🔍 Método 2: Buscando en script (paginasRutas)...');
        const b2Match = html.match(/B2_URL\s*:\s*["']([^"']+)["']/);
        const baseUrl = b2Match ? b2Match[1] : 'https://images.leermangaesp.net/file/leermangaesp';
        
        const routesMatch = html.match(/paginasRutas\s*:\s*\[([^\]]+)\]/);
        if (routesMatch) {
          const routeMatches = routesMatch[1].match(/["']([^"']+\.(?:webp|jpg|jpeg|png))["']/g);
          if (routeMatches) {
            for (const route of routeMatches) {
              const cleanRoute = route.replace(/["']/g, '');
              let fullUrl = cleanRoute;
              if (!cleanRoute.startsWith('http')) {
                fullUrl = `${baseUrl}/${cleanRoute}`;
              }
              if (fullUrl && !seen.has(fullUrl)) {
                seen.add(fullUrl);
                pages.push(fullUrl);
              }
            }
            console.log(`[LeerMangaEsp] 🖼️ Encontradas ${pages.length} páginas en script`);
          }
        }
      }

      // ============================================================
      // MÉTODO 3: Buscar en <link rel="preload" as="image">
      // ============================================================
      if (pages.length === 0) {
        console.log('[LeerMangaEsp] 🔍 Método 3: Buscando en preload...');
        const preloadRegex = /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+\.(?:webp|jpg|jpeg|png))["']/gi;
        while ((match = preloadRegex.exec(html)) !== null) {
          let src = match[1];
          if (src && src.startsWith('http') && !src.includes('data:')) {
            if (!seen.has(src)) {
              seen.add(src);
              pages.push(src);
            }
          }
        }
        console.log(`[LeerMangaEsp] 🖼️ Encontradas ${pages.length} imágenes en preload`);
      }

      // ============================================================
      // MÉTODO 4: Generación secuencial (último recurso)
      // ============================================================
      if (pages.length === 0) {
        console.log('[LeerMangaEsp] 🔍 Método 4: Generando secuencialmente...');
        try {
          const sampleMatch = html.match(/https?:\/\/[^"']+\.webp/);
          if (sampleMatch) {
            const sampleUrl = sampleMatch[0];
            const patternMatch = sampleUrl.match(/(.+?)(pagina_|page_)(\d+)(\.\w+)$/);
            if (patternMatch) {
              const basePattern = patternMatch[1] + patternMatch[2];
              const ext = patternMatch[4];
              
              const totalMatch = html.match(/pagina_(\d+)\.webp/g);
              let total = 0;
              if (totalMatch) {
                const numbers = totalMatch.map(m => parseInt(m.match(/\d+/)[0]));
                total = Math.max(...numbers);
              } else {
                const pageCountMatch = html.match(/"total_pages":\s*(\d+)/) || html.match(/Total de páginas:\s*(\d+)/);
                total = pageCountMatch ? parseInt(pageCountMatch[1]) : 20;
              }
              
              console.log(`[LeerMangaEsp] 📊 Generando ${total} páginas...`);
              for (let i = 1; i <= total; i++) {
                const pageNum = String(i).padStart(3, '0');
                const generatedUrl = basePattern + pageNum + ext;
                if (!seen.has(generatedUrl)) {
                  seen.add(generatedUrl);
                  pages.push(generatedUrl);
                }
              }
              console.log(`[LeerMangaEsp] 🖼️ Generadas ${pages.length} páginas secuencialmente`);
            }
          }
        } catch (e) {
          console.warn('[LeerMangaEsp] Error generando secuencial:', e);
        }
      }

      console.log(`[LeerMangaEsp] 🖼️ TOTAL PÁGINAS EXTRAÍDAS: ${pages.length}`);
      if (pages.length > 0) {
        console.log(`[LeerMangaEsp] 🖼️ Primera página: ${pages[0]}`);
        console.log(`[LeerMangaEsp] 🖼️ Última página: ${pages[pages.length - 1]}`);
      } else {
        console.warn('[LeerMangaEsp] ⚠️ No se encontraron páginas. Verifica la estructura.');
        // Fallback universal: buscar cualquier imagen en el HTML
        const anyImgMatch = html.match(/https?:\/\/[^"']+\.(?:webp|jpg|jpeg|png)/gi);
        if (anyImgMatch) {
          for (const src of anyImgMatch) {
            if (!src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
              if (!seen.has(src)) {
                seen.add(src);
                pages.push(src);
              }
            }
          }
          console.log(`[LeerMangaEsp] 🖼️ Encontradas ${pages.length} imágenes con fallback universal`);
        }
      }
      
      return pages;
    } catch (e) {
      console.error(`[LeerMangaEsp] Error en getPageList para URL: ${absoluteUrl}`, e);
      return [];
    }
  }

  // ============================================================
  // 6. FILTROS
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
          { type_name: "SelectOption", name: "Tendencia", value: "trending" },
          { type_name: "SelectOption", name: "Más vistos", value: "views" }
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

  // ============================================================
  // 7. PREFERENCIAS
  // ============================================================
  
  getSourcePreferences() {
    return [
      {
        key: "leermangaesp_pref_domain",
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

  // ============================================================
  // MÉTODOS NO IMPLEMENTADOS
  // ============================================================
  
  async getHtmlContent(name, url) { return ''; }
  async cleanHtmlContent(html) { return html; }
  async getVideoList(url) { return []; }
  
  getPreference(key) {
    return new SharedPreferences().get(key);
  }
}

// ============================================================
// EXPORTACIÓN
// ============================================================

const extension = new DefaultExtension();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = extension;
}
if (typeof globalThis !== 'undefined') {
  globalThis.source = extension;
  globalThis.extension = extension;
}
if (typeof window !== 'undefined') {
  window.source = extension;
  window.extension = extension;
}
