// Estado global
let mesas = [];

// Elementos DOM
const tablesTableBody = document.getElementById('tables-table-body');
const totalMesas = document.getElementById('total-mesas');
const mesasAbiertas = document.getElementById('mesas-abiertas');
const modalMesa = document.getElementById('modal-mesa');
const modalContent = document.getElementById('modal-content');
const formMesa = document.getElementById('form-mesa');
const toast = document.getElementById('admin-toast');
const toastMsg = document.getElementById('toast-msg');

document.addEventListener('DOMContentLoaded', async () => {
    await cargarMesas();
});

async function cargarMesas() {
    try {
        const { data, error } = await window.supabase
            .from('mesas')
            .select('*')
            .order('numero', { ascending: true });

        if (error) throw error;

        mesas = data;
        renderizarLista();
    } catch (error) {
        console.error('Error al cargar mesas:', error);
        showToast('Error al conectar con la base de datos', 'error');
    }
}

function renderizarLista() {
    tablesTableBody.innerHTML = '';

    totalMesas.innerText = mesas.length;
    mesasAbiertas.innerText = mesas.filter(m => m.estado === 'abierta').length;

    mesas.forEach(m => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50/50 transition-all duration-300 group/row border-b border-gray-50";
        tr.innerHTML = `
            <td class="py-5 px-6 font-black text-[#3a5a40] text-lg tracking-tighter">
                ${m.nombre || `Mesa ${m.numero}`}
                ${m.nombre ? `<span class="block text-[10px] text-gray-400 font-bold uppercase tracking-widest">Mesa ${m.numero}</span>` : ''}
            </td>
            <td class="py-5 px-6">
                <span class="${m.estado === 'abierta' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-gray-100 text-gray-500 border border-gray-200'} text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                    ${m.estado}
                </span>
            </td>
            <td class="py-5 px-6 text-xs text-gray-400 font-bold uppercase tracking-widest">
                ${new Date(m.created_at).toLocaleDateString()}
            </td>
            <td class="py-5 px-6 text-right space-x-2 flex justify-end items-center gap-2">
                <button onclick="abrirModalEditar('${m.id}')" 
                    class="bg-[#588157]/10 text-[#588157] hover:bg-[#588157] hover:text-white px-3 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-[#588157]/10">
                    <i class="fas fa-edit"></i>
                    <span>Editar</span>
                </button>
                <button onclick="eliminarMesa('${m.id}', ${m.numero})" 
                    class="bg-red-50 text-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100">
                    <i class="fas fa-trash-alt"></i>
                    <span>Borrar</span>
                </button>
            </td>
        `;
        tablesTableBody.appendChild(tr);
    });
}

// Modal logic
function abrirModalMesa() {
    formMesa.reset();
    document.getElementById('modal-title').innerText = 'Nueva Mesa';
    document.getElementById('mesa-numero').disabled = false;
    const btnSave = document.getElementById('btn-save');
    btnSave.setAttribute('data-mode', 'create');
    btnSave.removeAttribute('data-id');
    modalMesa.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalContent.classList.replace('scale-95', 'scale-100'), 10);
}

function cerrarModal() {
    modalContent.classList.replace('scale-100', 'scale-95');
    setTimeout(() => {
        modalMesa.classList.add('invisible', 'opacity-0');
    }, 300);
}

function abrirModalEditar(id) {
    const mesa = mesas.find(m => m.id === id);
    if (!mesa) return;

    formMesa.reset();
    document.getElementById('modal-title').innerText = 'Editar Mesa';
    document.getElementById('mesa-numero').value = mesa.numero;
    document.getElementById('mesa-numero').disabled = true; // No permitir cambiar el número ID por conflictos
    document.getElementById('mesa-nombre').value = mesa.nombre || '';

    const btnSave = document.getElementById('btn-save');
    btnSave.setAttribute('data-mode', 'edit');
    btnSave.setAttribute('data-id', id);

    modalMesa.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalContent.classList.replace('scale-95', 'scale-100'), 10);
}

formMesa.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const numero = parseInt(document.getElementById('mesa-numero').value);
    const nombre = document.getElementById('mesa-nombre').value.trim();

    // Verificar si ya existe (solo en creación)
    const isCreate = btn.getAttribute('data-mode') !== 'edit';
    if (isCreate && mesas.some(m => m.numero === numero)) {
        showToast('Esta mesa ya existe', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch animate-spin"></i> Guardando...';

    try {
        const payload = { numero: numero, nombre: nombre || null };
        const isEdit = btn.getAttribute('data-mode') === 'edit';
        const id = btn.getAttribute('data-id');

        if (isEdit) {
            const { error } = await window.supabase
                .from('mesas')
                .update({ nombre: payload.nombre })
                .eq('id', id);
            if (error) throw error;
            showToast('Mesa actualizada correctamente');
        } else {
            const { error } = await window.supabase
                .from('mesas')
                .insert({ ...payload, estado: 'cerrada' });
            if (error) throw error;
            showToast('Mesa agregada correctamente');
        }
        cerrarModal();
        await cargarMesas();
    } catch (error) {
        console.error('Error al guardar:', error);
        showToast('Error al guardar los datos', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Confirmar Mesa';
    }
};

async function eliminarMesa(id, numero) {
    if (!confirm(`¿Estás seguro de eliminar la Mesa ${numero}?`)) return;

    try {
        // Intentar eliminar directamente
        const { error } = await window.supabase.from('mesas').delete().eq('id', id);

        if (error) {
            // Si hay error por pedidos asociados (FK constraint)
            if (error.code === '23503') {
                if (confirm(`La Mesa ${numero} tiene historial de pedidos. ¿Deseas eliminar la mesa y desvincular su historial para conservarlo en reportes?`)) {
                    // 1. Desvincular pedidos
                    const { error: updateError } = await window.supabase
                        .from('pedidos')
                        .update({ mesa_id: null })
                        .eq('mesa_id', id);

                    if (updateError) throw updateError;

                    // 2. Intentar eliminar la mesa de nuevo
                    const { error: deleteRetryError } = await window.supabase
                        .from('mesas')
                        .delete()
                        .eq('id', id);

                    if (deleteRetryError) throw deleteRetryError;
                } else {
                    return;
                }
            } else {
                throw error;
            }
        }

        showToast('Mesa eliminada con éxito');
        await cargarMesas();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast('Error crítico al eliminar la mesa', 'error');
    }
}

function showToast(msg, type = 'success') {
    const icon = document.getElementById('toast-icon');
    toastMsg.innerText = msg;

    if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle text-red-500';
    } else {
        icon.className = 'fas fa-check-circle text-green-400';
    }

    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 4000);
}
