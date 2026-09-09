/* ========================================================================== */
/* PEDIDOS.JS - LÓGICA DE DIBUJADO, EDICIÓN Y CARGA A LA BASE DE DATOS        */
/* ========================================================================== */

// --- VARIABLES GLOBALES DE ESTADO ---
let idsEditadosFijos = new Set(); 
let idsUltimoLote = new Set();
let datosOriginalesGrupo = null;
let datosOriginalesPedido = null;

/* ========================================================================== */
/* 1. LÓGICA DE TABLAS PRINCIPALES (Hoja de Carga)                            */
/* ========================================================================== */

async function cargarPedidosEnTabla() {
    try {
        const guardadosAzul = JSON.parse(localStorage.getItem("ids_azul_fijo") || "[]");
        idsEditadosFijos = new Set(guardadosAzul.map(Number));

        let lista = await apiFetch(`/pedidos?t=${Date.now()}`); 
        
        const tabla = document.getElementById("tablaPedidos");
        const cantidad = lista.length;
        tabla.classList.remove("tabla-compacta", "tabla-densa");
        if (cantidad > 20) tabla.classList.add("tabla-densa");
        else if (cantidad > 10) tabla.classList.add("tabla-compacta");

        const arrAlPrincipio = JSON.parse(localStorage.getItem("ids_al_principio") || "[]");
        lista.sort((a, b) => {
            const idA = parseInt(a[0]);
            const idB = parseInt(b[0]);
            const idxA = arrAlPrincipio.lastIndexOf(idA);
            const idxB = arrAlPrincipio.lastIndexOf(idB);
            
            if (idxA !== -1 && idxB === -1) return -1; 
            if (idxA === -1 && idxB !== -1) return 1;  
            if (idxA !== -1 && idxB !== -1) return idxB - idxA; 
            return idB - idA; 
        });

        const idMasNuevo = lista.length > 0 ? Math.max(...lista.map(p => parseInt(p[0]))) : -1;

        const tbody = document.querySelector("#tablaPedidos tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        const gruposDireccion = {};
        lista.forEach(p => { let dir = p[1] || p[2]; if (!dir || dir === "0") dir = "Retira en el local"; if (!gruposDireccion[dir]) gruposDireccion[dir] = []; gruposDireccion[dir].push(p); });

        let contadorGruposVisual = 0; 
        for (const direccion in gruposDireccion) {
            const pedidosDir = gruposDireccion[direccion];
            const subGruposCadete = {};
            pedidosDir.forEach(p => { let cad = (!p[8] || p[8] === "0") ? "Sin Cadete" : p[8]; if (direccion === "Retira en el local.") cad = "Retira"; if (!subGruposCadete[cad]) subGruposCadete[cad] = []; subGruposCadete[cad].push(p); });

            for (const nombreCadete in subGruposCadete) {
                const pedidosSubGrupo = subGruposCadete[nombreCadete];
                const esGrupoGris = (contadorGruposVisual % 2 !== 0);
                const claseFondoZebra = esGrupoGris ? "grupo-fondo-gris" : "";
                const idsGlobales = pedidosSubGrupo.map(p => p[0]).join(",");
                const grupoCompleto = pedidosSubGrupo.every(p => p[4] && p[4].trim() !== "");

                const flagsMemoria = JSON.parse(localStorage.getItem("flags_edicion") || "{}");
                const textosMemoria = JSON.parse(localStorage.getItem("textos_edicion") || "{}");
                
                // DETECCIÓN INDEPENDIENTE
                const grupoEditadoDireccion = pedidosSubGrupo.some(p => (flagsMemoria[p[0]] || []).includes("dir"));
                const grupoEditadoCadete = pedidosSubGrupo.some(p => (flagsMemoria[p[0]] || []).includes("cad"));
                const todoElGrupoEsNuevo = pedidosSubGrupo.every(p => parseInt(p[0]) === idMasNuevo);
                
                let claseFondoEstructural = todoElGrupoEsNuevo ? "fila-nueva" : ""; 

                // --- 1. BADGE DIRECCIÓN ---
                let htmlDireccion = formatearDireccionHtml(direccion);
                let msjDireccion = "";
                if (grupoEditadoDireccion) {
                    let recoleccionDir = [];
                    pedidosSubGrupo.forEach(p => { if (textosMemoria[p[0]]) recoleccionDir.push(...textosMemoria[p[0]].filter(c => c.startsWith("Dir") || c.startsWith("Emp"))); });
                    if (recoleccionDir.length > 0) msjDireccion = `Destino editado:\n• ` + [...new Set(recoleccionDir)].join('\n• ');
                    htmlDireccion = `<span class="texto-editado-resaltado" title="${msjDireccion}">${htmlDireccion}</span>`;
                } else {
                    htmlDireccion = `<span class="titulo-direccion">${htmlDireccion}</span>`;
                }

                // --- 2. BADGE CADETE ---
                let htmlCadete = nombreCadete;
                let msjCadete = "";
                if (grupoEditadoCadete) {
                    let recoleccionCad = [];
                    pedidosSubGrupo.forEach(p => { if (textosMemoria[p[0]]) recoleccionCad.push(...textosMemoria[p[0]].filter(c => c.startsWith("Cadete"))); });
                    if (recoleccionCad.length > 0) msjCadete = `Cadete reasignado:\n• ` + [...new Set(recoleccionCad)].join('\n• ');
                    htmlCadete = `<span class="texto-editado-resaltado" title="${msjCadete}">${nombreCadete}</span>`;
                }

                const subGruposNombre = {};
                pedidosSubGrupo.forEach(p => { let nombre = p[3] ? p[3].trim() : ""; let key = nombre !== "" ? nombre.toLowerCase() : "SIN_NOMBRE_" + p[0]; if (!subGruposNombre[key]) subGruposNombre[key] = []; subGruposNombre[key].push(p); });

                let filasTotales = Object.keys(subGruposNombre).length;
                let esPrimeraFila = true;
                let contadorFilasLocal = 0;

                const generarBadge = (t) => { let v=t; if(!v||v==='-'||v==='0') v='Pendiente'; let c='badge-efectivo'; const txt=String(v).toLowerCase(); if(txt.includes('pendiente')) c='badge-pendiente'; else if(txt.includes('mp')||txt.includes('mercado')) c='badge-mp'; else if(txt.includes('pagado')) c='badge-pagado'; return `<span class="badge ${c}">${v}</span>`; };

                for (const keyNombre in subGruposNombre) {
                    const itemsPersona = subGruposNombre[keyNombre];
                    contadorFilasLocal++;
                    const esUltimaFila = (contadorFilasLocal === filasTotales);
                    const claseBorde = esUltimaFila ? "borde-grupo" : "borde-interno"; 
                    
                    const p = itemsPersona[0];
                    const idsPersonaStr = itemsPersona.map(it => it[0]).join(",");
                    
                    const esNuevo = itemsPersona.some(it => parseInt(it[0]) === idMasNuevo);
                    // AQUÍ ESTÁ LA CLAVE: Solo busca la bandera 'item'
                    const cambioContenido = itemsPersona.some(it => (flagsMemoria[parseInt(it[0])] || []).includes("item"));

                    let claseFondoPedido = esNuevo ? "fila-nueva" : "";

                    const tr = document.createElement("tr");
                    tr.className = `fila-grupo ${claseFondoZebra}`; 
                    const idGrupoHover = `grupo-${direccion.replace(/\s+/g, '')}-${nombreCadete.replace(/\s+/g, '')}`; 
                    tr.setAttribute("data-group", idGrupoHover);

                    let html = "";
                    
                    let partesTexto = itemsPersona.map(it => { 
                        // Si el menú es "0", devolvemos un texto vacío para que no dibuje el (1) 0
                        if (!it[4] || it[4] === "0") return ""; 
                        
                        let desc = (it[6] && it[6] !== "0") ? ` <span style="font-size:0.9em; color:#555;">[${it[6]}]</span>` : ""; 
                        let guarn = (it[5] && it[5] !== "0") ? ` con ${it[5]}` : "";
                        return `(${it[7]}) ${it[4]}${guarn}${desc}`; 
                    }).filter(t => t !== ""); // Filtramos para eliminar los vacíos
                    
                    let textoFinal = partesTexto.length > 0 ? partesTexto.join(" - ") : "";
                    
                    // Si hay un nombre de cliente asignado, lo mostramos prolijamente
                    if (p[3] && p[3] !== "0" && p[3].trim() !== "") {
                        textoFinal += textoFinal === "" ? p[3] : ` - ${p[3]}`;
                    }
                    
                    let msjItem = "";
                    // --- 3. BADGE PEDIDO ---
                    if (cambioContenido) {
                        let recoleccion = [];
                        itemsPersona.forEach(it => { if (textosMemoria[it[0]]) recoleccion.push(...textosMemoria[it[0]].filter(c => !c.startsWith("Dir") && !c.startsWith("Cadete") && !c.startsWith("Emp"))); });
                        if (recoleccion.length > 0) msjItem = `Modificaciones:\n• ` + [...new Set(recoleccion)].join('\n• ');
                        textoFinal = `<span class="texto-editado-resaltado" title="${msjItem}">${textoFinal}</span>`;
                    }
                    
                    const tieneMenu = itemsPersona.every(it => it[4] && it[4].trim() !== "");

                    if (esPrimeraFila) {
                        html += `<td class="celda-direccion borde-grupo ${claseFondoEstructural}" rowspan="${filasTotales}"><div class="contenedor-direccion">${htmlDireccion}<div class="acciones-grupo"><button class="btn-tilde" onclick="moverGrupoCargados('${idsGlobales}', ${grupoCompleto})">✅</button><button class="btn-editar" onclick="editarGrupo('${idsGlobales}')">✏️</button><button class="btn-borrar" onclick="eliminarGrupo('${idsGlobales}')">🗑️</button></div></div></td>`;
                    }

                    let btnTildeItem = itemsPersona.length > 1 ? `<button class="btn-tilde-item" onclick="moverPersonaCargados('${idsPersonaStr}', ${tieneMenu})" title="Cargar">✅</button>` : `<button class="btn-tilde-item" onclick="moverAPedidosCargados(${p[0]}, ${tieneMenu})" title="Cargar">✅</button>`;
                    let btnEditarItem = itemsPersona.length > 1 ? `<button class="btn-editar" onclick="editarGrupo('${idsPersonaStr}')" title="Editar">✏️</button>` : `<button class="btn-editar" onclick="editarPedido(${p[0]})" title="Editar">✏️</button>`;
                    let btnBorrarItem = itemsPersona.length > 1 ? `<button class="btn-borrar-item" onclick="eliminarGrupoPersona('${idsPersonaStr}')" title="Borrar">🗑️</button>` : `<button class="btn-borrar-item" onclick="eliminarPedido(${p[0]})" title="Borrar">🗑️</button>`;

                    html += `<td class="celda-pedido ${claseFondoPedido} ${claseBorde}"><div class="item-pedido-container"><span class="texto-pedido">${textoFinal}</span><div class="acciones-item">${btnTildeItem}${btnEditarItem}${btnBorrarItem}</div></div></td>`;
                    
                    // Boton editar en la celda de cadete
                    if (esPrimeraFila) {
                        const btnLapizCadete = `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsGlobales}', 'cadete')" title="Reasignar Cadete">✏️</button>`;
                        
                        html += `<td class="texto-centro celda-cadete borde-grupo ${claseFondoEstructural}" rowspan="${filasTotales}" style="position:relative;">
                            ${htmlCadete} ${btnLapizCadete}
                        </td>`;
                    }
                    
                    // --- BOTONES INDEPENDIENTES PARA EDICIÓN RÁPIDA ---
                    const btnLapizPago = `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsPersonaStr}', 'forma_pago')" title="Cambiar Forma de Pago">✏️</button>`;
                    const btnLapizEstado = `<button class="btn-editar-celda btn-editar-celda-rapida" onclick="abrirMenuRapido(event, '${idsPersonaStr}', 'estado')" title="Cambiar Estado">✏️</button>`;

                    html += `<td class="texto-centro ${claseFondoPedido} ${claseBorde}" style="vertical-align: middle;"><div class="contenedor-badge-centro">${generarBadge(p[9])}${btnLapizPago}</div></td>`;
                    html += `<td class="texto-centro ${claseFondoPedido} ${claseBorde} borde-izquierdo-estado" style="vertical-align: middle;"><div class="contenedor-badge-centro">${generarBadge(p[10])}${btnLapizEstado}</div></td>`;

                    tr.innerHTML = html;
                    tbody.appendChild(tr);
                    esPrimeraFila = false;
                }
                contadorGruposVisual++; 
            }
        }
        if (typeof inicializarHoverGrupal === 'function') inicializarHoverGrupal();
    } catch (err) { console.error(err); }
}

async function recargarTablas() {
    // 1. Recarga la tabla de pedidos pendientes
    if (typeof cargarPedidosEnTabla === 'function' && document.getElementById("tablaPedidos")) {
        await cargarPedidosEnTabla();
        
        // Si quedó algo escrito en el buscador, disparamos el evento para que vuelva a filtrar la tabla
        const filtroP = document.getElementById("filtroPedidos");
        if (filtroP && filtroP.value.trim() !== "") {
            filtroP.dispatchEvent(new Event('input'));
        }
    }
    
    // 2. Recarga la tabla de pedidos cargados (historial)
    if (typeof cargarTablaCargados === 'function' && document.getElementById("tablaCargados")) {
        await cargarTablaCargados();
        
        const filtroC = document.getElementById("filtroCargados");
        if (filtroC && filtroC.value.trim() !== "") {
            filtroC.dispatchEvent(new Event('input'));
        }
    }
    
}

/* ========================================================================== */
/* 2. EDICIÓN Y CARGA MASIVA DE PEDIDOS                                       */
/* ========================================================================== */

async function editarGrupo(idsStr, evento) {
    if (evento && evento.target.closest('.acciones-item')) return; 
    if (!idsStr) return;
    const listaIds = idsStr.split(",").map(Number);
    
    try {
        const data = await apiFetch('/api/grupo_pedidos', { method: 'POST', body: JSON.stringify({ ids: listaIds }) });
        datosOriginalesGrupo = data; 
        
        abrirModalNuevoPedido();
        const modalScope = document.getElementById("modalNuevoPedido");

        modalScope.querySelector("#tituloModalPedido").innerText = "✏️ Editar Grupo";
        modalScope.querySelector("#btnCargarPedido").innerText = "💾 Actualizar Grupo";
        modalScope.querySelector("#ids_grupo_originales").value = idsStr;

        const cab = data.cabecera;
        let direccionVal = (cab.direccion == "0" || !cab.direccion) ? "" : cab.direccion;
        let empresaVal = (cab.empresa == "0" || !cab.empresa) ? "" : cab.empresa;

        let pExtra = "", dExtra = "", tExtra = "";
        if (direccionVal) {
            const mP = direccionVal.match(/Piso[:]?\s+"([^"]+)"/i);
            if (mP) { pExtra = mP[1]; direccionVal = direccionVal.replace(mP[0], ""); }
            const mD = direccionVal.match(/Dpto[:]?\s+"([^"]+)"/i);
            if (mD) { dExtra = mD[1]; direccionVal = direccionVal.replace(mD[0], ""); }
            const mT = direccionVal.match(/(?:Tbre|Timb|Timbre)[:]?\s+"([^"]+)"/i);
            if (mT) { tExtra = mT[1]; direccionVal = direccionVal.replace(mT[0], ""); }
            direccionVal = direccionVal.trim().replace(/,$/, "").trim();
        }

        if (empresaVal) {
            modalScope.querySelector("input[value='empresa']").checked = true;
            activarCampo('empresa');
            modalScope.querySelector("#empresa").value = empresaVal;
        } else if (direccionVal || pExtra || dExtra) {
            modalScope.querySelector("input[value='direccion']").checked = true;
            activarCampo('direccion');
            modalScope.querySelector("#direccion").value = direccionVal;
            document.getElementById("piso").value = pExtra;
            document.getElementById("depto").value = dExtra;
            document.getElementById("timbre").value = tExtra;
        }

        modalScope.querySelector("#cadete").value = (cab.cadete == "0" || !cab.cadete) ? "" : cab.cadete;


        // Funcion para automarcar si el cliente era frecuente.
        const checkFrecuente = modalScope.querySelector("#chkFrecuente");
        if (checkFrecuente) checkFrecuente.checked = cab.es_frecuente === true;

        const contenedor = modalScope.querySelector("#contenedorPedidos");
        let filaEstatica = modalScope.querySelector(".fila-dos.fila-pedido");

        if (data.items.length > 0) {
            const primerItem = data.items[0];
            let idInput = filaEstatica.querySelector(".id_pedido_fila");
            if (!idInput) {
                idInput = document.createElement("input");
                idInput.type = "hidden";
                idInput.className = "id_pedido_fila";
                filaEstatica.querySelector(".campo").prepend(idInput);
            }
            idInput.value = primerItem.id_pedido;
            llenarFila(filaEstatica, primerItem);

            let nombreAnterior = primerItem.nombre === "0" ? "" : primerItem.nombre;

            for (let i = 1; i < data.items.length; i++) {
                const item = data.items[i];
                agregarFilaPedido(item.id_pedido);
                
                const filas = contenedor.querySelectorAll(".fila-pedido");
                const nuevaFila = filas[filas.length - 1];
                llenarFila(nuevaFila, item);

                const nombreActual = item.nombre === "0" ? "" : item.nombre;
                const esMismaPersona = (nombreActual !== "" && nombreActual === nombreAnterior);

                if (esMismaPersona) {
                    nuevaFila.classList.add("fila-subitem");
                    const btnMas = nuevaFila.querySelector(".btn-add-subitem");
                    if (btnMas) btnMas.style.display = "none";
                    
                    const inputNombre = nuevaFila.querySelector(".nombre");
                    if (inputNombre) inputNombre.style.display = "none";
                    
                    nuevaFila.querySelectorAll("label, .espaciador-cruz").forEach(el => el.style.display = "none");
                    const campoPago = nuevaFila.querySelector(".forma_pago")?.closest(".campo");
                    const campoEstado = nuevaFila.querySelector(".estado")?.closest(".campo");
                    if (campoPago) campoPago.style.display = "none";
                    if (campoEstado) campoEstado.style.display = "none";
                } else {
                    nombreAnterior = nombreActual;
                }
            }
        }
        actualizarBotonesEliminar();

    } catch (err) { alert("Error al cargar grupo."); }
}

