/* ========================================================================== */
/* MAIN.JS - CONTROLADOR PRINCIPAL DE LA INTERFAZ Y EL FORMULARIO             */
/* ========================================================================== */

let idsResaltados = new Set(); 
let idsLabelEditado = new Set(); 

/* ========================================================================== */
/* 1. INICIALIZACIÓN (DOMContentLoaded)                                       */
/* ========================================================================== */
document.addEventListener("DOMContentLoaded", function () {
     
    verificarEstadoDia();

    // Inyectar el botón ➕ estático
    document.querySelectorAll(".fila-pedido").forEach(fila => {
        const divNombre = fila.querySelector(".input-radio");
        if (divNombre && !divNombre.querySelector(".btn-add-subitem")) {
            divNombre.style.display = "flex"; divNombre.style.gap = "5px"; divNombre.style.alignItems = "center";
            divNombre.insertAdjacentHTML('beforeend', `<button type="button" class="btn-icono btn-add-subitem" onclick="agregarSubItem(this)" title="Agregar menú a esta persona" style="background: transparent; border: none; font-size: 11px; padding: 2px; cursor: pointer; box-shadow: none; opacity: 0.8;">➕</button>`);
        }
    });

    // Ajuste de anchos en Tabla Principal
    const tablaP = document.getElementById("tablaPedidos");
    if (tablaP) {
        const ths = tablaP.querySelectorAll("thead th");
        if (ths.length >= 5) {
            ths[0].style.width = "22%"; ths[1].style.width = "auto"; ths[2].style.width = "10%"; ths[3].style.width = "12%"; ths[4].style.width = "12%";
        }
    }

    // Dropdowns y Menús
    const contenedorOpciones = document.getElementById("dropbtnOpciones")?.closest(".dropdown");
    const dropdownOpciones = document.getElementById("dropdownOpciones");
    if (contenedorOpciones && dropdownOpciones) {
        contenedorOpciones.addEventListener("mouseenter", () => dropdownOpciones.classList.remove("oculto"));
        contenedorOpciones.addEventListener("mouseleave", () => dropdownOpciones.classList.add("oculto"));
        dropdownOpciones.querySelectorAll(".submenu-content button").forEach(btn => btn.addEventListener("click", () => dropdownOpciones.classList.add("oculto")));
    }

    const btnMenuAgregar = document.getElementById("btnMenuAgregar");
    const menuAgregarItems = document.getElementById("menuAgregarItems");
    if (btnMenuAgregar && menuAgregarItems) {
        btnMenuAgregar.addEventListener("click", (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            // 🔥 NUEVO: Cerramos cualquier sugerencia abierta en los inputs
            document.querySelectorAll("ul.sugerencias").forEach(ul => { ul.innerHTML = ""; ul.style.display = "none"; });
            menuAgregarItems.classList.toggle("oculto"); 
        });
        menuAgregarItems.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => menuAgregarItems.classList.add("oculto")));
        document.addEventListener("click", (e) => { if (!document.getElementById("contenedorAgregarItem")?.contains(e.target)) menuAgregarItems.classList.add("oculto"); });
    }

    const dropbtn = document.getElementById("dropbtnAgregar");
    const dropdown = document.getElementById("dropdownContent");
    if (dropbtn && dropdown) {
        dropbtn.addEventListener("click", (e) => { e.stopPropagation(); dropdown.classList.toggle("oculto"); });
        document.addEventListener("click", (e) => { if (!dropdown.contains(e.target) && !dropbtn.contains(e.target)) dropdown.classList.add("oculto"); });
        dropdown.querySelectorAll("a").forEach(item => item.addEventListener("click", () => dropdown.classList.add("oculto")));
    }

    // Botones Principales
    document.getElementById("btnAgregarPedido")?.addEventListener("click", () => agregarFilaPedido());
    document.getElementById("btnCargarPedido")?.addEventListener("click", (e) => { e.preventDefault(); cargarPedidosDinamicos(); });
    document.getElementById("dropbtnNuevoPedido")?.addEventListener("click", () => abrirModalNuevoPedido());
    document.getElementById("dropbtnPedidosCargados")?.addEventListener("click", () => window.location.href = '/pedidoscargados');

    // Auto-actualización y Filtros (Tabla Principal)
    const tablaPedidos = document.getElementById("tablaPedidos");
    if (tablaPedidos) {
        cargarPedidosEnTabla(); 
        setInterval(async () => {
            const filtro = document.getElementById("filtroPedidos");
            if (filtro && filtro.value.trim() !== "") return;
            const tablaContainer = document.querySelector('.tabla-scroll');
            const scrollActual = tablaContainer ? tablaContainer.scrollTop : 0;
            await cargarPedidosEnTabla();
            if (tablaContainer) tablaContainer.scrollTop = scrollActual;
        }, 350000); 
    }

    const filtroPedidos = document.getElementById("filtroPedidos");
    if (filtroPedidos) {
        filtroPedidos.addEventListener("input", function () {
            const filtro = this.value.toLowerCase();
            const filas = Array.from(document.querySelectorAll("#tablaPedidos tbody tr"));
            const grupos = {};
            
            filas.forEach(fila => {
                const groupId = fila.getAttribute("data-group");
                if (groupId) { if (!grupos[groupId]) grupos[groupId] = []; grupos[groupId].push(fila); } 
                else { fila.style.display = fila.textContent.toLowerCase().includes(filtro) ? "" : "none"; }
            });

            for (const id in grupos) {
                const filasDelGrupo = grupos[id];
                const hayCoincidencia = filasDelGrupo.some(fila => fila.textContent.toLowerCase().includes(filtro));
                filasDelGrupo.forEach(fila => fila.style.display = hayCoincidencia ? "" : "none");
            }
        });
    }

    document.getElementById("btnRefrescarTabla")?.addEventListener("click", () => {
        cargarPedidosEnTabla();
        const filtro = document.getElementById("filtroPedidos");
        if(filtro) filtro.value = "";
    });

    configurarInputsDinamicos(); 
    configurarInputsEdicion();
});

