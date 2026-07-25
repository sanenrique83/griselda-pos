#!/usr/bin/env python3
"""
Servidor de impresión para Griselda POS
Raspberry Pi — Flask 5000 → impresora TCP 192.168.1.100:9100
Sin dependencia de python-escpos: usa socket puro.
"""

from flask import Flask, request, jsonify, make_response
from datetime import datetime
import socket
import os

app = Flask(__name__)

PRINTER_HOST = os.environ.get('PRINTER_HOST', '192.168.1.100')
PRINTER_PORT = int(os.environ.get('PRINTER_PORT', 9100))


def send_to_printer(data: bytes):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(5)
        s.connect((PRINTER_HOST, PRINTER_PORT))
        s.sendall(data)


# ── CORS ───────────────────────────────────────────────────────────────────────
CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

@app.after_request
def add_cors(response):
    for k, v in CORS_HEADERS.items():
        response.headers[k] = v
    return response

@app.route('/print', methods=['OPTIONS'])
def print_preflight():
    r = make_response('', 204)
    for k, v in CORS_HEADERS.items():
        r.headers[k] = v
    return r


# ── Comandos ESC/POS raw ───────────────────────────────────────────────────────
ESC = b'\x1b'
GS  = b'\x1d'

CMD_RESET        = ESC + b'@'
CMD_BOLD_ON      = ESC + b'E\x01'
CMD_BOLD_OFF     = ESC + b'E\x00'
CMD_ALIGN_CENTER = ESC + b'a\x01'
CMD_ALIGN_LEFT   = ESC + b'a\x00'
CMD_FONT_DOUBLE  = ESC + b'!\x28'  # doble alto + doble ancho — nombre del producto
CMD_FONT_MEDIO   = ESC + b'!\x18'  # solo doble ancho — modificadores (mas grueso/legible, sin alargarse en vertical)
CMD_FONT_NORMAL  = ESC + b'!\x00'
CMD_CUT          = GS  + b'V\x41\x03'
CMD_LF           = b'\n'
COL              = 32


def _encode(text: str) -> bytes:
    return text.encode('latin-1', errors='replace')


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fmt_fecha() -> str:
    return datetime.now().strftime('%d/%m/%Y %H:%M')


def _fmt_fecha_cocina() -> str:
    # Estilo "25/7/26, 1:50 p.m." — sin ceros a la izquierda en día/mes/hora
    ahora = datetime.now()
    dia   = ahora.day
    mes   = ahora.month
    anio  = ahora.strftime('%y')
    hora12 = ahora.strftime('%I').lstrip('0') or '12'
    minuto = ahora.strftime('%M')
    ampm   = ahora.strftime('%p').lower().replace('am', 'a.m.').replace('pm', 'p.m.')
    return f'{dia}/{mes}/{anio}, {hora12}:{minuto} {ampm}'


def _encabezado_cliente(config: dict, mesa: str, subtitulo: str = '') -> bytes:
    nombre    = config.get('nombre', 'La Menuderia')
    direccion = config.get('direccion', '').strip()
    telefono  = config.get('telefono', '').strip()
    rfc       = config.get('rfc', '').strip()
    linea1    = config.get('linea1', '').strip()
    linea2    = config.get('linea2', '').strip()

    b = b''
    b += CMD_RESET + CMD_ALIGN_CENTER
    b += _encode('=' * COL) + CMD_LF
    b += CMD_BOLD_ON + CMD_FONT_DOUBLE
    b += _encode(nombre) + CMD_LF
    b += CMD_FONT_NORMAL + CMD_BOLD_OFF
    for campo in [direccion, telefono, rfc, linea1, linea2]:
        if campo:
            b += _encode(campo) + CMD_LF
    b += _encode(f'{mesa}  \u2014  {_fmt_fecha()}') + CMD_LF
    if subtitulo:
        b += CMD_LF + CMD_BOLD_ON + _encode(subtitulo) + CMD_BOLD_OFF + CMD_LF
    b += _encode('=' * COL) + CMD_LF
    b += CMD_ALIGN_LEFT
    return b


