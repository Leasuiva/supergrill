"""
URL configuration for supergrill project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from gestion import views # Importamos las vistas de la app.

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'), # Creamos la ruta /login/
    path('', views.login_view, name='inicio'), # Agregamos esta línea para la ruta vacía (la página de inicio)
    path('cargarPedidos/', views.carga_pedidos_view, name='carga_pedidos'),
    path('pedidoscargados', views.pedidos_cargados_view, name='pedidos_cargados'),
    path('archivados/', views.archivados_view, name='archivados'),

    # --- RUTA PRINCIPAL DE LA TABLA ---
    path('pedidos', views.obtener_pedidos, name='obtener_pedidos'), 
    
    # --- RUTAS DE MODALES PARA AGREGAR ÍTEMS ---
    path('agregar_cadete', views.agregar_cadete, name='agregar_cadete'),
    path('agregar_guarnicion', views.agregar_guarnicion, name='agregar_guarnicion'),
    path('agregar_forma_pago', views.agregar_forma_pago, name='agregar_forma_pago'),
    path('agregar_tipo_y_menu', views.agregar_tipo_y_menu, name='agregar_tipo_y_menu'),
    
    # --- RUTAS DE SUGERENCIAS ESPECIALES Y GUARDADO ---
    path('menus_por_tipo/<str:tipo_nombre>', views.sugerencias_menus_por_tipo),
    path('cadete_frecuente_por_direccion/<str:direccion>', views.cadete_frecuente_dir),
    
    # --- RUTAS DE LISTAS DESPLEGABLES (AUTOCOMPLETADO) ---
    path('direcciones', views.sugerencias_basicas, kwargs={'tipo': 'direcciones'}),
    path('empresas', views.sugerencias_basicas, kwargs={'tipo': 'empresas'}),
    path('nombres', views.sugerencias_basicas, kwargs={'tipo': 'nombres'}),
    path('tipo_menu', views.sugerencias_basicas, kwargs={'tipo': 'tipo_menu'}),
    path('guarniciones', views.sugerencias_basicas, kwargs={'tipo': 'guarniciones'}),
    path('cadetes', views.sugerencias_basicas, kwargs={'tipo': 'cadetes'}),
    path('forma_pago', views.sugerencias_basicas, kwargs={'tipo': 'forma_pago'}),
    path('estados', views.sugerencias_basicas, kwargs={'tipo': 'estados'}),
    path('menus', views.sugerencias_basicas, kwargs={'tipo': 'menus'}),

        # --- RUTAS DE PEDIDOS (CRUD) ---
    path('cargar_pedidos', views.cargar_pedidos),
    path('actualizar_grupo_pedidos', views.actualizar_grupo_pedidos),
    path('api/grupo_pedidos', views.obtener_grupo_pedidos),
    path('eliminar_pedido/<int:id_pedido>', views.eliminar_pedido),
    path('mover_a_cargados/<int:id_pedido>', views.mover_a_cargados),
    path('api/actualizar_campo_rapido', views.actualizar_campo_rapido),
    path('actualizar_pedido', views.actualizar_pedido), 
    path('api/pedido/<int:id_pedido>', views.obtener_pedido), 

    # --- RUTA PARA EL MODAL DE TOTALES ---
    path('api/pedidos_cargados_data', views.pedidos_cargados_data),

    # --- RUTAS PARA EL HISTORIAL Y EL CIERRE DEL DÍA ---
    path('api/restaurar_pedidos', views.restaurar_pedidos),
    path('api/iniciar_dia', views.iniciar_dia),
    path('api/nueva_tabla', views.nueva_tabla),

    # --- RUTAS DE LA COCINA ---
    path('cocina', views.cocina_view, name='cocina'),
    path('api/estado_monitor', views.estado_monitor),

    # --- RUTA DEL ARCHIVADOR HISTÓRICO ---
    path('api/ver_archivados_rango', views.ver_archivados_rango),

    # --- RUTAS DEL GESTOR (EL OJITO MÁGICO) ---
    path('api/config_items/<str:tipo>', views.config_items),
    path('api/eliminar_item_config', views.eliminar_item_config),
    path('api/toggle_ocultar_item_config', views.toggle_ocultar_item_config),

    # --- RUTAS DE RENDICION DE GASTOS DE CADETES EN MENU OPCIONES ---
    path('guardar_rendicion_cadetes/', views.guardar_rendicion_cadetes, name='guardar_rendicion_cadetes'),
    path('buscar_rendicion_cadetes/', views.buscar_rendicion_cadetes, name='buscar_rendicion_cadetes'),
    path('api/sugerencias_historial/<str:tipo>', views.sugerencias_historial, name='sugerencias_historial'),

    # -- RUTAS PARA MONITORES
    path('agregar_monitor/', views.agregar_monitor, name='agregar_monitor'),

    # --- RUTA DE ACTUALIZACIÓN (actualizar sistema en menu de opciones) ---
    path('api/actualizar/', views.actualizar_sistema, name='actualizar_sistema'),
]