/* ========================================================================== */
/* 2. FORMULARIO PRINCIPAL: MANEJO DE ESTADOS Y CABECERAS                     */
/* ========================================================================== */

function activarCampo(tipo) {
    const direccionInput = document.getElementById('direccion');
    const empresaInput = document.getElementById('empresa');
    const cadeteInput = document.getElementById("cadete");
    const sugDir = document.getElementById('sugerencias_direccion');
    const sugEmp = document.getElementById('sugerencias_empresa');
    
    if(cadeteInput) cadeteInput.value = "";

    if (tipo === 'direccion') {
        empresaInput.value = ''; empresaInput.disabled = true; if(sugEmp) sugEmp.innerHTML = '';
        direccionInput.disabled = false; if(sugDir) sugDir.innerHTML = '';
        if (cadeteInput) { cadeteInput.disabled = false; cadeteInput.placeholder = "Seleccionar..."; }
        direccionInput.focus();
    } else if (tipo === 'empresa') {
        direccionInput.value = ''; direccionInput.disabled = true; if(sugDir) sugDir.innerHTML = '';
        empresaInput.disabled = false; if(sugEmp) sugEmp.innerHTML = '';
        if (cadeteInput) { cadeteInput.disabled = false; cadeteInput.placeholder = "Seleccionar..."; }
        empresaInput.focus();
    } else if (tipo === 'retira') {
        direccionInput.value = ''; direccionInput.disabled = true; if(sugDir) sugDir.innerHTML = '';
        empresaInput.value = ''; empresaInput.disabled = true; if(sugEmp) sugEmp.innerHTML = '';
        if (cadeteInput) { cadeteInput.disabled = true; cadeteInput.placeholder = ""; }
    } else if (tipo === 'pedidosya') {
        direccionInput.value = ''; direccionInput.disabled = true; if(sugDir) sugDir.innerHTML = '';
        empresaInput.value = ''; empresaInput.disabled = true; if(sugEmp) sugEmp.innerHTML = '';
        if (cadeteInput) { cadeteInput.disabled = true; cadeteInput.placeholder = "PedidosYa"; }
    }
}
window.activarCampo = activarCampo;

function limpiarFormulario() {
    ["direccion", "empresa", "cadete", "piso", "depto", "timbre"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
    });

    const radioDireccion = document.querySelector("input[type='radio'][value='direccion']");
    if (radioDireccion) radioDireccion.checked = true;

    if (document.getElementById('direccion')) document.getElementById('direccion').disabled = false; 
    if (document.getElementById('empresa')) document.getElementById('empresa').disabled = true; 
    
    const cadeteInput = document.getElementById('cadete');
    if (cadeteInput) { cadeteInput.disabled = false; cadeteInput.placeholder = "Seleccionar..."; }
    
    ["piso", "depto", "timbre"].forEach(id => { const inp = document.getElementById(id); if(inp) inp.disabled = false; });
    document.querySelectorAll("ul.sugerencias").forEach(ul => { ul.innerHTML = ""; ul.style.display = "none"; });

    const chkFrecuente = document.getElementById("chkFrecuente");
    if (chkFrecuente) chkFrecuente.checked = false;
}
window.limpiarFormulario = limpiarFormulario;

function limpiarFilasPedido() {
    const modal = document.getElementById("modalNuevoPedido");
    if (!modal) return;
    modal.querySelectorAll(".fila-pedido").forEach(fila => fila.remove());
    const contenedor = document.getElementById("contenedorPedidos");
    if (contenedor) contenedor.innerHTML = "";
    agregarFilaPedido();
}
window.limpiarFilasPedido = limpiarFilasPedido;

