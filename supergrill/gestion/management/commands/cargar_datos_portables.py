import os
import json
from django.conf import settings
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import connection
from gestion.models import (
    Cadete, Direccion, Empresa, Estado, FormaPago,
    Guarnicion, Nombre, TipoMenu, Menu, Pedido, DetallePedido, Registro
)

class Command(BaseCommand):
    help = 'Carga los datos portables de MariaDB a PostgreSQL y resetea las secuencias.'

    def handle(self, *args, **options):
        BASE_DIR = settings.BASE_DIR

        def leer_json(nombre_archivo):
            ruta = os.path.join(BASE_DIR, 'datos_viejos', f'{nombre_archivo}.json')
            if not os.path.exists(ruta):
                ruta = os.path.join(BASE_DIR, f'{nombre_archivo}.json')
            if os.path.exists(ruta):
                with open(ruta, 'r', encoding='utf-8') as f:
                    return json.load(f)
            raise FileNotFoundError(f"No se encontró el archivo '{nombre_archivo}.json' en la ruta: {ruta}")

        self.stdout.write("Cargando Usuarios...")
        for f in leer_json('usuarios'):
            usuario, created = User.objects.update_or_create(id=f['id_usuario'], defaults={'username': f['nombre_usuario']})
            if created:
                usuario.set_password(f['contrasena'])
                usuario.save()

        self.stdout.write("Cargando Cadetes...")
        for f in leer_json('cadetes'):
            Cadete.objects.update_or_create(id=f['id_cadete'], defaults={'cadete': f['cadete'], 'activo': (f['activo'] == 1)})

        self.stdout.write("Cargando Direcciones...")
        for f in leer_json('direcciones'):
            Direccion.objects.update_or_create(id=f['id_direccion'], defaults={'direccion': f['direccion'], 'es_frecuente': (f['es_frecuente'] == 1)})

        self.stdout.write("Cargando Empresas...")
        for f in leer_json('empresas'):
            Empresa.objects.update_or_create(id=f['id_empresa'], defaults={'empresa': f['empresa'], 'es_frecuente': (f['es_frecuente'] == 1)})

        self.stdout.write("Cargando Estados...")
        for f in leer_json('estados'):
            Estado.objects.update_or_create(id=f['id_estado'], defaults={'estado': f['estado']})

        self.stdout.write("Cargando Formas de Pago...")
        for f in leer_json('forma_pago'):
            FormaPago.objects.update_or_create(id=f['id_forma_pago'], defaults={'forma_pago': f['forma_pago'], 'activo': (f['activo'] == 1)})

        self.stdout.write("Cargando Guarniciones...")
        for f in leer_json('guarniciones'):
            Guarnicion.objects.update_or_create(id=f['id_guarnicion'], defaults={'guarnicion': f['guarnicion'], 'activo': (f['activo'] == 1)})

        self.stdout.write("Cargando Nombres...")
        for f in leer_json('nombres'):
            Nombre.objects.update_or_create(id=f['id_nombre'], defaults={'nombre': f['nombre']})

        self.stdout.write("Cargando Registros...")
        for f in leer_json('registros'):
            Registro.objects.update_or_create(id=f['id_registro'], defaults={'registro': f['registro']})

        self.stdout.write("Cargando Tipos de Menú...")
        for f in leer_json('tipo_menu'):
            TipoMenu.objects.update_or_create(id=f['id_tipoMenu'], defaults={'tipoMenu': f['tipoMenu'], 'activo': (f['activo'] == 1)})

        self.stdout.write("Cargando Menús...")
        for f in leer_json('menus'):
            Menu.objects.update_or_create(id=f['id_menu'], defaults={
                'nombre_menu': f['nombre_menu'],
                'tipo_menu_id': f['id_tipoMenu'],
                'guarnicion_id': f['id_guarnicion'],
                'activo': (f['activo'] == 1)
            })

        self.stdout.write("Cargando Pedidos...")
        for f in leer_json('pedidos'):
            pedido, _ = Pedido.objects.update_or_create(id=f['id_pedido'], defaults={
                'direccion_id': f['id_direccion'],
                'empresa_id': f['id_empresa'],
                'cadete_id': f['id_cadete'],
                'usuario_id': f['id_usuario'],
                'forma_pago_id': f['id_forma_pago'],
                'nombre_id': f['id_nombre'],
                'estado_id': f['id_estado'],
                'registro_id': f['id_registro'],
            })
            # fecha usa auto_now_add=True: en la creación, Django ignora
            # cualquier valor pasado y pone la fecha de hoy. Lo forzamos
            # aparte con un UPDATE directo, que sí respeta el valor.
            Pedido.objects.filter(id=pedido.id).update(fecha=f['fecha'])

        self.stdout.write("Cargando Detalles de Pedido...")
        for f in leer_json('detalle_pedido'):
            DetallePedido.objects.update_or_create(id=f['id_detallePedido'], defaults={
                'pedido_id': f['id_pedido'],
                'menu_id': f['id_menu'],
                'cantidad': f['cantidad'],
                'descripcion': f['descripcion']
            })

        # ------------------------------------------------------------
        # Reseteo de secuencias.
        # FIX: la columna de PK real en Postgres es 'id' para todas estas
        # tablas (así se están cargando arriba: id=f['id_cadete'], etc.),
        # no el nombre de la clave del JSON. Antes esto fallaba en
        # silencio porque esas columnas no existen.
        # ------------------------------------------------------------
        self.stdout.write("Actualizando secuencias de PostgreSQL...")

        tablas = [
            'auth_user',
            'gestion_cadete',
            'gestion_direccion',
            'gestion_empresa',
            'gestion_estado',
            'gestion_formapago',
            'gestion_guarnicion',
            'gestion_nombre',
            'gestion_registro',
            'gestion_tipomenu',
            'gestion_menu',
            'gestion_pedido',
            'gestion_detallepedido',
        ]

        with connection.cursor() as cursor:
            for tabla in tablas:
                try:
                    cursor.execute(f"""
                        SELECT setval(pg_get_serial_sequence('{tabla}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {tabla}), 1),
                        (SELECT MAX(id) FROM {tabla}) IS NOT NULL);
                    """)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"No se pudo actualizar secuencia para {tabla}: {e}"))

        self.stdout.write(self.style.SUCCESS("¡Migración y sincronización de secuencias completadas con éxito!"))