function llenarFila(fila, item) {
    fila.querySelector(".nombre").value = (item.nombre == "0") ? "" : item.nombre;
    fila.querySelector(".tipo_menu").value = (item.tipo_menu == "0") ? "" : item.tipo_menu;
    fila.querySelector(".menu").value = (item.menu == "0") ? "" : item.menu;
    fila.querySelector(".guarnicion").value = (item.guarnicion == "0") ? "" : item.guarnicion;
    fila.querySelector(".descripcion").value = (item.descripcion == "0") ? "" : item.descripcion;
    fila.querySelector(".cantidad").value = item.cantidad;
    fila.querySelector(".forma_pago").value = (item.forma_pago == "0") ? "" : item.forma_pago;
    fila.querySelector(".estado").value = (item.estado == "0") ? "" : item.estado;
}

function activarCampoEdicion(tipo) {
    const dir = document.getElementById('edit_direccion');
    const emp = document.getElementById('edit_empresa');
    const cad = document.getElementById('edit_cadete'); 
    
    if (cad) cad.value = "";

    if (tipo === 'direccion') { 
        emp.value = ''; emp.disabled = true; 
        dir.disabled = false; dir.focus();
        if(cad) { cad.disabled = false; cad.placeholder = "Seleccionar..."; }
    } else if (tipo === 'empresa') { 
        dir.value = ''; dir.disabled = true; 
        emp.disabled = false; emp.focus(); 
        if(cad) { cad.disabled = false; cad.placeholder = "Seleccionar..."; }
    } else if (tipo === 'retira') {
        dir.value = ''; dir.disabled = true; emp.value = ''; emp.disabled = true;
        if(cad) { cad.disabled = true; cad.placeholder = ""; }
    } else if (tipo === 'pedidosya') {
        dir.value = ''; dir.disabled = true; emp.value = ''; emp.disabled = true;
        if(cad) { cad.disabled = true; cad.placeholder = "PedidosYa"; }
    }
}