async function cargarCadeteFrecuente(tipo, valor, esEdicion = false) {
    const idCadete = esEdicion ? "edit_cadete" : "cadete";
    const cadeteInput = document.getElementById(idCadete);
    const chkFrecuente = document.getElementById("chkFrecuente");

    const endpoint = tipo === "direccion" ? "cadete_frecuente_por_direccion" : "cadete_frecuente_por_empresa";
    if (!valor) return;
    
    try {
        const res = await fetch(`/${endpoint}/${encodeURIComponent(valor)}`);
        const data = await res.json();
        
        // 1. Cargamos el cadete
        if (data.cadete && data.cadete != "0" && cadeteInput && cadeteInput.value.trim() === "") {
            cadeteInput.value = data.cadete;
            cadeteInput.style.transition = "background-color 0.5s";
            cadeteInput.style.backgroundColor = "#dff0d8"; 
            setTimeout(() => cadeteInput.style.backgroundColor = "", 1000);
        }
        
        // 2. ✨ AUTO-TILDAMOS EL CHECKBOX SI ES FRECUENTE
        if (chkFrecuente && !esEdicion) {
            chkFrecuente.checked = data.es_frecuente === true;
        }
    } catch (err) { console.error("Error buscando cadete automático:", err); }
}
window.cargarCadeteFrecuente = cargarCadeteFrecuente;

function abrirModalNuevoPedido() { 
    limpiarFormulario();       
    limpiarFilasPedido(); 
    document.getElementById("ids_grupo_originales").value = "";
    document.getElementById("tituloModalPedido").innerText = "Nuevo pedido";
    document.getElementById("btnCargarPedido").innerText = "Cargar pedido";
    actualizarBotonesEliminar(); 
    document.getElementById("modalNuevoPedido").style.display = "block"; 
    setTimeout(() => document.getElementById("direccion")?.focus(), 50);
}
window.abrirModalNuevoPedido = abrirModalNuevoPedido;

function cerrarModalNuevoPedido() {
    document.getElementById("modalNuevoPedido").style.display = "none";
    limpiarFormulario(); limpiarFilasPedido(); 
    document.querySelectorAll("ul.sugerencias").forEach(ul => { ul.innerHTML = ""; ul.style.display = "none"; });
}
window.cerrarModalNuevoPedido = cerrarModalNuevoPedido;

/* ========================================================================== */
/* 3. FORMULARIO PRINCIPAL: FILAS DINÁMICAS Y SUB-ÍTEMS                       */
/* ========================================================================== */

function agregarFilaPedido(id_pedido_existente = null) {
    const contenedor = document.getElementById("contenedorPedidos");
    const template = document.getElementById("tpl-fila-pedido");
    if (!template) return console.error("Falta <template id='tpl-fila-pedido'>");

    const clone = template.content.cloneNode(true);
    const fila = clone.querySelector(".fila-pedido");
    fila.querySelector(".id_pedido_fila").value = id_pedido_existente || "";

    const idUnico = Math.random().toString(36).substr(2, 6);
    ["nombre", "tipo_menu", "menu", "guarnicion", "descripcion", "cantidad", "forma_pago", "estado"].forEach(campo => {
        const input = fila.querySelector(`.${campo}`);
        const label = fila.querySelector(`.lbl-${campo}`);
        if (input && label) { input.id = `${campo}_${idUnico}`; label.setAttribute("for", `${campo}_${idUnico}`); }
    });

    fila.querySelectorAll("input[type='text']").forEach(input => {
        const clase = input.className;
        if (["tipo_menu", "guarnicion", "forma_pago", "estado"].includes(clase)) {
            input.readOnly = true; input.style.cursor = "pointer";
            input.addEventListener("click", () => mostrarTodo(input));
            input.addEventListener("keydown", (e) => e.preventDefault());
        }
        if (["nombre", "descripcion", "estado", "menu"].includes(clase)) {
            input.addEventListener("input", () => {
                const val = input.value;
                const urlMap = { nombre: "/nombres", descripcion: "/descripciones", estado: "/estados" };
                const ul = input.closest(".campo").querySelector("ul.sugerencias");
                if (!val) { if(ul) { ul.innerHTML = ""; ul.style.display = "none"; } return; }
                if (ul) fetchYMostrarSugerencias(ul, urlMap[clase], val);
            });
        }
        if (clase === "menu") {
            input.addEventListener("input", () => {
                const tipo = fila.querySelector("input[name='tipo_menu']")?.value;
                const ul = input.closest(".campo").querySelector("ul.sugerencias");
                if (!input.value || !tipo || !ul) return;
                fetchYMostrarSugerencias(ul, `/menus_por_tipo/${encodeURIComponent(tipo)}`, input.value);
            });
        }
    });

    fila.querySelectorAll(".flecha-desplegar").forEach(flecha => flecha.addEventListener("click", (e) => { e.stopPropagation(); mostrarTodo(flecha); }));
    
    contenedor.appendChild(fila);
    actualizarBotonesEliminar(); 
}
window.agregarFilaPedido = agregarFilaPedido;

