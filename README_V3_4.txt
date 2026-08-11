TESORERÍA JUNTA — v3.4 RECOVERY

CORRECCIONES
- El restaurador ahora acepta respaldos actuales v3 y respaldos antiguos v2.
- Un respaldo v2 no necesita el campo "version".
- Convierte automáticamente:
  members -> members
  movements -> transactions
  activities -> activities
  meta -> settings
- Evita duplicar miembros, movimientos o actividades al importar.
- Agrega botón "Recuperar datos de versión anterior".
- Si la lista de miembros está vacía y todavía existe juntaTreasury_v1 en el navegador, intenta recuperarla automáticamente.
- Reconstruye vínculos memberId.
- Puede generar las cuotas del mes después de recuperar miembros.
- Conserva la ficha completa del miembro de v3.3.
- Caché v3.4.

IMPORTANTE
NO borres datos del navegador ni desinstales la PWA antes de intentar la recuperación.

ACTUALIZAR
1. Reemplaza todos los archivos del repositorio por los de este ZIP.
2. Commit changes.
3. Espera GitHub Pages.
4. Abre la URL y recarga.
5. Ve a Miembros.
6. Si siguen vacíos: Config. > Recuperar datos de versión anterior.
7. Si no encuentra datos locales: Config. > Restaurar respaldo y selecciona tu JSON anterior.
8. Una vez recuperados, Exportar respaldo inmediatamente.
