
import os
import re
import unicodedata
import uuid
from typing import Any, Optional
from flask import Flask, jsonify, request, redirect
from flask_cors import CORS
from azure.data.tables import TableServiceClient, UpdateMode
from azure.core.exceptions import ResourceNotFoundError
import openpyxl

app = Flask(__name__)
CORS(app)  # Importante para que Angular pueda consultar al Backend

TABLE_NAME = os.getenv('AZURE_TABLE_NAME', 'baterias')
STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '').strip()
EXCEL_DATA_FILE = os.getenv(
    'EXCEL_DATA_FILE',
    os.path.join(os.path.dirname(__file__), 'data', 'plantilla_baterias.xlsx'),
)
FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', '').strip()
PARTITION_KEY = 'baterias'
ROW_ID_COLUMN = 'rowId'

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


def using_azure_table_storage() -> bool:
    return bool(STORAGE_CONNECTION_STRING)


def ensure_excel_file_exists() -> None:
    if not os.path.exists(EXCEL_DATA_FILE):
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.append([*COLUMNAS, ROW_ID_COLUMN])
        workbook.save(EXCEL_DATA_FILE)


def load_excel_records() -> list[dict[str, str]]:
    ensure_excel_file_exists()

    workbook = openpyxl.load_workbook(EXCEL_DATA_FILE)
    sheet = workbook.active
    headers = [str(cell.value).strip() if cell.value and cell.value is not None else '' for cell in sheet[1]]

    if ROW_ID_COLUMN not in headers:
        headers.append(ROW_ID_COLUMN)
        sheet.cell(row=1, column=len(headers)).value = ROW_ID_COLUMN

    row_id_index = headers.index(ROW_ID_COLUMN)
    rows: list[dict[str, str]] = []
    changed = False

    for row_index in range(2, sheet.max_row + 1):
        row_values: dict[str, str] = {}
        is_empty = True

        for column_index, header in enumerate(headers, start=1):
            cell_value = sheet.cell(row=row_index, column=column_index).value
            normalized = '' if cell_value is None else str(cell_value)
            row_values[header] = normalized
            if normalized.strip():
                is_empty = False

        if is_empty:
            continue

        if not row_values.get(ROW_ID_COLUMN):
            row_values[ROW_ID_COLUMN] = uuid.uuid4().hex
            sheet.cell(row=row_index, column=row_id_index + 1).value = row_values[ROW_ID_COLUMN]
            changed = True

        rows.append(row_values)

    if changed:
        workbook.save(EXCEL_DATA_FILE)

    return rows


def save_excel_records(records: list[dict[str, str]]) -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    headers = [ROW_ID_COLUMN, *COLUMNAS]
    sheet.append(headers)

    for record in records:
        sheet.append([record.get(header, '') for header in headers])

    workbook.save(EXCEL_DATA_FILE)


def build_excel_record(payload: dict, row_key: str) -> dict[str, str]:
    record = {ROW_ID_COLUMN: row_key}
    for col in COLUMNAS:
        record[col] = normalize_payload_value(payload.get(col, ""))
    return record


def find_excel_record_index(records: list[dict[str, str]], row_key: str) -> int:
    for index, record in enumerate(records):
        if record.get(ROW_ID_COLUMN) == row_key:
            return index
    return -1


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


def get_frontend_base_url() -> Optional[str]:
    if FRONTEND_BASE_URL:
        return FRONTEND_BASE_URL.rstrip('/')

    if not using_azure_table_storage():
        return 'http://172.19.72.16:4200'

    return None


def redirect_to_frontend_or_api(path: str = ''):
    frontend_url = get_frontend_base_url()
    if frontend_url:
        return redirect(f"{frontend_url}{path}", code=302)

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
        if using_azure_table_storage():
            table_client = get_table_client()
            include_all = request.args.get('all', '').strip().lower() in {'1', 'true', 'yes'}
            if include_all:
                entities = table_client.list_entities()
            else:
                entities = table_client.query_entities(
                    f"PartitionKey eq '{PARTITION_KEY}'"
                )
            data = [record_from_entity(entity) for entity in entities]
        else:
            data = load_excel_records()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": f"Error al consultar los registros: {str(e)}"}), 500


@app.route('/api/baterias', methods=['POST'])
def crear_bateria():
    try:
        payload = request.get_json(silent=True) or {}
        row_key = uuid.uuid4().hex

        if using_azure_table_storage():
            table_client = get_table_client()
            entity = build_entity(payload, row_key)
            table_client.create_entity(entity)
        else:
            record = build_excel_record(payload, row_key)
            records = load_excel_records()
            records.append(record)
            save_excel_records(records)

        return jsonify({"ok": True, "rowId": row_key}), 201
    except Exception as e:
        return jsonify({"error": f"Error al guardar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<row_id>', methods=['PUT'])
def actualizar_bateria(row_id: str):
    try:
        payload = request.get_json(silent=True) or {}

        if using_azure_table_storage():
            table_client = get_table_client()
            try:
                table_client.get_entity(PARTITION_KEY, row_id)
            except ResourceNotFoundError:
                return jsonify({"error": "Registro no encontrado"}), 404

            entity = build_entity(payload, row_id)
            table_client.update_entity(entity, mode=UpdateMode.REPLACE)
        else:
            records = load_excel_records()
            index = find_excel_record_index(records, row_id)
            if index == -1:
                return jsonify({"error": "Registro no encontrado"}), 404
            records[index] = build_excel_record(payload, row_id)
            save_excel_records(records)

        return jsonify({"ok": True, "mensaje": "Registro actualizado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al actualizar el registro: {str(e)}"}), 500


@app.route('/api/baterias/<row_id>', methods=['DELETE'])
def eliminar_bateria(row_id: str):
    try:
        if using_azure_table_storage():
            table_client = get_table_client()

            try:
                table_client.get_entity(PARTITION_KEY, row_id)
            except ResourceNotFoundError:
                return jsonify({"error": "Registro no encontrado"}), 404

            table_client.delete_entity(PARTITION_KEY, row_id)
        else:
            records = load_excel_records()
            index = find_excel_record_index(records, row_id)
            if index == -1:
                return jsonify({"error": "Registro no encontrado"}), 404
            records.pop(index)
            save_excel_records(records)

        return jsonify({"ok": True, "mensaje": "Registro eliminado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al eliminar el registro: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT', '8500')))