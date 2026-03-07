#!/usr/bin/env python3
"""
Servidor de impresión para Griselda POS
Raspberry Pi — Flask 5000/print

Payload cocina esperado:
{
  "tipo": "cocina",
  "mesa": "Mesa 3",
  "mesero": "Ana",
  "comensales": [
    {
      "comensal": "Comensal 1",
      "items": [
        {
          "cantidad": 2,
          "nombre": "Tacos de pastor",
          "modificadores": ["Sin cebolla"],
          "nota": "bien dorado",
          "esBebida": false
        }
      ]
    }
  ]
}

Payload cliente esperado:
{
  "tipo": "cliente",
  "escenario": "global" | "individual" | "varios" | "dividir" | "precuenta",
  "mesa": "Mesa 3",
  "items": [{"nombre": "Tacos", "cantidad": 2, "precio": 60.0}],
  "subtotal": 120.0,
  "descuento": 0.0,
  "propina": 12.0,
  "total": 132.0,
  "metodo": "Efectivo",
  "recibido": 150.0,
  "cambio": 18.0,
  "config": {
    "nombre": "La Menuderia",
    "direccion": "Calle 123",
    "telefono": "55 1234-5678",
    "rfc": "",
    "linea1": "",
    "linea2": "",
    "pie": "Gracias por su visita!",
    "pie2": ""
  },
  "comensalNombre": "Comensal 1",
  "comensalesSeleccionados": ["Comensal 1", "Comensal 3"],
  "parteActual": 1,
  "totalPartes": 4
}
"""

from flask import Flask, request, jsonify
from escpos.printer import Usb, Serial, Network
from datetime import datetime
import os

app = Flask(__name__)

# ── Configuración de impresora ─────────────────────────────────────────────────
PRINTER_TYPE = os.environ.get('PRINTER_TYPE', 'usb')
PRINTER_HOST = os.environ.get('PRINTER_HOST', '192.168.1.50')
PRINTER_PORT = int(os.environ.get('PRINTER_PORT', 9100))
USB_VENDOR   = int(os.environ.get('USB_VENDOR', '0x04b8'), 16)
USB_PRODUCT  = int(os.environ.get('USB_PRODUCT', '0x0202'), 16)


def get_printer():
    if PRINTER_TYPE == 'network':
        return Network(PRINTER_HOST, PRINTER_PORT)
    elif PRINTER_TYPE == 'serial':
        return Serial(PRINTER_HOST, baudrate=9600)
    else:
        return Usb(USB_VENDOR, USB_PRODUCT)


# ── Comandos ESC/POS raw ───────────────────────────────────────────────────────
ESC = b'\x1b'
GS  = b'\x1d'

CMD_RESET        = ESC + b'@'
CMD_BOLD_ON      = ESC + b'E\x01'
CMD_BOLD_OFF     = ESC + b'E\x00'
CMD_ALIGN_CENTER = ESC + b'a\x01'
CMD_ALIGN_LEFT   = ESC + b'a\x00'
CMD_FONT_DOUBLE  = ESC + b'!\x10'   # doble alto
CMD_FONT_NORMAL  = ESC + b'!\x00'
CMD_CUT          = GS  + b'V\x41\x03'
CMD_LF           = b'\n'
COL              = 32  # ancho en caracteres


def _encode(text: str) -> bytes:
    return text.encode('latin-1', errors='replace')


# ── Helpers de ticket de cliente ───────────────────────────────────────────────

def _fmt_fecha() -> str:
    return datetime.now().strftime('%d/%m/%Y %H:%M')


