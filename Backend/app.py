
import os
import re
import unicodedata
import uuid
from datetime import date, datetime
from calendar import monthrange
from typing import Dict, Optional
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from azure.data.tables import TableServiceClient, UpdateMode
from azure.core.exceptions import ResourceNotFoundError

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

TABLE_NAME = os.getenv('AZURE_TABLE_NAME', 'baterias')
STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
PARTITION_KEY = 'baterias'

COLUMNAS = [
    'COD',
    'Negocio',
    'UPS Marca',
    'Modelo',
    'Capacidad',
    'Serial',
    'Inventario No',
    'FECHA DE INSTALACION',
    'REFERENCIA',
    'CANTIDAD',
    'FECHA DE VENCIMIENTO',
    'ESTADO',
    'DIAS VENCIDOS',
    'AÑOS/ MESES/ DIAS',
]


def normalize_key(value: str) -> str:
    normalized = unicodedata.normalize('NFD', value)
    normalized = ''.join(
        ch for ch in normalized if unicodedata.category(ch) != 'Mn'
    )
    normalized = normalized.lower()
    normalized = re.sub(r'[^a-z0-9]+', '_', normalized)
    return normalized.strip('_')


COLUMN_KEY_MAP = {col: normalize_key(col) for col in COLUMNAS}


def get_table_client():
    if not STORAGE_CONNECTION_STRING:
        raise ValueError('AZURE_STORAGE_CONNECTION_STRING no esta configurado.')

    service = TableServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
    service.create_table_if_not_exists(TABLE_NAME)
    return service.get_table_client(TABLE_NAME)


def normalize_payload_value(value):
    if value is None:
        return ""
    return str(value)


def build_entity(payload: dict, row_key: str) -> dict:
    entity = {'PartitionKey': PARTITION_KEY, 'RowKey': row_key}
    for col in COLUMNAS:
        column_key = COLUMN_KEY_MAP[col]
        entity[column_key] = normalize_payload_value(payload.get(col, ""))
    return entity


def record_from_entity(entity: dict) -> dict:
    record = {col: str(entity.get(COLUMN_KEY_MAP[col], "")) for col in COLUMNAS}
    record['rowId'] = entity.get('RowKey', '')
    return record


def parse_date(value: str) -> Optional[date]:
    if not value:
        return None

    clean = str(value).strip()
    iso_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})', clean)
    if iso_match:
        year, month, day = map(int, iso_match.groups())
        try:
            return date(year, month, day)
        except ValueError:
            return None

    for fmt in ('%d/%m/%Y', '%Y/%m/%d', '%m/%d/%Y'):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None


def add_months(base: date, months: int) -> date:
    month = base.month - 1 + months
    year = base.year + month // 12
    month = month % 12 + 1
    day = min(base.day, monthrange(year, month)[1])
    return date(year, month, day)


def compute_estado(diff_days: int) -> str:
    if diff_days < 0:
        return 'Vencido'
    if diff_days <= 30:
        return 'Por vencer'
    return 'Vigente'


def compute_tiempo_detalle(start: date, end: date) -> str:
    years = end.year - start.year
    months = end.month - start.month
    days = end.day - start.day

    if days < 0:
        prev_month = end.month - 1 or 12
        prev_year = end.year - 1 if end.month == 1 else end.year
        days += monthrange(prev_year, prev_month)[1]
        months -= 1

    if months < 0:
        months += 12
        years -= 1

    return f'{years} AÑOS {months} MESES {days} DIAS'