async function editarPedido(id_pedido) {
    try {
        const data = await apiFetch(`/api/pedido/${id_pedido}`); 
        datosOriginalesPedido = data; 

        const radioDir = document.querySelector("input[name='edit_tipo_origen'][value='direccion']");
        const radioEmp = document.querySelector("input[name='edit_tipo_origen'][value='empresa']");
        const radioRetira = document.querySelector("input[name='edit_tipo_origen'][value='retira']");
        const radioPedidosYa = document.querySelector("input[name='edit_tipo_origen'][value='pedidosya']"); 
        
        let empresaVal = (data.empresa == "0" || !data.empresa) ? "" : data.empresa;
        let direccionVal = (data.direccion == "0" || !data.direccion) ? "" : data.direccion;
        let cadeteVal = (data.cadete == "0" || !data.cadete) ? "" : data.cadete; 

        let pisoExtra = "", deptoExtra = "", timbreExtra = "";
        const existeInputPiso = document.getElementById("edit_piso");

        if (direccionVal && existeInputPiso && direccionVal.toUpperCase() !== "PEDIDOSYA") { 
            const matchPiso = direccionVal.match(/Piso[:]?\s*"([^"]+)"/i);
            if (matchPiso) { pisoExtra = matchPiso[1]; direccionVal = direccionVal.replace(matchPiso[0], ""); }
            const matchDepto = direccionVal.match(/Dpto[:]?\s*"([^"]+)"/i);
            if (matchDepto) { deptoExtra = matchDepto[1]; direccionVal = direccionVal.replace(matchDepto[0], ""); }
            const matchTimbre = direccionVal.match(/(?:Tbre|Timb|Timbre)[:]?\s*"([^"]+)"/i);
            if (matchTimbre) { timbreExtra = matchTimbre[1]; direccionVal = direccionVal.replace(matchTimbre[0], ""); }
            direccionVal = direccionVal.trim().replace(/,$/, "").trim();
        }

        if (direccionVal.toUpperCase() === "PEDIDOSYA") { 
            if(radioPedidosYa) radioPedidosYa.checked = true;
            activarCampoEdicion('pedidosya');
            cadeteVal = ""; 
        } else if (empresaVal) { 
            if(radioEmp) radioEmp.checked = true; 
            activarCampoEdicion('empresa'); 
            const inEmp = document.getElementById("edit_empresa");
            if(inEmp) inEmp.value = empresaVal; 
        } else if (direccionVal || pisoExtra || deptoExtra) { 
            if(radioDir) radioDir.checked = true; 
            activarCampoEdicion('direccion'); 
            const inDir = document.getElementById("edit_direccion");
            const inPiso = document.getElementById("edit_piso");
            const inDepto = document.getElementById("edit_depto");
            const inTimbre = document.getElementById("edit_timbre");
            if (inDir) inDir.value = direccionVal;
            if (inPiso) inPiso.value = pisoExtra;
            if (inDepto) inDepto.value = deptoExtra;
            if (inTimbre) inTimbre.value = timbreExtra;     
        } else {
            if (radioRetira) radioRetira.checked = true;
            activarCampoEdicion('retira');
        }
        
        document.getElementById("edit_cadete").value = cadeteVal;
        document.getElementById("edit_id_pedido").value = data.id_pedido;
        document.getElementById("edit_nombre").value = (data.nombre == "0") ? "" : data.nombre;
        document.getElementById("edit_tipo_menu").value = (data.tipo_menu == "0") ? "" : data.tipo_menu;
        document.getElementById("edit_menu").value = (data.menu == "0") ? "" : data.menu;
        document.getElementById("edit_guarnicion").value = (data.guarnicion == "0") ? "" : data.guarnicion;
        document.getElementById("edit_descripcion").value = (data.descripcion == "0") ? "" : data.descripcion;
        document.getElementById("edit_cantidad").value = data.cantidad;
        document.getElementById("edit_forma_pago").value = (data.forma_pago == "0") ? "" : data.forma_pago;
        document.getElementById("edit_estado").value = (data.estado == "0") ? "" : data.estado;

        const checkEditFrecuente = document.getElementById("edit_chkFrecuente");
        if (checkEditFrecuente) {
            checkEditFrecuente.checked = data.es_frecuente === true;
        }

        const modal = document.getElementById("modalEditarPedido");
        if(modal) modal.style.display = "block";

    } catch (err) { alert("Error al abrir edición: " + err.message); }
}