def _print_encabezado_cliente(p, config: dict, mesa: str, subtitulo: str = ''):
    """Encabezado centrado con nombre del negocio y datos del ticket."""
    nombre    = config.get('nombre', 'La Menuderia')
    direccion = config.get('direccion', '').strip()
    telefono  = config.get('telefono', '').strip()
    rfc       = config.get('rfc', '').strip()
    linea1    = config.get('linea1', '').strip()
    linea2    = config.get('linea2', '').strip()

    p._raw(CMD_RESET)
    p._raw(CMD_ALIGN_CENTER)
    p._raw(_encode('=' * COL))
    p._raw(CMD_LF)

    # Nombre en doble altura
    p._raw(CMD_BOLD_ON)
    p._raw(CMD_FONT_DOUBLE)
    p._raw(_encode(nombre))
    p._raw(CMD_LF)
    p._raw(CMD_FONT_NORMAL)
    p._raw(CMD_BOLD_OFF)

    # Datos opcionales
    for campo in [direccion, telefono, rfc, linea1, linea2]:
        if campo:
            p._raw(_encode(campo))
            p._raw(CMD_LF)

    # Mesa — Fecha
    p._raw(_encode(f'{mesa}  \u2014  {_fmt_fecha()}'))
    p._raw(CMD_LF)

    # Subtítulo opcional (PRE-CUENTA, COMENSAL, etc.)
    if subtitulo:
        p._raw(CMD_LF)
        p._raw(CMD_BOLD_ON)
        p._raw(_encode(subtitulo))
        p._raw(CMD_BOLD_OFF)
        p._raw(CMD_LF)

    p._raw(_encode('=' * COL))
    p._raw(CMD_LF)
    p._raw(CMD_ALIGN_LEFT)


def _print_pie_cliente(p, config: dict, con_corte: bool = True):
    """Pie de página con mensaje de despedida."""
    pie  = config.get('pie', 'Gracias por su visita!').strip()
    pie2 = config.get('pie2', '').strip()

    p._raw(CMD_ALIGN_CENTER)
    p._raw(_encode('=' * COL))
    p._raw(CMD_LF)
    for _ in range(4):
        p._raw(CMD_LF)
    p._raw(CMD_BOLD_ON)
    p._raw(_encode(pie))
    p._raw(CMD_BOLD_OFF)
    p._raw(CMD_LF)
    if pie2:
        p._raw(_encode(pie2))
        p._raw(CMD_LF)
    for _ in range(4):
        p._raw(CMD_LF)
    p._raw(CMD_ALIGN_LEFT)

    if con_corte:
        p._raw(CMD_CUT)


def _print_item_cliente(p, nombre: str, cantidad: int, precio_unit: float):
    """Imprime un ítem con precio consolidado alineado a la derecha."""
    linea     = f'{cantidad}x {nombre}'
    monto_str = f'${precio_unit * cantidad:.2f}'
    espacios  = COL - len(linea) - len(monto_str)
    p._raw(_encode(linea + ' ' * max(1, espacios) + monto_str))
    p._raw(CMD_LF)


def _fila(p, label: str, valor: str, bold: bool = False, doble: bool = False):
    if doble:
        p._raw(CMD_FONT_DOUBLE)
    if bold:
        p._raw(CMD_BOLD_ON)
    espacios = COL - len(label) - len(valor)
    p._raw(_encode(label + ' ' * max(1, espacios) + valor))
    p._raw(CMD_LF)
    if bold:
        p._raw(CMD_BOLD_OFF)
    if doble:
        p._raw(CMD_FONT_NORMAL)


# ── Ticket de cocina ───────────────────────────────────────────────────────────

def _print_ticket_cocina(p, payload: dict):
    """Imprime un ticket de cocina con separadores por comensal."""
    mesa       = payload.get('mesa', '')
    mesero     = payload.get('mesero', '')
    comensales = payload.get('comensales', [])

    comensales_comida = []
    comensales_bebida = []

    for com in comensales:
        items_comida = [i for i in com.get('items', []) if not i.get('esBebida', False)]
        items_bebida = [i for i in com.get('items', []) if i.get('esBebida', False)]
        if items_comida:
            comensales_comida.append({**com, 'items': items_comida})
        if items_bebida:
            comensales_bebida.append({**com, 'items': items_bebida})

    if comensales_comida:
        _print_encabezado_cocina(p, mesa, mesero)
        for com in comensales_comida:
            _print_seccion_comensal(p, com)
        p._raw(CMD_CUT)

    if comensales_bebida:
        p._raw(CMD_RESET)
        p._raw(CMD_ALIGN_CENTER)
        p._raw(CMD_BOLD_ON)
        p._raw(CMD_FONT_DOUBLE)
        p._raw(_encode('*** BEBIDAS ***'))
        p._raw(CMD_LF)
        p._raw(CMD_FONT_NORMAL)
        p._raw(CMD_BOLD_OFF)
        p._raw(_encode(f'  {mesa}  |  {mesero}'))
        p._raw(CMD_LF)
        p._raw(CMD_ALIGN_LEFT)
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        for com in comensales_bebida:
            _print_seccion_comensal(p, com)
        p._raw(CMD_CUT)