function agregarSubItem(boton) {
    const filaActual = boton.closest(".fila-pedido");
    const inputNombre = filaActual.querySelector(".nombre");
    const nombrePersona = inputNombre.value.trim();

    if (!nombrePersona) { alert("⚠️ Escribí un nombre primero."); inputNombre.focus(); return; }

    agregarFilaPedido();
    const contenedor = document.getElementById("contenedorPedidos");
    const nuevaFila = contenedor.lastElementChild;
    nuevaFila.classList.add("fila-subitem");
    filaActual.after(nuevaFila);

    const btnMas = nuevaFila.querySelector(".btn-add-subitem");
    if (btnMas) btnMas.style.display = "none";
    
    const nuevoInputNombre = nuevaFila.querySelector(".nombre");
    nuevoInputNombre.value = nombrePersona;
    nuevoInputNombre.style.display = "none"; 
    
    nuevaFila.querySelectorAll("label, .espaciador-cruz").forEach(el => el.style.display = "none");
    const campoPago = nuevaFila.querySelector(".forma_pago").closest(".campo");
    const campoEstado = nuevaFila.querySelector(".estado").closest(".campo");
    if (campoPago) campoPago.style.display = "none";
    if (campoEstado) campoEstado.style.display = "none";

    inputNombre.addEventListener("input", function() { nuevoInputNombre.value = this.value; });
}
window.agregarSubItem = agregarSubItem;

function esFilaSubItem(fila) {
    const inputNombre = fila.querySelector('.nombre');
    return fila.classList.contains('sub-item') || (inputNombre && inputNombre.style.display === 'none');
}
window.esFilaSubItem = esFilaSubItem;

function actualizarBotonesEliminar() {
    const modal = document.getElementById("modalNuevoPedido");
    if (!modal) return;
    let filas = Array.from(modal.querySelectorAll(".fila-pedido"));

    let padreValido = false;
    filas.forEach(fila => {
        if (!esFilaSubItem(fila)) padreValido = true; 
        else if (!padreValido) fila.remove(); 
    });

    const filasLimpias = modal.querySelectorAll(".fila-pedido");
    const mostrarCruces = filasLimpias.length > 1;

    filasLimpias.forEach(fila => {
        let campoBoton = fila.querySelector(".campo-boton-eliminar");
        if (!campoBoton) {
            const btnX = fila.querySelector(".btn-icono.externo");
            if (btnX) { campoBoton = btnX.closest(".campo"); if (campoBoton) campoBoton.classList.add("campo-boton-eliminar"); }
        }

        if (!campoBoton) {
            campoBoton = document.createElement("div");
            campoBoton.className = "campo campo-boton-eliminar";
            const estaEnContenedor = fila.closest('#contenedorPedidos') !== null;
            campoBoton.innerHTML = `<span class="espaciador-cruz" style="${estaEnContenedor ? 'display: none;' : 'display: block; visibility: hidden;'}">&nbsp;</span><div class="input-con-icono" style="height: 100%; display: flex; align-items: center;"><button type="button" class="btn-icono externo" onclick="removerFilaPedido(this)" aria-label="Eliminar esta fila">❌</button></div>`;
            fila.appendChild(campoBoton);
        } else {
            const btnX = campoBoton.querySelector(".externo");
            if (btnX) btnX.setAttribute("onclick", "removerFilaPedido(this)");
        }
        if (campoBoton) campoBoton.style.visibility = mostrarCruces ? "visible" : "hidden";
    });
}
window.actualizarBotonesEliminar = actualizarBotonesEliminar;

function removerFilaPedido(boton) {
    const filaActual = boton.closest('.fila-pedido');
    if (!filaActual) return;
    const modal = document.getElementById("modalNuevoPedido");
    if (!modal) return;

    const todasLasFilas = Array.from(modal.querySelectorAll('.fila-pedido'));
    const index = todasLasFilas.indexOf(filaActual); 

    if (!esFilaSubItem(filaActual)) {
        for (let i = index + 1; i < todasLasFilas.length; i++) {
            if (esFilaSubItem(todasLasFilas[i])) todasLasFilas[i].remove(); 
            else break; 
        }
    }
    filaActual.remove();

    if (modal.querySelectorAll('.fila-pedido').length === 0) agregarFilaPedido(); 
    actualizarBotonesEliminar(); 
}
window.removerFilaPedido = removerFilaPedido;

/* ========================================================================== */
/* 4. CONFIGURACIÓN INICIAL DE INPUTS Y SUGERENCIAS GLOBALES                  */
/* ========================================================================== */