async function guardarEdicionPedido() {
    let dirCompleta = document.getElementById("edit_direccion").value.trim();
    const piso = document.getElementById("edit_piso")?.value.trim() || "";
    const depto = document.getElementById("edit_depto")?.value.trim() || "";
    const timbre = document.getElementById("edit_timbre")?.value.trim() || "";

    if (dirCompleta) {
        if (piso) dirCompleta += ` Piso: "${piso}"`;
        if (depto) dirCompleta += ` Dpto: "${depto}"`;
        if (timbre) dirCompleta += ` Timbre: "${timbre}"`;
    }

    //  1. OBTENEMOS LOS DATOS ORIGINALES Y LOS NUEVOS PARA COMPARAR
    const orig = datosOriginalesPedido; 
    const dirOrig = orig.direccion === "0" ? "" : orig.direccion;
    const empOrig = orig.empresa === "0" ? "" : orig.empresa;
    const menuOrig = orig.menu === "0" ? "" : orig.menu;

    const empresaNueva = document.getElementById("edit_empresa").value.trim();
    const menuNuevo = document.getElementById("edit_menu").value.trim();

    //  2. DETECTAMOS SI HUBO CAMBIOS CRÍTICOS (Dirección, Empresa o Menú)
    const cambiosCriticos = (dirCompleta !== dirOrig) || (empresaNueva !== empOrig) || (menuNuevo !== menuOrig);

    const esHistorial = !!document.getElementById("tablaCargados");
    
    //  3. LÓGICA FINAL: Si está en el historial Y hubo cambios críticos, lo devolvemos a pendientes
    const volverAPendientes = esHistorial ? cambiosCriticos : false;

    const data = {
        id_pedido: document.getElementById("edit_id_pedido").value,
        direccion: dirCompleta, 
        empresa: empresaNueva, // Usamos la variable que ya limpiamos
        cadete: document.getElementById("edit_cadete").value.trim(),
        nombre: document.getElementById("edit_nombre").value.trim(),
        tipo_menu: document.getElementById("edit_tipo_menu").value.trim(),
        menu: menuNuevo, // Usamos la variable que ya limpiamos
        guarnicion: document.getElementById("edit_guarnicion").value.trim(),
        descripcion: document.getElementById("edit_descripcion").value.trim(),
        cantidad: document.getElementById("edit_cantidad").value,
        forma_pago: document.getElementById("edit_forma_pago").value.trim(),
        estado: document.getElementById("edit_estado").value.trim(),
        volver_a_pendientes: volverAPendientes, 
        es_frecuente: document.getElementById("edit_chkFrecuente") ? document.getElementById("edit_chkFrecuente").checked : false
    };

    const esRetira = document.querySelector("input[name='edit_tipo_origen'][value='retira']")?.checked;
    const esPedidosYa = document.querySelector("input[name='edit_tipo_origen'][value='pedidosya']")?.checked;

    if (esPedidosYa) { data.direccion = "PedidosYa"; data.cadete = "PedidosYa"; }
    if (!esRetira && !esPedidosYa && !data.direccion && !data.empresa) { 
        return alert("⚠️ Debes indicar una Dirección, Empresa o seleccionar 'Retira' / 'PedidosYa'."); 
    }
    
    try {
        await apiFetch("/actualizar_pedido", { method: "POST", body: JSON.stringify(data) }); 
        
        const idEditado = parseInt(data.id_pedido);
        let cambiosTxt = [];
        
        let cambioItem = false; // Evaluador estricto de menú

        const nomOrig = orig.nombre === "0" ? "" : orig.nombre;
        if (data.nombre !== nomOrig) { cambiosTxt.push(`Cliente: '${nomOrig||"Vacío"}' ➔ '${data.nombre||"Vacío"}'`); cambioItem = true; }
        
        const tipoOrig = orig.tipo_menu === "0" ? "" : orig.tipo_menu;
        if (data.tipo_menu !== tipoOrig) { cambiosTxt.push(`Tipo: '${tipoOrig||"Vacío"}' ➔ '${data.tipo_menu||"Vacío"}'`); cambioItem = true; }
        
        if (data.menu !== menuOrig) { cambiosTxt.push(`Menú: '${menuOrig||"Vacío"}' ➔ '${data.menu||"Vacío"}'`); cambioItem = true; }
        
        const guarnOrig = orig.guarnicion === "0" ? "" : orig.guarnicion;
        if (data.guarnicion !== guarnOrig) { cambiosTxt.push(`Guarn.: '${guarnOrig||"Vacío"}' ➔ '${data.guarnicion||"Vacío"}'`); cambioItem = true; }
        
        if (String(data.cantidad) !== String(orig.cantidad)) { cambiosTxt.push(`Cant.: '${orig.cantidad}' ➔ '${data.cantidad}'`); cambioItem = true; }
        
        if (data.direccion !== dirOrig) { cambiosTxt.push(`Dir.: '${dirOrig||"Vacío"}' ➔ '${data.direccion||"Vacío"}'`); }
        
        const cadOrig = orig.cadete === "0" ? "" : orig.cadete;
        if (data.cadete !== cadOrig) { cambiosTxt.push(`Cadete: '${cadOrig||"Vacío"}' ➔ '${data.cadete||"Vacío"}'`); }

        if (cambiosTxt.length > 0) {
            let textos = JSON.parse(localStorage.getItem("textos_edicion") || "{}");
            
            // --- NUEVA LÓGICA: Conservar historial anterior ---
            let anteriores = textos[idEditado] || [];
            // Extraemos la primera palabra (ej: "Cadete:", "Menú:") para no repetir el mismo aviso dos veces
            let prefijosNuevos = cambiosTxt.map(c => c.split(":")[0] + ":");
            let filtrados = anteriores.filter(a => !prefijosNuevos.some(pref => a.startsWith(pref)));
            
            textos[idEditado] = [...filtrados, ...cambiosTxt];
            // --------------------------------------------------
            
            localStorage.setItem("textos_edicion", JSON.stringify(textos));

            let editadosGuardados = JSON.parse(localStorage.getItem("ids_azul_fijo") || "[]");
            if (!editadosGuardados.includes(idEditado)) editadosGuardados.push(idEditado);
            localStorage.setItem("ids_azul_fijo", JSON.stringify(editadosGuardados));
            
            let flags = JSON.parse(localStorage.getItem("flags_edicion") || "{}");
            let misFlags = new Set(flags[idEditado] || []);
            
            // Asignación de banderas estricta
            if (data.direccion !== dirOrig) misFlags.add("dir");
            if (data.cadete !== cadOrig) misFlags.add("cad");
            if (cambioItem) misFlags.add("item");

            flags[idEditado] = Array.from(misFlags);
            localStorage.setItem("flags_edicion", JSON.stringify(flags));
        }

        // 🔍 4. Solo lo subimos "al principio" si se queda en el historial
        if (esHistorial && !volverAPendientes) {
            let alPrincipio = JSON.parse(localStorage.getItem("ids_al_principio") || "[]");
            if (!alPrincipio.includes(idEditado)) alPrincipio.push(idEditado);
            localStorage.setItem("ids_al_principio", JSON.stringify(alPrincipio));
        }

        alert("✅ Pedido actualizado."); 
        cerrarModalEditar(); 
        recargarTablas(); 
    } catch (err) { alert(`❌ Error de conexión: ${err.message}`); }
}

