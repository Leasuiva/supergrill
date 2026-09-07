/* ========================================================================== */
/* MODALES.JS - GESTIÓN CENTRALIZADA DE MODALES Y GUARDADO RÁPIDO             */
/* ========================================================================== */

// --- 1. LÓGICA GENÉRICA DE APERTURA Y CIERRE ---
function abrirModalGenerico(idModal, idInputFocus = null) {
    const dropdown = document.getElementById("dropdownOpciones");
    if (dropdown) dropdown.classList.add("oculto");

    if (idInputFocus) {
        const input = document.getElementById(idInputFocus);
        if (input) input.value = ""; // Vaciamos el input al abrir
    }
    document.getElementById(idModal).style.display = "block";
}

function cerrarModalGenerico(idModal) {
    document.getElementById(idModal).style.display = "none";
}

// --- 2. PUENTES PARA EL HTML (Para no tener que editar tus botones) ---
window.abrirModalTipoMenu = () => {
    document.getElementById("modal_nombre_menu").value = "";
    abrirModalGenerico("modalTipoMenu", "modal_tipo_menu");
    // window.cargarMonitoresEnCheckboxes(); // Carga los monitores dinámicamente
};
window.cerrarModalTipoMenu = () => cerrarModalGenerico("modalTipoMenu");

window.abrirModalGuarnicion = () => abrirModalGenerico("modalGuarnicion", "modal_guarnicion");
window.cerrarModalGuarnicion = () => cerrarModalGenerico("modalGuarnicion");

window.abrirModalFormaPago = () => abrirModalGenerico("modalFormaPago", "modal_forma_pago");
window.cerrarModalFormaPago = () => cerrarModalGenerico("modalFormaPago");

// Modal crear nuevo Cadete
window.abrirModalCadete = () => abrirModalGenerico("modalCadete", "modal_cadete");
window.cerrarModalCadete = () => cerrarModalGenerico("modalCadete");

// Modal nuevo de Lista de Cadetes 
// Este maneja la logica de dinero sobrantes de cadetes, en la parte opciones >> Cadetes
window.abrirModalListaCadetes = () => abrirModalGenerico("modalListaCadetes");
window.cerrarModalListaCadetes = () => {
    // 1. Ocultamos el modal
    const modal = document.getElementById("modalListaCadetes");
    if (modal) modal.style.display = "none";
    
    // 2. Vaciamos el buscador de cadetes
    const inputCadete = document.getElementById('filtro_cadete_rendicion');
    if (inputCadete) inputCadete.value = "";
    
    // 3. Limpiamos toda la tabla (dinero, viajes y descripción)
    document.querySelectorAll('.input-rendicion, .input-rendicion-texto').forEach(input => {
        input.value = "";
    });
    
    // 4. Volvemos los totales a $0
    window.calcularTotalesRendicion();
    window.actualizarBotonesDescripcion();
};

window.cerrarModalEditar = () => cerrarModalGenerico("modalEditarPedido");


// --- 3. LÓGICA GENÉRICA DE GUARDADO ---
function procesarAlertaGuardado(data, funcionCerrarModal) {
    if (data.estado === "existe_activo") {
        alert("ℹ️ Este ítem ya se encuentra cargado y activo en el sistema.");
    } else if (data.estado === "reactivado") {
        alert("✨ El ítem estaba oculto/eliminado y volvió a estar activo exitosamente.");
        funcionCerrarModal();
    } else {
        alert("✅ Ítem nuevo guardado exitosamente.");
        funcionCerrarModal();
    }
}

async function guardarItemGenerico(endpoint, payload, funcionCerrar) {
    try {
        const data = await apiFetch(endpoint, { 
            method: "POST", body: JSON.stringify(payload) 
        });
        procesarAlertaGuardado(data, funcionCerrar);
    } catch (err) { alert(`❌ Error: ${err.message}`); }
}

// --- 4. FUNCIONES DE GUARDADO ESPECÍFICAS (Vinculadas a los botones) ---
window.guardarGuarnicion = () => {
    const val = document.getElementById("modal_guarnicion").value.trim();
    if (!val) return alert("⚠️ Completá el campo.");
    guardarItemGenerico("/agregar_guarnicion", { guarnicion: val }, window.cerrarModalGuarnicion);
};

