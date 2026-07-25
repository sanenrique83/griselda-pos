#!/bin/bash
GREP="grep -rIl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next"

check() {
  local id="$1" desc="$2" pattern="$3"
  if $GREP -e "$pattern" . >/dev/null 2>&1; then
    echo "[x] $id - $desc"
  else
    echo "[ ] $id - $desc  (no se encontró: \"$pattern\")"
  fi
}

echo "=== FASE 2 ==="
check "F2-01" "Ticket de cancelación en cocina"        "PayloadCancelacion"
check "F2-02" "Reimpresión de ticket desde historial"  "reimprimirTicket"
check "F2-03" "Propina efectivo vs tarjeta"             "propina_efectivo"
check "F2-04" "Corte Z diario"                          "generarCorteZ"
check "F2-05" "Reporte de cancelaciones"                "cancelado_por"
check "F2-06" "Inventario simple por piezas"            "tiene_stock"
check "F2-07" "Combos con componentes"                  "combo_componentes"
check "F2-08" "Reapertura de mesa cerrada"              "reabrirPedido"
check "F2-09" "Mapa de mesas drag-and-drop"             "pos_x"
check "F2-10" "Dashboard 12 CSV / pantalla cocina"      "SheetComboComponentes\|/cocina"
check "F2-11" "Backup automático a Google Drive"        "rclone"

echo ""
echo "=== FASE 3 y 4 (solo alcance, no se espera código aún) ==="
echo "F3-01 Facturación CFDI · F3-02 Analítica avanzada · F3-03 QR por mesa"
echo "F3-04 Multi-sucursal · F3-05 Fidelización"
echo "F4-01 PIN mesero · F4-02 Timeout inactividad · F4-03 Cambiar mesero"