/* async function cargarPedidosDinamicos() {
    let direccion = document.getElementById("direccion").value.trim();
    const piso = document.getElementById("piso").value.trim();
    const depto = document.getElementById("depto").value.trim();
    const timbre = document.getElementById("timbre").value.trim();

    if (direccion) {
        if (piso) direccion += ` Piso: "${piso}"`;
        if (depto) direccion += ` Dpto: "${depto}"`;
        if (timbre) direccion += ` Timbre: "${timbre}"`;
    }

    const empresa = document.getElementById("empresa").value.trim();
    let cadete = document.getElementById("cadete").value.trim();
    const esRetira = document.querySelector("input[name='tipo'][value='retira']")?.checked;
    const esPedidosYa = document.querySelector("input[name='tipo'][value='pedidosya']")?.checked;

    if (!esRetira && !esPedidosYa && !direccion && !empresa) { return alert("⚠️ Debés completar Dirección, Empresa o seleccionar 'Retira' / 'PedidosYa'."); }
    if (esPedidosYa) { direccion = "PedidosYa"; cadete = "PedidosYa"; }

    const idsOriginalesStr = document.getElementById("ids_grupo_originales").value;
    const esEdicion = idsOriginalesStr !== "";
    const modalScope = document.getElementById("modalNuevoPedido");
    const filas = modalScope.querySelectorAll(".fila-pedido");
    const pedidos = [];

    let nombrePadre = "", formaPagoPadre = "Pendiente", estadoPadre = "Pendiente";

    for (const fila of filas) {
        const inputNombreObj = fila.querySelector(".nombre");
        const esSubItem = fila.classList.contains("fila-subitem") || (inputNombreObj && inputNombreObj.style.display === "none");

        if (!esSubItem) {
            nombrePadre = inputNombreObj.value.trim();
            formaPagoPadre = fila.querySelector(".forma_pago").value.trim();
            estadoPadre = fila.querySelector(".estado").value.trim();
        }
        const nombre = esSubItem ? nombrePadre : inputNombreObj.value.trim();
        const forma_pago = esSubItem ? formaPagoPadre : fila.querySelector(".forma_pago").value.trim();
        const estado = esSubItem ? estadoPadre : fila.querySelector(".estado").value.trim();
        const tipo_menu = fila.querySelector(".tipo_menu").value.trim();
        const menu = fila.querySelector(".menu").value.trim();
        const guarnicion = fila.querySelector(".guarnicion").value.trim();
        const descripcion = fila.querySelector(".descripcion").value.trim();
        const cantidad = parseInt(fila.querySelector(".cantidad").value.trim()) || 1;

        const idHidden = fila.querySelector(".id_pedido_fila");
        const id_pedido = idHidden ? idHidden.value : null;

        const pedido = { id_pedido, nombre, tipo_menu, menu, guarnicion, descripcion, cantidad, forma_pago, estado };
        
        // Si estamos editando y existe un id_pedido, o si hay texto, lo enviamos.
        // Esto evita que el pedido se pierda/elimine si se le borra el texto durante una actualización.
        if (nombre !== "" || menu !== "" || descripcion !== "" || (esEdicion && id_pedido)) {
            pedidos.push(pedido);
        }
    }
    // El salvavidas original se mantiene solo para cuando es un alta 100% nueva y en blanco
    if (pedidos.length === 0 && !esEdicion) {
        const primeraFila = filas[0]; 
        pedidos.push({ id_pedido: null, nombre: "", tipo_menu: "", menu: "", guarnicion: "", descripcion: "", cantidad: 1, forma_pago: primeraFila.querySelector(".forma_pago").value.trim(), estado: primeraFila.querySelector(".estado").value.trim() });
    }
    
    //  1. DETECTAMOS CAMBIOS CRÍTICOS EN EL GRUPO (Dirección, Empresa o Menú de algún item)
    let cambiosCriticos = false;
    if (esEdicion && datosOriginalesGrupo) {
        const origCab = datosOriginalesGrupo.cabecera;
        const dirOrig = origCab.direccion === "0" ? "" : origCab.direccion;
        const empOrig = origCab.empresa === "0" ? "" : origCab.empresa;
        
        if (direccion !== dirOrig || empresa !== empOrig) {
            cambiosCriticos = true;
        } else {
            const itemsOriginales = datosOriginalesGrupo.items;
            for (const p of pedidos) {
                const id = parseInt(p.id_pedido);
                if (!id) continue;
                const itemViejo = itemsOriginales.find(i => parseInt(i.id_pedido) === id);
                if (itemViejo) {
                    const menuOrig = itemViejo.menu === "0" ? "" : itemViejo.menu;
                    if (p.menu !== menuOrig) {
                        cambiosCriticos = true;
                        break; // Con que uno cambie el menú, ya es crítico
                    }
                }
            }
        }
    }

    const esFrecuente = document.getElementById("chkFrecuente") ? document.getElementById("chkFrecuente").checked : false;
    const esHistorial = !!document.getElementById("tablaCargados");
    
    // 🔍 2. Si está en historial y hubo cambios críticos, lo devolvemos a pendientes
    const volverAPendientes = esHistorial ? cambiosCriticos : false;

    const url = esEdicion ? "/actualizar_grupo_pedidos" : "/cargar_pedidos";
    const data = { 
        direccion, 
        empresa, 
        cadete, 
        items: pedidos, 
        pedidos: pedidos, 
        ids_originales: esEdicion ? idsOriginalesStr.split(",") : [], 
        volver_a_pendientes: volverAPendientes, // 👇 Nuestra nueva variable inteligente
        es_frecuente: esFrecuente 
    };

    try {
        await apiFetch(url, { method: "POST", body: JSON.stringify(data) }); 
        const cantidadItemsCargados = pedidos.length; 
        
        if (!esEdicion) {
            const lista = await apiFetch(`/pedidos?t=${Date.now()}`); 
            lista.sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
            const nuevosIds = lista.slice(0, cantidadItemsCargados).map(p => p[0]);
            localStorage.setItem("ids_verde_fijo", JSON.stringify(nuevosIds));
            idsUltimoLote = new Set(nuevosIds);
        } else {
            let azules = JSON.parse(localStorage.getItem("ids_azul_fijo") || "[]");
            let flags = JSON.parse(localStorage.getItem("flags_edicion") || "{}");
            let textos = JSON.parse(localStorage.getItem("textos_edicion") || "{}");

            const origCab = datosOriginalesGrupo.cabecera;
            const dirOrig = origCab.direccion === "0" ? "" : origCab.direccion;
            const cadOrig = origCab.cadete === "0" ? "" : origCab.cadete;
            const itemsOriginales = datosOriginalesGrupo.items;
            
            pedidos.forEach(itemNuevo => {
                const id = parseInt(itemNuevo.id_pedido);
                if (!id) return;
                let misFlags = new Set(flags[id] || []);
                let cambiosTxt = []; 

                if (direccion !== dirOrig) cambiosTxt.push(`Dir.: '${dirOrig||"Vacío"}' ➔ '${direccion||"Vacío"}'`);
                if (cadete !== cadOrig) cambiosTxt.push(`Cadete: '${cadOrig||"Vacío"}' ➔ '${cadete||"Vacío"}'`);
                if (direccion !== dirOrig) misFlags.add("dir");
                if (cadete !== cadOrig) misFlags.add("cad");

                const itemViejo = itemsOriginales.find(i => parseInt(i.id_pedido) === id);
                if (itemViejo) {
                    const nomOrig = itemViejo.nombre === "0" ? "" : itemViejo.nombre;
                    if (itemNuevo.nombre !== nomOrig) cambiosTxt.push(`Cliente: '${nomOrig||"Vacío"}' ➔ '${itemNuevo.nombre||"Vacío"}'`);
                    const menuOrig = itemViejo.menu === "0" ? "" : itemViejo.menu;
                    if (itemNuevo.menu !== menuOrig) cambiosTxt.push(`Menú: '${menuOrig||"Vacío"}' ➔ '${itemNuevo.menu||"Vacío"}'`);
                    if (String(itemNuevo.cantidad) !== String(itemViejo.cantidad)) cambiosTxt.push(`Cant.: '${itemViejo.cantidad}' ➔ '${itemNuevo.cantidad}'`);

                    const cambioItem = (itemNuevo.nombre !== nomOrig) || (itemNuevo.menu !== menuOrig) || (String(itemNuevo.cantidad) !== String(itemViejo.cantidad));
                    if (cambioItem) misFlags.add("item");
                }
                if (cambiosTxt.length > 0) {
                    let anteriores = textos[id] || [];
                    let prefijosNuevos = cambiosTxt.map(c => c.split(":")[0] + ":");
                    let filtrados = anteriores.filter(a => !prefijosNuevos.some(pref => a.startsWith(pref)));
                    textos[id] = [...filtrados, ...cambiosTxt];
                }
                if (misFlags.size > 0) {
                    flags[id] = Array.from(misFlags);
                    if (!azules.includes(id)) azules.push(id);
                }
            });
            localStorage.setItem("ids_azul_fijo", JSON.stringify(azules));
            localStorage.setItem("flags_edicion", JSON.stringify(flags));
            localStorage.setItem("textos_edicion", JSON.stringify(textos)); 

            // 🔍 3. Solo lo subimos al principio de la lista visual si se queda en el historial
            if (esHistorial && !volverAPendientes) {
                let alPrincipio = JSON.parse(localStorage.getItem("ids_al_principio") || "[]");
                pedidos.forEach(p => { 
                    const id = parseInt(p.id_pedido); 
                    if (id && !alPrincipio.includes(id)) alPrincipio.push(id); 
                });
                localStorage.setItem("ids_al_principio", JSON.stringify(alPrincipio));
            }
        }
        esEdicion && alert("✅ Grupo actualizado.");
        cerrarModalNuevoPedido();
        if (typeof cargarPedidosEnTabla === "function") await cargarPedidosEnTabla();
        if (typeof recargarTablas === "function") recargarTablas();
    } catch (err) { alert(`❌ Error: ${err.message}`); }
} */
async function cargarPedidosDinamicos() {
    let direccion = document.getElementById("direccion").value.trim();
    const piso = document.getElementById("piso").value.trim();
    const depto = document.getElementById("depto").value.trim();
    const timbre = document.getElementById("timbre").value.trim();

    if (direccion) {
        if (piso) direccion += ` Piso: "${piso}"`;
        if (depto) direccion += ` Dpto: "${depto}"`;
        if (timbre) direccion += ` Timbre: "${timbre}"`;
    }

    const empresa = document.getElementById("empresa").value.trim();
    let cadete = document.getElementById("cadete").value.trim();
    const esRetira = document.querySelector("input[name='tipo'][value='retira']")?.checked;
    const esPedidosYa = document.querySelector("input[name='tipo'][value='pedidosya']")?.checked;

    if (!esRetira && !esPedidosYa && !direccion && !empresa) { return alert("⚠️ Debés completar Dirección, Empresa o seleccionar 'Retira' / 'PedidosYa'."); }
    if (esPedidosYa) { direccion = "PedidosYa"; cadete = "PedidosYa"; }

    const idsOriginalesStr = document.getElementById("ids_grupo_originales").value;
    const esEdicion = idsOriginalesStr !== "";
    // 👇 EL SALVAVIDAS: Traemos los IDs puros directamente desde el master
    const arrIdsSeguridad = esEdicion ? idsOriginalesStr.split(",") : [];

    const modalScope = document.getElementById("modalNuevoPedido");
    const filas = modalScope.querySelectorAll(".fila-pedido");
    const pedidos = [];

    let nombrePadre = "", formaPagoPadre = "Pendiente", estadoPadre = "Pendiente";
    let indexFila = 0; // Para rastrear qué ID le toca a cada fila

    for (const fila of filas) {
        const inputNombreObj = fila.querySelector(".nombre");
        const esSubItem = fila.classList.contains("fila-subitem") || (inputNombreObj && inputNombreObj.style.display === "none");

        if (!esSubItem) {
            nombrePadre = inputNombreObj.value.trim();
            formaPagoPadre = fila.querySelector(".forma_pago").value.trim();
            estadoPadre = fila.querySelector(".estado").value.trim();
        }
        
        const rawNombre = esSubItem ? nombrePadre : inputNombreObj.value.trim();
        const rawFormaPago = esSubItem ? formaPagoPadre : fila.querySelector(".forma_pago").value.trim();
        const rawEstado = esSubItem ? estadoPadre : fila.querySelector(".estado").value.trim();
        const rawTipoMenu = fila.querySelector(".tipo_menu").value.trim();
        const rawMenu = fila.querySelector(".menu").value.trim();
        const rawGuarnicion = fila.querySelector(".guarnicion").value.trim();
        const rawDescripcion = fila.querySelector(".descripcion").value.trim();
        const cantidad = parseInt(fila.querySelector(".cantidad").value.trim()) || 1;

        const idHidden = fila.querySelector(".id_pedido_fila");
        let id_pedido = (idHidden && idHidden.value.trim() !== "") ? idHidden.value : null;

        // 👇 MAGIA: Si el HTML perdió el ID por algún bug al borrar el texto, lo forzamos con el array de seguridad
        if (esEdicion && !id_pedido && arrIdsSeguridad[indexFila]) {
            id_pedido = arrIdsSeguridad[indexFila];
        }

        const pedido = { 
            id_pedido: id_pedido, 
            nombre: rawNombre || "0", 
            tipo_menu: rawTipoMenu || "0", 
            menu: rawMenu || "0", 
            guarnicion: rawGuarnicion || "", 
            descripcion: rawDescripcion || "", 
            cantidad: cantidad, 
            forma_pago: rawFormaPago || "Pendiente", 
            estado: rawEstado || "Pendiente",
            _menuLimpio: rawMenu 
        };
        
        // Al estar forzado el id_pedido, esto SIEMPRE será verdadero y nunca se eliminará
        if (rawNombre !== "" || rawMenu !== "" || rawDescripcion !== "" || (esEdicion && id_pedido)) {
            pedidos.push(pedido);
        }
        indexFila++;
    }
    
    // Si la hoja estaba 100% en blanco de origen (alta nueva)
    if (pedidos.length === 0 && !esEdicion) {
        const primeraFila = filas[0]; 
        pedidos.push({ 
            id_pedido: null, nombre: "0", tipo_menu: "0", menu: "0", guarnicion: "", descripcion: "", cantidad: 1, 
            forma_pago: primeraFila.querySelector(".forma_pago").value.trim() || "Pendiente", 
            estado: primeraFila.querySelector(".estado").value.trim() || "Pendiente",
            _menuLimpio: ""
        });
    }
    
    let cambiosCriticos = false;
    if (esEdicion && datosOriginalesGrupo) {
        const origCab = datosOriginalesGrupo.cabecera;
        const dirOrig = origCab.direccion === "0" ? "" : origCab.direccion;
        const empOrig = origCab.empresa === "0" ? "" : origCab.empresa;
        
        if (direccion !== dirOrig || empresa !== empOrig) {
            cambiosCriticos = true;
        } else {
            const itemsOriginales = datosOriginalesGrupo.items;
            for (const p of pedidos) {
                const id = parseInt(p.id_pedido);
                if (!id) continue;
                const itemViejo = itemsOriginales.find(i => parseInt(i.id_pedido) === id);
                if (itemViejo) {
                    const menuOrig = itemViejo.menu === "0" ? "" : itemViejo.menu;
                    if (p._menuLimpio !== menuOrig) { cambiosCriticos = true; break; }
                }
            }
        }
    }

    const esFrecuente = document.getElementById("chkFrecuente") ? document.getElementById("chkFrecuente").checked : false;
    const esHistorial = !!document.getElementById("tablaCargados");
    const volverAPendientes = esHistorial ? cambiosCriticos : false;

    const payloadPedidos = pedidos.map(p => { const { _menuLimpio, ...rest } = p; return rest; });

    const url = esEdicion ? "/actualizar_grupo_pedidos" : "/cargar_pedidos";
    const data = { 
        direccion, empresa, cadete, items: payloadPedidos, pedidos: payloadPedidos, 
        ids_originales: esEdicion ? idsOriginalesStr.split(",") : [], 
        volver_a_pendientes: volverAPendientes, es_frecuente: esFrecuente 
    };

    try {
        await apiFetch(url, { method: "POST", body: JSON.stringify(data) }); 
        const cantidadItemsCargados = pedidos.length; 
        
        if (!esEdicion) {
            const lista = await apiFetch(`/pedidos?t=${Date.now()}`); 
            lista.sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
            const nuevosIds = lista.slice(0, cantidadItemsCargados).map(p => p[0]);
            localStorage.setItem("ids_verde_fijo", JSON.stringify(nuevosIds));
            idsUltimoLote = new Set(nuevosIds);
        } else {
            let azules = JSON.parse(localStorage.getItem("ids_azul_fijo") || "[]");
            let flags = JSON.parse(localStorage.getItem("flags_edicion") || "{}");
            let textos = JSON.parse(localStorage.getItem("textos_edicion") || "{}");

            const origCab = datosOriginalesGrupo.cabecera;
            const dirOrig = origCab.direccion === "0" ? "" : origCab.direccion;
            const cadOrig = origCab.cadete === "0" ? "" : origCab.cadete;
            const itemsOriginales = datosOriginalesGrupo.items;
            
            pedidos.forEach(itemNuevo => {
                const id = parseInt(itemNuevo.id_pedido);
                if (!id) return; 
                
                let misFlags = new Set(flags[id] || []);
                let cambiosTxt = []; 

                if (direccion !== dirOrig) cambiosTxt.push(`Dir.: '${dirOrig||"Vacío"}' ➔ '${direccion||"Vacío"}'`);
                if (cadete !== cadOrig) cambiosTxt.push(`Cadete: '${cadOrig||"Vacío"}' ➔ '${cadete||"Vacío"}'`);
                if (direccion !== dirOrig) misFlags.add("dir");
                if (cadete !== cadOrig) misFlags.add("cad");

                const itemViejo = itemsOriginales.find(i => parseInt(i.id_pedido) === id);
                if (itemViejo) {
                    const nomOrig = itemViejo.nombre === "0" ? "" : itemViejo.nombre;
                    const nombreVisual = itemNuevo._menuLimpio === "" ? "" : (itemNuevo.nombre === "0" ? "" : itemNuevo.nombre);
                    if (nombreVisual !== nomOrig && nombreVisual !== "") cambiosTxt.push(`Cliente: '${nomOrig||"Vacío"}' ➔ '${nombreVisual||"Vacío"}'`);
                    
                    const menuOrig = itemViejo.menu === "0" ? "" : itemViejo.menu;
                    if (itemNuevo._menuLimpio !== menuOrig && itemNuevo._menuLimpio !== "") {
                        cambiosTxt.push(`Menú: '${menuOrig||"Vacío"}' ➔ '${itemNuevo._menuLimpio||"Vacío"}'`);
                    }
                    
                    if (String(itemNuevo.cantidad) !== String(itemViejo.cantidad)) cambiosTxt.push(`Cant.: '${itemViejo.cantidad}' ➔ '${itemNuevo.cantidad}'`);

                    const cambioItem = (nombreVisual !== nomOrig && nombreVisual !== "") || (itemNuevo._menuLimpio !== menuOrig && itemNuevo._menuLimpio !== "") || (String(itemNuevo.cantidad) !== String(itemViejo.cantidad));
                    if (cambioItem) misFlags.add("item");
                }

                // SI SE VACIÓ EL PEDIDO, PURGAMOS LA MEMORIA VISUAL
                if (itemNuevo._menuLimpio === "") {
                    misFlags.delete("item");
                    delete textos[id];
                    delete flags[id];
                    azules = azules.filter(x => x !== id);
                } else {
                    if (cambiosTxt.length > 0) {
                        let anteriores = textos[id] || [];
                        let prefijosNuevos = cambiosTxt.map(c => c.split(":")[0] + ":");
                        let filtrados = anteriores.filter(a => !prefijosNuevos.some(pref => a.startsWith(pref)));
                        textos[id] = [...filtrados, ...cambiosTxt];
                    }
                    if (misFlags.size > 0) {
                        flags[id] = Array.from(misFlags);
                        if (!azules.includes(id)) azules.push(id);
                    } else {
                        delete flags[id];
                        azules = azules.filter(x => x !== id);
                    }
                }
            });
            
            localStorage.setItem("ids_azul_fijo", JSON.stringify(azules));
            localStorage.setItem("flags_edicion", JSON.stringify(flags));
            localStorage.setItem("textos_edicion", JSON.stringify(textos)); 

            if (esHistorial && !volverAPendientes) {
                let alPrincipio = JSON.parse(localStorage.getItem("ids_al_principio") || "[]");
                pedidos.forEach(p => { 
                    const id = parseInt(p.id_pedido); 
                    if (id && !alPrincipio.includes(id)) alPrincipio.push(id); 
                });
                localStorage.setItem("ids_al_principio", JSON.stringify(alPrincipio));
            }
        }
        esEdicion && alert("✅ Grupo actualizado.");
        cerrarModalNuevoPedido();
        if (typeof cargarPedidosEnTabla === "function") await cargarPedidosEnTabla();
        if (typeof recargarTablas === "function") recargarTablas();
    } catch (err) { alert(`❌ Error: ${err.message}`); }
}
/* ========================================================================== */
/* 3. ACCIONES DE FILA Y TABLA (Mover, Borrar, Ocultar)                       */
/* ========================================================================== */

