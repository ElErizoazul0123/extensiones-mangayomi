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
| Niadd | 🇪🇸 Español | 0.2 | [es.niadd.com](https://es.niadd.com) | Manga general | ✅ Activa |
| **VerManhwa** | 🇪🇸 Español | **0.3** | [vermanhwa.com](https://vermanhwa.com) | **Manhwa +18** 🔞 | ✅ Activa |
| **YupManga** | 🇪🇸 Español | **0.1** | [yupmanga.com](https://yupmanga.com) | Manga general | 🚧 En desarrollo |

### 🎯 Características destacadas

**LectorOtaku** (v0.1):
- 🔄 Sistema híbrido: API + HTML fallback
- 📱 Soporte para manga, manhwa y novelas
- ⚡ Carga rápida de capítulos
- 🔍 Búsqueda optimizada

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

# Estructura del proyecto
extensiones-mangayomi/
├── index.json          # Configuración principal
├── icon.png            # Icono del repositorio
├── lectorotaku.js      # Extensión LectorOtaku
├── leermangaesp.js     # Extensión LeerMangaEsp
├── niadd.js            # Extensión Niadd
├── vermanhwa.js        # Extensión VerManhwa
├── yupmanga.js         # Extensión YupManga (WIP)
└── README.md           # Esta documentación

🐛 Soporte

    Si encuentras un error, abre un issue en este repositorio

    Si quieres contribuir, haz un fork y envía un pull request

    Para dudas o sugerencias, contacta a través de GitHub

Versión	Fecha	Extensión	Cambios
0.1	2026-07-13	LectorOtaku	✨ Lanzamiento inicial — API + HTML fallback, soporte para manga, manhwa y novelas
0.1	2026-07-13	YupManga	🚧 Estructura inicial (en desarrollo)
0.3	2026-06-29	VerManhwa	✨ Lanzamiento inicial — lista, detalle y lectura de capítulos (Modo List Style)
0.2	2026-06-29	Niadd	✨ Lanzamiento inicial — lista, detalle y lectura de capítulos
0.2	2026-06-28	LeerMangaEsp	✨ Lanzamiento inicial

📜 Licencia

Este proyecto está bajo la licencia Apache 2.0.

Puedes usar, copiar, modificar y distribuir este software libremente, incluso en proyectos comerciales, siempre que incluyas el aviso de copyright y la licencia originales.
text

Copyright 2026 ElErizoazul0123

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

🙏 Agradecimientos

    A la comunidad de Mangayomi por su increíble trabajo

    A los desarrolladores que comparten su conocimiento

    A todos los que contribuyen al mundo del código abierto

    A la comunidad hispanohablante por su apoyo