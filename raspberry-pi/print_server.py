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
  "mesa": "Mesa 3",
  "items": [...],
  "subtotal": 120.0,
  "propina": 12.0,
  "total": 132.0,
  "metodo": "efectivo",
  "recibido": 150.0,
  "cambio": 18.0
}
"""

from flask import Flask, request, jsonify
from escpos.printer import Usb, Serial, Network
import os
import sys

app = Flask(__name__)

# ── Configuración de impresora ─────────────────────────────────────────────────
# Ajusta según tu impresora. Ejemplos:
#   USB:     printer = Usb(0x04b8, 0x0202)
#   Serial:  printer = Serial('/dev/ttyUSB0', baudrate=9600)
#   Red:     printer = Network('192.168.1.50')
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


def _encode(text: str) -> bytes:
    return text.encode('latin-1', errors='replace')


def _print_ticket_cocina(p, payload: dict):
    """Imprime un ticket de cocina con separadores por comensal."""
    mesa    = payload.get('mesa', '')
    mesero  = payload.get('mesero', '')
    comensales = payload.get('comensales', [])

    # Filtrar ítems por tipo
    comensales_comida = []
    comensales_bebida = []

    for com in comensales:
        items_comida = [i for i in com.get('items', []) if not i.get('esBebida', False)]
        items_bebida = [i for i in com.get('items', []) if i.get('esBebida', False)]
        if items_comida:
            comensales_comida.append({**com, 'items': items_comida})
        if items_bebida:
            comensales_bebida.append({**com, 'items': items_bebida})

    # ── Ticket principal (comida) ──────────────────────────────────────────────
    if comensales_comida:
        _print_encabezado_cocina(p, mesa, mesero)
        for com in comensales_comida:
            _print_seccion_comensal(p, com)
        p._raw(CMD_CUT)

    # ── Ticket secundario (bebidas) ────────────────────────────────────────────
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
        p._raw(_encode('-' * 32))
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
    p._raw(_encode('-' * 32))
    p._raw(CMD_LF)


def _print_seccion_comensal(p, com: dict):
    label = com.get('comensal', 'Comensal')

    # Separador con nombre del comensal en doble altura
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

        # Producto en doble altura
        p._raw(CMD_FONT_DOUBLE)
        p._raw(CMD_BOLD_ON)
        p._raw(_encode(f'{cantidad}x {nombre}'))
        p._raw(CMD_LF)
        p._raw(CMD_BOLD_OFF)
        p._raw(CMD_FONT_NORMAL)

        # Modificadores en letra normal
        for mod in mods:
            p._raw(_encode(f'   + {mod}'))
            p._raw(CMD_LF)

        # Nota
        if nota.strip():
            p._raw(_encode(f'   * {nota}'))
            p._raw(CMD_LF)

    p._raw(_encode('-' * 32))
    p._raw(CMD_LF)


def _print_ticket_cliente(p, payload: dict):
    """Imprime el ticket de cobro para el cliente."""
    mesa     = payload.get('mesa', '')
    items    = payload.get('items', [])
    subtotal = payload.get('subtotal', 0.0)
    propina  = payload.get('propina', 0.0)
    total    = payload.get('total', 0.0)
    metodo   = payload.get('metodo', '')
    recibido = payload.get('recibido')
    cambio   = payload.get('cambio')

    p._raw(CMD_RESET)
    p._raw(CMD_ALIGN_CENTER)
    p._raw(CMD_BOLD_ON)
    p._raw(CMD_FONT_DOUBLE)
    p._raw(_encode('GRISELDA'))
    p._raw(CMD_LF)
    p._raw(CMD_FONT_NORMAL)
    p._raw(CMD_BOLD_OFF)
    p._raw(_encode(mesa))
    p._raw(CMD_LF)
    p._raw(CMD_ALIGN_LEFT)
    p._raw(_encode('-' * 32))
    p._raw(CMD_LF)

    for item in items:
        nombre   = item.get('nombre', '')
        cantidad = item.get('cantidad', 1)
        precio   = item.get('precio', 0.0)
        linea    = f'{cantidad}x {nombre}'
        monto    = f'${precio * cantidad:.2f}'
        espacios = 32 - len(linea) - len(monto)
        p._raw(_encode(linea + ' ' * max(1, espacios) + monto))
        p._raw(CMD_LF)

    p._raw(_encode('-' * 32))
    p._raw(CMD_LF)

    def _fila(label: str, valor: str):
        espacios = 32 - len(label) - len(valor)
        p._raw(_encode(label + ' ' * max(1, espacios) + valor))
        p._raw(CMD_LF)

    _fila('Subtotal', f'${subtotal:.2f}')
    if propina:
        _fila('Propina', f'${propina:.2f}')
    p._raw(CMD_BOLD_ON)
    _fila('TOTAL', f'${total:.2f}')
    p._raw(CMD_BOLD_OFF)
    _fila('Metodo', metodo.capitalize())
    if recibido is not None:
        _fila('Recibido', f'${recibido:.2f}')
    if cambio is not None:
        _fila('Cambio', f'${cambio:.2f}')

    p._raw(CMD_LF)
    p._raw(CMD_ALIGN_CENTER)
    p._raw(_encode('Gracias por su visita'))
    p._raw(CMD_LF)
    p._raw(CMD_LF)
    p._raw(CMD_CUT)


# ── Endpoint ───────────────────────────────────────────────────────────────────
@app.route('/print', methods=['POST'])
def print_ticket():
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'error': 'JSON inválido'}), 400

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
        app.logger.error('Error de impresión: %s', exc)
        return jsonify({'error': str(exc)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
