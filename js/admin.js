// Estado global
let productos = [];

// Elementos DOM
const productosLista = document.getElementById('products-table-body');
const totalProductos = document.getElementById('total-productos');
const totalCategorias = document.getElementById('total-categorias');
const modalProducto = document.getElementById('modal-producto');
const modalContent = document.getElementById('modal-content');
const formProducto = document.getElementById('form-producto');
const toast = document.getElementById('admin-toast');
const toastMsg = document.getElementById('toast-msg');

document.addEventListener('DOMContentLoaded', async () => {
    await cargarProductos();
});

async function cargarProductos() {
    try {
        const { data, error } = await window.supabase
            .from('productos')
            .select('*')
            .order('categoria', { ascending: true })
            .order('nombre', { ascending: true });

        if (error) throw error;

        productos = data;
        renderizarLista();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        showToast('Error al conectar con la base de datos', 'error');
    }
}

function renderizarLista() {
    productosLista.innerHTML = '';

    totalProductos.innerText = productos.length;
    const cats = [...new Set(productos.map(p => p.categoria))];
    totalCategorias.innerText = cats.length;

    productos.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50/50 transition-all duration-300 group/row border-b border-gray-50";
        tr.innerHTML = `
            <td class="py-5 px-6 text-center">
                <img src="${p.imagen || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80'}" 
                     class="w-12 h-12 rounded-xl object-cover border border-gray-100 group-hover/row:scale-105 transition-transform mx-auto">
            </td>
            <td class="py-5 px-6">
                <p class="font-black text-[#3a5a40] text-base tracking-tight">${p.nombre}</p>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate w-48 mt-1">${p.descripcion || 'Sin descripción'}</p>
            </td>
            <td class="py-5 px-6">
                <span class="bg-[#588157]/10 text-[#588157] border border-[#588157]/20 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">${p.categoria}</span>
            </td>
            <td class="py-5 px-6 font-black text-[#3a5a40] text-lg tracking-tighter">$${p.precio}</td>
            <td class="py-5 px-6">
                <span class="${p.activo ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'} text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                    ${p.activo ? 'En Menú' : 'Pausado'}
                </span>
            </td>
            <td class="py-5 px-6 text-right space-x-1">
                <button onclick="editarProducto('${p.id}')" class="text-gray-400 hover:text-[#588157] p-2.5 transition-colors"><i class="fas fa-edit"></i></button>
                <button onclick="eliminarProducto('${p.id}')" class="text-gray-300 hover:text-red-400 p-2.5 transition-colors"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        productosLista.appendChild(tr);
    });
}

// Modal logic
function abrirModalProducto() {
    formProducto.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('modal-title').innerText = 'Nuevo Producto';

    modalProducto.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalContent.classList.replace('scale-95', 'scale-100'), 10);
}

function cerrarModal() {
    modalContent.classList.replace('scale-100', 'scale-95');
    setTimeout(() => {
        modalProducto.classList.add('invisible', 'opacity-0');
    }, 300);
}

formProducto.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch animate-spin"></i> Guardando...';

    const id = document.getElementById('prod-id').value;
    const prod = {
        nombre: document.getElementById('prod-nombre').value,
        descripcion: document.getElementById('prod-descripcion').value,
        precio: parseFloat(document.getElementById('prod-precio').value),
        categoria: document.getElementById('prod-categoria').value,
        imagen: document.getElementById('prod-imagen').value,
        activo: document.getElementById('prod-activo').checked
    };

    try {
        let error;
        if (id) {
            // Update
            const { error: err } = await window.supabase.from('productos').update(prod).eq('id', id);
            error = err;
        } else {
            // Create
            const { error: err } = await window.supabase.from('productos').insert(prod);
            error = err;
        }

        if (error) throw error;

        showToast(id ? 'Producto actualizado' : 'Producto creado');
        cerrarModal();
        await cargarProductos();
    } catch (error) {
        console.error('Error al guardar:', error);
        showToast('Error al guardar los datos', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
    }
};

function editarProducto(id) {
    const p = productos.find(item => item.id === id);
    if (!p) return;

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-nombre').value = p.nombre;
    document.getElementById('prod-descripcion').value = p.descripcion || '';
    document.getElementById('prod-precio').value = p.precio;
    document.getElementById('prod-categoria').value = p.categoria;
    document.getElementById('prod-imagen').value = p.imagen || '';
    document.getElementById('prod-activo').checked = p.activo;

    document.getElementById('modal-title').innerText = 'Editar Producto';

    modalProducto.classList.remove('invisible', 'opacity-0');
    setTimeout(() => modalContent.classList.replace('scale-95', 'scale-100'), 10);
}

async function eliminarProducto(id) {
    if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) return;

    try {
        const { error } = await window.supabase.from('productos').delete().eq('id', id);
        if (error) throw error;

        showToast('Producto eliminado');
        await cargarProductos();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showToast('No se pudo eliminar el producto', 'error');
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