function limpiarMemoriaVisual(idNum) {
    ["ids_azul_fijo", "ids_verde_fijo", "ids_al_principio"].forEach(key => {
        let arr = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(key, JSON.stringify(arr.filter(x => x !== idNum)));
    });

    ["flags_edicion", "textos_edicion"].forEach(key => {
        let obj = JSON.parse(localStorage.getItem(key) || "{}");
        delete obj[idNum];
        localStorage.setItem(key, JSON.stringify(obj));
    });
}

async function moverAPedidosCargados(id_pedido, tieneMenu) {
    if (!tieneMenu) return alert("⚠️ Falta menú."); 
    try { 
        await apiFetch(`/mover_a_cargados/${id_pedido}`, { method: "POST" }); 
        limpiarMemoriaVisual(parseInt(id_pedido));
        recargarTablas(); 
    } catch (err) { alert("❌ Error al mover ítem."); }
}

async function moverPersonaCargados(idsStr, tieneMenu) {
    if (!idsStr) return;
    if (!tieneMenu) return alert("⚠️ Falta menú en alguno de los ítems de esta persona."); 
    const listaIds = idsStr.split(",");
    for (const id of listaIds) { 
        try {
            await apiFetch(`/mover_a_cargados/${id}`, { method: "POST" });
            limpiarMemoriaVisual(parseInt(id));
        } catch (err) { console.error(`Error moviendo ${id}:`, err); }
    }
    recargarTablas();
}