def build_computed_values(fecha_instalacion_raw: str) -> Dict[str, str]:
    fecha_instalacion = parse_date(fecha_instalacion_raw)
    if not fecha_instalacion:
        return {
            'FECHA DE VENCIMIENTO': '',
            'ESTADO': '',
            'DIAS VENCIDOS': '',
            'AÑOS/ MESES/ DIAS': '',
        }

    fecha_vencimiento = add_months(fecha_instalacion, 36)
    today = date.today()
    diff_days = (fecha_vencimiento - today).days
    start, end = (fecha_vencimiento, today) if fecha_vencimiento < today else (today, fecha_vencimiento)

    return {
        'FECHA DE VENCIMIENTO': fecha_vencimiento.isoformat(),
        'ESTADO': compute_estado(diff_days),
        'DIAS VENCIDOS': str(diff_days),
        'AÑOS/ MESES/ DIAS': compute_tiempo_detalle(start, end),
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gestion_baterias')
def gestion_baterias():
    # Capturamos el nombre del archivo que viene del select (opcional por ahora)
    archivo_seleccionado = request.args.get('archivo')
    
    # IMPORTANTE: Aquí retornamos el HTML de la tabla de gestión
    return render_template('gestion_baterias.html', archivo=archivo_seleccionado)

@app.route('/agregar')
def agregar():
    return render_template('agregar.html')


@app.route('/editar')
def editar():
    return render_template('editar.html')

@app.route('/eliminar')
def eliminar():
    return render_template('eliminar.html')
    
@app.route('/api/baterias', methods=['GET'])
def listar_baterias():
    try:
        table_client = get_table_client()
        entities = table_client.query_entities(
            f"PartitionKey eq '{PARTITION_KEY}'"
        )
        data = [record_from_entity(entity) for entity in entities]
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar los registros: {str(e)}"}), 500


@app.route('/api/baterias/sync', methods=['POST'])
def sincronizar_baterias():
    try:
        table_client = get_table_client()
        entities = list(table_client.query_entities(
            f"PartitionKey eq '{PARTITION_KEY}'"
        ))

        updated_count = 0
        for entity in entities:
            fecha_instalacion = str(entity.get(COLUMN_KEY_MAP['FECHA DE INSTALACION'], '')).strip()
            computed = build_computed_values(fecha_instalacion)

            patch = {
                'PartitionKey': entity['PartitionKey'],
                'RowKey': entity['RowKey'],
            }
            changed = False
            for col_name, value in computed.items():
                key = COLUMN_KEY_MAP[col_name]
                current_value = str(entity.get(key, ''))
                if current_value != value:
                    patch[key] = value
                    changed = True

            if changed:
                table_client.update_entity(patch, mode=UpdateMode.MERGE)
                updated_count += 1

        return jsonify({
            'ok': True,
            'updated': updated_count,
            'total': len(entities),
        }), 200
    except Exception as e:
        return jsonify({"error": f"Error al sincronizar los registros: {str(e)}"}), 500


@app.route('/api/baterias', methods=['POST'])
def crear_bateria():
    try:
        payload = request.get_json(silent=True) or {}
        table_client = get_table_client()

        row_key = uuid.uuid4().hex
        entity = build_entity(payload, row_key)
        table_client.create_entity(entity)
        return jsonify({"ok": True, "rowId": row_key}), 201
    except Exception as e:
        return jsonify({"error": f"Error al guardar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<row_id>', methods=['PUT'])
def actualizar_bateria(row_id: str):
    try:
        payload = request.get_json(silent=True) or {}
        table_client = get_table_client()

        try:
            table_client.get_entity(PARTITION_KEY, row_id)
        except ResourceNotFoundError:
            return jsonify({"error": "Registro no encontrado"}), 404

        entity = build_entity(payload, row_id)
        table_client.update_entity(entity, mode=UpdateMode.REPLACE)
        return jsonify({"ok": True, "mensaje": "Registro actualizado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al actualizar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<row_id>', methods=['DELETE'])
def eliminar_bateria(row_id: str):
    try:
        table_client = get_table_client()

        try:
            table_client.get_entity(PARTITION_KEY, row_id)
        except ResourceNotFoundError:
            return jsonify({"error": "Registro no encontrado"}), 404

        table_client.delete_entity(PARTITION_KEY, row_id)
        return jsonify({"ok": True, "mensaje": "Registro eliminado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al eliminar el registro: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)