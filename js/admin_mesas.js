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
            <td class="py-5 px-6 font-black text-[#3a5a40] text-lg tracking-tighter">Mesa ${m.numero}</td>
            <td class="py-5 px-6">
                <span class="${m.estado === 'abierta' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-gray-100 text-gray-500 border border-gray-200'} text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                    ${m.estado}
                </span>
            </td>
            <td class="py-5 px-6 text-xs text-gray-400 font-bold uppercase tracking-widest">
                ${new Date(m.created_at).toLocaleDateString()}
            </td>
            <td class="py-5 px-6 text-right space-x-1">
                <button onclick="eliminarMesa('${m.id}', ${m.numero})" class="text-gray-300 hover:text-red-400 p-2.5 transition-colors"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tablesTableBody.appendChild(tr);
    });
}

// Modal logic
function abrirModalMesa() {
    formMesa.reset();
    modalMesa.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalContent.classList.replace('scale-95', 'scale-100'), 10);
}

function cerrarModal() {
    modalContent.classList.replace('scale-100', 'scale-95');
    setTimeout(() => {
        modalMesa.classList.add('invisible', 'opacity-0');
    }, 300);
}

formMesa.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const numero = parseInt(document.getElementById('mesa-numero').value);

    // Verificar si ya existe
    if (mesas.some(m => m.numero === numero)) {
        showToast('Esta mesa ya existe', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch animate-spin"></i> Guardando...';

    try {
        const { error } = await window.supabase
            .from('mesas')
            .insert({ numero: numero, estado: 'cerrada' });

        if (error) throw error;

        showToast('Mesa agregada correctamente');
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
        const { error } = await window.supabase.from('mesas').delete().eq('id', id);
        if (error) throw error;

        showToast('Mesa eliminada');
        await cargarMesas();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast('No se pudo eliminar la mesa (podría tener pedidos asociados)', 'error');
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