window.guardarFormaPago = () => {
    const val = document.getElementById("modal_forma_pago").value.trim();
    if (!val) return alert("⚠️ Completá el campo.");
    guardarItemGenerico("/agregar_forma_pago", { forma_pago: val }, window.cerrarModalFormaPago);
};

window.guardarCadete = () => {
    const val = document.getElementById("modal_cadete").value.trim();
    if (!val) return alert("⚠️ Completá el campo.");
    guardarItemGenerico("/agregar_cadete", { cadete: val }, window.cerrarModalCadete);
};


window.guardarTipoYMenu = async () => {
    const tipo = document.getElementById("modal_tipo_menu").value.trim();
    const menu = document.getElementById("modal_nombre_menu").value.trim();
    const guarnicion = document.getElementById("guarnicion")?.value.trim() || null;
    
    // ACÁ CAPTURAMOS LOS MONITORES TILDADOS
    const checkboxes = document.querySelectorAll('input[name="monitores_menu"]:checked');
    //const monitores_seleccionados = Array.from(checkboxes).map(cb => cb.value);

    if (!tipo || !menu) return alert("⚠️ Completá tipo y nombre del menú.");
    // if (monitores_seleccionados.length === 0) return alert("⚠️ Seleccioná al menos un monitor.");

    // Mandamos la lista de monitores al backend
    guardarItemGenerico("/agregar_tipo_y_menu", { 
        tipo_menu: tipo, 
        menu: menu, 
        guarnicion: guarnicion,
        // monitores: monitores_seleccionados 
    }, window.cerrarModalTipoMenu);
};

// Monitor
window.guardarMonitor = () => {
    const val = document.getElementById("modal_nombre_monitor").value.trim();
    if (!val) return alert("⚠️ Completá el nombre del monitor.");
    
    // Usamos tu función genérica y le pasamos una doble acción al cerrar
    guardarItemGenerico("/agregar_monitor", { monitor: val }, () => {
        window.cerrarModalMonitor();
        window.cargarMonitoresEnCheckboxes(); // Refresca la lista visualmente
    });
};

window.cargarMonitoresEnCheckboxes = async () => {
    try {
        const response = await fetch('/api/monitores/');
        const monitores = await response.json();
        
        const contenedor = document.getElementById('contenedor_monitores_checkboxes');
        if (!contenedor) return;
        
        contenedor.innerHTML = ''; // Limpiamos
        
        monitores.forEach(monitor => {
            contenedor.innerHTML += `
                <div style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" name="monitores_menu" value="${monitor.id}" id="chk_monitor_${monitor.id}" checked>
                    <label for="chk_monitor_${monitor.id}" style="margin: 0; cursor: pointer;">${monitor.nombre}</label>
                </div>
            `;
        });
    } catch (err) {
        console.error("Error al cargar monitores:", err);
    }
};
// -----------------------------------

// --- 5. SUGERENCIAS DENTRO DE LOS MODALES ---
function configurarSugerenciasModales() {
    const modales = [
        { input: "modal_tipo_menu", ul: "sug_modal_tipo_menu", url: "/tipo_menu" },
        { input: "modal_guarnicion", ul: "sug_modal_guarnicion", url: "/api/sugerencias_historial/guarniciones" },
        { input: "modal_forma_pago", ul: "sug_modal_forma_pago", url: "/api/sugerencias_historial/forma_pago" },
        { input: "modal_cadete", ul: "sug_modal_cadete", url: "/api/sugerencias_historial/cadetes" },
        // Conectamos el buscador de rendición con los cadetes de la base de datos
        { input: "filtro_cadete_rendicion", ul: "sug_filtro_cadete_rendicion", url: "/api/sugerencias_historial/cadetes" }
    ];

    modales.forEach(item => {
        const inputEl = document.getElementById(item.input);
        if (inputEl) {
            inputEl.addEventListener("click", (e) => {
                e.stopPropagation();
                const ul = document.getElementById(item.ul);
                if (ul) fetchYMostrarSugerencias(ul, item.url, inputEl.value);
            });
            inputEl.addEventListener("input", () => {
                const ul = document.getElementById(item.ul);
                if (!inputEl.value) { if (ul) { ul.innerHTML = ""; ul.style.display = "none"; } return; }
                if (ul) fetchYMostrarSugerencias(ul, item.url, inputEl.value);
            });
        }
    });

    const inputMenu = document.getElementById("modal_nombre_menu");
    if (inputMenu) {
        inputMenu.addEventListener("click", (e) => {
            e.stopPropagation();
            const tipo = document.getElementById("modal_tipo_menu").value;
            if (!tipo) return;
            const ul = document.getElementById("sug_modal_nombre_menu");
            fetchYMostrarSugerencias(ul, `/api/sugerencias_menus_por_tipo/${encodeURIComponent(tipo)}`, inputMenu.value);
        });

        inputMenu.addEventListener("input", () => {
            const tipo = document.getElementById("modal_tipo_menu").value;
            const ul = document.getElementById("sug_modal_nombre_menu");
            if (!inputMenu.value || !tipo) { if (ul) { ul.innerHTML = ""; ul.style.display = "none"; } return; }
            fetchYMostrarSugerencias(ul, `/api/sugerencias_menus_por_tipo/${encodeURIComponent(tipo)}`, inputMenu.value);
        });
    }
}
document.addEventListener("DOMContentLoaded", configurarSugerenciasModales);

