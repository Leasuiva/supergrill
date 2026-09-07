from django.shortcuts import render, redirect
from django.http import JsonResponse
import json
import subprocess
from django.views.decorators.csrf import csrf_exempt
from .models import Cadete, Guarnicion, FormaPago, TipoMenu, Menu, Pedido, DetallePedido, Registro, Direccion, Empresa, Nombre, Estado, RegistroDiarioCadete, Monitor
from django.db import transaction
from datetime import date
from django.db.models import Sum, Max


def login_view(request):
    if request.method == 'POST':
        return redirect('carga_pedidos') 
    return render(request, 'gestion/login.html')

def carga_pedidos_view(request):
    # Usamos el nombre exacto de tu archivo
    return render(request, 'gestion/hojaCargaPedidos.html')

def pedidos_cargados_view(request):
    return render(request, 'gestion/pedidosCargados.html')

def archivados_view(request):
    return render(request, 'gestion/archivados.html')


# =================================================================
# NUEVA FUNCIÓN: API PARA LAS SUGERENCIAS (AUTOCOMPLETADO)
# =================================================================
def sugerencias_historial(request, tipo):
    if tipo == 'guarniciones':
        items = Guarnicion.objects.filter(activo=True).values_list('guarnicion', flat=True)
    elif tipo == 'cadetes':
        items = Cadete.objects.filter(activo=True).values_list('cadete', flat=True)
    elif tipo == 'forma_pago':
        items = FormaPago.objects.filter(activo=True).values_list('forma_pago', flat=True)
    else:
        items = []
    
    return JsonResponse(list(items), safe=False)

# =================================================================
# API PARA GUARDAR ÍTEMS DESDE LOS MODALES (CON PASE LIBRE)
# =================================================================