def _print_encabezado_cocina(p, mesa: str, mesero: str):
    p._raw(CMD_RESET)
    p._raw(CMD_ALIGN_CENTER)
    p._raw(CMD_BOLD_ON)
    p._raw(CMD_FONT_DOUBLE)
    p._raw(_encode('COCINA'))
    p._raw(CMD_LF)
    p._raw(CMD_FONT_NORMAL)
    p._raw(CMD_BOLD_OFF)
    p._raw(_encode(f'  {mesa}  |  {mesero}'))
    p._raw(CMD_LF)
    p._raw(CMD_ALIGN_LEFT)
    p._raw(_encode('-' * COL))
    p._raw(CMD_LF)


def _print_seccion_comensal(p, com: dict):
    label = com.get('comensal', 'Comensal')

    p._raw(CMD_ALIGN_CENTER)
    p._raw(CMD_BOLD_ON)
    p._raw(CMD_FONT_DOUBLE)
    p._raw(_encode(f'=== {label} ==='))
    p._raw(CMD_LF)
    p._raw(CMD_FONT_NORMAL)
    p._raw(CMD_BOLD_OFF)
    p._raw(CMD_ALIGN_LEFT)

    for item in com.get('items', []):
        cantidad = item.get('cantidad', 1)
        nombre   = item.get('nombre', '')
        mods     = item.get('modificadores', [])
        nota     = item.get('nota', '') or ''

        p._raw(CMD_FONT_DOUBLE)
        p._raw(CMD_BOLD_ON)
        p._raw(_encode(f'{cantidad}x {nombre}'))
        p._raw(CMD_LF)
        p._raw(CMD_BOLD_OFF)
        p._raw(CMD_FONT_NORMAL)

        for mod in mods:
            p._raw(_encode(f'   + {mod}'))
            p._raw(CMD_LF)

        if nota.strip():
            p._raw(_encode(f'   * {nota}'))
            p._raw(CMD_LF)

    p._raw(_encode('-' * COL))
    p._raw(CMD_LF)


# ── Ticket de cliente ──────────────────────────────────────────────────────────