// --- 6. LÓGICA DE RENDICIÓN DE CADETES (Doble Click y Guardado) ---
window.abrirModalListaCadetes = () => {
    abrirModalGenerico("modalListaCadetes");
    
    // Inyectar la fecha de hoy con formato lindo en la esquina
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fechaTexto = new Date().toLocaleDateString('es-AR', opcionesFecha);
    const spanFecha = document.getElementById('fecha_hoy_esquina');
    // La ponemos en mayúscula la primera letra (ej: "Jueves, 6 de agosto...")
    if(spanFecha) spanFecha.innerText = "Hoy: " + fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);
    
        // Activar la semana forzada al tocar los calendarios
        const inDesde = document.getElementById('fecha_desde_cadete');
        const inHasta = document.getElementById('fecha_hasta_cadete');
        
        if (inDesde) inDesde.addEventListener('change', window.forzarSemanaRendicion);
        if (inHasta) inHasta.addEventListener('change', window.forzarSemanaRendicion);
    
    // Función interna para sacar la fecha local exacta (sin error de zona horaria)
    const obtenerFechaLocal = (fecha) => {
        const offset = fecha.getTimezoneOffset() * 60000;
        return new Date(fecha.getTime() - offset).toISOString().split('T')[0];
    };
    
    if (inDesde && !inDesde.value) {
        const hoy = new Date();
        const dia = hoy.getDay() || 7; 
        hoy.setDate(hoy.getDate() - dia + 1); // Forzamos al Lunes
        inDesde.value = obtenerFechaLocal(hoy);
        
        hoy.setDate(hoy.getDate() + 4); // Forzamos al Viernes
        inHasta.value = obtenerFechaLocal(hoy);
    }

    window.evaluarEstadoTablaCadetes();
    window.actualizarFechasHeaders();

};

window.cerrarModalEdicionDia = () => {
    document.getElementById("modalEdicionDiaCadete").style.display = "none";
};

window.aplicarEdicionDia = () => {
    const dia = document.getElementById("edit_dia_index").value;
    
    const nuevoDinero = document.getElementById("edit_dinero_dia").value;
    const nuevosViajes = document.getElementById("edit_viajes_dia").value;
    const nuevaDesc = document.getElementById("edit_descripcion_dia").value;
    
    const inputDinero = document.querySelector(`.input-rendicion[data-dia="${dia}"][data-tipo="dinero"]`);
    const inputViajes = document.querySelector(`.input-rendicion[data-dia="${dia}"][data-tipo="viajes"]`);
    const inputDesc = document.querySelector(`.input-rendicion-texto[data-dia="${dia}"][data-tipo="descripcion"]`);
    
    if(inputDinero) inputDinero.value = nuevoDinero;
    if(inputViajes) inputViajes.value = nuevosViajes;
    if(inputDesc) inputDesc.value = nuevaDesc;
    
    window.calcularTotalesRendicion();
    window.actualizarBotonesDescripcion();
    window.cerrarModalEdicionDia(); // Cerramos solo el mini-modal chiquito
    
    // Validamos que haya un cadete seleccionado y mandamos a guardar
    const cadeteActual = document.getElementById('filtro_cadete_rendicion').value.trim();
    if(cadeteActual) {
        // Le mandamos "true" para que muestre el cartelito de éxito
        window.guardarRendicionCadetes(true, cadeteActual);
    } else {
        alert("⚠️ Seleccioná un cadete antes de aplicar los datos.");
    }
};

