/* ========================================================================== */
/* GESTOR.JS - PANEL DE CONFIGURACIÓN (OCULTAR Y ELIMINAR ÍTEMS)              */
/* ========================================================================== */

function abrirModalGestorItems(tipo) {
    document.getElementById("dropdownOpciones").classList.add("oculto");
    document.getElementById("modalGestorItems").style.display = "block";
    document.getElementById("tipoGestorActual").value = tipo;
    
    const titulos = {
        'tipo_menu': '✏️ Gestionar Tipos de Menú',
        'menus': '✏️ Gestionar Menús',
        'guarniciones': '✏️ Gestionar Guarniciones',
        'cadetes': '✏️ Gestionar Cadetes',
        'forma_pago': '✏️ Gestionar Formas de Pago'
    };
    
    document.getElementById("tituloGestorItems").innerText = titulos[tipo] || 'Gestor de Ítems';
    document.getElementById("buscadorGestorItems").value = ""; 
    
    cargarListaGestor(tipo);
}

function cerrarModalGestorItems() {
    document.getElementById("modalGestorItems").style.display = "none";
}

async function cargarListaGestor(tipo) {
    const ul = document.getElementById("listaGestorItems");
    ul.innerHTML = "<li style='text-align:center; padding: 20px; color:#666;'>⏳ Cargando ítems...</li>";
    
    try {
        const res = await fetch(`/api/config_items/${tipo}`);
        if (!res.ok) throw new Error("Error obteniendo datos");
        const data = await res.json();
        
        ul.innerHTML = "";
        
        if(data.length === 0) {
            ul.innerHTML = "<li style='text-align:center; padding: 20px;'>No hay ítems registrados en esta categoría.</li>";
            return;
        }

        data.forEach(item => {
            let nombre = (item && typeof item.nombre === "string" && item.nombre.trim() !== "")
                ? item.nombre
                : "(vacío)"; 
            let oculto = item.oculto === true || item.oculto === 1; 
            let id_item = item.id || nombre; 
            
            const iconoOjo = oculto ? '🙈' : '👁️'; 
            const titleOjo = oculto ? 'Mostrar en las opciones' : 'Ocultar de las opciones';
            const claseBotonOjo = oculto ? 'btn-mostrar-gestor' : 'btn-ocultar-gestor';
            const claseFila = oculto ? 'item-oculto' : '';

            const li = document.createElement("li");
            li.className = claseFila;
            li.innerHTML = `
                <span class="item-nombre">${nombre}</span>
                <div class="item-acciones">
                    <button class="${claseBotonOjo}" onclick="toggleOcultarItem('${tipo}', '${id_item}', ${oculto})" title="${titleOjo}">
                        ${iconoOjo}
                    </button>
                    <button class="btn-borrar-gestor" onclick="eliminarItemBD('${tipo}', '${id_item}')" title="Eliminar definitivamente">🗑️</button>
                </div>
            `;
            ul.appendChild(li);
        });
    } catch (err) {
        console.error("Error al cargar el gestor:", err);
        ul.innerHTML = `<li style='color:red; text-align:center; padding: 10px;'>⚠️ Error al conectar con el servidor.</li>`;
    }
}

function filtrarGestorItems() {
    const filtro = document.getElementById("buscadorGestorItems").value.toLowerCase();
    const items = document.querySelectorAll("#listaGestorItems li");
    
    items.forEach(li => {
        const nombre = li.querySelector(".item-nombre")?.innerText.toLowerCase() || "";
        li.style.display = nombre.includes(filtro) ? "flex" : "none";
    });
}

async function eliminarItemBD(tipo, id_nombre) {
    if (!confirm(`¿Estás seguro de que querés ELIMINAR "${id_nombre}"?\nDesaparecerá de todas las listas.`)) return;
    try {
        const res = await fetch("/api/eliminar_item_config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: tipo, id_item: id_nombre }) 
        });
        if (res.ok) cargarListaGestor(tipo); 
        else { const data = await res.json(); alert("❌ " + data.error); }
    } catch(e) { console.error(e); alert("❌ Fallo de conexión con el servidor."); }
}

// --- FUNCIÓN MOSTRAR / OCULTAR ---
async function toggleOcultarItem(tipo, id_nombre, oculto) {
    try {
        const res = await fetch("/api/toggle_ocultar_item_config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo: tipo, id_item: id_nombre, oculto: oculto })
        });
        if (res.ok) cargarListaGestor(tipo);
        else alert("❌ Error al cambiar el estado.");
    } catch(e) { console.error(e); alert("❌ Fallo de conexión con el servidor."); }
}

window.toggleOcultarItem = toggleOcultarItem;
window.abrirModalGestorItems = abrirModalGestorItems;
window.cerrarModalGestorItems = cerrarModalGestorItems;
window.filtrarGestorItems = filtrarGestorItems;
window.eliminarItemBD = eliminarItemBD;