def _pie_cliente(config: dict, con_corte: bool = True) -> bytes:
    pie  = config.get('pie', 'Gracias por su visita!').strip()
    pie2 = config.get('pie2', '').strip()

    b = b''
    b += CMD_ALIGN_CENTER
    b += _encode('=' * COL) + CMD_LF
    b += CMD_LF * 4
    b += CMD_BOLD_ON + _encode(pie) + CMD_BOLD_OFF + CMD_LF
    if pie2:
        b += _encode(pie2) + CMD_LF
    b += CMD_LF * 4
    b += CMD_ALIGN_LEFT
    if con_corte:
        b += CMD_CUT
    return b


def _item_cliente(nombre: str, cantidad: int, precio_unit: float, modificadores: list = None) -> bytes:
    linea     = f'{cantidad}x {nombre}'
    monto_str = f'${precio_unit * cantidad:.2f}'
    espacios  = COL - len(linea) - len(monto_str)
    b = _encode(linea + ' ' * max(1, espacios) + monto_str) + CMD_LF
    for mod in (modificadores or []):
        b += _encode(f'  + {mod}') + CMD_LF
    return b


def _fila(label: str, valor: str, bold: bool = False, doble: bool = False) -> bytes:
    b = b''
    if doble: b += CMD_FONT_DOUBLE
    if bold:  b += CMD_BOLD_ON
    espacios = COL - len(label) - len(valor)
    b += _encode(label + ' ' * max(1, espacios) + valor) + CMD_LF
    if bold:  b += CMD_BOLD_OFF
    if doble: b += CMD_FONT_NORMAL
    return b


# ── Ticket cocina ──────────────────────────────────────────────────────────────

