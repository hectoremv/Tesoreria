TESORERÍA JUNTA — v3.1 FIX

CORRECCIÓN IMPORTANTE
La v3 tenía un error de sintaxis en app.js y además el Service Worker podía seguir entregando app.js de la v2.
Eso explica que se vieran las pestañas nuevas pero el informe viejo, y que acciones como guardar miembros no funcionaran.

v3.1:
- Corrige la sintaxis JavaScript.
- Cambia el caché del Service Worker.
- Versiona app.js y styles.css para forzar la descarga de los archivos nuevos.
- Conserva la migración automática desde juntaTreasury_v1 (v2/localStorage) hacia IndexedDB.
- NO borres datos del navegador ni desinstales la PWA antes de comprobar la migración.

ACTUALIZACIÓN
1. Reemplaza TODOS los archivos del repositorio por los de este ZIP.
2. Haz Commit changes.
3. Espera a que GitHub Pages termine de publicar.
4. Abre la URL del sitio en Chrome.
5. Recarga. Si todavía aparece la anterior, cierra completamente Chrome y vuelve a abrir la URL.
6. Verifica Miembros, Actividades y Movimientos.
7. Crea inmediatamente un respaldo desde Configuración.