/* function configurarInputsDinamicos() {
    const dirInput = document.getElementById("direccion");
    const empInput = document.getElementById("empresa");
    const cadInput = document.getElementById("cadete");

    if (dirInput) {
        dirInput.addEventListener("input", () => {
            if (!dirInput.value) { limpiarSugerencias("sugerencias_direccion"); return; }
            fetchYMostrarSugerencias("sugerencias_direccion", "/direcciones", dirInput.value);
        });
        
        // Concatena piso, depto y timbre antes de validar 👇
        dirInput.addEventListener("blur", () => { 
            let dirAValidar = dirInput.value.trim();
            const piso = document.getElementById("piso")?.value.trim() || "";
            const depto = document.getElementById("depto")?.value.trim() || "";
            const timbre = document.getElementById("timbre")?.value.trim() || "";

            if (dirAValidar) {
                if (piso) dirAValidar += ` Piso: "${piso}"`;
                if (depto) dirAValidar += ` Dpto: "${depto}"`;
                if (timbre) dirAValidar += ` Timbre: "${timbre}"`;
            }

            if (dirAValidar && (!cadInput || !cadInput.value.trim())) {
                cargarCadeteFrecuente("direccion", dirAValidar); 
            }
        });
    }

    if (empInput) {
        empInput.addEventListener("input", () => {
            if (!empInput.value) { limpiarSugerencias("sugerencias_empresa"); return; }
            fetchYMostrarSugerencias("sugerencias_empresa", "/empresas", empInput.value);
        });
        empInput.addEventListener("blur", () => { if (empInput.value.trim() && (!cadInput || !cadInput.value.trim())) cargarCadeteFrecuente("empresa", empInput.value.trim()); });
    }

    if (cadInput) {
        cadInput.addEventListener("input", () => {
            if (!cadInput.value) { limpiarSugerencias("sugerencias_cadete"); return; }
            fetchYMostrarSugerencias("sugerencias_cadete", "/cadetes", cadInput.value);
        });
    }

    ["nombre", "tipo_menu", "menu", "guarnicion", "forma_pago", "estado"].forEach(clase => {
        const inp = document.querySelector(`input.${clase}`);
        if (!inp) return;
        const mapa = { nombre: "/nombres", tipo_menu: "/tipo_menu", guarnicion: "/guarniciones", forma_pago: "/forma_pago", estado: "/estados" };
        
        inp.addEventListener("input", () => {
            const val = inp.value;
            const ul = inp.closest(".campo")?.querySelector("ul.sugerencias");
            if (!val || !ul) { if(ul) ul.innerHTML = ""; ul.style.display = "none"; return; }
            
            if (clase === "menu") {
                const tipo = inp.closest(".fila-dos")?.querySelector("input[name='tipo_menu']")?.value;
                if(tipo) fetchYMostrarSugerencias(ul, `/menus_por_tipo/${encodeURIComponent(tipo)}`, val);
            } else if (mapa[clase]) {
                fetchYMostrarSugerencias(ul, mapa[clase], val);
            }
        });
    });

    document.querySelectorAll(".flecha-desplegar").forEach((flecha) => flecha.addEventListener("click", (e) => { e.stopPropagation(); mostrarTodo(flecha); }));
    document.querySelectorAll("input[readonly]").forEach((input) => { input.style.cursor = "pointer"; input.addEventListener("click", () => mostrarTodo(input)); });
    
    document.querySelectorAll("input[type='text']").forEach(input => {
        input.addEventListener("keydown", (e) => {
            const ul = document.getElementById("sugerencias_" + input.id);
            if (e.key === "Tab" && ul && ul.style.display === "block") { e.preventDefault(); ul.querySelector("li[tabindex='0']")?.focus(); }
        });
    });
} */

function configurarInputsDinamicos() {
    const dirInput = document.getElementById("direccion");
    const empInput = document.getElementById("empresa");
    const cadInput = document.getElementById("cadete");

    if (dirInput) {
        dirInput.addEventListener("input", () => {
            if (!dirInput.value) { limpiarSugerencias("sugerencias_direccion"); return; }
            fetchYMostrarSugerencias("sugerencias_direccion", "/direcciones", dirInput.value);
        });
        
        // Concatena piso, depto y timbre antes de validar 👇
        dirInput.addEventListener("blur", () => { 
            let dirAValidar = dirInput.value.trim();
            const piso = document.getElementById("piso")?.value.trim() || "";
            const depto = document.getElementById("depto")?.value.trim() || "";
            const timbre = document.getElementById("timbre")?.value.trim() || "";

            if (dirAValidar) {
                if (piso) dirAValidar += ` Piso: "${piso}"`;
                if (depto) dirAValidar += ` Dpto: "${depto}"`;
                if (timbre) dirAValidar += ` Timbre: "${timbre}"`;
            }

            if (dirAValidar && (!cadInput || !cadInput.value.trim())) {
                cargarCadeteFrecuente("direccion", dirAValidar); 
            }
        });
    }

    if (empInput) {
        empInput.addEventListener("input", () => {
            if (!empInput.value) { limpiarSugerencias("sugerencias_empresa"); return; }
            fetchYMostrarSugerencias("sugerencias_empresa", "/empresas", empInput.value);
        });
        empInput.addEventListener("blur", () => { if (empInput.value.trim() && (!cadInput || !cadInput.value.trim())) cargarCadeteFrecuente("empresa", empInput.value.trim()); });
    }

    if (cadInput) {
        cadInput.addEventListener("input", () => {
            if (!cadInput.value) { limpiarSugerencias("sugerencias_cadete"); return; }
            fetchYMostrarSugerencias("sugerencias_cadete", "/cadetes", cadInput.value);
        });
    }

    ["nombre", "tipo_menu", "menu", "guarnicion", "forma_pago", "estado"].forEach(clase => {
        const inp = document.querySelector(`input.${clase}`);
        if (!inp) return;
        const mapa = { nombre: "/nombres", tipo_menu: "/tipo_menu", guarnicion: "/guarniciones", forma_pago: "/forma_pago", estado: "/estados" };
        
        inp.addEventListener("input", () => {
            const val = inp.value;
            const ul = inp.closest(".campo")?.querySelector("ul.sugerencias");
            if (!val || !ul) { if(ul) ul.innerHTML = ""; ul.style.display = "none"; return; }
            
            if (clase === "menu") {
                const tipo = inp.closest(".fila-dos")?.querySelector("input[name='tipo_menu']")?.value;
                // Dejamos que traiga las sugerencias si hay un tipo seleccionado
                if(tipo) fetchYMostrarSugerencias(ul, `/menus_por_tipo/${encodeURIComponent(tipo)}`, val);
            } else if (mapa[clase]) {
                fetchYMostrarSugerencias(ul, mapa[clase], val);
            }
        });
    });

    document.querySelectorAll(".flecha-desplegar").forEach((flecha) => flecha.addEventListener("click", (e) => { e.stopPropagation(); mostrarTodo(flecha); }));
    
    // 👇 ESTE ES EL CAMBIO CLAVE 👇
    // Antes esto se aplicaba a todos los inputs con readonly, pero como le sacaste el readonly a "menu", la flechita no andaba y te bloqueaba el input.
    // Ahora busca específicamente los inputs que SI tienen readonly y les bloquea la escritura.
    document.querySelectorAll("input[readonly]").forEach((input) => { 
        input.style.cursor = "pointer"; 
        input.addEventListener("click", () => mostrarTodo(input)); 
        input.addEventListener("keydown", (e) => {
             // Solo permitimos el tab para navegar, bloqueamos todo el resto si es readonly
            if(e.key !== "Tab") e.preventDefault(); 
        });
    });
    
    // A los campos de menú, como ya NO son readonly, les ponemos el evento del click para que abran las opciones igual, pero sin bloquear el tipeo.
    document.querySelectorAll("input.menu").forEach(inputMenu => {
        inputMenu.addEventListener("click", () => mostrarTodo(inputMenu));
    });
    // 👆 FIN DEL CAMBIO CLAVE 👆

    document.querySelectorAll("input[type='text']").forEach(input => {
        input.addEventListener("keydown", (e) => {
            const ul = document.getElementById("sugerencias_" + input.id);
            if (e.key === "Tab" && ul && ul.style.display === "block") { e.preventDefault(); ul.querySelector("li[tabindex='0']")?.focus(); }
        });
    });
}