def _encabezado_cocina(titulo: str, orden: str, mesa: str, mesero: str,
                        rol: str, tipo_mesa: str, reimpresion: bool = False) -> bytes:
    """Cabecera con jerarquia tipo Loyverse: folio, mesa grande, fecha/hora,
    mesero+rol, y tipo de servicio (Comer dentro / Para llevar)."""
    b = CMD_RESET + CMD_ALIGN_CENTER
    b += _encode('=' * COL) + CMD_LF
    if reimpresion:
        b += CMD_BOLD_ON + _encode('*** REIMPRESION ***') + CMD_BOLD_OFF + CMD_LF
    b += CMD_BOLD_ON + _encode(f'*** {titulo} ***') + CMD_BOLD_OFF + CMD_LF
    if orden:
        b += _encode(f'#{orden}') + CMD_LF
    b += CMD_LF
    b += CMD_BOLD_ON + CMD_FONT_DOUBLE
    b += _encode('PARA LLEVAR' if tipo_mesa == 'llevar' else mesa) + CMD_LF
    b += CMD_FONT_NORMAL + CMD_BOLD_OFF
    b += CMD_LF
    b += _encode(_fmt_fecha_cocina()) + CMD_LF
    rol_txt = rol.capitalize() if rol else ''
    quien   = f'{mesero}{", " + rol_txt if rol_txt else ""}' if mesero else rol_txt
    if quien:
        b += _encode(quien) + CMD_LF
    b += CMD_LF
    b += CMD_ALIGN_LEFT + _encode('- ' * (COL // 2)) + CMD_LF
    b += CMD_ALIGN_CENTER + CMD_BOLD_ON
    b += _encode('Comer dentro' if tipo_mesa != 'llevar' else 'PARA LLEVAR') + CMD_LF
    b += CMD_BOLD_OFF + CMD_ALIGN_LEFT + _encode('- ' * (COL // 2)) + CMD_LF
    return b


def _seccion_comensal(com: dict, con_encabezado_comensal: bool = True) -> bytes:
    label = com.get('comensal', 'Comensal')
    b = b''
    if con_encabezado_comensal:
        b += CMD_ALIGN_CENTER + CMD_BOLD_ON
        b += _encode(f'=== {label} ===') + CMD_LF
        b += CMD_BOLD_OFF + CMD_ALIGN_LEFT + CMD_LF
    for item in com.get('items', []):
        cantidad = item.get('cantidad', 1)
        nombre   = item.get('nombre', '')
        mods     = item.get('modificadores', [])
        nota     = (item.get('nota', '') or '').strip()
        b += CMD_FONT_DOUBLE + CMD_BOLD_ON
        b += _encode(f'{cantidad} x {nombre}') + CMD_LF
        b += CMD_BOLD_OFF + CMD_FONT_NORMAL
        b += CMD_FONT_MEDIO
        for mod in mods:
            b += _encode(f'  + {mod}') + CMD_LF
        if nota:
            b += _encode(f'  * {nota}') + CMD_LF
        b += CMD_FONT_NORMAL
        b += CMD_LF
    b += _encode('-' * COL) + CMD_LF
    return b


def _build_cocina(payload: dict) -> bytes:
    mesa        = payload.get('mesa', '')
    mesero      = payload.get('mesero', '')
    orden       = payload.get('orden', '')
    rol         = payload.get('rol', '')
    tipo_mesa   = payload.get('tipoMesa', 'mesa')
    comensales  = payload.get('comensales', [])
    reimpresion = bool(payload.get('reimpresion', False))

    # Un solo comensal sin nota real (nombre "Comensal 1" por defecto) → no repetir
    # la etiqueta "=== Comensal N ===" si solo hay una comanda, para no alargar
    # el ticket con una jerarquia que no aporta.
    mostrar_encabezado_comensal = len(comensales) > 1

    comensales_comida = []
    comensales_bebida = []
    for com in comensales:
        items_comida = [i for i in com.get('items', []) if not i.get('esBebida', False)]
        items_bebida = [i for i in com.get('items', []) if i.get('esBebida', False)]
        if items_comida:
            comensales_comida.append({**com, 'items': items_comida})
        if items_bebida:
            comensales_bebida.append({**com, 'items': items_bebida})

    b = b''

    if comensales_comida:
        b += _encabezado_cocina('Cocina', orden, mesa, mesero, rol, tipo_mesa, reimpresion)
        for com in comensales_comida:
            b += _seccion_comensal(com, mostrar_encabezado_comensal)
        b += CMD_LF * 2
        b += CMD_CUT

    if comensales_bebida:
        b += _encabezado_cocina('Bebidas', orden, mesa, mesero, rol, tipo_mesa, reimpresion)
        for com in comensales_bebida:
            b += _seccion_comensal(com, mostrar_encabezado_comensal)
        b += CMD_LF * 2
        b += CMD_CUT

    return b


# ── Ticket cliente ─────────────────────────────────────────────────────────────

def _build_cliente(payload: dict) -> bytes:
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

    b = b''

    # ── PRE-CUENTA ────────────────────────────────────────────────────────────
    if escenario == 'precuenta':
        b += _encabezado_cliente(config, mesa, '** PRE-CUENTA **')
        for item in items:
            b += _item_cliente(
                item.get('nombre', ''), item.get('cantidad', 1),
                float(item.get('precio', 0.0)), item.get('modificadores') or []
            )
        b += _encode('-' * COL) + CMD_LF
        b += _fila('Subtotal', f'${subtotal:.2f}')
        if propina > 0:
            pct = round(propina / subtotal * 100) if subtotal > 0 else 0
            b += _fila(f'Propina sugerida ({pct}%)', f'${propina:.2f}')
        b += _fila('TOTAL', f'${total:.2f}', bold=True, doble=True)
        b += _pie_cliente(config, con_corte=True)
        return b

    # ── GLOBAL ────────────────────────────────────────────────────────────────
    if escenario == 'global':
        b += _encabezado_cliente(config, mesa)
        for item in items:
            b += _item_cliente(
                item.get('nombre', ''), item.get('cantidad', 1),
                float(item.get('precio', 0.0)), item.get('modificadores') or []
            )
        b += _encode('-' * COL) + CMD_LF
        b += _fila('Subtotal', f'${subtotal:.2f}')
        if descuento > 0:
            b += _fila('Descuento', f'-${descuento:.2f}')
        b += _fila('TOTAL', f'${total:.2f}', bold=True, doble=True)
        b += _fila('Metodo', metodo.capitalize())
        if recibido is not None:
            b += _fila('Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            b += _fila('Cambio', f'${float(cambio):.2f}')
        if propina > 0:
            b += _fila('Propina sugerida', f'${propina:.2f}')
        b += _pie_cliente(config)
        return b

    # ── INDIVIDUAL — un ticket por comensal, corte entre cada uno ─────────────
    if escenario == 'individual':
        for com in payload.get('comensales', []):
            com_nombre   = com.get('comensalNombre', '')
            com_items    = com.get('items', [])
            com_subtotal = float(com.get('subtotal', 0.0))
            com_total    = float(com.get('total', 0.0))
            com_metodo   = com.get('metodo', '')
            com_recibido = com.get('recibido')
            com_cambio   = com.get('cambio')
            subtitulo    = f'COMENSAL: {com_nombre}' if com_nombre else ''

            b += _encabezado_cliente(config, mesa, subtitulo)
            for item in com_items:
                b += _item_cliente(
                    item.get('nombre', ''), item.get('cantidad', 1),
                    float(item.get('precio', 0.0)), item.get('modificadores') or []
                )
            b += _encode('-' * COL) + CMD_LF
            b += _fila('Subtotal', f'${com_subtotal:.2f}')
            if propina > 0:
                pct = round(propina / subtotal * 100) if subtotal > 0 else 0
                b += _fila(f'Propina sugerida ({pct}%)', f'${propina:.2f}')
            b += _fila('TOTAL', f'${com_total:.2f}', bold=True, doble=True)
            if com_metodo:
                b += _fila('Metodo', com_metodo.capitalize())
            if com_recibido is not None:
                b += _fila('Recibido', f'${float(com_recibido):.2f}')
            if com_cambio is not None:
                b += _fila('Cambio', f'${float(com_cambio):.2f}')
            b += _pie_cliente(config, con_corte=True)
        return b

    # ── VARIOS ────────────────────────────────────────────────────────────────
    if escenario == 'varios':
        nombres = payload.get('comensalesSeleccionados', [])
        b += _encabezado_cliente(config, mesa)
        if nombres:
            b += _encode(' + '.join(nombres)) + CMD_LF
        b += _encode('-' * COL) + CMD_LF
        for item in items:
            b += _item_cliente(
                item.get('nombre', ''), item.get('cantidad', 1),
                float(item.get('precio', 0.0)), item.get('modificadores') or []
            )
        b += _encode('-' * COL) + CMD_LF
        b += _fila('Subtotal', f'${subtotal:.2f}')
        if propina > 0:
            pct = round(propina / subtotal * 100) if subtotal > 0 else 0
            b += _fila(f'Propina sugerida ({pct}%)', f'${propina:.2f}')
        b += _fila('TOTAL', f'${total:.2f}', bold=True, doble=True)
        b += _fila('Metodo', metodo.capitalize())
        if recibido is not None:
            b += _fila('Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            b += _fila('Cambio', f'${float(cambio):.2f}')
        b += _pie_cliente(config)
        return b

    # ── DIVIDIR ───────────────────────────────────────────────────────────────
    if escenario == 'dividir':
        parte_actual = int(payload.get('parteActual', 1))
        total_partes = int(payload.get('totalPartes', 1))
        por_parte    = round(total / total_partes, 2) if total_partes > 0 else total

        b += _encabezado_cliente(config, mesa)
        b += CMD_ALIGN_CENTER + CMD_BOLD_ON + _encode('PAGO DIVIDIDO') + CMD_LF
        b += CMD_BOLD_OFF + _encode(f'Parte {parte_actual} de {total_partes}') + CMD_LF
        b += CMD_ALIGN_LEFT + _encode('-' * COL) + CMD_LF
        b += _fila('Subtotal total', f'${round(por_parte * total_partes, 2):.2f}')
        b += _fila('Por parte', f'${por_parte:.2f}')
        b += _fila('TOTAL', f'${total:.2f}', bold=True, doble=True)
        b += _fila('Metodo', metodo.capitalize())
        if recibido is not None:
            b += _fila('Recibido', f'${float(recibido):.2f}')
        if cambio is not None:
            b += _fila('Cambio', f'${float(cambio):.2f}')
        b += _pie_cliente(config)
        return b

    # Fallback global
    return _build_cliente({**payload, 'escenario': 'global'})


# ── Endpoint ───────────────────────────────────────────────────────────────────

@app.route('/print', methods=['POST'])
def print_ticket():
    data = request.get_json(force=True, silent=True)
    if not data:
        return make_response(jsonify({'error': 'JSON invalido'}), 400)

    tipo = data.get('tipo')
    if tipo not in ('cocina', 'cliente'):
        return make_response(jsonify({'error': f'tipo desconocido: {tipo}'}), 400)

    try:
        if tipo == 'cocina':
            raw = _build_cocina(data)
        else:
            raw = _build_cliente(data)

        send_to_printer(raw)
        return make_response(jsonify({'ok': True}), 200)

    except Exception as exc:
        app.logger.error('Error de impresion: %s', exc)
        return make_response(jsonify({'error': str(exc)}), 500)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)