async function moverGrupoCargados(idsStr, grupoCompleto) {
    if (!idsStr) return;
    if (!grupoCompleto) return alert("⚠️ Uno o más pedidos NO tienen MENÚ.\nEditalos antes de cargar el grupo."); 
    if (!confirm("¿Marcar TODO este grupo como LISTO?")) return;

    const listaIds = idsStr.split(",");
    for (const id of listaIds) { 
        try {
            await apiFetch(`/mover_a_cargados/${id}`, { method: "POST" });
            limpiarMemoriaVisual(parseInt(id));
        } catch (err) { console.error(`Error moviendo ${id}:`, err); }
    }
    recargarTablas();
}

async function eliminarPedido(id_pedido) {
    if (!confirm("¿Borrar este ítem definitivamente?")) return;
    try {
        await apiFetch(`/eliminar_pedido/${id_pedido}`, { method: "POST" });
        recargarTablas(); 
    } catch (err) { alert("❌ Error al eliminar el pedido."); }
}

async function eliminarGrupoPersona(idsStr) {
    if (!idsStr) return;
    if (!confirm("⚠️ ¿Borrar TODOS los menús combinados de esta persona?")) return;
    const listaIds = idsStr.split(",");
    for (const id of listaIds) { 
        try { await apiFetch(`/eliminar_pedido/${id}`, { method: "POST" }); } 
        catch (err) { console.error(`Error borrando ${id}:`, err); }
    }
    recargarTablas();
}

