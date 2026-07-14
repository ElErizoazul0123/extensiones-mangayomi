# Extensiones para Mangayomi

> Repositorio de extensiones de código abierto para [Mangayomi](https://github.com/kodjodevf/mangayomi).

---

## 🤖 Sobre este proyecto

Este repositorio forma parte de un proyecto personal para **aprender a crear extensiones para Mangayomi**.

Las extensiones aquí presentes son desarrolladas con asistencia de IA y en ocasiones de forma manual, con la intención de:

- Aprender sobre el ecosistema de Mangayomi
- Compartir conocimiento con la comunidad
- Facilitar el acceso a contenido de calidad

Si estás interesado en crear tus propias extensiones, siéntete libre de usar este código como base o referencia.

---

## 📦 Instalación desde el repositorio

Puedes añadir este repositorio como fuente de extensiones en Mangayomi:

1. Abre Mangayomi
2. Ve a **Ajustes** o **Más** (en la barra inferior)
3. Selecciona **Configuraciones**
4. Toca **Explorar**
5. Ve a **Repositorios de extensiones de manga**
6. Pulsa el botón **"+"** o **"Añadir repositorio"**
7. Introduce la siguiente URL: `https://raw.githubusercontent.com/ElErizoazul0123/extensiones-mangayomi/main/index.json`
8. ¡Listo! Las extensiones aparecerán en la lista de fuentes disponibles

---

## 📚 Extensiones disponibles

| Nombre | Idioma | Versión | Sitio | Contenido | Estado |
|--------|--------|---------|-------|-----------|--------|
| **LectorOtaku** | 🇪🇸 Español | **0.1** | [lectorotaku.com](https://lectorotaku.com) | Manga, Manhwa y Novelas | ✅ Activa |
| LeerMangaEsp | 🇪🇸 Español | 0.2 | [leermangaesp.net](https://leermangaesp.net) | Manga general | ✅ Activa |
| **MangaOni** | 🇪🇸 Español | **1.6.3** | [manga-oni.com](https://manga-oni.com) | Manga, Manhwa, Manhua y Novelas | ✅ Activa |
| Niadd | 🇪🇸 Español | 0.2 | [es.niadd.com](https://es.niadd.com) | Manga general | ✅ Activa |
| **VerManhwa** | 🇪🇸 Español | **0.3** | [vermanhwa.com](https://vermanhwa.com) | **Manhwa +18** 🔞 | ✅ Activa |
| **YupManga** | 🇪🇸 Español | **0.5** | [yupmanga.com](https://yupmanga.com) | Manga general | 🚧 En desarrollo |

### 🎯 Características destacadas

**LectorOtaku** (v0.1):
- 🔄 Sistema híbrido: API + HTML fallback
- 📱 Soporte para manga, manhwa y novelas
- ⚡ Carga rápida de capítulos
- 🔍 Búsqueda optimizada

**MangaOni** (v1.6.3):
- 📖 Soporte para manga, manhwa, manhua y novelas
- 🔐 Manejo de Cloudflare con cookies automáticas
- 🖼️ Decodificación de imágenes en Base64
- 🎨 Modo oscuro automático
- 🔍 Búsqueda optimizada con filtros
- 📚 Sistema de filtros completo (género, estado, tipo, adulto, orden)
- ⚡ Carga de imágenes con lazy loading

**VerManhwa** (v0.3):
- 🔞 Contenido para adultos (+18)
- 🎨 Modo List Style
- 📖 Lectura optimizada para manhwa

---

## 📥 Instalación manual (alternativa)

Si prefieres instalar una extensión específica manualmente:

1. Descarga el archivo `.js` de la extensión que quieras
2. Colócalo en la carpeta de extensiones de Mangayomi
3. Reinicia la app

---

## 🔧 Cómo crear tus propias extensiones

Si quieres aprender a crear extensiones para Mangayomi:

1. Estudia la estructura de este repositorio
2. Revisa el código de las extensiones existentes
3. Consulta la [documentación de Mangayomi](https://github.com/kodjodevf/mangayomi)
4. Analiza extensiones de otros creadores

Todas las extensiones en este repositorio son de **código abierto** y están disponibles para que cualquiera las estudie, modifique y mejore.

---

## 🛠️ Desarrollo local

Si quieres probar cambios localmente:

```bash
# Clonar el repositorio
git clone https://github.com/ElErizoazul0123/extensiones-mangayomi.git

# Navegar al directorio
cd extensiones-mangayomi

# Hacer cambios en los archivos .js
# Probar con Mangayomi en modo desarrollo

📝 Notas importantes

    ⚠️ Algunos sitios pueden tener Cloudflare (como MangaOni), en ese caso puede ser necesario configurar cookies manualmente en los ajustes de la extensión.

    🔞 Las extensiones marcadas con +18 contienen contenido para adultos.

    🚧 Las extensiones en desarrollo pueden tener errores o funcionalidades incompletas.

    📱 Si encuentras algún problema, por favor abre un issue en el repositorio.

🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si deseas ayudar a mejorar este proyecto:

    Haz un fork del repositorio

    Crea una rama para tu feature (git checkout -b feature/mejora)

    Realiza tus cambios

    Haz commit de tus cambios (git commit -m 'Añadir nueva característica')

    Sube tu rama (git push origin feature/mejora)

    Abre un Pull Request

📄 Licencia

Este proyecto está bajo la Licencia MIT. Si utilizas este código, por favor da crédito al autor original.
🙏 Agradecimientos

    Mangayomi por la plataforma

    A los creadores de extensiones que sirvieron como referencia

    A la comunidad por el apoyo y feedback

⭐ Si te gusta este proyecto, no olvides darle una estrella en GitHub!

Los cambios principales:

1. **Nueva entrada**: MangaOni añadido a la tabla con versión 1.6.3
2. **Características destacadas**: Sección completa para MangaOni
3. **Notas importantes**: Mención sobre Cloudflare para MangaOni
4. **Estructura**: Mantenida la misma organización que el README original
5. **Emojis y formato**: Consistentes con el estilo original

El repositorio ahora está completo con:
- `index.json` actualizado con MangaOni
- `README.md` actualizado con la nueva extensión
- El archivo `mangaoni.js` que desarrollamos

