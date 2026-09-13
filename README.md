# Entreno — instalar como app en el móvil

Cinco ficheros. Todo funciona sin internet una vez instalada.

## Opción A — GitHub Pages (recomendada: icono propio y pantalla completa)

1. Crea un repositorio nuevo en GitHub, por ejemplo `entreno`.
2. Sube estos ficheros a la raíz del repositorio:
   `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. Espera un par de minutos. Tu URL será `https://TU-USUARIO.github.io/entreno/`.
5. Abre esa URL en el móvil y añádela a la pantalla de inicio:
   - **Android (Chrome):** menú ⋮ → *Instalar aplicación* (o *Añadir a pantalla de inicio*).
   - **iPhone (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

Queda con su icono, se abre a pantalla completa sin barra del navegador y funciona en el
gimnasio aunque no haya cobertura.

Por línea de comandos, desde la carpeta con los ficheros:

    git init
    git add .
    git commit -m "App de entreno"
    git branch -M main
    git remote add origin https://github.com/TU-USUARIO/entreno.git
    git push -u origin main

## Opción B — sin hosting, solo el fichero

Copia `index.html` al móvil y ábrelo con Chrome. Puedes añadirlo a la pantalla de inicio,
pero será un acceso directo que abre el navegador, no una app a pantalla completa. Además,
algunos navegadores no permiten guardar datos desde un fichero local: si al abrirlo ves un
aviso rojo, los registros no se guardarán y necesitas la opción A.

## Actualizar la app más adelante

Sube el `index.html` nuevo y cambia en `sw.js` la línea `const CACHE = "entreno-v1"` a
`"entreno-v2"`. Sin ese cambio el móvil seguirá usando la copia guardada de la versión vieja.

## Copias de seguridad

Los registros se guardan solo en el navegador de tu móvil. Usa **Ajustes → Exportar copia**
de vez en cuando, y guarda el fichero .json donde quieras.

## Tests

    npm install jsdom
    APP=index.html node test.js