@csrf_exempt # <-- Desactiva el escudo 403 para esta función
def agregar_cadete(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        nombre = data.get('cadete')
        if nombre:
            obj, created = Cadete.objects.get_or_create(cadete=nombre, defaults={'activo': True})
            if created: return JsonResponse({'estado': 'creado'})
            elif not obj.activo:
                obj.activo = True
                obj.save()
                return JsonResponse({'estado': 'reactivado'})
            return JsonResponse({'estado': 'existe_activo'})
        return JsonResponse({'error': 'Falta nombre'}, status=400)

@csrf_exempt
def agregar_guarnicion(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        nombre = data.get('guarnicion')
        if nombre:
            obj, created = Guarnicion.objects.get_or_create(guarnicion=nombre, defaults={'activo': True})
            if created: return JsonResponse({'estado': 'creado'})
            elif not obj.activo:
                obj.activo = True
                obj.save()
                return JsonResponse({'estado': 'reactivado'})
            return JsonResponse({'estado': 'existe_activo'})
        return JsonResponse({'error': 'Falta nombre'}, status=400)

@csrf_exempt
def agregar_forma_pago(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        nombre = data.get('forma_pago')
        if nombre:
            obj, created = FormaPago.objects.get_or_create(forma_pago=nombre, defaults={'activo': True})
            if created: return JsonResponse({'estado': 'creado'})
            elif not obj.activo:
                obj.activo = True
                obj.save()
                return JsonResponse({'estado': 'reactivado'})
            return JsonResponse({'estado': 'existe_activo'})
        return JsonResponse({'error': 'Falta nombre'}, status=400)

@csrf_exempt
def agregar_tipo_y_menu(request):
    """Agrega o reactiva un Tipo de Menú y su Menú asociado"""
    data = json.loads(request.body)
    tipo_str = data.get('tipo_menu', '').strip()
    menu_str = data.get('menu', '').strip()
    
    # 1. Capturamos la lista de IDs de los monitores que tildó el usuario
    lista_monitores = data.get('monitores', []) 
    
    if not tipo_str or not menu_str:
        return JsonResponse({"error": "Faltan datos"}, status=400)

    # Buscar o crear el TIPO DE MENÚ
    tipo_obj, created_tipo = TipoMenu.objects.get_or_create(tipoMenu=tipo_str)
    tipo_reactivado = False
    
    # Si existía pero estaba oculto (activo=False), lo volvemos a prender
    if not tipo_obj.activo:
        tipo_obj.activo = True
        tipo_obj.save()
        tipo_reactivado = True

    # Buscar o crear el MENÚ
    menu_obj, created_menu = Menu.objects.get_or_create(nombre_menu=menu_str, tipo_menu=tipo_obj)
    menu_reactivado = False
    
    # Si el menú existía pero estaba oculto, lo volvemos a prender
    if not menu_obj.activo:
        menu_obj.activo = True
        menu_obj.save()
        menu_reactivado = True

    # 2. ACÁ ESTÁ LA MAGIA: Guardamos la relación de los monitores
    if lista_monitores:
        # .set() automáticamente limpia los viejos y asigna los nuevos
        menu_obj.monitores.set(lista_monitores)

    # Evaluar qué mensaje devolver a JavaScript
    # (Cambié "nuevo" por "creado" para que coincida perfecto con la alerta de tu JS)
    if created_tipo or created_menu:
        return JsonResponse({"estado": "creado"})
    elif tipo_reactivado or menu_reactivado:
        return JsonResponse({"estado": "reactivado"})
    else:
        # Solo dice "existe_activo" si AMBOS ya existían y AMBOS estaban activos
        return JsonResponse({"estado": "existe_activo"})
      
# =================================================================
# API PARA DIBUJAR LAS TABLAS DE PEDIDOS
# =================================================================
def obtener_pedidos(request):
    # 1. Buscamos el estado "Activo" (si no existe en la base, lo crea para no dar error)
    registro_activo, _ = Registro.objects.get_or_create(registro="Activo")
    
    # 2. Traemos todos los detalles de los pedidos que estén "Activos"
    detalles = DetallePedido.objects.filter(pedido__registro=registro_activo).select_related(
        'pedido', 'pedido__direccion', 'pedido__empresa', 'pedido__nombre', 
        'pedido__cadete', 'pedido__forma_pago', 'pedido__estado', 'pedido__registro',
        'menu', 'menu__tipo_menu', 'menu__guarnicion'
    ).order_by('-pedido__id')

    # 3. Armamos la lista exacta que espera tu JavaScript
    lista_pedidos = []
    for dp in detalles:
        p = dp.pedido
        fila = [
            p.id, # 0: id_pedido
            p.direccion.direccion if p.direccion else "", # 1: direccion
            p.empresa.empresa if p.empresa else "", # 2: empresa
            p.nombre.nombre if p.nombre else "", # 3: nombre
            dp.menu.nombre_menu if dp.menu else "", # 4: menu
            dp.menu.guarnicion.guarnicion if dp.menu and dp.menu.guarnicion else "", # 5: guarnicion
            dp.descripcion or "", # 6: descripcion
            dp.cantidad, # 7: cantidad
            p.cadete.cadete if p.cadete else "Pendiente", # 8: cadete
            p.forma_pago.forma_pago if p.forma_pago else "Pendiente", # 9: forma_pago
            p.estado.estado if p.estado else "Pendiente", # 10: estado
            p.registro.registro if p.registro else "", # 11: registro
            dp.id, # 12: id_detallePedido
            dp.menu.tipo_menu.tipoMenu if dp.menu and dp.menu.tipo_menu else "Varios", # 13: tipoMenu
        ]
        lista_pedidos.append(fila)

    return JsonResponse(lista_pedidos, safe=False)

# =================================================================
# API PARA EL AUTOCOMPLETADO (SUGERENCIAS DESPLEGABLES)
# =================================================================
def sugerencias_basicas(request, tipo):
    # Un diccionario inteligente que sabe en qué tabla buscar según la URL
    mapa = {
        'direcciones': (Direccion, 'direccion', None),
        'empresas': (Empresa, 'empresa', None),
        'nombres': (Nombre, 'nombre', None),
        'tipo_menu': (TipoMenu, 'tipoMenu', 'activo'),
        'guarniciones': (Guarnicion, 'guarnicion', 'activo'),
        'cadetes': (Cadete, 'cadete', 'activo'),
        'forma_pago': (FormaPago, 'forma_pago', 'activo'),
        'estados': (Estado, 'estado', None),
        'menus': (Menu, 'nombre_menu', 'activo'),
    }

    if tipo not in mapa:
        return JsonResponse([], safe=False)

    Modelo, campo, filtro = mapa[tipo]
    
    # Buscamos en la tabla y quitamos los nulos o los que dicen "0"
    qs = Modelo.objects.exclude(**{campo: '0'}).exclude(**{campo: None})
    
    # Si la tabla tiene columna "activo", filtramos solo los activos
    if filtro == 'activo':
        qs = qs.filter(activo=True)

    # Obtenemos la lista limpia de palabras sin repetir
    items = qs.values_list(campo, flat=True).distinct().order_by(campo)
    return JsonResponse(list(items), safe=False)

def sugerencias_menus_por_tipo(request, tipo_nombre):
    # Busca los menús específicos que pertenecen a un tipo (ej: "Minutas")
    items = Menu.objects.filter(tipo_menu__tipoMenu=tipo_nombre, activo=True).exclude(nombre_menu='0').values_list('nombre_menu', flat=True).distinct()
    return JsonResponse(list(items), safe=False)

def cadete_frecuente_dir(request, direccion):
    # Lee si una dirección tiene tilde de "frecuente"
    es_frecuente = False
    try:
        d = Direccion.objects.get(direccion=direccion)
        es_frecuente = d.es_frecuente
    except Direccion.DoesNotExist:
        pass
    return JsonResponse({"cadete": "", "es_frecuente": es_frecuente})

# =================================================================
# API PARA GUARDAR, EDITAR Y BORRAR PEDIDOS (EL NÚCLEO)
# =================================================================

def _procesar_guardado_grupo(data, es_edicion=False):
    """Función maestra que procesa el JSON del frontend y lo guarda en la BD"""
    direccion_str = data.get('direccion', '').strip()
    empresa_str = data.get('empresa', '').strip()
    cadete_str = data.get('cadete', '').strip()
    items = data.get('items', [])
    ids_originales = [int(i) for i in data.get('ids_originales', []) if i]
    volver_a_pendientes = data.get('volver_a_pendientes', False)
    es_frecuente = data.get('es_frecuente', False)

    with transaction.atomic():
        dir_obj = None
        if direccion_str and direccion_str != "PedidosYa":
            dir_obj, _ = Direccion.objects.get_or_create(direccion=direccion_str)
            if es_frecuente: dir_obj.es_frecuente = True; dir_obj.save()
        
        emp_obj = None
        if empresa_str:
            emp_obj, _ = Empresa.objects.get_or_create(empresa=empresa_str)
            if es_frecuente: emp_obj.es_frecuente = True; emp_obj.save()
                
        cad_obj = None
        if cadete_str and cadete_str not in ["PedidosYa", "Retira"]:
            cad_obj, _ = Cadete.objects.get_or_create(cadete=cadete_str)
            
        reg_activo, _ = Registro.objects.get_or_create(registro="Activo")
        reg_eliminado, _ = Registro.objects.get_or_create(registro="Eliminado")
        
        ids_procesados = []
        
        # EL SALVAVIDAS BACKEND: Si es edición y el ítem viene sin ID pero hay uno original suelto, lo rescatamos
        idx_seguridad = 0
        
        for item in items:
            nom_obj = fp_obj = est_obj = tm_obj = guar_obj = menu_obj = None
            
            if item.get('nombre'): nom_obj, _ = Nombre.objects.get_or_create(nombre=item.get('nombre').strip())
            if item.get('forma_pago'): fp_obj, _ = FormaPago.objects.get_or_create(forma_pago=item.get('forma_pago').strip())
            if item.get('estado'): est_obj, _ = Estado.objects.get_or_create(estado=item.get('estado').strip())
            if item.get('tipo_menu'): tm_obj, _ = TipoMenu.objects.get_or_create(tipoMenu=item.get('tipo_menu').strip())
            if item.get('guarnicion'): guar_obj, _ = Guarnicion.objects.get_or_create(guarnicion=item.get('guarnicion').strip())
            if item.get('menu') and tm_obj:
                menu_obj, _ = Menu.objects.get_or_create(nombre_menu=item.get('menu').strip(), tipo_menu=tm_obj, guarnicion=guar_obj)

            id_pedido = item.get('id_pedido')
            
            # Si el navegador mandó un ID nulo pero estábamos editando un grupo que tenía un ID original, lo enganchamos acá a la fuerza
            if es_edicion and not id_pedido and idx_seguridad < len(ids_originales):
                id_pedido = ids_originales[idx_seguridad]

            if es_edicion and id_pedido:
                pedido = Pedido.objects.filter(id=id_pedido).first()
                if pedido:
                    pedido.direccion = dir_obj; pedido.empresa = emp_obj
                    pedido.cadete = cad_obj; pedido.forma_pago = fp_obj
                    pedido.nombre = nom_obj; pedido.estado = est_obj
                    if volver_a_pendientes: pedido.registro = reg_activo
                    pedido.save()
                    
                    detalle = DetallePedido.objects.filter(pedido=pedido).first()
                    if detalle:
                        if menu_obj:
                            detalle.menu = menu_obj
                        else:
                            # Si no hay menú nuevo, inyectamos el comodín "0" para mantenerlo vivo y limpio
                            tm_vacio, _ = TipoMenu.objects.get_or_create(tipoMenu="0")
                            menu_vacio, _ = Menu.objects.get_or_create(nombre_menu="0", tipo_menu=tm_vacio)
                            detalle.menu = menu_vacio
                            
                        detalle.cantidad = int(item.get('cantidad', 1))
                        detalle.descripcion = item.get('descripcion', '').strip()
                        detalle.save()
                    ids_procesados.append(int(id_pedido))
            else:
                nuevo_pedido = Pedido.objects.create(
                    direccion=dir_obj, empresa=emp_obj, cadete=cad_obj,
                    forma_pago=fp_obj, nombre=nom_obj, estado=est_obj, registro=reg_activo
                )
                if menu_obj:
                    DetallePedido.objects.create(
                        pedido=nuevo_pedido, menu=menu_obj, 
                        cantidad=int(item.get('cantidad', 1)), 
                        descripcion=item.get('descripcion', '').strip()
                    )
            idx_seguridad += 1
                    
        # Si editamos, solo mandamos a eliminado lo que realmente no esté en los procesados
        if es_edicion:
            for old_id in ids_originales:
                if old_id not in ids_procesados:
                    Pedido.objects.filter(id=old_id).update(registro=reg_eliminado)


@csrf_exempt
def cargar_pedidos(request):
    if request.method == 'POST':
        _procesar_guardado_grupo(json.loads(request.body))
        return JsonResponse({"status": "ok"})

@csrf_exempt
def actualizar_grupo_pedidos(request):
    if request.method == 'POST':
        _procesar_guardado_grupo(json.loads(request.body), es_edicion=True)
        return JsonResponse({"status": "ok"})

@csrf_exempt
def eliminar_pedido(request, id_pedido):
    if request.method == 'POST':
        reg_eliminado, _ = Registro.objects.get_or_create(registro="Eliminado")
        Pedido.objects.filter(id=id_pedido).update(registro=reg_eliminado)
        return JsonResponse({"status": "ok"})

@csrf_exempt
def mover_a_cargados(request, id_pedido):
    if request.method == 'POST':
        reg_cargado, _ = Registro.objects.get_or_create(registro="Cargado")
        Pedido.objects.filter(id=id_pedido).update(registro=reg_cargado)
        return JsonResponse({"status": "ok"})

@csrf_exempt
def actualizar_campo_rapido(request):
    """Para cuando tocas el lapicito al lado de la celda de pago o estado"""
    if request.method == 'POST':
        data = json.loads(request.body)
        pedidos = Pedido.objects.filter(id__in=data.get('ids', []))
        campo, valor = data.get('campo'), data.get('valor')
        
        if campo == 'estado':
            obj, _ = Estado.objects.get_or_create(estado=valor)
            pedidos.update(estado=obj)
        elif campo == 'forma_pago':
            obj, _ = FormaPago.objects.get_or_create(forma_pago=valor)
            pedidos.update(forma_pago=obj)
        elif campo == 'cadete':
            if valor in ["PedidosYa", "Retira"]: pedidos.update(cadete=None)
            else:
                obj, _ = Cadete.objects.get_or_create(cadete=valor)
                pedidos.update(cadete=obj)
                
        return JsonResponse({"status": "ok"})

# =================================================================
# API PARA TRAER DATOS A LOS MODALES DE EDICIÓN
# =================================================================
@csrf_exempt
def obtener_grupo_pedidos(request):
    if request.method == 'POST':
        pedidos = Pedido.objects.filter(id__in=json.loads(request.body).get('ids', []))
        if not pedidos.exists(): return JsonResponse({"error": "Vacío"}, status=404)
        
        p0 = pedidos.first()
        cabecera = {
            "direccion": p0.direccion.direccion if p0.direccion else "",
            "empresa": p0.empresa.empresa if p0.empresa else "",
            "cadete": p0.cadete.cadete if p0.cadete else "",
            "es_frecuente": (p0.direccion and p0.direccion.es_frecuente) or (p0.empresa and p0.empresa.es_frecuente)
        }
        items = []
        for p in pedidos:
            dp = DetallePedido.objects.filter(pedido=p).first()
            items.append({
                "id_pedido": p.id,
                "nombre": p.nombre.nombre if p.nombre else "",
                "forma_pago": p.forma_pago.forma_pago if p.forma_pago else "",
                "estado": p.estado.estado if p.estado else "",
                "menu": dp.menu.nombre_menu if dp and dp.menu else "",
                "tipo_menu": dp.menu.tipo_menu.tipoMenu if dp and dp.menu and dp.menu.tipo_menu else "",
                "guarnicion": dp.menu.guarnicion.guarnicion if dp and dp.menu and dp.menu.guarnicion else "",
                "cantidad": dp.cantidad if dp else 1,
                "descripcion": dp.descripcion if dp else "",
            })
        return JsonResponse({"cabecera": cabecera, "items": items})
    # Por ahora la dejamos vacía solo para apagar el error 404 rojo.
    # En el próximo paso le meteremos la lógica real de guardado.
    return JsonResponse({"status": "ok"})

# =================================================================
# HELPER: LA "FÁBRICA" DE LISTAS PARA EL FRONTEND
# =================================================================
def _armar_lista_pedidos(detalles):
    """
    Toma un conjunto de registros de la base de datos y los convierte 
    en la lista de 14 columnas que espera pedidos.js
    """
    lista = []
    for dp in detalles:
        p = dp.pedido
        lista.append([
            p.id,                                          # 0: id_pedido
            p.direccion.direccion if p.direccion else "",  # 1: direccion
            p.empresa.empresa if p.empresa else "",        # 2: empresa
            p.nombre.nombre if p.nombre else "",           # 3: nombre
            dp.menu.nombre_menu if dp.menu else "",        # 4: menu
            dp.menu.guarnicion.guarnicion if dp.menu and dp.menu.guarnicion else "", # 5: guarnicion
            dp.descripcion or "",                          # 6: descripcion
            dp.cantidad,                                   # 7: cantidad
            p.cadete.cadete if p.cadete else "Pendiente",  # 8: cadete
            p.forma_pago.forma_pago if p.forma_pago else "Pendiente", # 9: forma_pago
            p.estado.estado if p.estado else "Pendiente",  # 10: estado
            p.registro.registro if p.registro else "",     # 11: registro
            dp.id,                                         # 12: id_detallePedido
            dp.menu.tipo_menu.tipoMenu if dp.menu and dp.menu.tipo_menu else "Varios", # 13: tipoMenu
        ])
    return lista

# =================================================================
# VISTAS DE LA API (AHORA "ACHICADAS")
# =================================================================
def obtener_pedidos(request):
    """Trae los pedidos activos para la tabla principal"""
    registro_activo, _ = Registro.objects.get_or_create(registro="Activo")
    detalles = DetallePedido.objects.filter(
        pedido__registro=registro_activo
    ).select_related('pedido', 'menu', 'menu__tipo_menu').order_by('-pedido__id')
    
    # Usamos el helper para devolver la lista
    return JsonResponse(_armar_lista_pedidos(detalles), safe=False)

def pedidos_cargados_data(request):

    """Trae los pedidos terminados para el modal de Totales"""
    detalles = DetallePedido.objects.filter(
        pedido__registro__registro__in=['Cargado', 'Eliminado']
    ).select_related('pedido', 'menu', 'menu__tipo_menu').order_by('-pedido__id')
    
    # Usamos el mismo helper. ¡Si cambias algo arriba, se arregla acá también!
    return JsonResponse(_armar_lista_pedidos(detalles), safe=False)

# =================================================================
# FUNCIONES DEL LÁPIZ EDITAR PEDIDO INDIVIDUAL                                          
# =================================================================
@csrf_exempt
def actualizar_pedido(request): 
    # El guardado de la edición de un pedido individual
    data = json.loads(request.body)
    _procesar_guardado_grupo({
        'direccion': data.get('direccion'), 'empresa': data.get('empresa'),
        'cadete': data.get('cadete'), 'ids_originales': [data.get('id_pedido')],
        'volver_a_pendientes': data.get('volver_a_pendientes'), 'items': [data]
    }, es_edicion=True)
    return JsonResponse({"status": "ok"})

def obtener_pedido(request, id_pedido):
    # Trae los datos de un solo pedido para rellenar el modal de edición
    p = Pedido.objects.filter(id=id_pedido).first()
    if not p: return JsonResponse({"error": "No encontrado"}, status=404)
    
    dp = DetallePedido.objects.filter(pedido=p).first()
    return JsonResponse({
        "id_pedido": p.id,
        "direccion": p.direccion.direccion if p.direccion else "",
        "empresa": p.empresa.empresa if p.empresa else "",
        "cadete": p.cadete.cadete if p.cadete else "",
        "nombre": p.nombre.nombre if p.nombre else "",
        "forma_pago": p.forma_pago.forma_pago if p.forma_pago else "",
        "estado": p.estado.estado if p.estado else "",
        "menu": dp.menu.nombre_menu if dp and dp.menu else "",
        "tipo_menu": dp.menu.tipo_menu.tipoMenu if dp and dp.menu and dp.menu.tipo_menu else "",
        "guarnicion": dp.menu.guarnicion.guarnicion if dp and dp.menu and dp.menu.guarnicion else "",
        "cantidad": dp.cantidad if dp else 1,
        "descripcion": dp.descripcion if dp else "",
    })

# =================================================================
# HISTORIAL Y CONTROL DEL DÍA (pedidos_cargados.js y main.js)
# =================================================================
@csrf_exempt
def restaurar_pedidos(request):
    """Devuelve los pedidos desde 'Cargados' hacia 'Activos' (Pendientes)"""
    ids = json.loads(request.body).get('ids', [])
    reg_activo, _ = Registro.objects.get_or_create(registro="Activo")
    Pedido.objects.filter(id__in=ids).update(registro=reg_activo)
    return JsonResponse({"status": "ok"})

@csrf_exempt
def iniciar_dia(request):
    """Quita el cartel de Iniciar Día y carga las filas de los Frecuentes"""
    
    reg_activo, _ = Registro.objects.get_or_create(registro="Activo")
    hoy = date.today()
    
    # 👇 NUEVO: Obtenemos o creamos el menú "0" (vacío) para poder crear el detalle
    tipo_vacio, _ = TipoMenu.objects.get_or_create(tipoMenu="0")
    menu_vacio, _ = Menu.objects.get_or_create(nombre_menu="0", tipo_menu=tipo_vacio)
    
    # Busca clientes frecuentes y les crea un pedido en blanco
    dirs = Direccion.objects.filter(es_frecuente=True)
    emps = Empresa.objects.filter(es_frecuente=True)
    
    for d in dirs:
        if not Pedido.objects.filter(direccion=d, fecha=hoy, registro=reg_activo).exists():
            nuevo_pedido = Pedido.objects.create(direccion=d, fecha=hoy, registro=reg_activo)
            # 👇 NUEVO: Le adjuntamos la fila de comida vacía para que la tabla lo pueda "ver"
            DetallePedido.objects.create(pedido=nuevo_pedido, menu=menu_vacio, cantidad=1)
            
    for e in emps:
        if not Pedido.objects.filter(empresa=e, fecha=hoy, registro=reg_activo).exists():
            nuevo_pedido = Pedido.objects.create(empresa=e, fecha=hoy, registro=reg_activo)
            # 👇 NUEVO: Le adjuntamos la fila de comida vacía
            DetallePedido.objects.create(pedido=nuevo_pedido, menu=menu_vacio, cantidad=1)
            
    return JsonResponse({"status": "ok"})

@csrf_exempt
def nueva_tabla(request):
    """El botón de Archivar Día: Guarda el historial y vacía la papelera"""
    hoy = date.today().strftime("%d-%m-%Y")
    reg_arch, _ = Registro.objects.get_or_create(registro=f"archivado_{hoy}")
    reg_elim, _ = Registro.objects.get_or_create(registro="Eliminado")
    
    # Pasa todo a archivado y purga la papelera para limpiar la base de datos
    Pedido.objects.filter(registro__registro__in=['Activo', 'Cargado']).update(registro=reg_arch)
    Pedido.objects.filter(registro=reg_elim).delete()
    return JsonResponse({"status": "ok"})

# =================================================================
# MONITOR DE COCINA (cocina.js)
# =================================================================
def cocina_view(request):
    """Muestra la página HTML del monitor"""
    return render(request, 'gestion/cocina.html')

def estado_monitor(request):
    """
    Genera un 'número de versión' para el JS.
    Si alguien agrega un plato, borra un pedido, o cambia una cantidad, 
    este número cambia y la TV se actualiza sola al instante.
    """
    detalles = DetallePedido.objects.filter(pedido__registro__registro__in=['Activo', 'Cargado'])
    
    cantidad_items = detalles.count()
    suma_platos = detalles.aggregate(Sum('cantidad'))['cantidad__sum'] or 0
    max_id = detalles.aggregate(Max('id'))['id__max'] or 0
    
    version_actual = f"{cantidad_items}_{suma_platos}_{max_id}"
    
    return JsonResponse({"version": version_actual})

def agregar_monitor(request):
    if request.method == 'POST':
        try:
            datos = json.loads(request.body)
            nombre_nuevo = datos.get('monitor')
            
            # Buscamos si ya existe o lo creamos
            monitor, creado = Monitor.objects.get_or_create(nombre=nombre_nuevo)
            
            # Si existía pero estaba oculto, lo reactivamos
            if not creado and not monitor.activo:
                monitor.activo = True
                monitor.save()
                
            return JsonResponse({"estado": "creado" if creado else "reactivado"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
# =================================================================
# HISTORIAL DE ARCHIVADOS (archivados.js)
# =================================================================
def ver_archivados_rango(request):
    """Filtra la base de datos por fecha y devuelve los pedidos archivados"""
    desde_str = request.GET.get('desde')
    hasta_str = request.GET.get('hasta')
    
    if not desde_str or not hasta_str:
        return JsonResponse([], safe=False)
        
    # Busca en todos los pedidos que estén entre esas fechas, SIN importar el estado ("Archivado", "Activo", etc.)
    # Esto te asegura que si buscas el día de HOY, también te traiga lo que acabas de cargar.
    detalles = DetallePedido.objects.filter(
        pedido__fecha__range=[desde_str, hasta_str]
    ).select_related(
        'pedido', 'menu', 'menu__tipo_menu'
    ).order_by('-pedido__fecha', '-pedido__id')
    
    lista = []
    for dp in detalles:
        p = dp.pedido
        # Armamos casi la misma fila de siempre, pero reemplazando el registro (col 11) por la Fecha del pedido
        lista.append([
            p.id, 
            p.direccion.direccion if p.direccion else "", 
            p.empresa.empresa if p.empresa else "", 
            p.nombre.nombre if p.nombre else "", 
            dp.menu.nombre_menu if dp.menu else "", 
            dp.menu.guarnicion.guarnicion if dp.menu and dp.menu.guarnicion else "", 
            dp.descripcion or "", 
            dp.cantidad, 
            p.cadete.cadete if p.cadete else "Pendiente", 
            p.forma_pago.forma_pago if p.forma_pago else "Pendiente", 
            p.estado.estado if p.estado else "Pendiente", 
            p.fecha.strftime("%d-%m-%Y"), # 11: LA FECHA
            dp.id, 
            dp.menu.tipo_menu.tipoMenu if dp.menu and dp.menu.tipo_menu else "Varios",
        ])

    return JsonResponse(lista, safe=False)

# =================================================================
# GESTOR DE ÍTEMS (gestor.js) - Ocultar y Eliminar
# =================================================================

def config_items(request, tipo):
    """Devuelve la lista de opciones (cadetes, guarniciones, etc.) y si están ocultos o no"""
    mapa = {
        'tipo_menu': (TipoMenu, 'tipoMenu'),
        'menus': (Menu, 'nombre_menu'),
        'guarniciones': (Guarnicion, 'guarnicion'),
        'cadetes': (Cadete, 'cadete'),
        'forma_pago': (FormaPago, 'forma_pago'),
    }
    
    if tipo not in mapa: return JsonResponse([], safe=False)
    
    Modelo, campo = mapa[tipo]
    # Traemos todos excluyendo los nulos o ceros
    items = Modelo.objects.exclude(**{campo: '0'}).exclude(**{campo: None}).values(campo, 'activo').distinct().order_by(campo)
    
    data = []
    for item in items:
        data.append({
            "nombre": item[campo],
            "oculto": not item['activo'] # Si en la BD está activo=False, para el JS es oculto=True
        })
        
    return JsonResponse(data, safe=False)

@csrf_exempt
def eliminar_item_config(request):
    """Borra definitivamente un ítem de las opciones"""
    data = json.loads(request.body)
    tipo, nombre = data.get('tipo'), data.get('id_item')
    
    mapa = {
        'tipo_menu': (TipoMenu, 'tipoMenu'), 'menus': (Menu, 'nombre_menu'),
        'guarniciones': (Guarnicion, 'guarnicion'), 'cadetes': (Cadete, 'cadete'),
        'forma_pago': (FormaPago, 'forma_pago'),
    }
    
    if tipo in mapa:
        Modelo, campo = mapa[tipo]
        try:
            Modelo.objects.filter(**{campo: nombre}).delete()
            return JsonResponse({"status": "ok"})
        except Exception as e:
            # Si el ítem ya fue usado en algún pedido viejo, la BD no te dejará borrarlo por seguridad.
            return JsonResponse({"error": "No se puede eliminar porque está asociado a pedidos antiguos. Te recomendamos 'Ocultarlo'."}, status=400)
            
    return JsonResponse({"error": "Tipo inválido"}, status=400)

@csrf_exempt
def toggle_ocultar_item_config(request):

    """Apaga o prende el 'ojito' (activo=True/False)"""
    data = json.loads(request.body)
    tipo, nombre, estaba_oculto = data.get('tipo'), data.get('id_item'), data.get('oculto')
    
    mapa = {
        'tipo_menu': (TipoMenu, 'tipoMenu'), 'menus': (Menu, 'nombre_menu'),
        'guarniciones': (Guarnicion, 'guarnicion'), 'cadetes': (Cadete, 'cadete'),
        'forma_pago': (FormaPago, 'forma_pago'),
    }
    
    if tipo in mapa:
        Modelo, campo = mapa[tipo]
        # Si estaba oculto (activo=False), el nuevo estado activo será True.
        Modelo.objects.filter(**{campo: nombre}).update(activo=estaba_oculto)
        return JsonResponse({"status": "ok"})
        
    return JsonResponse({"error": "Error"}, status=400)

# =================================================================
# RENDICIÓN DE CADETES (DINERO Y VIAJES)
# =================================================================
@csrf_exempt
def guardar_rendicion_cadetes(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            nombre_cadete = data.get('cadete')
            registros = data.get('registros', []) 

            cadete = Cadete.objects.filter(cadete=nombre_cadete).first()
            if not cadete:
                return JsonResponse({"estado": "error", "mensaje": "Cadete no encontrado."}, status=404)

            for reg in registros:
                fecha = reg.get('fecha')
                if not fecha:
                    continue
                
                RegistroDiarioCadete.objects.update_or_create(
                    cadete=cadete,
                    fecha=fecha,
                    defaults={
                        'dinero_sobrante': reg.get('dinero', 0),
                        'viajes': reg.get('viajes', 0),
                        'descripcion': reg.get('descripcion', '')
                    }
                )
            return JsonResponse({"estado": "ok", "mensaje": "Rendición guardada correctamente."})
        except Exception as e:
            print(e)
            return JsonResponse({"estado": "error", "mensaje": str(e)}, status=500)
    return JsonResponse({"estado": "error", "mensaje": "Método no permitido."}, status=405)

def buscar_rendicion_cadetes(request):
    cadete_nombre = request.GET.get('cadete', '')
    fecha_desde = request.GET.get('fecha_desde', '')
    fecha_hasta = request.GET.get('fecha_hasta', '')

    try:
        # 1er arreglo: cadete__cadete (porque la columna en el modelo Cadete se llama cadete)
        registros = RegistroDiarioCadete.objects.filter(
            cadete__cadete=cadete_nombre, 
            fecha__range=[fecha_desde, fecha_hasta]
        )
        
        datos = []
        for reg in registros:
            datos.append({
                "fecha": reg.fecha.strftime("%Y-%m-%d"),
                # 2do arreglo: dinero_sobrante (así está en tu base de datos)
                "dinero": reg.dinero_sobrante,
                "viajes": reg.viajes,
                "descripcion": reg.descripcion
            })
            
        return JsonResponse({"estado": "ok", "datos": datos})
    except Exception as e:
        print("🚨 ERROR AL BUSCAR RENDICIÓN:", e)
        return JsonResponse({"estado": "error", "mensaje": str(e)}, status=500)

# =================================================================
# BOTON ACTUALIZR EN PEDIDOS CARGADOS
# =================================================================
@csrf_exempt
def actualizar_sistema(request):
    """Ejecuta git pull en el servidor para traer las últimas actualizaciones"""
    if request.method == 'POST':
        try:
            resultado = subprocess.run(
                ['git', 'pull'],
                capture_output=True,
                text=True,
                check=True
            )
            return JsonResponse({'estado': 'ok', 'log': resultado.stdout})
        except subprocess.CalledProcessError as e:
            return JsonResponse({'estado': 'error', 'log': e.stderr})