function configurarInputsEdicion() {
    [ { id: "edit_direccion", url: "/direcciones" }, { id: "edit_empresa", url: "/empresas" }, { id: "edit_nombre", url: "/nombres" }, { id: "edit_cadete", url: "/cadetes" }, { id: "edit_descripcion", url: "/descripciones" }].forEach(item => {
        const input = document.getElementById(item.id);
        if (input) {
            input.addEventListener("input", function() {
                const ul = document.getElementById("sug_" + item.id);
                if (!this.value) { if (ul) { ul.innerHTML = ""; ul.style.display = "none"; } return; }
                if (ul) fetchYMostrarSugerencias(ul, item.url, this.value);
            });
        }
    });

    const inputEditMenu = document.getElementById("edit_menu");
    if (inputEditMenu) {
        inputEditMenu.addEventListener("input", function() {
            const tipo = document.getElementById("edit_tipo_menu")?.value;
            const ul = document.getElementById("sug_edit_menu");
            if (!this.value || !tipo) { if (ul) { ul.innerHTML = ""; ul.style.display = "none"; } return; }
            fetchYMostrarSugerencias(ul, `/menus_por_tipo/${encodeURIComponent(tipo)}`, this.value);
        });
    }

    ["edit_tipo_menu", "edit_guarnicion", "edit_forma_pago", "edit_estado", "edit_cadete"].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.readOnly = true; input.style.cursor = "pointer";
            input.addEventListener("click", function(e) { e.stopPropagation(); mostrarTodo(this); });
            const flecha = input.parentElement?.querySelector(".flecha-desplegar");
            if(flecha) flecha.addEventListener("click", (e) => { e.stopPropagation(); mostrarTodo(input); });
        }
    });
}

/* ========================================================================== */
/* 5. UTILIDADES VISUALES Y EVENTOS GLOBALES                                  */
/* ========================================================================== */

function inicializarHoverGrupal() {
    document.querySelectorAll("td.celda-direccion").forEach(celda => {
        celda.addEventListener("mouseenter", () => toggleHoverGrupo(celda, true));
        celda.addEventListener("mouseleave", () => toggleHoverGrupo(celda, false));
    });
}

function toggleHoverGrupo(celda, activo) {
    const tr = celda.closest("tr");
    const filasAfectadas = parseInt(celda.getAttribute("rowspan") || 1);
    const accion = activo ? "add" : "remove";
    
    tr.classList[accion]("hover-grupo-activo");
    let filaSiguiente = tr.nextElementSibling;
    for (let i = 1; i < filasAfectadas; i++) {
        if (filaSiguiente) {
            filaSiguiente.classList[accion]("hover-grupo-activo");
            filaSiguiente = filaSiguiente.nextElementSibling;
        }
    }
}
window.inicializarHoverGrupal = inicializarHoverGrupal;