async function eliminarGrupo(idsStr) {
    if (!idsStr) return;
    if (!confirm("⚠️ ¿Borrar TODOS los pedidos de esta dirección?")) return;
    const listaIds = idsStr.split(",");
    for (const id of listaIds) { 
        try { await apiFetch(`/eliminar_pedido/${id}`, { method: "POST" }); }
        catch (err) { console.error(`Error borrando ${id}:`, err); }
    }
    recargarTablas();
}

/* ========================================================================== */
/* ACTUALIZADOR DE SISTEMA (GIT PULL)                                         */
/* ========================================================================== */
async function ejecutarActualizacion() {
    const password = prompt("Ingrese la contraseña de administrador para actualizar:");
    
    // Si el usuario presiona "Cancelar", password es null. Salimos silenciosamente.
    if (password === null) {
        return; 
    }

    if (password === "adm1n1stra2r") {
        try {
            const data = await apiFetch('/api/actualizar/', { method: 'POST' });
            
            if(data.estado === 'ok') {
                const logTexto = data.log.toLowerCase();
                
                if (logTexto.includes("already up to date") || logTexto.includes("ya está actualizado")) {
                    alert("No hay actualizaciones disponibles. El sistema ya está en la última versión.");
                } else {
                    alert("Sistema actualizado correctamente.\n\n" + data.log);
                    location.reload();
                }
            } else {
                alert("Error en la actualización:\n" + data.log);
            }
        } catch(err) {
            alert("Error de conexión con el servidor.");
            console.error(err);
        }
    } else {
        alert("Contraseña incorrecta. Actualización cancelada.");
    }
}

// --- EXPORTAR AL OBJETO GLOBAL (Para que el HTML pueda llamar a los botones) ---
window.cargarPedidosEnTabla = cargarPedidosEnTabla;
window.recargarTablas = recargarTablas;
window.editarGrupo = editarGrupo;
window.editarPedido = editarPedido;
window.guardarEdicionPedido = guardarEdicionPedido;
window.cargarPedidosDinamicos = cargarPedidosDinamicos;
window.moverAPedidosCargados = moverAPedidosCargados;
window.moverPersonaCargados = moverPersonaCargados;
window.moverGrupoCargados = moverGrupoCargados;
window.eliminarPedido = eliminarPedido;
window.eliminarGrupoPersona = eliminarGrupoPersona;
window.eliminarGrupo = eliminarGrupo;
window.activarCampoEdicion = activarCampoEdicion;
window.ejecutarActualizacion = ejecutarActualizacion;