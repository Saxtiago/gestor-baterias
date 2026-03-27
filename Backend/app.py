
import os
import re
import unicodedata
import uuid
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from azure.data.tables import TableServiceClient, UpdateMode
from azure.core.exceptions import ResourceNotFoundError

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

TABLE_NAME = os.getenv('AZURE_TABLE_NAME', 'baterias')
STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', '').strip()
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


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "ok": True,
        "service": "gestor-baterias-api"
    }), 200


def redirect_to_frontend_or_api(path: str = ''):
    if FRONTEND_BASE_URL:
        return redirect(f"{FRONTEND_BASE_URL.rstrip('/')}{path}", code=302)

    return jsonify({
        "ok": True,
        "message": "Backend API activo. Esta URL ya no sirve la interfaz web.",
        "api": {
            "health": "/api/health",
            "baterias": "/api/baterias"
        }
    }), 200

@app.route('/')
def index():
    return redirect_to_frontend_or_api()

@app.route('/gestion_baterias')
def gestion_baterias():
    return redirect_to_frontend_or_api('/modulos/baterias')

@app.route('/agregar')
def agregar():
    return redirect_to_frontend_or_api('/modulos/baterias/agregar')


@app.route('/editar')
def editar():
    return redirect_to_frontend_or_api('/modulos/baterias/editar')

@app.route('/eliminar')
def eliminar():
    return redirect_to_frontend_or_api('/modulos/baterias/eliminar')
    
@app.route('/api/baterias', methods=['GET'])
def listar_baterias():
    try:
        table_client = get_table_client()
        include_all = request.args.get('all', '').strip().lower() in {'1', 'true', 'yes'}
        if include_all:
            entities = table_client.list_entities()
        else:
            entities = table_client.query_entities(
                f"PartitionKey eq '{PARTITION_KEY}'"
            )
        data = [record_from_entity(entity) for entity in entities]
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar los registros: {str(e)}"}), 500


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