def _print_ticket_cliente(p, payload: dict):
    """Imprime el ticket de cobro para el cliente según escenario."""
    escenario = payload.get('escenario', 'global')
    mesa      = payload.get('mesa', '')
    items     = payload.get('items', [])
    subtotal  = float(payload.get('subtotal', 0.0))
    descuento = float(payload.get('descuento') or 0.0)
    propina   = float(payload.get('propina', 0.0))
    total     = float(payload.get('total', 0.0))
    metodo    = payload.get('metodo', '')
    recibido  = payload.get('recibido')
    cambio    = payload.get('cambio')
    config    = payload.get('config', {})

    # ── PRE-CUENTA ────────────────────────────────────────────────────────────
    if escenario == 'precuenta':
        _print_encabezado_cliente(p, config, mesa, '** PRE-CUENTA **')
        for item in items:
            _print_item_cliente(p, item.get('nombre', ''), item.get('cantidad', 1), float(item.get('precio', 0.0)))
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        _fila(p, 'Subtotal', f'${subtotal:.2f}')
        _fila(p, 'TOTAL', f'${total:.2f}', bold=True, doble=True)
        if propina > 0:
            pct = round(propina / subtotal * 100) if subtotal > 0 else 0
            _fila(p, f'Propina sugerida ({pct}%)', f'${propina:.2f}')
        _print_pie_cliente(p, config, con_corte=False)
        for _ in range(6):
            p._raw(CMD_LF)
        return

    # ── GLOBAL ────────────────────────────────────────────────────────────────
    if escenario == 'global':
        _print_encabezado_cliente(p, config, mesa)
        for item in items:
            _print_item_cliente(p, item.get('nombre', ''), item.get('cantidad', 1), float(item.get('precio', 0.0)))
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        _fila(p, 'Subtotal', f'${subtotal:.2f}')
        if descuento > 0:
            _fila(p, 'Descuento', f'-${descuento:.2f}')
        _fila(p, 'TOTAL', f'${total:.2f}', bold=True, doble=True)
        _fila(p, 'Metodo', metodo.capitalize())
        if recibido is not None:
            _fila(p, 'Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            _fila(p, 'Cambio', f'${float(cambio):.2f}')
        if propina > 0:
            _fila(p, 'Propina sugerida', f'${propina:.2f}')
        _print_pie_cliente(p, config)
        return

    # ── INDIVIDUAL ────────────────────────────────────────────────────────────
    if escenario == 'individual':
        comensal_nombre = payload.get('comensalNombre', '')
        subtitulo = f'COMENSAL: {comensal_nombre}' if comensal_nombre else ''
        _print_encabezado_cliente(p, config, mesa, subtitulo)
        for item in items:
            _print_item_cliente(p, item.get('nombre', ''), item.get('cantidad', 1), float(item.get('precio', 0.0)))
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        _fila(p, 'Subtotal', f'${subtotal:.2f}')
        _fila(p, 'TOTAL', f'${total:.2f}', bold=True, doble=True)
        _fila(p, 'Metodo', metodo.capitalize())
        _print_pie_cliente(p, config)
        return

    # ── VARIOS ────────────────────────────────────────────────────────────────
    if escenario == 'varios':
        comensales_nombres = payload.get('comensalesSeleccionados', [])
        _print_encabezado_cliente(p, config, mesa)
        if comensales_nombres:
            p._raw(_encode(' + '.join(comensales_nombres)))
            p._raw(CMD_LF)
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        for item in items:
            _print_item_cliente(p, item.get('nombre', ''), item.get('cantidad', 1), float(item.get('precio', 0.0)))
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        _fila(p, 'Subtotal', f'${subtotal:.2f}')
        _fila(p, 'TOTAL', f'${total:.2f}', bold=True, doble=True)
        _fila(p, 'Metodo', metodo.capitalize())
        if recibido is not None:
            _fila(p, 'Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            _fila(p, 'Cambio', f'${float(cambio):.2f}')
        _print_pie_cliente(p, config)
        return

    # ── DIVIDIR ───────────────────────────────────────────────────────────────
    if escenario == 'dividir':
        parte_actual  = int(payload.get('parteActual', 1))
        total_partes  = int(payload.get('totalPartes', 1))
        _print_encabezado_cliente(p, config, mesa)
        p._raw(CMD_ALIGN_CENTER)
        p._raw(CMD_BOLD_ON)
        p._raw(_encode('PAGO DIVIDIDO'))
        p._raw(CMD_LF)
        p._raw(CMD_BOLD_OFF)
        p._raw(_encode(f'Parte {parte_actual} de {total_partes}'))
        p._raw(CMD_LF)
        p._raw(CMD_ALIGN_LEFT)
        p._raw(_encode('-' * COL))
        p._raw(CMD_LF)
        # subtotal_total y por_parte derivados de total y partes
        por_parte      = round(total / parte_actual, 2) if parte_actual > 0 else total
        subtotal_total = round(por_parte * total_partes, 2)
        _fila(p, 'Subtotal total', f'${subtotal_total:.2f}')
        _fila(p, 'Por parte', f'${por_parte:.2f}')
        _fila(p, 'TOTAL', f'${total:.2f}', bold=True, doble=True)
        _fila(p, 'Metodo', metodo.capitalize())
        if recibido is not None:
            _fila(p, 'Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            _fila(p, 'Cambio', f'${float(cambio):.2f}')
        _print_pie_cliente(p, config)
        return

    # Fallback: tratar como global
    _print_ticket_cliente(p, {**payload, 'escenario': 'global'})


# ── Endpoint ───────────────────────────────────────────────────────────────────
@app.route('/print', methods=['POST'])
def print_ticket():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'error': 'JSON invalido'}), 400

    tipo = data.get('tipo')
    if tipo not in ('cocina', 'cliente'):
        return jsonify({'error': f'tipo desconocido: {tipo}'}), 400

    try:
        p = get_printer()
        if tipo == 'cocina':
            _print_ticket_cocina(p, data)
        else:
            _print_ticket_cliente(p, data)
        p.close()
        return jsonify({'ok': True}), 200
    except Exception as exc:
        app.logger.error('Error de impresion: %s', exc)
        return jsonify({'error': str(exc)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