function formatearDireccionHtml(direccionVal) {
    if (!direccionVal) return "";
    if (direccionVal.includes("RETIRA")) return `<span>${direccionVal}</span>`;

    let calle = direccionVal;
    let extras = [];

    const regExps = [ /Piso[:]?\s+"([^"]+)"/i, /Dpto[:]?\s+"([^"]+)"/i, /(?:Tbre|Timb|Timbre)[:]?\s+"([^"]+)"/i ];
    regExps.forEach(rx => { const match = calle.match(rx); if (match) { extras.push(match[0]); calle = calle.replace(match[0], ""); } });

    calle = calle.trim().replace(/,$/, "").trim();
    let html = `<span style="font-weight:bold; font-size:1.05em;">${calle}</span>`;
    extras.forEach(item => html += `<div style="margin-top:2px; font-size:0.95em; color:#555; padding-left: 12px; border-left: 2px solid #ddd;">${item}</div>`);
    return html;
}
window.formatearDireccionHtml = formatearDireccionHtml;

// Eventos de cierre de modales (Clicks afuera y Escape)
// Eventos de cierre globales (Sugerencias y Modales al hacer clic afuera)
document.addEventListener("click", (e) => {
    
    // 1. Cierre inteligente de las listas de sugerencias
    document.querySelectorAll("ul.sugerencias").forEach(ul => {
        const campo = ul.closest(".campo") || ul.parentElement;
        if (!campo) return;
        
        const input = campo.querySelector("input[type='text'], input:not([type='hidden'])");
        const flecha = campo.querySelector(".flecha-desplegar");

        // Si la lista está visible y el clic NO fue en la lista, NI en el input, NI en la flecha
        if (
            ul.style.display === "block" &&
            !ul.contains(e.target) &&
            !(input && input.contains(e.target)) &&
            !(flecha && flecha.contains(e.target))
        ) {
            ul.innerHTML = "";
            ul.style.display = "none";
        }
    });

    // 2. Cierre de modales al hacer clic en el fondo oscuro
    const mapas = [
        { id: "modalCantidades", cerrarFn: window.cerrarModalCantidades },
        { id: "modalEditarPedido", cerrarFn: window.cerrarModalEditar },
        { id: "modalGestorItems", cerrarFn: window.cerrarModalGestorItems }
    ];
    mapas.forEach(m => { 
        const el = document.getElementById(m.id); 
        if (el && e.target === el && m.cerrarFn) m.cerrarFn(); 
    });
});

document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        document.querySelectorAll("ul.sugerencias").forEach(ul => { ul.innerHTML = ""; ul.style.display = "none"; });
        const mapas = [
            { id: "modalNuevoPedido", cerrarFn: window.cerrarModalNuevoPedido },
            { id: "modalCantidades", cerrarFn: window.cerrarModalCantidades },
            { id: "modalEditarPedido", cerrarFn: window.cerrarModalEditar },
            { id: "modalGestorItems", cerrarFn: window.cerrarModalGestorItems }
        ];
        mapas.forEach(m => { const el = document.getElementById(m.id); if (el && el.style.display === "block" && m.cerrarFn) m.cerrarFn(); });
    }
});

/* ========================================================================== */
/* 6. CONTROL DE APERTURA Y CIERRE DE JORNADA                                 */
/* ========================================================================== */
function verificarEstadoDia() {
    
    if (!document.getElementById("tablaPedidos")) return;

    const diaIniciado = localStorage.getItem("dia_iniciado");
    const btnCargar = document.getElementById("btnCargarPedido");
    const tablaContenedor = document.querySelector(".tabla-scroll");

    // Si el día está marcado como "false" (cerrado)
    if (diaIniciado !== "true") {
        
        // 1. Bloqueamos el botón de cargar pedido
        if (btnCargar) {
            btnCargar.disabled = true;
            btnCargar.style.opacity = "0.4";
            btnCargar.style.cursor = "not-allowed";
            btnCargar.title = "Debes iniciar el día primero para cargar pedidos.";
        }
        
        // 2. Creamos el cartel gigante sobre la tabla
        if (tablaContenedor && !document.getElementById("overlayInicioDia")) {
            tablaContenedor.style.position = "relative";
            
            const overlay = document.createElement("div");
            overlay.id = "overlayInicioDia";
            // Estilo para un fondo semi-transparente que tape la tabla
            overlay.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(5px); display: flex; justify-content: center; align-items: center; z-index: 50;";
            
            const btnIniciar = document.createElement("button");
            btnIniciar.innerHTML = "Iniciar día";
            btnIniciar.style.cssText = "padding: 12px 30px; font-size: 18px; font-weight: bold; background-color: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); transition: all 0.2s;";
            
            // Animación al pasar el mouse
            btnIniciar.onmouseover = () => btnIniciar.style.transform = "scale(1.05)";
            btnIniciar.onmouseout = () => btnIniciar.style.transform = "scale(1)";
            
            // Lo que pasa al hacer clic
            btnIniciar.onclick = async () => {
                btnIniciar.innerHTML = "⏳ CARGANDO CLIENTES...";
                btnIniciar.disabled = true;
                
                try {
                    // ✨ LLAMADA AL BACKEND PARA CARGAR LOS FRECUENTES
                    await apiFetch("/api/iniciar_dia", { method: "POST" });
                    
                    localStorage.setItem("dia_iniciado", "true");
                    overlay.remove(); 

                    setTimeout(() => {
                    if (typeof cargarPedidosEnTabla === "function") {
                        cargarPedidosEnTabla();
                    }
                    }, 500);
                    
                    if (btnCargar) {
                        btnCargar.disabled = false;
                        btnCargar.style.opacity = "1";
                        btnCargar.style.cursor = "pointer";
                        btnCargar.title = "";
                    }
                    
                    if (typeof cargarPedidosEnTabla === "function") cargarPedidosEnTabla();
                } catch(e) {
                    alert("Error al iniciar el día: " + e.message);
                    btnIniciar.innerHTML = "☀️ INICIAR DÍA";
                    btnIniciar.disabled = false;
                }
            };
            
            overlay.appendChild(btnIniciar);
            tablaContenedor.appendChild(overlay);
        }
    }
}