window.buscarRendicionCadete = async () => {
    const cadete = document.getElementById('filtro_cadete_rendicion').value.trim();
    const fechaDesde = document.getElementById('fecha_desde_cadete').value;
    const fechaHasta = document.getElementById('fecha_hasta_cadete').value;

    if (!cadete || !fechaDesde || !fechaHasta) {
        alert("⚠️ Por favor, ingresá el cadete y ambas fechas para buscar.");
        return;
    }

    try {
        const url = `/buscar_rendicion_cadetes/?cadete=${encodeURIComponent(cadete)}&fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.estado === 'ok') {
            // 1. Limpiamos la tabla primero
            document.querySelectorAll('.input-rendicion').forEach(input => input.value = "");
            document.querySelectorAll('.input-rendicion-texto').forEach(input => input.value = "");

            // 2. Rellenamos con los datos traídos
            data.datos.forEach(reg => {
                // Sacamos qué día de la semana es (1: Lunes, 5: Viernes)
                const dateObj = new Date(reg.fecha + 'T00:00:00'); 
                const diaSemana = dateObj.getDay(); 

                if (diaSemana >= 1 && diaSemana <= 5) {
                    const inDinero = document.querySelector(`.input-rendicion[data-dia="${diaSemana}"][data-tipo="dinero"]`);
                    const inViajes = document.querySelector(`.input-rendicion[data-dia="${diaSemana}"][data-tipo="viajes"]`);
                    const inDesc = document.querySelector(`.input-rendicion-texto[data-dia="${diaSemana}"][data-tipo="descripcion"]`);

                    if (inDinero) inDinero.value = reg.dinero || "";
                    if (inViajes) inViajes.value = reg.viajes || "";
                    if (inDesc) inDesc.value = reg.descripcion || "";
                }
            });
            // Recalculamos los totales al terminar
            window.calcularTotalesRendicion();
            window.actualizarBotonesDescripcion();
            window.evaluarEstadoTablaCadetes();
        } else {
            alert(data.mensaje || "Error al buscar datos.");
        }
    } catch (err) {
        console.error(err);
        alert("❌ Error de conexión al buscar.");
    }
};

window.guardarRendicionCadetes = async (mostrarAlerta = false, nombreCadeteForzado = null) => {
    const cadete = nombreCadeteForzado || document.getElementById('filtro_cadete_rendicion').value.trim();
    if (!cadete) return; 

    const hoy = new Date();
    const diaSemana = hoy.getDay() || 7; 
    const fechaBase = new Date(hoy);
    fechaBase.setDate(hoy.getDate() - diaSemana + 1); 

    const registros = [];

    for (let i = 1; i <= 5; i++) {
        const inDinero = document.querySelector(`.input-rendicion[data-dia="${i}"][data-tipo="dinero"]`).value;
        const inViajes = document.querySelector(`.input-rendicion[data-dia="${i}"][data-tipo="viajes"]`).value;
        const inDesc = document.querySelector(`.input-rendicion-texto[data-dia="${i}"][data-tipo="descripcion"]`).value;

        if (inDinero || inViajes || inDesc) {
            const fechaColumna = new Date(fechaBase);
            fechaColumna.setDate(fechaBase.getDate() + (i - 1));
            
            const offset = fechaColumna.getTimezoneOffset() * 60000;
            const fechaLocal = new Date(fechaColumna.getTime() - offset).toISOString().split('T')[0];

            registros.push({
                fecha: fechaLocal,
                dinero: parseFloat(inDinero) || 0,
                viajes: parseInt(inViajes) || 0,
                descripcion: inDesc
            });
        }
    }

    try {
        const payload = { cadete: cadete, registros: registros };
        const response = await fetch("/guardar_rendicion_cadetes/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.estado === 'ok') {
            if (mostrarAlerta) {
                // Solo mostramos el aviso de que se guardó, pero NO cerramos el modal principal
                alert("✅ ¡Día guardado en la base de datos!");
            }
        }
    } catch (err) {
        console.error("Error al guardar:", err);
        if (mostrarAlerta) alert("❌ Error al guardar en la base de datos.");
    }
};

// --- 7. CÁLCULO AUTOMÁTICO DE TOTALES (RENDICIÓN CADETES) ---
window.calcularTotalesRendicion = () => {
    // 1. Calcular total de Dinero
    let totalDinero = 0;
    const inputsDinero = document.querySelectorAll('.input-rendicion[data-tipo="dinero"]');
    
    inputsDinero.forEach(input => {
        // Parseamos a Float (decimal) y si está vacío o es texto, toma 0
        let valor = parseFloat(input.value) || 0; 
        totalDinero += valor;
    });
    
    // Lo mostramos en la tabla con el formato $0.00
    document.getElementById("total_dinero_semana").innerText = "$" + totalDinero.toFixed(2);

    // 2. Calcular total de Viajes
    let totalViajes = 0;
    const inputsViajes = document.querySelectorAll('.input-rendicion[data-tipo="viajes"]');
    
    inputsViajes.forEach(input => {
        // Parseamos a Int (entero) y si está vacío toma 0
        let valor = parseInt(input.value) || 0;
        totalViajes += valor;
    });
    
    // Lo mostramos en la tabla
    document.getElementById("total_viajes_semana").innerText = totalViajes;
};

// 3. Asignar eventos a las celdas directas de la tabla
document.addEventListener("DOMContentLoaded", () => {
    const inputsRendicion = document.querySelectorAll('.input-rendicion');
    inputsRendicion.forEach(input => {
        // Al tipear, suma los totales en vivo
        input.addEventListener('input', window.calcularTotalesRendicion);
        
        // NUEVO: Al hacer clic fuera de la celda (cuando terminás de escribir), GUARDA.
        input.addEventListener('change', () => {
            const cadeteActual = document.getElementById('filtro_cadete_rendicion').value.trim();
            // Validamos que haya un cadete seleccionado
            if (cadeteActual) {
                // Le mandamos "false" para que se guarde en la base de datos de fondo, sin tirar la alerta molesta
                window.guardarRendicionCadetes(false, cadeteActual);
            }
        });
    });
});

// --- AUTO-LIMPIEZA Y AUTO-BÚSQUEDA AL CAMBIAR CADETE ---
document.addEventListener("DOMContentLoaded", () => {
    const inputCadeteRendicion = document.getElementById('filtro_cadete_rendicion');
    if (inputCadeteRendicion) {
        
        // 1. Al escribir o borrar, limpiamos la tabla
        inputCadeteRendicion.addEventListener('input', () => {
            document.querySelectorAll('.input-rendicion').forEach(input => input.value = "");
            document.querySelectorAll('.input-rendicion-texto').forEach(input => input.value = "");
            window.calcularTotalesRendicion(); 
            window.actualizarBotonesDescripcion();
            window.evaluarEstadoTablaCadetes();
        });

        // 2. Al hacer clic en una sugerencia (el input pierde el foco), BUSCAMOS los datos
        inputCadeteRendicion.addEventListener('blur', () => {
            // Le damos 250 milisegundos para que el autocompletado termine de pegar el nombre antes de buscar
            setTimeout(() => {
                if (inputCadeteRendicion.value.trim() !== "") {
                    window.buscarRendicionCadete();
                }
            }, 250);
        });

        // 3. Por si las dudas: Si el usuario escribe el nombre y toca "Enter", también busca
        inputCadeteRendicion.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && inputCadeteRendicion.value.trim() !== "") {
                window.buscarRendicionCadete();
            }
        });
        
    }
});

// --- 8. HABILITAR DOBLE CLICK EN LA TABLA PARA ABRIR EL MODAL ---
window.abrirModalEdicionDia = (elemento) => {
    // 1. Buscamos el número de día (puede estar en el <td> o en el <input> interno)
    let dia = elemento.getAttribute("data-dia");
    if (!dia) {
        const inputInterno = elemento.querySelector('.input-rendicion, .input-rendicion-texto');
        if (inputInterno) dia = inputInterno.getAttribute("data-dia");
    }

    if (!dia) return; // Si no encuentra el día, cancela.

    // 2. Cambiamos el título del modal
    const diasNombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    document.getElementById("tituloEdicionDia").innerText = `Editar ${diasNombres[dia - 1]}`;
    document.getElementById("edit_dia_index").value = dia;
    
    // 3. Buscamos los valores actuales de la tabla
    const inputDinero = document.querySelector(`.input-rendicion[data-dia="${dia}"][data-tipo="dinero"]`);
    const inputViajes = document.querySelector(`.input-rendicion[data-dia="${dia}"][data-tipo="viajes"]`);
    const inputDesc = document.querySelector(`.input-rendicion-texto[data-dia="${dia}"][data-tipo="descripcion"]`);
    
    // 4. Los inyectamos en el mini-modal
    document.getElementById("edit_dinero_dia").value = inputDinero ? inputDinero.value : "";
    document.getElementById("edit_viajes_dia").value = inputViajes ? inputViajes.value : "";
    document.getElementById("edit_descripcion_dia").value = inputDesc ? inputDesc.value : "";
    
    // 5. Mostramos el modal
    document.getElementById("modalEdicionDiaCadete").style.display = "block";
};
window.actualizarBotonesDescripcion = () => {
    const hoy = new Date();
    const diaSemanaActual = hoy.getDay(); // 1 = Lunes, ..., 5 = Viernes
    
    // 👇 NUEVO: Miramos si hay un cadete escrito en el buscador
    const cadeteSeleccionado = document.getElementById('filtro_cadete_rendicion')?.value.trim();

    for (let i = 1; i <= 5; i++) {
        let input = document.querySelector(`.input-rendicion-texto[data-dia="${i}"]`);
        let divVisual = document.querySelector(`.desc-ui[data-dia="${i}"]`);
        
        if (input && divVisual) {
            if (input.value.trim() !== "") {
                // Si HAY texto: Siempre mostramos el botón celeste VER
                divVisual.innerHTML = `<button type="button" onclick="verDescripcionDia(${i}); event.stopPropagation();" style="background-color: #17a2b8; color: white; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px; font-weight: bold;">Ver</button>`;
            } else {
                // 👇 ACÁ CAMBIÓ: Evaluamos si es el día de hoy Y TAMBIÉN si hay un cadete elegido
                if (i === diaSemanaActual && cadeteSeleccionado !== "") {
                    // Es HOY y HAY CADETE: Dibujamos el botón "+" verde
                    divVisual.innerHTML = `<button type="button" onclick="abrirModalSoloDescripcion(${i}); event.stopPropagation();" style="background-color: #28a745; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 16px; font-weight: bold; line-height: 1; padding: 0; display: inline-flex; align-items: center; justify-content: center;" title="Agregar descripción">+</button>`;
                } else {
                    // NO es hoy, o la pantalla recién arranca SIN CADETE: Muestra el texto plano gris
                    divVisual.innerHTML = `<span style="cursor: default; text-decoration: none; opacity: 0.7; color: #888;">Sin descr.</span>`;
                }
            }
        }
    }
};

window.verDescripcionDia = (dia) => {
    // 1. Buscamos el input oculto de ese día
    const inputDesc = document.querySelector(`.input-rendicion-texto[data-dia="${dia}"]`);
    
    // 2. Si existe y tiene texto, lo mostramos en el nuevo modal
    if (inputDesc && inputDesc.value) {
        document.getElementById('textoDescripcionLectura').innerText = inputDesc.value;
        document.getElementById('modalVerDescripcion').style.display = 'block';
    }
};

// ==========================================
// FUNCIONES DEL ATAJO "SIN DESCRIPCIÓN"
// ==========================================
window.abrirModalSoloDescripcion = (dia) => {
    document.getElementById("solo_desc_dia_index").value = dia;
    document.getElementById("solo_desc_texto").value = ""; // Entra vacío
    
    // Abre el nuevo modal chiquito
    document.getElementById("modalSoloDescripcion").style.display = "block";
};

window.guardarSoloDescripcion = () => {
    const dia = document.getElementById("solo_desc_dia_index").value;
    const nuevaDesc = document.getElementById("solo_desc_texto").value;
    
    // Lo guarda en el input oculto de la tabla
    const inputDesc = document.querySelector(`.input-rendicion-texto[data-dia="${dia}"][data-tipo="descripcion"]`);
    if(inputDesc) inputDesc.value = nuevaDesc;
    
    // Cambia "Sin descr." por el botón "Ver" celeste
    window.actualizarBotonesDescripcion(); 
    
    // Cierra el modal chiquito
    document.getElementById('modalSoloDescripcion').style.display = 'none';
    
    // Guardado en base de datos silencioso
    const cadeteActual = document.getElementById('filtro_cadete_rendicion').value.trim();
    if(cadeteActual) {
        window.guardarRendicionCadetes(false, cadeteActual);
    }
};

// --- FUNCIÓN PARA BLOQUEAR/DESBLOQUEAR LA TABLA Y RESTRINGIR DÍAS ---
window.evaluarEstadoTablaCadetes = () => {
    const cadete = document.getElementById('filtro_cadete_rendicion').value.trim();
    const contenedorTabla = document.getElementById('contenedorTablaRendicion');
    
    // 1. Bloqueo general si no hay cadete seleccionado
    if (contenedorTabla) {
        if (cadete === "") {
            contenedorTabla.style.pointerEvents = "none";
            contenedorTabla.style.opacity = "0.4";
        } else {
            contenedorTabla.style.pointerEvents = "auto";
            contenedorTabla.style.opacity = "1";
        }
    }

    // 2. Bloqueo específico por día y cadete
    const hoy = new Date();
    const diaSemanaActual = hoy.getDay(); // 0 = Domingo, 1 = Lunes, ..., 5 = Viernes
    
    const inputsTabla = document.querySelectorAll('.input-rendicion');
    
    inputsTabla.forEach(input => {
        const diaInput = parseInt(input.getAttribute('data-dia'));
        
        // 👇 ACÁ EL CAMBIO: Verificamos si es hoy Y TAMBIÉN si hay un cadete
        if (diaInput === diaSemanaActual && cadete !== "") {
            // Es HOY y HAY CADETE: Se habilita para carga rápida (blanco)
            input.removeAttribute('readonly');
            input.style.backgroundColor = "#ffffff";
            input.style.color = "#000000";
            input.style.cursor = "text";
            input.title = "Carga rápida habilitada";
        } else {
            // NO es hoy, o NO hay cadete: Se restringe (gris)
            input.setAttribute('readonly', 'true');
            input.style.backgroundColor = "#f1f1f1"; 
            input.style.color = "#666666";
            input.style.cursor = "pointer"; 
            input.title = "Doble click para editar este día";
        }
    });
};

// ==========================================
// CONTROL ESTRICTO DE SEMANAS Y ENCABEZADOS
// ==========================================

window.actualizarFechasHeaders = () => {
    const desde = document.getElementById('fecha_desde_cadete').value;
    if (!desde) return;

    // Tomamos el "Desde" (que siempre será Lunes gracias a la función de abajo)
    const baseDate = new Date(desde + 'T00:00:00'); 
    const nombres = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

    // Recorremos los 5 títulos de la tabla
    for (let i = 1; i <= 5; i++) {
        const th = document.querySelector(`th[data-dia="${i}"]`);
        if (th) {
            const diaF = new Date(baseDate);
            diaF.setDate(baseDate.getDate() + (i - 1)); // Sumamos un día por cada columna
            
            // Formateamos para que quede DD/MM
            const diaStr = String(diaF.getDate()).padStart(2, '0');
            const mesStr = String(diaF.getMonth() + 1).padStart(2, '0');
            
            // Actualizamos el texto manteniendo los eventos intactos
            th.innerText = `${nombres[i - 1]} - ${diaStr}/${mesStr}`;
        }
    }
};

window.forzarSemanaRendicion = (e) => {
    const input = e.target;
    if (!input.value) return;

    const selectedDate = new Date(input.value + 'T00:00:00');
    const day = selectedDate.getDay() || 7; 

    // Calculamos el Lunes de la fecha que tocó el usuario
    const monday = new Date(selectedDate);
    monday.setDate(selectedDate.getDate() - day + 1);
    
    // Calculamos el Viernes
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const formatYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Sobreescribimos los inputs con la semana forzada
    document.getElementById('fecha_desde_cadete').value = formatYMD(monday);
    document.getElementById('fecha_hasta_cadete').value = formatYMD(friday);

    // Pintamos los nuevos títulos en la tabla
    window.actualizarFechasHeaders();
    
    // Si ya había un cadete seleccionado, actualizamos la tabla sola
    const cadete = document.getElementById('filtro_cadete_rendicion').value.trim();
    if (cadete !== "") {
        window.buscarRendicionCadete();
    }
};



