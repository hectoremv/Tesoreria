TESORERÍA JUNTA — v3.5

Esta versión fue ajustada usando la estructura REAL del respaldo del 11/08/2026.

- Restaura respaldos con version 3 aunque tengan miembros duplicados.
- Canoniza los miembros ANTES de escribir en IndexedDB.
- Une duplicados por nombre y conserva teléfono/estado.
- Enlaza movimientos a memberId.
- Restaura actividades y movimientos en orden seguro.
- Valida al final cuántos miembros, movimientos y actividades quedaron.
- Si falla, muestra el error exacto en pantalla.
- Los futuros respaldos llevan format, version y schemaVersion.
- Mantiene la ficha completa de miembro.

También se entrega un respaldo REPARADO generado del archivo real.