/* ========================================================================== */
/* MENÚ FLOTANTE RÁPIDO PARA ESTADO Y FORMA DE PAGO                           */
/* ========================================================================== */

// 1. Inyectamos el menú invisible en el HTML base
document.body.insertAdjacentHTML('beforeend', `
<div id="miniMenuEdicion" style="display:none; position:absolute; background:#fff; border:1px solid #ccc; box-shadow:0px 4px 6px rgba(0,0,0,0.2); z-index:9999; border-radius:5px; padding:5px; min-width:140px;">
    <div style="font-size:11px; color:#666; font-weight:bold; padding:4px 8px; border-bottom:1px solid #eee; margin-bottom:4px;" id="tituloMiniMenu">Opciones</div>
    <ul id="listaMiniMenu" style="list-style:none; padding:0; margin:0; font-size:13px;"></ul>
</div>
`);

// 2. Lógica para cerrar el menú si haces clic afuera
document.addEventListener('click', (e) => {
    const menu = document.getElementById('miniMenuEdicion');
    if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && !e.target.closest('.btn-editar-celda-rapida')) {
        menu.style.display = 'none';
    }
});

// 3. Función para abrir el menú debajo del lápiz que tocaste
window.abrirMenuRapido = async function(evento, idsStr, campo) {
    evento.stopPropagation();
    const menu = document.getElementById('miniMenuEdicion');
    const lista = document.getElementById('listaMiniMenu');
    
    // Título dinámico
    let titulo = 'Opciones';
    if (campo === 'estado') titulo = 'Cambiar Estado';
    else if (campo === 'forma_pago') titulo = 'Cambiar Forma de Pago';
    else if (campo === 'cadete') titulo = 'Reasignar Cadete';
    document.getElementById('tituloMiniMenu').innerText = titulo;

    // Posicionamiento dinámico debajo del cursor
    const rect = evento.target.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    menu.style.left = (rect.left + window.scrollX - 70) + 'px'; 
    menu.style.display = 'block';
    lista.innerHTML = '<li style="padding:5px; text-align:center;">Cargando...</li>';

    // Elegimos el endpoint correcto según el campo
    let endpoint = '';
    if (campo === 'estado') endpoint = '/estados';
    else if (campo === 'forma_pago') endpoint = '/forma_pago';
    else if (campo === 'cadete') endpoint = '/cadetes';

    // Buscamos las opciones reales de tu base de datos
    let opciones = [];
    try {
        opciones = await apiFetch(endpoint);
    } catch(e) {
        // Opciones de emergencia por si falla internet
        if (campo === 'estado') opciones = ['Pendiente', 'Entregado', 'Cancelado'];
        else if (campo === 'forma_pago') opciones = ['Pendiente', 'Efectivo', 'Mercado Pago', 'Transferencia'];
        else if (campo === 'cadete') opciones = ['Retira', 'PedidosYa'];
    }

    // Dibujamos las opciones
    lista.innerHTML = '';
    opciones.forEach(opt => {
        const li = document.createElement('li');
        li.innerText = opt;
        li.style.cssText = 'padding:6px 10px; cursor:pointer; border-radius:3px; transition:background 0.2s; color:#333; font-weight:500;';
        li.onmouseover = () => li.style.background = '#f0f0f0';
        li.onmouseout = () => li.style.background = 'transparent';
        li.onclick = () => guardarEdicionRapida(idsStr, campo, opt);
        lista.appendChild(li);
    });
};

// 4. Función para guardar solo el campo específico
window.guardarEdicionRapida = async function(idsStr, campo, nuevoValor) {
    document.getElementById('miniMenuEdicion').style.display = 'none';
    try {
        const ids = String(idsStr).split(',').map(Number);
        const res = await fetch('/api/actualizar_campo_rapido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ids, campo: campo, valor: nuevoValor })
        });

        if (res.ok) {
            // Recargamos la tabla activa para reflejar los cambios
            if (typeof recargarTablas === 'function' && document.getElementById("tablaPedidos")) recargarTablas();
            if (typeof cargarTablaCargados === 'function' && document.getElementById("tablaCargados")) cargarTablaCargados();
        } else {
            alert("❌ Hubo un error al actualizar.");
        }
    } catch (err) { alert("❌ Error de conexión: " + err.message); }
};